# Handoff: planet flight and the shared world (one lane per session)

Four lanes, one pull request each, three of them in parallel. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (the three pillars, the decisions, the reference code)
2. Your lane's plan under `docs/superpowers/plans/2026-10-09-*.md` (files, interfaces, tests)
3. `docs/health/RULES.md` (layers, size, tests, what may import what) and `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a world)
4. `docs/research/2026-10-09-flight-terrain-and-shared-world-references.md` (the repositories the owner pointed at; techniques only, no code borrowed)

## Which lane is yours

| Session | Lane | Plan | Branch | Starts from | Blocked by |
|---|---|---|---|---|---|
| A | flight terrain | `2026-10-09-flight-terrain.md` | `claude/flight-terrain` | main | nothing |
| B | durable world (Supabase) | `2026-10-09-durable-world.md` | `claude/durable-world` | main | nothing in code; the project's schema is applied by the owner or by `supabase db push` with a login |
| C | spatial channels (Nostr) | `2026-10-09-spatial-channels.md` | `claude/spatial-channels` | main | nothing |
| D | shared world | `2026-10-09-shared-world-integration.md` | `claude/shared-world` | main after A, B, C | A, B, C merged |
| E | landmarks and kit clutter | `2026-10-09-landmarks.md` | `claude/planet-landmarks` | main after A | A merged |
| F | the planet map | `2026-10-09-planet-map.md` | `claude/planet-map` | main after A | A merged |
| G | planet life (air, animals, people, hostiles) | `2026-10-09-planet-life.md` | `claude/planet-life` | main after A | A merged |
| H | occurrences and events | `2026-10-09-occurrences.md` | `claude/planet-occurrences` | main after D, G | D, G merged |
| I | asset hosting on Supabase Storage | `2026-10-09-asset-hosting.md` | `claude/asset-hosting` | main after B | B merged |

Start A, B and C together. D, E, F and G start when A is on `main` (D also needs B and C). H starts when D and G are on `main`. E, F and G touch the same `scene.js` and `FlightHud.jsx`: each adds its own module and one call site, merges `origin/main` before its last push, and keeps the other lanes' calls.

## The Supabase project

- URL: `https://jzabcqboyemokwifmjmp.supabase.co` (a URL is not a secret).
- The **publishable** key is the only key the client holds. It lives in `.env.local` (git-ignored by `*.local`; `.env.example` lists the names) and, for the deploy, in the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (lane B's `deploy.yml` change reads them). Never commit it, never print it, never put a key in a prompt, a PR, a commit or a log.
- The **secret** key never appears anywhere in this repository, its workflows, or a session. A session that finds one in its environment uses it for nothing and says so.
- Applying the schema (`supabase/migrations/`, then `seed.sql`) needs more than the publishable key: the dashboard's SQL editor, or `npx supabase login` and `db push`. Lane B writes the check script and runs it if the schema is applied; if not, it says so in its PR and the owner applies `supabase/README.md`'s steps. Anonymous sign-ins must be enabled in the project's Auth settings.

## The rules (don't break)

- **Pure first.** `src/lib/land/**`, `src/lib/durable/**`, `src/lib/net/**` import no three.js and no React; tests beside each file, under a second, no network (`docs/health/RULES.md`).
- **A dependency has a page before it is imported** (`docs/stack/`, `scripts/stack-census.mjs`'s `PAGES`, `node scripts/stack-census.mjs --write`; `stack-pages` is budgeted at 0). Lanes A and B each add one; whoever merges second runs `npm install` and the census again on main.
- **Nothing a visitor can do is lost.** The galaxy surface's ground is unchanged after lane A's move of the flat (a before/after screenshot proves it); every existing Nostr room behaves exactly as before after lane C (its tests are unchanged and green).
- **Constants are the spec's**: `ROOT = 16384`, `MAX_DEPTH = 6`, `SPLIT = 1.6`, `SKIRT = 12`, `NET_CELL = 2048` (one constant, in `src/lib/net/cells.js`; the durable module's `CELL` equals it), `STALE_MS = 20000`, Nostr tag `g`, room `fly-v1:<planetId>`, RLS on every table, envelope cap 8,192 m a side and 2,000 rows, damage clamped to 30, hits 10 a second a caller.
- **Worlds are islands**: the flight world imports from `src/lib`, `src/runtime`, `src/data`, its own folder, and `universe/online`'s `nostr.js`, `protocol.js` and `names.js` only (as the towns do).
- **One lane per session, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never skip or quieten a test. Keep output terse; commits end with the harness's attribution lines; no model names in code or docs.
- **Before the PR**: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and your plan's smoke and probe lines.

## What done looks like, per lane

- **A**: `/fly/hoth` flies at 300 m/s over an endless snow world; the ground streams in with no crack and no stutter over 33 ms on mid; Echo Base at `(1200, −800)` is a flat plane the land eases into; rocks, spires and debris are three draws; `/galaxy/hoth/surface` looks exactly as before.
- **B**: `npm run build` with and without the env; the loader's tests green against the fake; `scripts/supabase-check.mjs` prints six `ok` lines against the project once the schema is applied (or the PR says it could not be applied and why).
- **C**: a room joined with `cells` sends `#g` in its REQ and re-asks on a cell change; a room joined without is byte-for-byte what it was; `scripts/online-check.mjs` passes as before.
- **D**: two browsers on `/fly/hoth` see each other's ships only within a cell of each other, a turret built in one is in the other within a second and after a reload of both, and a turret shot to nothing leaves both.
- **E**: Echo Base has its doors and generator, Mos Eisley its blocks, Cloud City its towers; trees and rocks are the kit's; each planet's download is measured.
- **F**: a minimap in the HUD and `M` opens the planet map with POIs, pilots, built things and a waypoint; nothing stored.
- **G**: Hoth has tauntaun herds and snowspeeder patrols, Coruscant three lanes of traffic, Dagobah only bogwings, Mandalore's glass nothing; a patrol scrambles at you over a garrison; the probe holds 33 ms with Coruscant's lanes full.
- **I**: the heavy models and scans load from the bucket by hash with a year's cache, the site plays unchanged with the bucket unset or blocked, an installed world caches the remote files, and the PR says how many megabytes moved.
- **H**: a blizzard on Hoth that both browsers see, the Purge at sundown, an eruption on Mustafar, wrecks with salvage and camps that fire.

## Status

| Lane | Done | Left | Checking it |
|---|---|---|---|
| A | #784 (`claude/flight-terrain`): `/fly/:planet` over streamed leaves for the note's fifty worlds (`lib/land/flight/planetTables.js`), each galaxy world on its walkable site's own layers and ground (the surfaces' material moved to `lib/three/groundLook.js`, no pixel changed), its places built of the site's film-made models; Coruscant one city to the haze (the film-made tower close, code-built beyond, the Senate and the Temple); the ground robust to a bad answer or a dead worker; `fastnoise-lite` with its page | its merge; on a GPU, the perf probe's worst frame (here, SwiftShader: software raster; the flight's own work 5.4 ms a frame at most); the asset host is lane I's (`claude/flight-terrain-assets`) | `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth,/galaxy/hoth/surface`; `node scripts/perf-probe.mjs fly` |
| B | All six tasks (PR from `claude/durable-world`): `docs/stack/supabase.md` and `@supabase/supabase-js`; `src/lib/durable/` (`supabase.js` null without env, `entities.js`, `entityLoader.js` tested against `fixtures/fakeClient.js`); `scripts/supabase-seed.mjs` → `supabase/seed.sql` (50 planets, Echo Base `r = 380`); the loader retries a lost ask or place after 1, 2 and 4 s, signs in again once on a 401, resubscribes a failed channel and asks every held cell for what it missed, and makes no grid on a frame that stays in its cell; `scripts/supabase-check.mjs`; `deploy.yml` reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` (set). The project has the three migrations and the seed, anonymous sign-ins on; on 2026-10-09 the check printed six `ok`. Two repairs the real project found: `check_placement` read a generated column still NULL in a `BEFORE` trigger (`20261009000100`), and the first file's tail (`entity_hits`, the Realtime line) had not run (`20261009000200`). The planets' id check takes upper case (Expanse ids are `E:…`) | When lane A's `planetSpec.js` lands: `node scripts/supabase-seed.mjs` and apply `seed.sql` again (the fixture's authored planets have placeholder types and seeds; it upserts). `CELL` in `src/lib/durable/entities.js` is `NET_CELL`, imported from `src/lib/net/cells.js` (lane C) | `node scripts/supabase-check.mjs`; `npx vitest run src/lib/durable scripts/supabase-seed scripts/supabase-check` |
| C | all five tasks: `src/lib/net/cells.js`, `refresh()` in `pool.js`, `cells`, `setCell`, `setCells` and the target's cell in `nostr.js`, `expanse/flight/flightProtocol.js` (PR #783). Also: `setCells` asks on the next tick, once a frame; an event from a cell not listened for is dropped and counted (`room.stats().offCell`); the goodbye is signed again when your cell changes; `readPose` takes the planet its tag must name. | lane D closes the one-grid line: `src/lib/durable/entities.js` imports `NET_CELL` instead of its own `CELL` (`cells.test.js` holds the two equal wherever `entities.js` is on the branch; on this branch it isn't yet, so that test checks nothing until lane B merges) | `npx vitest run src/components/universe/online src/lib/net src/components/expanse/flight`; `node scripts/online-check.mjs` |
| D | PR #799 (draft until #782, #783, #784 merge): the room by cell, other ships, B/X building with the `built` hint, turrets that fire and wear down through `damage_entity`, the terrain version migration and re-grounding, `entities.js` on `NET_CELL`; two fake browsers: no pose five cells apart, a pilot a cell away in 1.5 s, a turret across in 1.1 s and through a reload; 70 poses a second at ten pilots, radius stays 1 | CI; the owner applies `20261009000300_terrain_version.sql` and `seed.sql`; out of draft after the three merges | `node scripts/online-check.mjs --fly` |
| E | nothing yet | after A: the plan from Task 1 | `node scripts/perf-probe.mjs --routes /fly/hoth` over Echo Base |
| F | nothing yet | after A: the plan from Task 1 | smoke `/fly/hoth --phone` with the map open |
| G | PR #801 (draft until #784 merges), CI green: life tables for every named world and the Expanse rule (dead worlds empty), seeded rosters and routes, `life.js` on `src/lib/ai` within `LIFE_MS`, scrambles that hunt and fire, one instanced draw a model, “Patrol inbound” on the HUD; life's own work p99 2 ms on Hoth, 3 ms with Coruscant's lanes at the cap | the GPU worst frame; `LIFE_CELL` to `NET_CELL` and damage through lane D's hit path once D is on main; lane A's roster to carry `coruscant` and `geonosis` | `node scripts/perf-probe.mjs fly` on a real GPU |
| H | nothing yet | after D, G: the plan from Task 1 | `node scripts/online-check.mjs --fly` (one storm, two browsers) |
| I | PR #798 from `claude/asset-hosting`, out of draft: `scripts/assets-upload.mjs` (by hash, a year's cache, no overwrite, `--dry`, `--prune`, refuses in CI, the key from the owner's shell only), `src/data/assets-manifest.json` (`{}` until the upload), `src/lib/assetBase.js` (bucket first, the site after one failure), the manifest filtered by disk hash at build, packs and the service worker carrying bucket files, `ASSET_BASE` in `deploy.yml`, CI building with and without it. Remote: 248 files, 83.1 MB (hq/models 7.9, hq/tex 31.5, cc0/galaxy 11.4, models/gen3d 16.1, kit 16.2); local: 7,708 files, 926.5 MB | the owner: `node scripts/assets-upload.mjs --dry`, then without, commit the manifest, set `ASSET_BASE` (`supabase/README.md`, “The asset bucket”); Pro before it is set for everyone (5 GB egress is a few hundred visits); `git fetch origin main && node scripts/assets-upload.mjs --prune` after each deploy that drops a file (it spares what main's manifest names) | `node scripts/sw-check.mjs --bucket`; `node scripts/sw-check.mjs`; a build with and without `VITE_ASSET_BASE` |

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR and say so in the PR body in one sentence. The reference code in the spec is a starting point: a test that proves it wrong wins.
