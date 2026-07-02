// Écran lobby + customisation : prénom, apparence placeholder, classe, prêt (GAME_DESIGN.md §2).
import { CLASSES } from '../../engine/data/classes';
import type { Appearance, GameState, Player } from '../../engine/types';
import type { Ctx } from '../context';
import { el } from '../dom';

// Palettes cosmétiques placeholder (les vrais sprites arrivent en Phase 5).
const PALETTES: Record<keyof Appearance, string[]> = {
  skinTone: ['#f2c99a', '#d9a066', '#8d5524', '#ffdbac'],
  hairStyle: ['court', 'long', 'tresse', 'chauve'],
  hairColor: ['#2c1b10', '#d4a017', '#b22222', '#e6e6e6'],
  outfitStyle: ['tunique', 'armure', 'robe', 'cape'],
  outfitColor: ['#3b5dc9', '#7a1f1f', '#2f6f3e', '#5b4a8a'],
};

const FIELD_LABELS: Record<keyof Appearance, string> = {
  skinTone: 'Peau',
  hairStyle: 'Coiffure',
  hairColor: 'Cheveux',
  outfitStyle: 'Tenue',
  outfitColor: 'Couleur tenue',
};

function nextPlayerId(players: Player[]): string {
  const max = players.reduce((m, p) => {
    const n = Number(p.id.replace(/^p/, ''));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `p${max + 1}`;
}

export function avatarPreview(a: Appearance): HTMLElement {
  return el(
    'div',
    { class: 'avatar', title: `${a.hairStyle} / ${a.outfitStyle}` },
    el('div', { class: 'avatar-hair', style: `background:${a.hairColor}` }),
    el('div', { class: 'avatar-skin', style: `background:${a.skinTone}` }),
    el('div', { class: 'avatar-outfit', style: `background:${a.outfitColor}` }),
  );
}

function appearanceSelect(p: Player, field: keyof Appearance, ctx: Ctx, disabled = false): HTMLElement {
  const select = el('select', { 'data-appearance': `${p.id}:${field}`, disabled });
  for (const value of PALETTES[field]) {
    const opt = el('option', { value }, value);
    if (p.appearance[field] === value) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener('change', () => {
    ctx.dispatch({
      t: 'set_appearance',
      playerId: p.id,
      appearance: { ...p.appearance, [field]: select.value },
    });
  });
  return el('label', { class: 'field' }, FIELD_LABELS[field], select);
}

function playerCard(p: Player, ctx: Ctx): HTMLElement {
  const mine = ctx.canControl(p.id);
  const classSelect = el('select', { 'data-class': p.id, disabled: !mine });
  for (const cls of Object.values(CLASSES)) {
    const opt = el('option', { value: cls.id }, cls.name);
    if (p.classId === cls.id) opt.selected = true;
    classSelect.append(opt);
  }
  classSelect.addEventListener('change', () => {
    ctx.dispatch({ t: 'set_class', playerId: p.id, classId: classSelect.value });
  });

  return el(
    'div',
    { class: `card player-card${p.ready ? ' ready' : ''}` },
    el('div', { class: 'card-header' }, avatarPreview(p.appearance), el('strong', {}, p.name), mine && ctx.role !== 'hotseat' ? ' (vous)' : ''),
    el(
      'div',
      { class: 'customize' },
      ...(Object.keys(PALETTES) as (keyof Appearance)[]).map((f) => appearanceSelect(p, f, ctx, !mine)),
      el('label', { class: 'field' }, 'Classe', classSelect),
    ),
    el('p', { class: 'muted' }, CLASSES[p.classId]?.description ?? ''),
    el(
      'button',
      {
        class: p.ready ? 'btn ready' : 'btn',
        'data-ready': p.id,
        disabled: !mine,
        onclick: () => ctx.dispatch({ t: 'set_ready', playerId: p.id, ready: !p.ready }),
      },
      p.ready ? '✔ Prêt !' : 'Pas prêt',
    ),
  );
}

export function lobbyScreen(state: GameState, ctx: Ctx): HTMLElement {
  const nameInput = el('input', {
    'data-name-input': '',
    placeholder: 'Prénom de l’aventurier…',
    maxlength: '16',
  });

  const addPlayer = () => {
    const id = nextPlayerId(state.players);
    const name = nameInput.value.trim() || `Aventurier ${id.slice(1)}`;
    ctx.dispatch({ t: 'join', player: { id, name, connectionId: id } });
  };
  nameInput.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') addPlayer();
  });

  const allReady = state.players.length > 0 && state.players.every((p) => p.ready);
  const isGuest = ctx.role === 'guest';
  const presence = ctx.getPresence();

  return el(
    'div',
    { class: 'screen', 'data-screen': 'lobby' },
    el('h1', {}, 'Fabulesq'),
    el(
      'p',
      { class: 'muted' },
      ctx.role === 'hotseat'
        ? 'Roguelike coopératif — mode hot-seat (une machine pilote tout le monde).'
        : 'Partagez le code pour que vos amis rejoignent la partie.',
    ),
    el('p', {}, 'Code de la partie : ', el('strong', { class: 'code' }, state.code)),
    presence.length > 0
      ? el('p', { class: 'muted', 'data-presence': '' }, `🟢 En ligne : ${presence.join(', ')}`)
      : '',
    ctx.role === 'hotseat'
      ? el(
          'div',
          { class: 'add-player' },
          nameInput,
          el('button', { class: 'btn', 'data-add-player': '', onclick: addPlayer }, '+ Ajouter un joueur'),
        )
      : '',
    el('div', { class: 'cards' }, ...state.players.map((p) => playerCard(p, ctx))),
    el(
      'button',
      {
        class: 'btn btn-primary btn-big',
        'data-start-run': '',
        disabled: !allReady || isGuest,
        onclick: () => ctx.dispatch({ t: 'start_run' }),
      },
      state.players.length === 0
        ? 'Ajoutez au moins un joueur'
        : isGuest
          ? 'L’hôte lancera la partie…'
          : allReady
            ? '⚔ Lancer l’aventure !'
            : 'En attente que tout le monde soit prêt…',
    ),
  );
}
