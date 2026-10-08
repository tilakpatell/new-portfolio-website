# Hand-off: aboard the Death Star

The explorable interior of both Death Stars at `/deathstar/inside`, and HD exteriors for both stations. Branch `claude/deathstar-inside`, merged to main in stable checkpoints (a PR from `claude/deathstar-stable`, green CI, a merge commit): #564, #628, #650 and the one after them.

- Design: `docs/superpowers/specs/2026-10-07-deathstar-inside-design.md`
- Plan: `docs/superpowers/plans/2026-10-07-deathstar-inside.md` (seven phases; tasks numbered 1.1 to 7.4)
- Where it all lives: the `src/components/deathstar/inside/` entry in `docs/architecture.md`.

## Done

- Both stations, every room drawn by a builder of its own (`scene/rooms/index.test.js` holds that): the first station’s Bay 327 with the Falcon, Docking Control 327, the corridors and lifts, Detention Block AA-23, the cell bay and cell 2187, the chute and compactor 3263827, the maintenance corridors, the tractor beam’s terminal, the chasm with its telescoping bridge, the TIE bay, the conference room, the overbridge with Alderaan through its window, superlaser fire control, the records archive and Vader’s meditation chamber; the second station’s dock, command centre, Hangar 272, the tower’s antechamber and lift, the throne room with its spoked round window and the shaft in its floor, the reactor shaft, the gallery and the superstructure.
- The game (`rules/game.js` and `rules/play/`): the garrison in every room, the crew’s minds, bolts and blades for you and them, alarms and the intercom, disguise doubt, talk trees and keypads, the four story runs with checkpoints, companions, Easter eggs and achievements.
- The scene and the page: people, bolts, sparks, scorches, lightsabers, the windows’ views, the station’s sounds; the HUD with the story’s objective, the section’s security, the disguise meter, hit marks, the damage arc, the talk box and subtitles.
- HD exteriors: `death-star.hq.glb` and `deathstar2.hq.glb` (4096 maps), loaded on ultra only (`withHq` in `src/components/galaxy/models.js`); the window views use them on ultra too.
- Ways in: the `/deathstar` page’s “Go aboard”, the terminal’s `aboard` and `board`, and flying into the second Death Star at Endor once its shield is down (its dock, as a Rebel).
- `scripts/deathstar-check.mjs`: every room of both stations drawn in Chromium, screenshotted and held to the frame budget.

## Left

- The final whole-branch review’s deferred minors, if any (the ledger at `.superpowers/sdd/2026-10-07-deathstar-inside/progress.md`, git-ignored, lists them).
- Alderaan’s tractor beam and Yavin still board the `/deathstar` page (the superlaser and the trench run), as before; the page’s “Go aboard” takes you inside from there.
- The crew and the surfaces’ droids use the site’s shared rig and models; Chewbacca, the IT-O, the dianoga and the Death Star trooper’s helmet are built in code until gen3d models replace them.

## Checking it

- `npx vitest run src/components/deathstar/inside` for the rules, the scene’s pure parts and the module.
- `npx vite --port 5197` and open `/#/deathstar/inside?station=ds1&side=rebel&mode=roam` (or `station=ds2`, `side=imperial`, `mode=story`, `at=<room or spot>`). In development `window.__deathstar` has `g`, `teleport(room, x, z)`, `do(name, arg)` and `info()`.
- `OUT=<dir> node scripts/deathstar-check.mjs [station:room …]` with the dev server up.

## Rulings made on the owner’s behalf

- Both stations in one world on `src/runtime`, not galaxy-surface zones (zones lack zone-to-zone doors, walls for enemies and bolts, more than four lamps, and lazy rooms).
- Third person over the shoulder, with a first-person switch on V.
- Ways in: the Death Star page, the terminal and Endor once its shield is down. Alderaan’s tractor beam and Yavin keep boarding the `/deathstar` page, so the superlaser and the trench run stay where players know them.
- Paths are A* over doors and lifts, straight inside each convex room and bent round furniture; no nav grid.
- The DS2 hull’s lattice gaps were plated over from N8’s own texture so it reads as the half-built station of the film; credited as such.
- Nested rooms (`inside: parentId`) let the Falcon’s smuggling hold sit inside Bay 327.
- The 4096 Death Star maps load on ultra only: about a quarter of a gigabyte of graphics memory between them.
