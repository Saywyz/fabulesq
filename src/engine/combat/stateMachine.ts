// Mise en place du combat et assignation des intentions ennemies (TECH_ARCHITECTURE.md §5).
import { BOSS_WAVE, ENEMIES, WAVES } from '../data/enemies';
import { nextInt } from '../rng';
import { scaledEnemyDamage, scaledEnemyHp } from '../scaling';
import type { Enemy, Intent, MapNode, Player } from '../types';
import { chooseTarget } from './targeting';

/** Construit la vague d'ennemis d'un nœud, PV scalés par N joueurs et niveau. */
export function buildEnemies(node: MapNode, playerCount: number, levelNumber: number): Enemy[] {
  const wave = node.type === 'boss' ? BOSS_WAVE : WAVES[node.index % WAVES.length]!;
  return wave.map((enemyType, i) => {
    const template = ENEMIES[enemyType]!;
    const hp = scaledEnemyHp(template.baseHp, playerCount, levelNumber);
    return {
      id: `e${i + 1}`,
      name: wave.filter((t) => t === enemyType).length > 1 ? `${template.name} ${i + 1}` : template.name,
      hp,
      maxHp: hp,
      block: 0,
      speed: template.speed,
      statuses: [],
      alive: true,
      enemyType: template.enemyType,
      aiProfile: template.aiProfile,
      intent: null,
    };
  });
}

export interface IntentsResult {
  enemies: Enemy[];
  rngState: number;
}

/**
 * Assigne l'intention télégraphiée de chaque ennemi vivant (aiProfile + PRNG, §4.3).
 * Une charge posée au tour précédent se libère en attaque au tour suivant.
 */
export function assignIntents(
  enemies: Enemy[],
  players: Player[],
  rngState: number,
  levelNumber: number,
): IntentsResult {
  let rng = rngState;

  const result = enemies.map((e): Enemy => {
    if (!e.alive) return { ...e, intent: null };
    const template = ENEMIES[e.enemyType]!;

    // Libération d'une charge télégraphiée
    if (e.intent?.kind === 'charge') {
      const value = e.intent.value ?? 0;
      const choice = chooseTarget(template.aiProfile, players, rng);
      rng = choice.state;
      const targetName = players.find((p) => p.id === choice.targetId)?.name ?? '?';
      return {
        ...e,
        intent: {
          kind: 'attack',
          value,
          targetId: choice.targetId ?? undefined,
          description: `déchaîne sa charge : ${value} → ${targetName}`,
        },
      };
    }

    // Tirage pondéré d'un move
    const total = template.moves.reduce((sum, m) => sum + m.weight, 0);
    const roll = nextInt(rng, 1, total);
    rng = roll.state;
    let acc = 0;
    let move = template.moves[0]!;
    for (const m of template.moves) {
      acc += m.weight;
      if (roll.value <= acc) {
        move = m;
        break;
      }
    }

    let intent: Intent;
    switch (move.kind) {
      case 'attack': {
        const choice = chooseTarget(template.aiProfile, players, rng);
        rng = choice.state;
        const value = scaledEnemyDamage(move.value ?? 0, levelNumber);
        const targetName = players.find((p) => p.id === choice.targetId)?.name ?? '?';
        intent = {
          kind: 'attack',
          value,
          targetId: choice.targetId ?? undefined,
          description: `${move.description} → ${targetName}`,
        };
        break;
      }
      case 'aoe': {
        intent = {
          kind: 'aoe',
          value: scaledEnemyDamage(move.value ?? 0, levelNumber),
          description: move.description,
        };
        break;
      }
      case 'charge': {
        intent = {
          kind: 'charge',
          value: scaledEnemyDamage(move.value ?? 0, levelNumber),
          chargeTurnsLeft: move.chargeTurns ?? 1,
          description: move.description,
        };
        break;
      }
      case 'debuff': {
        const choice = chooseTarget(template.aiProfile, players, rng);
        rng = choice.state;
        const targetName = players.find((p) => p.id === choice.targetId)?.name ?? '?';
        intent = {
          kind: 'debuff',
          targetId: choice.targetId ?? undefined,
          description: `${move.description} → ${targetName}`,
        };
        break;
      }
      default: {
        intent = { kind: move.kind, description: move.description };
        break;
      }
    }
    return { ...e, intent };
  });

  return { enemies: result, rngState: rng };
}
