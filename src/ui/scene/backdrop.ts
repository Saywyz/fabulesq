// Décors de biome — Phase 9, décision D4 : composition 100 % programmatique
// (dégradés de ciel, silhouettes, sol), une palette par biome, zéro asset.
// Cosmétique pur : rien ici ne lit ni n'écrit le GameState (invariant C2).
import { SCENE_H, SCENE_W, GROUND_Y } from './layout';

interface BackdropPalette {
  skyTop: string;
  skyBottom: string;
  far: string; // silhouettes lointaines
  near: string; // silhouettes proches
  ground: string;
  groundShade: string;
  accent: string; // lueur / détails
}

const PALETTES: Record<string, BackdropPalette> = {
  forest: {
    skyTop: '#16222e',
    skyBottom: '#2c473c',
    far: '#22372c',
    near: '#182a20',
    ground: '#25381f',
    groundShade: '#1c2c18',
    accent: '#c9d6a3',
  },
  castle: {
    skyTop: '#191226',
    skyBottom: '#3a2c52',
    far: '#241b38',
    near: '#170f28',
    ground: '#2a2438',
    groundShade: '#211c2d',
    accent: '#e0a63c',
  },
  volcano: {
    skyTop: '#210b0e',
    skyBottom: '#5a2418',
    far: '#33130d',
    near: '#1c0c0a',
    ground: '#241014',
    groundShade: '#1b0c0f',
    accent: '#ff7a3c',
  },
};

const FALLBACK: BackdropPalette = {
  skyTop: '#1f1730',
  skyBottom: '#191227',
  far: '#241b2f',
  near: '#1c1529',
  ground: '#241b2f',
  groundShade: '#1c1529',
  accent: '#9c8fb0',
};

/** Dents de scie déterministes (silhouette de forêt / crêtes). */
function jaggedBand(
  g: CanvasRenderingContext2D,
  color: string,
  baseY: number,
  amplitude: number,
  step: number,
  phase: number,
): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, SCENE_H);
  g.lineTo(0, baseY);
  for (let x = 0; x <= SCENE_W; x += step) {
    // Variation pseudo-aléatoire mais FIGÉE (fonction déterministe de x) : décor stable.
    const n = Math.sin(x * 0.71 + phase) + Math.sin(x * 0.23 + phase * 2);
    g.lineTo(x + step / 2, baseY - amplitude * (0.5 + 0.5 * Math.abs(n) * 0.5) );
    g.lineTo(x + step, baseY);
  }
  g.lineTo(SCENE_W, SCENE_H);
  g.closePath();
  g.fill();
}

/** Créneaux de muraille (château). */
function battlements(g: CanvasRenderingContext2D, color: string, topY: number): void {
  g.fillStyle = color;
  g.fillRect(0, topY, SCENE_W, GROUND_Y - topY);
  const merlonW = 12;
  for (let x = 0; x < SCENE_W; x += merlonW * 2) {
    g.fillRect(x, topY - 7, merlonW, 7);
  }
}

/** Cône de volcan avec cratère luisant. */
function volcanoCone(g: CanvasRenderingContext2D, color: string, accent: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(60, GROUND_Y);
  g.lineTo(140, 34);
  g.lineTo(165, 34);
  g.lineTo(250, GROUND_Y);
  g.closePath();
  g.fill();
  g.fillStyle = accent;
  g.fillRect(140, 31, 25, 4); // lave du cratère
  g.fillStyle = `${accent}44`;
  g.fillRect(130, 24, 45, 7); // halo
}

/** Dessine le décor complet d'un biome sur la scène (SCENE_W × SCENE_H). */
export function drawBackdrop(g: CanvasRenderingContext2D, biomeId: string): void {
  const p = PALETTES[biomeId] ?? FALLBACK;

  // Ciel en dégradé
  const sky = g.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(1, p.skyBottom);
  g.fillStyle = sky;
  g.fillRect(0, 0, SCENE_W, GROUND_Y);

  // Astre
  g.fillStyle = `${p.accent}cc`;
  g.beginPath();
  g.arc(268, 30, 11, 0, Math.PI * 2);
  g.fill();

  // Silhouettes par biome
  if (biomeId === 'castle') {
    jaggedBand(g, p.far, GROUND_Y - 26, 22, 34, 1.3); // toits lointains
    battlements(g, p.near, GROUND_Y - 34);
    g.fillStyle = p.accent;
    for (const x of [40, 120, 200, 280]) g.fillRect(x, GROUND_Y - 22, 2, 3); // torches
  } else if (biomeId === 'volcano') {
    jaggedBand(g, p.far, GROUND_Y - 12, 30, 26, 0.4); // crêtes de basalte
    volcanoCone(g, p.near, p.accent);
  } else {
    // forêt (et défaut organique) : deux rangées d'arbres
    jaggedBand(g, p.far, GROUND_Y - 8, 34, 22, 0.9);
    jaggedBand(g, p.near, GROUND_Y, 26, 30, 2.2);
  }

  // Sol
  g.fillStyle = p.ground;
  g.fillRect(0, GROUND_Y, SCENE_W, SCENE_H - GROUND_Y);
  g.fillStyle = p.groundShade;
  for (let y = GROUND_Y + 8; y < SCENE_H; y += 12) {
    g.fillRect(0, y, SCENE_W, 3);
  }
  if (biomeId === 'volcano') {
    g.fillStyle = `${p.accent}66`;
    for (const [x, y, w] of [[30, 120, 26], [140, 150, 34], [250, 132, 22]] as const) {
      g.fillRect(x, y, w, 2); // fissures de lave
    }
  }
}
