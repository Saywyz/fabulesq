import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from './reducer';
import { getStacks } from './combat/status';
import type { GameState, Player, SkillId } from './types';

// ————— Helpers de scénario (bot déterministe, aucun aléa hors du PRNG de l'état) —————

function setup(n: number, seed = 42): GameState {
  let s = createInitialState({ seed, hostId: 'p1', code: 'TEST42' });
  for (let i = 1; i <= n; i++) {
    s = reduce(s, { t: 'join', player: { id: `p${i}`, name: `P${i}`, connectionId: `c${i}` } });
    s = reduce(s, { t: 'set_class', playerId: `p${i}`, classId: 'warrior' });
    s = reduce(s, { t: 'set_ready', playerId: `p${i}`, ready: true });
  }
  return reduce(s, { t: 'start_run' });
}

function enterCombat(s: GameState): GameState {
  return reduce(s, { t: 'enter_node', nodeIndex: s.run.currentNode });
}

function standing(s: GameState): Player[] {
  return s.players.filter((p) => p.alive && !p.downed);
}

function firstAliveEnemyId(s: GameState): string {
  return s.combat!.enemies.find((e) => e.alive)!.id;
}

type Pick_ = { skillId: SkillId; targetId?: string };

/** Tous les joueurs debout planifient puis confirment (résolution auto au dernier confirm). */
function playRound(s: GameState, pick?: (s: GameState, p: Player) => Pick_): GameState {
  for (const id of standing(s).map((p) => p.id)) {
    if (s.phase !== 'combat_planning') break;
    const p = s.players.find((x) => x.id === id)!;
    const choice: Pick_ = pick?.(s, p) ?? { skillId: 'strike', targetId: firstAliveEnemyId(s) };
    s = reduce(s, { t: 'plan_action', playerId: id, ...choice });
    s = reduce(s, { t: 'confirm_action', playerId: id });
  }
  return s;
}

/** Joue des rounds « frappe la première cible » jusqu'à la fin du combat. */
function botCombat(s: GameState): GameState {
  let guard = 0;
  while (s.phase === 'combat_planning' && guard++ < 200) s = playRound(s);
  expect(guard).toBeLessThan(200);
  return s;
}

/** Chaque joueur prend la première offre du draft. */
function botDraft(s: GameState): GameState {
  for (const p of s.players) {
    if (s.phase !== 'reward_draft') break;
    const offers = s.draftOffers[p.id] ?? [];
    if (offers.length > 0 && s.draftPicks[p.id] == null) {
      s = reduce(s, { t: 'draft_pick', playerId: p.id, skillId: offers[0]! });
    }
  }
  return s;
}

/** Simule une run complète jusqu'au game over. Retourne l'état final + télémetrie. */
function botRun(n: number, seed: number): { final: GameState; sawBoss: boolean } {
  let s = setup(n, seed);
  let sawBoss = false;
  let guard = 0;
  while (s.phase !== 'game_over' && guard++ < 3000) {
    if (s.phase === 'map') s = enterCombat(s);
    else if (s.phase === 'combat_planning') {
      if (s.combat!.enemies.some((e) => e.enemyType === 'ogre_boss')) sawBoss = true;
      s = playRound(s);
    } else if (s.phase === 'reward_draft') s = botDraft(s);
    else throw new Error(`phase inattendue : ${s.phase}`);
  }
  expect(guard).toBeLessThan(3000);
  return { final: s, sawBoss };
}

// ————— Lobby & lancement —————

describe('lobby et lancement de run', () => {
  it('join ajoute un joueur avec les stats et compétences de sa classe', () => {
    let s = createInitialState({ seed: 1, hostId: 'p1', code: 'ABC123' });
    s = reduce(s, { t: 'join', player: { id: 'p1', name: 'Alice', connectionId: 'c1' } });
    s = reduce(s, { t: 'set_class', playerId: 'p1', classId: 'warrior' });
    const p = s.players[0]!;
    expect(p.name).toBe('Alice');
    expect(p.hp).toBe(30);
    expect(p.maxEnergy).toBe(3);
    expect(p.skills).toEqual(['strike', 'taunt_shout']);
  });

  it('start_run est refusé tant que tout le monde n’est pas prêt', () => {
    let s = createInitialState({ seed: 1, hostId: 'p1', code: 'ABC123' });
    s = reduce(s, { t: 'join', player: { id: 'p1', name: 'A', connectionId: 'c1' } });
    const before = s;
    s = reduce(s, { t: 'start_run' });
    expect(s).toBe(before); // action invalide = état inchangé
  });

  it('start_run génère une carte linéaire : 4 combats puis un boss', () => {
    const s = setup(2);
    expect(s.phase).toBe('map');
    expect(s.run.nodes.map((n) => n.type)).toEqual(['combat', 'combat', 'combat', 'combat', 'boss']);
    expect(s.run.currentNode).toBe(0);
  });
});

// ————— Entrée en combat & intentions —————

