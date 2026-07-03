// Carte de l'expédition (Phase 7) : route linéaire à longueur variable, taguée par biome.
import { BIOMES } from '../../engine/data/biomes';
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
};

const ENTER_LABELS: Record<MapNode['type'], string> = {
  combat: '⚔️ Entrer dans le combat',
  elite: '🗡️ Affronter l’élite',
  boss: '👹 Affronter le boss final !',
  event: '❓ Approcher…',
  rest: '🏕️ Établir le camp',
};

export function mapScreen(state: GameState, ctx: Ctx): HTMLElement {
  const { nodes, currentNode } = state.run;
  const current = nodes[currentNode];
  const biomeName = current ? (BIOMES[current.biome]?.name ?? current.biome) : '';
  return el(
    'div',
    { class: 'screen', 'data-screen': 'map' },
    el('h1', {}, `Expédition — nœud ${currentNode + 1}/${nodes.length}`),
    el('p', { class: 'muted', 'data-biome': current?.biome ?? '' }, `Biome : ${biomeName}`),
    el(
      'div',
      { class: 'map-nodes' },
      ...nodes.map((n) =>
        el(
          'div',
          {
            class: `map-node biome-${n.biome}${n.cleared ? ' cleared' : ''}${n.index === currentNode ? ' current' : ''}`,
            'data-node': String(n.index),
            title: `${n.type} · ${BIOMES[n.biome]?.name ?? n.biome}`,
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
      current ? ENTER_LABELS[current.type] : '…',
    ),
    el(
      'div',
      { class: 'party-strip' },
      ...state.players.map((p) =>
        el(
          'span',
          { class: 'chip party-chip' },
          charSprite(p.appearance, 2),
          ` ${p.name} · ${p.hp}/${p.maxHp} PV`,
        ),
      ),
    ),
  );
}
