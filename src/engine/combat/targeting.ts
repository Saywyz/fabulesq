// IA de ciblage ennemie : menace / profils (GAME_DESIGN.md §4.4).
import { nextInt } from '../rng';
import type { EntityId, Player } from '../types';

export interface TargetChoice {
  targetId: EntityId | null; // null si aucun joueur ciblable
  state: number; // état du PRNG après tirage éventuel
}

/** Choisit une cible parmi les joueurs vivants et debout, selon le profil d'IA. */
export function chooseTarget(aiProfile: string, players: Player[], rngState: number): TargetChoice {
  // Tri par id : garantit un départage stable quel que soit l'ordre d'entrée.
  const candidates = players
    .filter((p) => p.alive && !p.downed)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (candidates.length === 0) return { targetId: null, state: rngState };

  switch (aiProfile) {
    case 'focus_lowest_hp': {
      const target = candidates.reduce((best, p) => (p.hp < best.hp ? p : best));
      return { targetId: target.id, state: rngState };
    }
    case 'focus_highest_threat': {
      const target = candidates.reduce((best, p) => (p.threat > best.threat ? p : best));
      return { targetId: target.id, state: rngState };
    }
    case 'random':
    default: {
      const r = nextInt(rngState, 0, candidates.length - 1);
      return { targetId: candidates[r.value]!.id, state: r.state };
    }
  }
}
