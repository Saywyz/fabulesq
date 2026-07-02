// Plateau de combat — Phase 5 : sprites, ciblage en cliquant les cartes, planification
// séquentielle (un joueur actif à la fois), nombres flottants, flashs de dégâts.
// L'UI lit l'état et émet des Action — zéro règle calculée ici.
import { SKILLS } from '../../engine/data/skills';
import type { Enemy, GameState, Player, Skill } from '../../engine/types';
import { energyDots, hpBar } from '../components/bars';
import { statusChips } from '../components/statuses';
import type { Ctx } from '../context';
import { el } from '../dom';
import { charSprite, enemySprite } from '../pixel/sprite';

interface Fx {
  float: HTMLElement | null;
  cls: string;
}

/** Compare les PV au rendu précédent : nombre flottant + classe d'animation. */
function makeFx(ctx: Ctx): (id: string, hp: number) => Fx {
  return (id, hp) => {
    const last = ctx.ui.lastHp[id];
    ctx.ui.lastHp[id] = hp;
    if (last === undefined || last === hp) return { float: null, cls: '' };
    const delta = hp - last;
    return {
      float: el(
        'span',
        { class: `float-num ${delta < 0 ? 'float-dmg' : 'float-heal'}` },
        delta < 0 ? String(delta) : `+${delta}`,
      ),
      cls: delta < 0 ? ' was-hit' : ' was-healed',
    };
  };
}

function enemyCard(
  e: Enemy,
  fx: (id: string, hp: number) => Fx,
  target: { activeId: string; onTarget: (id: string) => void } | null,
): HTMLElement {
  const { float, cls } = fx(e.id, e.hp);
  const targetable = target !== null && e.alive;
  const card = el(
    targetable ? 'button' : 'div',
    {
      class: `card entity-card enemy-card${e.alive ? '' : ' dead'}${targetable ? ' targetable' : ''}${cls}`,
      'data-enemy': e.id,
      ...(targetable ? { 'data-target': `${target.activeId}:${e.id}`, onclick: () => target.onTarget(e.id) } : {}),
    },
    el('div', { class: 'sprite-box' }, enemySprite(e.enemyType, e.enemyType === 'ogre_boss' ? 5 : 4), float ?? ''),
    el('strong', { class: 'entity-name' }, e.name, e.alive ? '' : ' 💀'),
    hpBar(e.hp, e.maxHp),
    statusChips(e),
    e.alive && e.intent
      ? el('div', { class: 'intent', 'data-intent': '' }, `📣 ${e.intent.description}`)
      : '',
  );
  return card;
}

function playerCard(
  p: Player,
  state: GameState,
  fx: (id: string, hp: number) => Fx,
  target: { activeId: string; onTarget: (id: string) => void } | null,
): HTMLElement {
  const planned = state.combat?.planned[p.id];
  const { float, cls } = fx(p.id, p.hp);
  const targetable = target !== null; // les alliés à terre restent ciblables (revive)
  return el(
    targetable ? 'button' : 'div',
    {
      class: `card entity-card player-card${p.downed ? ' downed' : ''}${targetable ? ' targetable' : ''}${cls}`,
      'data-player': p.id,
      ...(targetable ? { 'data-target': `${target.activeId}:${p.id}`, onclick: () => target.onTarget(p.id) } : {}),
    },
    el('div', { class: 'sprite-box' }, charSprite(p.appearance, 3), float ?? ''),
    el('strong', { class: 'entity-name' }, p.name, p.downed ? ' 🪦' : planned?.confirmed ? ' ✔' : ''),
    hpBar(p.hp, p.maxHp),
    el('div', { class: 'meta' }, energyDots(p.energy, p.maxEnergy), el('span', {}, `💰${p.gold}`), el('span', { title: 'menace' }, `😡${p.threat}`)),
    statusChips(p),
    el(
      'div',
      { class: 'build', 'data-build': p.id, title: 'Build visible de tous — coordonnez-vous !' },
      p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · '),
    ),
  );
}

function skillCardBig(skill: Skill, p: Player, selected: boolean, onClick: () => void): HTMLElement {
  return el(
    'button',
    {
      class: `skill-card rarity-${skill.rarity}${selected ? ' selected' : ''}`,
      'data-skill': `${p.id}:${skill.id}`,
      disabled: skill.cost > p.energy,
      onclick: onClick,
    },
    el('span', { class: 'skill-name' }, skill.name),
    el('span', { class: 'skill-cost' }, '⚡'.repeat(skill.cost)),
    el('span', { class: 'skill-desc' }, skill.description),
  );
}

