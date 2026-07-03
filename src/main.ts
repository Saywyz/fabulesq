// Bootstrap : câble net + ui + engine (TECH_ARCHITECTURE.md §3).
// Hors de engine/ : Math.random / Date.now sont autorisés ici (seed, code, ids).
import './ui/style.css';
import { createInitialState } from './engine/reducer';
import { connectTransport, isOnlineAvailable } from './net/client';
import { createGuestSession } from './net/guest';
import { createHostSession } from './net/host';
import { createSupabaseStore, isCompatibleSave, throttledSaver } from './net/persistence';
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

/** Seed saisie librement : nombre tel quel, sinon hash djb2 du texte (défis partagés). */
function parseSeed(input: string): number {
  if (!input) return generateSeed();
  const n = Number(input);
  if (Number.isFinite(n)) return Math.trunc(n) >>> 0;
  let hash = 5381;
  for (const char of input) hash = (hash * 33) ^ char.charCodeAt(0);
  return hash >>> 0;
}

const store = createSupabaseStore();
const persist = store ? throttledSaver(store) : undefined;

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

      async onHost(name, seedText) {
        splash('Création de la partie…');
        try {
          const code = generateCode();
          const myId = generateId();
          const transport = await connectTransport({ code, presenceKey: myId, presenceName: name, isHost: true });
          const initial = createInitialState({ seed: parseSeed(seedText), hostId: myId, code });
          const session = createHostSession({
            initial,
            transport,
            localPlayerId: myId,
            persist: persist ? (s) => persist(code, s) : undefined,
          });
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
          const transport = await connectTransport({ code, presenceKey: myId, presenceName: name, isHost: false });
          const session = createGuestSession({ transport, senderId: myId, localPlayerId: myId });
          // L'HELLO (envoyé par la session) déclenche le snapshot ; le join s'applique en lobby.
          session.dispatch({ t: 'join', player: { id: myId, name, connectionId: myId } });
          mountSession(root, session);
        } catch (e) {
          showHome(e instanceof Error ? e.message : String(e));
        }
      },

      // Reprise après plantage/rechargement de l'hôte : l'état vit dans la table `games`.
      async onResume(code) {
        if (!code) {
          showHome('Entrez le code de la partie à reprendre.');
          return;
        }
        if (!store) {
          showHome('Persistance non configurée.');
          return;
        }
        splash(`Récupération de ${code}…`);
        try {
          const saved = await store.load(code);
          if (!saved) {
            showHome(`Aucune sauvegarde trouvée pour ${code}.`);
            return;
          }
          if (!isCompatibleSave(saved)) {
            showHome(
              `La sauvegarde ${code} vient d'une autre version du jeu (v${saved.schemaVersion}) : impossible de la reprendre.`,
            );
            return;
          }
          const hostName = saved.players.find((p) => p.id === saved.hostId)?.name ?? 'Hôte';
          const transport = await connectTransport({
            code,
            presenceKey: saved.hostId,
            presenceName: hostName,
            isHost: true,
          });
          // Celui qui reprend redevient l'hôte et repilote son joueur d'origine.
          const session = createHostSession({
            initial: saved,
            transport,
            localPlayerId: saved.hostId,
            persist: persist ? (s) => persist(code, s) : undefined,
          });
          mountSession(root, session);
        } catch (e) {
          showHome(e instanceof Error ? e.message : String(e));
        }
      },
    }),
  );
}

showHome();
