// Classes jouables — Phase 1 : une seule classe (GAME_DESIGN.md §2, BUILD_PLAN Phase 1).
import type { SkillId } from '../types';

export interface PlayerClass {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  speed: number;
  maxEnergy: number;
  startingSkills: SkillId[];
}

export const CLASSES: Record<string, PlayerClass> = {
  warrior: {
    id: 'warrior',
    name: 'Guerrier',
    description: 'Tank : encaisse et provoque les ennemis pour protéger les fragiles.',
    maxHp: 30,
    speed: 5,
    maxEnergy: 3,
    startingSkills: ['strike', 'taunt_shout'],
  },
};

export const DEFAULT_CLASS_ID = 'warrior';
