// Bootstrap — Phase 0 : hello world + démonstration du déterminisme du PRNG.
import { createRngState, nextInt } from './engine/rng';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app introuvable');

const rolls: number[] = [];
let state = createRngState(42);
for (let i = 0; i < 5; i++) {
  const r = nextInt(state, 1, 6);
  rolls.push(r.value);
  state = r.state;
}

app.innerHTML = `
  <h1>Fabulesq</h1>
  <p>Hello world — Phase 0 : échafaudage &amp; déploiement.</p>
  <p>PRNG seedé (seed 42, 5d6) : <strong>${rolls.join(', ')}</strong> — toujours la même séquence.</p>
`;