describe('entrée en combat (machine à états §5)', () => {
  it('enter_node crée le combat, scale les PV ennemis par N joueurs et enchaîne vers la planification', () => {
    const s1 = enterCombat(setup(1));
    const s4 = enterCombat(setup(4));
    expect(s1.phase).toBe('combat_planning'); // combat_intent est enchaîné par le reducer (§5.1)
    const hp1 = s1.combat!.enemies[0]!.maxHp;
    const hp4 = s4.combat!.enemies[0]!.maxHp;
    expect(hp4).toBe(hp1 * 4);
  });

  it('chaque ennemi vivant a une intention télégraphiée', () => {
    const s = enterCombat(setup(2));
    for (const e of s.combat!.enemies) {
      expect(e.intent).not.toBeNull();
      expect(e.intent!.description.length).toBeGreaterThan(0);
    }
  });
});

// ————— Planification & résolution —————

describe('planification et résolution', () => {
  it('le dernier confirm déclenche la résolution : les ennemis encaissent et le round avance', () => {
    let s = enterCombat(setup(2));
    const hpBefore = s.combat!.enemies.reduce((sum, e) => sum + e.hp, 0);
    s = playRound(s);
    const hpAfter = s.combat!.enemies.reduce((sum, e) => sum + e.hp, 0);
    expect(hpAfter).toBeLessThan(hpBefore);
    if (s.phase === 'combat_planning') {
      expect(s.combat!.round).toBe(2);
      expect(s.players.every((p) => p.energy === p.maxEnergy)).toBe(true); // énergie rechargée
    }
  });

  it('une compétence trop chère pour l’énergie restante ne peut pas être planifiée', () => {
    let s = enterCombat(setup(1));
    s = { ...s, players: s.players.map((p) => ({ ...p, energy: 1, skills: [...p.skills, 'fireball'] })) };
    const before = s;
    s = reduce(s, { t: 'plan_action', playerId: 'p1', skillId: 'fireball', targetId: firstAliveEnemyId(s) });
    expect(s).toBe(before); // fireball coûte 2, énergie 1 → refusé
  });

  it('cible morte au moment de la résolution → action perdue, sans redirection (§5.1)', () => {
    let s = enterCombat(setup(2, 7));
    // On affaiblit le premier ennemi pour que p1 le tue, puis p2 vise le même : action perdue.
    const [e1, e2] = s.combat!.enemies;
    expect(e2).toBeDefined();
    s = {
      ...s,
      combat: { ...s.combat!, enemies: s.combat!.enemies.map((e) => (e.id === e1!.id ? { ...e, hp: 5 } : e)) },
    };
    const e2HpBefore = s.combat!.enemies.find((e) => e.id === e2!.id)!.hp;
    s = playRound(s, () => ({ skillId: 'strike', targetId: e1!.id }));
    const deadE1 = s.combat!.enemies.find((e) => e.id === e1!.id)!;
    const aliveE2 = s.combat!.enemies.find((e) => e.id === e2!.id)!;
    expect(deadE1.alive).toBe(false);
    expect(aliveE2.hp).toBe(e2HpBefore); // p2 n'a PAS redirigé sa frappe
    expect(s.combat!.log.some((l) => l.includes('perdue'))).toBe(true);
  });

  it('infliger des dégâts fait monter la menace du joueur', () => {
    let s = enterCombat(setup(2));
    s = playRound(s);
    const p1 = s.players.find((p) => p.id === 'p1')!;
    expect(p1.threat).toBeGreaterThan(0);
  });
});

// ————— Synergie inter-joueurs (critère d'acceptation) —————

describe('synergie inter-joueurs : marque + détonation', () => {
  it('p1 pose 3 marques, p2 les détone dans le même round : 4 dégâts × 3 marques', () => {
    let s = enterCombat(setup(2, 11));
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1' ? { ...p, skills: ['hunters_mark'] } : { ...p, skills: ['detonate_marks'] },
      ),
    };
    const targetId = firstAliveEnemyId(s);
    const hpBefore = s.combat!.enemies.find((e) => e.id === targetId)!.hp;
    s = playRound(s, (_st, p) => ({
      skillId: p.id === 'p1' ? 'hunters_mark' : 'detonate_marks',
      targetId,
    }));
    const target = s.combat!.enemies.find((e) => e.id === targetId)!;
    expect(hpBefore - target.hp).toBe(12); // 3 marques × 4 dégâts, rien d'autre
    expect(getStacks(target, 'mark')).toBe(0); // marques consommées
  });
});

// ————— Downed / revive (§8) —————

