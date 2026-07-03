// Tests Phase 6 : les joueurs à terre restent dans la partie (action « encourager »).
import { describe, expect, it } from 'vitest';
import { BALANCE } from './data/balance';
import { createInitialState, reduce } from './reducer';
import type { GameState } from './types';

function combatWithDownedP1(): GameState {
  let s = createInitialState({ seed: 3, hostId: 'p1', code: 'PH6' });
  for (const id of ['p1', 'p2'] as const) {
    s = reduce(s, { t: 'join', player: { id, name: id.toUpperCase(), connectionId: id } });
    s = reduce(s, { t: 'set_ready', playerId: id, ready: true });
  }
  s = reduce(s, { t: 'start_run' }); // → prépa
  for (const id of ['p1', 'p2'] as const) {
    s = reduce(s, { t: 'prep_ready', playerId: id, ready: true });
  }
  s = reduce(s, { t: 'enter_node', nodeIndex: 0 });
  return {
    ...s,
    players: s.players.map((p) =>
      p.id === 'p1' ? { ...p, hp: 0, alive: false, downed: true } : p,
    ),
    // Intentions inoffensives pour des assertions déterministes
    combat: {
      ...s.combat!,
      enemies: s.combat!.enemies.map((e) => ({
        ...e,
        intent: { kind: 'buff' as const, description: 'se renforce' },
      })),
    },
  };
}

describe('joueurs à terre : encourager (GAME_DESIGN §8, Phase 6)', () => {
  it('un joueur à terre peut encourager un allié debout : +bouclier immédiat', () => {
    let s = combatWithDownedP1();
    s = reduce(s, { t: 'cheer', playerId: 'p1', targetId: 'p2' });
    expect(s.players.find((p) => p.id === 'p2')!.block).toBe(BALANCE.cheerBlock);
    expect(s.combat!.log.some((l) => l.includes('encourage'))).toBe(true);
  });

  it('une seule fois par round ; le droit revient au round suivant', () => {
    let s = combatWithDownedP1();
    s = reduce(s, { t: 'cheer', playerId: 'p1', targetId: 'p2' });
    const after = reduce(s, { t: 'cheer', playerId: 'p1', targetId: 'p2' });
    expect(after).toBe(s); // refusé : déjà encouragé ce round

    // p2 joue son round → round suivant → p1 peut de nouveau encourager
    s = reduce(s, { t: 'plan_action', playerId: 'p2', skillId: 'strike', targetId: s.combat!.enemies[0]!.id });
    s = reduce(s, { t: 'confirm_action', playerId: 'p2' });
    expect(s.phase).toBe('combat_planning');
    const before = s;
    s = reduce(s, { t: 'cheer', playerId: 'p1', targetId: 'p2' });
    expect(s).not.toBe(before);
  });

  it('un joueur debout ne peut pas « encourager » (il agit normalement)', () => {
    const s = combatWithDownedP1();
    const attempt = reduce(s, { t: 'cheer', playerId: 'p2', targetId: 'p2' });
    expect(attempt).toBe(s);
  });

  it('impossible d’encourager un allié à terre ou inexistant', () => {
    const s = combatWithDownedP1();
    expect(reduce(s, { t: 'cheer', playerId: 'p1', targetId: 'p1' })).toBe(s);
    expect(reduce(s, { t: 'cheer', playerId: 'p1', targetId: 'nobody' })).toBe(s);
  });
});
