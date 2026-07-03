// Tests Phase 8 : bestiaire par biome (pureté des rencontres, paliers de difficulté)
// et comportements d'IA (chargeur télégraphié, applicateurs de statut, plafond d'invocation).
// Le soigneur et l'invocateur sont couverts par phase4.test.ts ; les profils de ciblage
// par combat/targeting.test.ts.
import { describe, expect, it } from 'vitest';
import { assignIntents, buildEnemies, tierFor } from './combat/stateMachine';
import { getStacks } from './combat/status';
import { BIOMES } from './data/biomes';
import { ENEMIES } from './data/enemies';
import { generateExpedition, progressAt } from './expedition';
import { createInitialState, reduce } from './reducer';
import { createRngState } from './rng';
import type { GameState, MapNode, Player, SkillId } from './types';

// ————— Helpers —————

function setup(n: number, seed = 42): GameState {
  let s = createInitialState({ seed, hostId: 'p1', code: 'PHASE8' });
  for (let i = 1; i <= n; i++) {
    s = reduce(s, { t: 'join', player: { id: `p${i}`, name: `P${i}`, connectionId: `c${i}` } });
    s = reduce(s, { t: 'set_ready', playerId: `p${i}`, ready: true });
  }
  s = reduce(s, { t: 'start_run' });
  for (let i = 1; i <= n; i++) {
    s = reduce(s, { t: 'prep_ready', playerId: `p${i}`, ready: true });
  }
  return reduce(s, { t: 'enter_node', nodeIndex: 0 });
}

function giveSkills(s: GameState, skills: SkillId[]): GameState {
  return { ...s, players: s.players.map((p) => ({ ...p, skills: [...skills] })) };
}

function playDefendRound(s: GameState): GameState {
  for (const p of s.players.filter((x) => x.alive && !x.downed)) {
    if (s.phase !== 'combat_planning') break;
    s = reduce(s, { t: 'plan_action', playerId: p.id, skillId: 'defend' });
    s = reduce(s, { t: 'confirm_action', playerId: p.id });
  }
  return s;
}

/** Remplace la vague par un unique ennemi du type donné, avec une intention forcée. */
function soloEnemy(s: GameState, enemyType: string, intent: NonNullable<GameState['combat']>['enemies'][number]['intent']): GameState {
  const base = s.combat!.enemies[0]!;
  return {
    ...s,
    combat: {
      ...s.combat!,
      enemies: [{ ...base, id: 'e1', enemyType, name: ENEMIES[enemyType]!.name, hp: 30, maxHp: 30, intent }],
    },
  };
}

// ————— Pureté des biomes (critère d'acceptation Phase 8) —————

describe('biomes : bestiaire et pureté des tables', () => {
  it('chaque biome a un bestiaire valide, des paliers non vides et un boss qui en est un', () => {
    for (const biome of Object.values(BIOMES)) {
      expect(biome.bestiary.length).toBeGreaterThanOrEqual(4);
      for (const type of biome.bestiary) expect(ENEMIES[type], `${type} inconnu`).toBeDefined();
      expect(biome.encounters.combat.length).toBeGreaterThanOrEqual(2); // au moins 2 paliers
      for (const tier of biome.encounters.combat) expect(tier.length).toBeGreaterThan(0);
      expect(biome.encounters.elite.length).toBeGreaterThan(0);
      expect(biome.encounters.boss.some((t) => ENEMIES[t]!.isBoss)).toBe(true);
    }
  });

  it('toutes les tables (paliers, élites, boss) ne référencent que le bestiaire du biome', () => {
    for (const biome of Object.values(BIOMES)) {
      const allowed = new Set(biome.bestiary);
      const waves = [...biome.encounters.combat.flat(), ...biome.encounters.elite, biome.encounters.boss];
      for (const wave of waves) {
        expect(wave.length).toBeGreaterThan(0);
        for (const type of wave) {
          expect(allowed.has(type), `${type} hors du biome ${biome.id}`).toBe(true);
        }
      }
    }
  });

  it('les invocations restent dans le biome (tout `summons` du bestiaire y figure aussi)', () => {
    for (const biome of Object.values(BIOMES)) {
      const allowed = new Set(biome.bestiary);
      for (const type of biome.bestiary) {
        for (const move of ENEMIES[type]!.moves) {
          if (move.summons) {
            expect(allowed.has(move.summons), `${type} invoque ${move.summons} hors ${biome.id}`).toBe(true);
          }
        }
      }
    }
  });

  it('toute rencontre générée sur une expédition ne référence que des ennemis de son biome', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { nodes } = generateExpedition(createRngState(seed), 'long');
      for (const node of nodes) {
        if (node.type !== 'combat' && node.type !== 'elite' && node.type !== 'boss') continue;
        const enemies = buildEnemies(node, 4, progressAt(node.index, nodes.length));
        expect(enemies.length).toBeGreaterThan(0);
        const allowed = new Set(BIOMES[node.biome]!.bestiary);
        for (const e of enemies) {
          expect(allowed.has(e.enemyType), `${e.enemyType} hors du biome ${node.biome}`).toBe(true);
          expect(e.hp).toBeGreaterThan(0);
          expect(e.alive).toBe(true);
        }
      }
    }
  });
});

