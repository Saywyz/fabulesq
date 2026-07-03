import { describe, expect, it } from 'vitest';
import { bossActionsPerTurn, scaledEnemyDamage, scaledEnemyHp } from './scaling';

describe('scaling par nombre de joueurs et pacing (GAME_DESIGN §7, BUILD_PLAN_V2 §A.4)', () => {
  it('les PV ennemis scalent linéairement avec N joueurs (au départ, p = 0)', () => {
    expect(scaledEnemyHp(10, 1, 0)).toBe(10);
    expect(scaledEnemyHp(10, 2, 0)).toBe(20);
    expect(scaledEnemyHp(10, 4, 0)).toBe(40);
  });

  it('le boss gagne des actions par tour : ⌈N/3⌉', () => {
    expect(bossActionsPerTurn(1)).toBe(1);
    expect(bossActionsPerTurn(3)).toBe(1);
    expect(bossActionsPerTurn(4)).toBe(2);
    expect(bossActionsPerTurn(6)).toBe(2);
    expect(bossActionsPerTurn(7)).toBe(3);
  });

  it('les PV ennemis augmentent avec la progression dans l’expédition', () => {
    const start = scaledEnemyHp(10, 2, 0);
    const mid = scaledEnemyHp(10, 2, 0.5);
    const end = scaledEnemyHp(10, 2, 1);
    expect(mid).toBeGreaterThan(start);
    expect(end).toBeGreaterThan(mid);
  });

  it('les dégâts ennemis augmentent avec la progression mais pas avec N', () => {
    expect(scaledEnemyDamage(10, 0)).toBe(10);
    expect(scaledEnemyDamage(10, 1)).toBeGreaterThan(10);
  });

  it('tout reste entier (pas de PV fractionnaires)', () => {
    for (let n = 1; n <= 8; n++) {
      for (let p = 0; p <= 1; p += 0.1) {
        expect(Number.isInteger(scaledEnemyHp(13, n, p))).toBe(true);
        expect(Number.isInteger(scaledEnemyDamage(7, p))).toBe(true);
      }
    }
  });
});
