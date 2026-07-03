// Biomes de l'expédition (Phases 7–8) : chaque nœud est tagué par un biome qui fournit
// son sous-bestiaire via des tables de rencontres PAR PALIER de difficulté.
// Le palier est choisi par la progression normalisée p (buildEnemies) ; à l'intérieur
// d'un palier, la vague est choisie par rotation déterministe sur l'index du nœud
// (pas de PRNG, décision Phase 4 conservée).
// Invariant testé : toute vague (et toute invocation) ne référence que des ennemis
// du bestiaire de son biome.

export interface BiomeEncounters {
  combat: string[][][]; // paliers de difficulté (faible → fort) → vagues → enemyTypes
  elite: string[][]; // vagues des nœuds élite (rotation par index de nœud)
  boss: string[]; // vague du boss du biome (boss final = biome du dernier segment)
}

export interface BiomeDef {
  id: string;
  name: string;
  bestiary: string[]; // sous-bestiaire : seuls ces ennemis peuvent apparaître ici
  encounters: BiomeEncounters;
}

export const BIOMES: Record<string, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Forêt',
    bestiary: ['slime', 'goblin', 'wolf', 'spider', 'dryad', 'ancient_treant'],
    encounters: {
      combat: [
        // Palier 1 : début de route
        [
          ['slime', 'slime'],
          ['goblin', 'slime'],
          ['spider', 'slime'],
        ],
        // Palier 2 : fin de route
        [
          ['wolf', 'wolf'],
          ['dryad', 'goblin', 'slime'],
          ['spider', 'wolf', 'goblin'],
        ],
      ],
      elite: [
        ['dryad', 'wolf', 'wolf'],
        ['spider', 'goblin', 'slime'],
      ],
      boss: ['ancient_treant'],
    },
  },
  castle: {
    id: 'castle',
    name: 'Château',
    bestiary: ['skeleton', 'skeleton_archer', 'dark_knight', 'necromancer', 'skeleton_king'],
    encounters: {
      combat: [
        [
          ['skeleton', 'skeleton'],
          ['skeleton_archer', 'skeleton'],
        ],
        [
          ['dark_knight', 'skeleton_archer'],
          ['necromancer', 'skeleton', 'skeleton'],
          ['dark_knight', 'skeleton', 'skeleton'],
        ],
      ],
      elite: [
        ['necromancer', 'dark_knight', 'skeleton'],
        ['skeleton_archer', 'skeleton_archer', 'skeleton'],
      ],
      boss: ['skeleton_king'],
    },
  },
  volcano: {
    id: 'volcano',
    name: 'Volcan',
    bestiary: ['imp', 'magma_slime', 'cultist', 'shaman', 'golem', 'fire_demon'],
    encounters: {
      combat: [
        [
          ['imp', 'imp'],
          ['magma_slime', 'imp'],
        ],
        [
          ['cultist', 'imp', 'imp'],
          ['golem', 'magma_slime'],
          ['shaman', 'imp', 'imp'],
        ],
      ],
      elite: [
        ['shaman', 'cultist', 'imp'],
        ['golem', 'imp', 'magma_slime'],
      ],
      boss: ['fire_demon'],
    },
  },
};

/** Biomes candidats à la génération d'expédition (l'ordre est mélangé par le PRNG seedé). */
export const BIOME_IDS: string[] = Object.keys(BIOMES);
