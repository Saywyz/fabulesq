// Routeur de rendu : (state) => DOM, un écran par phase.
import type { GameState } from '../engine/types';
import type { Ctx } from './context';
import { el } from './dom';
import { combatScreen } from './screens/combat';
import { gameOverScreen } from './screens/gameover';
import { lobbyScreen } from './screens/lobby';
import { mapScreen } from './screens/map';
import { eventScreen, restScreen } from './screens/nodes';
import { prepScreen } from './screens/prep';
import { victoryScreen } from './screens/victory';
import { isMuted, toggleMute } from './sound';

/** Barre persistante : titre, code de partie, pause éventuelle, coupe-son. */
function headerBar(state: GameState, ctx: Ctx): HTMLElement {
  const muteBtn = el(
    'button',
    { class: 'btn btn-mute', 'data-mute': '', title: 'Couper / activer le son' },
    isMuted() ? '🔇' : '🔊',
  );
  muteBtn.addEventListener('click', () => {
    muteBtn.textContent = toggleMute() ? '🔇' : '🔊';
  });
  return el(
    'header',
    { class: 'topbar' },
    el('span', { class: 'brand' }, '🗡 Fabulesq'),
    state.players.length > 0 || state.phase !== 'lobby'
      ? el('span', { class: 'chip code-chip' }, `code : ${state.code}`)
      : '',
    ctx.isHostOnline()
      ? ''
      : el('span', { class: 'chip pause-chip', 'data-paused': '' }, '⏸ Hôte déconnecté — partie en pause'),
    muteBtn,
  );
}

export function render(state: GameState, ctx: Ctx): HTMLElement {
  const phaseChanged = ctx.ui.lastPhase !== state.phase;
  ctx.ui.lastPhase = state.phase;
  return el(
    'div',
    { class: `app-shell${phaseChanged ? ' phase-enter' : ''}` },
    headerBar(state, ctx),
    screenFor(state, ctx),
  );
}

function screenFor(state: GameState, ctx: Ctx): HTMLElement {
  switch (state.phase) {
    case 'lobby':
    case 'customize':
      return lobbyScreen(state, ctx);
    case 'prep':
      return prepScreen(state, ctx);
    case 'map':
      return mapScreen(state, ctx);
    case 'combat_intent':
    case 'combat_planning':
    case 'combat_resolution':
      return combatScreen(state, ctx);
    case 'node_event':
      return eventScreen(state, ctx);
    case 'node_rest':
      return restScreen(state, ctx);
    case 'victory':
      return victoryScreen(state, ctx);
    case 'game_over':
      return gameOverScreen(state, ctx);
  }
}
