// Grilles de pixels des sprites — l'« atelier d'art » du jeu.
// Caractères : '.' transparent · 'k' contour · 'w' blanc (yeux)
//   corps : 's' peau, 'S' peau ombrée · cheveux : 'h', 'H' · tenue : 'o', 'O'
//   ennemis : 'b' base, 'B' base ombrée, 'x' accent
export type PixelMap = string[];

// ————— Personnage (12 × 14), en couches : corps → tenue → cheveux —————

export const BODY: PixelMap = [
  '....kkkk....',
  '...kssssk...',
  '..kssssssk..',
  '..kswsswsk..',
  '..kssssssk..',
  '...kSssSk...',
  '....kssk....',
  '..kssssssk..',
  '..kssssssk..',
  '..kssssssk..',
  '...kssssk...',
  '...ks..sk...',
  '...ks..sk...',
  '...kk..kk...',
];

export const HAIR_STYLES: Record<string, PixelMap> = {
  court: [
    '....hhhh....',
    '...hhhhhh...',
    '..hhhHHhhh..',
    '..hh....hh..',
  ],
  long: [
    '....hhhh....',
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hh....hh..',
    '..hh....hh..',
    '..hH....Hh..',
    '..hh....hh..',
  ],
  tresse: [
    '....hhhh....',
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hh....hh..',
    '...h........',
    '...H........',
    '...h........',
    '...H........',
  ],
  chauve: [
    '............',
    '....hh......',
  ],
};

export const OUTFIT_STYLES: Record<string, PixelMap> = {
  tunique: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '..oooooooo..',
    '..oooooooo..',
    '..oOOOOOOo..',
    '...oooooo...',
    '...oo..oo...',
  ],
  armure: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '.OooooooooO.',
    '..oOOooOOo..',
    '..oooooooo..',
    '...OOOOOO...',
    '...oo..oo...',
  ],
  robe: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '..oooooooo..',
    '..oOooooOo..',
    '..oooooooo..',
    '..oooooooo..',
    '.oooooooooo.',
    '.oOOooooOOo.',
    '.oooooooooo.',
  ],
  cape: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '.OoooooooooO',
    '.O.oooooo.O.',
    '.O.oOOOOo.O.',
    '.O..oooo..O.',
    '.OO.o..o.OO.',
  ],
};

// ————— Ennemis (palette fixe par type) —————

export interface EnemySpriteDef {
  map: PixelMap;
  palette: Record<string, string>;
}

export const ENEMY_SPRITES: Record<string, EnemySpriteDef> = {
  slime: {
    palette: { b: '#5cb85c', B: '#3e8e41', k: '#1c3320', w: '#eaffea' },
    map: [
      '............',
      '...kkkkkk...',
      '..kbbbbbbk..',
      '.kbbbbbbbbk.',
      '.kbwbbbbwbk.',
      'kbbbbbbbbbbk',
      'kbBbbbbbbBbk',
      '.kBBbbbbBBk.',
      '..kkkkkkkk..',
    ],
  },
  goblin: {
    palette: { b: '#8fae4e', B: '#66802f', k: '#232d12', w: '#f4ffdd', x: '#c23b22' },
    map: [
      '.k........k.',
      'kbk......kbk',
      '.kbkkkkkkbk.',
      '..kbbbbbbk..',
      '..kbwbbwbk..',
      '..kbbxxbbk..',
      '...kbbbbk...',
      '..kbbbbbbk..',
      '.kb.bbbb.bk.',
      '..k.bbbb.k..',
      '...kb..bk...',
      '...kk..kk...',
    ],
  },
  cultist: {
    palette: { b: '#6d4a9e', B: '#4a3070', k: '#221438', w: '#ffd76a' },
    map: [
      '....kkkk....',
      '...kbbbbk...',
      '..kbbbbbbk..',
      '..kBwBBwBk..',
      '..kBBBBBBk..',
      '...kbbbbk...',
      '..kbbbbbbk..',
      '..kbbbbbbk..',
      '.kbbbbbbbbk.',
      '.kbbBbbBbbk.',
      '.kbbbbbbbbk.',
      '..kkkkkkkk..',
    ],
  },
  shaman: {
    palette: { b: '#2e8b8b', B: '#1e5f5f', k: '#0f2727', w: '#e8fff9', x: '#d8a03c' },
    map: [
      '.x..kkkk....',
      '.x.kbbbbk...',
      '.x.kbwbwbk..',
      '.xkbbbbbbk..',
      '.x.kbbbbk...',
      '.x.kbbbbk...',
      '.xkbbbbbbk..',
      '.xkbbbbbbk..',
      '.xkbBbbBbk..',
      '.x.kbbbbk...',
      '...kb..bk...',
      '...kk..kk...',
    ],
  },
  ogre_boss: {
    palette: { b: '#b0713d', B: '#7e4c24', k: '#2e1a0a', w: '#fff2d9', x: '#8f2f2f' },
    map: [
      '..kkkk..kkkk....',
      '.kxxk....kxxk...',
      '..kkkkkkkkkk....',
      '.kbbbbbbbbbbk...',
      'kbbwbbbbbbwbbk..',
      'kbbbbbxxbbbbbk..',
      '.kbbbbbbbbbbk...',
      '..kbbkkkkbbk....',
      '.kbbbbbbbbbbbk..',
      'kbbkbbbbbbkbbbk.',
      'kbbkbbbbbbkbbbk.',
      'kBBkbBbbBbkbBBk.',
      '.kk.bbbbbb.kk...',
      '....kbbbbk......',
      '...kbb..bbk.....',
      '...kkk..kkk.....',
    ],
  },
};
