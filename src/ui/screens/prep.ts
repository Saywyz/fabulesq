// Écran de préparation d'expédition (Phase 7, version minimale) : chaque joueur choisit
// sa classe (kit de départ fixe), l'équipe choisit la bande de longueur, et le départ
// est donné quand tout le monde est prêt. L'assemblage de kit riche arrive en Phase 11.
import { CLASSES } from '../../engine/data/classes';
import { SKILLS } from '../../engine/data/skills';
import type { GameState, LengthBand, Player } from '../../engine/types';
import { skillCard } from '../components/skillCard';
import type { Ctx } from '../context';
import { el } from '../dom';
import { charSprite } from '../pixel/sprite';

const BANDS: { id: LengthBand; label: string; hint: string }[] = [
  { id: 'short', label: 'Courte', hint: '8–10 nœuds' },
  { id: 'medium', label: 'Moyenne', hint: '12–15 nœuds' },
  { id: 'long', label: 'Longue', hint: '16–20 nœuds' },
];

function prepCard(p: Player, ctx: Ctx): HTMLElement {
  const mine = ctx.canControl(p.id);

  const classSelect = el('select', { 'data-prep-class': p.id, disabled: !mine || p.ready });
  for (const cls of Object.values(CLASSES)) {
    const opt = el('option', { value: cls.id }, cls.name);
    if (p.classId === cls.id) opt.selected = true;
    classSelect.append(opt);
  }
  classSelect.addEventListener('change', () => {
    ctx.dispatch({ t: 'set_class', playerId: p.id, classId: classSelect.value });
  });

  const kit = el('div', { class: 'skills-row', 'data-kit': p.id });
  for (const skillId of p.skills) {
    const skill = SKILLS[skillId];
    if (!skill) continue;
    kit.append(skillCard(skill, { dataAttr: 'data-kit-skill', dataValue: `${p.id}:${skillId}`, disabled: true, onClick: () => {} }));
  }

  return el(
    'div',
    { class: `card player-card${p.ready ? ' ready' : ''}` },
    el('div', { class: 'card-header' }, charSprite(p.appearance, 3), el('strong', {}, p.name)),
    el('label', { class: 'field' }, 'Classe', classSelect),
    el('p', { class: 'muted' }, CLASSES[p.classId]?.description ?? ''),
    kit,
    el(
      'button',
      {
        class: p.ready ? 'btn ready' : 'btn',
        'data-prep-ready': p.id,
        disabled: !mine,
        onclick: () => ctx.dispatch({ t: 'prep_ready', playerId: p.id, ready: !p.ready }),
      },
      p.ready ? '✔ Paré au départ !' : 'Pas prêt',
    ),
  );
}

export function prepScreen(state: GameState, ctx: Ctx): HTMLElement {
  return el(
    'div',
    { class: 'screen', 'data-screen': 'prep' },
    el('h1', {}, '🗺️ Préparation de l’expédition'),
    el(
      'p',
      { class: 'muted' },
      'Toute la stratégie se joue ici : classes, kits… et la longueur de la route. Une fois partis, on ne revient pas.',
    ),
    el(
      'div',
      { class: 'panel band-picker' },
      el('strong', {}, 'Longueur de l’expédition (choix d’équipe) : '),
      ...BANDS.map((b) =>
        el(
          'button',
          {
            class: `btn${state.run.band === b.id ? ' btn-primary' : ''}`,
            'data-band': b.id,
            title: b.hint,
            onclick: () => ctx.dispatch({ t: 'set_length', band: b.id }),
          },
          `${state.run.band === b.id ? '✔ ' : ''}${b.label} (${b.hint})`,
        ),
      ),
    ),
    el('div', { class: 'cards' }, ...state.players.map((p) => prepCard(p, ctx))),
    el('p', { class: 'muted' }, 'L’expédition démarre dès que tout le monde est paré.'),
  );
}
