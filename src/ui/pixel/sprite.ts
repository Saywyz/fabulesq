// Rendu des sprites pixel-art sur canvas (image-rendering: pixelated côté CSS).
// Palette-swap : les grilles utilisent des clés symboliques, les couleurs viennent
// de l'Appearance du joueur (TECH_ARCHITECTURE.md §2).
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

function drawLayer(
  g: CanvasRenderingContext2D,
  map: PixelMap,
  palette: Record<string, string>,
): void {
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]!];
      if (color) {
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
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
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/** Sprite de personnage en couches : corps → tenue → cheveux. */
export function charSprite(appearance: Appearance, scale = 4): HTMLCanvasElement {
  const canvas = makeCanvas(12, 14, scale);
  // Signature testable : la customisation doit se refléter partout à l'identique.
  canvas.dataset.sprite = [
    appearance.skinTone,
    appearance.hairStyle,
    appearance.hairColor,
    appearance.outfitStyle,
    appearance.outfitColor,
  ].join('|');

  const g = context2d(canvas);
  if (!g) return canvas;

  drawLayer(g, BODY, { k: OUTLINE, s: appearance.skinTone, S: shade(appearance.skinTone), w: EYE });
  const outfit = OUTFIT_STYLES[appearance.outfitStyle] ?? OUTFIT_STYLES['tunique']!;
  drawLayer(g, outfit, { o: appearance.outfitColor, O: shade(appearance.outfitColor) });
  const hair = HAIR_STYLES[appearance.hairStyle] ?? HAIR_STYLES['court']!;
  drawLayer(g, hair, { h: appearance.hairColor, H: shade(appearance.hairColor) });
  return canvas;
}

/** Sprite d'ennemi (palette fixe par type). */
export function enemySprite(enemyType: string, scale = 4): HTMLCanvasElement {
  const def = ENEMY_SPRITES[enemyType] ?? ENEMY_SPRITES['slime']!;
  const cols = Math.max(...def.map.map((r) => r.length));
  const canvas = makeCanvas(cols, def.map.length, scale);
  canvas.dataset.enemySprite = enemyType;
  const g = context2d(canvas);
  if (!g) return canvas;
  drawLayer(g, def.map, def.palette);
  return canvas;
}
