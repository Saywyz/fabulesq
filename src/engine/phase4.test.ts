// Tests Phase 4 : contenu (pool, synergies), nœuds élite/événement/repos/boutique,
// or, invocation, soigneur ennemi, scaling du boss, divergence des runs par les picks.
import { describe, expect, it } from 'vitest';
import { getStacks } from './combat/status';
import { BALANCE } from './data/balance';
import { EVENTS } from './data/events';
import { DRAFT_POOL, SKILLS } from './data/skills';
import { createInitialState, reduce } from './reducer';
import type { GameState, Player, SkillId } from './types';

// ————— Helpers —————

function setup(n: number, seed = 42): GameState {
  let s = createInitialState({ seed, hostId: 'p1', code: 'PHASE4' });
  for (let i = 1; i <= n; i++) {
    s = reduce(s, { t: 'join', player: { id: `p${i}`, name: `P${i}`, connectionId: `c${i}` } });
    s = reduce(s, { t: 'set_ready', playerId: `p${i}`, ready: true });
  }
  return reduce(s, { t: 'start_run' });
}

function standing(s: GameState): Player[] {
  return s.players.filter((p) => p.alive && !p.downed);
}

function giveSkills(s: GameState, byPlayer: Record<string, SkillId[]>): GameState {
  return {
    ...s,
    players: s.players.map((p) => (byPlayer[p.id] ? { ...p, skills: byPlayer[p.id]! } : p)),
  };
}

/** Fige toutes les intentions ennemies sur un buff inoffensif (assertions déterministes). */
function freezeIntents(s: GameState): GameState {
  return {
    ...s,
    combat: {
      ...s.combat!,
      enemies: s.combat!.enemies.map((e) => ({
        ...e,
        intent: { kind: 'buff' as const, description: 'se renforce' },
      })),
    },
  };
}

type Pick_ = { skillId: SkillId; targetId?: string };

function playRound(s: GameState, pick: (s: GameState, p: Player) => Pick_ | null): GameState {
  for (const id of standing(s).map((p) => p.id)) {
    if (s.phase !== 'combat_planning') break;
    const p = s.players.find((x) => x.id === id)!;
    const choice = pick(s, p);
    if (!choice) continue;
    s = reduce(s, { t: 'plan_action', playerId: id, ...choice });
    s = reduce(s, { t: 'confirm_action', playerId: id });
  }
  return s;
}

const strikeFirst = (s: GameState): Pick_ => ({
  skillId: 'strike',
  targetId: s.combat!.enemies.find((e) => e.alive)!.id,
});

/** Entre dans le premier nœud (combat) depuis la carte. */
function enterCurrent(s: GameState): GameState {
  return reduce(s, { t: 'enter_node', nodeIndex: s.run.currentNode });
}

/** Gagne le combat courant au bot « frappe » puis draft la première offre. */
function winCombatAndDraft(s: GameState): GameState {
  let guard = 0;
  while (s.phase === 'combat_planning' && guard++ < 300) s = playRound(s, strikeFirst);
  expect(s.phase).toBe('reward_draft');
  for (const p of s.players) {
    if (s.phase !== 'reward_draft') break;
    const offers = s.draftOffers[p.id] ?? [];
    if (offers.length > 0 && s.draftPicks[p.id] == null) {
      s = reduce(s, { t: 'draft_pick', playerId: p.id, skillId: offers[0]! });
    }
  }
  return s;
}

// ————— Contenu —————

