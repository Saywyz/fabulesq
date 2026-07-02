// Montage de l'application hot-seat : store minimal autour du reducer pur.
// state = reduce(state, action) puis re-rendu complet — simple et suffisant en tour par tour.
import { createInitialState, reduce } from '../engine/reducer';
import type { PlayerId, SkillId } from '../engine/types';
import type { Ctx, UiState } from './context';
import { render } from './render';

export interface MountOptions {
  seed: number;
  code: string;
}

export function mountApp(root: HTMLElement, opts: MountOptions): void {
  let state = createInitialState({ seed: opts.seed, hostId: 'p1', code: opts.code });
  const ui: UiState = { pendingSkill: {} };

  const ctx: Ctx = {
    ui,
    dispatch(action) {
      const next = reduce(state, action);
      if (next !== state) {
        state = next;
        ui.pendingSkill = {}; // toute action appliquée invalide la sélection en cours
      }
      rerender();
    },
    select(playerId: PlayerId, skillId: SkillId | null) {
      ui.pendingSkill = { ...ui.pendingSkill, [playerId]: skillId ?? undefined };
      rerender();
    },
  };

  function rerender(): void {
    root.replaceChildren(render(state, ctx));
  }
  rerender();
}
