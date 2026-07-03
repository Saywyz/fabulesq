// Biomes de l'expédition (Phase 7) : chaque nœud est tagué par un biome qui fournit
// son sous-bestiaire via des tables de rencontres. L'interface est stable dès maintenant ;
// la Phase 8 étoffera le bestiaire (ennemis dédiés, un boss par biome, compositions par palier).
// Les rencontres sont choisies par rotation déterministe sur l'index du nœud (pas de PRNG,
// décision Phase 4 conservée).

export interface BiomeEncounters {
  combat: string[][]; // vagues des nœuds combat (rotation par index de nœud)
  elite: string[][]; // vagues des nœuds élite
  boss: string[]; // vague du boss (final en Phase 7 ; un par biome en Phase 8)
}

export interface BiomeDef {
  id: string;
  name: string;
  encounters: BiomeEncounters;
}

export const BIOMES: Record<string, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Forêt',
    encounters: {
      combat: [
        ['slime', 'slime'],
        ['goblin', 'slime'],
        ['goblin', 'goblin', 'slime'],
      ],
      elite: [['goblin', 'goblin', 'goblin', 'slime']],
      boss: ['ogre_boss'],
    },
  },
  castle: {
    id: 'castle',
    name: 'Château',
    encounters: {
      combat: [
        ['goblin', 'goblin'],
        ['cultist', 'goblin'],
        ['cultist', 'goblin', 'slime'],
      ],
      elite: [['cultist', 'goblin', 'goblin']],
      boss: ['ogre_boss'],
    },
  },
  volcano: {
    id: 'volcano',
    name: 'Volcan',
    encounters: {
      combat: [
        ['shaman', 'goblin'],
        ['cultist', 'slime', 'slime'],
        ['shaman', 'goblin', 'slime'],
      ],
      elite: [['shaman', 'cultist', 'goblin']],
      boss: ['ogre_boss'],
    },
  },
};

/** Biomes candidats à la génération d'expédition (l'ordre est mélangé par le PRNG seedé). */
export const BIOME_IDS: string[] = Object.keys(BIOMES);
