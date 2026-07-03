// Persistance de la partie (Phase 6) : sauvegarde throttlée, seule la dernière version compte.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../engine/reducer';
import type { GameState } from '../engine/types';
import { SCHEMA_VERSION } from '../engine/types';
import { isCompatibleSave, throttledSaver, type GameStore } from './persistence';

function stateWithId(stateId: number): GameState {
  return { ...createInitialState({ seed: 1, hostId: 'h', code: 'SAVE01' }), stateId };
}

describe('throttledSaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('regroupe les sauvegardes : seule la dernière version part en base', async () => {
    const saves: Array<[string, number]> = [];
    const store: GameStore = {
      save: async (code, state) => {
        saves.push([code, state.stateId]);
      },
      load: async () => null,
    };
    const save = throttledSaver(store, 1000);
    save('SAVE01', stateWithId(1));
    save('SAVE01', stateWithId(2));
    save('SAVE01', stateWithId(3));
    expect(saves).toEqual([]); // rien avant l'échéance
    await vi.advanceTimersByTimeAsync(1100);
    expect(saves).toEqual([['SAVE01', 3]]);

    // Une nouvelle salve repart pour un cycle
    save('SAVE01', stateWithId(4));
    await vi.advanceTimersByTimeAsync(1100);
    expect(saves).toEqual([
      ['SAVE01', 3],
      ['SAVE01', 4],
    ]);
  });

  it("une erreur de sauvegarde n'explose pas (dégradation silencieuse)", async () => {
    const store: GameStore = {
      save: async () => {
        throw new Error('table absente');
      },
      load: async () => null,
    };
    const save = throttledSaver(store, 100);
    save('SAVE01', stateWithId(1));
    await vi.advanceTimersByTimeAsync(200);
    // pas d'exception non gérée : le test passe s'il arrive ici
    expect(true).toBe(true);
  });
});

describe('garde de version au « Reprendre » (invariant C1)', () => {
  it('une sauvegarde du schéma courant est acceptée', () => {
    expect(isCompatibleSave(stateWithId(1))).toBe(true);
  });

  it('une sauvegarde v3 (ou autre) est rejetée proprement, sans crash', () => {
    const oldSave = { ...stateWithId(1), schemaVersion: 3 };
    expect(isCompatibleSave(oldSave)).toBe(false);
    expect(isCompatibleSave({ ...stateWithId(1), schemaVersion: SCHEMA_VERSION + 1 })).toBe(false);
    expect(isCompatibleSave(null)).toBe(false);
  });
});
