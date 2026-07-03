// @vitest-environment jsdom
// Test d'acceptation Phase 2 (adapté au modèle expédition de la Phase 7) : une partie
// complète jouable à la souris sur une machine, en hot-seat, sans réseau.
// Le test pilote le vrai DOM (clics), jamais le reducer en direct.
import { beforeEach, describe, expect, it } from 'vitest';
import { mountApp } from './app';

let root: HTMLElement;

// jsdom n'implémente pas le canvas 2D : on neutralise pour éviter le bruit de logs.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

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

/** Lobby prêt → écran de prépa. */
function goToPrep(playerIds: string[]): void {
  for (const id of playerIds) click(`[data-ready="${id}"]`);
  click('[data-start-run]');
}

/** Prépa → départ : tous les joueurs se déclarent parés. */
function embark(playerIds: string[]): void {
  for (const id of playerIds) click(`button[data-prep-ready="${id}"]`);
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

  it('lancer la partie exige que tout le monde soit prêt, et mène à la prépa', () => {
    setupLobby(['Alice', 'Bob']);
    const start = q<HTMLButtonElement>('[data-start-run]')!;
    expect(start.disabled).toBe(true);
    click('[data-ready="p1"]');
    expect(q<HTMLButtonElement>('[data-start-run]')!.disabled).toBe(true);
    click('[data-ready="p2"]');
    expect(q<HTMLButtonElement>('[data-start-run]')!.disabled).toBe(false);
    click('[data-start-run]');
    expect(q('[data-screen="prep"]')).toBeTruthy(); // la stratégie d'abord, la carte ensuite
  });
});

describe('écran de prépa (Phase 7)', () => {
  it('affiche la bande de longueur (choix d’équipe), les kits, et un bouton paré par joueur', () => {
    setupLobby(['Alice', 'Bob']);
    goToPrep(['p1', 'p2']);
    expect(qa('button[data-band]')).toHaveLength(3); // courte / moyenne / longue
    expect(qa('[data-kit]')).toHaveLength(2); // le kit de départ de chacun est visible
    expect(qa('button[data-kit-skill^="p1:"]').length).toBeGreaterThan(0);
    expect(qa('button[data-prep-ready]')).toHaveLength(2);
  });

  it('changer la bande de longueur est pris en compte (le bouton devient sélectionné)', () => {
    setupLobby(['Alice']);
    goToPrep(['p1']);
    click('button[data-band="long"]');
    expect(q('button[data-band="long"]')!.textContent).toContain('✔');
  });

  it('le départ est donné quand tous les joueurs sont parés → carte d’expédition', () => {
    setupLobby(['Alice', 'Bob']);
    goToPrep(['p1', 'p2']);
    click('button[data-prep-ready="p1"]');
    expect(q('[data-screen="prep"]')).toBeTruthy(); // Bob n'est pas paré
    click('button[data-prep-ready="p2"]');
    expect(q('[data-screen="map"]')).toBeTruthy();
    expect(qa('[data-node]').length).toBeGreaterThanOrEqual(8); // route à longueur variable
    expect(q('[data-biome]')).toBeTruthy(); // le biome courant est affiché
  });
});