describe('contenu Phase 4', () => {
  it('le pool contient 20 à 30 compétences valides', () => {
    expect(DRAFT_POOL.length).toBeGreaterThanOrEqual(20);
    expect(DRAFT_POOL.length).toBeLessThanOrEqual(30);
    for (const id of DRAFT_POOL) {
      const skill = SKILLS[id]!;
      expect(skill.id).toBe(id);
      expect(skill.effects.length).toBeGreaterThan(0);
      expect(skill.tags.length).toBeGreaterThan(0);
      expect(skill.cost).toBeGreaterThanOrEqual(1);
    }
  });

  it('plusieurs synergies inter-joueurs : chaque statut détonable a des poseurs ET un détonateur', () => {
    const all = Object.values(SKILLS);
    for (const tag of ['mark', 'burn'] as const) {
      const setters = all.filter((s) =>
        s.effects.some((e) => e.type === 'apply_status' && e.status === tag),
      );
      const detonators = all.filter((s) => s.effects.some((e) => e.type === 'detonate' && e.tag === tag));
      expect(setters.length).toBeGreaterThanOrEqual(2);
      expect(detonators.length).toBeGreaterThanOrEqual(1);
    }
    // poison : des poseurs + une compétence qui scale dessus sans consommer
    const poisonScalers = all.filter((s) =>
      s.effects.some((e) => e.scalesWith === 'tag_count' && e.tag === 'poison'),
    );
    expect(poisonScalers.length).toBeGreaterThanOrEqual(1);
  });
});

// ————— Carte Phase 4 —————

describe('carte à nœuds variés', () => {
  it('la carte suit le layout : combat, spécial, combat, élite, boss', () => {
    const s = setup(2);
    const types = s.run.nodes.map((n) => n.type);
    expect(types).toHaveLength(5);
    expect(types[0]).toBe('combat');
    expect(['event', 'rest', 'shop']).toContain(types[1]);
    expect(types[2]).toBe('combat');
    expect(types[3]).toBe('elite');
    expect(types[4]).toBe('boss');
  });

  it('un nœud élite produit des ennemis plus costauds qu’un nœud combat', () => {
    let s = setup(2, 5);
    // On saute directement au nœud élite (index 3)
    const sElite = enterCurrent({
      ...s,
      run: {
        ...s.run,
        currentNode: 3,
        nodes: s.run.nodes.map((n) => (n.index < 3 ? { ...n, cleared: true } : n)),
      },
    });
    const sCombat = enterCurrent(s);
    const totalHp = (st: GameState) => st.combat!.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    expect(totalHp(sElite)).toBeGreaterThan(totalHp(sCombat));
  });
});

// ————— Nouvelles mécaniques de compétences —————

