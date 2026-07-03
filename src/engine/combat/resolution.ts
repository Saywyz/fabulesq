// Résolution d'un round : actions des joueurs puis intentions ennemies dans l'ordre
// d'initiative, fin de tour, puis vérification victoire/défaite (TECH_ARCHITECTURE.md §5).
import { generateOffers } from '../draft';
import { BALANCE } from '../data/balance';
import { ENEMIES } from '../data/enemies';
import { DRAFT_POOL, SKILLS } from '../data/skills';
import { bossActionsPerTurn } from '../scaling';
import type {
  Combatant,
  Enemy,
  GameState,
  Player,
  SkillEffect,
  SkillId,
  StatusKind,
} from '../types';
import { assignIntents, spawnEnemy } from './stateMachine';
import { applyStatus, dealDamage, getStacks, heal, removeStatus, tickEndOfTurn } from './status';
import { chooseTarget } from './targeting';

function reviveAt<T extends Player>(p: T, pct: number): T {
  return {
    ...p,
    downed: false,
    alive: true,
    hp: Math.max(1, Math.floor((p.maxHp * pct) / 100)),
    statuses: [],
    block: 0,
  };
}

/** Ordre d'initiative : speed décroissante, départage stable par id. */
function bySpeed(a: Combatant, b: Combatant): number {
  return b.speed - a.speed || (a.id < b.id ? -1 : 1);
}

/** Montant d'un effet avec ses synergies (SkillEffect.scalesWith). */
function effectAmount(eff: SkillEffect, actor: Combatant, target: Combatant): number {
  let amount = eff.amount ?? 0;
  if (eff.scalesWith === 'strength') {
    amount += getStacks(actor, 'strength') * BALANCE.scalingStrengthBonusPerStack;
  } else if (eff.scalesWith === 'tag_count' && eff.tag) {
    amount *= 1 + getStacks(target, eff.tag as StatusKind);
  } else if (eff.scalesWith === 'missing_hp') {
    amount += Math.floor((actor.maxHp - actor.hp) / BALANCE.scalingMissingHpDivisor);
  }
  return amount;
}

