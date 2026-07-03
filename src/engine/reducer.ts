// Réducteur pur : reduce(state, action) => newState. Seule porte d'entrée des transitions.
// Les enchaînements déterministes (intentions, résolution, fin de draft) sont chaînés
// en interne par le reducer (décision §5.1 de TECH_ARCHITECTURE.md).
import { resolveRound } from './combat/resolution';
import { assignIntents, buildEnemies } from './combat/stateMachine';
import { generateOffers } from './draft';
import { BALANCE } from './data/balance';
import { CLASSES, DEFAULT_CLASS_ID } from './data/classes';
import { EVENTS, type EventEffect } from './data/events';
import { DRAFT_POOL, SKILLS } from './data/skills';
import { createRngState, next, nextInt } from './rng';
import type { Action, GameState, MapNode, Player } from './types';

export interface InitOptions {
  seed: number;
  hostId: string;
  code: string;
}

export function createInitialState(opts: InitOptions): GameState {
  return {
    schemaVersion: 3,
    stateId: 0,
    hostId: opts.hostId,
    code: opts.code,
    phase: 'lobby',
    rngState: createRngState(opts.seed),
    players: [],
    run: { seed: opts.seed, nodes: [], currentNode: 0, levelNumber: 1 },
    combat: null,
    draftOffers: {},
    draftPicks: {},
    rerollsLeft: {},
    event: null,
    restDone: {},
    shopOffers: {},
    shopDone: {},
  };
}

/** Carte d'un niveau (Phase 4) : le slot « spécial » tourne selon le niveau. */
function generateNodes(levelNumber: number): MapNode[] {
  return BALANCE.nodeLayout.map((slot, index) => ({
    index,
    type:
      slot === 'special'
        ? BALANCE.specialRotation[(levelNumber - 1) % BALANCE.specialRotation.length]!
        : slot,
    cleared: false,
  }));
}

function withClass(p: Player, classId: string): Player {
  const cls = CLASSES[classId];
  if (!cls) return p;
  return {
    ...p,
    classId,
    hp: cls.maxHp,
    maxHp: cls.maxHp,
    speed: cls.speed,
    energy: cls.maxEnergy,
    maxEnergy: cls.maxEnergy,
    skills: [...cls.startingSkills],
  };
}

function standing(players: Player[]): Player[] {
  return players.filter((p) => p.alive && !p.downed);
}

export function reduce(state: GameState, action: Action): GameState {
  const next = apply(state, action);
  if (next === state) return state; // action invalide ou sans effet
  return { ...next, stateId: state.stateId + 1 };
}

