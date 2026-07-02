// Barres de vie et jauges d'énergie.
import { el } from '../dom';

export function hpBar(hp: number, maxHp: number): HTMLElement {
  const pct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  return el(
    'div',
    { class: 'hp-bar' },
    el('div', { class: 'hp-fill', style: `width:${pct}%` }),
    el('span', { class: 'hp-label' }, `${hp}/${maxHp}`),
  );
}

export function energyDots(energy: number, maxEnergy: number): HTMLElement {
  return el('span', { class: 'energy' }, `⚡ ${energy}/${maxEnergy}`);
}
