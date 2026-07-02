// Réducteur pur : reduce(state, action) => newState. Seule porte d'entrée des transitions.
// Les enchaînements déterministes (intentions, résolution, fin de draft) sont chaînés
// en interne par le reducer (décision §5.1 de TECH_ARCHITECTURE.md).
import { resolveRound } from './combat/resolution';
import { assignIntents, buildEnemies } from './combat/stateMachine';
import { generateOffers } from './draft';
import { BALANCE } from './data/balance';
import { CLASSES, DEFAULT_CLASS_ID } from './data/classes';
import { DRAFT_POOL, SKILLS } from './data/skills';
import { createRngState } from './rng';
import type { Action, GameState, MapNode, Player } from './types';

export interface InitOptions {
  seed: number;
  hostId: string;
  code: string;
}

export function createInitialState(opts: InitOptions): GameState {
  return {
    schemaVersion: 1,
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
  };
}

/** Carte linéaire MVP : N combats puis un boss (GAME_DESIGN.md §11). */
function generateNodes(): MapNode[] {
  const nodes: MapNode[] = [];
  for (let i = 0; i < BALANCE.combatsBeforeBoss; i++) {
    nodes.push({ index: i, type: 'combat', cleared: false });
  }
  nodes.push({ index: BALANCE.combatsBeforeBoss, type: 'boss', cleared: false });
  return nodes;
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
        run: { ...state.run, nodes: generateNodes(), currentNode: 0, levelNumber: 1 },
      };
    }

    case 'enter_node': {
      if (state.phase !== 'map') return state;
      if (action.nodeIndex !== state.run.currentNode) return state;
      const node = state.run.nodes[action.nodeIndex];
      if (!node || node.cleared) return state;
      if (node.type !== 'combat' && node.type !== 'boss') return state; // autres types : phases futures

      // Nouveau combat : statuts et menace remis à zéro, énergie pleine.
      const players = state.players.map((p) => ({
        ...p,
        statuses: [],
        block: 0,
        threat: 0,
        energy: p.maxEnergy,
      }));
      const enemies = buildEnemies(node, players.length, state.run.levelNumber);
      // combat_intent est enchaîné immédiatement : intentions assignées puis planification (§5.1).
      const intents = assignIntents(enemies, players, state.rngState, state.run.levelNumber);
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
          log: [`Niveau ${state.run.levelNumber} — ${node.type === 'boss' ? 'BOSS' : `combat ${node.index + 1}`} !`],
        },
      };
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
      const next: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, skills: [...p.skills, action.skillId] } : p,
        ),
        draftPicks: { ...state.draftPicks, [action.playerId]: action.skillId },
      };
      return allDraftDone(next) ? advanceAfterDraft(next) : next;
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

    case 'leave': {
      if (state.phase !== 'lobby') return state; // en partie : géré en Phase 3 (réseau)
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      return { ...state, players: state.players.filter((p) => p.id !== action.playerId) };
    }

    default:
      return state;
  }
}

function allDraftDone(state: GameState): boolean {
  return state.players.every(
    (p) => state.draftPicks[p.id] != null || (state.draftOffers[p.id] ?? []).length === 0,
  );
}

/** Fin de draft : nœud nettoyé, avance sur la carte ; après un boss, niveau suivant. */
function advanceAfterDraft(state: GameState): GameState {
  const clearedIndex = state.run.currentNode;
  const nodes = state.run.nodes.map((n) => (n.index === clearedIndex ? { ...n, cleared: true } : n));
  const clearedNode = nodes[clearedIndex]!;

  const run =
    clearedNode.type === 'boss'
      ? { ...state.run, levelNumber: state.run.levelNumber + 1, nodes: generateNodes(), currentNode: 0 }
      : { ...state.run, nodes, currentNode: clearedIndex + 1 };

  return {
    ...state,
    phase: 'map',
    run,
    combat: null,
    draftOffers: {},
    draftPicks: {},
    rerollsLeft: {},
  };
}
