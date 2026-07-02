// Paire de transports reliés en mémoire — pour les tests et le debug local.
// Livraison synchrone, contrôlable (pause/flush) pour simuler la latence.
import type { NetMessage } from './protocol';
import type { Transport } from './transport';

export interface LinkedPair {
  a: Transport;
  b: Transport;
  pause(): void;
  flush(): void;
}

export function linkedPair(): LinkedPair {
  let paused = false;
  const queue: Array<() => void> = [];
  const cbsA = new Set<(m: NetMessage) => void>();
  const cbsB = new Set<(m: NetMessage) => void>();

  const make = (peers: Set<(m: NetMessage) => void>, own: Set<(m: NetMessage) => void>): Transport => ({
    send(msg) {
      const deliver = () => peers.forEach((cb) => cb(msg));
      if (paused) queue.push(deliver);
      else deliver();
    },
    onMessage(cb) {
      own.add(cb);
      return () => own.delete(cb);
    },
    close() {
      own.clear();
    },
  });

  return {
    a: make(cbsB, cbsA),
    b: make(cbsA, cbsB),
    pause() {
      paused = true;
    },
    flush() {
      paused = false;
      while (queue.length) queue.shift()!();
    },
  };
}
