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
