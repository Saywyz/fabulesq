// Carte linéaire de progression (GAME_DESIGN.md §3, MVP).
import type { GameState, MapNode } from '../../engine/types';
import type { Ctx } from '../context';
import { el } from '../dom';
import { charSprite } from '../pixel/sprite';

const NODE_ICONS: Record<MapNode['type'], string> = {
  combat: '⚔️',
  elite: '🗡️',
  boss: '👹',
  event: '❓',
  rest: '🏕️',
  shop: '🛒',
};

export function mapScreen(state: GameState, ctx: Ctx): HTMLElement {
  const { nodes, currentNode, levelNumber } = state.run;
  return el(
    'div',
    { class: 'screen', 'data-screen': 'map' },
    el('h1', {}, `Niveau ${levelNumber}`),
    el(
      'div',
      { class: 'map-nodes' },
      ...nodes.map((n) =>
        el(
          'div',
          {
            class: `map-node${n.cleared ? ' cleared' : ''}${n.index === currentNode ? ' current' : ''}`,
            'data-node': String(n.index),
            title: n.type,
          },
          `${NODE_ICONS[n.type]}`,
          el('span', { class: 'node-label' }, n.cleared ? '✓' : n.index === currentNode ? '▶' : ''),
        ),
      ),
    ),
    el(
      'button',
      {
        class: 'btn btn-primary btn-big',
        'data-enter-node': '',
        onclick: () => ctx.dispatch({ t: 'enter_node', nodeIndex: currentNode }),
      },
      nodes[currentNode]?.type === 'boss' ? '👹 Affronter le boss !' : '⚔️ Entrer dans le combat',
    ),
    el(
      'div',
      { class: 'party-strip' },
      ...state.players.map((p) =>
        el(
          'span',
          { class: 'chip party-chip' },
          charSprite(p.appearance, 2),
          ` ${p.name} · ${p.hp}/${p.maxHp} PV · 💰${p.gold}`,
        ),
      ),
    ),
  );
}
