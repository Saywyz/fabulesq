// Abstraction du tuyau réseau : la logique host/guest ne connaît pas Supabase.
// Implémentations : client.ts (Supabase Realtime) et paires factices dans les tests.
import type { NetMessage } from './protocol';

export interface Transport {
  send(msg: NetMessage): void;
  /** Retourne une fonction de désabonnement. */
  onMessage(cb: (msg: NetMessage) => void): () => void;
  /** Présence : noms des connectés (optionnel, Supabase uniquement). */
  onPresence?(cb: (names: string[]) => void): () => void;
  close(): void;
}
