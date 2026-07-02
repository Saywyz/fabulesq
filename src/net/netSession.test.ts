// Sessions host/guest testées avec un transport factice : le modèle host-authoritative
// (§6) doit tenir sans Supabase. L'invité n'exécute JAMAIS le reducer.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine/reducer';
import type { Action } from '../engine/types';
import { createGuestSession } from './guest';
import { createHostSession } from './host';
import { linkedPair as fakePair } from './loopback';
import type { Transport } from './transport';

function hostWithLobby(transport: Transport) {
  const initial = createInitialState({ seed: 7, hostId: 'host-1', code: 'NET001' });
  const host = createHostSession({ initial, transport, localPlayerId: 'host-1' });
  host.dispatch({ t: 'join', player: { id: 'host-1', name: 'Hôte', connectionId: 'host-1' } });
  return host;
}

const joinAsGuest: Action = { t: 'join', player: { id: 'g1', name: 'Invitée', connectionId: 'g1' } };

describe('sessions host / guest (host-authoritative, §6)', () => {
  it("l'invité reçoit l'état complet dès son HELLO (arrivée tardive incluse)", () => {
    const { a, b } = fakePair();
    const host = hostWithLobby(a);
    // Des actions ont déjà eu lieu avant l'arrivée de l'invité
    const guest = createGuestSession({ transport: b, senderId: 'g1', localPlayerId: 'g1' });
    expect(guest.getState()).not.toBeNull();
    expect(guest.getState()).toEqual(host.getState());
  });

  it("une Action d'invité est appliquée par l'hôte puis rediffusée : états identiques", () => {
    const { a, b } = fakePair();
    const host = hostWithLobby(a);
    const guest = createGuestSession({ transport: b, senderId: 'g1', localPlayerId: 'g1' });
    guest.dispatch(joinAsGuest);
    expect(host.getState()!.players.map((p) => p.id)).toEqual(['host-1', 'g1']);
    expect(guest.getState()).toEqual(host.getState());
  });

  it("l'invité n'applique JAMAIS la logique localement : sans réponse de l'hôte, son état ne bouge pas", () => {
    const { a, b, pause, flush } = fakePair();
    const host = hostWithLobby(a);
    const guest = createGuestSession({ transport: b, senderId: 'g1', localPlayerId: 'g1' });
    const before = guest.getState();
    pause(); // le réseau retient tout
    guest.dispatch(joinAsGuest);
    expect(guest.getState()).toBe(before); // aucun reducer côté invité
    flush();
    expect(guest.getState()!.players.some((p) => p.id === 'g1')).toBe(true);
    expect(host.getState()).toEqual(guest.getState());
  });

  it('un snapshot en retard (stateId plus petit) est ignoré', () => {
    const { a, b } = fakePair();
    const host = hostWithLobby(a);
    const guest = createGuestSession({ transport: b, senderId: 'g1', localPlayerId: 'g1' });
    guest.dispatch(joinAsGuest);
    const current = guest.getState()!;
    // Un vieux snapshot arrive après coup (réordonnancement réseau simulé)
    const stale = { ...current, stateId: 0, players: [] };
    a.send({ type: 'STATE_SNAPSHOT', senderId: 'host-1', ts: 0, payload: stale });
    expect(guest.getState()).toEqual(current);
    expect(guest.getState()).toEqual(host.getState()); // toujours aligné sur l'hôte
  });

  it("les actions locales de l'hôte sont diffusées aux invités", () => {
    const { a, b } = fakePair();
    const host = hostWithLobby(a);
    const guest = createGuestSession({ transport: b, senderId: 'g1', localPlayerId: 'g1' });
    guest.dispatch(joinAsGuest);
    host.dispatch({ t: 'set_ready', playerId: 'host-1', ready: true });
    expect(guest.getState()!.players.find((p) => p.id === 'host-1')!.ready).toBe(true);
  });

  it('chacun ne contrôle que son joueur ; les listeners sont notifiés', () => {
    const { a, b } = fakePair();
    const host = hostWithLobby(a);
    const guest = createGuestSession({ transport: b, senderId: 'g1', localPlayerId: 'g1' });
    expect(host.canControl('host-1')).toBe(true);
    expect(host.canControl('g1')).toBe(false);
    expect(guest.canControl('g1')).toBe(true);
    expect(guest.canControl('host-1')).toBe(false);

    let notified = 0;
    guest.subscribe(() => notified++);
    guest.dispatch(joinAsGuest);
    expect(notified).toBeGreaterThan(0);
  });
});
