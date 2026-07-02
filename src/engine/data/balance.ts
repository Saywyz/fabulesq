// Constantes d'équilibrage — à tuner sans toucher au moteur (GAME_DESIGN.md §7).

export const BALANCE = {
  // Économie d'action (GAME_DESIGN.md §4.2 : énergie dès la Phase 1)
  defaultMaxEnergy: 3,

  // Draft (GAME_DESIGN.md §6)
  draftOfferCount: 3,
  rerollsPerDraft: 1,
  rarityWeights: { common: 70, rare: 25, legendary: 5 },

  // Statuts (GAME_DESIGN.md §5)
  strengthDamagePerStack: 1, // +dégâts par stack de force
  vulnerableBonusPct: 50, // +50 % dégâts subis
  weakReductionPct: 25, // −25 % dégâts infligés

  // Scaling par nombre de joueurs (GAME_DESIGN.md §7)
  enemyHpPerPlayer: 1, // pv = baseHp × N × coef
  bossPlayersPerExtraAction: 3, // le boss agit ⌈N / 3⌉ fois par tour

  // Progression de niveau (la difficulté monte à chaque niveau)
  levelHpGrowthPct: 25, // +25 % PV ennemis par niveau au-delà du premier
  levelDamageGrowthPct: 15, // +15 % dégâts ennemis par niveau au-delà du premier

  // Carte linéaire MVP (GAME_DESIGN.md §11 : combat ×4 → boss)
  combatsBeforeBoss: 4,

  // Mort / résurrection (GAME_DESIGN.md §8)
  revivedHpPct: 50, // PV rendus par un revive, en % des PV max

  // Durée par défaut des debuffs posés par les ennemis (ex. vulnérable)
  enemyDebuffDuration: 2,

  // Menace (GAME_DESIGN.md §4.4)
  threatPerDamage: 1, // menace gagnée par point de dégât infligé
} as const;
