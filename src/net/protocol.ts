// Enveloppe des messages réseau (TECH_ARCHITECTURE.md §6.2).
export interface NetMessage {
  type: 'ACTION' | 'STATE_SNAPSHOT' | 'HELLO' | 'HOST_INFO' | 'PING';
  senderId: string;
  ts: number;
  payload: unknown;
}

export function makeMessage(type: NetMessage['type'], senderId: string, payload: unknown): NetMessage {
  return { type, senderId, ts: Date.now(), payload };
}

/** Le stateId monotone permet d'ignorer les snapshots en retard ou dupliqués. */
export function shouldApplySnapshot(currentStateId: number, incomingStateId: number): boolean {
  return incomingStateId > currentStateId;
}
