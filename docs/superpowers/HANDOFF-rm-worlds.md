# Handoff: the Rick and Morty worlds, made immense (one phase per session)

Eight planets of the universe map's Rick and Morty sector become worlds on the galaxy's planet engine, each with its land, places, people, a ride, quests and a mission. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-08-rm-worlds-design.md` (what and why; the decisions; what it is not)
2. `docs/superpowers/plans/2026-10-08-rm-worlds.md` (your phase's tasks: files, interfaces, tests)
3. The engine's headers, which are the vocabulary: `src/components/galaxy/surface/sites/index.js`, `quests.js`, `actors.js`, `activity.js`, `rides.js`, `walker.js`, `placer.js`, `missions/index.js`, and one whole site (`sites/desert.js`) and its quests (`sites/quests.js`'s `endor`)
4. `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module; the dev-mode flight check pattern at the end)

## Which phase is yours

| Phase | Branch | Starts from | Blocked by |
|---|---|---|---|
| 0: the engine's seams, Gazorpazorp bare | `claude/rm-worlds-p0` | `main` | nothing |
| 1: the planets' kit | `claude/rm-worlds-p1` | `main` after 0 | 0 |
| 2–9: one planet each (`gazorpazorp`, `squanch`, `birdworld`, `gearworld`, `pluto`, `snakeplanet`, `purge`, `cronenberg`) | `claude/rm-worlds-<id>` | `main` after 1 | 1; parallel with each other |
| 10: the close | `claude/rm-worlds-close` | `main` after 2–9 | 2–9 |

## The rules (don't break)

- **The galaxy does not change.** Every galaxy world plays as it did; `sites.test.js`, `validity.test.js` and `scripts/travel-check.mjs` stay green and are not loosened. `pages/GalaxySurface.jsx` is not touched.
- **C-137 does not change**, apart from `PLANET_TASKS` leaving out the eight big planets' old box tasks and `destinations.js`'s `BIG` set. The dial, the rooms, the Citadel, Nuptia 4 and the Resort play as they did.
- **Site files are data.** No three.js in `sites/*.js` or `missions/*.js`. What a planet wants that the engine lacks is written as the nearest thing the engine has; the lack goes in this file's "Left" with a one-line proposal. No new step kinds, ride physics or mission kinds (the two open assumptions in the spec aside).
- **No new models.** A kind is a model in `public/` already, a dye of one, or built in `props.js`. No runtime call to any asset service. What would be better as a model goes in a `gen3d` issue (Phase 10 files them).
- **Save keys** `tp-rm-found`, `tp-rm-quests`, `tp-rm-missions`; nothing else is written.
- **One phase per PR, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never rebase someone else's branch.
- **Before the PR:** `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /c-137/<id>`; a screenshot per place in the PR; from Phase 2 on, the worst frame from `node scripts/perf-probe.mjs rmPlanet`.
- Keep output terse. Commits end with the harness's attribution lines; no model names in code, docs or commits.

## What done looks like, per phase

- **0**: `#/c-137/gazorpazorp` lands the cruiser on red dunes, Rick and Morty climb out, the women's gate is on the compass, E at the cruiser takes off and the page goes back to `#/universe/gazorpazorp`; `siteFrom(SITES.bespin, 'bespin', …)` equals `siteOf('bespin')`.
- **1**: a Gazorpian placed in `life` walks on his feet as a Meshy figure; the gate stands as a model from `/models/c137/rm/`; the four rides build and ride; `dyed` lives in `src/lib/three/dye.js` and the Death Star's tests pass.
- **2–9**: the planet's places all found on foot, every quest finished in the browser, the ride ridden, the mission won and lost with its stars kept in `tp-rm-missions`, the achievement granted.
- **10**: README, `docs/architecture.md` and this file up to date; the `gen3d` and `voices` issues open.

## Checking it

- Routes: `#/c-137/<id>`, `#/c-137/<id>?mission=<id>`. Behind the gate: `localStorage.setItem('tp-worlds', JSON.stringify('load'))`.
- Dev hooks: `window.__RUNTIME__`, `window.__surface()` (the scene's debug), `window.__surfaceDo(name, …args)` (the scene's methods: `takeOff`, `input.stick`…).
- The flight check: `scripts/.cache/rm-planet-check.mjs` on the world-runtime hand-off's pattern (git-ignored).

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR and say so in the PR body in one sentence.

## Status

| Phase | Branch | Merged |
|---|---|---|
| design | `claude/rm-worlds-design` | this PR |
| 0: the engine's seams, Gazorpazorp bare | `claude/rm-worlds-p0` | #676 |
| 1: the planets' kit | `claude/rm-worlds-p1` | #682 |

## Left

(Filled by each phase: what the engine lacked, one line and a proposal each.)

- **A talk bubble over the speaker** (0): the scene says who talks but not where they are on screen, so `RmSurface` pins the kit's `Bubble` above the foot. Proposal: the scene writes the speaker's screen spot to a `talkAt` ref the page hands in, as it does the compass.
- **The touch buttons are the galaxy's** (0): `SurfaceView` draws Vent, Aim and the hero's two powers whatever the page; a planet has no heroes. Proposal: `SurfaceView` takes a `buttons` list, the galaxy's by default.
- **`BIG` grows by phase** (0): `destinations.js`'s `BIG` holds only the planets with a site (Gazorpazorp so far). Each planet's phase adds its id there and its site to `PLANET_SITES` together (the test holds them equal); its old box task leaves C-137's `TASKS` with it.
- **Headless landings are slow** (0): software GL draws about a frame a second, so the flight check moves the scene's clock on with `window.__surfaceDo('advance', s)` (12 s for the landing; W and Shift held through another `advance` to walk) and sets `tp-quality` to `low`; screenshots need a 180 s timeout.
- **A flyer over deep water sinks to the bed** (1): `walker.js`'s `ride` holds a hover over the water (so the sled, the bike and the skiff are never lost in the oil or a lake: `rides.test.js`), but a `fly` ride with `hover: 0` (the glider) takes the ground under the water as its floor. Proposal: `ride`'s flyer takes `max(ground, world.water)` as its low, as the hover does.
- **One seat a ride** (1): the skiff "seats two" in the spec, but the engine sits only the rider; the mate walks. Proposal: a ride's `seats: [[x, y, z]…]`, the mate sat in the second while the rider rides.
- **The Cronenbergs aren't rigged** (1): the cast's `cronenberg` has no skeleton, so the catalogue has it as a plain model that sways in its step. Proposal: a `gen3d` issue for a rigged Cronenberg (Phase 10 files it).
- **What the kit added to the engine** (1): a catalogue row with `tall`, `wide` or `long` is sized once in `placer.js`'s `squared` (the planets' files aren't in metres as the galaxy's are); a built thing that `follows` is updated with where you are (`applyBuilt`'s `follows` sink: the shelling); `__surface()` lists `rides` (built or not) and each person's `fig` and `rigged`, for the flight check.