describe('mécaniques de compétences Phase 4', () => {
  function combatWith(skills: Record<string, SkillId[]>, seed = 11): GameState {
    return freezeIntents(giveSkills(enterCurrent(setup(2, seed)), skills));
  }

  it('all_enemies : la vague de flammes touche tous les ennemis et pose des brûlures', () => {
    let s = combatWith({ p1: ['flame_wave'], p2: ['defend'] });
    const before = s.combat!.enemies.map((e) => e.hp);
    s = playRound(s, (_st, p) => (p.id === 'p1' ? { skillId: 'flame_wave' } : { skillId: 'defend' }));
    // Fin de tour : chaque ennemi a pris 3 dégâts + 1 tick de brûlure (1) = 4
    s.combat!.enemies.forEach((e, i) => {
      expect(e.hp).toBe(before[i]! - 4);
      expect(getStacks(e, 'burn')).toBe(0); // 1 stack posé, consumé au tick
    });
  });

  it('all_allies : le cri de guerre donne de la force à toute l’équipe', () => {
    let s = combatWith({ p1: ['war_cry'], p2: ['defend'] });
    s = playRound(s, (_st, p) => (p.id === 'p1' ? { skillId: 'war_cry' } : { skillId: 'defend' }));
    for (const p of s.players) expect(getStacks(p, 'strength')).toBe(2);
  });

  it('synergie poison : croc de vipère multiplie par les stacks SANS les consommer', () => {
    let s = combatWith({ p1: ['poison_dagger'], p2: ['serpent_fang'] });
    const target = s.combat!.enemies[0]!.id;
    const hpBefore = s.combat!.enemies[0]!.hp;
    s = playRound(s, (_st, p) => ({
      skillId: p.id === 'p1' ? 'poison_dagger' : 'serpent_fang',
      targetId: target,
    }));
    const e = s.combat!.enemies.find((x) => x.id === target)!;
    // p1 : 3 dégâts + 2 poisons. p2 : 2 × (1 + 2 stacks) = 6. Tick poison : 2. Total 11.
    expect(hpBefore - e.hp).toBe(11);
    expect(getStacks(e, 'poison')).toBe(2); // non consommés
  });

  it('synergie brûlure inter-joueurs : p1 embrase, p2 pyroclasme (3 dégâts × brûlure)', () => {
    let s = combatWith({ p1: ['ignite'], p2: ['pyroclasm'] });
    const target = s.combat!.enemies[0]!.id;
    const hpBefore = s.combat!.enemies[0]!.hp;
    s = playRound(s, (_st, p) => ({
      skillId: p.id === 'p1' ? 'ignite' : 'pyroclasm',
      targetId: target,
    }));
    const e = s.combat!.enemies.find((x) => x.id === target)!;
    expect(hpBefore - e.hp).toBe(12); // 4 brûlures × 3, consommées avant le tick
    expect(getStacks(e, 'burn')).toBe(0);
  });

  it('scalesWith strength : le coup écrasant profite doublement de la force', () => {
    let s = combatWith({ p1: ['crushing_blow'], p2: ['defend'] });
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? { ...p, statuses: [{ kind: 'strength' as const, stacks: 2, duration: -1 }] }
          : p,
      ),
    };
    const target = s.combat!.enemies[0]!.id;
    const hpBefore = s.combat!.enemies[0]!.hp;
    s = playRound(s, (_st, p) =>
      p.id === 'p1' ? { skillId: 'crushing_blow', targetId: target } : { skillId: 'defend' },
    );
    const e = s.combat!.enemies.find((x) => x.id === target)!;
    // base 5 + scalesWith 2×1 + force générique 2×1 = 9
    expect(hpBefore - e.hp).toBe(9);
  });

  it('scalesWith missing_hp : la frappe désespérée frappe plus fort blessé', () => {
    let s = combatWith({ p1: ['desperate_strike'], p2: ['defend'] });
    s = { ...s, players: s.players.map((p) => (p.id === 'p1' ? { ...p, hp: p.maxHp - 9 } : p)) };
    const target = s.combat!.enemies[0]!.id;
    const hpBefore = s.combat!.enemies[0]!.hp;
    s = playRound(s, (_st, p) =>
      p.id === 'p1' ? { skillId: 'desperate_strike', targetId: target } : { skillId: 'defend' },
    );
    const e = s.combat!.enemies.find((x) => x.id === target)!;
    expect(hpBefore - e.hp).toBe(4 + 3); // 9 PV manquants / 3 = +3
  });
});

// ————— Nouveaux ennemis —————

describe('invocateur et soigneur', () => {
  function craftCombatWithEnemy(enemyIntent: 'summon' | 'heal', seed = 3): GameState {
    let s = enterCurrent(setup(2, seed));
    const type = enemyIntent === 'summon' ? 'cultist' : 'shaman';
    // On remplace la vague par [cultist|shaman, goblin blessé] avec intentions forcées
    const goblin = { ...s.combat!.enemies[0]!, id: 'e2', name: 'Gobelin', enemyType: 'goblin', hp: 5, maxHp: 40, aiProfile: 'focus_lowest_hp', intent: { kind: 'buff' as const, description: 'attend' } };
    const special = {
      ...s.combat!.enemies[0]!,
      id: 'e1',
      name: type,
      enemyType: type,
      hp: 24,
      maxHp: 24,
      intent:
        enemyIntent === 'summon'
          ? { kind: 'summon' as const, description: 'invoque une gelée' }
          : { kind: 'heal' as const, value: 6, targetId: 'e2', description: 'soigne son allié' },
    };
    s = { ...s, combat: { ...s.combat!, enemies: [special, goblin] } };
    return giveSkills(s, { p1: ['defend'], p2: ['defend'] });
  }

  it('le cultiste invoque une gelée : un ennemi de plus sur le plateau', () => {
    let s = craftCombatWithEnemy('summon');
    expect(s.combat!.enemies).toHaveLength(2);
    s = playRound(s, () => ({ skillId: 'defend' }));
    expect(s.combat!.enemies.length).toBe(3);
    expect(s.combat!.enemies.some((e) => e.enemyType === 'slime')).toBe(true);
  });

  it('le chamane soigne son allié blessé', () => {
    let s = craftCombatWithEnemy('heal');
    s = playRound(s, () => ({ skillId: 'defend' }));
    const goblin = s.combat!.enemies.find((e) => e.id === 'e2')!;
    expect(goblin.hp).toBe(11); // 5 + 6
  });
});

