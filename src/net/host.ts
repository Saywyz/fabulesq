// Session hôte : SEUL endroit où le reducer tourne en partie réseau.
// Reçoit les Action des invités, reduce, diffuse un STATE_SNAPSHOT complet (§6).
import { reduce } from '../engine/reducer';
import type { Action, GameState, PlayerId } from '../engine/types';
import { makeMessage } from './protocol';
import type { GameSession } from './session';
import type { Transport } from './transport';

export interface HostOptions {
  initial: GameState;
  transport: Transport;
  localPlayerId: PlayerId;
  /** Sauvegarde de reprise (Phase 6) — appelé après chaque action appliquée. */
  persist?: (state: GameState) => void;
}

export function createHostSession(opts: HostOptions): GameSession {
  let state = opts.initial;
  let presence: string[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((cb) => cb());

  const broadcastSnapshot = () => {
    opts.transport.send(makeMessage('STATE_SNAPSHOT', opts.localPlayerId, state));
  };

  const apply = (action: Action) => {
    const next = reduce(state, action);
    if (next === state) return; // action invalide : rien à diffuser
    state = next;
    broadcastSnapshot();
    opts.persist?.(state);
    notify();
  };

  const offMessage = opts.transport.onMessage((msg) => {
    if (msg.type === 'ACTION') {
      apply(msg.payload as Action);
    } else if (msg.type === 'HELLO') {
      broadcastSnapshot(); // arrivée (tardive ou non) : état complet immédiat
    }
  });

  const offPresence = opts.transport.onPresence?.((peers) => {
    presence = peers.map((p) => p.name);
    notify();
  });

  // Reprise de partie : resynchronise immédiatement les invités qui attendaient.
  broadcastSnapshot();

  return {
    role: 'host',
    getState: () => state,
    dispatch: apply,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    canControl: (playerId) => playerId === opts.localPlayerId,
    getPresence: () => presence,
    isHostOnline: () => true,
    leave() {
      offMessage();
      offPresence?.();
      opts.transport.close();
    },
  };
}
