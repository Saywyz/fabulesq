// Session invité : envoie ses Action à l'hôte et applique les snapshots reçus.
// N'exécute JAMAIS le reducer localement (§6.1).
import type { Action, GameState, PlayerId } from '../engine/types';
import { isCompatibleSnapshot, makeMessage, shouldApplySnapshot } from './protocol';
import type { GameSession } from './session';
import type { Transport } from './transport';

export interface GuestOptions {
  transport: Transport;
  senderId: string;
  localPlayerId: PlayerId;
}

export function createGuestSession(opts: GuestOptions): GameSession {
  let state: GameState | null = null;
  let presence: string[] = [];
  let hostOnline = true; // optimiste tant que la présence n'a pas synchronisé
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((cb) => cb());

  const offMessage = opts.transport.onMessage((msg) => {
    if (msg.type !== 'STATE_SNAPSHOT') return;
    const snapshot = msg.payload as GameState;
    if (!isCompatibleSnapshot(snapshot)) return; // autre version de schéma : ignoré (C1)
    if (!shouldApplySnapshot(state?.stateId ?? -1, snapshot.stateId)) return;
    state = snapshot;
    notify();
  });

  const offPresence = opts.transport.onPresence?.((peers) => {
    presence = peers.map((p) => p.name);
    hostOnline = peers.some((p) => p.isHost);
    notify();
  });

  // Se signale à l'hôte : la réponse est un snapshot complet (arrivée tardive gérée).
  opts.transport.send(makeMessage('HELLO', opts.senderId, null));

  return {
    role: 'guest',
    getState: () => state,
    dispatch(action: Action) {
      opts.transport.send(makeMessage('ACTION', opts.senderId, action));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    canControl: (playerId) => playerId === opts.localPlayerId,
    getPresence: () => presence,
    isHostOnline: () => hostOnline,
    leave() {
      offMessage();
      offPresence?.();
      opts.transport.close();
    },
  };
}
