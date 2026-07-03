// Écran de fin : résumé de la run.
import { SKILLS } from '../../engine/data/skills';
import type { GameState } from '../../engine/types';
import type { Ctx } from '../context';
import { el } from '../dom';
import { charSprite } from '../pixel/sprite';

export function gameOverScreen(state: GameState, _ctx: Ctx): HTMLElement {
  const { levelNumber, currentNode } = state.run;
  return el(
    'div',
    { class: 'screen', 'data-screen': 'gameover' },
    el('h1', {}, '💀 Game over'),
    el('p', {}, `L'équipe est tombée au niveau ${levelNumber}, nœud ${currentNode + 1}.`),
    el(
      'p',
      { class: 'muted' },
      `Seed de la run : ${state.run.seed} — hébergez avec cette seed pour la revivre à l'identique.`,
    ),
    el(
      'div',
      { class: 'cards' },
      ...state.players.map((p) =>
        el(
          'div',
          { class: 'card gameover-card' },
          el('div', { class: 'card-header' }, charSprite(p.appearance, 4), el('strong', {}, p.name)),
          el('p', { class: 'muted' }, `💰 ${p.gold} · ${p.skills.length} compétences`),
          el('p', { class: 'muted' }, `Build : ${p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · ')}`),
        ),
      ),
    ),
    el(
      'button',
      { class: 'btn btn-primary btn-big', 'data-new-game': '', onclick: () => window.location.reload() },
      '↻ Nouvelle partie',
    ),
  );
}
