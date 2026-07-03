// Bestiaire — Phase 8 : ~14 ennemis + 1 boss par biome, organisés par data/biomes.ts.
// Data-driven : les "moves" décrivent les intentions possibles, la logique vit dans combat/.
// Profils variés : focus_lowest_hp / focus_highest_threat / random, soigneuses, invocateurs
// (plafonnés par maxEnemies), chargeurs télégraphiés, applicateurs de statut (poison, brûlure…).
// Les invocations restent DANS le biome de l'invocateur (nécromancien → squelette, cultiste → diablotin).
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
  // ————— Forêt —————
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
      { kind: 'attack', value: 4, weight: 3, description: 'attaque 4' },
      { kind: 'debuff', status: 'vulnerable', stacks: 1, weight: 1, description: 'expose une cible (vulnérable)' },
    ],
  },
  wolf: {
    enemyType: 'wolf',
    name: 'Loup gris',
    baseHp: 11,
    speed: 7,
    aiProfile: 'focus_lowest_hp',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 3, weight: 3, description: 'croc rapide : 3' },
      { kind: 'attack', value: 6, weight: 1, description: 'morsure féroce : 6' },
    ],
  },
  spider: {
    enemyType: 'spider',
    name: 'Araignée venimeuse',
    baseHp: 9,
    speed: 4,
    aiProfile: 'random',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 3, weight: 2, description: 'attaque 3' },
      { kind: 'debuff', status: 'poison', stacks: 2, weight: 2, description: 'crache son venin (2 poison)' },
    ],
  },
  dryad: {
    enemyType: 'dryad',
    name: 'Vieille dryade',
    baseHp: 12,
    speed: 3,
    aiProfile: 'focus_lowest_hp',
    isBoss: false,
    moves: [
      { kind: 'heal', value: 5, weight: 2, description: 'soigne son allié le plus blessé (5)' },
      { kind: 'attack', value: 3, weight: 2, description: 'ronces : 3' },
    ],
  },
  ancient_treant: {
    enemyType: 'ancient_treant',
    name: 'Tréant ancestral',
    baseHp: 42,
    speed: 3,
    aiProfile: 'focus_highest_threat',
    isBoss: true,
    moves: [
      { kind: 'attack', value: 9, weight: 3, description: 'abat une branche : 9' },
      { kind: 'aoe', value: 4, weight: 2, description: 'tempête de racines : 4 à toute l’équipe' },
      { kind: 'charge', value: 15, weight: 1, chargeTurns: 1, description: 's’enracine : coup colossal (15) au prochain tour' },
    ],
  },

  // ————— Château —————
  skeleton: {
    enemyType: 'skeleton',
    name: 'Squelette',
    baseHp: 10,
    speed: 4,
    aiProfile: 'random',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 4, weight: 3, description: 'attaque 4' },
      { kind: 'buff', status: 'strength', stacks: 1, weight: 1, description: 'se rassemble (+1 force)' },
    ],
  },
  skeleton_archer: {
    enemyType: 'skeleton_archer',
    name: 'Archer squelette',
    baseHp: 8,
    speed: 6,
    aiProfile: 'focus_lowest_hp',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 4, weight: 2, description: 'décoche une flèche : 4' },
      { kind: 'charge', value: 8, weight: 2, chargeTurns: 1, description: 'vise longuement : tir mortel (8) au prochain tour' },
    ],
  },
  dark_knight: {
    enemyType: 'dark_knight',
    name: 'Chevalier noir',
    baseHp: 16,
    speed: 3,
    aiProfile: 'focus_highest_threat',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 5, weight: 3, description: 'taille : 5' },
      { kind: 'buff', status: 'strength', stacks: 1, weight: 1, description: 'lève sa garde (+1 force)' },
    ],
  },
  necromancer: {
    enemyType: 'necromancer',
    name: 'Nécromancien',
    baseHp: 11,
    speed: 4,
    aiProfile: 'random',
    isBoss: false,
    moves: [
      { kind: 'summon', summons: 'skeleton', weight: 2, description: 'relève un squelette' },
      { kind: 'attack', value: 3, weight: 2, description: 'dague d’os : 3' },
      { kind: 'debuff', status: 'weak', stacks: 1, weight: 1, description: 'maudit une cible (faiblesse)' },
    ],
  },
  skeleton_king: {
    enemyType: 'skeleton_king',
    name: 'Roi des ossements',
    baseHp: 40,
    speed: 4,
    aiProfile: 'focus_highest_threat',
    isBoss: true,
    moves: [
      { kind: 'attack', value: 10, weight: 3, description: 'sceptre funèbre : 10' },
      { kind: 'summon', summons: 'skeleton', weight: 2, description: 'relève un squelette' },
      { kind: 'aoe', value: 4, weight: 1, description: 'onde nécrotique : 4 à toute l’équipe' },
    ],
  },

  // ————— Volcan —————
  imp: {
    enemyType: 'imp',
    name: 'Diablotin',
    baseHp: 8,
    speed: 6,
    aiProfile: 'random',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 3, weight: 2, description: 'griffure : 3' },
      { kind: 'debuff', status: 'burn', stacks: 2, weight: 2, description: 'crache une flammèche (2 brûlures)' },
    ],
  },
  magma_slime: {
    enemyType: 'magma_slime',
    name: 'Gelée de magma',
    baseHp: 14,
    speed: 2,
    aiProfile: 'random',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 4, weight: 3, description: 'éclaboussure brûlante : 4' },
      { kind: 'buff', status: 'strength', stacks: 1, weight: 1, description: 'bouillonne (+1 force)' },
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
      { kind: 'attack', value: 4, weight: 2, description: 'attaque 4' },
      { kind: 'summon', summons: 'imp', weight: 2, description: 'invoque un diablotin' },
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
      { kind: 'heal', value: 5, weight: 2, description: 'soigne son allié le plus blessé (5)' },
      { kind: 'attack', value: 3, weight: 2, description: 'attaque 3' },
    ],
  },
  golem: {
    enemyType: 'golem',
    name: 'Golem de braises',
    baseHp: 18,
    speed: 1,
    aiProfile: 'focus_highest_threat',
    isBoss: false,
    moves: [
      { kind: 'attack', value: 6, weight: 3, description: 'poing de basalte : 6' },
      { kind: 'charge', value: 11, weight: 1, chargeTurns: 1, description: 's’embrase : éruption (11) au prochain tour' },
    ],
  },
  fire_demon: {
    enemyType: 'fire_demon',
    name: 'Seigneur des braises',
    baseHp: 38,
    speed: 5,
    aiProfile: 'focus_highest_threat',
    isBoss: true,
    moves: [
      { kind: 'attack', value: 10, weight: 3, description: 'lacération ardente : 10' },
      { kind: 'aoe', value: 5, weight: 2, description: 'pluie de braises : 5 à toute l’équipe' },
      { kind: 'charge', value: 16, weight: 1, chargeTurns: 1, description: 'concentre sa fournaise : cataclysme (16) au prochain tour' },
    ],
  },
};

// Les vagues de rencontre vivent dans data/biomes.ts (tables par biome et par palier).
