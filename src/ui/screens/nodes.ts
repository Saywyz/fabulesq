// Écrans des nœuds hors combat (Phase 4) : événement, repos/forge, boutique.
import { BALANCE } from '../../engine/data/balance';
import { EVENTS } from '../../engine/data/events';
import { SKILLS } from '../../engine/data/skills';
import type { GameState, Player } from '../../engine/types';
import { hpBar } from '../components/bars';
import { skillCard } from '../components/skillCard';
import type { Ctx } from '../context';
import { el } from '../dom';

/** Le joueur au nom duquel ce client parle (hot-seat : le premier). */
function localActor(state: GameState, ctx: Ctx): Player {
  return state.players.find((p) => ctx.canControl(p.id)) ?? state.players[0]!;
}

// ————— Événement —————

export function eventScreen(state: GameState, ctx: Ctx): HTMLElement {
  const template = EVENTS.find((e) => e.id === state.event?.id);
  if (!template) return el('div', { class: 'screen' }, el('h1', {}, '…'));
  const actor = localActor(state, ctx);

  return el(
    'div',
    { class: 'screen', 'data-screen': 'event' },
    el('h1', {}, `❓ ${template.title}`),
    el('p', { class: 'event-text' }, template.text),
    el(
      'div',
      { class: 'cards' },
      ...template.options.map((opt, i) =>
        el(
          'div',
          { class: 'card' },
          el('h2', {}, opt.label),
          el('p', { class: 'muted' }, opt.hint),
          el(
            'button',
            {
              class: 'btn btn-primary',
              'data-event-option': String(i),
              onclick: () => ctx.dispatch({ t: 'event_choice', playerId: actor.id, optionIndex: i }),
            },
            'Choisir',
          ),
        ),
      ),
    ),
    el('p', { class: 'muted' }, 'Décision d’équipe : le premier clic l’emporte.'),
  );
}

// ————— Repos / forge —————

function restPanel(p: Player, state: GameState, ctx: Ctx): HTMLElement {
  const done = state.restDone[p.id];
  const mine = ctx.canControl(p.id);
  const panel = el(
    'div',
    { class: 'card' },
    el('div', { class: 'card-header' }, el('strong', {}, p.name)),
    hpBar(p.hp, p.maxHp),
  );
  if (done) {
    panel.append(el('p', { class: 'muted' }, '✔ choix fait'));
    return panel;
  }
  if (!mine) {
    panel.append(el('p', { class: 'muted' }, '… réfléchit'));
    return panel;
  }
  panel.append(
    el(
      'button',
      {
        class: 'btn btn-primary',
        'data-rest-heal': p.id,
        onclick: () => ctx.dispatch({ t: 'rest_choice', playerId: p.id, choice: 'heal' }),
      },
      `🏕️ Se reposer (+${BALANCE.restHealPct} % PV)`,
    ),
  );
  if (p.skills.length > 1) {
    const forgeRow = el('div', { class: 'targets-row' }, el('span', { class: 'muted' }, 'Ou oublier : '));
    for (const skillId of p.skills) {
      forgeRow.append(
        el(
          'button',
          {
            class: 'btn',
            'data-rest-forget': `${p.id}:${skillId}`,
            onclick: () => ctx.dispatch({ t: 'rest_choice', playerId: p.id, choice: 'forget', skillId }),
          },
          `🔥 ${SKILLS[skillId]?.name ?? skillId}`,
        ),
      );
    }
    panel.append(forgeRow);
  }
  return panel;
}

export function restScreen(state: GameState, ctx: Ctx): HTMLElement {
  return el(
    'div',
    { class: 'screen', 'data-screen': 'rest' },
    el('h1', {}, '🏕️ Repos / forge'),
    el('p', { class: 'muted' }, 'Chacun choisit : se soigner, ou oublier une compétence à la forge.'),
    el('div', { class: 'cards' }, ...state.players.map((p) => restPanel(p, state, ctx))),
  );
}

// ————— Boutique —————

function shopPanel(p: Player, state: GameState, ctx: Ctx): HTMLElement {
  const done = state.shopDone[p.id];
  const mine = ctx.canControl(p.id);
  const offers = state.shopOffers[p.id] ?? [];
  const panel = el(
    'div',
    { class: 'card' },
    el('div', { class: 'card-header' }, el('strong', {}, p.name), el('span', { class: 'chip' }, `💰 ${p.gold}`)),
  );
  if (done) {
    panel.append(el('p', { class: 'muted' }, '✔ a fini ses emplettes'));
    return panel;
  }
  if (!mine) {
    panel.append(el('p', { class: 'muted' }, '… fait les boutiques'));
    return panel;
  }
  const row = el('div', { class: 'skills-row' });
  for (const skillId of offers) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    const price = BALANCE.shopPrices[skill.rarity];
    row.append(
      el(
        'div',
        { class: 'shop-item' },
        skillCard(skill, {
          dataAttr: 'data-shop-buy',
          dataValue: `${p.id}:${skillId}`,
          disabled: p.gold < price,
          onClick: () => ctx.dispatch({ t: 'shop_buy', playerId: p.id, skillId }),
        }),
        el('span', { class: 'chip price' }, `💰 ${price}`),
      ),
    );
  }
  panel.append(row);
  panel.append(
    el(
      'button',
      {
        class: 'btn',
        'data-shop-skip': p.id,
        onclick: () => ctx.dispatch({ t: 'shop_skip', playerId: p.id }),
      },
      'Passer son tour',
    ),
  );
  return panel;
}

export function shopScreen(state: GameState, ctx: Ctx): HTMLElement {
  return el(
    'div',
    { class: 'screen', 'data-screen': 'shop' },
    el('h1', {}, '🛒 La boutique du colporteur'),
    el('p', { class: 'muted' }, 'Un achat par visite. L’or se gagne en combattant.'),
    el('div', { class: 'cards' }, ...state.players.map((p) => shopPanel(p, state, ctx))),
  );
}
