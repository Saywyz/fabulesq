// Contexte passé aux écrans : dispatch d'Action vers le reducer + état éphémère d'UI.
import type { Action, PlayerId, SkillId } from '../engine/types';

/** État purement visuel (sélection en cours) — jamais dans GameState. */
export interface UiState {
  pendingSkill: Record<PlayerId, SkillId | undefined>;
}

export interface Ctx {
  dispatch(action: Action): void;
  /** Sélectionne la compétence en attente de cible pour un joueur (hot-seat). */
  select(playerId: PlayerId, skillId: SkillId | null): void;
  ui: UiState;
}
