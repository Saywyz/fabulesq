import { describe, expect, it } from 'vitest';
import { bossActionsPerTurn, scaledEnemyDamage, scaledEnemyHp } from './scaling';

describe('scaling par nombre de joueurs (GAME_DESIGN §7)', () => {
  it('les PV ennemis scalent linéairement avec N joueurs', () => {
    expect(scaledEnemyHp(10, 1, 1)).toBe(10);
    expect(scaledEnemyHp(10, 2, 1)).toBe(20);
    expect(scaledEnemyHp(10, 4, 1)).toBe(40);
  });

  it('le boss gagne des actions par tour : ⌈N/3⌉', () => {
    expect(bossActionsPerTurn(1)).toBe(1);
    expect(bossActionsPerTurn(3)).toBe(1);
    expect(bossActionsPerTurn(4)).toBe(2);
    expect(bossActionsPerTurn(6)).toBe(2);
    expect(bossActionsPerTurn(7)).toBe(3);
  });

  it('les PV ennemis augmentent avec le niveau de la run', () => {
    const l1 = scaledEnemyHp(10, 2, 1);
    const l2 = scaledEnemyHp(10, 2, 2);
    const l3 = scaledEnemyHp(10, 2, 3);
    expect(l2).toBeGreaterThan(l1);
    expect(l3).toBeGreaterThan(l2);
  });

  it('les dégâts ennemis augmentent avec le niveau mais pas avec N', () => {
    expect(scaledEnemyDamage(10, 1)).toBe(10);
    expect(scaledEnemyDamage(10, 2)).toBeGreaterThan(10);
  });

  it('tout reste entier (pas de PV fractionnaires)', () => {
    for (let n = 1; n <= 8; n++) {
      for (let lvl = 1; lvl <= 5; lvl++) {
        expect(Number.isInteger(scaledEnemyHp(13, n, lvl))).toBe(true);
        expect(Number.isInteger(scaledEnemyDamage(7, lvl))).toBe(true);
      }
    }
  });
});
