// Bestiaire — Phase 4 : 4 ennemis + 1 boss, mécaniques télégraphiées (GAME_DESIGN §4.3).
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
  summons?: string; // enemyType invoqué (levier de scaling §7)
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
      { kind: 'attack', value: 5, weight: 3, description: 'attaque 5' },
      { kind: 'debuff', status: 'vulnerable', stacks: 1, weight: 1, description: 'expose une cible (vulnérable)' },
    ],
  },
  cultist: {
    enemyType: 'cultist',
    name: 'Cultiste',
    baseHp: 12,
    speed: 5,
    aiProfile: 'random',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 5, weight: 2, description: 'attaque 5' },
      { kind: 'summon', summons: 'slime', weight: 2, description: 'invoque une gelée' },
      { kind: 'debuff', status: 'weak', stacks: 1, weight: 1, description: 'maudit une cible (faiblesse)' },
    ],
  },
  shaman: {
    enemyType: 'shaman',
    name: 'Chamane noir',
    baseHp: 12,
    speed: 3,
    aiProfile: 'focus_lowest_hp',
    isBoss: false,
    moves: [
      { kind: 'heal', value: 6, weight: 2, description: 'soigne son allié le plus blessé (6)' },
      { kind: 'attack', value: 4, weight: 2, description: 'attaque 4' },
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

/** Vagues des nœuds combat — choisies par rotation déterministe (niveau + index de nœud). */
export const COMBAT_WAVES: string[][] = [
  ['slime', 'slime'],
  ['goblin', 'slime'],
  ['goblin', 'goblin', 'slime'],
  ['cultist', 'goblin'],
  ['shaman', 'goblin', 'slime'],
];

/** Vagues élites : plus rudes, multipliées par eliteHpMult / eliteDamageMult. */
export const ELITE_WAVES: string[][] = [
  ['cultist', 'goblin', 'goblin'],
  ['shaman', 'cultist', 'goblin'],
  ['goblin', 'goblin', 'goblin', 'slime'],
];

export const BOSS_WAVE: string[] = ['ogre_boss'];
