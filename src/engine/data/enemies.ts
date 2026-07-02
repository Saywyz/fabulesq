// Bestiaire — Phase 1 : 2 ennemis standards + 1 boss (BUILD_PLAN Phase 1).
// Data-driven : les "moves" décrivent les intentions possibles, la logique vit dans combat/.
import type { IntentKind, StatusKind } from '../types';

export interface EnemyMove {
  kind: IntentKind;
  value?: number;
  weight: number; // pondération du tirage d'intention
  description: string;
  status?: StatusKind; // pour les moves buff/debuff
  stacks?: number;
  chargeTurns?: number; // pour les attaques chargées
}

export interface EnemyTemplate {
  enemyType: string;
  name: string;
  baseHp: number;
  speed: number;
  aiProfile: 'focus_lowest_hp' | 'focus_highest_threat' | 'random';
  isBoss: boolean;
  moves: EnemyMove[];
}

export const ENEMIES: Record<string, EnemyTemplate> = {
  slime: {
    enemyType: 'slime',
    name: 'Gelée',
    baseHp: 14,
    speed: 2,
    aiProfile: 'random',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 3, weight: 3, description: 'attaque 3' },
      { kind: 'buff', status: 'strength', stacks: 1, weight: 1, description: 'se renforce (+1 force)' },
    ],
  },
  goblin: {
    enemyType: 'goblin',
    name: 'Gobelin',
    baseHp: 10,
    speed: 6,
    aiProfile: 'focus_lowest_hp',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 6, weight: 3, description: 'attaque 6' },
      { kind: 'debuff', status: 'vulnerable', stacks: 1, weight: 1, description: 'expose une cible (vulnérable)' },
    ],
  },
  ogre_boss: {
    enemyType: 'ogre_boss',
    name: 'Ogre chef de guerre',
    baseHp: 40,
    speed: 4,
    aiProfile: 'focus_highest_threat',
    isBoss: true,
    moves: [
      { kind: 'attack', value: 12, weight: 3, description: 'attaque 12' },
      { kind: 'aoe', value: 6, weight: 2, description: 'balayage : 6 à toute l’équipe' },
      { kind: 'charge', value: 20, weight: 1, chargeTurns: 1, description: 'charge : grosse attaque (20) au prochain tour' },
    ],
  },
};

/** Composition des vagues par position de nœud (avant le boss). */
export const WAVES: string[][] = [
  ['slime', 'slime'],
  ['goblin', 'slime'],
  ['goblin', 'goblin'],
  ['goblin', 'goblin', 'slime'],
];

export const BOSS_WAVE: string[] = ['ogre_boss'];
