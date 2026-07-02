// Contrat commun des sessions de jeu : l'UI parle à une session, jamais au réseau.
// Trois implémentations : hot-seat (ui/app.ts), hôte (host.ts), invité (guest.ts).
import type { Action, GameState, PlayerId } from '../engine/types';

export interface GameSession {
  readonly role: 'hotseat' | 'host' | 'guest';
  /** null tant que l'invité n'a pas reçu son premier snapshot. */
  getState(): GameState | null;
  dispatch(action: Action): void;
  /** Notifie à chaque changement d'état ou de présence. Retourne le désabonnement. */
  subscribe(listener: () => void): () => void;
  /** En ligne : uniquement son propre joueur. Hot-seat : tout le monde. */
  canControl(playerId: PlayerId): boolean;
  /** Noms des joueurs connectés (présence) ; vide en hot-seat. */
  getPresence(): string[];
  leave(): void;
}
