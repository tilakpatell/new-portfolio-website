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

Done since: phone layout (shorter hint, Zip and Perch stacked beside Jump), grass shorter and denser in a 30 m patch and thinned as the watchdog steps the tier down (`grass.density`), lamps without shadows (start view about 660k triangles), point launch (Q, pad d-pad up, touch Perch: `PERCHES`, `findPerch`, `pointLaunch`, a jump off a perch launches) and web wings (hold the web with nothing to catch while falling: `SWING.glide`). The tour was bot-played at 60 Hz through the real rules (a throwaway script): rings 0 and 5 were lowered; ring 3 under the bridge is reachable but fussy.

1. A real phone: frame rate on `medium` can't be measured headless here.
2. Tests for point launch and web wings (none yet, by request).
3. A bot playtest of the tour kept as a test (`docs`: the throwaway bot steered at the next ring, webbed when falling or low, let go past the anchor, zipped when slow).
4. Perch target mark: show where Q would go (reuse `swing.js`'s mark with `findPerch`).

## How to check it

- `npm run lint`, `npm test`, `npx vite build`. Main is on Vite 8, React 19, three r186 and ESLint 9 since #110.
- In development the page exposes `window.__HQWORLD__` (`api`, `sim`). `sim.h` is the hero (set `x`, `z`, `y`, `mode` to teleport), `sim.keys` the held keys (`up`, `run`, `space`…), `sim.jump` / `sim.zip` presses, `sim.speedup` speeds the clock, `api.skipIntro()` skips the fly-in.
- Headless Chromium here (`/opt/pw-browsers/chromium-1194`, with `--use-angle=swiftshader`) draws this world at under 1 fps, so set `sim.speedup` and teleport rather than play through; capture with `page.screenshot` clipped to `.cw-stage` (an element screenshot waits for a stable frame and times out). Use `?quality=mid` for motion, `high` for stills.

## Gotchas

- Other sessions merge to `main` often: `git fetch origin main` and rebase before opening a PR.
- In these sessions GitHub's GraphQL is blocked: open and merge PRs with `gh api` (REST), e.g. `gh api -X PUT repos/tilakpatell/new-portfolio-website/pulls/N/merge -f merge_method=merge`.
- Put throwaway Vitest files inside `src/` (and delete them); vitest won't run tests from elsewhere.
- Spider-Man, Thor, Natasha, the Hulk and the armour are other people's Sketchfab models (credited). The swinging work only poses and moves them; it adds no Marvel artwork of its own.
