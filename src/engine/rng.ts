// PRNG seedé mulberry32 — fonctions pures, aucun état caché.
// L'état tient sur un uint32 et vit dans GameState.rngState : mêmes seed + tirages ⇒ même séquence.

export interface RngResult {
  value: number;
  state: number;
}

export function createRngState(seed: number): number {
  return Math.trunc(seed) >>> 0;
}

/** Tire un flottant dans [0, 1) et retourne le nouvel état du curseur. */
export function next(state: number): RngResult {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: s };
}

/** Tire un entier dans [min, max] inclus. */
export function nextInt(state: number, min: number, max: number): RngResult {
  const r = next(state);
  return { value: min + Math.floor(r.value * (max - min + 1)), state: r.state };
}
