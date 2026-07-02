// Gestion des statuts : application, dégâts modifiés, tick de fin de tour (GAME_DESIGN.md §5).
// Fonctions pures : ne mutent jamais les combattants reçus.
import { BALANCE } from '../data/balance';
import type { Combatant, EntityId, StatusKind } from '../types';

export function getStacks(c: Combatant, kind: StatusKind): number {
  return c.statuses.filter((s) => s.kind === kind).reduce((sum, s) => sum + s.stacks, 0);
}

/** Ajoute un statut ; les stacks d'un même type fusionnent, la durée la plus longue gagne. */
export function applyStatus<T extends Combatant>(
  c: T,
  kind: StatusKind,
  stacks: number,
  duration: number,
  sourceId?: EntityId,
): T {
  const existing = c.statuses.find((s) => s.kind === kind);
  if (existing) {
    const mergedDuration =
      existing.duration === -1 || duration === -1 ? -1 : Math.max(existing.duration, duration);
    return {
      ...c,
      statuses: c.statuses.map((s) =>
        s.kind === kind ? { ...s, stacks: s.stacks + stacks, duration: mergedDuration } : s,
      ),
    };
  }
  return { ...c, statuses: [...c.statuses, { kind, stacks, duration, sourceId }] };
}

export function removeStatus<T extends Combatant>(c: T, kind: StatusKind): T {
  return { ...c, statuses: c.statuses.filter((s) => s.kind !== kind) };
}

export interface DamageResult<T extends Combatant> {
  target: T;
  dealt: number; // PV réellement perdus (sert au calcul de menace)
}

/**
 * Inflige des dégâts en appliquant les modificateurs :
 * force (+1/stack) et faiblesse (−25 %) côté attaquant, vulnérable (+50 %) côté cible,
 * puis absorption par le block avant les PV.
 */
export function dealDamage<T extends Combatant>(
  attacker: Combatant | null,
  target: T,
  base: number,
): DamageResult<T> {
  let dmg = base;
  if (attacker) {
    dmg += getStacks(attacker, 'strength') * BALANCE.strengthDamagePerStack;
    if (getStacks(attacker, 'weak') > 0) {
      dmg = Math.floor((dmg * (100 - BALANCE.weakReductionPct)) / 100);
    }
  }
  if (getStacks(target, 'vulnerable') > 0) {
    dmg = Math.floor((dmg * (100 + BALANCE.vulnerableBonusPct)) / 100);
  }
  dmg = Math.max(0, dmg);

  const absorbed = Math.min(target.block, dmg);
  const hpLoss = Math.min(target.hp, dmg - absorbed);
  const hp = target.hp - hpLoss;
  return {
    target: { ...target, block: target.block - absorbed, hp, alive: hp > 0 },
    dealt: hpLoss,
  };
}

export function heal<T extends Combatant>(c: T, amount: number): T {
  return { ...c, hp: Math.min(c.maxHp, c.hp + amount) };
}

export interface TickResult<T extends Combatant> {
  combatant: T;
  log: string[];
}

/**
 * Fin de tour : brûlure (dégâts = stacks, puis −1 stack), poison (dégâts = stacks,
 * expire par durée), régénération, décompte des durées finies, expiration du block.
 */
export function tickEndOfTurn<T extends Combatant>(c: T): TickResult<T> {
  if (!c.alive) return { combatant: c, log: [] };

  const log: string[] = [];
  let hp = c.hp;

  const burn = getStacks(c, 'burn');
  if (burn > 0) {
    hp -= burn;
    log.push(`${c.name} brûle : ${burn} dégâts.`);
  }
  const poison = getStacks(c, 'poison');
  if (poison > 0) {
    hp -= poison;
    log.push(`${c.name} est empoisonné : ${poison} dégâts.`);
  }
  const regen = getStacks(c, 'regen');
  if (regen > 0) {
    hp = Math.min(c.maxHp, hp + regen);
    log.push(`${c.name} régénère ${regen} PV.`);
  }
  hp = Math.max(0, hp);

  const statuses = c.statuses.flatMap((s) => {
    if (s.kind === 'burn') {
      const stacks = s.stacks - 1; // la brûlure se consume
      return stacks > 0 ? [{ ...s, stacks }] : [];
    }
    if (s.duration > 0) {
      const duration = s.duration - 1;
      return duration > 0 ? [{ ...s, duration }] : [];
    }
    return [{ ...s }]; // durée -1 : jusqu'à la fin du combat
  });

  return { combatant: { ...c, hp, block: 0, statuses, alive: hp > 0 }, log };
}
