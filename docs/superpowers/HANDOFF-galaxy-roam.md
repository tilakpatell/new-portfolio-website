# Handoff: the galaxy's open bugs and its expansion (6 October 2026)

For a session on either account, with no history. The code is the truth where this disagrees with it.

## Done

- **PR #325** (`claude/universe-exits`): hangar tabs on phones, the universe panel cleanup, no phantom re-jump after a hyperspeed jump, arrows and Space fly with a button focused, galaxy mouse and touch alive from page load (`runtime/input.js` no longer steals the pointer from a control or a canvas that captured it), hyperspace exit speed capped by `space.boostAt`.
- **PR from `claude/galaxy-bugs`** (based on #325):
  - Galaxy boost holds while either Space or Shift is still down (`galaxy/scene.js` keeps a `held` set).
  - The invert switch no longer swallows the arrows (`universe/controls.js` `keyFlies`, used by both scenes' key handlers).
  - Alderaan arrivals keep clear of the Death Star and its tractor reach (`systems.js` `arrival`, `hazardsOf`, `TRACTOR_REACH`, `DEATHSTAR_REACH`; `world.js` reads the same constants). Tested over 400 arrivals.
  - The Star Destroyer drops in clear of the system's own solids (`createSetPieces(..., { solids })`).
  - Scarif's shield lights where you hit it (a flash, lit cells and a ring: `bodyShaders.js` `SHIELD_FRAG` `uHit`/`uHitAt`, `bodies.js` `hit(point)` and `hitLeft`), the ship is thrown back harder with a shake and a kick, the crew speak again after 45 s.
  - Crashing into a galaxy planet with a surface takes you to `/galaxy/:id/surface`, the screen washing out in the system's accent (`pages/Galaxy.jsx` `onCrash`, `leave(..., { crash: true })`, `data-leaving='crash'`).
  - **Phase 1 of the expansion, "Outlaws":** `galaxy/roamRules.js` (`galaxySide(sys)`, `ROAM_EVENTS`), `galaxy/roam.js` (`createRoam`, wrapping `createDirector`, which now takes an `events` table), wired into `galaxy/scene.js` `adventure()` and a galaxy `happen()` for `hunt`, `destroyer` and `bounty`. `hunted.js` gains `navy`, `fett`, `ig88`, `bossk`, `dengar`, `weequay`. Crew lines for all of them in `galaxy/lines.js` (cruiser and RV have the galaxy's own; every crew answers Hondo's pirates).
- Checked live in headless Chromium (dev server on 5188, `?quality=low`): fly-to-planet from the HUD label parks (192 s real at 1–4 fps); crash to surface; Scarif hit (`hitLeft` 0.89, speed reversed, crew line); the galaxy map on desktop: every open (M, Plot a course, Galaxy map button) × every close (Esc, close button, plotting a jump) leaves keys and mouse drag working.

## Left, in order

1. **Phone touch drag in the galaxy.** In the phone check (390×844, `hasTouch`), a CDP touch drag on the canvas never set `state.stick` (keys worked, the map opened and closed fine). Not root-caused: it may be the test's touch synthesis, or a HUD element over the canvas taking the touch. Probe with `document.elementFromPoint` at the drag spot and a real device. Script: the scratchpad's `live-check.mjs map phone` (not in the repo; rewrite from `scripts/galaxy-check.mjs`).
2. **Owner's new bugs, from the handoff message:**
   - Flying the galaxy as Rick and Morty (or the RV), the player on a surface can't use the lightsaber or guns. The hero/weapon code (`galaxy/surface/scene.js`, `heroes.js`, `gunplay.js`, `saber.js`) must work for every crew, not only the Star Wars ones. Make it universal.
   - You can phase through ships and stations in the galaxy. Only the planets, moons and the big stations are solids (`world.js` `addSolid`); the fleet's ships (battles, traffic, the Star Destroyer set piece) are not. Add hull solids for the capital ships (ship.js's `step` takes `solids`), or a bump off them.
   - The second Death Star model is poor. Replace it: Sketchfab CC BY first (`scripts/sketchfab-galaxy.mjs`, `galaxy-lod.mjs`), else Meshy (about 1,598 credits left, shared), else gen3d from a still. Owner overrode gen3d-first for stations.
   - Reduce the bloom and the chromatic-aberration look (`galaxy/post.js`, `universe/post.js`): tone down thresholds and strength.
   - Improve ship textures and scaling in the galaxy (`galaxy/models.js` `MODELS` sizes, `fit.js`, `tune()`).
3. **"Hyperspace to the planet is broken"**: not reproduced. The HUD label click and the autopilot park work headless once #325's pointer fix is in. Retest on a device after merging.
4. **gen3d issues (14 approved, none filed).** Ships: sw-pirate-fighter (Flarestar-class, Hondo's gang), sw-pirate-heavy (M12-L Kimogila), sw-z95, sw-yt2400, sw-ig2000, sw-houndstooth, sw-punishingone, sw-gunboat (Xg-1), sw-yt1300 (stock), sw-hwk290, sw-gr75, remakes sw-tiebomber, sw-tieadvanced, sw-slave1. Format: copy issue #350 (title `gen3d: <name>`; body `what:`, `front:`, `left:`, `back:`, `faces: 30000`, `tex: 2048`, a note). Pictures: 1024 px square JPEGs on white from Wookieepedia via `scripts/galaxy-refs.mjs` (`refs <kind> "<page>"` makes a contact sheet in `lab/refs/img/<kind>/`; `fetchRef(title)` fetches one), committed under `docs/gen3d/sw/` on a branch that never merges (only `main` deploys), linked by raw URL. Picked files (Wookieepedia `File:` titles), not yet fetched because `sharp` isn't installed here:
   - pirate-fighter: `Flarestar-class-attack-shuttle-SWESV.png`
   - pirate-heavy: `KimogilaHeavyFighter-JtL.png`, `M12LKimogilaHeavyStarfighter-SaS.png` (page: "M12-L Kimogila heavy starfighter")
   - z95: `Clone Z-95 starfighter SWE.png`, `OuterRimHeadhunter-SoR.png`
   - yt2400: `YT-2400-SWESV.png`, `YT-2400 light freighter schematics.jpg`, `Outrider canon.png`
   - ig2000: `IG88A-XWM.jpg`; houndstooth: `HoundsTooth 3quarters view-SWE.png`; punishingone: `JM-5K.png`; gunboat: `Xg-1 Star Wing FC.png` (595 px only)
   - yt1300: `YT-1300-with-Cargo-CFOWM.png`
   - hwk290: `HWK-290 light freighter SaS.png`, `HWK290-Kanan12.jpg`, `KananJarrus-SWZ85.png`
   - gr75: `RebelTransport-Fathead.png`, `RebelTransport-CGSWG.png`, `GR75Transport-MF45.png`
   - tiebomber: `TIE Bomber BF2.png`, `TIEbomber-CGSWG.png`, `TIEbomber-RFGE.png`
   - tieadvanced: `Rebels TIE Advanced x1 Fathead.png`, `TIEAdvancedx1-MF78.png`
   - slave1: `BobaFettsStarship-MF65.png`, `BobaFettsStarshipAft-MF65.png`, `BobaFettsStarship-CGSWG.png`
5. **Expansion, Phases 2–5** (owner's decisions): traffic (the `traffic` lists in `systems.js` are never read), distress calls, convoys, purrgil, meteors (add each to `ROAM_EVENTS` as the scene learns to play it: the universe's `happen` in `universe/scene.js` is the model); named NPCs (Lando and Fett first, then Wedge, Bossk, Hondo, Din Djarin, Hera); open systems (`EDGE` 900 → about 3,000, super speed, 3–6 places to find each); journeys (a route finder over `LANES` in `systems.js`, deep-space stops). **Phase 6, in part (Lane D of the hyperlanes plan, `claude/galaxy-routes`):** [x] the route finder (`galaxy/routes.js`: jumps along the lanes, timed by the route, 12 s at most, 1.6 times off the lanes; the holomap's course along them); [x] open systems (`EDGE` 2,400 and `PULSE` 120, the spec's numbers rather than 3,000, and the camera's far plane out to 12,000 so Endor's gas giant isn't cut off from the edge); [x] hyperspace traffic in each system's sky (`skyTraffic.js`, `skyStreaks.js`); [x] a jump off the lanes brings the Interdictor sooner. **Phase 6, the open systems finished (`claude/project-thread-9ha1nj`, [the design](specs/2026-10-07-galaxy-open-systems-design.md)):** [x] super speed inside a system (`space.js` `wideAlong`/`overdriveAt`: the boost opens into the ship's overdrive well out from everything, up to 360, the autopilot too); [x] three to six places to find in each system (`places.js`, `placesDraw.js`, the finds in `localStorage` `tp-galaxy-found`, the panel's Out there, a crew line and a `found` credit each). Left: journeys with deep-space stops (a jump that drops out partway along its route, somewhere to find there), and ships you can fly beside on the lanes (the streaks are only in the sky). Not seamless flight between systems. Online: pilots share the scenery (wall clock plus seed); each fights their own battles. Capital ships: Sketchfab CC BY by DanielAndersson (ISD II `b8bd2d35f7604670ab85242c06c6d280`, MC80 `9b5e5e5192f64a7faad93a3bfd2efaf2`, Nebulon-B `19b1b0126f8248c28ce38863413c30b8`). Budget: `/galaxy` is 8 MB; load event ships only when needed, code-built stand-ins until then.

## Checking it

- Dev server: `npx vite --port 5188 --host 127.0.0.1`. Headless Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with `--use-gl=angle --use-angle=swiftshader` runs at 1–4 fps; the sim clock runs about a tenth of real time (`MAX_DT` 0.05).
- Seed localStorage: `tp-intro='1'`, `tp-start='"universe"'`, `tp-universe-ship='"xwing"'`, `tp-worlds='"load"'`; sessionStorage `tp-galaxy-intro='1'`.
- Handles: `window.__galaxy()` (a summary, with `found` and `wide`: how open super speed is where the ship is), `window.__galaxyDebug` (`state`, `startJump`, `goTo` (a place's id too: `place-comet`…), `pin`, `hunters`, `war`, `finds`). To make the ship fly in a check, set `state.keys = { up: true, boost: true }` after `pin`, or it brakes near the planet.
- Bring an event on: `__galaxyDebug` has no roam handle yet; add `roam` to it if you need `roam.soon('bounty')`.
- Tests: `npx vitest run src/components/galaxy src/components/universe`; lint: `npx eslint src`.
- Something regenerates `src/data/health/latest.json` during runs. Don't commit it.
