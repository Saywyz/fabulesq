// Génération procédurale de l'expédition (Phase 7, BUILD_PLAN_V2 §A.4).
// Déterministe : toute l'aléa passe par le PRNG seedé (rngState), donc une même seed
// + une même bande de longueur produisent exactement la même suite de nœuds.
import { BALANCE } from './data/balance';
import { BIOME_IDS } from './data/biomes';
import { nextInt } from './rng';
import type { GameState, LengthBand, MapNode, RunState } from './types';

export interface ExpeditionResult {
  nodes: MapNode[];
  state: number; // curseur PRNG après génération
}

/**
 * Génère une expédition linéaire à longueur variable : les biomes s'enchaînent en
 * segments contigus (ordre mélangé par run), chaque segment se termine par un jalon
 * (élite, ou le boss final pour le dernier), avec un nœud spécial léger (événement
 * ou repos) au milieu des segments assez longs. Le premier nœud est toujours un combat.
 */
export function generateExpedition(rngState: number, band: LengthBand): ExpeditionResult {
  let rng = rngState;
  const range = BALANCE.expeditionLength[band];
  const lengthRoll = nextInt(rng, range.min, range.max);
  rng = lengthRoll.state;
  const total = lengthRoll.value;

  // Ordre des biomes : mélange de Fisher-Yates alimenté par le PRNG seedé.
  const biomes = [...BIOME_IDS];
  for (let i = biomes.length - 1; i > 0; i--) {
    const roll = nextInt(rng, 0, i);
    rng = roll.state;
    [biomes[i], biomes[roll.value]] = [biomes[roll.value]!, biomes[i]!];
  }

  // Segments contigus quasi égaux ; le reste de la division va aux premiers biomes.
  const base = Math.floor(total / biomes.length);
  const extra = total % biomes.length;
  const nodes: MapNode[] = [];
  for (let s = 0; s < biomes.length; s++) {
    const len = base + (s < extra ? 1 : 0);
    const start = nodes.length;
    const finalSegment = s === biomes.length - 1;
    for (let i = 0; i < len; i++) {
      const milestone = i === len - 1;
      nodes.push({
        index: start + i,
        type: milestone ? (finalSegment ? 'boss' : 'elite') : 'combat',
        biome: biomes[s]!,
        cleared: false,
      });
    }
    // Nœud spécial léger au milieu du segment (jamais le jalon, jamais le tout premier nœud).
    if (len >= 3) {
      const mid = start + Math.floor(len / 2);
      const kindRoll = nextInt(rng, 0, 1);
      rng = kindRoll.state;
      nodes[mid] = { ...nodes[mid]!, type: kindRoll.value === 0 ? 'event' : 'rest' };
    }
  }

  return { nodes, state: rng };
}

/** Progression normalisée p ∈ [0,1] d'un nœud sur la longueur totale (pacing §A.4). */
export function progressAt(nodeIndex: number, totalNodes: number): number {
  if (totalNodes <= 1) return 1;
  return nodeIndex / (totalNodes - 1);
}

/** Progression du nœud courant de la run. */
export function runProgress(run: RunState): number {
  return progressAt(run.currentNode, run.nodes.length);
}

/** Nœud terminé : marqué, on avance sur la route (le boss final passe par `victory`, pas ici). */
export function advanceNode(state: GameState): GameState {
  const clearedIndex = state.run.currentNode;
  const nodes = state.run.nodes.map((n) => (n.index === clearedIndex ? { ...n, cleared: true } : n));
  return {
    ...state,
    phase: 'map',
    run: { ...state.run, nodes, currentNode: Math.min(clearedIndex + 1, nodes.length - 1) },
    combat: null,
    event: null,
    restDone: {},
  };
}
