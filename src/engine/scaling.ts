// Scaling de difficulté : nombre de joueurs + progression normalisée dans l'expédition
// (GAME_DESIGN.md §7, pacing BUILD_PLAN_V2 §A.4).
import { BALANCE } from './data/balance';

/** PV ennemis : ~linéaire avec N joueurs, pacing par la progression p ∈ [0,1]. */
export function scaledEnemyHp(baseHp: number, playerCount: number, progress: number): number {
  const paceMult = 1 + (BALANCE.pacingHpGrowthPct / 100) * progress;
  return Math.round(baseHp * playerCount * BALANCE.enemyHpPerPlayer * paceMult);
}

/** Dégâts ennemis : pacing par la progression uniquement (la menace scale par les actions, pas les stats). */
export function scaledEnemyDamage(base: number, progress: number): number {
  const paceMult = 1 + (BALANCE.pacingDamageGrowthPct / 100) * progress;
  return Math.round(base * paceMult);
}

/** Actions du boss par tour : ⌈N/3⌉ pour que « + de joueurs = + dur » reste vrai. */
export function bossActionsPerTurn(playerCount: number): number {
  return Math.ceil(playerCount / BALANCE.bossPlayersPerExtraAction);
}
