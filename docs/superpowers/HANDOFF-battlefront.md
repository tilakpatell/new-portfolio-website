# Hand-off: Battlefront on the web (the game, from the 2017 game's data)

The design is `docs/superpowers/specs/2026-10-10-battlefront-game-design.md`. The plans: `docs/superpowers/plans/2026-10-10-battlefront-lane0-data.md`, `-lane1-soldier-ai.md`, `-lane2-galactic-assault.md`. The asset side (models, textures, clips through the bucket) is `HANDOFF-bf2017.md` and its spec; the streaming of those assets to the page is another account's lane (`plans/2026-10-09-asset-hosting.md` and whatever follows it). This page is the game: rules, modes, mechanics, bots, the world that plays them.

## Where the data is

- **The owner's machine**: `C:\Users\tilak\Downloads\BF2_Extract\` (not the repo). `web\` holds the masters (`data\<Name>.json` for 83,983 gameplay records, `data.tsv` their index); `web_opt\` the web build (`maps\<path>.json` + `.bin` for 74 levels, `terrain\`, `physics\`, `anims\` for 10,270 clips, `strings\English.json`, `models\`, `textures\`). `web_opt\README.md` and `GUIDE.md` describe every format; `qa\map_view\index.html` is a working three.js map viewer. The exporter is `tool\` (Frosty-driven C#); do not run it, it is the other session's.
- **The bucket**: `bf2017-assets` on the owner's Supabase (private). `data/` as `.json.gz` (45,224 of 83,983 on 2026-10-10, still uploading); `web/models`, `web/collision`, `web/textures` as the asset pipeline reads them; the maps, anims, terrain and physics go up on the same queue. A cloud session fetches data with `node scripts/bf2017-fetch.mjs data '<glob>'` (lane 0 adds the command; `SUPABASE_URL` and `BF2017_KEY` or `SUPA_KEY` in the environment).
- **The extractor** (lane 0): `node scripts/bf2017-data.mjs all --root <web dir> --level hoth_01 --era Orig` writes `src/data/bf2017/*.json`. On the owner's machine the root is `C:/Users/tilak/Downloads/BF2_Extract/web`; in the cloud, `lab/assets/bf2017`.

## Lanes

| lane | state | branch | plan |
| --- | --- | --- | --- |
| 0 data: extractor, parsers, rulebooks for Hoth's Galactic Assault | **not started** | `claude/bf-data` | `plans/2026-10-10-battlefront-lane0-data.md` |
| 1 sim, soldiers, weapons, bolts, nav, cover, the soldier bots, the skirmish arena | not started (needs 0) | `claude/bf-ai` | `plans/2026-10-10-battlefront-lane1-soldier-ai.md` |
| 2 Galactic Assault: stages, objectives, spawning, Battle Points, the commander, balance | not started (needs 1) | `claude/bf-assault` | `plans/2026-10-10-battlefront-lane2-galactic-assault.md` |
| 3 heroes: abilities, saber combat, hero bots | not started (needs 1); plan when 1 merges | `claude/bf-heroes` | |
| 4 vehicles: AT-AT escort, walkers, speeders, turrets, mounts, vehicle bots | not started (needs 2) | `claude/bf-vehicles` | |
| 5 the world: assets adapter (dev backend), map, terrain, physics, figures on the game's clips, camera, input, HUD, the route | not started (needs 0; the streaming lane for the bucket backend) | `claude/bf-world` | |
| 6 Blast, Heroes vs Villains, Strike, then the rest; the other maps' rulebooks | not started (needs 2, 5) | `claude/bf-modes` | |
| 7 online | later | `claude/bf-online` | |

Lanes 1, 3 and 5 run in parallel once 0 merges. Each lane adds its row's numbers here when it merges and a line to the spec's "Departures" for anything that went another way.

## Beside the asset lanes (PR #802 and PR #810)

`HANDOFF-bf2017.md` is the assets' hand-off and its status table is theirs. What this game takes from them, so nobody builds it twice: lane 1's `walrus.js` (figures on the game's skeleton), lane L's level pack and loader (run on the whole map with `--frame map --no-fit`, spec decision 12), lane G's light from the level's sky records, lane X's stroke tables for the heroes, lane V's vehicle models, lane S's fetch pool. What this game adds that they do not: the rules, the modes, the bots, the Battle Points, the HUD, the route.

## For the streaming session (the other account)

The game reads assets through one adapter, `src/components/battlefront/assets.js` (spec section 7): `loadModel(name, { lod })`, `loadClip(name)`, `loadMap(level)`, `loadTerrain(level)`, `loadPhysics(name)`, `loadStrings()`. Lane 5 writes the `dev` backend (Vite serves the local export's `web_opt/` at `/bf2/` from `BF2_ROOT`). The `bucket` backend is yours: the authenticated Supabase Storage loader (`web_opt/README.md` shows the headers), the cache headers and service worker from your asset-hosting design, and the gate in front of `/battlefront`. Build to the adapter's shapes and the game needs no change to switch. The names the game asks for are the export's own: model names from `models.jsonl`, clip names from `anims.jsonl`, level paths like `levels/mp/hoth_01/hoth_01`.

## Checking it

- Lane 0: `npx vitest run scripts/lib/bf2017-ebx.test.mjs scripts/lib/bf2017-rulebook.test.mjs scripts/bf2017-data.test.mjs src/data/bf2017 src/lib/battlefront/rulebook.test.js` (fixtures only, no export needed).
- Lanes 1 and 2: `npx vitest run src/lib/battlefront` and `npm run test:ai -- src/lib/battlefront` (the arena); `node scripts/battlefront-balance.mjs --skirmish` and `--assault` for the tables.
- Always: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Rules this game keeps

- Pure rules in `src/lib/battlefront/`, no three.js, no DOM; the world in `src/components/battlefront/` draws what the sim says.
- Every number from the rulebooks; a hand value says so (`source: "hand"`, a line in `src/data/bf2017/NOTES.md`).
- No sequel era; `isSequel` refuses it in the extractor and the rulebook test.
- No budget rows for this world (the owner, 2026-10-10); files still under 800 lines and the layer rules still hold.
- Nothing of the galaxy, the universe or any other world changes.
