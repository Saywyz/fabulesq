// Pool de compétences — Phase 1 : ~9 compétences dont une synergie inter-joueurs
// (marque + détonation, GAME_DESIGN.md §6).
import type { Skill, SkillId } from '../types';

export const SKILLS: Record<SkillId, Skill> = {
  strike: {
    id: 'strike',
    name: 'Frappe',
    description: 'Inflige 6 dégâts physiques à un ennemi.',
    rarity: 'common',
    cost: 1,
    targeting: 'enemy',
    tags: ['physical'],
    effects: [{ type: 'damage', amount: 6 }],
  },
  defend: {
    id: 'defend',
    name: 'Garde',
    description: 'Gagne 5 de bouclier jusqu’à la fin du tour.',
    rarity: 'common',
    cost: 1,
    targeting: 'self',
    tags: ['physical'],
    effects: [{ type: 'block', amount: 5 }],
  },
  taunt_shout: {
    id: 'taunt_shout',
    name: 'Provocation',
    description: 'Attire l’attention des ennemis (+20 menace) et gagne 3 de bouclier.',
    rarity: 'common',
    cost: 1,
    targeting: 'self',
    tags: ['physical'],
    effects: [
      { type: 'taunt', amount: 20 },
      { type: 'block', amount: 3 },
    ],
  },
  fireball: {
    id: 'fireball',
    name: 'Boule de feu',
    description: 'Inflige 4 dégâts et applique 3 brûlures (dégâts chaque tour, se consume).',
    rarity: 'rare',
    cost: 2,
    targeting: 'enemy',
    tags: ['fire'],
    effects: [
      { type: 'damage', amount: 4 },
      { type: 'apply_status', status: 'burn', stacks: 3, duration: -1 },
    ],
  },
  poison_dagger: {
    id: 'poison_dagger',
    name: 'Dague empoisonnée',
    description: 'Inflige 3 dégâts et applique 2 poisons pendant 3 tours.',
    rarity: 'common',
    cost: 1,
    targeting: 'enemy',
    tags: ['poison', 'physical'],
    effects: [
      { type: 'damage', amount: 3 },
      { type: 'apply_status', status: 'poison', stacks: 2, duration: 3 },
    ],
  },
  hunters_mark: {
    id: 'hunters_mark',
    name: 'Marque du chasseur',
    description: 'Appose 3 marques sur un ennemi. Inerte seule — un allié peut les détoner.',
    rarity: 'common',
    cost: 1,
    targeting: 'enemy',
    tags: ['mark'],
    effects: [{ type: 'apply_status', status: 'mark', stacks: 3, duration: -1 }],
  },
  detonate_marks: {
    id: 'detonate_marks',
    name: 'Détonation',
    description: 'Consomme toutes les marques de la cible : 4 dégâts par marque.',
    rarity: 'rare',
    cost: 2,
    targeting: 'enemy',
    tags: ['mark'],
    effects: [{ type: 'detonate', tag: 'mark', amount: 4 }],
  },
  rally_heal: {
    id: 'rally_heal',
    name: 'Encouragement',
    description: 'Rend 5 PV à un allié.',
    rarity: 'common',
    cost: 1,
    targeting: 'ally',
    tags: ['holy'],
    effects: [{ type: 'heal', amount: 5 }],
  },
  helping_hand: {
    id: 'helping_hand',
    name: 'Main secourable',
    description: 'Relève un allié à terre avec la moitié de ses PV max.',
    rarity: 'common',
    cost: 2,
    targeting: 'ally',
    tags: ['holy'],
    effects: [{ type: 'revive' }],
  },
};

/** Compétences proposables au draft (tout le pool en Phase 1). */
export const DRAFT_POOL: SkillId[] = Object.keys(SKILLS);
