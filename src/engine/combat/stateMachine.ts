// Mise en place du combat et assignation des intentions ennemies (TECH_ARCHITECTURE.md §5).
import { BALANCE } from '../data/balance';
import { BOSS_WAVE, COMBAT_WAVES, ELITE_WAVES, ENEMIES } from '../data/enemies';
import { nextInt } from '../rng';
import { scaledEnemyDamage, scaledEnemyHp } from '../scaling';
import type { Enemy, Intent, MapNode, Player } from '../types';
import { chooseTarget } from './targeting';

/** Fabrique un ennemi à partir de son template, PV scalés (N joueurs, niveau, élite). */
export function spawnEnemy(
  enemyType: string,
  id: string,
  name: string,
  playerCount: number,
  levelNumber: number,
  hpMult: number,
): Enemy {
  const template = ENEMIES[enemyType]!;
  const hp = Math.round(scaledEnemyHp(template.baseHp, playerCount, levelNumber) * hpMult);
  return {
    id,
    name,
    hp,
    maxHp: hp,
    block: 0,
    speed: template.speed,
    statuses: [],
    alive: true,
    enemyType: template.enemyType,
    aiProfile: template.aiProfile,
    intent: null,
  };
}

/** Construit la vague d'un nœud : rotation déterministe par niveau/index, élite renforcé. */
export function buildEnemies(node: MapNode, playerCount: number, levelNumber: number): Enemy[] {
  const wave =
    node.type === 'boss'
      ? BOSS_WAVE
      : node.type === 'elite'
        ? ELITE_WAVES[(levelNumber - 1) % ELITE_WAVES.length]!
        : COMBAT_WAVES[(levelNumber - 1 + node.index) % COMBAT_WAVES.length]!;
  const hpMult = node.type === 'elite' ? BALANCE.eliteHpMult : 1;

  return wave.map((enemyType, i) => {
    const template = ENEMIES[enemyType]!;
    const name =
      wave.filter((t) => t === enemyType).length > 1 ? `${template.name} ${i + 1}` : template.name;
    return spawnEnemy(enemyType, `e${i + 1}`, name, playerCount, levelNumber, hpMult);
  });
}

export interface IntentsResult {
  enemies: Enemy[];
  rngState: number;
}

/**
 * Assigne l'intention télégraphiée de chaque ennemi vivant (aiProfile + PRNG, §4.3).
 * Une charge posée au tour précédent se libère en attaque au tour suivant.
 * damageMult : multiplicateur élite (GAME_DESIGN §3).
 */
export function assignIntents(
  enemies: Enemy[],
  players: Player[],
  rngState: number,
  levelNumber: number,
  damageMult = 1,
): IntentsResult {
  let rng = rngState;
  const scaled = (value: number) => Math.round(scaledEnemyDamage(value, levelNumber) * damageMult);
  const aliveCount = enemies.filter((e) => e.alive).length;

  const result = enemies.map((e): Enemy => {
    if (!e.alive) return { ...e, intent: null };
    const template = ENEMIES[e.enemyType]!;

    // Libération d'une charge télégraphiée
    if (e.intent?.kind === 'charge') {
      const value = e.intent.value ?? 0;
      const choice = chooseTarget(template.aiProfile, players, rng);
      rng = choice.state;
      const targetName = players.find((p) => p.id === choice.targetId)?.name ?? '?';
      return {
        ...e,
        intent: {
          kind: 'attack',
          value,
          targetId: choice.targetId ?? undefined,
          description: `déchaîne sa charge : ${value} → ${targetName}`,
        },
      };
    }

    // Tirage pondéré d'un move (l'invocation est coupée au plafond d'ennemis)
    const moves = template.moves.filter(
      (m) => m.kind !== 'summon' || aliveCount < BALANCE.maxEnemies,
    );
    const total = moves.reduce((sum, m) => sum + m.weight, 0);
    const roll = nextInt(rng, 1, total);
    rng = roll.state;
    let acc = 0;
    let move = moves[0]!;
    for (const m of moves) {
      acc += m.weight;
      if (roll.value <= acc) {
        move = m;
        break;
      }
    }

    let intent: Intent;
    switch (move.kind) {
      case 'attack': {
        const choice = chooseTarget(template.aiProfile, players, rng);
        rng = choice.state;
        const value = scaled(move.value ?? 0);
        const targetName = players.find((p) => p.id === choice.targetId)?.name ?? '?';
        intent = {
          kind: 'attack',
          value,
          targetId: choice.targetId ?? undefined,
          description: `${move.description} → ${targetName}`,
        };
        break;
      }
      case 'aoe': {
        intent = { kind: 'aoe', value: scaled(move.value ?? 0), description: move.description };
        break;
      }
      case 'charge': {
        intent = {
          kind: 'charge',
          value: scaled(move.value ?? 0),
          chargeTurnsLeft: move.chargeTurns ?? 1,
          description: move.description,
        };
        break;
      }
      case 'debuff': {
        const choice = chooseTarget(template.aiProfile, players, rng);
        rng = choice.state;
        const targetName = players.find((p) => p.id === choice.targetId)?.name ?? '?';
        intent = {
          kind: 'debuff',
          targetId: choice.targetId ?? undefined,
          description: `${move.description} → ${targetName}`,
        };
        break;
      }
      case 'heal': {
        // Soigne l'allié ennemi le plus blessé (lui-même inclus)
        const wounded = enemies
          .filter((x) => x.alive)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || (a.id < b.id ? -1 : 1))[0];
        intent = {
          kind: 'heal',
          value: move.value ?? 0,
          targetId: wounded?.id,
          description: move.description,
        };
        break;
      }
      default: {
        // buff, summon
        intent = { kind: move.kind, description: move.description };
        break;
      }
    }
    return { ...e, intent };
  });

  return { enemies: result, rngState: rng };
}
