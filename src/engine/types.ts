// Types de référence — colonne vertébrale du jeu (TECH_ARCHITECTURE.md §4).
// engine/data/ les remplit ; engine/reducer.ts les transforme ; net/ les sérialise ; ui/ les lit.

export type PlayerId = string;
export type EntityId = string; // joueurs ET ennemis
export type SkillId = string;

export type Phase =
  | 'lobby'
  | 'customize'
  | 'map'
  | 'combat_intent'
  | 'combat_planning'
  | 'combat_resolution'
  | 'reward_draft'
  | 'node_event' // choix narratif (Phase 4)
  | 'node_rest' // repos/forge (Phase 4)
  | 'node_shop' // boutique (Phase 4)
  | 'game_over';

export interface Appearance {
  skinTone: string; // clé de palette
  hairStyle: string; // clé de sprite
  hairColor: string;
  outfitStyle: string;
  outfitColor: string;
}

export type StatusKind =
  | 'burn'
  | 'poison'
  | 'bleed'
  | 'stun'
  | 'slow'
  | 'shield'
  | 'regen'
  | 'strength'
  | 'vulnerable'
  | 'weak'
  | 'dodge'
  | 'mark';

export interface StatusEffect {
  kind: StatusKind;
  stacks: number; // magnitude
  duration: number; // tours restants ; -1 = jusqu'à fin du combat
  sourceId?: EntityId;
}

export interface Combatant {
  id: EntityId;
  name: string;
  hp: number;
  maxHp: number;
  block: number; // bouclier temporaire (voir status.ts pour la persistance)
  speed: number; // initiative
  statuses: StatusEffect[];
  alive: boolean; // false = mort/à terre (voir Player.downed)
}

export interface Player extends Combatant {
  connectionId: string; // clé de présence Supabase
  appearance: Appearance;
  classId: string;
  skills: SkillId[]; // le build possédé
  energy: number;
  maxEnergy: number;
  threat: number; // aggro accumulée
  gold: number; // butin de combat, dépensé en boutique (GAME_DESIGN §9)
  ready: boolean; // lobby
  downed: boolean; // à terre dans le niveau courant
}

export type IntentKind =
  | 'attack'
  | 'aoe'
  | 'buff'
  | 'debuff'
  | 'summon'
  | 'charge'
  | 'heal';

export interface Intent {
  kind: IntentKind;
  value?: number;
  targetId?: EntityId; // résolu à l'ouverture de la phase d'intentions
  chargeTurnsLeft?: number; // pour les attaques chargées
  description: string; // texte pour l'UI
}

export interface Enemy extends Combatant {
  enemyType: string;
  aiProfile: string; // 'focus_lowest_hp' | 'focus_highest_threat' | 'random' | ...
  intent: Intent | null; // action télégraphiée du prochain tour
}

export type Targeting = 'enemy' | 'ally' | 'self' | 'all_enemies' | 'all_allies';

export interface SkillEffect {
  type: 'damage' | 'block' | 'apply_status' | 'heal' | 'taunt' | 'detonate' | 'revive';
  amount?: number;
  status?: StatusKind;
  stacks?: number;
  duration?: number;
  scalesWith?: 'strength' | 'tag_count' | 'missing_hp'; // pour les synergies
  tag?: string; // ex. detonate 'burn'
}

export interface Skill {
  id: SkillId;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'legendary';
  cost: number; // énergie
  targeting: Targeting;
  tags: string[]; // 'fire','poison','physical','holy','summon','mark',...
  effects: SkillEffect[];
  cooldown?: number;
}

export interface PlannedAction {
  playerId: PlayerId;
  skillId: SkillId;
  targetId?: EntityId;
  confirmed: boolean;
}

export interface MapNode {
  index: number;
  type: 'combat' | 'elite' | 'boss' | 'event' | 'rest' | 'shop';
  cleared: boolean;
}

export interface RunState {
  seed: number;
  nodes: MapNode[];
  currentNode: number;
  levelNumber: number;
}

export interface CombatState {
  round: number;
  enemies: Enemy[];
  planned: Record<PlayerId, PlannedAction>;
  initiativeOrder: EntityId[]; // recalculé à la résolution
  log: string[]; // journal lisible pour l'UI
  cheered: Record<PlayerId, boolean>; // joueurs à terre ayant encouragé ce round (Phase 6)
}

export interface GameState {
  schemaVersion: number; // pour la compat réseau
  stateId: number; // compteur monotone : ordonnancement des snapshots
  hostId: PlayerId;
  code: string; // code de la partie
  phase: Phase;
  rngState: number; // curseur du PRNG seedé (dans l'état = déterministe)
  players: Player[];
  run: RunState;
  combat: CombatState | null;
  draftOffers: Record<PlayerId, SkillId[]>; // 3 offres par joueur
  draftPicks: Record<PlayerId, SkillId | null>;
  rerollsLeft: Record<PlayerId, number>;
  // Nœuds hors combat (Phase 4)
  event: { id: string } | null; // événement en cours au nœud courant
  restDone: Record<PlayerId, boolean>; // qui a fait son choix de repos
  shopOffers: Record<PlayerId, SkillId[]>; // étal de la boutique par joueur
  shopDone: Record<PlayerId, boolean>; // qui a acheté ou passé
}

// Actions = seule façon de faire évoluer l'état. Émises par l'UI, appliquées par le reducer.
export type Action =
  | { t: 'join'; player: Pick<Player, 'id' | 'name' | 'connectionId'> }
  | { t: 'set_appearance'; playerId: PlayerId; appearance: Appearance }
  | { t: 'set_class'; playerId: PlayerId; classId: string }
  | { t: 'set_ready'; playerId: PlayerId; ready: boolean }
  | { t: 'start_run' }
  | { t: 'enter_node'; nodeIndex: number }
  | { t: 'plan_action'; playerId: PlayerId; skillId: SkillId; targetId?: EntityId }
  | { t: 'confirm_action'; playerId: PlayerId }
  | { t: 'resolve_round' } // déclenché quand tous ont confirmé
  | { t: 'draft_pick'; playerId: PlayerId; skillId: SkillId }
  | { t: 'draft_reroll'; playerId: PlayerId }
  // Nœuds hors combat (Phase 4)
  | { t: 'event_choice'; playerId: PlayerId; optionIndex: number } // décision d'équipe
  | { t: 'rest_choice'; playerId: PlayerId; choice: 'heal' | 'forget'; skillId?: SkillId }
  | { t: 'shop_buy'; playerId: PlayerId; skillId: SkillId }
  | { t: 'shop_skip'; playerId: PlayerId }
  // Joueurs à terre : encourager un allié debout, une fois par round (Phase 6)
  | { t: 'cheer'; playerId: PlayerId; targetId: EntityId }
  | { t: 'leave'; playerId: PlayerId };
