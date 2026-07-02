// Génération des offres de draft : tirage pondéré par rareté, sans doublon (GAME_DESIGN.md §6).
import { BALANCE } from './data/balance';
import { SKILLS } from './data/skills';
import { nextInt } from './rng';
import type { SkillId } from './types';

export interface OffersResult {
  offers: SkillId[];
  state: number;
}

/** Tire `count` compétences distinctes du pool, hors compétences déjà possédées. */
export function generateOffers(
  pool: SkillId[],
  count: number,
  rngState: number,
  owned: SkillId[],
): OffersResult {
  const ownedSet = new Set(owned);
  let available = pool.filter((id) => !ownedSet.has(id) && SKILLS[id] !== undefined);
  const offers: SkillId[] = [];
  let state = rngState;

  while (offers.length < count && available.length > 0) {
    const weights = available.map((id) => BALANCE.rarityWeights[SKILLS[id]!.rarity]);
    const total = weights.reduce((sum, w) => sum + w, 0);
    const r = nextInt(state, 1, total);
    state = r.state;

    let acc = 0;
    let picked = 0;
    for (let i = 0; i < available.length; i++) {
      acc += weights[i]!;
      if (r.value <= acc) {
        picked = i;
        break;
      }
    }
    offers.push(available[picked]!);
    available = available.filter((_, i) => i !== picked);
  }
  return { offers, state };
}
