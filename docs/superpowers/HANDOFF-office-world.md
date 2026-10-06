# Handoff: Dunder Mifflin Scranton, the walkable world

Date: 2026-10-05. Branch: straight to `main` (the user asked to merge as it's built).

## What the user asked

"Make a The Office world (keep the site page too, we want both) for the universe like the others, have fun and make it in depth. Models are there; make or find more if needed. Research how it looks before modelling." Then: "Hurry, build it now, less tests and research", "merge to main as you make it and write handoffs as you finish things", "no tests unless absolutely necessary".

So: the deep photo research was skipped. The floor is the repo's existing researched plan (`src/components/office/layout.js`, already used by the page's 2D map and 3D model), extended to be walked.

## Where it is

- `/scranton` now opens on the walkable office (like `/c-137` and `/avengers`); the whole old page is kept underneath, unchanged apart from its hero's top padding.
- Code: `src/components/office/world/`
  - `layout.js` — metres from the plan (`P(px, py)`), doorways cut into every room (Michael's, conference, Darryl's, break room, supplies, both restrooms, Ryan's closet, stairwell, the lobby door), walls/glass/colliders for the towns walker, rooms (`ROOMS`, `roomAt`), seats (`SEATS`, chair positions computed exactly as the page's `Tour3D.js` does), job spots (`SPOTS`), things to look at (`THINGS`), everyone's lines (`LINES`), Dwight's walk back, the fire drill's panic lanes.
  - `story.js` — 7 quests (`QUESTS`, `officeProgress`), achievements map (`SEAL`), the reception calls conversation and the Dundies conversation (towns `talk.js` format), chili slosh rules (`stepChili`), Jell-O and fire timings.
  - `set.js` — builds the full-height set from the page's office kit (`../kit.js`, `../props.js`): carpet/tile floors, drop ceiling with instanced troffers, cream walls + skirting + lintels + steel door frames, glass fronts with knee walls and horizontal blinds, outside windows with a painted parking-lot view and vertical blinds, signs (Dunder Mifflin logo in lobby and behind reception, Vance Refrigeration across the hall, lift doors, restroom/closet/stairs/annex/kitchen plates, EXIT signs), Pam's watercolour, bulletin board, whiteboard, TV, every desk dressed (monitor, keyboard, phone, nameplates, owner's item), reception counter + jelly-bean jar, Michael's credenza with Dundies, conference table + 10 chairs, copier, water cooler, filing cabinets, plants, kitchen (counter, cupboards, microwave, coffee maker, sink, fridge, table), break room (2 vending machines, 3 tables), supply room (steel shelves, instanced paper boxes), stairwell flight + rail; movable props (carried Jell-O, chili pot, spills, fire glow).
  - `scene.js` — `createOfficeWorld(canvas)`: lib/stage3d stage with a documentary grade, office HDRI, hemi + key (shadows on `high`), pool of nearest troffer point lights, alarm light; people via `../people.js` (`loadPeople`, everyone seated at their desk, Jim standing as the player, standing copies made on demand for Erin's break, Dwight's walk back, and 8 fire-drill runners); third-person camera kept inside walls and under the ceiling (`clearance`, `suggestYaw`); fx (fire + smoke in the conference-room bin, pops); `screenOf` for speech bubbles.
  - `OfficeWorld.jsx` — walking (towns walker/keys/stick/gamepad), HUD (towns `TownHud` parts + shire CSS, re-coloured in `world.css`), mini map of the floor, room name chip, bubbles with each person's lines, prompts, the 7 jobs, overlays for the existing `PaperToss` and `FactCheck` (both got an optional `onDone`), card fallback without 3D.
  - `sounds.js` — synthesised room tone (ballast hum, air, distant phone) and fire alarm.
- `src/components/office/people.js`: `walk(on, rate)` now takes a stride rate (default 1, so other worlds are unchanged).
- `src/components/Achievements.jsx`: 8 new achievements (`switchboard`, `jello`, `chili`, `olympics`, `falsefact`, `stressrelief`, `hoops`, `bestboss`), so the page's Dundies count them.
- The scene's desk cameras (reception, Michael's office, the free-throw line) are used whenever the mode isn't `walk` (`state.deskCam`).