export function resolveRound(state: GameState): GameState {
  const combat = state.combat;
  if (!combat) return state;

  const node = state.run.nodes[state.run.currentNode];
  const eliteDamageMult = node?.type === 'elite' ? BALANCE.eliteDamageMult : 1;

  let players = [...state.players];
  let enemies = [...combat.enemies];
  let rng = state.rngState;
  const log = [...combat.log, `— Round ${combat.round} —`];

  const playerById = (id?: string) => players.find((p) => p.id === id);
  const enemyById = (id?: string) => enemies.find((e) => e.id === id);
  const updPlayer = (id: string, fn: (p: Player) => Player) => {
    players = players.map((p) => (p.id === id ? fn(p) : p));
  };
  const updEnemy = (id: string, fn: (e: Enemy) => Enemy) => {
    enemies = enemies.map((e) => (e.id === id ? fn(e) : e));
  };
  const downIfDead = (p: Player): Player => (p.hp === 0 ? { ...p, downed: true } : p);

  // Joueurs d'abord, puis ennemis (GAME_DESIGN.md §4.1), chacun trié par initiative.
  const playerOrder = players.filter((p) => p.alive && !p.downed).sort(bySpeed).map((p) => p.id);
  const enemyOrder = enemies.filter((e) => e.alive).sort(bySpeed).map((e) => e.id);
  const initiativeOrder = [...playerOrder, ...enemyOrder];

  // ——— Actions des joueurs ———
  for (const pid of playerOrder) {
    const actor = playerById(pid)!;
    if (!actor.alive || actor.downed) continue;
    const planned = combat.planned[pid];
    if (!planned) continue;
    const skill = SKILLS[planned.skillId];
    if (!skill || actor.energy < skill.cost) continue;

    // Cibles ; cible unique invalide = action perdue, sans redirection (§5.1).
    let enemyTargets: string[] = [];
    let playerTargets: string[] = [];
    let lost = false;
    switch (skill.targeting) {
      case 'enemy': {
        const t = enemyById(planned.targetId);
        if (t?.alive) enemyTargets = [t.id];
        else lost = true;
        break;
      }
      case 'all_enemies':
        enemyTargets = enemies.filter((e) => e.alive).map((e) => e.id);
        break;
      case 'ally': {
        const t = playerById(planned.targetId);
        const needsDowned = skill.effects.some((e) => e.type === 'revive');
        if (t && (needsDowned ? t.downed : t.alive && !t.downed)) playerTargets = [t.id];
        else lost = true;
        break;
      }
      case 'all_allies':
        playerTargets = players.filter((p) => p.alive && !p.downed).map((p) => p.id);
        break;
      default:
        playerTargets = [pid]; // 'self'
    }
    if (lost) {
      log.push(`L'action de ${actor.name} (${skill.name}) est perdue : cible invalide.`);
      continue;
    }

    updPlayer(pid, (p) => ({ ...p, energy: p.energy - skill.cost }));

    for (const eff of skill.effects) {
      switch (eff.type) {
        case 'damage': {
          for (const targetId of enemyTargets) {
            const target = enemyById(targetId);
            if (!target?.alive) continue; // déjà tombé sous un effet précédent
            const attacker = playerById(pid)!;
            const res = dealDamage(attacker, target, effectAmount(eff, attacker, target));
            updEnemy(targetId, () => res.target);
            updPlayer(pid, (p) => ({ ...p, threat: p.threat + res.dealt * BALANCE.threatPerDamage }));
            log.push(`${actor.name} inflige ${res.dealt} à ${target.name} (${skill.name}).`);
            if (!res.target.alive) log.push(`${target.name} est vaincu !`);
          }
          break;
        }
        case 'detonate': {
          const kind = (eff.tag ?? 'mark') as StatusKind;
          for (const targetId of enemyTargets) {
            const target = enemyById(targetId);
            if (!target?.alive) continue;
            const stacks = getStacks(target, kind);
            if (stacks === 0) {
              log.push(`${skill.name} : rien à détoner sur ${target.name}.`);
              continue;
            }
            const attacker = playerById(pid)!;
            const res = dealDamage(attacker, target, (eff.amount ?? 0) * stacks);
            updEnemy(targetId, () => removeStatus(res.target, kind));
            updPlayer(pid, (p) => ({ ...p, threat: p.threat + res.dealt * BALANCE.threatPerDamage }));
            log.push(`${actor.name} détone ${stacks} ${kind} : ${res.dealt} dégâts à ${target.name} !`);
            if (!res.target.alive) log.push(`${target.name} est vaincu !`);
          }
          break;
        }
        case 'block': {
          for (const targetId of playerTargets) {
            updPlayer(targetId, (p) => ({ ...p, block: p.block + (eff.amount ?? 0) }));
          }
          log.push(`${actor.name} : +${eff.amount ?? 0} bouclier (${skill.name}).`);
          break;
        }
        case 'apply_status': {
          if (!eff.status) break;
          if (enemyTargets.length > 0) {
            for (const targetId of enemyTargets) {
              const target = enemyById(targetId);
              if (!target?.alive) continue;
              updEnemy(targetId, (e) =>
                applyStatus(e, eff.status!, eff.stacks ?? 1, eff.duration ?? -1, pid),
              );
            }
            log.push(`${actor.name} applique ${eff.stacks ?? 1} ${eff.status} (${skill.name}).`);
          } else {
            for (const targetId of playerTargets) {
              updPlayer(targetId, (p) =>
                applyStatus(p, eff.status!, eff.stacks ?? 1, eff.duration ?? -1, pid),
              );
            }
            log.push(`${actor.name} applique ${eff.stacks ?? 1} ${eff.status} (${skill.name}).`);
          }
          break;
        }
        case 'heal': {
          for (const targetId of playerTargets) {
            updPlayer(targetId, (p) => heal(p, eff.amount ?? 0));
          }
          log.push(`${actor.name} soigne (${skill.name}).`);
          break;
        }
        case 'taunt': {
          updPlayer(pid, (p) => ({ ...p, threat: p.threat + (eff.amount ?? 0) }));
          log.push(`${actor.name} provoque les ennemis (+${eff.amount ?? 0} menace).`);
          break;
        }
        case 'revive': {
          for (const targetId of playerTargets) {
            updPlayer(targetId, (p) => reviveAt(p, eff.amount ?? BALANCE.revivedHpPct));
            log.push(`${actor.name} relève ${playerById(targetId)!.name} !`);
          }
          break;
        }
      }
    }
  }

  // ——— Intentions des ennemis ———
  for (const eid of enemyOrder) {
    const enemy = enemyById(eid)!;
    if (!enemy.alive) continue; // tué avant d'agir
    const intent = enemy.intent;
    if (!intent) continue;
    const template = ENEMIES[enemy.enemyType]!;

    switch (intent.kind) {
      case 'attack': {
        const times = template.isBoss ? bossActionsPerTurn(players.length) : 1;
        for (let i = 0; i < times; i++) {
          // Cible télégraphiée pour le premier coup ; sinon (ou si invalide) re-ciblage.
          let targetId = i === 0 ? intent.targetId : undefined;
          const telegraphed = playerById(targetId);
          if (!telegraphed || !telegraphed.alive || telegraphed.downed) {
            const choice = chooseTarget(enemy.aiProfile, players, rng);
            rng = choice.state;
            targetId = choice.targetId ?? undefined;
          }
          const target = playerById(targetId);
          if (!target) break; // plus personne debout
          const res = dealDamage(enemyById(eid)!, target, intent.value ?? 0);
          updPlayer(target.id, () => downIfDead(res.target));
          log.push(`${enemy.name} attaque ${target.name} : ${res.dealt} dégâts.`);
          if (res.target.hp === 0) log.push(`${target.name} est à terre !`);
        }
        break;
      }
      case 'aoe': {
        log.push(`${enemy.name} : ${intent.description} !`);
        for (const p of players.filter((p) => p.alive && !p.downed)) {
          const res = dealDamage(enemyById(eid)!, playerById(p.id)!, intent.value ?? 0);
          updPlayer(p.id, () => downIfDead(res.target));
          log.push(`${p.name} encaisse ${res.dealt} dégâts.`);
          if (res.target.hp === 0) log.push(`${p.name} est à terre !`);
        }
        break;
      }
      case 'buff': {
        const move = template.moves.find((m) => m.kind === 'buff');
        if (move?.status) {
          updEnemy(eid, (x) => applyStatus(x, move.status!, move.stacks ?? 1, -1));
        }
        log.push(`${enemy.name} ${intent.description}.`);
        break;
      }
      case 'debuff': {
        const move = template.moves.find((m) => m.kind === 'debuff');
        let target = playerById(intent.targetId);
        if (!target || !target.alive || target.downed) {
          const choice = chooseTarget(enemy.aiProfile, players, rng);
          rng = choice.state;
          target = playerById(choice.targetId ?? undefined);
        }
        if (move?.status && target) {
          updPlayer(target.id, (p) =>
            applyStatus(p, move.status!, move.stacks ?? 1, BALANCE.enemyDebuffDuration, eid),
          );
          log.push(`${enemy.name} inflige ${move.status} à ${target.name} !`);
        }
        break;
      }
      case 'summon': {
        const move = template.moves.find((m) => m.kind === 'summon');
        const aliveCount = enemies.filter((e) => e.alive).length;
        if (move?.summons && aliveCount < BALANCE.maxEnemies) {
          const summonedTemplate = ENEMIES[move.summons]!;
          const id = `e${enemies.length + 1}`;
          const hpMult = node?.type === 'elite' ? BALANCE.eliteHpMult : 1;
          enemies = [
            ...enemies,
            spawnEnemy(move.summons, id, `${summonedTemplate.name} (invoquée)`, players.length, state.run.levelNumber, hpMult),
          ];
          log.push(`${enemy.name} invoque ${summonedTemplate.name} !`);
        }
        break;
      }
      case 'heal': {
        let target = enemyById(intent.targetId);
        if (!target?.alive) {
          target = enemies
            .filter((x) => x.alive)
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || (a.id < b.id ? -1 : 1))[0];
        }
        if (target) {
          updEnemy(target.id, (e) => heal(e, intent.value ?? 0));
          log.push(`${enemy.name} soigne ${target.name} de ${intent.value ?? 0} PV.`);
        }
        break;
      }
      case 'charge': {
        log.push(`${enemy.name} ${intent.description}…`);
        break; // la charge se libère au prochain tour (assignIntents)
      }
      default:
        break;
    }
  }

  // ——— Fin de tour : statuts sur la durée, durées, boucliers (§4.1.4) ———
  for (const { id } of [...players]) {
    const p = playerById(id)!;
    if (!p.alive || p.downed) continue; // à terre : statuts gelés (§5.1)
    const tick = tickEndOfTurn(p);
    updPlayer(id, () => downIfDead(tick.combatant));
    log.push(...tick.log);
    if (tick.combatant.hp === 0) log.push(`${p.name} est à terre !`);
  }
  for (const { id } of [...enemies]) {
    const e = enemyById(id)!;
    if (!e.alive) continue;
    const tick = tickEndOfTurn(e);
    updEnemy(id, () => tick.combatant);
    log.push(...tick.log);
    if (!tick.combatant.alive) log.push(`${e.name} succombe !`);
  }

  // ——— Vérification victoire / défaite ———
  const allDowned = players.every((p) => !p.alive || p.downed);
  const allEnemiesDead = enemies.every((e) => !e.alive);

  if (allDowned) {
    log.push('Toute l’équipe est à terre… Game over.');
    return {
      ...state,
      players,
      rngState: rng,
      phase: 'game_over',
      combat: { ...combat, enemies, log, initiativeOrder },
    };
  }

  if (allEnemiesDead) {
    // Butin (GAME_DESIGN §9) et résurrection de fin de niveau (§8)
    const goldReward =
      node?.type === 'boss'
        ? BALANCE.goldPerBoss
        : node?.type === 'elite'
          ? BALANCE.goldPerElite
          : BALANCE.goldPerCombat;
    log.push(`Victoire ! Chacun ramasse ${goldReward} pièces d'or.`);
    players = players.map((p) => ({
      ...(p.downed ? reviveAt(p, BALANCE.revivedHpPct) : p),
      gold: p.gold + goldReward,
    }));

    // Après un élite ou un boss, le tirage est plus généreux (GAME_DESIGN §3)
    const weights =
      node?.type === 'elite' || node?.type === 'boss'
        ? BALANCE.eliteRarityWeights
        : BALANCE.rarityWeights;
    const draftOffers: Record<string, SkillId[]> = {};
    const draftPicks: Record<string, SkillId | null> = {};
    const rerollsLeft: Record<string, number> = {};
    for (const p of players) {
      const g = generateOffers(DRAFT_POOL, BALANCE.draftOfferCount, rng, p.skills, weights);
      rng = g.state;
      draftOffers[p.id] = g.offers;
      draftPicks[p.id] = null;
      rerollsLeft[p.id] = BALANCE.rerollsPerDraft;
    }
    return {
      ...state,
      players,
      rngState: rng,
      phase: 'reward_draft',
      draftOffers,
      draftPicks,
      rerollsLeft,
      combat: { ...combat, enemies, log, initiativeOrder },
    };
  }

  // ——— Round suivant : énergie rechargée, nouvelles intentions ———
  players = players.map((p) => ({ ...p, energy: p.maxEnergy }));
  const intents = assignIntents(enemies, players, rng, state.run.levelNumber, eliteDamageMult);
  return {
    ...state,
    players,
    rngState: intents.rngState,
    phase: 'combat_planning',
    combat: {
      ...combat,
      round: combat.round + 1,
      enemies: intents.enemies,
      planned: {},
      cheered: {}, // les joueurs à terre peuvent de nouveau encourager
      log,
      initiativeOrder,
    },
  };
}
