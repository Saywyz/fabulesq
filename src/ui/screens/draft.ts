// Écran de draft : 3 offres par joueur, reroll, builds visibles (GAME_DESIGN.md §6).
import { SKILLS } from '../../engine/data/skills';
import type { GameState, Player } from '../../engine/types';
import { skillCard } from '../components/skillCard';
import type { Ctx } from '../context';
import { el } from '../dom';

function draftPanel(p: Player, state: GameState, ctx: Ctx): HTMLElement {
  const offers = state.draftOffers[p.id] ?? [];
  const pick = state.draftPicks[p.id];
  const rerolls = state.rerollsLeft[p.id] ?? 0;

  const panel = el(
    'div',
    { class: 'card draft-panel' },
    el('div', { class: 'card-header' }, el('strong', {}, p.name)),
    el('div', { class: 'build', 'data-build': p.id }, el('span', { class: 'muted' }, 'Build : '), p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · ')),
  );

  if (pick) {
    panel.append(el('p', {}, `✔ Choix : ${SKILLS[pick]?.name ?? pick}`));
    return panel;
  }
  if (offers.length === 0) {
    panel.append(el('p', { class: 'muted' }, 'Plus rien à apprendre !'));
    return panel;
  }

  const row = el('div', { class: 'skills-row' });
  for (const skillId of offers) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    row.append(
      skillCard(skill, {
        dataAttr: 'data-pick',
        dataValue: `${p.id}:${skillId}`,
        onClick: () => ctx.dispatch({ t: 'draft_pick', playerId: p.id, skillId }),
      }),
    );
  }
  panel.append(row);
  panel.append(
    el(
      'button',
      {
        class: 'btn',
        'data-reroll': p.id,
        disabled: rerolls <= 0,
        onclick: () => ctx.dispatch({ t: 'draft_reroll', playerId: p.id }),
      },
      `🎲 Relancer (${rerolls})`,
    ),
  );
  return panel;
}

export function draftScreen(state: GameState, ctx: Ctx): HTMLElement {
  return el(
    'div',
    { class: 'screen', 'data-screen': 'draft' },
    el('h1', {}, 'Victoire ! Choisissez une compétence'),
    el('div', { class: 'cards' }, ...state.players.map((p) => draftPanel(p, state, ctx))),
  );
}
