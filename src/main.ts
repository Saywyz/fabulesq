// Bootstrap : câble net + ui + engine (TECH_ARCHITECTURE.md §3).
// Hors de engine/ : Math.random / Date.now sont autorisés ici (seed, code, ids).
import './ui/style.css';
import { createInitialState } from './engine/reducer';
import { connectTransport, isOnlineAvailable } from './net/client';
import { createGuestSession } from './net/guest';
import { createHostSession } from './net/host';
import { createHotseatSession, mountSession } from './ui/app';
import { el } from './ui/dom';
import { homeScreen } from './ui/screens/home';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app introuvable');
const root = app;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 ambigus
const generateCode = (): string =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const generateId = (): string => crypto.randomUUID().slice(0, 8);
const generateSeed = (): number => Date.now() >>> 0;

function splash(message: string): void {
  root.replaceChildren(el('div', { class: 'screen' }, el('h1', {}, message)));
}

function showHome(error?: string): void {
  root.replaceChildren(
    homeScreen({
      onlineAvailable: isOnlineAvailable(),
      error,

      onLocal() {
        mountSession(root, createHotseatSession({ seed: generateSeed(), code: generateCode() }));
      },

      async onHost(name) {
        splash('Création de la partie…');
        try {
          const code = generateCode();
          const myId = generateId();
          const transport = await connectTransport({ code, presenceKey: myId, presenceName: name });
          const initial = createInitialState({ seed: generateSeed(), hostId: myId, code });
          const session = createHostSession({ initial, transport, localPlayerId: myId });
          session.dispatch({ t: 'join', player: { id: myId, name, connectionId: myId } });
          mountSession(root, session);
        } catch (e) {
          showHome(e instanceof Error ? e.message : String(e));
        }
      },

      async onJoin(name, code) {
        if (!code) {
          showHome('Entrez le code de la partie à rejoindre.');
          return;
        }
        splash(`Connexion à ${code}…`);
        try {
          const myId = generateId();
          const transport = await connectTransport({ code, presenceKey: myId, presenceName: name });
          const session = createGuestSession({ transport, senderId: myId, localPlayerId: myId });
          // L'HELLO (envoyé par la session) déclenche le snapshot ; le join s'applique en lobby.
          session.dispatch({ t: 'join', player: { id: myId, name, connectionId: myId } });
          mountSession(root, session);
        } catch (e) {
          showHome(e instanceof Error ? e.message : String(e));
        }
      },
    }),
  );
}

showHome();
