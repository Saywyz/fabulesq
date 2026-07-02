// Événements narratifs risque/récompense (GAME_DESIGN §3) — data-driven, pas de logique.
export type EventEffect =
  | { type: 'heal_pct_all'; pct: number } // soigne toute l'équipe (% PV max)
  | { type: 'hurt_pct_all'; pct: number } // blesse toute l'équipe (% PV max, ne met pas à terre)
  | { type: 'gold_all'; amount: number } // or pour chaque joueur
  | { type: 'gamble'; win: EventEffect[]; lose: EventEffect[] }; // 50/50 via le PRNG seedé

export interface EventOption {
  label: string;
  hint: string; // ce que l'option laisse entrevoir (l'aléa reste caché)
  effects: EventEffect[];
}

export interface EventTemplate {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

export const EVENTS: EventTemplate[] = [
  {
    id: 'fountain',
    title: 'La fontaine murmurante',
    text: 'Une fontaine aux reflets d’argent chantonne au milieu de la clairière.',
    options: [
      {
        label: 'Boire à la fontaine',
        hint: 'Toute l’équipe se soigne.',
        effects: [{ type: 'heal_pct_all', pct: 25 }],
      },
      {
        label: 'Piller le bassin',
        hint: 'De l’or… mais la fontaine se vengera.',
        effects: [
          { type: 'gold_all', amount: 20 },
          { type: 'hurt_pct_all', pct: 10 },
        ],
      },
    ],
  },
  {
    id: 'old_altar',
    title: 'L’autel oublié',
    text: 'Un autel couvert de runes pulse d’une lumière inquiétante. Y déposer la main ?',
    options: [
      {
        label: 'Tenter le rituel',
        hint: 'Grosse récompense… ou grosse punition.',
        effects: [
          {
            type: 'gamble',
            win: [{ type: 'gold_all', amount: 40 }],
            lose: [{ type: 'hurt_pct_all', pct: 20 }],
          },
        ],
      },
      {
        label: 'Passer son chemin',
        hint: 'Prudence est mère de sûreté.',
        effects: [],
      },
    ],
  },
  {
    id: 'wandering_merchant',
    title: 'Le colporteur borgne',
    text: 'Un marchand ambulant propose un marché : votre aide contre une récompense.',
    options: [
      {
        label: 'Escorter sa carriole',
        hint: 'Chacun touche une bourse.',
        effects: [{ type: 'gold_all', amount: 15 }],
      },
      {
        label: 'Partager son repas',
        hint: 'Un ragoût réparateur.',
        effects: [{ type: 'heal_pct_all', pct: 15 }],
      },
    ],
  },
];