/** Barre de planification du joueur actif (séquentiel : un joueur à la fois). */
function planningBar(active: Player, state: GameState, ctx: Ctx): HTMLElement {
  const combat = state.combat!;
  const planned = combat.planned[active.id];
  const pendingId = ctx.ui.pendingSkill[active.id];
  const pending = pendingId ? SKILLS[pendingId] : undefined;

  const bar = el(
    'div',
    { class: 'panel planning-bar' },
    el('div', { class: 'planning-title' }, el('strong', {}, `⚔ Au tour de ${active.name}`), el('span', { class: 'muted' }, ' — choisissez une compétence')),
  );

  const row = el('div', { class: 'skills-row' });
  for (const skillId of active.skills) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    const selected = pendingId === skillId || planned?.skillId === skillId;
    row.append(
      skillCardBig(skill, active, selected, () => {
        if (skill.targeting === 'self') {
          ctx.dispatch({ t: 'plan_action', playerId: active.id, skillId });
        } else if (skill.targeting === 'all_enemies' || skill.targeting === 'all_allies') {
          ctx.dispatch({ t: 'plan_action', playerId: active.id, skillId });
        } else {
          // re-cliquer la compétence sélectionnée l'annule
          ctx.select(active.id, pendingId === skillId ? null : skillId);
        }
      }),
    );
  }
  bar.append(row);

  if (pending) {
    bar.append(
      el(
        'div',
        { class: 'target-hint' },
        pending.targeting === 'enemy' ? '👉 Cliquez sur un ennemi à cibler' : '👉 Cliquez sur l’allié à cibler',
      ),
    );
  }
  if (planned) {
    const skill = SKILLS[planned.skillId]!;
    const targetName =
      combat.enemies.find((e) => e.id === planned.targetId)?.name ??
      state.players.find((pl) => pl.id === planned.targetId)?.name ??
      (skill.targeting === 'all_enemies' ? 'tous les ennemis' : skill.targeting === 'all_allies' ? 'toute l’équipe' : active.name);
    bar.append(el('div', { class: 'planned' }, `Planifié : ${skill.name} → ${targetName}`));
  }
  bar.append(
    el(
      'button',
      {
        class: 'btn btn-primary btn-confirm',
        'data-confirm': active.id,
        disabled: !planned,
        onclick: () => ctx.dispatch({ t: 'confirm_action', playerId: active.id }),
      },
      '✔ Confirmer',
    ),
  );
  return bar;
}

export function combatScreen(state: GameState, ctx: Ctx): HTMLElement {
  const combat = state.combat!;
  const fx = makeFx(ctx);
  // Nouveau combat : on oublie les PV du combat précédent (pas de faux nombres flottants).
  if (combat.round === 1 && combat.log.length <= 1) ctx.ui.lastHp = {};

  // Planification séquentielle : premier joueur pilotable, debout, non confirmé.
  const controllable = state.players.filter((p) => p.alive && !p.downed && ctx.canControl(p.id));
  const active =
    state.phase === 'combat_planning'
      ? (controllable.find((p) => !combat.planned[p.id]?.confirmed) ?? null)
      : null;
  const pendingId = active ? ctx.ui.pendingSkill[active.id] : undefined;
  const pendingSkill = pendingId ? SKILLS[pendingId] : undefined;

  const plan = (targetId: string) => {
    if (active && pendingId) {
      ctx.dispatch({ t: 'plan_action', playerId: active.id, skillId: pendingId, targetId });
    }
  };
  const enemyTarget =
    active && pendingSkill?.targeting === 'enemy' ? { activeId: active.id, onTarget: plan } : null;
  const allyTarget =
    active && pendingSkill?.targeting === 'ally' ? { activeId: active.id, onTarget: plan } : null;

  const node = state.run.nodes[state.run.currentNode];
  const nodeLabel = node?.type === 'boss' ? '👹 BOSS' : node?.type === 'elite' ? '🗡️ Élite' : '⚔️ Combat';

  const logBox = el(
    'div',
    { class: 'log', 'data-log': '' },
    ...combat.log.slice(-40).map((line, i, arr) =>
      el('div', { class: `log-line${i >= arr.length - 6 ? ' fresh' : ''}` }, line),
    ),
  );
  queueMicrotask(() => {
    logBox.scrollTop = logBox.scrollHeight;
  });

  return el(
    'div',
    { class: 'screen combat-screen' , 'data-screen': 'combat' },
    el('div', { class: 'combat-header' }, el('h2', {}, `${nodeLabel} — round ${combat.round}`), el('span', { class: 'muted' }, `Niveau ${state.run.levelNumber}`)),
    el('div', { class: 'battlefield' }, el('div', { class: 'cards enemies' }, ...combat.enemies.map((e) => enemyCard(e, fx, enemyTarget)))),
    el('div', { class: 'cards players' }, ...state.players.map((p) => playerCard(p, state, fx, allyTarget))),
    active
      ? planningBar(active, state, ctx)
      : state.phase === 'combat_planning' && controllable.length > 0
        ? el('div', { class: 'panel planning-bar waiting' }, '⏳ En attente des autres joueurs…')
        : '',
    logBox,
  );
}