// ————— Or, événement, repos, boutique —————

describe('nœuds hors combat et économie', () => {
  it('la victoire rapporte de l’or à chaque joueur', () => {
    let s = enterCurrent(setup(2, 21));
    let guard = 0;
    while (s.phase === 'combat_planning' && guard++ < 300) s = playRound(s, strikeFirst);
    expect(s.phase).toBe('reward_draft');
    for (const p of s.players) expect(p.gold).toBe(BALANCE.goldPerCombat);
  });

  it("l'événement s'ouvre au nœud spécial, applique ses effets et rend la main à la carte", () => {
    // Niveau 1 : le spécial est un événement. On y va après le combat 0.
    let s = winCombatAndDraft(enterCurrent(setup(2, 21)));
    expect(s.phase).toBe('map');
    expect(s.run.nodes[s.run.currentNode]!.type).toBe('event');
    s = enterCurrent(s);
    expect(s.phase).toBe('node_event');
    const template = EVENTS.find((e) => e.id === s.event!.id)!;
    expect(template).toBeDefined();

    // On abîme l'équipe puis on choisit une option et on vérifie qu'un effet a eu lieu
    s = { ...s, players: s.players.map((p) => ({ ...p, hp: Math.max(1, p.hp - 5) })) };
    const before = s.players.map((p) => ({ hp: p.hp, gold: p.gold }));
    s = reduce(s, { t: 'event_choice', playerId: 'p1', optionIndex: 0 });
    expect(s.phase).toBe('map');
    expect(s.run.nodes.find((n) => n.type === 'event')!.cleared).toBe(true);
    const changed = s.players.some((p, i) => p.hp !== before[i]!.hp || p.gold !== before[i]!.gold);
    const noOpPossible = template.options[0]!.effects.length === 0;
    expect(changed || noOpPossible).toBe(true);
  });

  it('au repos, chacun choisit : soigner (+40 % PV max) ou oublier une compétence', () => {
    let s = setup(2, 8);
    // On force le nœud courant en repos
    s = {
      ...s,
      run: {
        ...s.run,
        currentNode: 1,
        nodes: s.run.nodes.map((n) =>
          n.index === 1 ? { ...n, type: 'rest' as const } : n.index === 0 ? { ...n, cleared: true } : n,
        ),
      },
      players: s.players.map((p) => ({ ...p, hp: 10 })),
    };
    s = enterCurrent(s);
    expect(s.phase).toBe('node_rest');
    s = reduce(s, { t: 'rest_choice', playerId: 'p1', choice: 'heal' });
    expect(s.players.find((p) => p.id === 'p1')!.hp).toBe(10 + 12); // 40 % de 30
    expect(s.phase).toBe('node_rest'); // p2 n'a pas choisi
    s = reduce(s, { t: 'rest_choice', playerId: 'p2', choice: 'forget', skillId: 'taunt_shout' });
    expect(s.players.find((p) => p.id === 'p2')!.skills).not.toContain('taunt_shout');
    expect(s.phase).toBe('map'); // tous ont choisi
  });

  it('la boutique vend des compétences contre de l’or ; achat refusé sans le sou', () => {
    let s = setup(2, 8);
    s = {
      ...s,
      run: {
        ...s.run,
        currentNode: 1,
        nodes: s.run.nodes.map((n) =>
          n.index === 1 ? { ...n, type: 'shop' as const } : n.index === 0 ? { ...n, cleared: true } : n,
        ),
      },
      players: s.players.map((p) => ({ ...p, gold: p.id === 'p1' ? 100 : 0 })),
    };
    s = enterCurrent(s);
    expect(s.phase).toBe('node_shop');
    const offer1 = s.shopOffers['p1']![0]!;
    const price = BALANCE.shopPrices[SKILLS[offer1]!.rarity];
    s = reduce(s, { t: 'shop_buy', playerId: 'p1', skillId: offer1 });
    const p1 = s.players.find((p) => p.id === 'p1')!;
    expect(p1.skills).toContain(offer1);
    expect(p1.gold).toBe(100 - price);

    // p2 n'a pas un sou : achat refusé, il doit passer
    const offer2 = s.shopOffers['p2']![0]!;
    const before = s;
    s = reduce(s, { t: 'shop_buy', playerId: 'p2', skillId: offer2 });
    expect(s).toBe(before);
    s = reduce(s, { t: 'shop_skip', playerId: 'p2' });
    expect(s.phase).toBe('map');
  });
});

