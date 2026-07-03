// Événements narratifs risque/récompense (GAME_DESIGN §3) — data-driven, pas de logique.
// Depuis la Phase 7 (modèle expédition, décision D2) : plus d'or en run — les récompenses
// sont des boons mineurs (PV max) ou du soin, cohérents avec la progression minime (D1).
export type EventEffect =
  | { type: 'heal_pct_all'; pct: number } // soigne toute l'équipe (% PV max)
  | { type: 'hurt_pct_all'; pct: number } // blesse toute l'équipe (% PV max, ne met pas à terre)
  | { type: 'max_hp_all'; amount: number } // boon mineur : +PV max (et PV) pour chaque joueur
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
        label: 'S’immerger dans le bassin',
        hint: 'Les eaux fortifient… ou punissent.',
        effects: [
          {
            type: 'gamble',
            win: [{ type: 'max_hp_all', amount: 2 }],
            lose: [{ type: 'hurt_pct_all', pct: 10 }],
          },
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
        hint: 'Grosse bénédiction… ou grosse punition.',
        effects: [
          {
            type: 'gamble',
            win: [{ type: 'max_hp_all', amount: 3 }],
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
        hint: 'Il offre à chacun une amulette d’endurance.',
        effects: [{ type: 'max_hp_all', amount: 2 }],
      },
      {
        label: 'Partager son repas',
        hint: 'Un ragoût réparateur.',
        effects: [{ type: 'heal_pct_all', pct: 15 }],
      },
    ],
  },
];
