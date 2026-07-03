# DECISIONS.md — Journal des décisions par phase

> Ce fichier est **committé** (contrairement à `docs/`, ignoré par git) : c'est la mémoire
> du projet entre machines et entre sessions. Toute décision d'implémentation qui n'est pas
> évidente à la lecture des docs de `docs/` est consignée ici. Les phases font référence à
> `docs/BUILD_PLAN.md` ; l'architecture à `docs/TECH_ARCHITECTURE.md` ; les règles à
> `docs/GAME_DESIGN.md`.

**État : phases 0 → 6 terminées ; Build plan v2 en cours — Phase 7 (pivot expédition,
`schemaVersion 4`) terminée, Phase 8 (bestiaire & biomes) à venir.** 113 tests verts, déployé sur
https://saywyz.github.io/fabulesq/ (repo `Saywyz/fabulesq`, workflow Pages sur push `main`).

## Phase 0 — Échafaudage
- Stack installée : TypeScript 6 strict (+ `noUncheckedIndexedAccess`), Vite 8, Vitest 4, jsdom (tests UI).
- PRNG : **mulberry32 en fonctions pures** (`createRngState/next/nextInt` dans `engine/rng.ts`),
  état = uint32 sérialisable, aucun objet à état caché — `next(state)` retourne `{ value, state }`.
- `vite.config.ts` : `base: '/fabulesq/'` ; config Vitest intégrée (`test.include`).
- CI : `.github/workflows/deploy.yml` = test + build + déploiement Pages à chaque push `main`.
- `build` = `tsc --noEmit && vite build` (le type-check strict fait partie du build).

