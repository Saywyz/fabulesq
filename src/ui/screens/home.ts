// Écran d'accueil : jouer en local (hot-seat), héberger en ligne, ou rejoindre par code.
import { el } from '../dom';

export interface HomeHandlers {
  onlineAvailable: boolean;
  error?: string;
  onLocal(): void;
  onHost(name: string): void;
  onJoin(name: string, code: string): void;
}

export function homeScreen(handlers: HomeHandlers): HTMLElement {
  const nameInput = el('input', { 'data-home-name': '', placeholder: 'Votre prénom…', maxlength: '16' });
  const codeInput = el('input', {
    'data-home-code': '',
    placeholder: 'CODE',
    maxlength: '8',
    style: 'text-transform:uppercase;letter-spacing:2px;width:120px',
  });

  const playerName = () => nameInput.value.trim() || 'Aventurier';

  return el(
    'div',
    { class: 'screen', 'data-screen': 'home' },
    el('h1', {}, 'Fabulesq'),
    el('p', { class: 'muted' }, 'Roguelike coopératif en tour par tour. Construisez vos builds… ensemble.'),
    handlers.error ? el('p', { class: 'error', 'data-error': '' }, `⚠ ${handlers.error}`) : '',
    el(
      'div',
      { class: 'card home-card' },
      el('h2', {}, '🖥️ Sur cette machine'),
      el('p', { class: 'muted' }, 'Hot-seat : une seule machine pilote tous les joueurs.'),
      el('button', { class: 'btn btn-primary', 'data-mode-local': '', onclick: () => handlers.onLocal() }, 'Jouer en local'),
    ),
    el(
      'div',
      { class: 'card home-card' },
      el('h2', {}, '🌐 En ligne'),
      handlers.onlineAvailable
        ? el(
            'div',
            { class: 'home-online' },
            el('label', { class: 'field' }, 'Prénom', nameInput),
            el(
              'div',
              { class: 'home-actions' },
              el(
                'button',
                { class: 'btn btn-primary', 'data-mode-host': '', onclick: () => handlers.onHost(playerName()) },
                'Héberger une partie',
              ),
              el('span', { class: 'muted' }, ' ou '),
              codeInput,
              el(
                'button',
                {
                  class: 'btn',
                  'data-mode-join': '',
                  onclick: () => handlers.onJoin(playerName(), codeInput.value.trim().toUpperCase()),
                },
                'Rejoindre',
              ),
            ),
          )
        : el('p', { class: 'muted' }, 'Mode en ligne indisponible : clés Supabase non configurées au build.'),
    ),
  );
}