describe('plateau de combat', () => {
  function enterFirstCombat(): void {
    setupLobby(['Alice', 'Bob']);
    goToPrep(['p1', 'p2']);
    embark(['p1', 'p2']);
    click('[data-enter-node]');
  }

  it('affiche ennemis, intentions, barres de vie, statuts, journal et kits de tous', () => {
    enterFirstCombat();
    expect(q('[data-screen="combat"]')).toBeTruthy();
    expect(qa('[data-enemy]').length).toBeGreaterThan(0);
    expect(qa('[data-intent]').length).toBeGreaterThan(0); // intentions télégraphiées visibles
    expect(qa('.hp-bar').length).toBeGreaterThan(0);
    expect(q('[data-log]')).toBeTruthy();
    expect(qa('[data-build]')).toHaveLength(2); // les kits de tous les joueurs sont visibles
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

describe('expédition complète en hot-seat (critère d’acceptation Phase 7)', () => {
  it('une partie se joue de bout en bout à la souris, sans aucun draft, jusqu’à la fin', () => {
    setupLobby(['Alice', 'Bob']);
    goToPrep(['p1', 'p2']);
    embark(['p1', 'p2']);

    const finished = () => q('[data-screen="gameover"]') ?? q('[data-screen="victory"]');
    let guard = 0;
    while (!finished() && guard++ < 5000) {
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
      // Nœuds hors combat
      if (click('[data-event-option="0"]')) continue;
      const rest = q<HTMLButtonElement>('button[data-rest-heal]');
      if (rest) {
        rest.click();
        continue;
      }
      throw new Error(`bloqué : aucun bouton jouable (guard=${guard})`);
    }

    expect(guard).toBeLessThan(5000);
    expect(finished()).toBeTruthy(); // victoire ou défaite, mais une fin
    expect(q('button[data-pick]')).toBeNull(); // plus aucun écran de draft
    expect(q('[data-new-game]')).toBeTruthy();
  });
});

describe('pixel art (acceptation Phase 5, portée sur la scène Phase 9)', () => {
  it('la customisation du lobby produit exactement la même signature de sprite en combat', () => {
    setupLobby(['Alice', 'Bob']);
    // On change la coiffure d'Alice
    const hairSel = q<HTMLSelectElement>('select[data-appearance="p1:hairStyle"]')!;
    hairSel.value = hairSel.options[1]!.value;
    hairSel.dispatchEvent(new Event('change', { bubbles: true }));
    const lobbySprite = q<HTMLCanvasElement>('canvas[data-sprite]')!.dataset.sprite;
    expect(lobbySprite).toBeTruthy();

    goToPrep(['p1', 'p2']);
    embark(['p1', 'p2']);
    click('[data-enter-node]');
    // La plaque du joueur porte la signature de ce que la scène dessine (couche par couche)
    const combatSprite = q('[data-player="p1"]')!.dataset.sprite;
    expect(combatSprite).toBe(lobbySprite); // fidèle, couche par couche
  });
});

describe('scène de combat spatiale (Phase 9)', () => {
  it('la scène porte le décor du biome courant et une plaque par combattant', () => {
    setupLobby(['Alice', 'Bob']);
    goToPrep(['p1', 'p2']);
    embark(['p1', 'p2']);
    const biome = q('[data-biome]')!.getAttribute('data-biome');
    click('[data-enter-node]');
    const canvas = q<HTMLCanvasElement>('canvas.scene-canvas')!;
    expect(canvas).toBeTruthy();
    expect(canvas.dataset.sceneBiome).toBe(biome); // le décor suit le biome du nœud
    expect(qa('[data-player]')).toHaveLength(2);
    expect(qa('[data-enemy]').length).toBeGreaterThan(0);
  });

  it('le canvas de scène est persistant à travers les re-renders (fondation Phase 10)', () => {
    setupLobby(['Alice']);
    goToPrep(['p1']);
    embark(['p1']);
    click('[data-enter-node]');
    const before = q<HTMLCanvasElement>('canvas.scene-canvas')!;
    click('button[data-skill="p1:strike"]'); // provoque un re-render (sélection)
    const after = q<HTMLCanvasElement>('canvas.scene-canvas')!;
    expect(after).toBe(before); // même élément, jamais recréé
  });

  for (const n of [1, 4, 8]) {
    it(`à ${n} joueur(s), chaque combattant a une plaque à une position distincte`, () => {
      const names = Array.from({ length: n }, (_, i) => `J${i + 1}`);
      setupLobby(names);
      const ids = names.map((_, i) => `p${i + 1}`);
      goToPrep(ids);
      embark(ids);
      click('[data-enter-node]');
      const plates = qa('[data-player]');
      expect(plates).toHaveLength(n);
      const positions = new Set(plates.map((p) => `${p.style.left}|${p.style.top}`));
      expect(positions.size).toBe(n); // pas deux plaques au même endroit
    });
  }
});
