// Constantes d'équilibrage — à tuner sans toucher au moteur (GAME_DESIGN.md §7).

export const BALANCE = {
  // Économie d'action (GAME_DESIGN.md §4.2 : énergie dès la Phase 1)
  defaultMaxEnergy: 3,

  // Draft (GAME_DESIGN.md §6)
  draftOfferCount: 3,
  rerollsPerDraft: 1,
  rarityWeights: { common: 70, rare: 25, legendary: 5 },
  // Après un élite ou un boss : tirage nettement plus généreux (GAME_DESIGN §3)
  eliteRarityWeights: { common: 30, rare: 55, legendary: 15 },

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

  // Progression de niveau (la difficulté monte à chaque niveau)
  levelHpGrowthPct: 25, // +25 % PV ennemis par niveau au-delà du premier
  levelDamageGrowthPct: 15, // +15 % dégâts ennemis par niveau au-delà du premier

  // Carte linéaire (Phase 4) : combat → spécial (événement/repos/boutique) → combat → élite → boss
  nodeLayout: ['combat', 'special', 'combat', 'elite', 'boss'] as const,
  specialRotation: ['event', 'rest', 'shop'] as const, // le spécial tourne selon le niveau

  // Or (GAME_DESIGN §9)
  goldPerCombat: 15,
  goldPerElite: 30,
  goldPerBoss: 50,
  shopPrices: { common: 20, rare: 35, legendary: 60 },
  shopOfferCount: 3,

  // Repos/forge (GAME_DESIGN §3) : soigner OU oublier une compétence
  restHealPct: 40, // % des PV max rendus

  // Mort / résurrection (GAME_DESIGN.md §8)
  revivedHpPct: 50, // PV rendus par un revive, en % des PV max

  // Durée par défaut des debuffs posés par les ennemis (ex. vulnérable)
  enemyDebuffDuration: 2,

  // Menace (GAME_DESIGN.md §4.4)
  threatPerDamage: 1, // menace gagnée par point de dégât infligé
} as const;
