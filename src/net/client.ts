// Transport Supabase Realtime : Broadcast (messages) + Presence (connectés).
// Un canal unique par partie : game:<CODE> (§6.1). Aucune logique de jeu ici.
import { createClient } from '@supabase/supabase-js';
import type { NetMessage } from './protocol';
import type { PresencePeer, Transport } from './transport';

const BROADCAST_EVENT = 'msg';

export function isOnlineAvailable(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export interface ConnectOptions {
  code: string;
  presenceKey: string; // connectionId unique du client
  presenceName: string; // prénom affiché
  isHost: boolean; // porté par la présence : les invités détectent la pause
}

export async function connectTransport(opts: ConnectOptions): Promise<Transport> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error('Supabase non configuré : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes.');
  }

  const supabase = createClient(url, anonKey);
  const channel = supabase.channel(`game:${opts.code}`, {
    config: {
      broadcast: { self: false },
      presence: { key: opts.presenceKey },
    },
  });

  const messageCbs = new Set<(msg: NetMessage) => void>();
  const presenceCbs = new Set<(peers: PresencePeer[]) => void>();

  channel.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
    messageCbs.forEach((cb) => cb(payload as NetMessage));
  });
  channel.on('presence', { event: 'sync' }, () => {
    const entries = Object.values(channel.presenceState<PresencePeer>());
    const peers = entries
      .flatMap((metas) => metas.map((m) => ({ name: m.name, isHost: Boolean(m.isHost) })))
      .filter((p) => p.name);
    presenceCbs.forEach((cb) => cb(peers));
  });

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ name: opts.presenceName, isHost: opts.isHost });
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Connexion Supabase impossible (${status}).`));
      }
    });
  });

  return {
    send(msg) {
      void channel.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: msg });
    },
    onMessage(cb) {
      messageCbs.add(cb);
      return () => messageCbs.delete(cb);
    },
    onPresence(cb) {
      presenceCbs.add(cb);
      return () => presenceCbs.delete(cb);
    },
    close() {
      void supabase.removeChannel(channel);
    },
  };
}
