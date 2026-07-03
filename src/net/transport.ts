// Abstraction du tuyau réseau : la logique host/guest ne connaît pas Supabase.
// Implémentations : client.ts (Supabase Realtime) et paires factices dans les tests.
import type { NetMessage } from './protocol';

export interface PresencePeer {
  name: string;
  isHost: boolean;
}

export interface Transport {
  send(msg: NetMessage): void;
  /** Retourne une fonction de désabonnement. */
  onMessage(cb: (msg: NetMessage) => void): () => void;
  /** Présence : qui est connecté (optionnel, Supabase uniquement). */
  onPresence?(cb: (peers: PresencePeer[]) => void): () => void;
  close(): void;
}
