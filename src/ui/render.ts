// Routeur de rendu : (state) => DOM, un écran par phase.
import type { GameState } from '../engine/types';
import type { Ctx } from './context';
import { combatScreen } from './screens/combat';
import { draftScreen } from './screens/draft';
import { gameOverScreen } from './screens/gameover';
import { lobbyScreen } from './screens/lobby';
import { mapScreen } from './screens/map';

export function render(state: GameState, ctx: Ctx): HTMLElement {
  switch (state.phase) {
    case 'lobby':
    case 'customize':
      return lobbyScreen(state, ctx);
    case 'map':
      return mapScreen(state, ctx);
    case 'combat_intent':
    case 'combat_planning':
    case 'combat_resolution':
      return combatScreen(state, ctx);
    case 'reward_draft':
      return draftScreen(state, ctx);
    case 'game_over':
      return gameOverScreen(state, ctx);
  }
}
