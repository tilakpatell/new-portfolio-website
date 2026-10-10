# Hand-off: Battlefront on the web (the game, from the 2017 game's data)

The design is `docs/superpowers/specs/2026-10-10-battlefront-game-design.md`. The plans: `docs/superpowers/plans/2026-10-10-battlefront-lane0-data.md`, `-lane1-soldier-ai.md`, `-lane2-galactic-assault.md`, `-lane5-world.md`. The asset side (models, textures, clips through the bucket) is `HANDOFF-bf2017.md` and its spec; the streaming of those assets to the page is another account's lane (`plans/2026-10-09-asset-hosting.md` and whatever follows it). This page is the game: rules, modes, mechanics, bots, the world that plays them.

## Where the data is

- **The owner's machine**: `C:\Users\tilak\Downloads\BF2_Extract\` (not the repo). `web\` holds the masters (`data\<Name>.json` for 83,983 gameplay records, `data.tsv` their index); `web_opt\` the web build (`maps\<path>.json` + `.bin` for 74 levels, `terrain\`, `physics\`, `anims\` for 10,270 clips, `strings\English.json`, `models\`, `textures\`). `web_opt\README.md` and `GUIDE.md` describe every format; `qa\map_view\index.html` is a working three.js map viewer. The exporter is `tool\` (Frosty-driven C#); do not run it, it is the other session's.
- **The bucket**: `bf2017-assets` on the owner's Supabase (private). `data/` as `.json.gz` with `data.tsv` (83,983 rows) at the root (every record lane 0 asked for was there on 2026-10-10); `web/` the web build (models, collision, textures, maps, terrain, svg, fonts, strings, anims, physics). A cloud session fetches records with `node scripts/bf2017-fetch.mjs data '<glob>'` and web files with `web '<glob>'` (`SUPABASE_URL` and `BF2017_KEY` or `SUPA_KEY` in the environment). An index name and its bucket folders can differ in case (the export ran on Windows); the parsers match ignoring case.
- **The extractor** (lane 0): `node scripts/bf2017-data.mjs all --root <web dir> --level hoth_01 --era Orig` writes `src/data/bf2017/*.json`. On the owner's machine the root is `C:/Users/tilak/Downloads/BF2_Extract/web`; in the cloud, `lab/assets/bf2017`.

## Lanes

| lane | state | branch | plan |
| --- | --- | --- | --- |
| 0 data: extractor, parsers, rulebooks for Hoth's Galactic Assault | **done** (PR to `main`): 16 rulebooks, 1.9 MB; teams 1 (6 sequel kits refused), classes 8, heroes 16, reinforcements 6, vehicles 16, weapons 34, abilities 76, cards 68; AI 16 tactics, 10 templates, 202 firing patterns; Hoth 474 spawns, 102 spawn areas, 52 volumes, 2 walker paths, 3 stages (hand); 104 lights and 413 lighting prefabs; 84 HUD widgets; 69 strings; 0 missing links | `claude/bf-data` | `plans/2026-10-10-battlefront-lane0-data.md` |
| 1 sim, soldiers, weapons, bolts, nav, cover, the soldier bots, the skirmish arena | not started (needs 0) | `claude/bf-ai` | `plans/2026-10-10-battlefront-lane1-soldier-ai.md` |
| 2 Galactic Assault: stages, objectives, spawning, Battle Points, the commander, balance | not started (needs 1) | `claude/bf-assault` | `plans/2026-10-10-battlefront-lane2-galactic-assault.md` |
| 3 heroes: abilities, saber combat, hero bots | not started (needs 1); plan when 1 merges | `claude/bf-heroes` | |
| 4 vehicles: AT-AT escort, walkers, speeders, turrets, mounts, vehicle bots | not started (needs 2) | `claude/bf-vehicles` | |
| 5 the world: assets adapter (dev backend), the whole-map pack through lane L's loader, the look from the lighting records and the placed lights, the cameras, figures on the game's clips, input, the game's HUD, the route | not started (needs 0 and #810's lane L; the streaming lane for the bucket backend) | `claude/bf-world` | `plans/2026-10-10-battlefront-lane5-world.md` |
| 6 Blast, Heroes vs Villains, Strike, then the rest; the other maps' rulebooks | not started (needs 2, 5) | `claude/bf-modes` | |
| 7 online | later | `claude/bf-online` | |

Lanes 1, 3 and 5 run in parallel once 0 merges. Each lane adds its row's numbers here when it merges and a line to the spec's "Departures" for anything that went another way.

## The flow and the mods (the fifth design, 2026-10-10 evening)

