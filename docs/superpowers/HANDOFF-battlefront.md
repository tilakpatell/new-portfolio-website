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

## Beside the asset lanes (PR #802 and PR #810)

`HANDOFF-bf2017.md` is the assets' hand-off and its status table is theirs. What this game takes from them, so nobody builds it twice: lane 1's `walrus.js` (figures on the game's skeleton), lane L's level pack and loader (run on the whole map with `--frame map --no-fit`, spec decision 15), lane G's light from the level's sky records, lane X's stroke tables for the heroes, lane V's vehicle models, lane S's fetch pool. What this game adds that they do not: the rules, the modes, the bots, the Battle Points, the HUD, the route.

## From the assets' lane M (the front end)

The fonts, icons and strings are not this game's lane 5's to import: lane M (`HANDOFF-bf2017.md`, "Lane M") imported them for the whole site, and lane 5 consumes them:

- **The HUD's widgets**: `src/lib/bf2017/ui/` (`widget(name)` with its tree, layout and words in the game's text; `placeWidget`; `colour(index)` from the game's palette; `fontFor(gameFont)`; `bitmap`, `portrait` once the bucket has `UI/Bitmaps`).
- **The fonts**: `src/lib/bf2017/fonts.css` (`--font-bf-hud`, `--font-bf-text`, `--font-aurebesh`). Lane 5's plan names `LinotypeUnivers-520CnMedium` and `RaxusPrimeNumericalMonospace_Regular`: those are EA's licences, not the site's, and were taken out of `public/battlefront/fonts/`; `fontFor` maps the widgets' Univers and RaxusPrime faces onto Cuprum and Roboto.
- **The icons**: `src/lib/bf2017/icons.js` and `src/runtime/hud/GameIcon.jsx` (the sprites under `public/ui/bf2017/`), in place of lane 0's copies under `public/battlefront/icons/`.
- **The strings**: `src/lib/bf2017/strings.js` (`text`, `nameOf`, `loadFamily` for the whole table), beside `rulebook.js`'s `stringOf`.
- **The films**: `src/lib/bf2017/films.js`'s `tilesFor(mode)`, `tutorials()`, `logo()` for the menu and the help, and `src/runtime/hud/Film.jsx` to play them.

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
