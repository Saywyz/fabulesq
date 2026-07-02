// Écran de fin : résumé de la run.
import { SKILLS } from '../../engine/data/skills';
import type { GameState } from '../../engine/types';
import type { Ctx } from '../context';
import { el } from '../dom';

export function gameOverScreen(state: GameState, _ctx: Ctx): HTMLElement {
  const { levelNumber, currentNode } = state.run;
  return el(
    'div',
    { class: 'screen', 'data-screen': 'gameover' },
    el('h1', {}, '💀 Game over'),
    el('p', {}, `L'équipe est tombée au niveau ${levelNumber}, nœud ${currentNode + 1}.`),
    el(
      'div',
      { class: 'cards' },
      ...state.players.map((p) =>
        el(
          'div',
          { class: 'card' },
          el('strong', {}, p.name),
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