describe('joueurs à terre (GAME_DESIGN §8)', () => {
  function stateWithDownedP1(): GameState {
    let s = enterCombat(setup(2, 3));
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? { ...p, hp: 0, alive: false, downed: true, statuses: [{ kind: 'poison' as const, stacks: 2, duration: 3 }] }
          : { ...p, skills: ['helping_hand', 'strike'] },
      ),
      // Intentions figées sur un buff : les ennemis n'attaqueront pas (assertions déterministes).
      combat: {
        ...s.combat!,
        enemies: s.combat!.enemies.map((e) => ({
          ...e,
          intent: { kind: 'buff' as const, description: 'se renforce' },
        })),
      },
    };
    return s;
  }

  it('un joueur à terre est exclu de la planification et ses statuts ne tickent plus (§5.1)', () => {
    let s = stateWithDownedP1();
    const before = s;
    s = reduce(s, { t: 'plan_action', playerId: 'p1', skillId: 'strike', targetId: firstAliveEnemyId(s) });
    expect(s).toBe(before); // à terre → ne peut pas planifier
    // p2 joue seul : son confirm déclenche la résolution
    s = playRound(s, () => ({ skillId: 'strike', targetId: firstAliveEnemyId(s) }));
    const p1 = s.players.find((p) => p.id === 'p1')!;
    expect(p1.hp).toBe(0); // le poison n'a pas tické
    expect(getStacks(p1, 'poison')).toBe(2); // stacks gelés
  });

  it('un allié peut relever un joueur à terre (revive à 50 % PV max)', () => {
    let s = stateWithDownedP1();
    s = playRound(s, () => ({ skillId: 'helping_hand', targetId: 'p1' }));
    const p1 = s.players.find((p) => p.id === 'p1')!;
    expect(p1.downed).toBe(false);
    expect(p1.alive).toBe(true);
    expect(p1.hp).toBe(15); // 50 % de 30
  });
});

// ————— Draft (§6) —————

describe('draft de fin de combat', () => {
  function victoryState(): GameState {
    return botCombat(enterCombat(setup(2, 21)));
  }

  it('la victoire ouvre le draft : 3 offres par joueur, hors compétences possédées, 1 reroll', () => {
    const s = victoryState();
    expect(s.phase).toBe('reward_draft');
    for (const p of s.players) {
      const offers = s.draftOffers[p.id]!;
      expect(offers).toHaveLength(3);
      for (const id of offers) expect(p.skills).not.toContain(id);
      expect(s.rerollsLeft[p.id]).toBe(1);
    }
  });

  it('draft_pick ajoute la compétence au build ; quand tous ont choisi, retour à la carte', () => {
    let s = victoryState();
    const pick1 = s.draftOffers['p1']![0]!;
    s = reduce(s, { t: 'draft_pick', playerId: 'p1', skillId: pick1 });
    expect(s.players.find((p) => p.id === 'p1')!.skills).toContain(pick1);
    expect(s.phase).toBe('reward_draft'); // p2 n'a pas encore choisi
    s = reduce(s, { t: 'draft_pick', playerId: 'p2', skillId: s.draftOffers['p2']![0]! });
    expect(s.phase).toBe('map');
    expect(s.run.nodes[0]!.cleared).toBe(true);
    expect(s.run.currentNode).toBe(1);
  });

  it('le reroll régénère les offres et se consomme', () => {
    let s = victoryState();
    s = reduce(s, { t: 'draft_reroll', playerId: 'p1' });
    expect(s.rerollsLeft['p1']).toBe(0);
    expect(s.draftOffers['p1']).toHaveLength(3);
    const before = s;
    s = reduce(s, { t: 'draft_reroll', playerId: 'p1' });
    expect(s).toBe(before); // plus de reroll
  });
});

// ————— Combats complets à 1, 2 et 4 joueurs (critère d'acceptation) —————

describe('combat complet à N joueurs', () => {
  for (const n of [1, 2, 4]) {
    it(`à ${n} joueur(s) : le premier combat se joue jusqu'à la victoire`, () => {
      const s = botCombat(enterCombat(setup(n, 100 + n)));
      expect(s.phase).toBe('reward_draft');
      expect(s.combat!.enemies.every((e) => !e.alive)).toBe(true);
    });
  }
});

// ————— Run complète (critère d'acceptation) —————

describe('run complète sans UI ni réseau', () => {
  it('combats → boss → game over, à 4 joueurs', () => {
    const { final, sawBoss } = botRun(4, 2026);
    expect(final.phase).toBe('game_over');
    expect(sawBoss).toBe(true); // l'équipe a bien atteint (au moins) le boss
  });
});

// ————— Déterminisme & invariants du réducteur —————

describe('déterminisme et invariants', () => {
  it('même seed + mêmes actions ⇒ états finaux identiques', () => {
    const a = botRun(2, 555).final;
    const b = botRun(2, 555).final;
    expect(a).toEqual(b);
  });

  it('deux seeds différents divergent', () => {
    const a = botRun(2, 1).final;
    const b = botRun(2, 2).final;
    expect(a).not.toEqual(b);
  });

  it('stateId croît strictement à chaque action appliquée', () => {
    let s = createInitialState({ seed: 1, hostId: 'p1', code: 'X' });
    expect(s.stateId).toBe(0);
    s = reduce(s, { t: 'join', player: { id: 'p1', name: 'A', connectionId: 'c1' } });
    expect(s.stateId).toBe(1);
    s = reduce(s, { t: 'set_ready', playerId: 'p1', ready: true });
    expect(s.stateId).toBe(2);
  });

  it("reduce ne mute jamais l'état d'entrée", () => {
    const s = enterCombat(setup(2));
    const snapshot = JSON.stringify(s);
    playRound(s);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
