// Contexte passé aux écrans : dispatch d'Action vers la session + état éphémère d'UI.
import type { Action, PlayerId, SkillId } from '../engine/types';

/** État purement visuel (sélection en cours) — jamais dans GameState. */
export interface UiState {
  pendingSkill: Record<PlayerId, SkillId | undefined>;
}

export interface Ctx {
  dispatch(action: Action): void;
  /** Sélectionne la compétence en attente de cible pour un joueur. */
  select(playerId: PlayerId, skillId: SkillId | null): void;
  ui: UiState;
  /** hot-seat : tout le monde ; en ligne : uniquement son propre joueur. */
  canControl(playerId: PlayerId): boolean;
  role: 'hotseat' | 'host' | 'guest';
  /** Noms connectés (présence Supabase) ; vide en hot-seat. */
  getPresence(): string[];
}