function apply(state: GameState, action: Action): GameState {
  switch (action.t) {
    case 'join': {
      if (state.phase !== 'lobby') return state;
      if (state.players.some((p) => p.id === action.player.id)) return state;
      const base: Player = {
        id: action.player.id,
        name: action.player.name,
        connectionId: action.player.connectionId,
        hp: 1,
        maxHp: 1,
        block: 0,
        speed: 1,
        statuses: [],
        alive: true,
        appearance: { skinTone: 'default', hairStyle: 'default', hairColor: 'default', outfitStyle: 'default', outfitColor: 'default' },
        classId: '',
        skills: [],
        energy: 0,
        maxEnergy: 0,
        threat: 0,
        gold: 0,
        ready: false,
        downed: false,
      };
      return { ...state, players: [...state.players, withClass(base, DEFAULT_CLASS_ID)] };
    }

    case 'set_appearance': {
      if (state.phase !== 'lobby') return state;
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, appearance: action.appearance } : p,
        ),
      };
    }

    case 'set_class': {
      if (state.phase !== 'lobby') return state;
      if (!CLASSES[action.classId]) return state;
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.playerId ? withClass(p, action.classId) : p)),
      };
    }

    case 'set_ready': {
      if (state.phase !== 'lobby') return state;
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.playerId ? { ...p, ready: action.ready } : p)),
      };
    }

    case 'start_run': {
      if (state.phase !== 'lobby') return state;
      if (state.players.length === 0 || !state.players.every((p) => p.ready)) return state;
      return {
        ...state,
        phase: 'map',
        run: { ...state.run, nodes: generateNodes(1), currentNode: 0, levelNumber: 1 },
      };
    }

    case 'enter_node': {
      if (state.phase !== 'map') return state;
      if (action.nodeIndex !== state.run.currentNode) return state;
      const node = state.run.nodes[action.nodeIndex];
      if (!node || node.cleared) return state;

      if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
        // Nouveau combat : statuts et menace remis à zéro, énergie pleine.
        const players = state.players.map((p) => ({
          ...p,
          statuses: [],
          block: 0,
          threat: 0,
          energy: p.maxEnergy,
        }));
        const enemies = buildEnemies(node, players.length, state.run.levelNumber);
        const damageMult = node.type === 'elite' ? BALANCE.eliteDamageMult : 1;
        // combat_intent est enchaîné immédiatement : intentions puis planification (§5.1).
        const intents = assignIntents(enemies, players, state.rngState, state.run.levelNumber, damageMult);
        const label =
          node.type === 'boss' ? 'BOSS' : node.type === 'elite' ? 'ÉLITE' : `combat ${node.index + 1}`;
        return {
          ...state,
          players,
          rngState: intents.rngState,
          phase: 'combat_planning',
          combat: {
            round: 1,
            enemies: intents.enemies,
            planned: {},
            initiativeOrder: [],
            log: [`Niveau ${state.run.levelNumber} — ${label} !`],
            cheered: {},
          },
        };
      }

      if (node.type === 'event') {
        const roll = nextInt(state.rngState, 0, EVENTS.length - 1);
        return {
          ...state,
          rngState: roll.state,
          phase: 'node_event',
          event: { id: EVENTS[roll.value]!.id },
        };
      }

      if (node.type === 'rest') {
        return {
          ...state,
          phase: 'node_rest',
          restDone: Object.fromEntries(state.players.map((p) => [p.id, false])),
        };
      }

      if (node.type === 'shop') {
        let rng = state.rngState;
        const shopOffers: GameState['shopOffers'] = {};
        for (const p of state.players) {
          const g = generateOffers(DRAFT_POOL, BALANCE.shopOfferCount, rng, p.skills);
          rng = g.state;
          shopOffers[p.id] = g.offers;
        }
        return {
          ...state,
          rngState: rng,
          phase: 'node_shop',
          shopOffers,
          shopDone: Object.fromEntries(state.players.map((p) => [p.id, false])),
        };
      }

      return state;
    }

    case 'plan_action': {
      if (state.phase !== 'combat_planning' || !state.combat) return state;
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || !player.alive || player.downed) return state;
      if (!player.skills.includes(action.skillId)) return state;
      const skill = SKILLS[action.skillId];
      if (!skill || skill.cost > player.energy) return state;
      return {
        ...state,
        combat: {
          ...state.combat,
          planned: {
            ...state.combat.planned,
            [action.playerId]: {
              playerId: action.playerId,
              skillId: action.skillId,
              targetId: action.targetId,
              confirmed: false,
            },
          },
        },
      };
    }

    case 'confirm_action': {
      if (state.phase !== 'combat_planning' || !state.combat) return state;
      const planned = state.combat.planned[action.playerId];
      if (!planned || planned.confirmed) return state;
      const confirmed: GameState = {
        ...state,
        combat: {
          ...state.combat,
          planned: { ...state.combat.planned, [action.playerId]: { ...planned, confirmed: true } },
        },
      };
      // Dernier confirm des joueurs debout → résolution immédiate (§5.1).
      const everyoneConfirmed = standing(confirmed.players).every(
        (p) => confirmed.combat!.planned[p.id]?.confirmed,
      );
      return everyoneConfirmed ? resolveRound(confirmed) : confirmed;
    }

    case 'resolve_round': {
      if (state.phase !== 'combat_planning' || !state.combat) return state;
      const everyoneConfirmed = standing(state.players).every(
        (p) => state.combat!.planned[p.id]?.confirmed,
      );
      return everyoneConfirmed ? resolveRound(state) : state;
    }

    case 'draft_pick': {
      if (state.phase !== 'reward_draft') return state;
      if (state.draftPicks[action.playerId] != null) return state;
      const offers = state.draftOffers[action.playerId] ?? [];
      if (!offers.includes(action.skillId)) return state;
      const picked: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, skills: [...p.skills, action.skillId] } : p,
        ),
        draftPicks: { ...state.draftPicks, [action.playerId]: action.skillId },
      };
      return allDraftDone(picked) ? advanceNode(picked) : picked;
    }

    case 'draft_reroll': {
      if (state.phase !== 'reward_draft') return state;
      if ((state.rerollsLeft[action.playerId] ?? 0) <= 0) return state;
      if (state.draftPicks[action.playerId] != null) return state;
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;
      const g = generateOffers(DRAFT_POOL, BALANCE.draftOfferCount, state.rngState, player.skills);
      return {
        ...state,
        rngState: g.state,
        draftOffers: { ...state.draftOffers, [action.playerId]: g.offers },
        rerollsLeft: { ...state.rerollsLeft, [action.playerId]: (state.rerollsLeft[action.playerId] ?? 0) - 1 },
      };
    }

    case 'event_choice': {
      if (state.phase !== 'node_event' || !state.event) return state;
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      const template = EVENTS.find((e) => e.id === state.event!.id);
      const option = template?.options[action.optionIndex];
      if (!option) return state;
      const applied = applyEventEffects(state, option.effects);
      return advanceNode({ ...state, players: applied.players, rngState: applied.rngState });
    }

    case 'rest_choice': {
      if (state.phase !== 'node_rest') return state;
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || state.restDone[action.playerId]) return state;

      let players = state.players;
      if (action.choice === 'heal') {
        const amount = Math.floor((player.maxHp * BALANCE.restHealPct) / 100);
        players = players.map((p) =>
          p.id === action.playerId ? { ...p, hp: Math.min(p.maxHp, p.hp + amount) } : p,
        );
      } else {
        // Oublier une compétence (forge) — on garde toujours au moins une compétence.
        if (!action.skillId || !player.skills.includes(action.skillId) || player.skills.length <= 1) {
          return state;
        }
        players = players.map((p) =>
          p.id === action.playerId ? { ...p, skills: p.skills.filter((s) => s !== action.skillId) } : p,
        );
      }
      const rested: GameState = {
        ...state,
        players,
        restDone: { ...state.restDone, [action.playerId]: true },
      };
      return state.players.every((p) => rested.restDone[p.id]) ? advanceNode(rested) : rested;
    }

    case 'shop_buy': {
      if (state.phase !== 'node_shop') return state;
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || state.shopDone[action.playerId]) return state;
      if (!(state.shopOffers[action.playerId] ?? []).includes(action.skillId)) return state;
      const skill = SKILLS[action.skillId];
      if (!skill) return state;
      const price = BALANCE.shopPrices[skill.rarity];
      if (player.gold < price) return state;
      const bought: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, gold: p.gold - price, skills: [...p.skills, action.skillId] }
            : p,
        ),
        shopDone: { ...state.shopDone, [action.playerId]: true },
      };
      return state.players.every((p) => bought.shopDone[p.id]) ? advanceNode(bought) : bought;
    }

    case 'cheer': {
      // Un joueur à terre reste dans la partie : il encourage un allié debout (§8).
      if (state.phase !== 'combat_planning' || !state.combat) return state;
      const cheerer = state.players.find((p) => p.id === action.playerId);
      if (!cheerer || !cheerer.downed) return state;
      if (state.combat.cheered[action.playerId]) return state; // une fois par round
      const target = state.players.find((p) => p.id === action.targetId);
      if (!target || !target.alive || target.downed) return state;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === target.id ? { ...p, block: p.block + BALANCE.cheerBlock } : p,
        ),
        combat: {
          ...state.combat,
          cheered: { ...state.combat.cheered, [action.playerId]: true },
          log: [
            ...state.combat.log,
            `${cheerer.name}, à terre, encourage ${target.name} : +${BALANCE.cheerBlock} bouclier !`,
          ],
        },
      };
    }

    case 'shop_skip': {
      if (state.phase !== 'node_shop') return state;
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      if (state.shopDone[action.playerId]) return state;
      const skipped: GameState = {
        ...state,
        shopDone: { ...state.shopDone, [action.playerId]: true },
      };
      return state.players.every((p) => skipped.shopDone[p.id]) ? advanceNode(skipped) : skipped;
    }

    case 'leave': {
      if (state.phase !== 'lobby') return state; // en partie : géré en Phase 3 (réseau)
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      return { ...state, players: state.players.filter((p) => p.id !== action.playerId) };
    }

    default:
      return state;
  }
}

