// Contexte passé aux écrans : dispatch d'Action vers la session + état éphémère d'UI.
import type { Action, PlayerId, SkillId } from '../engine/types';

/** État purement visuel — jamais dans GameState. */
export interface UiState {
  pendingSkill: Record<PlayerId, SkillId | undefined>;
  /** Derniers PV vus par entité : sert aux nombres flottants et aux flashs de dégâts. */
  lastHp: Record<string, number>;
  /** Phase du rendu précédent : déclenche la transition d'écran. */
  lastPhase?: string;
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