## The jobs

1. **Cover reception** (Erin's chair): 5 callers describe who they want; put each through to the right desk. Wrong desks get a gag and the call rings again.
2. **The stapler**: take the Jell-O from the kitchen fridge → Dwight goes to the men's room for 32 s → set it at his desk → he walks back, sits, "All right! Who did this?" (`dwightPunish` clip). Still holding it at his desk when he gets back → caught (`identityTheft`).
3. **Kevin's famous chili**: from the lift to the kitchen counter; a slosh meter rises with jolts, sharp turns and running; over the brim → spill decal on the carpet, try again.
4. **Office Olympics**: paper toss overlay at Jim's desk (done when a round ends with a score).
5. **Dwight's fact check**: the fact-check overlay at Dwight's desk.
6. **Stress relief** (after 2 and 3): Dwight's fire safety seminar in the conference room → fire in the bin, alarm, red pulse, 8 coworkers running in panic lanes → reach the stairwell in 38 s.
7. **Office vs. warehouse**: down the stairwell (E at the stairwell door when there's no fire) to the warehouse; at the free-throw line a power meter swings, Space/Shoot in the green; 3 of 5 to win (`story.js` `HOOPS`, `shoot`, `stepHoops`).
8. **The Dundies** (after all the rest): Michael's office conversation, a Dundie for Jim, applause, `thankYou`.

### The warehouse (`warehouse.js`, added in the second push)

Its own floor east of the office (`layout.js` `WAREHOUSE`, x 30–54, z −8–8, walls appended to `WALLS`, colliders for racks/bales/forklift/stairs): concrete floor with yellow lines, block walls with a Dunder Mifflin-blue band, corrugated roof and trusses, 12 high-bay lamps, two roll-up dock doors (one up, a painted lot with a Dunder Mifflin truck outside, a spot of daylight), four rows of blue/orange pallet racks loaded with instanced paper boxes, shrink-wrapped bales, a yellow forklift, signs ("Days without an accident: 0", "Dunder Mifflin Warehouse", "Safety first", "Up to the office"), the stairs up, a hoop on the end wall with a free-throw line and a ball. Four more things to look at (forklift, accident sign, bales, dock). The mini map switches to the warehouse when you're in it.

Plus 9 things to look at with E (Michael's mug, Pam's painting, copier, vending machine, water cooler, supply room, whiteboard, lift, Ryan's closet) and every coworker greets you with their own lines as you pass.

## Not verified yet (no tests/QA, per the user)

- The 3D was seen to start in headless Chromium (`window.__OFFICE__` present, 16 people seated, no page errors), but no screenshot of the 3D view was checked: the software renderer was too slow to capture a frame at 1280×800 on the high tier. Things most likely to need a look: camera clearance in small rooms (Michael's office), blinds/window plane facing (sign of `side` in `WINDOWS`), the Erin standing copy position, the pot/Jell-O hand placement, fire-drill runners clipping desks, performance on `mid`/`low`.
- `npm test` was not run. `npx vite build` passes, and eslint passes on the changed files. (This repo's GitHub Actions runs look stale; don't count on CI to catch a broken main.)

## Next ideas (if continuing)

- Screenshot QA (dev hook: `window.__OFFICE__ = { api, sim, complete }`; set `sim.debugCam = { at: [x,y,z], look: [x,y,z] }` to frame a room).
- Warehouse people (Roy, Lonny, Madge) would need new models; Darryl could stand down there instead of his office.
- Done (third push): `outside.js`, the lot off the warehouse's open dock door (`layout.js` `LOT`, `CARS`, `PARK_SIGN`, `LIGHT_POLES`, `TREES`, `DUMPSTER`): the building's white back with ribbon windows, asphalt with stall lines and curbs, ten parked cars (a red Trans Am), light poles, trees, the dumpster, the Scranton Business Park sign, an overcast sky dome. Three more things to look at there. Nothing to do outside yet: a job there would be next (Michael's car, a fun run, the Dunder Mifflin truck).
- Pretzel Day, the Diversity Day cards, Prison Mike in the conference room, Creed's mung beans.
- Pick the 3D world's `WORLD_MB['/scranton']` (currently 5) from a measured load.

## Quality passes (2026-10-05/06, PRs #185, #197, #207, #223 and this one)

The user asked to "improve the Office world and really make it super super nice and high quality", merging as it goes. Five passes, each checked from fixed cameras in headless Chromium (`scripts/office-shots.mjs`; see "Checking it" below).

### Light and cost (#185)
- The pool of lights round Jim was point lights 20 cm under the ceiling: they burnt the tiles white and bloom spread that over the frame. They're downward spots now; bloom only picks up the troffers and signs (threshold 1.6).
- `world/ao.js`: contact shade (pools under every collider, darkening where walls meet floor and ceiling), three instanced draws. Its strength is painted grey on an opaque canvas and read as an `alphaMap`: a canvas's own alpha didn't survive the upload.
- `world/batch.js` (tested): everything static is merged by material per patch of floor. Look-alike materials are shared; plain one-colour props merge through vertex colours (roughness and metalness to the nearest ⅛); props under 45 cm don't cast shadows. Anything a job moves or hides is in the `keep` list in `scene.js`. Add new movable things there.
- The wall clock's glTF glass had transmission, which re-rendered every opaque object each frame. `kit.js` swaps it for plain glass.
- `scripts/office-simplify.mjs` brought the plant's soil from 36,685 triangles to 1,799.
- Before → after (high tier): 2110 → ~500 draws, 1.9M → ~0.7M triangles.

### Windows and ceiling (#197)
- `world/windows.js`: each outside window is a per-pixel parallax view (the lot two storeys down with its lines and cars, poles, the park's buildings and trees, hills, an overcast sky). Two small painted strips are each drawn twice, as colour and as mask. Blinds are instanced 3D vanes; the glass fronts have 3D slats.
- `world/fixtures.js`: one 2×4 ft tile grid anchored to the building (`ceilingPlan()`). The troffers, diffusers, grilles, sprinklers and smoke detectors all sit in it. The bullpen's ceiling used to overlap the rooms inside it with different tile offsets. There are also outlets, switches, a thermostat, extinguishers and pull stations.

### Set dressing (#207)
- `world/furnish.js`: every desk is dressed from its own seed (tower, bin, cable, paper and folders, in-tray, mug, photo, sticky notes…). The copier, water cooler, fridge (with Angela's yogurt note), microwave, coffee maker and cupboard fronts are all built pieces.
- `layout.js` `LEAVES`: open doors hinged beside their walls, with colliders.
- `world/art.js`: posters, Michael's certificates, the lobby directory, the kitchen sign.

### Outside and the warehouse (#223)
- `world/cars.js`: extruded-profile cars with cut wheel arches (sedan, SUV, hatch, Michael's Sebring, Dwight's Trans Am).
- `world/scenery.js`: a sky (the camera's far plane was 80 m, so the old sky sphere never drew), a tree-line ring on the horizon, and seeded trees.
- Only the floor the camera is on is drawn (`camera.position.x > 25` is downstairs), which also keeps the horizon ring out of the office.
- Warehouse (`layout.js` `WH_PROPS`, with colliders): pallets under every rack load, a pallet stack, a pallet jack, bollards, cones, a workbench, a barrel and a time clock.

### Life (this PR)
- Coworkers get up (`layout.js` `AMBLES`): Meredith for coffee, Kevin to the jelly beans at reception, Oscar to the copier, Angela to the fridge, Creed into the supply room, Phyllis to the microwave. Their ways round the desks are found once by `world/paths.js` (grid A* over the walk's own colliders and walls, corners pulled tight; tested so every way is clear). Jim bumps into them. Their bubbles follow them. They stay seated during the fire drill.
  - The break room's vending machines can't be reached: the plan's three tables box them in.
- Markers: a gem over the nearest three jobs on Jim's floor, and a pulsing ring on the floor.
- One tired tube in the annex flickers, and the light under it with it.
- Footsteps by floor (carpet, tile, concrete, asphalt): `sounds.js` `step`.

### Checking it
- Start the dev server: `npx vite --port 5173`.
- Run `OUT=dir node scripts/office-shots.mjs [high|mid|low] [view…]`. The views are in its `VIEWS`. It clicks "Load the 3D" for a weak tier, snaps the camera, and writes a `sheet.png` of them all.
- Dev hooks: `window.__OFFICE__.sim.debugCam = { at, look }`; `sim.snap = true` jumps the camera; `sim.warp = 40` skips the scene clock (to see the amblers up); `api.renderer` / `api.scene` / `api.info()`.
- SwiftShader draws the lot slowly, so give it time (or snap).

### Next ideas
- Still the weakest (the stairwell was rebuilt after this list: the floor had covered its opening):
  - the people's faces and clothes (the cast's GLBs)
  - the break room's layout
- Signs could share one atlas (each is a draw).
- More amblers, or ones who talk to each other.
- A real get-up/sit-down animation instead of the swap.

## Accuracy and speed (2026-10-06)

Checked against 21 photos from visits to the real set (Flickr, CC, via Openverse: the reception desk, Jim's, Dwight's, Creed's, Kelly's, Toby's and Ryan's desks, the accountants, the annex, the break room, the warehouse, the lot) and RoomSketcher's plan.

### Accuracy
- `windows.js`: the outside windows have white one-inch mini-blinds (every window on the set does), not vertical vanes: open, raised half way, or shut.
- `paint.js` `screens`: the "Intra-Office Digital Hub" desktop redrawn from the photos (blue tab, logo, the four blue-bulleted links, XP taskbar). Every desk in the world shows it, as on the set.
- `paint.js` `nameplate`: black inserts with white letters in a silver holder (Michael's in capitals with his title, Ryan's in a serif with none); reception's grey "RECEPTION" plate on the counter.
- Reception: the jelly beans in a cut-glass bowl, not a jar.
- `kit.js` phone: the Cisco's silver-grey body, charcoal handset.
- Break room: a black glass-front snack machine and a blue soda machine; grey stacking chairs on chrome sleds at the white tables.
- Filing cabinets: green-and-white storage boxes along the top.
- Warehouse: the green safety sign ("This department has worked 0 days without a lost time accident"). Outside: the "Deliveries / Dock 1 / Dock 2 / Will Call" sign by the dock doors, and the park's sign as a charcoal cabinet with tenant panels (Vance Refrigeration in blue, Dunder Mifflin).

### Speed
- `people.js` `cull` option (the office world passes it): a person's skinned mesh had `frustumCulled = false`, so all seventeen were drawn, and drawn into the shadow map, every frame wherever the camera looked. With `cull` they get a bounding sphere from the bind pose (×1.4 for a cheer) and are culled. Other worlds are unchanged.
- `scene.js`: the shadow camera's box follows the camera (24 m, centred 8 m ahead, moved in whole texels), not the whole floor: fewer casters and sharper shadows. Downstairs it stays over the office.
- Seated people out of view (as of the last frame) skip their animation; only those within 5 m of the camera's focus cast shadows (checked every 0.4 s).
- Camera clearance tests only the walls and furniture near its line.
- Boxes (ream boxes, storage boxes) are one material each (`kit.js` `plainFaces`), so they batch.
- Measured in headless Chromium (draws / triangles a frame, high tier): bullpen 351/700k → 282/530k, kitchen 312/589k → 248/310k, annex 257/569k → 174/180k, warehouse 145/97k → 139/76k. Mid tier annex 135/228k → 118/64k. Script work a frame (GPU stubbed): 0.47 → 0.27 ms (bullpen), 0.66 → 0.21 ms (Michael's office).
- New shot views in `scripts/office-shots.mjs`: `counter2`, `docksign`, `parksign`, `safety`, `monitor`.