/** Applique les effets d'une option d'événement ; le gamble consomme le PRNG seedé. */
function applyEventEffects(
  state: GameState,
  effects: EventEffect[],
): { players: Player[]; rngState: number } {
  let players = state.players;
  let rng = state.rngState;
  const apply = (eff: EventEffect): void => {
    switch (eff.type) {
      case 'heal_pct_all':
        players = players.map((p) => ({
          ...p,
          hp: Math.min(p.maxHp, p.hp + Math.floor((p.maxHp * eff.pct) / 100)),
        }));
        break;
      case 'hurt_pct_all':
        // Hors combat : on blesse mais on ne met jamais à terre.
        players = players.map((p) => ({
          ...p,
          hp: Math.max(1, p.hp - Math.floor((p.maxHp * eff.pct) / 100)),
        }));
        break;
      case 'gold_all':
        players = players.map((p) => ({ ...p, gold: p.gold + eff.amount }));
        break;
      case 'gamble': {
        const roll = next(rng);
        rng = roll.state;
        (roll.value < 0.5 ? eff.win : eff.lose).forEach(apply);
        break;
      }
    }
  };
  effects.forEach(apply);
  return { players, rngState: rng };
}

function allDraftDone(state: GameState): boolean {
  return state.players.every(
    (p) => state.draftPicks[p.id] != null || (state.draftOffers[p.id] ?? []).length === 0,
  );
}

/** Nœud terminé : marqué, avance sur la carte ; après un boss, niveau suivant. */
function advanceNode(state: GameState): GameState {
  const clearedIndex = state.run.currentNode;
  const nodes = state.run.nodes.map((n) => (n.index === clearedIndex ? { ...n, cleared: true } : n));
  const clearedNode = nodes[clearedIndex]!;

  const run =
    clearedNode.type === 'boss'
      ? {
          ...state.run,
          levelNumber: state.run.levelNumber + 1,
          nodes: generateNodes(state.run.levelNumber + 1),
          currentNode: 0,
        }
      : { ...state.run, nodes, currentNode: clearedIndex + 1 };

  return {
    ...state,
    phase: 'map',
    run,
    combat: null,
    draftOffers: {},
    draftPicks: {},
    rerollsLeft: {},
    event: null,
    restDone: {},
    shopOffers: {},
    shopDone: {},
  };
}
