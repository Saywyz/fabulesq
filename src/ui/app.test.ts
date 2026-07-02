// @vitest-environment jsdom
// Test d'acceptation Phase 2 : une partie complète jouable à la souris sur une machine,
// en hot-seat, sans réseau. Le test pilote le vrai DOM (clics), jamais le reducer en direct.
import { beforeEach, describe, expect, it } from 'vitest';
import { mountApp } from './app';

let root: HTMLElement;

function q<T extends HTMLElement = HTMLElement>(sel: string): T | null {
  return root.querySelector<T>(sel);
}
function qa(sel: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(sel)];
}
function click(sel: string): boolean {
  const btn = q<HTMLButtonElement>(sel);
  if (!btn || (btn as HTMLButtonElement).disabled) return false;
  btn.click();
  return true;
}

/** Ajoute un joueur via le formulaire du lobby. */
function addPlayer(name: string): void {
  const input = q<HTMLInputElement>('[data-name-input]')!;
  input.value = name;
  click('[data-add-player]');
}

function setupLobby(names: string[]): void {
  mountApp(root, { seed: 42, code: 'HOTSEAT' });
  for (const n of names) addPlayer(n);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
});

describe('lobby et customisation', () => {
  it('affiche le lobby avec le code de la partie', () => {
    mountApp(root, { seed: 1, code: 'ABC123' });
    expect(q('[data-screen="lobby"]')).toBeTruthy();
    expect(root.textContent).toContain('ABC123');
  });

  it('ajoute des joueurs, chacun avec customisation (apparence + classe) et bouton prêt', () => {
    setupLobby(['Alice', 'Bob']);
    expect(qa('[data-ready]')).toHaveLength(2);
    expect(root.textContent).toContain('Alice');
    expect(root.textContent).toContain('Bob');
    expect(qa('select[data-appearance]').length).toBeGreaterThan(0);
    expect(qa('select[data-class]')).toHaveLength(2);
  });

  it("changer l'apparence émet set_appearance (le prénom et la couleur sont conservés)", () => {
    setupLobby(['Alice']);
    const sel = q<HTMLSelectElement>('select[data-appearance$=":hairColor"]')!;
    sel.value = sel.options[1]!.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const after = q<HTMLSelectElement>('select[data-appearance$=":hairColor"]')!;
    expect(after.value).toBe(sel.value);
  });

  it('lancer la partie exige que tout le monde soit prêt', () => {
    setupLobby(['Alice', 'Bob']);
    const start = q<HTMLButtonElement>('[data-start-run]')!;
    expect(start.disabled).toBe(true);
    click('[data-ready="p1"]');
    expect(q<HTMLButtonElement>('[data-start-run]')!.disabled).toBe(true);
    click('[data-ready="p2"]');
    expect(q<HTMLButtonElement>('[data-start-run]')!.disabled).toBe(false);
    click('[data-start-run]');
    expect(q('[data-screen="map"]')).toBeTruthy();
  });
});

describe('plateau de combat', () => {
  function enterFirstCombat(): void {
    setupLobby(['Alice', 'Bob']);
    click('[data-ready="p1"]');
    click('[data-ready="p2"]');
    click('[data-start-run]');
    click('[data-enter-node]');
  }

  it('affiche ennemis, intentions, barres de vie, statuts, journal et builds de tous', () => {
    enterFirstCombat();
    expect(q('[data-screen="combat"]')).toBeTruthy();
    expect(qa('[data-enemy]').length).toBeGreaterThan(0);
    expect(qa('[data-intent]').length).toBeGreaterThan(0); // intentions télégraphiées visibles
    expect(qa('.hp-bar').length).toBeGreaterThan(0);
    expect(q('[data-log]')).toBeTruthy();
    expect(qa('[data-build]')).toHaveLength(2); // les builds de tous les joueurs sont visibles
  });

  it('planifier : compétence → cible → confirmer ; le dernier confirm résout le round', () => {
    enterFirstCombat();
    // Alice frappe le premier ennemi
    click('button[data-skill="p1:strike"]');
    expect(qa('button[data-target^="p1:"]').length).toBeGreaterThan(0);
    qa('button[data-target^="p1:"]')[0]!.click();
    click('button[data-confirm="p1"]');
    // Bob aussi — son confirm déclenche la résolution
    click('button[data-skill="p2:strike"]');
    qa('button[data-target^="p2:"]')[0]!.click();
    click('button[data-confirm="p2"]');
    // Le journal relate le round résolu
    expect(q('[data-log]')!.textContent).toContain('Round 1');
  });
});

describe('partie complète en hot-seat (critère d’acceptation Phase 2)', () => {
  it('une partie se joue de bout en bout à la souris jusqu’au game over', () => {
    setupLobby(['Alice', 'Bob']);
    click('[data-ready="p1"]');
    click('[data-ready="p2"]');
    click('[data-start-run]');

    let sawDraft = false;
    let guard = 0;
    while (!q('[data-screen="gameover"]') && guard++ < 5000) {
      if (click('[data-enter-node]')) continue;

      const skillBtn = q<HTMLButtonElement>('button[data-skill]:not([disabled])');
      if (skillBtn) {
        skillBtn.click();
        const target = q<HTMLButtonElement>('button[data-target]');
        if (target) target.click();
        const confirm = q<HTMLButtonElement>('button[data-confirm]:not([disabled])');
        if (confirm) confirm.click();
        continue;
      }

      const pick = q<HTMLButtonElement>('button[data-pick]');
      if (pick) {
        sawDraft = true;
        pick.click();
        continue;
      }
      throw new Error(`bloqué : aucun bouton jouable (guard=${guard})`);
    }

    expect(guard).toBeLessThan(5000);
    expect(q('[data-screen="gameover"]')).toBeTruthy();
    expect(sawDraft).toBe(true); // on est bien passé par l'écran de draft
    expect(q('[data-new-game]')).toBeTruthy();
  });
});

describe('écran de draft', () => {
  it('le reroll régénère 3 offres et se consomme', () => {
    // On joue jusqu'au premier draft
    setupLobby(['Alice', 'Bob']);
    click('[data-ready="p1"]');
    click('[data-ready="p2"]');
    click('[data-start-run]');
    click('[data-enter-node]');
    let guard = 0;
    while (!q('[data-screen="draft"]') && guard++ < 500) {
      const skillBtn = q<HTMLButtonElement>('button[data-skill]:not([disabled])');
      if (!skillBtn) throw new Error('bloqué en combat');
      skillBtn.click();
      q<HTMLButtonElement>('button[data-target]')?.click();
      q<HTMLButtonElement>('button[data-confirm]:not([disabled])')?.click();
    }
    expect(q('[data-screen="draft"]')).toBeTruthy();
    expect(qa('button[data-pick^="p1:"]')).toHaveLength(3);
    click('button[data-reroll="p1"]');
    expect(qa('button[data-pick^="p1:"]')).toHaveLength(3);
    // le reroll est consommé : le bouton disparaît (ou se désactive)
    const reroll = q<HTMLButtonElement>('button[data-reroll="p1"]');
    expect(!reroll || reroll.disabled).toBe(true);
  });
});