## Phase 1 — Cœur de jeu pur
- **Une seule `PlannedAction` par joueur et par round** (c'est ce que le type §4 impose) ;
  l'énergie sert de porte au coût (`cost ≤ energy`), déduite à la résolution, **rechargée à chaque round**.
- Initiative : joueurs d'abord puis ennemis (§4.1), chacun trié `speed` desc, départage par `id` asc.
- Statuts : brûlure = dégâts `stacks` puis −1 stack/tour ; poison = dégâts `stacks`, expire par durée ;
  **le `block` expire à chaque fin de round** ; durée `-1` = jusqu'à la fin du combat ;
  les statuts sont **remis à zéro à l'entrée de chaque combat** (menace aussi).
- Menace : +1 par point de dégât infligé (`threatPerDamage`) + effet `taunt` (montant fixe).
- Downed (§5.1/§8) : exclus de la planification et de l'initiative, DoT gelés ;
  revive à 50 % PV max (`revivedHpPct`) ; **les downed ressuscitent à 50 % à la fin de CHAQUE combat**
  (lecture : « niveau » du §8 ≈ nœud) ; cible morte à la résolution = action perdue sans redirection.
- Le reducer enchaîne seul les transitions déterministes (§5.1) : le dernier `confirm_action` résout
  le round ; `resolve_round`/`enter_node` restent dans l'union pour les tests.
- Charge du boss : intention `charge` au tour T → rien ce tour → à T+1 `assignIntents` la transforme
  en attaque télégraphiée forcée.
- Data : classe unique `warrior` (30 PV, speed 5, énergie 3, skills `strike`+`taunt_shout`) ;
  gelée frappe à **3** (pas 4) pour qu'un joueur solo survive au premier nœud avec un jeu naïf.
- Invariant testé : même seed + mêmes actions ⇒ états strictement égaux ; `stateId` strictement croissant ;
  `reduce` ne mute jamais l'entrée.

## Phase 2 — UI locale
- Rendu **re-render complet** `(state) => DOM` à chaque action (suffisant en tour par tour), routeur par phase.
- Contrat de test = attributs `data-*` (`data-skill`, `data-target`, `data-confirm`, `data-enemy`,
  `data-log`, `data-build`, `data-screen`…) — **ne pas les casser**, les tests d'intégration jsdom cliquent dessus.
- Sélection en cours (compétence en attente de cible) = état d'UI éphémère (`ui.pendingSkill`), jamais dans `GameState`.
- Ids hot-seat : `p1`, `p2`, … générés par le lobby.
- Le critère « partie complète jouable » est prouvé par un test jsdom qui joue une run entière au clic.

## Phase 3 — Réseau
- **Abstraction `Transport`** (send/onMessage/onPresence/close) : la logique host/guest est testée sur un
  transport loopback en mémoire (`net/loopback.ts`), Supabase n'est qu'une implémentation (`net/client.ts`).
- Sessions unifiées `GameSession` (hotseat/host/guest) — l'UI ne parle qu'à une session.
- Hôte = seul à exécuter le reducer ; broadcast d'un `STATE_SNAPSHOT` complet après chaque action appliquée ;
  répond aux `HELLO` par un snapshot (arrivée tardive). Invité : envoie des `Action`, applique les snapshots
  (garde `stateId` monotone contre les snapshots en retard), **n'exécute jamais le reducer**.
- Arrivée en cours de partie : le `join` est refusé hors lobby → spectateur (limite assumée).
- Ids en ligne : `crypto.randomUUID().slice(0,8)` ; canal `game:<CODE>` ; event broadcast unique `msg`.
- Env : `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`.env.local`, jamais committé).
- **CI/secrets — piège résolu** : les clés sont dans les *Environment secrets* de l'environnement
  `github-pages` → le job `build` y est rattaché (`environment: github-pages`) ; fallback `vars.*` ;
  le contexte `secrets` est interdit dans les `if:` GitHub Actions → mappé via l'`env` du job ;
  étapes-témoins `cles-supabase-presentes/manquantes` dans le workflow.

## Phase 4 — Contenu & équilibrage (schemaVersion 2)
- Types étendus : `Player.gold`, phases `node_event/node_rest/node_shop`, champs `event/restDone/shopOffers/shopDone`,
  actions `event_choice/rest_choice/shop_buy/shop_skip` (docs §4 mis à jour).
- Carte : layout fixe `combat → spécial → combat → élite → boss` (`nodeLayout`), le spécial **tourne par niveau**
  (`event` → `rest` → `shop`). Vagues en **rotation déterministe** (niveau + index de nœud), pas de tirage PRNG.
- Pool : 27 compétences (15 communes / 9 rares / 3 légendaires). Synergies : marque→`detonate_marks`,
  brûlure→`pyroclasm`, poison→`serpent_fang` (scale sans consommer), `war_cry`→`crushing_blow`,
  protection (`guardian_light`/`shield_wall`), débuffs d'équipe (`expose_armor`/`weakening_hex`).
- Sémantique `scalesWith` : `strength` = +1 dégât/stack EN PLUS du +1 générique ; `tag_count` = montant ×(1+stacks
  du statut `tag` sur la cible) ; `missing_hp` = +1 par 3 PV manquants (`scalingMissingHpDivisor`).
- Ennemis : + `cultist` (invoque des gelées, plafond `maxEnemies: 6`) et `shaman` (soigne l'allié le plus blessé).
- **Équilibrage par sweep de 20 seeds** (bot naïf 4 joueurs) : avant réglage 20/20 mortes à l'élite ;
  après (gobelin 6→5, élite ×1.15 PV / ×1.05 dégâts) ~1/3 atteint le boss. Tout dans `data/balance.ts`.
- Or : 15/30/50 par combat/élite/boss ; boutique : prix 20/35/60 par rareté, **un achat par visite** ;
  repos : soin 40 % OU **oublier** une compétence (l'« améliorer » de la forge n'est PAS implémenté — écarté) ;
  draft après élite/boss : table de rareté boostée (`eliteRarityWeights`).
- Événements data-driven (`data/events.ts`), pari 50/50 via le PRNG seedé ; hors combat on ne descend jamais sous 1 PV.

## Phase 5 — Pixel art & polish
- **Sprites 100 % programmatiques** : grilles de caractères dans `ui/pixel/pixelData.ts`, rendues sur canvas
  (`ui/pixel/sprite.ts`), CSS `image-rendering: pixelated`. Personnage 12×14 en couches corps→tenue→cheveux,
  palette-swap direct depuis `Appearance` (ombres auto via `shade()`). 4 coiffures, 4 tenues, 5 ennemis à palette fixe.
  Pour retoucher un sprite : éditer sa grille (texte), rien d'autre.
- La fidélité customisation↔jeu est testée via `canvas.dataset.sprite` (signature identique lobby/combat).
- **Sons synthétisés WebAudio** (`ui/sound.ts`), aucun fichier audio ; mute persistant (`localStorage`), bouton au header.
- UX combat : **planification séquentielle** (un joueur actif à la fois, y compris hot-seat) ; **ciblage en cliquant
  les cartes** ennemis/alliés (cartes = `<button data-target>` quand ciblables) ; re-clic sur la compétence = annuler ;
  compétences `all_*`/`self` planifiées au clic direct.
- Game feel : nombres flottants par diff des PV entre rendus (`ui.lastHp`), shake/flash des touchés, glow des soins,
  transitions d'écran au changement de phase (`ui.lastPhase`), journal auto-scrollé.
- jsdom n'a pas de canvas 2D : `getContext` est neutralisé dans les tests, le canvas reste un marqueur.

## Phase 6 — Robustesse & méta (schemaVersion 3)
- **Persistance/reprise** : table Supabase `games(code pk, state jsonb, updated_at)` — SQL dans
  `scripts/supabase-setup.sql` (RLS ouverte en lecture/écriture : limite assumée d'un jeu entre amis, §6.3).
  L'hôte sauvegarde après chaque action via `throttledSaver` (2,5 s, seule la dernière version part).
  Accueil → « Reprendre (hôte) » avec le code : recharge l'état, **celui qui reprend redevient l'hôte**
  (`localPlayerId = state.hostId` sauvegardé — on suppose que c'est bien lui). Dégradation silencieuse si la table manque.
- **Pause visible** : la présence Supabase porte `isHost` ; les invités affichent « ⏸ Hôte déconnecté » (header)
  quand aucun hôte n'est présent. Pas de migration d'hôte automatique (écartée).
- **Joueurs à terre occupés** : action `cheer` — un downed encourage un allié debout (+2 bouclier immédiat,
  `cheerBlock`), **une fois par round** (`CombatState.cheered`, remis à zéro chaque round).
- **Seed partagée** : champ seed optionnel à l'hébergement (nombre tel quel, sinon hash djb2 du texte) ;
  la seed de la run est affichée au game over pour la rejouer.
- **Méta-progression : volontairement écartée** (hors périmètre « solide » ; l'or/boutique existe depuis la Phase 4).

## Build plan v2 — amorçage (2026-07-03)
Pivot roguelike → **expédition** acté (voir `docs/BUILD_PLAN_V2.md`, Phases 7→11). Décisions validées :
- **D1** : croissance mid-run **minime** (soin, boon mineur occasionnel, choix de chemin — aucun draft).
  Si la playtest révèle une run « plate », réintroduction d'un petit pick en Phase 11, pas avant.
- **D2** : boutique itinérante retirée ; l'or devient un **budget de préparation** (Phase 7 = retrait
  boutique + gains d'or en run ; le budget d'achat de kit arrive avec la prépa riche en Phase 11).
- **D3** : carte procédurale **linéaire** à longueur variable (embranchements = amélioration ultérieure).
- **D4** : décors de biome **programmatiques** (zéro asset) ; vérification visuelle via Playwright en Phase 9.
- **D5** : bascule en planification **simultanée** (badge « prêt »), traitée en Phase 10.
Ordre imposé : moteur/données (7) → contenu (8) → visuels (9–10) → prépa riche + équilibrage (11).
`schemaVersion` 3 → 4 dès la Phase 7, avec gardes de version réseau (snapshot ignoré) et persistance
(sauvegarde v3 rejetée proprement).

## Phase 7 — Pivot expédition (schemaVersion 4)
- **`schemaVersion` 3 → 4 + gardes (invariant C1)** : `isCompatibleSnapshot` (net/protocol.ts) — l'invité
  ignore tout snapshot d'une autre version ; `isCompatibleSave` (net/persistence.ts) — « Reprendre »
  rejette une sauvegarde v3 avec un message clair (main.ts). Les sauvegardes v3 sont perdues : assumé.
- **Nouvelles phases** : `start_run` mène désormais à `prep` (plus jamais direct à la carte) ;
  `victory` = boss final vaincu (testée) ; `game_over` reste la défaite. Phases/champs/actions du
  draft et de la boutique supprimés (`reward_draft`, `node_shop`, `draftOffers/Picks`, `rerollsLeft`,
  `shopOffers/Done`, `Player.gold`).
- **Prépa minimale** : classe re-choisissable en prépa tant qu'on n'est pas paré (`set_class` verrouillé
  par `ready`) ; bande de longueur = choix d'équipe `set_length` (dernier clic l'emporte) ; le **dernier
  `prep_ready` génère l'expédition** (PRNG seedé) et donne le départ — même patron de chaînage que le
  dernier `confirm_action`.
- **`engine/expedition.ts`** : longueur tirée par bande (courte 8–10, moyenne 12–15, longue 16–20,
  `BALANCE.expeditionLength`) ; ordre des biomes par Fisher-Yates seedé ; segments contigus quasi égaux ;
  **jalon en fin de segment** (élite, boss final pour le dernier) ; un spécial (événement/repos, tiré au
  PRNG) au milieu des segments ≥ 3 ; le premier nœud est toujours un combat. `advanceNode` vit ici
  (évite un cycle d'imports reducer ↔ resolution).
- **Pacing** : `levelNumber` supprimé partout — remplacé par la progression normalisée
  `p = index/(total−1)` ; `scaledEnemyHp/Damage(base, p)` : +60 % PV et +35 % dégâts à p = 1
  (`pacingHpGrowthPct`/`pacingDamageGrowthPct`). Le multiplicateur élite s'y ajoute comme avant.
- **`data/biomes.ts`** : 3 biomes (forêt/château/volcan), chacun avec tables `combat/elite/boss`
  réutilisant le bestiaire existant ; rencontres par **rotation déterministe sur l'index du nœud**
  (pas de PRNG, décision Phase 4 conservée). Interface stable pour l'étoffage Phase 8.
- **D2 appliqué** : l'or n'existe plus dans le moteur ; événements : `gold_all` → `max_hp_all`
  (boon mineur : +PV max et +PV immédiats, conforme D1). `DRAFT_POOL` → `SKILL_POOL` (repris en
  Phase 11 pour l'assemblage de kit) ; `engine/draft.ts` supprimé.
- **Fins de combat** : victoire ordinaire → retour carte immédiat (nœud nettoyé, downed relevés à 50 %,
  plus aucun écran intermédiaire) ; boss final → `victory` avec seed affichée pour rejouer/partager.
- **UI minimale (le combat en cartes est conservé)** : écrans `prep` (`data-band`, `data-prep-ready`,
  `data-kit`, `data-prep-class`) et `victory` (`data-screen="victory"`, `data-new-game`) ; carte à
  route variable (`data-node`, `data-biome`) ; écrans draft/boutique supprimés.
- Tests : 113 verts (13 fichiers) dont `expedition.test.ts` (déterminisme, bornes de bande, structure,
  contiguïté des biomes) et les gardes de version (réseau + persistance). `npm run build` vert.

## Conventions transverses
- TDD systématique sur le moteur et le réseau : test écrit d'abord, échec constaté, implémentation minimale.
- Commits atomiques par phase, messages en français sans accents, poussés sur `main` (= déploiement).
- `docs/` est ignoré par git (choix utilisateur) → les décisions durables vivent ICI, dans ce fichier committé.
- Vérification avant toute annonce de fin : `npm run test` + `npm run build` exécutés avec sortie constatée.
- Smoke test Realtime : `node scripts/smoke-realtime.mjs` (lit `.env.local`).
