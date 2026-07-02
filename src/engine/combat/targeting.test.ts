import { describe, expect, it } from 'vitest';
import { createRngState } from '../rng';
import type { Player } from '../types';
import { chooseTarget } from './targeting';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    hp: 20,
    maxHp: 20,
    block: 0,
    speed: 5,
    statuses: [],
    alive: true,
    connectionId: id,
    appearance: { skinTone: '', hairStyle: '', hairColor: '', outfitStyle: '', outfitColor: '' },
    classId: 'warrior',
    skills: [],
    energy: 3,
    maxEnergy: 3,
    threat: 0,
    gold: 0,
    ready: true,
    downed: false,
    ...overrides,
  };
}

describe('ciblage / menace (GAME_DESIGN §4.4)', () => {
  it('focus_lowest_hp vise le joueur avec le moins de PV', () => {
    const players = [makePlayer('a', { hp: 15 }), makePlayer('b', { hp: 8 }), makePlayer('c', { hp: 20 })];
    const r = chooseTarget('focus_lowest_hp', players, createRngState(1));
    expect(r.targetId).toBe('b');
  });

  it('focus_highest_threat vise le joueur avec le plus de menace (le tank taunt fonctionne)', () => {
    const players = [makePlayer('a', { threat: 5 }), makePlayer('b', { threat: 30 }), makePlayer('c', { threat: 0 })];
    const r = chooseTarget('focus_highest_threat', players, createRngState(1));
    expect(r.targetId).toBe('b');
  });

  it('random est déterministe pour un même état de PRNG', () => {
    const players = [makePlayer('a'), makePlayer('b'), makePlayer('c')];
    const r1 = chooseTarget('random', players, createRngState(9));
    const r2 = chooseTarget('random', players, createRngState(9));
    expect(r1.targetId).toBe(r2.targetId);
    expect(r1.state).toBe(r2.state);
  });

  it('les joueurs à terre ou morts ne sont jamais ciblés', () => {
    const players = [
      makePlayer('a', { downed: true, alive: false, hp: 0 }),
      makePlayer('b', { hp: 3 }),
    ];
    const r = chooseTarget('focus_lowest_hp', players, createRngState(1));
    expect(r.targetId).toBe('b');
  });

  it('départage stable par id en cas d’égalité', () => {
    const players = [makePlayer('z', { hp: 10 }), makePlayer('a', { hp: 10 })];
    const r = chooseTarget('focus_lowest_hp', players, createRngState(1));
    expect(r.targetId).toBe('a');
  });
});
