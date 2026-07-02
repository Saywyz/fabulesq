// Carte de compétence cliquable. L'UI lit les données, ne calcule aucune règle.
import { el } from '../dom';
import type { Skill } from '../../engine/types';

export function skillCard(
  skill: Skill,
  opts: { dataAttr: string; dataValue: string; disabled?: boolean; selected?: boolean; onClick: EventListener },
): HTMLElement {
  return el(
    'button',
    {
      class: `skill-card rarity-${skill.rarity}${opts.selected ? ' selected' : ''}`,
      [opts.dataAttr]: opts.dataValue,
      disabled: opts.disabled ?? false,
      onclick: opts.onClick,
      title: skill.description,
    },
    el('span', { class: 'skill-name' }, skill.name),
    el('span', { class: 'skill-cost' }, `⚡${skill.cost}`),
    el('span', { class: 'skill-tags' }, skill.tags.join(' · ')),
  );
}
