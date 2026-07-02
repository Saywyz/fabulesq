// Sons synthétisés en WebAudio — pas de fichiers audio, tout est généré.
// Silencieux si l'API est absente (jsdom, vieux navigateurs) ; coupable via le header.

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  audioCtx ??= new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

const MUTE_KEY = 'fabulesq-muted';

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function toggleMute(): boolean {
  const muted = !isMuted();
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* stockage indisponible : tant pis */
  }
  return muted;
}

function blip(
  freq: number,
  duration: number,
  opts: { type?: OscillatorType; volume?: number; delay?: number; glideTo?: number } = {},
): void {
  if (isMuted()) return;
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + (opts.delay ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + duration);
  gain.gain.setValueAtTime(opts.volume ?? 0.035, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sound = {
  tick(): void {
    blip(880, 0.04, { type: 'triangle', volume: 0.02 });
  },
  hit(): void {
    blip(220, 0.12, { type: 'sawtooth', glideTo: 90, volume: 0.05 });
  },
  heal(): void {
    blip(520, 0.1, { type: 'sine', volume: 0.03 });
    blip(780, 0.12, { type: 'sine', volume: 0.03, delay: 0.09 });
  },
  gold(): void {
    blip(1180, 0.07, { type: 'triangle', volume: 0.03 });
    blip(1560, 0.09, { type: 'triangle', volume: 0.025, delay: 0.06 });
  },
  victory(): void {
    [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.14, { type: 'square', delay: i * 0.11, volume: 0.03 }));
  },
  defeat(): void {
    [392, 330, 262, 196].forEach((f, i) => blip(f, 0.22, { type: 'sawtooth', delay: i * 0.16, volume: 0.035 }));
  },
};
