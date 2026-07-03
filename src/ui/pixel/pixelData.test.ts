// Garde Phase 8 : chaque ennemi du bestiaire a une grille de sprite valide
// (rectangulaire, clés couvertes par sa palette) — le format Phase 5 ne change pas.
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../engine/data/enemies';
import { ENEMY_SPRITES } from './pixelData';

describe('sprites ennemis (pixelData)', () => {
  it('chaque ennemi du bestiaire a un sprite dédié', () => {
    for (const type of Object.keys(ENEMIES)) {
      expect(ENEMY_SPRITES[type], `sprite manquant : ${type}`).toBeDefined();
    }
  });

  it('chaque grille est rectangulaire et n’utilise que des clés de sa palette', () => {
    for (const [type, def] of Object.entries(ENEMY_SPRITES)) {
      const width = def.map[0]!.length;
      for (const row of def.map) {
        expect(row.length, `${type} : largeur de ligne irrégulière`).toBe(width);
        for (const ch of row) {
          if (ch === '.') continue;
          expect(def.palette[ch], `${type} : clé '${ch}' sans couleur`).toBeDefined();
        }
      }
    }
  });
});
