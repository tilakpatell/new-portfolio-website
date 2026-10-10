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

## Heroes, the lightsaber and the enemies that fight back (6 October 2026, the PR after the grounds)

### Done
- **Who you play as** (`galaxy/heroes.js`, pure and tested; `surface/HeroPanel.jsx` offers it from the corner button with your name on it; kept under `tp-galaxy-hero`): Luke, Leia, Han, Chewie, Ahsoka, Boba Fett, each a rigged figure the site already had (`public/models/galaxy/crew/`, all on the crew's skeleton). The hero walks in the lead of the party (`scene.js` reads `ctx.hero` through `heroSpec`), the ship's own crewmate stays your mate; `peers.js` knows the heroes too, so other pilots see who you are. The view remounts on a change (its key carries the choice).
- **The lightsaber** is a gun kind (`universe/gunplay.js`'s `saber`: the hilt along the fist, the blade out of the thumb side, `blade: true`), so the grip and arm that hold a blaster hold it and the lit stance is gunplay's aimed one. `surface/saber.js` poses over that after `gp.set`: three strokes that chain into a combo (F), the block (hold C: bolts that come from inside the blade's cone bounce off it, `blaster.js`'s `deflect`), the throw (R: out and back on a raised cosine, spinning flat, hitting what it passes). The rules (`saberRules.js`: the strokes' arcs, the combo window, the arc hit, the throw's path, the block's cone) are pure and tested. Blade colour and hilt (five styles: Skywalker, Luke's own, Ahsoka's curved white, a curved fencer's, the Temple guard's gold) are the player's. Sounds: a hum while it's lit, the snap-hiss, the stroke's sweep, the clash (`sounds.js`'s `saber`).
- **Enemies that do more than stand and shoot** (`surface/hostiles.js`, pure and tested; `activity.js` runs them): bursts (`hostile.burst`: stormtroopers in the docking bay, snowtroopers), strafing round you (`hostile.strafe`: Nevarro's death troopers, Sorgan's mercenaries), a shield that soaks hits and flashes where it's struck (`hostile.shield`: droidekas on Kashyyyk's beach and Naboo's plains), a blade that turns your strokes (`hostile.parry`: the Vader vision on Dagobah, now a duellist who comes for you). Tuskens charge.

### Left
- The other pilots' sabers stay dark: `peers.js` mirrors only `aim`; send `lit` and the colour with the walk packet and light theirs.
- A two-handed grip for the saber (the left hand under the right on the hilt) would read more like Luke's; gunplay's `support` cups the gun hand, which is close but not it.
- The lowered carry holds the hilt out forward from the fist (gunplay's muzzle-down carry, the hilt being along +y); a saber-specific carry (hilt hanging, point down) is a small special case in `gunplay.js`'s `set`.
- Enemy sabers are only a parry chance and a melee swipe; a visible blade on the vision (a `saber` gunplay on the actor) would sell it.
- Checked headless on Tatooine (swings, block, throw and catch, the panel) and in the tests; not yet on a phone's touch buttons (Throw and Block appear for a saber hero).

## The fight, fleshed out: stances, the guard, the Force, guns that heat (6 October 2026, the PR after the heroes)

What the films' games do, borrowed: Battlefront II's block stamina, its 5.5 m dodge with a moment of safety, its heroes' abilities on cooldowns, its heat bar with the active vent and its weapon mods; Jedi: Survivor's stances and its small parry window; Movie Battles II's fast / medium / strong stance triangle and swing-blocking.

### Done
- **Pure rules, tested**: `surface/combatRules.js` (the four stances and their strokes: single, double, dual, crossguard; the heavy stroke; the guard that blocking spends and the stagger when it breaks; the parry window; the lunge that steps a stroke in; the dodge; the Force push and pull; the hit-stop) and `surface/weaponRules.js` (each gun's numbers: damage, cycle, scatter, heat and cooling, range, sights; bursts and pellets; the six mods, two at a time; the heat bar's lock and the vent's sweet spot).
- **The saber** (`saber.js`): strokes from the stance's table, chaining in the combo window; F held is the heavy stroke (breaks shields and guards, can't be parried); a trail ribbon behind the blade through a stroke; the double stance lights a second blade out of the pommel, dual puts a second hilt in the left hand (its grip the right's, mirrored); strokes home on the enemy you're squared up to (`LOCK` in `scene.js`: nearest in front within 14 m) and step in to them (`lungeTo`).
- **The guard and the parry** (`scene.js`): blocked bolts and swipes spend the guard; broken, you stagger for 1.6 s and can't block or swing; C pressed within 0.22 s of a swipe is a parry (sparks, "Perfect", the enemy staggered 2.2 s). X dodges (a roll, nothing landing through its first 0.3 s). G is the Force push (a cone, enemies knocked off their feet), V the pull (drawn in and staggered).
- **Guns**: seven new builds in `gunplay.js` (A280, DLT-19, EE-3, WESTAR-34; a scattergun, a long rifle, a machine pistol), each with numbers and a sound. Heat per shot, the lock at the top, R to vent (early: empties it; locked: the sweet spot clears it, early jumps half); the right button (or the Aim button) is the sights, the camera in over the shoulder and the field narrowed by the weapon's zoom, the scatter halved. Bursts and pellets. G is a thermal detonator (an arc, a 4.5 m blast that breaks shields and shoves), V the overcharge (no heat, white bolts, a harder hit for 5 s). Each shot's damage is the weapon's, through `struck`.
- **Enemies** (`activity.js`): health bars over their heads (a sprite, redrawn only when the numbers change), knockback (`knock`), stagger (`stagger`: no shooting, no moving, bent back), a heavy stroke or a blast breaks a shield outright.
- **Feel**: a hit holds the frame (time at 12% for 40–90 ms), the camera shakes by the stroke, a hit marker at the crosshair (bigger and orange on a kill), a red vignette on being hurt, hit and kill ticks.
- **HUD** (`GalaxySurface.jsx`, the `combat` event ten times a second): the lock's name and health, the guard (or the heat with the vent's marker and sweet band), the three abilities with their cooldowns sweeping; the hero panel's tabs (Hero; Lightsaber: colour, stance, hilt; Weapon: the galaxy's guns and the ones from elsewhere with their numbers, the mods). The choice adds `stance`, `gun`, `mods` under `tp-galaxy-hero`.

### Left
- The dual stance's left hilt is placed by mirroring the right's grip; check it on each rig (the crew's share one skeleton, so one look should do).
- Jedi: Survivor's skill trees (perks earned, not picked) would need something to earn them with: the missions' stars, perhaps.

## Duellists, pilots' arms online, the lock ring, the perks (6 October 2026, the PR after the fight)

### Done
- **A duellist** (`activity.js`): a spawn's `hostile.blade` ({ color, hilt? }) puts a lit saber in its hand (the hilt and blade from `gunplay.js`'s `saber`, dressed by `saber.js`; the models aren't rigged, so it sits where a figure that tall holds its right hand) and swings it with each swipe; `hostile.guard` (strokes) is a guard of its own: while it holds, the parry chance applies and each turned stroke drains it, a heavy stroke breaks it outright; broken, it reels for 2 s, everything lands, and the guard is back after 7 s. The white line over its health bar is the guard. `activity.parry(t, { heavy })` decides it; `scene.js`'s `saberHit` reads the answer. The Vader vision on Dagobah (the site's `cave` quest and the `raise` mission) is the first: a red blade, three strokes of guard, a 75% parry.
- **Pilots' arms online**: the walk packet's walkers carry `arms` ([gun kind, lit, blade colour, stance, swinging], `protocol.js`, validated; older readers stop before it), and the heroes are in `WALKERS`. `peers.js` builds the other pilot's figure with the gun the packet names (made again if it changes), a saber with their colour and stance, lit as theirs is, a stroke each time the packet's `swing` comes on.
- **The lock ring** (`scene.js`'s `stepLockRing`): a thin additive ring at the chest of the enemy you're squared up to, facing the camera, breathing, with a slow square of ticks round it, in your blade's (or bolt's) colour.
- **Perks** (`galaxy/perks.js`, pure and tested; the panel's Perks tab; kept with the choice): eleven cards, three at a time, each a multiplier `scene.js` applies where the number is used (damage taken, the guard's size, the parry window, the lunge, heat and cooling, the cycle, the abilities' cooldowns, a turned bolt's guard cost, health regrowth, the dodge's cooldown, damage dealt). `combatRules.js`'s `guardStep` and `parried` take the perked numbers.

### Left
- More duellists: a Magnaguard on Kashyyyk, an Inquisitor on Lothal (the `inquisitor` kind isn't catalogued yet), Maul on Naboo; each a `blade` and a `guard` on a spawn.
- The duellist's arm is a fixed pose that swings; a rigged duellist (a Meshy-rigged Vader) would let `gunplay.js` hold the saber properly.
- (Both since done: the combat revamp's Lane D made every duellist a rigged figure fencing on the saber module, with Maul on Naboo and an Inquisitor on Lothal. `HANDOFF-combat.md`, Lane D.)
- Perks are picked, not earned; the missions' stars could unlock them.

## Heroes from everywhere, each with their own abilities (7 October 2026)

The plan: `docs/superpowers/plans/2026-10-07-heroes-from-everywhere.md`.

- **The ship's own lead walks in** (`galaxy/heroes.js`'s `LEADS`: Rick off the cruiser, Walt off the RV, Han off the Falcon, Luke off the X-wing) until a hero is picked. Rick, Morty, Walt and Jesse are on the roster now (`side: 'elsewhere'`; Rick and Morty as Meshy figures through the wardrobe cast, Walt and Jesse from `public/models/albuquerque/`), and anyone may carry the galaxy's guns or their own (`readHero` keeps a hero's own gun though it isn't `PICKABLE`).
- **Abilities** are `surface/abilityRules.js` (pure, tested): `ABILITIES` by kind, `abilitiesOf(spec)` (a spec's own pair, else the Force for a saber, else the detonator and the overcharge, so the party's mate from `footScene.js` still has something), `JET` and `jetStep`. Each hero names their pair on `heroes.js`; `scene.js`'s `power(slot)` plays them by kind (a push or a roar through `combatRules.js`'s `forceAt`/`pushVelocity`, which now take a push's own numbers; a thrown thing through `state.bombs` with its `spec`; the overcharge; the medpack; the sprint as walk rules; the hop as a teleport that stays inside the world's reach) and `stepJet` holds the jetpack (G held, or the touch button held: `state.buttons.power`). The HUD's `combat` event carries `powers` (the names, and `hold`), and a held one's tank shows as a cooldown of one second.
- **Checked** in a headless browser on SwiftShader at `quality=mid` (`lab/heroes/check.mjs`, git-ignored): Rick leads off the cruiser with the portal gun and hops 7 m, Tab to Morty and his sprint, Walt's fulminate thrown and blown, Boba Fett up 3 m and more in 1.5 s, dry, down and refilled, the wrist rocket, Han with the DL-44 and the detonator, Chewie's roar, Rick with a DL-44.
- **Not done:** the world still remounts on a hero change (the view's key); Rick's B gadget cycle from the universe map isn't on the surface (pick the freeze or shrink ray in the panel instead); no voice lines for the abilities.

## The house look on the galaxy's worlds (7 October 2026, PR 1 of the three worlds)

The plan: `docs/superpowers/plans/2026-10-07-three-worlds.md` (Tasks 1–6); the spec: `docs/superpowers/specs/2026-10-07-three-worlds-design.md`.

### Done
- **The look** (`look.js`, pure, tested): `lookOf(site)` is the house's look from the site's `look` (`{ shadow, edge, fogBelow, halo }`, '#rrggbb') and its sky; `scene.js` makes `createHouse(lookOf(site), { fog: false })` and adopts the scene after the floor light, everything that comes through `warm`, and the scene again every two seconds (so a late spawn or model is in the look). The post's own shoulder tone map stays: `exposureOf(site)` is the site's `exposure` (default 1) through `post.exposure`.
- **The fog** stays `skyfog.js`'s (the dome's own colour); it takes the look's `halo` round the sun and, where the site says, `fogBelow` (the haze below the horizon as a share of the sky's colour there).
- **The ground map** (`groundPaint.js`, pure, tested; `lib/three/groundmap.js`): painted once at landing over ±HALF (512² on a desktop, 256² small; about 0.2–0.35 s), with the trees' crowns (`SCATTER[kind].canopy`, a radius) darkening the ground and thinning the grass under them. The floor takes the map's colour inside the square under its own grain and scan, fading to its own rule toward the edge. `house.ground(map)` bounces it onto low downward faces. `groundPieces(site)`: a `noGround` world (Bespin, Coruscant, Kamino) gets no map, no grass, no bounce.
- **Grass** is the lib's (Bruno's, `lib/three/grass.js`) on the map, where `site.grass` is; `grass.js` keeps only the cover rule (`coverAt`, `coverMap`). **One wind** (`lib/three/wind.js`) per world, from `ground.wind` and `grass.wind`; the kit's plants and cloth lean the same way.
- **The core kit** (`kit.js`'s `KIT_ROLES`): every solid kit material wears its role's scan in the world (`lib/three/core.js`'s `wear`, at the scan's size) once the scans are in. Built things that move (rides without a model, prop figures, what you carry) wear twins dressed by their UVs (`kit.moving`), or the grain would slide over them. A thing's `wear: 'stone'` lays a scan over a loaded model (`placer.js`'s `wearModel`).
- **`?debug`** (`tune.js`): the look (shadow, edge, mix, bounce, halo, haze below, exposure), the grass and the wind on sliders; the copy button prints the site's own `look`, `exposure` and `grass` blocks.

### Left
- Per-world looks beyond the defaults: Coruscant, Yavin 4 and Bespin come in their own PRs; the rest keep the sky-made default until someone tunes them in `?debug`.
- The bounce (`house.ground`'s strength 0.5) tints legs on bright grass worlds strongly; tune per world if it reads wrong.

### Checking it
- `OUT=lab/shots node scripts/surface-shot.mjs <world> <x,z,dist,deg,label>` for pictures and `OUT=lab/check JSON=1 BUDGET=lab/baseline/surface-high.json node scripts/galaxy-check.mjs surface <ids>` for the counts against a baseline from main (both take `CHROME=` and `BASE=`). `?debug` on a world's address for the sliders.


## The three worlds: Coruscant, Yavin 4 and Bespin, made whole (7 October 2026, PRs 2–9 of the three worlds)

The plan: `docs/superpowers/plans/2026-10-07-three-worlds.md` (Tasks 7–22); the spec: `docs/superpowers/specs/2026-10-07-three-worlds-design.md`. The ledger with every ruling: `.superpowers/sdd/2026-10-07-three-worlds/progress.md` (git-ignored).

### Done
- **Three worlds in their own files** (`sites/coruscant.js`, `sites/yavin.js`, `sites/bespin.js`): each with its own look (`look`, `exposure`), its places and their things, its life, its zones and its quests. Coruscant: the Temple, the Processional Way, the Senate, 500 Republica, Dex's, the Outlander club and the Works, with Dex's, the club, the Archives and the training room as zones, and the speeder chase, Order 66, the training and the dart as quests. Yavin 4: the Great Temple with its hangar, war room, stair and throne room as zones, the field, the lookout, the ruin and the river, and the briefing, the scramble and the ceremony as quests. Bespin: Cloud City on its deck with the platforms, the plaza, the dining room, the carbon-freezing chamber (a platform that goes down on the `freeze` signal), the reactor control room and its gantry over the shaft (`fall` and `respawn` on a zone), the corridor to the platforms with its two coded doors, and the chase for Han, the freezing, the duel and Lobot's codes as quests.
- **The engine for them**: `placer.js` follows a floor that moves (`moves: true`); `scene.js` handles a zone's `fall`/`respawn`; a hostile's `force: { every, push }` shoves you (a duellist's Force, `activity.js`'s `nextForce`); a spawn's `side: 'yours'` fights beside you (`friendlyAim`, `hostileAim`; shots between figures carry `at` and `victim`, drawn as tracers with the hit rolled); the dev hook's `missionDo('skip')` moves a site quest along outside a mission.
- **The people** (`needs.js`, `talk.js`, both pure and tested): a wanderer with `needs` goes between the site's `wants`, one with `fears` runs from a kind it has seen, one with `chases` goes after it; an actor's `says` can be a tree by `era`, `owner`, `side`, `hero`, `done` and `rank` (twenty-one of them across the three worlds; `sites.test.js` validates every one, `voicelines.js` walks them). The page hands the scene the sworn side and the rank with the war's `effects`.
- **Who holds a world meets you at the landing** (`garrison.js`'s `garrisonAt`: six to ten of the holder's troops on a beat and at posts round the landing, a probe droid for an Imperial search party on a world that isn't the Empire's own; `garrisonQuest` makes a quest's troopers the holder's too).
- **Three ground battles** (`missions/assaults.js`: the Temple steps on Coruscant, the Separatists up the Processional Way against the clones; Yavin 4, the Empire across the field for the hangar and the temple steps; Cloud City, the Rebellion over Platform 327 for the south walkway and the plaza; `sidesFor(war)` gives each theatre's two sides), linked from the systems' briefings (`game.also`), checked by `scripts/assault-check.mjs coruscant,yavin,bespin`.
- **Models**: the Senate repulsorpods from Sketchfab (`catalog/three.js`, three parked by the Senate plaza); from Meshy (`scripts/meshy-galaxy-three.mjs`, `scripts/meshy-galaxy.mjs`), Cloud City's towers, halls and plaza terraces, Dex's diner, the Outlander club, 500 Republica, and Lando, Lobot, an Ugnaught, a Wing Guard and Dex as figures.

### Left
- **The Meshy models are in** (made on the owner's second account, about 400 credits): Cloud City's towers and domed halls scattered round the deck in the built city's place, its plaza terraces north of the plaza, Dex's diner and the Outlander club standing in for their built fronts (their floors and doors the built ones'), 500 Republica (`catalog/made.js`, `public/cc0/README.md`'s lane line); Lando, Lobot, an Ugnaught and a Wing Guard as rigged crew figures and Dex still behind his own counter (`crew.js`; the built figures stay as the fallback). A retexture pass was skipped; `lab/meshy/buildings/<kind>-gate.jpg` has each against its still. The figures were simplified after the fetch from 16k to 4–7.5k triangles (a scene of twenty of them was half a million triangles); the fetch step doesn't do that, so a refetch wants it again.
- A WA-7 droid, Jocasta Nu, the carbon-freezing platform and a Coruscant police speeder: nothing usable on Sketchfab; still built.
- `scripts/galaxy-check.mjs surface` can't load `?mission=assault`; the battles' budget is read off `assault-check.mjs`'s run instead.
- The dining room's and the corridor's cameras clip the walls at their doors (the zone's `rooms` are rectangles; the dining corridor is narrow).

### Checking it
- `OUT=lab/shots ZONE=<zone> node scripts/surface-shot.mjs <world> <x,z,dist,deg,label>` (a zone's views relative to its origin), `BUDGET=lab/baseline/surface-high.json node scripts/galaxy-check.mjs surface coruscant,yavin,bespin`, `OUT=lab/check node scripts/assault-check.mjs coruscant,yavin,bespin`, and the git-ignored checks in `lab/checks/` (`bespin-quests.mjs` plays the three Bespin quests through, `coruscant-people.mjs` watches the commuters, `garrison-probe.mjs` counts who meets you at the landing; each needs `localStorage['tp-worlds'] = '"load"'`, or the 3D never starts headless).

## The ground war (8 October 2026, three PRs)

The design: `docs/superpowers/specs/2026-10-08-ground-factions-design.md`; the plan: `docs/superpowers/plans/2026-10-08-ground-factions.md`. A fourth NPC stack, `src/components/galaxy/surface/ground/`, beside the quest hostiles, the garrison and the Battlefront assaults (those three are untouched but for the garrison's landing party, which is the pad turf's soldiers now).

- **Who's who.** `galaxy/siteWar.js` stages each world in its film's war, and your oath there is the one that counts (`groundEffects`, used by the page and the flown landing). `ground/standing.js` says what any two sides are to each other; the Hutts fight everyone but hunt nobody.
- **Where you set down.** On the other side's world the ship lands out of sight of the pad's posts, 150 to 220 m out (`landing.js`), and says so as you step out.
- **Turf and people.** `turf.js` derives the pad's turf (and, on a front or an attack, the other side's far turf 220 to 300 m out, with a front between); `population.js` makes their soldiers round you in 48 m cells (radius 3) and lets them go behind you, the dead staying dead; `POP` caps how many live at once by tier.
- **The fight.** `fight.js` steps every soldier within 120 m on `hostiles.js`'s head with the ground's gates (line, facing, range, aim error, suppression, the squad's nerve, tokens per target). Bolts between soldiers fly (`bolts.js`), past 60 m from you a fight is settled by `farExchange`; bolts at you go through `blaster.enemy` as the quests' do. Your shot that hits or passes within 2 m of an unsworn you's soldier gives its squad a grudge for 90 s.
- **The director.** `director.js`: raids every 150 s ÷ the far turf's strength, posts lost and reinforced (walked in from another post, never within 60 m of you), hunts once you're seen on an enemy's world; its news reaches the scene as `{ type: 'war', what, side, text }` events, a line at most every 12 s.

How to check it. `npx vitest run src/components/galaxy/surface/ground src/components/galaxy/surface/sites` (the rules, and every landable world's turf, covert landing and roster standing on dry ground); `npm run test:ai -- ground` (five scenes played through for simulated minutes). In the browser (dev server): `window.__surfaceScene.groundWar.debug()` lists the soldiers (side, role, mode, target, `rag` while a ragdoll), `.posted()` the director's posts, `.ms` the update's cost; `__surfaceScene.put(x, z)` sets you down (skipping the landing), `__surfaceScene.you()` reads where you are and your health. `scripts/galaxy-check.mjs` takes `OATH='<allegiance JSON>'` to land sworn and prints `ground N ms` beside the frame times.

What's next: the spec's section 9 migrations, each its own PR — the quest hostiles onto `troops.js`/`fight.js` (and the 45% roll in `scene.js`'s shooters goes), the companion as a soldier of your side, the assaults on the shared bolts and troops (Kashyyyk's far turf and map with them), and talk and quests by side (the ground soldiers don't talk yet; `garrison.js`'s `garrisonLines` waits for them).
