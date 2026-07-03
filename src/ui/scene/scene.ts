// Couche canvas persistante de la scène de combat (Phase 9).
// UN canvas partagé, conservé dans l'UiState à travers les re-renders : la boucle
// d'animation de la Phase 10 dessinera dedans en continu. En attendant, il est
// redessiné à chaque changement d'état. Cosmétique pur (invariant C2) : la scène
// LIT l'état, n'écrit jamais dedans.
// jsdom : pas de contexte 2D → le canvas reste un marqueur inerte (data-scene-biome),
// toute la logique testable passe par les overlays DOM.
import { ENEMIES } from '../../engine/data/enemies';
import type { GameState } from '../../engine/types';
import type { SceneHandle } from '../context';
import { context2d, drawCharAt, drawEnemyAt } from '../pixel/sprite';
import { drawBackdrop } from './backdrop';
import { layoutEnemies, layoutTeam, SCENE_H, SCENE_W } from './layout';

function draw(canvas: HTMLCanvasElement, state: GameState): void {
  const biome = state.run.nodes[state.run.currentNode]?.biome ?? '';
  canvas.dataset.sceneBiome = biome; // marqueur testable, posé même sans contexte 2D
  const g = context2d(canvas);
  if (!g || !state.combat) return;

  g.clearRect(0, 0, SCENE_W, SCENE_H);
  drawBackdrop(g, biome);

  // Équipe à gauche — les joueurs à terre restent visibles, estompés.
  const team = layoutTeam(state.players.map((p) => p.id));
  for (const anchor of team) {
    const p = state.players.find((x) => x.id === anchor.id)!;
    g.globalAlpha = p.downed || !p.alive ? 0.35 : 1;
    drawCharAt(g, p.appearance, anchor.x, anchor.y, anchor.scale);
  }

  // Ennemis à droite — les morts disparaissent de la scène (leur plaque DOM reste).
  const foes = layoutEnemies(
    state.combat.enemies.map((e) => ({ id: e.id, isBoss: ENEMIES[e.enemyType]?.isBoss ?? false })),
  );
  for (const anchor of foes) {
    const e = state.combat.enemies.find((x) => x.id === anchor.id)!;
    if (!e.alive) continue;
    g.globalAlpha = 1;
    drawEnemyAt(g, e.enemyType, anchor.x, anchor.y, anchor.scale);
  }
  g.globalAlpha = 1;
}

/** Canvas de scène persistant : créé une fois, réutilisé à chaque render. */
export function getScene(ui: { scene?: SceneHandle }): SceneHandle {
  if (ui.scene) return ui.scene;
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  canvas.className = 'scene-canvas pixel-sprite';
  const handle: SceneHandle = { canvas, draw: (state) => draw(canvas, state) };
  ui.scene = handle;
  return handle;
}
