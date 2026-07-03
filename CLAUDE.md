# CLAUDE.md — Roguelike coopératif (nom de code : *à définir*)

> Ce fichier est le contrat de travail. Il reste court et stable.
> Le détail vit dans `docs/` — **lis ces docs avant de coder** (voir « Index » plus bas).

## Le projet en 5 lignes
- Jeu **RPG tour par tour, roguelike, coopératif en ligne**, jouable dans le navigateur.
- Modèle **host + code** : un joueur héberge une partie, les autres rejoignent via un code.
- Front **100 % statique** hébergé sur **GitHub Pages**. Aucun serveur applicatif à nous.
- Temps réel via **Supabase Realtime** (Broadcast + Presence) — le « tuyau » websocket uniquement.
- Modèle **host-authoritative** : la logique tourne dans le navigateur de l'hôte, qui diffuse l'état.

## Stack & contraintes (non négociables)
- **TypeScript strict** + **Vite**. Build statique déployable sur GitHub Pages.
- **Aucune dépendance serveur.** Pas de backend Node à nous, pas de VPS.
- Le **cœur de jeu (`src/engine/`) est pur et déterministe** : aucune référence au DOM, au réseau, à `Date.now()` ou à `Math.random()`. Toute aléa passe par le PRNG seedé de `src/engine/rng.ts`.
- Séparation stricte en 3 couches : `engine/` (logique pure) · `net/` (Supabase) · `ui/` (rendu DOM). Les dépendances vont toujours de `ui`/`net` **vers** `engine`, jamais l'inverse.
- Tests unitaires sur `engine/` avec **Vitest**. Un changement de règle de jeu = un test.

## Conventions de code
- Nommage des types/interfaces en anglais (voir `docs/TECH_ARCHITECTURE.md`). Prose et commentaires métier en français OK.
- Le cœur expose un réducteur pur : `reduce(state, action) => newState`. Il ne mute jamais l'état en place (immutabilité).
- Pas de logique de jeu dans l'UI. L'UI lit l'état et émet des `Action`. Elle ne calcule pas de dégâts.
- Commits petits et atomiques, un par étape du plan de build.

## Manière de travailler avec ce repo
1. **Avant de coder une étape** : lis la doc concernée, restitue ton plan, pose tes questions. Ne code pas d'un bloc tout le jeu.
2. On avance **phase par phase** en suivant `docs/BUILD_PLAN.md`. On ne passe à la phase N+1 qu'une fois les critères d'acceptation de la phase N validés.
3. Le réseau (`net/`) n'est branché qu'en **Phase 3**, une fois le cœur solide et testé. Ne pas anticiper.
4. En cas de doute sur une règle de jeu, la source de vérité est `docs/GAME_DESIGN.md`. Pour l'archi technique, `docs/TECH_ARCHITECTURE.md`.

## Commandes
- `npm run dev` — serveur de dev Vite
- `npm run build` — build statique dans `dist/`
- `npm run test` — tests Vitest (cœur de jeu)
- `npm run preview` — prévisualise le build

## Index des docs (source de vérité)
- `docs/GAME_DESIGN.md` — règles, systèmes, boucle de jeu, équilibrage. **Le « quoi ».**
- `docs/TECH_ARCHITECTURE.md` — arborescence, modèle de données (types), machine à états du combat, protocole Supabase. **Le « comment ».**
- `docs/BUILD_PLAN.md` — phases, critères d'acceptation, ordre de construction. **Le « dans quel ordre ».**
- `DECISIONS.md` (racine, **committé** — `docs/` ne l'est pas) — journal des décisions d'implémentation prises à chaque phase. **Le « pourquoi c'est comme ça ». À lire en premier si tu reprends le projet.**
