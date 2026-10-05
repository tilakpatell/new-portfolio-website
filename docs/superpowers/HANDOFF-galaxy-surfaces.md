# Handoff: galaxy surfaces (land on Star Wars worlds, explore, do things)

Branch: `claude/inspiring-rubin-rjq2tf` (merged to main as it goes). Route `/galaxy/:id/surface`, page `src/pages/GalaxySurface.jsx`, engine `src/components/galaxy/surface/`.

## The user's rules (don't break)
- **No sequel trilogy (Ep 7–9) anywhere.** After Ep 6 only The Mandalorian and Ahsoka. Remove Ahch-To (porgs, `jedihut`, `porg` in `catalog/edge.js`, `porg` in `figures.js`), Jakku, Starkiller, Exegol, Crait, First Order, Resistance, BB-8, Rey, Kylo etc. wherever they still are.
- Every planet: unique things to do (not just "land and walk"). Tatooine is the model to copy.
- Better Luke/Han/crew models. Merge to main as pieces finish. Keep output terse.
- Don't edit the ship-customisation session's files: `shipModels.js, hulls.js, livery.js, modules.js, outfit.js, paint.js, Hangar.jsx`; don't swap `xwing-hd.glb`/`falcon-hd.glb`; keep `/models/universe/falcon.glb`.
- Never print/commit `SKETCHFAB_API_TOKEN` / `MESHY_API_KEY`. They exist only in new cloud sessions of env `env_01BbURYhNwYZsDf8J6xhUknR` (spawn a worker session there to use them).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: …` line. CI runs only on push to main (lint, test, build, deploy): run `npx eslint .`, `npx vitest run`, `npx vite build` before merging.

## How it works (read these headers first)
- `sites/index.js` — what a site is (places, zones, quests, life, rides, …). `sites/<group>.js` per world group.
- `quests.js` — pure quest state machine (steps: reach, talk, collect, shoot, ride, race, use, enter, trip). Steps can have `zone`, `level`, `start`/`end` effects (`signal`, `floor`/`solid` + `off`, `kill`, `hide`/`show`, `music`, `sound`, `shake`, `say`, `to`, `leave`), `respawn`, `spawn` (activity.js targets; `hostile: { range, every, damage, chase, melee, reach, delay }`).
- `activity.js` (quest things in the world), `blaster.js`, `actors.js` (NPCs; `id`, `quest`, `reach`, `level`, `hidden`), `figures.js` (built figures: people/aliens/beasts/Hutt), `props/*.js` (code-built props; `props/inside.js` = interiors), `placer.js` (models vs built, solids with `top`/`base`/`tag`, floors with `tag`, `signal`), `walker.js`, `sounds.js` (ambience + band tunes `cantina`/`palace`, `roar`, `laugh`, `crash`, `blast`).
- Zones (interiors) are built at y≈1500 out of sight; `inside.rooms` keeps the camera in the room you're in.
- Tatooine (`sites/desert.js`) = reference: cantina zone (Greedo "Shoot first", Ben "A fast ship" → Docking Bay 94), Jabba's palace zone (Bib → trapdoor → rancor pit → gate control; Boba Fett bounty on Tuskens), Tosche Station (Biggs womp rats in Beggar's Canyon, Camie canyon race, Owen power converters), farmhand krayt-call quest. Achievements added in `src/components/Achievements.jsx`.

## Not yet verified in a browser (do this first)
Headless is slow (~2 fps); use the DEV hooks `window.__surface()` (debug) and `window.__surfaceDo('teleport'|'advance'|…)`, and a no-HMR dev server so other edits don't remount. Check on Tatooine:
1. Cantina: enter door at Mos Eisley, room renders (walls inward-facing, lamps bright enough: tweak `lamps` intensities in `desert.js`), band music plays, Greedo quest (Greedo hidden, spawned target shoots after 2.4 s).
2. Palace: door at `from(PALACE,[0,53])` ≈ [-377,-40]; walk to Bib, quest → stand on trapdoor → talk Jabba → teleport onto trapdoor, grate swings, you **fall into the pit** (check walker drops you when the floor goes `off`), camera follows into pit room, rancor chases (melee, knockback), gate control at [-6.4,-8.5] drops portcullis, Malakili appears, keeper's door throws you out.
3. Beggar's Canyon pits look like a canyon through the east mesa (`CANYON` path, pits `floor: 6`); race gates sit in it; Stone Needle (`needle` prop) placement.
4. Quest markers point at zone doors when the step is inside (`doorFor` in scene.js).

## Status (latest)
- Merged to main: Tatooine (cantina, palace, rancor pit, canyon, 8 quests), quest engine, Meshy crew (`public/models/galaxy/crew/`: han, jabba, ahsoka, greedo, gamorrean, bobafett, bith; wired via `surface/crew.js`; Han in the Falcon party), Sketchfab sets (`catalog/desert.js`: rancor, sailbarge, jabba, gonk, salacious, dejarik; new `catalog/outer.js`: grogu, ig11, kuiil, mudhorn, razorcrest, ahsokafig, dindjarin), galaxy refactor (sequels out; Nevarro, Mandalore, Lothal, Sorgan systems in), surface sequel cleanup (porg, Ahch-To hut, FO snowtrooper gone).
- Meshy refused Luke, Mando, Old Ben (content filter). `scripts/meshy-galaxy.mjs images luke mando oldben` then `models` to retry with a softer look. ~183 credits left; something else spends on the same account.
- World sites exist: tatooine, hoth, endor, kashyyyk, dagobah, yavin, naboo, coruscant, kamino, geonosis, mustafar, scarif, bespin. Background world-builder agents died at the org spend limit; their last work is committed (may be rough: browser-check each).
- Every landable world now has quests: own site files (Tatooine, Hoth, Mustafar, Scarif, Bespin) or `sites/quests.js` (EXTRA, merged in by siteOf: Endor, Kashyyyk, Dagobah, Yavin 4, Naboo, Coruscant, Kamino, Geonosis). `sites/outer.js`: Nevarro (reuses `cantinainside` as Greef Karga's cantina), Mandalore, Lothal, Sorgan, with quests.

## Next, in order
1. Browser-check every world (nothing past Tatooine's engine has been looked at in a browser): spawns on floors (Coruscant/Kamino `fall`), quest markers, race gates, lighting in zones.
2. Richer zones for the other worlds (Echo Base, Ewok village, Yoda's hut, Jedi Temple, Kamino facility, Geonosis arena interior) — copy `props/inside.js` + Tatooine's `zones`.
3. Sail barge as a floating thing over the Dune Sea; gonk/Salacious/dejarik into the cantina/palace; Grogu/IG-11/Kuiil/mudhorn already in `catalog/outer.js` (mudhorn, kuiil unused: add a mudhorn fight on Nevarro/Arvala).
4. Retry Meshy Luke, Mando, Old Ben (softer look).

## Workers (done)
- `session_01WKdjogxxT3dWciKKJskdx5` → branch `claude/meshy-galaxy-crew`: Meshy rigged figures to `public/models/galaxy/crew/<name>.glb` (luke, han, jabba(static), mando, ahsoka, oldben, greedo, gamorrean, bobafett, bith) + `scripts/meshy-galaxy.mjs` + `scripts/preview/crew.html`. **Then wire:** `PARTY.xwing` luke and `PARTY.falcon` han in `universe/footScene.js` → `src: { url: '/models/galaxy/crew/luke.glb' }` (only once the file exists); in `actors.js`/`activity.js` figure lookup, try a crew GLB first via `loadPartyFigure({ id, tall, src: { url } })` wrapped in a group scaled `1 / METRE` (see scene.js crew load) for kinds greedo/gamorrean/bobafett/bith/mando/kenobi/hutt(jabba static).
- `session_012SWGtYkFB9xoCAK4npkGV6` → branch `claude/surface-models-sets`: Sketchfab rancor, sailbarge, skiff, carbonite, jabba, gonk, salacious, dejarik (catalog/desert.js) and new group `catalog/outer.js` (grogu, ig11, kuiil, blurrg, mudhorn, razorcrest, mythosaur, lothcat, lothwolf, ahsokafig, dindjarin, remnanttrooper). **Then:** float the sail barge over the Dune Sea near the Sarlacc (a thing with `y`), skiff by the pit, use `outer` models on the Mandalorian/Ahsoka worlds.
- Local background agents of the original session (may be gone if this session ended): world builders for ice (Hoth), forest (Endor, Kashyyyk, Dagobah, Yavin 4…), core (Coruscant, Naboo, Kamino, Geonosis…), edge (Mustafar, Scarif, Bespin) and the galaxy refactor (remove sequels; add Nevarro, Mandalore, Lothal, Sorgan systems; Remnant faction; Razor Crest). Their work was uncommitted in the original container's tree; if it's not on the branch, redo it.

## Steps left
1. Browser-verify Tatooine (list above); fix what's off; merge.
2. Merge worker branches above; wire crew models; merge.
3. Finish/redo the other world groups' sites (`sites/ice.js`, `forest.js`, `core.js`, `edge.js` + their `props/`), each with **unique quests** using the engine: e.g. Hoth (snowspeeder tow-cable trip on AT-ATs: `trip` step needs a flying snowspeeder ride + cable — not built yet; Echo Base interior zone; wampa cave zone), Endor (speeder-bike chase race through trees; Ewok village; shield-generator bunker zone: plant charges = `use` steps), Dagobah (Yoda's hut zone; lift the X-wing out of the swamp; cave), Bespin (carbonite chamber zone, duel), Naboo/Kamino/Geonosis (arena zone), Mustafar, Scarif (plans vault zone), Kashyyyk, Yavin 4 (temple hangar zone).
4. Galaxy refactor: confirm no sequel systems/ships remain (galaxy `systems.js`, fleet, crawls, lines, names, missions, HoloMap); add Mandalorian/Ahsoka worlds' surfaces (`sites/outer.js` new group: Nevarro, Mandalore, Lothal, Sorgan) with quests (bounty pucks, blurrg riding, Mudhorn, Grogu).
5. Remove Ahch-To/Jakku surfaces and `porg`, `jedihut` catalog entries + GLBs + credits (`src/data/modelCredits.json`, test `src/data/modelCredits.test.js` requires every credit's file to exist).
6. Run `npx eslint .`, `npx vitest run` (heavy autopilot tests can time out when run all at once; re-run them alone), `npx vite build`; PR to main; merge.
