// Scaling de difficulté selon le nombre de joueurs et le niveau (GAME_DESIGN.md §7).
import { BALANCE } from './data/balance';

/** PV ennemis : ~linéaire avec N joueurs, croissance par niveau. */
export function scaledEnemyHp(baseHp: number, playerCount: number, levelNumber: number): number {
  const levelMult = 1 + (BALANCE.levelHpGrowthPct / 100) * (levelNumber - 1);
  return Math.round(baseHp * playerCount * BALANCE.enemyHpPerPlayer * levelMult);
}

/** Dégâts ennemis : croissance par niveau uniquement (la menace scale par les actions, pas les stats). */
export function scaledEnemyDamage(base: number, levelNumber: number): number {
  const levelMult = 1 + (BALANCE.levelDamageGrowthPct / 100) * (levelNumber - 1);
  return Math.round(base * levelMult);
}

/** Actions du boss par tour : ⌈N/3⌉ pour que « + de joueurs = + dur » reste vrai. */
export function bossActionsPerTurn(playerCount: number): number {
  return Math.ceil(playerCount / BALANCE.bossPlayersPerExtraAction);
}
