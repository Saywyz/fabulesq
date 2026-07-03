// Mise en scène JRPG vue de côté (Phase 9) : l'équipe à gauche, les ennemis à droite.
// Positions 100 % présentationnelles, calculées depuis l'état — jamais stockées dedans
// (invariants C2/C3 : le moteur reste agnostique aux positions).

export const SCENE_W = 320;
export const SCENE_H = 180;
/** Ligne d'horizon : le sol occupe [GROUND_Y, SCENE_H]. */
export const GROUND_Y = 96;

export interface Anchor {
  id: string;
  x: number; // pieds du combattant (repère scène)
  y: number;
  scale: number;
}

const TOP = 112; // premier rang (le plus loin)
const BOTTOM = 176; // dernier rang (le plus proche)

/** Répartit `count` rangs entre TOP et BOTTOM (centré si peu nombreux). */
function rowY(row: number, rows: number): number {
  if (rows <= 1) return (TOP + BOTTOM) / 2 + 12;
  return TOP + (row * (BOTTOM - TOP)) / (rows - 1);
}

/**
 * Équipe (gauche) : 3 rangs maximum pour que les plaques ne masquent jamais le sprite
 * du rang suivant — on déborde en colonnes (1 col ≤ 3, 2 cols ≤ 6, 3 cols ≤ 8,
 * soft cap GAME_DESIGN §10). Léger décalage horizontal par rang (effet diagonale).
 */
export function layoutTeam(ids: string[]): Anchor[] {
  const cols = ids.length <= 3 ? 1 : ids.length <= 6 ? 2 : 3;
  const rows = Math.ceil(ids.length / cols);
  const colX = [90, 56, 24];
  return ids.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { id, x: colX[col]! + row * 6, y: rowY(row, rows), scale: 2 };
  });
}

/** Ennemis (droite), en miroir ; le boss est plus grand. Plafond moteur : 6 (2 cols × 3). */
export function layoutEnemies(enemies: { id: string; isBoss: boolean }[]): Anchor[] {
  const cols = enemies.length <= 3 ? 1 : 2;
  const rows = Math.ceil(enemies.length / cols);
  return enemies.map((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const baseX = col === 0 ? 232 : 278;
    return { id: e.id, x: baseX - row * 6, y: rowY(row, rows), scale: e.isBoss ? 3 : 2 };
  });
}

/** Coordonnées scène → pourcentages CSS (pour positionner les overlays DOM). */
export function toPct(a: { x: number; y: number }): { left: string; top: string } {
  return { left: `${(a.x / SCENE_W) * 100}%`, top: `${(a.y / SCENE_H) * 100}%` };
}
