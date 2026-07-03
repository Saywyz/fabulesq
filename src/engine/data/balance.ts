// Constantes d'équilibrage — à tuner sans toucher au moteur (GAME_DESIGN.md §7).

export const BALANCE = {
  // Économie d'action (GAME_DESIGN.md §4.2 : énergie dès la Phase 1)
  defaultMaxEnergy: 3,

  // Statuts (GAME_DESIGN.md §5)
  strengthDamagePerStack: 1, // +dégâts par stack de force
  vulnerableBonusPct: 50, // +50 % dégâts subis
  weakReductionPct: 25, // −25 % dégâts infligés

  // Synergies (resolution.ts : SkillEffect.scalesWith)
  scalingStrengthBonusPerStack: 1, // scalesWith 'strength' : +1 supplémentaire par stack
  scalingMissingHpDivisor: 3, // scalesWith 'missing_hp' : +1 dégât par 3 PV manquants

  // Scaling par nombre de joueurs (GAME_DESIGN.md §7)
  enemyHpPerPlayer: 1, // pv = baseHp × N × coef
  bossPlayersPerExtraAction: 3, // le boss agit ⌈N / 3⌉ fois par tour
  maxEnemies: 6, // plafond d'invocations (cultiste)

  // Élite : plus dur, mieux récompensé (GAME_DESIGN §3)
  eliteHpMult: 1.15,
  eliteDamageMult: 1.05,

  // Expédition (Phase 7, BUILD_PLAN_V2 §A.4) : longueur par bande (bornes incluses)
  expeditionLength: {
    short: { min: 8, max: 10 },
    medium: { min: 12, max: 15 },
    long: { min: 16, max: 20 },
  },

  // Pacing de difficulté sur la progression normalisée p ∈ [0,1] (remplace les « niveaux »)
  pacingHpGrowthPct: 60, // les ennemis du bout de route ont +60 % de PV
  pacingDamageGrowthPct: 35, // … et +35 % de dégâts

  // Repos/forge (GAME_DESIGN §3) : soigner OU oublier une compétence
  restHealPct: 40, // % des PV max rendus

  // Mort / résurrection (GAME_DESIGN.md §8)
  revivedHpPct: 50, // PV rendus par un revive, en % des PV max
  cheerBlock: 2, // bouclier donné par l'encouragement d'un joueur à terre (Phase 6)

  // Durée par défaut des debuffs posés par les ennemis (ex. vulnérable)
  enemyDebuffDuration: 2,

  // Menace (GAME_DESIGN.md §4.4)
  threatPerDamage: 1, // menace gagnée par point de dégât infligé
} as const;
