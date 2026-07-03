// Persistance de la partie (Phase 6) : l'hôte sauvegarde le GameState dans une table
// Supabase indexée par code — reprise possible si son navigateur plante ou recharge.
// Dégradation silencieuse : table absente ou clés manquantes = fonctionnalité désactivée.
// Schéma attendu : voir scripts/supabase-setup.sql
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GameState } from '../engine/types';

export interface GameStore {
  save(code: string, state: GameState): Promise<void>;
  load(code: string): Promise<GameState | null>;
}

let warned = false;
function warnOnce(err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn('[fabulesq] persistance indisponible (table `games` absente ?) :', err);
}

/** Store Supabase, ou null si les clés ne sont pas configurées. */
export function createSupabaseStore(): GameStore | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return null;
  const supabase: SupabaseClient = createClient(url, anonKey);

  return {
    async save(code, state) {
      const { error } = await supabase
        .from('games')
        .upsert({ code, state, updated_at: new Date().toISOString() });
      if (error) warnOnce(error.message);
    },
    async load(code) {
      const { data, error } = await supabase.from('games').select('state').eq('code', code).maybeSingle();
      if (error) {
        warnOnce(error.message);
        return null;
      }
      return (data?.state as GameState | undefined) ?? null;
    },
  };
}

/**
 * Regroupe les sauvegardes : au plus une écriture par fenêtre, seule la dernière
 * version part en base (le stateId monotone rend les versions intermédiaires inutiles).
 */
export function throttledSaver(
  store: GameStore,
  intervalMs = 2500,
): (code: string, state: GameState) => void {
  let pending: { code: string; state: GameState } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    timer = null;
    if (!pending) return;
    const { code, state } = pending;
    pending = null;
    void store.save(code, state).catch(warnOnce);
  };

  return (code, state) => {
    pending = { code, state };
    timer ??= setTimeout(flush, intervalMs);
  };
}
