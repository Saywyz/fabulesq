// Tests Phase 7 : génération procédurale d'expédition (déterminisme, longueur variable,
// structure des nœuds, biomes) — critères d'acceptation de docs/BUILD_PLAN_V2.md.
import { describe, expect, it } from 'vitest';
import { BALANCE } from './data/balance';
import { BIOMES } from './data/biomes';
import { generateExpedition, progressAt } from './expedition';
import { createRngState } from './rng';
import { scaledEnemyDamage, scaledEnemyHp } from './scaling';
import type { LengthBand } from './types';

const BANDS: LengthBand[] = ['short', 'medium', 'long'];

describe('génération d’expédition (déterminisme)', () => {
  it('même seed + même bande ⇒ exactement la même suite de nœuds', () => {
    const a = generateExpedition(createRngState(123), 'medium');
    const b = generateExpedition(createRngState(123), 'medium');
    expect(a.nodes).toEqual(b.nodes);
    expect(a.state).toBe(b.state);
  });

  it('deux seeds différentes ⇒ des expéditions différentes (longueur et/ou composition)', () => {
    const runs = [1, 2, 3, 4, 5].map((seed) => generateExpedition(createRngState(seed), 'medium').nodes);
    const signatures = new Set(runs.map((nodes) => JSON.stringify(nodes)));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('la longueur varie selon les seeds au sein d’une même bande', () => {
    const lengths = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      lengths.add(generateExpedition(createRngState(seed), 'medium').nodes.length);
    }
    expect(lengths.size).toBeGreaterThan(1); // longueur variable prouvée
  });
});

describe('bandes de longueur', () => {
  for (const band of BANDS) {
    it(`la bande « ${band} » respecte ses bornes`, () => {
      const { min, max } = BALANCE.expeditionLength[band];
      for (let seed = 1; seed <= 15; seed++) {
        const { nodes } = generateExpedition(createRngState(seed), band);
        expect(nodes.length).toBeGreaterThanOrEqual(min);
        expect(nodes.length).toBeLessThanOrEqual(max);
      }
    });
  }
});

describe('structure de la route', () => {
  it('boss final unique au dernier nœud ; premier nœud = combat ; index cohérents', () => {
    for (const band of BANDS) {
      for (let seed = 1; seed <= 10; seed++) {
        const { nodes } = generateExpedition(createRngState(seed), band);
        expect(nodes[0]!.type).toBe('combat');
        expect(nodes[nodes.length - 1]!.type).toBe('boss');
        expect(nodes.filter((n) => n.type === 'boss')).toHaveLength(1);
        nodes.forEach((n, i) => expect(n.index).toBe(i));
        expect(nodes.every((n) => !n.cleared)).toBe(true);
      }
    }
  });

  it('chaque nœud est tagué d’un biome connu, et les biomes forment des segments contigus', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { nodes } = generateExpedition(createRngState(seed), 'long');
      for (const n of nodes) expect(BIOMES[n.biome]).toBeDefined();
      // Contiguïté : un biome ne réapparaît jamais après qu'on l'a quitté.
      const seen: string[] = [];
      for (const n of nodes) {
        if (seen[seen.length - 1] !== n.biome) seen.push(n.biome);
      }
      expect(new Set(seen).size).toBe(seen.length);
    }
  });

  it('des élites jalonnent la route (fin de chaque biome sauf le dernier)', () => {
    const { nodes } = generateExpedition(createRngState(7), 'medium');
    const biomeCount = new Set(nodes.map((n) => n.biome)).size;
    expect(nodes.filter((n) => n.type === 'elite')).toHaveLength(biomeCount - 1);
  });

  it('des nœuds spéciaux légers (événement/repos) existent sur les routes moyennes et longues', () => {
    for (const band of ['medium', 'long'] as const) {
      const { nodes } = generateExpedition(createRngState(3), band);
      expect(nodes.some((n) => n.type === 'event' || n.type === 'rest')).toBe(true);
    }
  });
});

describe('progression normalisée (pacing)', () => {
  it('p va de 0 (départ) à 1 (boss final)', () => {
    expect(progressAt(0, 12)).toBe(0);
    expect(progressAt(11, 12)).toBe(1);
    expect(progressAt(5, 12)).toBeGreaterThan(0);
    expect(progressAt(5, 12)).toBeLessThan(1);
  });

  it('le pacing durcit PV et dégâts ennemis avec la progression', () => {
    expect(scaledEnemyHp(10, 2, 0)).toBe(Math.round(20 * BALANCE.enemyHpPerPlayer)); // départ : pas de bonus de pacing
    expect(scaledEnemyHp(10, 2, 1)).toBeGreaterThan(scaledEnemyHp(10, 2, 0.5));
    expect(scaledEnemyHp(10, 2, 0.5)).toBeGreaterThan(scaledEnemyHp(10, 2, 0));
    expect(scaledEnemyDamage(10, 0)).toBe(10);
    expect(scaledEnemyDamage(10, 1)).toBeGreaterThan(scaledEnemyDamage(10, 0));
  });
});
