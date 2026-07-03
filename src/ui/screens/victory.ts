// Écran de victoire (Phase 7) : le boss final est vaincu, l'expédition est accomplie.
import { SKILLS } from '../../engine/data/skills';
import type { GameState } from '../../engine/types';
import type { Ctx } from '../context';
import { el } from '../dom';
import { charSprite } from '../pixel/sprite';

export function victoryScreen(state: GameState, _ctx: Ctx): HTMLElement {
  return el(
    'div',
    { class: 'screen', 'data-screen': 'victory' },
    el('h1', {}, '🏆 Victoire !'),
    el('p', {}, `L'expédition est accomplie : ${state.run.nodes.length} nœuds traversés, le boss final est tombé.`),
    el(
      'p',
      { class: 'muted' },
      `Seed de l'expédition : ${state.run.seed} — hébergez avec cette seed (et la même longueur) pour la rejouer ou la partager.`,
    ),
    el(
      'div',
      { class: 'cards' },
      ...state.players.map((p) =>
        el(
          'div',
          { class: 'card gameover-card' },
          el('div', { class: 'card-header' }, charSprite(p.appearance, 4), el('strong', {}, p.name)),
          el('p', { class: 'muted' }, `Kit : ${p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · ')}`),
        ),
      ),
    ),
    el(
      'button',
      { class: 'btn btn-primary btn-big', 'data-new-game': '', onclick: () => window.location.reload() },
      '↻ Nouvelle expédition',
    ),
  );
}