// ————— Acceptation : boss plus menaçant à 6 qu'à 2 —————

describe('scaling du boss (GAME_DESIGN §7)', () => {
  function bossRound(n: number): string[] {
    let s = setup(n, 77);
    s = {
      ...s,
      run: {
        ...s.run,
        currentNode: 4,
        nodes: s.run.nodes.map((node) => (node.index < 4 ? { ...node, cleared: true } : node)),
      },
    };
    s = enterCurrent(s);
    expect(s.combat!.enemies[0]!.enemyType).toBe('ogre_boss');
    // Intention forcée : attaque télégraphiée sur p1
    s = {
      ...s,
      combat: {
        ...s.combat!,
        enemies: s.combat!.enemies.map((e) => ({
          ...e,
          intent: { kind: 'attack' as const, value: 12, targetId: 'p1', description: 'attaque 12 → P1' },
        })),
      },
    };
    s = giveSkills(s, Object.fromEntries(s.players.map((p) => [p.id, ['defend'] as SkillId[]])));
    s = playRound(s, () => ({ skillId: 'defend' }));
    return s.combat!.log.filter((l) => l.includes('Ogre') && l.includes('attaque'));
  }

  it("l'ogre frappe une fois à 2 joueurs, deux fois à 6 (⌈N/3⌉ actions)", () => {
    expect(bossRound(2)).toHaveLength(1);
    expect(bossRound(6)).toHaveLength(2);
  });
});

// ————— Acceptation : deux runs divergent selon les compétences choisies —————

describe('les picks façonnent la run', () => {
  function botRun(seed: number, pickOffer: 'first' | 'last'): GameState {
    let s = setup(2, seed);
    let guard = 0;
    while (s.phase !== 'game_over' && guard++ < 4000) {
      if (s.phase === 'map') s = enterCurrent(s);
      else if (s.phase === 'combat_planning') {
        s = playRound(s, (st, p) => {
          const skillId = p.skills.find((id) => (SKILLS[id]?.cost ?? 99) <= p.energy);
          if (!skillId) return null;
          const skill = SKILLS[skillId]!;
          const target =
            skill.targeting === 'enemy'
              ? st.combat!.enemies.find((e) => e.alive)?.id
              : skill.targeting === 'ally'
                ? p.id
                : undefined;
          return { skillId, targetId: target };
        });
      } else if (s.phase === 'reward_draft') {
        for (const p of s.players) {
          if (s.phase !== 'reward_draft') break;
          const offers = s.draftOffers[p.id] ?? [];
          if (offers.length > 0 && s.draftPicks[p.id] == null) {
            const skillId = pickOffer === 'first' ? offers[0]! : offers[offers.length - 1]!;
            s = reduce(s, { t: 'draft_pick', playerId: p.id, skillId });
          }
        }
      } else if (s.phase === 'node_event') {
        s = reduce(s, { t: 'event_choice', playerId: 'p1', optionIndex: 0 });
      } else if (s.phase === 'node_rest') {
        for (const p of s.players) s = reduce(s, { t: 'rest_choice', playerId: p.id, choice: 'heal' });
      } else if (s.phase === 'node_shop') {
        for (const p of s.players) s = reduce(s, { t: 'shop_skip', playerId: p.id });
      } else {
        throw new Error(`phase inattendue : ${s.phase}`);
      }
    }
    expect(guard).toBeLessThan(4000);
    return s;
  }

  it('même seed, picks différents ⇒ runs différentes ; même stratégie ⇒ run identique', () => {
    const first = botRun(2026, 'first');
    const last = botRun(2026, 'last');
    expect(first).not.toEqual(last); // les compétences choisies changent la partie
    const firstAgain = botRun(2026, 'first');
    expect(firstAgain).toEqual(first); // et le déterminisme tient toujours
  });
});