// ————— Paliers de difficulté —————

describe('paliers de difficulté des rencontres', () => {
  it('tierFor choisit le palier selon la progression', () => {
    const tiers = ['t0', 't1'];
    expect(tierFor(tiers, 0)).toBe('t0');
    expect(tierFor(tiers, 0.49)).toBe('t0');
    expect(tierFor(tiers, 0.5)).toBe('t1');
    expect(tierFor(tiers, 1)).toBe('t1');
  });

  it('en fin de route, les vagues de combat viennent du dernier palier du biome', () => {
    for (const biome of Object.values(BIOMES)) {
      const node: MapNode = { index: 0, type: 'combat', biome: biome.id, cleared: false };
      const types = buildEnemies(node, 1, 1).map((e) => e.enemyType);
      const lastTier = biome.encounters.combat[biome.encounters.combat.length - 1]!;
      expect(types).toEqual(lastTier[0]);
    }
  });
});

// ————— Comportements d'IA —————

describe('comportements d’IA (critère : un test par profil)', () => {
  it('chargeur télégraphié : la charge se libère en attaque au round suivant, même valeur', () => {
    let s = giveSkills(setup(2, 3), ['defend']);
    s = soloEnemy(s, 'skeleton_archer', {
      kind: 'charge',
      value: 10,
      chargeTurnsLeft: 1,
      description: 'vise longuement',
    });
    s = playDefendRound(s);
    expect(s.phase).toBe('combat_planning'); // personne n'est mort, le combat continue
    const archer = s.combat!.enemies[0]!;
    expect(archer.intent!.kind).toBe('attack'); // la charge s'est transformée
    expect(archer.intent!.value).toBe(10); // valeur télégraphiée conservée
    expect(['p1', 'p2']).toContain(archer.intent!.targetId);
  });

  it('applicateur de poison (araignée) : la cible est empoisonnée et le poison tique', () => {
    let s = giveSkills(setup(2, 3), ['defend']);
    s = soloEnemy(s, 'spider', { kind: 'debuff', targetId: 'p1', description: 'crache son venin' });
    s = playDefendRound(s);
    const p1 = s.players.find((p) => p.id === 'p1')!;
    expect(getStacks(p1, 'poison')).toBe(2); // 2 stacks posés (move de l'araignée)
    expect(p1.hp).toBe(p1.maxHp - 2); // le tick de poison ignore le bouclier
  });

  it('applicateur de brûlure (diablotin) : la brûlure tique puis se consume', () => {
    let s = giveSkills(setup(2, 3), ['defend']);
    s = soloEnemy(s, 'imp', { kind: 'debuff', targetId: 'p1', description: 'crache une flammèche' });
    s = playDefendRound(s);
    const p1 = s.players.find((p) => p.id === 'p1')!;
    expect(p1.hp).toBe(p1.maxHp - 2); // 2 brûlures ont tiqué
    expect(getStacks(p1, 'burn')).toBe(1); // et se consument (2 → 1)
  });

  it('plafond d’invocation : à maxEnemies, plus aucune intention d’invoquer', () => {
    const s = setup(1, 5);
    const template = s.combat!.enemies[0]!;
    const necros = Array.from({ length: 6 }, (_, i) => ({
      ...template,
      id: `e${i + 1}`,
      enemyType: 'necromancer',
      name: `Nécromancien ${i + 1}`,
      intent: null,
    }));
    const players: Player[] = s.players;
    for (const seed of [1, 2, 3, 4, 5]) {
      const { enemies } = assignIntents(necros, players, createRngState(seed), 0);
      expect(enemies.every((e) => e.intent!.kind !== 'summon')).toBe(true);
    }
  });
});
