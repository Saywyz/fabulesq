import { describe, expect, it } from 'vitest';
import { createRngState, next, nextInt } from './rng';

describe('rng (mulberry32 seedé)', () => {
  it('le même seed produit exactement la même séquence', () => {
    let a = createRngState(12345);
    let b = createRngState(12345);
    for (let i = 0; i < 100; i++) {
      const ra = next(a);
      const rb = next(b);
      expect(ra.value).toBe(rb.value);
      expect(ra.state).toBe(rb.state);
      a = ra.state;
      b = rb.state;
    }
  });

  it('deux seeds différents produisent des séquences différentes', () => {
    const seqA: number[] = [];
    const seqB: number[] = [];
    let a = createRngState(1);
    let b = createRngState(2);
    for (let i = 0; i < 10; i++) {
      const ra = next(a);
      const rb = next(b);
      seqA.push(ra.value);
      seqB.push(rb.value);
      a = ra.state;
      b = rb.state;
    }
    expect(seqA).not.toEqual(seqB);
  });

  it('next est pur : le même état donne toujours le même résultat', () => {
    const state = createRngState(777);
    const r1 = next(state);
    const r2 = next(state);
    expect(r1).toEqual(r2);
  });

  it('next produit des valeurs dans [0, 1)', () => {
    let state = createRngState(42);
    for (let i = 0; i < 1000; i++) {
      const r = next(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      state = r.state;
    }
  });

  it("l'état reste un entier uint32 sérialisable (compatible rngState: number)", () => {
    let state = createRngState(999);
    for (let i = 0; i < 100; i++) {
      expect(Number.isInteger(state)).toBe(true);
      expect(state).toBeGreaterThanOrEqual(0);
      expect(state).toBeLessThanOrEqual(0xffffffff);
      state = next(state).state;
    }
  });

  it('nextInt tire des entiers dans [min, max] inclus, de façon déterministe', () => {
    let a = createRngState(2024);
    let b = createRngState(2024);
    for (let i = 0; i < 500; i++) {
      const ra = nextInt(a, 1, 6);
      const rb = nextInt(b, 1, 6);
      expect(ra.value).toBe(rb.value);
      expect(Number.isInteger(ra.value)).toBe(true);
      expect(ra.value).toBeGreaterThanOrEqual(1);
      expect(ra.value).toBeLessThanOrEqual(6);
      a = ra.state;
      b = rb.state;
    }
  });

  it('nextInt couvre toutes les valeurs de la plage (dé à 6 faces)', () => {
    const seen = new Set<number>();
    let state = createRngState(7);
    for (let i = 0; i < 200; i++) {
      const r = nextInt(state, 1, 6);
      seen.add(r.value);
      state = r.state;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('createRngState normalise le seed en uint32', () => {
    expect(createRngState(-1)).toBeGreaterThanOrEqual(0);
    expect(createRngState(2 ** 40)).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(createRngState(3.7))).toBe(true);
  });
});
