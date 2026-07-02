// Chips de statuts (lecture seule de l'état).
import { el } from '../dom';
import type { Combatant, StatusKind } from '../../engine/types';

const ICONS: Record<StatusKind, string> = {
  burn: '🔥',
  poison: '☠️',
  bleed: '🩸',
  stun: '💫',
  slow: '🐌',
  shield: '🛡️',
  regen: '💚',
  strength: '💪',
  vulnerable: '💔',
  weak: '😵',
  dodge: '💨',
  mark: '🎯',
};

export function statusChips(c: Combatant): HTMLElement {
  const wrap = el('div', { class: 'statuses' });
  if (c.block > 0) wrap.append(el('span', { class: 'chip chip-block', title: 'bouclier' }, `🛡️ ${c.block}`));
  for (const s of c.statuses) {
    const dur = s.duration === -1 ? '' : ` (${s.duration}t)`;
    wrap.append(el('span', { class: `chip chip-${s.kind}`, title: s.kind }, `${ICONS[s.kind]} ${s.stacks}${dur}`));
  }
  return wrap;
}
