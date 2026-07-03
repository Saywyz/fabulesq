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
  enemyHpPerPlayer: 0.85, // pv = baseHp × N × coef (sweep Phase 8 : 1 → 0.85, combats plus courts)
  bossPlayersPerExtraAction: 3, // le boss agit ⌈N / 3⌉ fois par tour
  maxEnemies: 6, // plafond d'invocations (cultiste)

  // Élite : plus dur, mieux récompensé (GAME_DESIGN §3)
  // Sweep Phase 8 : 1.15/1.05 → 1.1/1.0, l'élite restait un mur pour les petites équipes sans kit.
  eliteHpMult: 1.1,
  eliteDamageMult: 1.0,

  // Expédition (Phase 7, BUILD_PLAN_V2 §A.4) : longueur par bande (bornes incluses)
  expeditionLength: {
    short: { min: 8, max: 10 },
    medium: { min: 12, max: 15 },
    long: { min: 16, max: 20 },
  },

  // Pacing de difficulté sur la progression normalisée p ∈ [0,1] (remplace les « niveaux »)
  // Sweep Phase 8 : 60/35 écrasait le bot naïf avant mi-route → adouci en attendant les kits (Phase 11).
  pacingHpGrowthPct: 35, // les ennemis du bout de route ont +35 % de PV
  pacingDamageGrowthPct: 20, // … et +20 % de dégâts

  // Repos/forge (GAME_DESIGN §3) : soigner OU oublier une compétence
  restHealPct: 50, // % des PV max rendus (sweep Phase 8 : 40 → 50, seule source de soin en run)

  // Mort / résurrection (GAME_DESIGN.md §8)
  revivedHpPct: 50, // PV rendus par un revive, en % des PV max
  cheerBlock: 2, // bouclier donné par l'encouragement d'un joueur à terre (Phase 6)

  // Durée par défaut des debuffs posés par les ennemis (ex. vulnérable)
  enemyDebuffDuration: 2,

  // Menace (GAME_DESIGN.md §4.4)
  threatPerDamage: 1, // menace gagnée par point de dégât infligé
} as const;
