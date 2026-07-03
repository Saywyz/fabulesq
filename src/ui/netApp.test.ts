// @vitest-environment jsdom
// Acceptation Phase 3 (simulée) : deux clients (hôte + invité) jouent ensemble via le
// transport loopback. L'invité ne pilote que son joueur et n'exécute jamais le reducer.
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../engine/reducer';
import { createGuestSession } from '../net/guest';
import { createHostSession } from '../net/host';
import { linkedPair } from '../net/loopback';
import { mountSession } from './app';

let hostRoot: HTMLElement;
let guestRoot: HTMLElement;

// jsdom n'implémente pas le canvas 2D : on neutralise pour éviter le bruit de logs.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

function q<T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): T | null {
  return root.querySelector<T>(sel);
}
function qa(root: HTMLElement, sel: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(sel)];
}
function click(root: HTMLElement, sel: string): boolean {
  const btn = q<HTMLButtonElement>(root, sel);
  if (!btn || btn.disabled) return false;
  btn.click();
  return true;
}

function setupOnlineGame() {
  const { a, b } = linkedPair();
  const initial = createInitialState({ seed: 99, hostId: 'h1', code: 'NETUI1' });
  const host = createHostSession({ initial, transport: a, localPlayerId: 'h1' });
  host.dispatch({ t: 'join', player: { id: 'h1', name: 'Hina', connectionId: 'h1' } });
  mountSession(hostRoot, host);

  const guest = createGuestSession({ transport: b, senderId: 'g1', localPlayerId: 'g1' });
  guest.dispatch({ t: 'join', player: { id: 'g1', name: 'Gaspard', connectionId: 'g1' } });
  mountSession(guestRoot, guest);
  return { host, guest };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div><div id="guest"></div>';
  hostRoot = document.getElementById('host')!;
  guestRoot = document.getElementById('guest')!;
});

describe('deux clients en ligne (hôte + invité)', () => {
  it("l'invité voit le lobby complet mais ne contrôle que sa fiche ; pas d'ajout manuel", () => {
    setupOnlineGame();
    expect(guestRoot.textContent).toContain('Hina');
    expect(guestRoot.textContent).toContain('Gaspard');
    expect(q(guestRoot, '[data-add-player]')).toBeNull(); // pas de hot-seat en ligne
    expect(q<HTMLButtonElement>(guestRoot, '[data-ready="g1"]')!.disabled).toBe(false);
    expect(q<HTMLButtonElement>(guestRoot, '[data-ready="h1"]')!.disabled).toBe(true);
    expect(q<HTMLButtonElement>(guestRoot, '[data-start-run]')!.disabled).toBe(true); // seul l'hôte lance
  });

  it('prêts des deux côtés, lancement par l’hôte : les deux écrans suivent la partie', () => {
    setupOnlineGame();
    click(hostRoot, '[data-ready="h1"]');
    click(guestRoot, '[data-ready="g1"]');
    expect(q<HTMLButtonElement>(hostRoot, '[data-start-run]')!.disabled).toBe(false);
    click(hostRoot, '[data-start-run]');
    // Prépa d'expédition (Phase 7) : chacun ne peut parer que sa fiche
    expect(q(hostRoot, '[data-screen="prep"]')).toBeTruthy();
    expect(q(guestRoot, '[data-screen="prep"]')).toBeTruthy();
    expect(q<HTMLButtonElement>(guestRoot, 'button[data-prep-ready="h1"]')!.disabled).toBe(true);
    click(hostRoot, 'button[data-prep-ready="h1"]');
    click(guestRoot, 'button[data-prep-ready="g1"]');
    expect(q(hostRoot, '[data-screen="map"]')).toBeTruthy();
    expect(q(guestRoot, '[data-screen="map"]')).toBeTruthy(); // le snapshot a suivi

    click(hostRoot, '[data-enter-node]');
    expect(q(hostRoot, '[data-screen="combat"]')).toBeTruthy();
    expect(q(guestRoot, '[data-screen="combat"]')).toBeTruthy();

    // Chaque client ne voit qu'UN panneau de planification : le sien
    expect(qa(hostRoot, 'button[data-confirm]')).toHaveLength(1);
    expect(qa(guestRoot, 'button[data-confirm]')).toHaveLength(1);
    expect(q(hostRoot, 'button[data-confirm="h1"]')).toBeTruthy();
    expect(q(guestRoot, 'button[data-confirm="g1"]')).toBeTruthy();

    // L'invité planifie et confirme ; l'hôte aussi → résolution diffusée aux deux
    click(guestRoot, 'button[data-skill="g1:strike"]');
    qa(guestRoot, 'button[data-target^="g1:"]')[0]!.click();
    click(guestRoot, 'button[data-confirm="g1"]');
    click(hostRoot, 'button[data-skill="h1:strike"]');
    qa(hostRoot, 'button[data-target^="h1:"]')[0]!.click();
    click(hostRoot, 'button[data-confirm="h1"]');

    expect(q(hostRoot, '[data-log]')!.textContent).toContain('Round 1');
    expect(q(guestRoot, '[data-log]')!.textContent).toContain('Round 1');
  });

  it('un invité qui arrive en cours de partie reçoit l’état complet (spectateur hors lobby)', () => {
    const { a, b } = linkedPair();
    const initial = createInitialState({ seed: 99, hostId: 'h1', code: 'NETUI2' });
    const host = createHostSession({ initial, transport: a, localPlayerId: 'h1' });
    host.dispatch({ t: 'join', player: { id: 'h1', name: 'Hina', connectionId: 'h1' } });
    host.dispatch({ t: 'set_ready', playerId: 'h1', ready: true });
    host.dispatch({ t: 'start_run' });
    host.dispatch({ t: 'prep_ready', playerId: 'h1', ready: true }); // départ d'expédition
    mountSession(hostRoot, host);

    // Arrivée tardive : la partie est déjà sur la carte
    const late = createGuestSession({ transport: b, senderId: 'g9', localPlayerId: 'g9' });
    mountSession(guestRoot, late);
    expect(q(guestRoot, '[data-screen="map"]')).toBeTruthy(); // état complet reçu via HELLO
    expect(late.getState()!.stateId).toBe(host.getState()!.stateId);
  });
});
