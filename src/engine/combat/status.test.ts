import { describe, expect, it } from 'vitest';
import type { Combatant } from '../types';
import { applyStatus, dealDamage, getStacks, tickEndOfTurn } from './status';

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c1',
    name: 'Test',
    hp: 20,
    maxHp: 20,
    block: 0,
    speed: 5,
    statuses: [],
    alive: true,
    ...overrides,
  };
}

describe('statuts (GAME_DESIGN §5)', () => {
  it('applyStatus ajoute un statut et fusionne les stacks du même type', () => {
    let c = makeCombatant();
    c = applyStatus(c, 'mark', 2, -1);
    c = applyStatus(c, 'mark', 3, -1);
    expect(getStacks(c, 'mark')).toBe(5);
  });

  it("applyStatus ne mute pas l'original (immutabilité)", () => {
    const c = makeCombatant();
    applyStatus(c, 'burn', 3, -1);
    expect(c.statuses).toEqual([]);
  });

  it('la brûlure inflige ses stacks en dégâts puis se consume (−1 stack/tour)', () => {
    let c = makeCombatant({ hp: 20 });
    c = applyStatus(c, 'burn', 3, -1);
    c = tickEndOfTurn(c).combatant;
    expect(c.hp).toBe(17);
    expect(getStacks(c, 'burn')).toBe(2);
    c = tickEndOfTurn(c).combatant;
    expect(c.hp).toBe(15);
    expect(getStacks(c, 'burn')).toBe(1);
  });

  it('le poison inflige ses stacks en dégâts, ne se consume pas, expire par durée', () => {
    let c = makeCombatant({ hp: 20 });
    c = applyStatus(c, 'poison', 2, 3);
    c = tickEndOfTurn(c).combatant;
    expect(c.hp).toBe(18);
    expect(getStacks(c, 'poison')).toBe(2);
    c = tickEndOfTurn(c).combatant;
    c = tickEndOfTurn(c).combatant;
    expect(c.hp).toBe(14);
    expect(getStacks(c, 'poison')).toBe(0); // durée écoulée
  });

  it('le bouclier (block) absorbe les dégâts avant les PV', () => {
    const target = makeCombatant({ hp: 20, block: 5 });
    const { target: after, dealt } = dealDamage(null, target, 8);
    expect(after.block).toBe(0);
    expect(after.hp).toBe(17);
    expect(dealt).toBe(3);
  });

  it('le block expire à la fin du tour', () => {
    let c = makeCombatant({ block: 5 });
    c = tickEndOfTurn(c).combatant;
    expect(c.block).toBe(0);
  });

  it('la force augmente les dégâts infligés (+1/stack)', () => {
    let attacker = makeCombatant({ id: 'a' });
    attacker = applyStatus(attacker, 'strength', 2, -1);
    const target = makeCombatant({ id: 'b', hp: 20 });
    const { dealt } = dealDamage(attacker, target, 6);
    expect(dealt).toBe(8);
  });

  it('vulnérable augmente les dégâts subis de 50 % (arrondi bas)', () => {
    let target = makeCombatant({ hp: 20 });
    target = applyStatus(target, 'vulnerable', 1, 2);
    const { dealt } = dealDamage(null, target, 7);
    expect(dealt).toBe(10); // 7 × 1.5 = 10.5 → 10
  });

  it('les PV tombent à 0 sans devenir négatifs et alive passe à false', () => {
    const target = makeCombatant({ hp: 5 });
    const { target: after } = dealDamage(null, target, 12);
    expect(after.hp).toBe(0);
    expect(after.alive).toBe(false);
  });

  it('les durées finies décomptent et les statuts expirés disparaissent ; durée -1 persiste', () => {
    let c = makeCombatant();
    c = applyStatus(c, 'vulnerable', 1, 1);
    c = applyStatus(c, 'mark', 2, -1);
    c = tickEndOfTurn(c).combatant;
    expect(getStacks(c, 'vulnerable')).toBe(0);
    expect(getStacks(c, 'mark')).toBe(2);
  });
});
