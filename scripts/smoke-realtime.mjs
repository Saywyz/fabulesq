// Smoke test Supabase Realtime : subscribe + broadcast en écho sur un canal jetable.
// Usage : node scripts/smoke-realtime.mjs  (lit .env.local, n'affiche jamais les clés)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('KO : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absentes de .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);
const channel = supabase.channel('game:SMOKE0', { config: { broadcast: { self: true } } });

const timeout = setTimeout(() => {
  console.error('KO : pas d’écho broadcast reçu en 15 s');
  process.exit(1);
}, 15000);

channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
  if (payload?.ping === 'fabulesq') {
    clearTimeout(timeout);
    console.log('OK : Realtime subscribe + broadcast fonctionnels');
    void supabase.removeChannel(channel).then(() => process.exit(0));
  }
});

channel.subscribe((status) => {
  console.log(`statut canal : ${status}`);
  if (status === 'SUBSCRIBED') {
    void channel.send({ type: 'broadcast', event: 'msg', payload: { ping: 'fabulesq' } });
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.error(`KO : ${status}`);
    process.exit(1);
  }
});
