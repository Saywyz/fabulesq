import { describe, expect, it } from 'vitest';
import { generateOffers } from './draft';
import { DRAFT_POOL, SKILLS } from './data/skills';
import { createRngState, next } from './rng';

describe('draft 3-choix (GAME_DESIGN §6)', () => {
  it('propose 3 compétences distinctes issues du pool', () => {
    const { offers } = generateOffers(DRAFT_POOL, 3, createRngState(5), []);
    expect(offers).toHaveLength(3);
    expect(new Set(offers).size).toBe(3);
    for (const id of offers) expect(SKILLS[id]).toBeDefined();
  });

  it('est déterministe : même PRNG ⇒ mêmes offres', () => {
    const a = generateOffers(DRAFT_POOL, 3, createRngState(123), []);
    const b = generateOffers(DRAFT_POOL, 3, createRngState(123), []);
    expect(a.offers).toEqual(b.offers);
    expect(a.state).toBe(b.state);
  });

  it('exclut les compétences déjà possédées', () => {
    const owned = DRAFT_POOL.filter((id) => id !== 'fireball' && id !== 'strike' && id !== 'defend');
    const { offers } = generateOffers(DRAFT_POOL, 3, createRngState(7), owned);
    expect(offers.sort()).toEqual(['defend', 'fireball', 'strike']);
  });

  it('propose moins de 3 offres si le pool restant est trop petit', () => {
    const owned = DRAFT_POOL.filter((id) => id !== 'strike');
    const { offers } = generateOffers(DRAFT_POOL, 3, createRngState(7), owned);
    expect(offers).toEqual(['strike']);
  });

  it('la rareté pondère le tirage : le commun sort plus souvent que le légendaire', () => {
    let state = createRngState(42);
    let commons = 0;
    let rares = 0;
    for (let i = 0; i < 300; i++) {
      const r = generateOffers(DRAFT_POOL, 1, state, []);
      state = next(state).state; // avance le PRNG entre les tirages
      const skill = SKILLS[r.offers[0]!]!;
      if (skill.rarity === 'common') commons++;
      if (skill.rarity === 'rare') rares++;
    }
    expect(commons).toBeGreaterThan(rares);
  });
});
