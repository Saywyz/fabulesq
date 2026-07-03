import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from './reducer';
import { getStacks } from './combat/status';
import { BALANCE } from './data/balance';
import { ENEMIES } from './data/enemies';
import type { GameState, LengthBand, Player, SkillId } from './types';

// ————— Helpers de scénario (bot déterministe, aucun aléa hors du PRNG de l'état) —————

/** Lobby complet → prépa → départ : l'état rendu est sur la carte, expédition générée. */
function setup(n: number, seed = 42, band?: LengthBand): GameState {
  let s = createInitialState({ seed, hostId: 'p1', code: 'TEST42' });
  for (let i = 1; i <= n; i++) {
    s = reduce(s, { t: 'join', player: { id: `p${i}`, name: `P${i}`, connectionId: `c${i}` } });
    s = reduce(s, { t: 'set_class', playerId: `p${i}`, classId: 'warrior' });
    s = reduce(s, { t: 'set_ready', playerId: `p${i}`, ready: true });
  }
  s = reduce(s, { t: 'start_run' }); // → prep
  if (band) s = reduce(s, { t: 'set_length', band });
  for (let i = 1; i <= n; i++) {
    s = reduce(s, { t: 'prep_ready', playerId: `p${i}`, ready: true });
  }
  return s; // le dernier prep_ready a généré l'expédition → phase 'map'
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

function defaultPick(s: GameState, _p: Player): Pick_ {
  return { skillId: 'strike', targetId: firstAliveEnemyId(s) };
}

/** Tous les joueurs debout planifient puis confirment (résolution auto au dernier confirm). */
function playRound(s: GameState, pick?: (s: GameState, p: Player) => Pick_): GameState {
  for (const id of standing(s).map((p) => p.id)) {
    if (s.phase !== 'combat_planning') break;
    const p = s.players.find((x) => x.id === id)!;
    const choice: Pick_ = pick?.(s, p) ?? defaultPick(s, p);
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

/** Simule une expédition complète jusqu'à victoire ou défaite. */
function botRun(n: number, seed: number, band: LengthBand = 'medium'): GameState {
  let s = setup(n, seed, band);
  let guard = 0;
  while (s.phase !== 'game_over' && s.phase !== 'victory' && guard++ < 3000) {
    if (s.phase === 'map') s = enterCombat(s);
    else if (s.phase === 'combat_planning') s = playRound(s);
    else if (s.phase === 'node_event') s = reduce(s, { t: 'event_choice', playerId: 'p1', optionIndex: 0 });
    else if (s.phase === 'node_rest') {
      for (const p of s.players) s = reduce(s, { t: 'rest_choice', playerId: p.id, choice: 'heal' });
    } else throw new Error(`phase inattendue : ${s.phase}`);
  }
  expect(guard).toBeLessThan(3000);
  return s;
}

/** Saute au nœud d'index donné (les précédents sont marqués nettoyés). */
function jumpTo(s: GameState, index: number): GameState {
  return {
    ...s,
    run: {
      ...s.run,
      currentNode: index,
      nodes: s.run.nodes.map((n) => (n.index < index ? { ...n, cleared: true } : n)),
    },
  };
}

// ————— Lobby & lancement —————

describe('lobby et lancement', () => {
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

  it('start_run mène à la prépa (pas directement à la carte) et remet les « prêt » à zéro', () => {
    let s = createInitialState({ seed: 1, hostId: 'p1', code: 'ABC123' });
    s = reduce(s, { t: 'join', player: { id: 'p1', name: 'A', connectionId: 'c1' } });
    s = reduce(s, { t: 'set_ready', playerId: 'p1', ready: true });
    s = reduce(s, { t: 'start_run' });
    expect(s.phase).toBe('prep');
    expect(s.players.every((p) => !p.ready)).toBe(true);
    expect(s.run.nodes).toHaveLength(0); // l'expédition n'est pas encore générée
  });
});

// ————— Prépa d'expédition (Phase 7) —————

describe('préparation d’expédition', () => {
  function prepState(n = 2, seed = 5): GameState {
    let s = createInitialState({ seed, hostId: 'p1', code: 'PREP01' });
    for (let i = 1; i <= n; i++) {
      s = reduce(s, { t: 'join', player: { id: `p${i}`, name: `P${i}`, connectionId: `c${i}` } });
      s = reduce(s, { t: 'set_ready', playerId: `p${i}`, ready: true });
    }
    return reduce(s, { t: 'start_run' });
  }

  it('set_length change la bande d’équipe, uniquement en prépa', () => {
    let s = prepState();
    s = reduce(s, { t: 'set_length', band: 'long' });
    expect(s.run.band).toBe('long');
    const initial = createInitialState({ seed: 1, hostId: 'p1', code: 'X' });
    expect(reduce(initial, { t: 'set_length', band: 'long' })).toBe(initial); // hors prépa : refusé
  });

  it('le dernier prep_ready génère l’expédition et donne le départ', () => {
    let s = prepState();
    s = reduce(s, { t: 'prep_ready', playerId: 'p1', ready: true });
    expect(s.phase).toBe('prep'); // p2 n'est pas prêt
    s = reduce(s, { t: 'prep_ready', playerId: 'p2', ready: true });
    expect(s.phase).toBe('map');
    expect(s.run.nodes.length).toBeGreaterThan(0);
    expect(s.run.currentNode).toBe(0);
    expect(s.run.nodes[s.run.nodes.length - 1]!.type).toBe('boss');
  });

  it('la bande choisie pilote la longueur générée', () => {
    for (const band of ['short', 'long'] as const) {
      let s = prepState(1, 9);
      s = reduce(s, { t: 'set_length', band });
      s = reduce(s, { t: 'prep_ready', playerId: 'p1', ready: true });
      const { min, max } = BALANCE.expeditionLength[band];
      expect(s.run.nodes.length).toBeGreaterThanOrEqual(min);
      expect(s.run.nodes.length).toBeLessThanOrEqual(max);
    }
  });

  it('on peut changer de classe en prépa tant qu’on n’est pas prêt', () => {
    let s = prepState();
    s = reduce(s, { t: 'set_class', playerId: 'p1', classId: 'warrior' });
    expect(s.players[0]!.classId).toBe('warrior');
    s = reduce(s, { t: 'prep_ready', playerId: 'p1', ready: true });
    const locked = reduce(s, { t: 'set_class', playerId: 'p1', classId: 'warrior' });
    expect(locked).toBe(s); // prêt = verrouillé
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

  it('le pacing durcit les ennemis en fin de route (même type, plus de PV)', () => {
    const s = setup(2, 13);
    const early = enterCombat(s);
    const lastCombatIndex = s.run.nodes.filter((n) => n.type === 'combat').pop()!.index;
    const late = enterCombat(jumpTo(s, lastCombatIndex));
    const avgHp = (st: GameState) =>
      st.combat!.enemies.reduce((sum, e) => sum + e.maxHp, 0) / st.combat!.enemies.length;
    expect(avgHp(late)).toBeGreaterThan(avgHp(early));
  });
});

// ————— Planification & résolution —————

describe('planification et résolution', () => {
  it('le dernier confirm déclenche la résolution : les ennemis encaissent et le round avance', () => {
    let s = enterCombat(setup(2));
    const hpBefore = s.combat!.enemies.reduce((sum, e) => sum + e.hp, 0);
    s = playRound(s);
    if (s.phase === 'combat_planning') {
      const hpAfter = s.combat!.enemies.reduce((sum, e) => sum + e.hp, 0);
      expect(hpAfter).toBeLessThan(hpBefore);
      expect(s.combat!.round).toBe(2);
      expect(s.players.every((p) => p.energy === p.maxEnergy)).toBe(true); // énergie rechargée
    } else {
      expect(s.phase).toBe('map'); // combat gagné d'un coup
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

// ————— Fins de combat : avance, victoire, défaite (critères Phase 7) —————

describe('fins de combat (Phase 7)', () => {
  it('un combat ordinaire gagné ramène à la carte : nœud nettoyé, on avance (plus de draft)', () => {
    const s = botCombat(enterCombat(setup(2, 21)));
    expect(s.phase).toBe('map');
    expect(s.combat).toBeNull();
    expect(s.run.nodes[0]!.cleared).toBe(true);
    expect(s.run.currentNode).toBe(1);
    expect(s.players.every((p) => !p.downed)).toBe(true); // les downed se relèvent en fin de combat
  });

  it('boss final vaincu ⇒ phase victory', () => {
    let s = setup(2, 21);
    s = enterCombat(jumpTo(s, s.run.nodes.length - 1));
    expect(s.combat!.enemies.some((e) => ENEMIES[e.enemyType]?.isBoss)).toBe(true);
    // On abrège l'exécution : le boss est à 1 PV, la première frappe le tue.
    s = { ...s, combat: { ...s.combat!, enemies: s.combat!.enemies.map((e) => ({ ...e, hp: 1 })) } };
    s = playRound(s, () => ({ skillId: 'strike', targetId: firstAliveEnemyId(s) }));
    expect(s.phase).toBe('victory');
    expect(s.run.nodes[s.run.nodes.length - 1]!.cleared).toBe(true);
    expect(s.combat!.log.some((l) => l.includes('accomplie'))).toBe(true);
  });

  it('tous à terre ⇒ defeat (game_over)', () => {
    let s = enterCombat(setup(2, 3));
    s = {
      ...s,
      players: s.players.map((p) => ({ ...p, hp: 1 })),
      combat: {
        ...s.combat!,
        enemies: s.combat!.enemies.map((e) => ({
          ...e,
          intent: { kind: 'aoe' as const, value: 99, description: 'déluge' },
        })),
      },
    };
    s = playRound(s);
    expect(s.phase).toBe('game_over');
    expect(s.players.every((p) => !p.alive || p.downed)).toBe(true);
  });
});

// ————— Run complète (critère d'acceptation) —————

describe('expédition complète sans UI ni réseau', () => {
  it('une expédition se joue de bout en bout jusqu’à victoire ou défaite, à 4 joueurs', () => {
    const final = botRun(4, 1);
    expect(['victory', 'game_over']).toContain(final.phase);
  });
});

// ————— Déterminisme & invariants du réducteur —————

describe('déterminisme et invariants', () => {
  it('même seed + mêmes actions ⇒ états finaux identiques', () => {
    const a = botRun(2, 555);
    const b = botRun(2, 555);
    expect(a).toEqual(b);
  });

  it('deux seeds différents divergent', () => {
    const a = botRun(2, 1);
    const b = botRun(2, 2);
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
