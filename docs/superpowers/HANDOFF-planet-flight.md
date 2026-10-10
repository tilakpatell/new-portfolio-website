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
| A | Tasks 1 to 9 in #784 (`claude/flight-terrain`): `/fly/:planet` over streamed leaves, three to five biomes a planet type (`lib/land/flight/tables.js`), a bad answer or a dead worker never a hole, `lib/land/flats.js` (the surface pixel for pixel), `fastnoise-lite` with its page, fifty planets in `planetSpec.js`'s `PLANETS` (Expanse ids lowered: `e:sx,sz:i:j`) | its merge; on a GPU, the perf probe's worst frame (here, SwiftShader: 524 ms of software raster, the flight's own work 9.3 ms at most) | `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth,/galaxy/hoth/surface`; `node scripts/perf-probe.mjs fly` |
| B | PR #782, out of draft, CI green, mergeable: `src/lib/durable/` (client, entities, loader with retries, re-sign-in and realtime resubscribe), `scripts/supabase-seed.mjs` (the 50-planet roster, idempotent), `scripts/supabase-check.mjs`, three migrations applied to the owner's project, six live checks `ok` | merge (the owner's); apply `seed.sql` once after lane A merges (old Expanse rows are deleted by hand); `CELL` to read `NET_CELL` (lane D) | `node scripts/supabase-check.mjs` |
| C | PR #783, out of draft, CI green: `src/lib/net/cells.js`, `refresh()` on a pool subscription, `cells` in `joinRoom` (the `g` tag out, `#g` in, re-asked on change), `flightProtocol.js`; a test that `CELL === NET_CELL` whenever `src/lib/durable/entities.js` is present | merge (the owner's); lane D makes `entities.js` import `NET_CELL` | `npx vitest run src/components/universe/online src/lib/net`; `node scripts/online-check.mjs` |
| D | PR from `claude/shared-world` (draft till #782, #783, #784 merge): `expanse/flight/shared.js` composing `online.js` (the room by cell), the loader, `peers.js`, `structures.js`, `bolts.js` on `pools.js`; `buildRules.js` (B, X, `grounded`), `turretRules.js` (aim, rate, turn, lead, bolts); Space fires; `entities.js`'s `CELL` is `NET_CELL` and carries `terrainVersion`; migration `20261009000300_terrain_version.sql`, `TERRAIN_VERSION` held to a hash of the ground, the seed writes it; `nostr.js` hands on each word's `g` tag; `online-check.mjs --fly` (fake relays that honour `#g`, `scripts/lib/fake-durable.mjs`), in CI's Multiplayer job. Measured (headless, software GL): five cells apart no pose crosses; a cell apart Alpha sees Bravo in 1.5 s; a turret is in the other browser in 1.1 s, kept over a reload, shot to nothing in 13 s and gone from both; Alpha takes 2.3 poses a second with two pilots (frames, not the wire, limit it here), 70 with ten: radius stays 1 (the room asks again on every cell crossing, so a 320 m/s ship never outruns its 3 × 3) | the owner: apply `20261009000300_terrain_version.sql`, re-run `node scripts/supabase-seed.mjs` and apply `seed.sql`, then the two-browser check against the real project (`npm run dev` with `.env.local`, two windows on `/fly/hoth`); a callsign over each ship; whoever changes a planet's ground bumps `TERRAIN_VERSION` (E, G) | `RELAY=fake node scripts/online-check.mjs --fly` |
| E | nothing yet | after A: the plan from Task 1 | `node scripts/perf-probe.mjs --routes /fly/hoth` over Echo Base |
| F | nothing yet | after A: the plan from Task 1 | smoke `/fly/hoth --phone` with the map open |
| G | nothing yet | after A: the plan from Task 1 | `node scripts/perf-probe.mjs --routes /fly/coruscant` |
| H | nothing yet | after D, G: the plan from Task 1 | `node scripts/online-check.mjs --fly` (one storm, two browsers) |
| I | nothing yet | after B: the plan from Task 1 | `node scripts/sw-check.mjs`; a build with and without `VITE_ASSET_BASE` |

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR and say so in the PR body in one sentence. The reference code in the spec is a starting point: a test that proves it wrong wins.
