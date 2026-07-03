// Montage de l'application autour d'une GameSession (hot-seat, hôte ou invité).
// L'UI ne connaît que la session : elle lit l'état et émet des Action.
import { createInitialState, reduce } from '../engine/reducer';
import type { GameSession } from '../net/session';
import type { GameState, PlayerId, SkillId } from '../engine/types';
import type { Ctx, UiState } from './context';
import { el } from './dom';
import { render } from './render';
import { sound } from './sound';

export interface HotseatOptions {
  seed: number;
  code: string;
}

/** Session locale : le reducer tourne sur place, tous les joueurs sont pilotables. */
export function createHotseatSession(opts: HotseatOptions): GameSession {
  let state = createInitialState({ seed: opts.seed, hostId: 'p1', code: opts.code });
  const listeners = new Set<() => void>();
  return {
    role: 'hotseat',
    getState: () => state,
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      listeners.forEach((cb) => cb());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    canControl: () => true,
    getPresence: () => [],
    isHostOnline: () => true,
    leave() {},
  };
}

/** Bruitages pilotés par les transitions d'état (le rendu reste muet). */
function playTransitionSounds(prev: GameState | null, next: GameState | null): void {
  if (!prev || !next || prev === next) return;
  if (prev.phase !== next.phase) {
    if (next.phase === 'reward_draft') sound.victory();
    else if (next.phase === 'game_over') sound.defeat();
    else if (next.phase === 'node_shop') sound.gold();
  }
  const hpOf = (s: GameState): Map<string, number> => {
    const m = new Map<string, number>();
    for (const p of s.players) m.set(p.id, p.hp);
    for (const e of s.combat?.enemies ?? []) m.set(e.id, e.hp);
    return m;
  };
  const before = hpOf(prev);
  let hurt = false;
  let healed = false;
  for (const [id, hp] of hpOf(next)) {
    const was = before.get(id);
    if (was !== undefined && hp < was) hurt = true;
    if (was !== undefined && hp > was) healed = true;
  }
  if (hurt) sound.hit();
  else if (healed) sound.heal();
}

export function mountSession(root: HTMLElement, session: GameSession): void {
  const ui: UiState = { pendingSkill: {}, lastHp: {} };
  let prevState = session.getState();

  const ctx: Ctx = {
    ui,
    role: session.role,
    dispatch: (action) => session.dispatch(action),
    select(playerId: PlayerId, skillId: SkillId | null) {
      ui.pendingSkill = { ...ui.pendingSkill, [playerId]: skillId ?? undefined };
      rerender();
    },
    canControl: (playerId) => session.canControl(playerId),
    getPresence: () => session.getPresence(),
    isHostOnline: () => session.isHostOnline(),
  };

  /** Une sélection devient obsolète dès que l'action est planifiée ou que la phase change. */
  function cleanPendingSelections(): void {
    const state = session.getState();
    for (const pid of Object.keys(ui.pendingSkill)) {
      if (!state || state.phase !== 'combat_planning' || state.combat?.planned[pid]) {
        delete ui.pendingSkill[pid];
      }
    }
  }

  function rerender(): void {
    const state = session.getState();
    root.replaceChildren(
      state
        ? render(state, ctx)
        : el('div', { class: 'screen' }, el('h1', {}, 'Connexion à la partie…')),
    );
  }

  // Petit tic sonore sur chaque bouton (initialise aussi l'AudioContext sur geste utilisateur).
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest?.('button')) sound.tick();
  });

  session.subscribe(() => {
    const next = session.getState();
    playTransitionSounds(prevState, next);
    prevState = next;
    cleanPendingSelections();
    rerender();
  });
  rerender();
}

/** Point d'entrée hot-seat (conservé pour les tests et le mode local). */
export function mountApp(root: HTMLElement, opts: HotseatOptions): void {
  mountSession(root, createHotseatSession(opts));
}
