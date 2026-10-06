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

## The filled worlds (6 October 2026, PR "The galaxy's worlds, filled")

The owner's note: the worlds looked empty even where the textures were good. One PR, no subagents, both asset services:

### Done
- **Sketchfab, a new catalogue group** `catalog/fill.js` (28 kinds, `node scripts/sketchfab-surface.mjs fill`): the sandcrawler, eopies and rontos, a Sullustan, the A-A5 speeder truck, Hoth's crates and the GR-75 transport (the `gr75` kind the Hoth site already asked for and never got), an Ithorian Rebel (rigged, `walk-ip`), Rebel technicians and pilots, a hangar service ramp, the Y-wing, K-2SO, Jyn and Baze, the BARC speeder, dwarf and homing spider droids, Phase I clones, the Armorer, mouse droids, two astromechs, and five kinds of cargo (Imperial crates and cubes, barrels, coolers, bevelled crates). Looked at on a contact sheet (`scripts/.cache/sheet.mjs` is a scratch tool; `scripts/glb-shot.mjs` does one) and seven were turned down and deleted: Watto (a cartoon), the Hoth shield generator and collector arm (no textures), the Ewok village and Cloud City tops (low-poly dioramas), the Senate (a flat city disc), Bo-Katan (a statue on a base).
- **Meshy, from film stills and production paintings** (`scripts/meshy-galaxy-buildings-fill.mjs`, tasks in `scripts/meshy-galaxy-buildings-fill-tasks.json`, 363 credits): the Great Temple, Jabba's palace, the Lars homestead, an Ewok hut, Theed's royal palace, a Tipoca City dome, the Mustafar mining facility, the Citadel tower, a great wroshyr (lifted from Kachirho's picture; the city tree itself stays built for its decks) and a Coruscant tower. Yoda's hut came out a white blob and was dropped (the built one stays). Landmarks with doors and decks keep the built one's solids and floors (`solids: 'built'`).
- **Every landing has something to see**: a cluster of props, cargo, droids and people within 30 m of where you set down on all seventeen worlds, in each world's own voice (Jawas and a landspeeder on Tatooine, a perimeter post on Hoth, the strike team's camp on Endor, Gold Squadron's dispersal on Yavin, clones on Kamino and Geonosis, the Empire's cargo on Scarif…).
- **Three more missions**, as quests on the surface engine (`missions/index.js`, tested): Tatooine's canyon run in a landspeeder (both ways, against the clock), Hoth's first transport on foot (cargo, snowtroopers, the run to the ion cannon) and Sorgan's Sanctuary (the raiders, then the AT-ST). Their systems' briefings are live (`systems.js`), their crawls rewritten (`crawls.js`), their achievements added. Six of eighteen systems now have a mission to play.
- **A real bug fixed**: `siteOf` dropped a site's own `ground.pits`, so Beggar's Canyon was never dug. The canyon run's test caught it.
- `scripts/sketchfab-surface.mjs` now waits out the download API's 429s and writes the credits after each model (`SKIP_DONE=1` to leave what's already in).

### Left, in order
1. **Yoda's hut** from a better picture (the McQuarrie painting's crop picked one lump): try `File:YodaHut-hd.png`'s exterior, or multi-image. 33 credits.
2. **Echo Base's hangar face** and **Bespin's far Cloud City** are still built in code: a Meshy façade for the glacier mouth would need the hangar left open (the built one is walkable), and the far city hangs as a `skyships` galaxy kind, not a surface kind.
3. **Endor is 6.5M triangles at the landing** (before this PR too: the redwoods), far over the spec's 2.5M ceiling; Coruscant 4.5M, Kashyyyk 3.4M. Phase 1's Task 11 (near-only casters, zones hiding the outdoors) is the fix, not fewer trees.
4. A Senate model worth the name, a collector arm with textures, a Hoth shield generator: nothing on Sketchfab passed; Meshy from `File:Senate Building.png`-type pictures is the route.
5. The still figures from Sketchfab (clones, technicians, pilots) are posed, not rigged: they stand (`still: true`) and should keep standing. Rig them through Meshy if they are to walk.

### Checking it
- `npx vite --port 5188 --strictPort --host 127.0.0.1`, then `OUT=lab/shots node scripts/surface-shot.mjs <world> "<x>,<z>,<dist>,<deg>,<label>"` for a view of a spot; `OUT=lab/check JSON=1 node scripts/galaxy-check.mjs surface <ids>` for the counts.
- The missions: `/galaxy/tatooine/surface?mission=canyonrun`, `/galaxy/hoth/surface?mission=transport`, `/galaxy/sorgan/surface?mission=sanctuary`.
- The Meshy models' gate sheets are made by `MESHY_TASKS=scripts/meshy-galaxy-buildings-fill-tasks.json MESHY_REVIEW=lab/meshy/fill node scripts/meshy-galaxy-buildings.mjs sheet <kind>` (the pictures are fetched again into `lab/refs/`).

## The grounds, the mission HUD, the Senate and Yoda's hut (6 October 2026, the PR after the filled worlds)

### Done
- **Every world's ground wears a photo scan up close** (`ground.js`: the site's `ground.detail`, a role from `public/cc0/galaxy/`, with `detailLook: { color, normal, metres, near, far }`): sand, snow, grass, a pine floor, leaf litter, swamp mud, burnt ash, red soil, grey gravel, a beach, ten new Poly Haven sets by `scripts/galaxy-textures.mjs`. The scan's detail colour (centred on its own brightness, so the palette still says what the ground is) and its normal map, flat on xz at the scan's real size, fading out between 28 and 90 m. Off on the low tier and on small screens. Coruscant, Kamino and Bespin are decks, not ground: none.
- **A quest mission has a HUD** (`ChaseHud.jsx`): its name, the live clock and the par up top left, a banner for its first four seconds; the tracked quest's lines drop clear of the corner's credits (`surface-quest-on`).
- **The Senate and Yoda's hut, made with Meshy** (`meshy-galaxy-buildings-fill.mjs`): the Senate's dome from Revenge of the Sith's shot of it, Yoda's hut from the whole cluster in McQuarrie's painting (the first try, one lump, was a white blob: `yodahut-first` in the tasks file).

### Left
- The scans fade at 90 m: past that the ground is the shader's own noise. A second, coarser repeat (the way `lib/three/surface.js`'s antiTile does) would carry the grain further without the repeat showing.
- The space view's planets read soft from orbit (procedural noise per pixel, `bodies.js`): a normal or a finer octave for the near view.
- Switching system or mission by editing the URL's hash while on a surface leaves the old world drawn until the new one is in; go through the galaxy and it's fine.
