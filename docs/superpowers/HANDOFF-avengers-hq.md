# Handoff: Avengers HQ, swinging and the grounds

Two pieces of work are on `main`: PR #108 (`claude/hq-web-swinging`, web-swinging) and the PR from `claude/hq-better` (roofs, street furniture, flags, the swing tour). This note is where things stand and what's left, for whichever session picks it up next.

## What's there

- **Swinging, zipping, wall-running, roofs.** All of it in `src/components/avengers/world/rules.js` ("swinging, and climbing" and "what a web can catch"), tested in `rules.test.js`. It's engineered from Insomniac's published design and three open re-creations; the sources, and which idea lives in which function, are in `docs/research/2026-10-05-web-swinging.md`. Tuning is all in `SWING`.
- **Controls.** Hold Space in the air (or the right mouse button, a pad's right trigger or A/B, the touch Jump button) to swing; W A S D steers; let go on the upswing to fly; Shift in the air (pad X, the touch Zip button) is a web zip; jump at a wall to run up it, jump again to kick off. Wired in `CompoundWorld.jsx`.
- **The drawing.** `scene.js` blends the rig's swing, flight, climb and landing poses over Spider-Man's clips (`offPose`, `holderAt`, `bankFor`), and drives the camera (FOV and distance with speed, a FOV bump per web, pitch following the arc). `swing.js` draws the web, splashes, the zip and the next-anchor mark. `grounds.js` draws the benches, planters, flagpoles and flags, roof plant, comms mast and the tour's rings.
- **The grounds.** Floodlight masts on the open lawn (`MASTS`, swing points), street lamps (`LAMPS`, Poly Haven's CC0 lamp), `BENCHES`, `PLANTERS`, `FLAGS`, `ROOF_PLANT`, `COMMS`, all placed in `rules.js` and solid where they should be. Roofs are concrete (`concrete-worn`), drives are slabs with joints (a shader on `roadMat` in `scene.js`).
- **The swing tour.** `TOUR`, `throughRing`, `stepTour` in `rules.js` (tested); the HUD chip and messages in `CompoundWorld.jsx`; best time in `localStorage` as `tp-hq-swing-tour`; the `swingtour` achievement in `Achievements.jsx`.
- **Multiplayer.** The town step's limits were widened (speed to 45, height to 80) in `middleearth/towns/travellers.js` so other players see him swing.

## Since then (2026-10-05, a later session)

Each was its own PR, merged to `main`: #138, #146, #149, #159, #169, #179, #186.

- **Perch mark and tests.** A cyan chevron over the perch `Q` would launch to (`swing.js`, from `findPerch` with the stick's direction, handed to the drawing as `move`). Tests for the point launch and the web wings, and a bot that plays the whole swing tour through the real rules (`tourBot` in `rules.test.js`: every third of a second it tries a dozen moves for the next 1.5 s and does whichever gets through the next ring, or nearest it; about 21 s round).
- **Peter's backpacks.** Twelve, on the roofs, up a mast and a flagpole, on and under the bridge (`PACKS`, `nearPack`; `packs.js` draws them in one instanced draw per part). Kept as `tp-hq-packs`; all twelve is the `backpacks` achievement.
- **Settings on `O`.** Look sensitivity, inverted pitch, camera distance, swing assist (`stepHero`'s `assist`), camera follow and kick (`SETTINGS`, `readSettings`, kept as `tp-hq-settings`). The minimap shows the tour's course and next ring.
- **Air tricks on `T`.** Flip, backflip (stick back), twist (stick to a side), in free flight only; style points, more for each in a row, a perfect release counting; banked on landing, lost by landing mid-trick (`TRICK`, `startTrick`, `bank` and `bail` events). Best bank kept as `tp-hq-style-best`; 2,000 is the `showboat` achievement.
- **The Iron Man armour.** `E` at its plinth by the workshop door: hover flight (`SUIT`, `stepSuit`, mode `suit`), Space up, Shift down, `E` to step out anywhere. The plinth is 4 m from the workshop door: whichever is nearer gets the `E`. Over the roofs in it is `suitup`.
- **The best lap as a ghost.** A tour is recorded every 0.1 s (`recordLap`); the best is kept (`tp-hq-swing-lap`) and raced as a hologram (`lapAt`) through the same ghosts as other players. Holograms' name cards now ride up with them (`middleearth/towns/ghosts.js`).
- **Photo mode on `P`.** Time stops, the HUD goes, the camera goes anywhere round him (`photoView`, never in a building or under the ground), and Save reads the canvas in the same task as one more render (no `preserveDrawingBuffer`).

## Left to do

1. A real phone: frame rate on `medium` can't be measured headless here.
2. Ring 3, under the bridge, is reachable (the bot gets it) but fussy by hand.
3. Thor, Natasha and the Hulk stand still: they could walk a beat, and the Hulk could be fought or raced.
4. The armour has no weapons: repulsors at Ultron drones over the trees would tie the world to Repulsor Range.
5. Photo mode has no filters or poses; Insomniac's has both.

## How to check it

- `npm run lint`, `npm test`, `npx vite build`. Main is on Vite 8, React 19, three r186 and ESLint 9 since #110.
- In development the page exposes `window.__HQWORLD__` (`api`, `sim`). `sim.h` is the hero (set `x`, `z`, `y`, `mode` to teleport), `sim.keys` the held keys (`up`, `run`, `space`…), `sim.jump` / `sim.zip` presses, `sim.speedup` speeds the clock, `api.skipIntro()` skips the fly-in.
- Headless Chromium here (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, with `--use-angle=swiftshader`) draws this world at under 1 fps, so set `sim.speedup` and teleport rather than play through. `page.screenshot` waits for a stable frame and times out: capture with CDP's `Page.captureScreenshot` clipped to `.cw-stage`. The frame loop only advances when something asks for a frame, so to let keys held in `sim.keys` act, take a few CDP captures in a row. Playwright's `click` on a HUD button can hang the same way: click it through `page.evaluate`. A QA script outside the repo needs a `node_modules` symlink to find `playwright-core`; one inside the repo trips `npm run lint`. Use `?quality=mid` for motion, `high` for stills.

## Gotchas

- Other sessions merge to `main` often: `git fetch origin main` and rebase before opening a PR.
- In these sessions GitHub's GraphQL is blocked: open and merge PRs with `gh api` (REST), e.g. `gh api -X PUT repos/tilakpatell/new-portfolio-website/pulls/N/merge -f merge_method=merge`.
- Put throwaway Vitest files inside `src/` (and delete them); vitest won't run tests from elsewhere.
- Spider-Man, Thor, Natasha, the Hulk and the armour are other people's Sketchfab models (credited). The swinging work only poses and moves them; it adds no Marvel artwork of its own.
