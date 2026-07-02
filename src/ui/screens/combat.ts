// Plateau de combat : intentions ennemies, barres de vie, statuts, journal, builds,
// et planification hot-seat. L'UI lit l'état et émet des Action — zéro règle calculée ici.
import { SKILLS } from '../../engine/data/skills';
import type { Enemy, GameState, Player } from '../../engine/types';
import { avatarPreview } from './lobby';
import { energyDots, hpBar } from '../components/bars';
import { skillCard } from '../components/skillCard';
import { statusChips } from '../components/statuses';
import type { Ctx } from '../context';
import { el } from '../dom';

function enemyCard(e: Enemy): HTMLElement {
  return el(
    'div',
    { class: `card enemy-card${e.alive ? '' : ' dead'}`, 'data-enemy': e.id },
    el('div', { class: 'card-header' }, el('strong', {}, e.name), e.alive ? '' : ' 💀'),
    hpBar(e.hp, e.maxHp),
    statusChips(e),
    e.alive && e.intent
      ? el('div', { class: 'intent', 'data-intent': '' }, `📣 ${e.intent.description}`)
      : '',
  );
}

function playerStatus(p: Player, state: GameState): HTMLElement {
  const planned = state.combat?.planned[p.id];
  return el(
    'div',
    { class: `card player-card${p.downed ? ' downed' : ''}`, 'data-player': p.id },
    el('div', { class: 'card-header' }, avatarPreview(p.appearance), el('strong', {}, p.name), p.downed ? ' 🪦 à terre' : ''),
    hpBar(p.hp, p.maxHp),
    el('div', { class: 'meta' }, energyDots(p.energy, p.maxEnergy), el('span', { class: 'threat' }, ` 😡 menace ${p.threat}`)),
    statusChips(p),
    el(
      'div',
      { class: 'build', 'data-build': p.id },
      el('span', { class: 'muted' }, 'Build : '),
      p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · '),
    ),
    planned?.confirmed ? el('div', { class: 'muted' }, '✔ action confirmée') : '',
  );
}

/** Zone de planification d'un joueur debout (hot-seat : tous les panneaux sont visibles). */
function planningPanel(p: Player, state: GameState, ctx: Ctx): HTMLElement {
  const combat = state.combat!;
  const planned = combat.planned[p.id];
  const pending = ctx.ui.pendingSkill[p.id];

  if (planned?.confirmed) {
    return el('div', { class: 'panel confirmed' }, el('strong', {}, p.name), ' attend les autres…');
  }

  const panel = el('div', { class: 'panel' }, el('strong', {}, `Au tour de ${p.name}`));

  // 1. Choix de la compétence
  const skillsRow = el('div', { class: 'skills-row' });
  for (const skillId of p.skills) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    skillsRow.append(
      skillCard(skill, {
        dataAttr: 'data-skill',
        dataValue: `${p.id}:${skillId}`,
        disabled: skill.cost > p.energy,
        selected: pending === skillId || planned?.skillId === skillId,
        onClick: () => {
          if (skill.targeting === 'self') {
            ctx.dispatch({ t: 'plan_action', playerId: p.id, skillId });
          } else {
            ctx.select(p.id, skillId);
          }
        },
      }),
    );
  }
  panel.append(skillsRow);

  // 2. Choix de la cible pour la compétence sélectionnée
  if (pending) {
    const skill = SKILLS[pending]!;
    const targetsRow = el('div', { class: 'targets-row' }, el('span', { class: 'muted' }, 'Cible : '));
    const plan = (targetId: string) =>
      ctx.dispatch({ t: 'plan_action', playerId: p.id, skillId: pending, targetId });
    if (skill.targeting === 'enemy') {
      for (const e of combat.enemies.filter((e) => e.alive)) {
        targetsRow.append(
          el('button', { class: 'btn btn-target', 'data-target': `${p.id}:${e.id}`, onclick: () => plan(e.id) }, e.name),
        );
      }
    } else if (skill.targeting === 'ally') {
      for (const ally of state.players) {
        targetsRow.append(
          el(
            'button',
            { class: 'btn btn-target', 'data-target': `${p.id}:${ally.id}`, onclick: () => plan(ally.id) },
            `${ally.name}${ally.downed ? ' (à terre)' : ''}`,
          ),
        );
      }
    }
    panel.append(targetsRow);
  }

  // 3. Récapitulatif + confirmation
  if (planned) {
    const skill = SKILLS[planned.skillId]!;
    const targetName =
      combat.enemies.find((e) => e.id === planned.targetId)?.name ??
      state.players.find((pl) => pl.id === planned.targetId)?.name ??
      p.name;
    panel.append(el('div', { class: 'planned' }, `Planifié : ${skill.name} → ${targetName}`));
  }
  panel.append(
    el(
      'button',
      {
        class: 'btn btn-primary',
        'data-confirm': p.id,
        disabled: !planned,
        onclick: () => ctx.dispatch({ t: 'confirm_action', playerId: p.id }),
      },
      'Confirmer',
    ),
  );
  return panel;
}

export function combatScreen(state: GameState, ctx: Ctx): HTMLElement {
  const combat = state.combat!;
  const standing = state.players.filter((p) => p.alive && !p.downed);

  const logBox = el(
    'div',
    { class: 'log', 'data-log': '' },
    ...combat.log.slice(-30).map((line) => el('div', { class: 'log-line' }, line)),
  );

  return el(
    'div',
    { class: 'screen', 'data-screen': 'combat' },
    el('h2', {}, `Round ${combat.round}`),
    el('div', { class: 'cards enemies' }, ...combat.enemies.map(enemyCard)),
    el('div', { class: 'cards players' }, ...state.players.map((p) => playerStatus(p, state))),
    el('div', { class: 'panels' }, ...standing.map((p) => planningPanel(p, state, ctx))),
    logBox,
  );
}
