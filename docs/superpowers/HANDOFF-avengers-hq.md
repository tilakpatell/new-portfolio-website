# Handoff: Avengers HQ, swinging and the grounds

Two pieces of work are on `main`: PR #108 (`claude/hq-web-swinging`, web-swinging) and the PR from `claude/hq-better` (roofs, street furniture, flags, the swing tour). This note is where things stand and what's left, for whichever session picks it up next.

## What's there

- **Swinging, zipping, wall-running, roofs.** All of it in `src/components/avengers/world/rules.js` ("swinging, and climbing" and "what a web can catch"), tested in `rules.test.js`. It's engineered from Insomniac's published design and three open re-creations; the sources, and which idea lives in which function, are in `docs/research/2026-10-05-web-swinging.md`. Tuning is all in `SWING`.
- **Controls.** Hold Space in the air (or the right mouse button, a pad's right trigger or A/B, the touch Jump button) to swing; W A S D steers; let go on the upswing to fly; Shift in the air (pad X, the touch Zip button) is a web zip; jump at a wall to run up it, jump again to kick off. Wired in `CompoundWorld.jsx`.
- **The drawing.** `scene.js` blends the rig's swing, flight, climb and landing poses over Spider-Man's clips (`offPose`, `holderAt`, `bankFor`), and drives the camera (FOV and distance with speed, a FOV bump per web, pitch following the arc). `swing.js` draws the web, splashes, the zip and the next-anchor mark. `grounds.js` draws the benches, planters, flagpoles and flags, roof plant, comms mast and the tour's rings.
- **The grounds.** Floodlight masts on the open lawn (`MASTS`, swing points), street lamps (`LAMPS`, Poly Haven's CC0 lamp), `BENCHES`, `PLANTERS`, `FLAGS`, `ROOF_PLANT`, `COMMS`, all placed in `rules.js` and solid where they should be. Roofs are concrete (`concrete-worn`), drives are slabs with joints (a shader on `roadMat` in `scene.js`).
- **The swing tour.** `TOUR`, `throughRing`, `stepTour` in `rules.js` (tested); the HUD chip and messages in `CompoundWorld.jsx`; best time in `localStorage` as `tp-hq-swing-tour`; the `swingtour` achievement in `Achievements.jsx`.
- **Multiplayer.** The town step's limits were widened (speed to 45, height to 80) in `middleearth/towns/travellers.js` so other players see him swing.

## Left to do

1. **Grass on the lawn.** The biggest visual gain left. Plan: GPU-instanced blades around the hero (an `InstancedBufferGeometry` of one 5-triangle blade, offsets in a patch about 40 m across that wraps round the camera in the vertex shader), on a `MeshStandardMaterial` with `onBeforeCompile` so it keeps the sun, shadows, fog and the `cloudy` cloud shadows. A canvas mask of where grass grows (the lawn minus the drives, the apron, the painted areas and the buildings) sampled in the vertex shader to scale blades to nothing off the lawn. Budget: about 40k blades on `high`, 15k on `medium`, none on `low` (`engine.small`, `engine.tier`).
2. **A lighting pass.** Sunlit white faces still bloom, the old white plant rooms most of all (the `box(...)` calls for the prow's and the wing's plant rooms in `scene.js`). Give them louvres like `grounds.js`'s air handlers and consider `sunIntensity` 3.3 → 3.0 in `setSky`. Then distant hills beyond the woods for depth.
3. **Check by eye** (none of these were confirmed in the headless captures):
   - the flags fly (they sit at 11 m, above the frame in every capture so far);
   - the street lamps' arms point over the drives (if they point away, flip the `yaw` in `LAMPS`);
   - the shrub model's origin is at one end (`hq/catalog.js`), so shrubs may sit off-centre in the planters: offset them by half their width.
4. **Play the swing tour at full frame rate.** The rings were laid out by geometry and the tests only prove each is near something to swing from. Ring 6 (over the glass wing's roof, 31.5 m up) and ring 3 (under the bridge) most need a real run; move rings and retune `SWING` from what a player actually does.
5. **Holograms of other players.** `scene.js`'s ghost `animate` treats anyone over 0.05 m up as jumping, so a player standing on a roof shows the jump clip. Send whether they're on the ground in the step (`writeStep`), or pose by vertical speed.
6. **More Insomniac moves**, if wanted, in order of value: corner swings (bias `aimWeb` toward the street being turned into and swing the arc round), a point launch to a perch (needs a key: E is the doors), web wings.
7. **Phones.** Check the Jump and Zip buttons' layout (`.cw-hud-bottom` in `world.css`) on a narrow screen, and the frame rate on `medium` with the new props.

## How to check it

- `npm run lint`, `npm test`, `npx vite build`. Main is on Vite 8, React 19, three r186 and ESLint 9 since #110.
- In development the page exposes `window.__HQWORLD__` (`api`, `sim`). `sim.h` is the hero (set `x`, `z`, `y`, `mode` to teleport), `sim.keys` the held keys (`up`, `run`, `space`…), `sim.jump` / `sim.zip` presses, `sim.speedup` speeds the clock, `api.skipIntro()` skips the fly-in.
- Headless Chromium here (`/opt/pw-browsers/chromium-1194`, with `--use-angle=swiftshader`) draws this world at under 1 fps, so set `sim.speedup` and teleport rather than play through; capture with `page.screenshot` clipped to `.cw-stage` (an element screenshot waits for a stable frame and times out). Use `?quality=mid` for motion, `high` for stills.

## Gotchas

- Other sessions merge to `main` often: `git fetch origin main` and rebase before opening a PR.
- In these sessions GitHub's GraphQL is blocked: open and merge PRs with `gh api` (REST), e.g. `gh api -X PUT repos/tilakpatell/new-portfolio-website/pulls/N/merge -f merge_method=merge`.
- Put throwaway Vitest files inside `src/` (and delete them); vitest won't run tests from elsewhere.
- Spider-Man, Thor, Natasha, the Hulk and the armour are other people's Sketchfab models (credited). The swinging work only poses and moves them; it adds no Marvel artwork of its own.