The design: `docs/superpowers/specs/2026-10-10-battlefront-flow-and-mods-design.md`. The owner's ask: land on a planet and get the game's own menu (Galactic Assault, Starfighter Assault, Heroes vs Villains, Blast, the world's story, free roam), deploy as a hero or a class, and bring the mods' content in. Two bugs were found on the way and are in the design's first section:

1. **The repo has no `ASSET_BASE` Actions variable**, so the live build never asks the bucket and every file in `src/data/galaxyAssets.json` (the 2017 heroes' bodies among them) returns 404: that is "it wouldn't let me switch to Luke". The owner sets the variable to `https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets` and re-runs the deploy (`assets-check` passed 371 of 371 there on 2026-10-10). Lane F makes the page honest when a file is missing anyway.
2. **The landing veil creeps at "Sending pictures to the graphics chip 33 %"** for minutes (live, and on local servers from `main`, fronted, on an RTX 5090, with and without the bucket base). Not root-caused; lane F's task 2, and decision 8 says what the veil must do whatever the cause.

| lane | what | branch | plan | state |
| --- | --- | --- | --- | --- |
| F | the honest Equip and its fallback chain; the veil's rule and the stall; `modes.json` (the levels' mode layers); the landing mode menu, `?mode=`, the briefing's cards; the deploy screen (side, hero or class, outfit, weapon, perks) | `claude/bf-flow` | `plans/2026-10-10-bf-flow-laneF-landing-menu.md` | **done.** Equip never refused: a 2017 body that 404s is stood in by the site's figure (Luke, Han, Leia, Vader, the Emperor) or a trooper of the hero's side, and the toast says so (`surface/standIn.js`; checked live with no base: “Darth Vader, in the site’s own figure”). The stall: not reproduced fronted (Hoth in SwiftShader, high: 71 s with the base, 76 s without; ultra 88 s; the pictures step 5–8 s every time); reproduced in a background tab (222 s, the prepare stopped at the bake, every later step waiting on `requestAnimationFrame`), fixed in `gpuWork.js`'s `nextFrame` (a frame or 100 ms): 49.5 s with the base, 41 s without, hidden. The veil names its wait after 10 s and offers Go in anyway after 20 s. `modes.json`: 27 levels on 15 worlds (`bf2017-data.mjs modes`); the mode menu after the title card, `?mode=`, Change mode in the Menu, the briefing's cards, the Land button's line; the deploy screen (side, heroes, the four classes in the world's kit). SwiftShader seconds compare steps, not the 25/30 s targets: run `node scripts/landing-check.mjs --surface hoth --limit 25` with `ANGLE=d3d11` on the desktop. |
| A | Starfighter Assault: the four space packs (`sb_endor_01` first), the `SpaceBattle` layer in the map rulebook, the mission on the Fleet Assault sim, the entry from the menu (`/galaxy/endor?battle=starfighter`) | `claude/bf-starfighter` | `-laneA-starfighter.md` | not started |
| H | Heroes vs Villains (4 v 4, a target a team, the level's hero arena) and Blast (10 a side, kills to 100, the team-deathmatch spawns) as surface missions on Hoth, Endor, Tatooine, Geonosis, Kashyyyk | `claude/bf-hvv-blast` | `-laneH-hvv-blast.md` | not started |
| D2 | **desktop, local session**: Frosty profile → `ModData` → `bf2export` → the diff → `bf2017-import`; Battlefront Expanded's heroes and reinforcements first, then the clones' looks, Realistic Overhaul's weapon table, the HvV mods' and Instant Action Overhaul V2's mode logic written up for lanes 2, 6 and H | `claude/bf-mods-desktop` | `-laneD2-mods-desktop.md` | not started; IAO V2 is not on the PC yet (the owner's Nexus account; the file is on their phone) |
| 1, 5 | the game design's own lanes, started from this design's branch | `claude/bf-ai`, `claude/bf-world` | their plans above | started 2026-10-10 |

The mod archives already on the owner's machine are listed in the design (Expanded's 141 `.fbmod`s, Saberfront, Realistic Overhaul, the HvV modes, the clone packs, Frosty Mod Manager). Each lane adds its row's numbers here when it merges and a line to the design's "Departures".

## Beside the asset lanes (PR #802 and PR #810)

`HANDOFF-bf2017.md` is the assets' hand-off and its status table is theirs. What this game takes from them, so nobody builds it twice: lane 1's `walrus.js` (figures on the game's skeleton), lane L's level pack and loader (run on the whole map with `--frame map --no-fit`, spec decision 15), lane G's light from the level's sky records, lane X's stroke tables for the heroes, lane V's vehicle models, lane S's fetch pool. What this game adds that they do not: the rules, the modes, the bots, the Battle Points, the HUD, the route.

## For the streaming session (the other account)

The game reads assets through one adapter, `src/components/battlefront/assets.js` (spec section 7): `loadModel(name, { lod })`, `loadClip(name)`, `loadMap(level)`, `loadTerrain(level)`, `loadPhysics(name)`, `loadStrings()`. Lane 5 writes the `dev` backend (Vite serves the local export's `web_opt/` at `/bf2/` from `BF2_ROOT`). The `bucket` backend is yours: the authenticated Supabase Storage loader (`web_opt/README.md` shows the headers), the cache headers and service worker from your asset-hosting design, and the gate in front of `/battlefront`. Build to the adapter's shapes and the game needs no change to switch. The names the game asks for are the export's own: model names from `models.jsonl`, clip names from `anims.jsonl`, level paths like `levels/mp/hoth_01/hoth_01`.

## Checking it

- Lane 0: `npx vitest run scripts/lib/bf2017-ebx.test.mjs scripts/lib/bf2017-rulebook.test.mjs scripts/lib/bf2017-rulebook-ai.test.mjs scripts/lib/bf2017-rulebook-map.test.mjs scripts/lib/bf2017-rulebook-look.test.mjs scripts/bf2017-data.test.mjs src/data/bf2017 src/lib/battlefront/rulebook.test.js` (fixtures only, no export needed).
- Lanes 1 and 2: `npx vitest run src/lib/battlefront` and `npm run test:ai -- src/lib/battlefront` (the arena); `node scripts/battlefront-balance.mjs --skirmish` and `--assault` for the tables.
- Always: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Rules this game keeps

- Pure rules in `src/lib/battlefront/`, no three.js, no DOM; the world in `src/components/battlefront/` draws what the sim says.
- Every number from the rulebooks; a hand value says so (`source: "hand"`, a line in `src/data/bf2017/NOTES.md`).
- No sequel era; `isSequel` refuses it in the extractor and the rulebook test.
- No budget rows for this world (the owner, 2026-10-10); files still under 800 lines and the layer rules still hold.
- Nothing of the galaxy, the universe or any other world changes.
