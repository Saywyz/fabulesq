// Rendu des sprites pixel-art sur canvas (image-rendering: pixelated côté CSS).
// Palette-swap : les grilles utilisent des clés symboliques, les couleurs viennent
// de l'Appearance du joueur (TECH_ARCHITECTURE.md §2).
// Phase 9 : les primitives (drawMapAt, charLayers…) sont exposées pour que la scène
// de combat dessine tous les sprites sur UN canvas partagé (fondation animations Phase 10).
import type { Appearance } from '../../engine/types';
import { BODY, ENEMY_SPRITES, HAIR_STYLES, OUTFIT_STYLES, type PixelMap } from './pixelData';

const OUTLINE = '#1d1526';
const EYE = '#f6f1e7';

/** Assombrit une couleur hex pour les pixels d'ombre. */
function shade(hex: string, factor = 0.65): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((c) => Math.round(parseInt(c, 16) * factor));
  return `rgb(${r},${g},${b})`;
}

export interface LayerSpec {
  map: PixelMap;
  palette: Record<string, string>;
}

/** Dessine une grille à une position et une échelle données (repère du canvas). */
export function drawMapAt(
  g: CanvasRenderingContext2D,
  map: PixelMap,
  palette: Record<string, string>,
  x: number,
  y: number,
  scale = 1,
): void {
  map.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const color = palette[row[rx]!];
      if (color) {
        g.fillStyle = color;
        g.fillRect(x + rx * scale, y + ry * scale, scale, scale);
      }
    }
  });
}

/** Une apparence fraîchement jointe vaut 'default' (pas une couleur) : on retombe
 *  sur des teintes lisibles plutôt que de dessiner un personnage tout noir. */
function color(value: string, fallback: string): string {
  return value.startsWith('#') ? value : fallback;
}

/** Les couches d'un personnage (corps → tenue → cheveux) avec leurs palettes. */
export function charLayers(appearance: Appearance): LayerSpec[] {
  const skin = color(appearance.skinTone, '#f2c99a');
  const hair = color(appearance.hairColor, '#2c1b10');
  const outfit = color(appearance.outfitColor, '#3b5dc9');
  return [
    { map: BODY, palette: { k: OUTLINE, s: skin, S: shade(skin), w: EYE } },
    {
      map: OUTFIT_STYLES[appearance.outfitStyle] ?? OUTFIT_STYLES['tunique']!,
      palette: { o: outfit, O: shade(outfit) },
    },
    {
      map: HAIR_STYLES[appearance.hairStyle] ?? HAIR_STYLES['court']!,
      palette: { h: hair, H: shade(hair) },
    },
  ];
}

/** Dimensions du personnage (grille de référence : le corps). */
export const CHAR_W = 12;
export const CHAR_H = 14;

/** Dimensions d'une grille (la plus longue ligne × le nombre de lignes). */
export function mapSize(map: PixelMap): { w: number; h: number } {
  return { w: Math.max(...map.map((r) => r.length)), h: map.length };
}

/** Signature testable d'une apparence : la customisation doit être fidèle partout. */
export function spriteSignature(appearance: Appearance): string {
  return [
    appearance.skinTone,
    appearance.hairStyle,
    appearance.hairColor,
    appearance.outfitStyle,
    appearance.outfitColor,
  ].join('|');
}

/** Dessine un personnage sur un canvas partagé, pieds ancrés en (x, y). */
export function drawCharAt(
  g: CanvasRenderingContext2D,
  appearance: Appearance,
  x: number,
  y: number,
  scale = 1,
): void {
  const left = x - (CHAR_W * scale) / 2;
  const top = y - CHAR_H * scale;
  for (const layer of charLayers(appearance)) drawMapAt(g, layer.map, layer.palette, left, top, scale);
}

/** Dessine un ennemi sur un canvas partagé, pieds ancrés en (x, y). */
export function drawEnemyAt(
  g: CanvasRenderingContext2D,
  enemyType: string,
  x: number,
  y: number,
  scale = 1,
): void {
  const def = ENEMY_SPRITES[enemyType] ?? ENEMY_SPRITES['slime']!;
  const { w, h } = mapSize(def.map);
  drawMapAt(g, def.map, def.palette, x - (w * scale) / 2, y - h * scale, scale);
}

function makeCanvas(cols: number, rows: number, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  canvas.className = 'pixel-sprite';
  canvas.style.width = `${cols * scale}px`;
  canvas.style.height = `${rows * scale}px`;
  return canvas;
}

/** getContext peut jeter (jsdom) : dans ce cas le canvas reste un simple marqueur. */
export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/** Sprite de personnage autonome (lobby, prépa, carte, écrans de fin). */
export function charSprite(appearance: Appearance, scale = 4): HTMLCanvasElement {
  const canvas = makeCanvas(CHAR_W, CHAR_H, scale);
  canvas.dataset.sprite = spriteSignature(appearance);
  const g = context2d(canvas);
  if (!g) return canvas;
  drawCharAt(g, appearance, CHAR_W / 2, CHAR_H, 1);
  return canvas;
}

/** Sprite d'ennemi autonome (palette fixe par type). */
export function enemySprite(enemyType: string, scale = 4): HTMLCanvasElement {
  const def = ENEMY_SPRITES[enemyType] ?? ENEMY_SPRITES['slime']!;
  const { w, h } = mapSize(def.map);
  const canvas = makeCanvas(w, h, scale);
  canvas.dataset.enemySprite = enemyType;
  const g = context2d(canvas);
  if (!g) return canvas;
  drawMapAt(g, def.map, def.palette, 0, 0, 1);
  return canvas;
}
