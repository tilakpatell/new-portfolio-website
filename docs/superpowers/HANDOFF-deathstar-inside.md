# Hand-off: aboard the Death Star

The explorable interior of both Death Stars at `/deathstar/inside`, and HD exteriors for both stations. Branch `claude/deathstar-inside`. The owner asked for it to be merged to main once done (a PR, green CI, a merge commit).

- Design: `docs/superpowers/specs/2026-10-07-deathstar-inside-design.md`
- Plan: `docs/superpowers/plans/2026-10-07-deathstar-inside.md` (seven phases; tasks numbered 1.1 to 7.4)

## Done

- The design and the plan, with both stations’ stories and the Easter eggs step by step.
- HD exteriors (Tasks 6.1 and 6.2, done early): `public/models/universe/death-star.hq.glb` (4096 maps, a baked plating normal) and N8’s Death Star II as `public/models/galaxy/deathstar2.glb` (2048) and `.hq.glb` (4096), served through `HD_MAPS` in `src/components/galaxy/models.js`. Shots in `docs/superpowers/shots/deathstar-hd/`. Still to do: load the 4096 files on ultra only, not high (about 170 MB and 250 MB of GPU memory), as planet maps already are.
- Phase 1, in progress: Tasks 1.1 (clips moved to `src/lib/three/clips.js`, `worldAt` longest match), 1.2 (route and registries, placeholder UI), 1.3 (layout and the DS1 graph), 1.4 (walker), 1.5 (doors), 1.6 (paths), 1.8 (the Imperial kit and the first rooms: Bay 327 with the Falcon, Docking Control 327, corridors, the lift), 1.9 (streaming), and parts of 1.10 (camera, figures) are committed. Each task is reviewed and fixed by a workflow before the next stage.

## Left, in order

1. Finish Phase 1: Task 1.10 (scene index, player, UI), Task 1.7 (the game and `module.js`), the gate (lint, test, build, health), then Task 1.11 (`scripts/deathstar-check.mjs`, screenshots of each room, fix the look).
2. Phases 2 to 5 and 7 of the plan; Phase 6’s views, ways in and gen3d issues.
3. The `/deathstar` page’s “Go aboard” button waits for PR #540 (it holds `src/pages/DeathStar.jsx`).
4. Open the PR; merge once both CI jobs are green.

## Checking it

- `npx vitest run src/components/deathstar/inside` for the rules.
- `npx vite` and open `/#/deathstar/inside?station=ds1&side=rebel&mode=roam` (once Task 1.7 lands). In development `window.__deathstar` has `teleport(room, x, z)`, `do(name, arg)` and `info()`.
- Rooms in DS1 so far: `hold` (in the Falcon), `bay327`, `field327`, `ctl327`, `corr327`, the lobbies and `lift1-l2`, `lift1-l5`, `lift1-l6`.

## Rulings made on the owner’s behalf

- Both stations in one world on `src/runtime`, not galaxy-surface zones (zones lack zone-to-zone doors, walls for enemies and bolts, more than four lamps, and lazy rooms).
- Third person over the shoulder, with a first-person switch on V.
- Ways in: the Death Star page, the galaxy (Alderaan’s tractor beam, Endor once its shield is down, Yavin’s TIE bay), the terminal.
- Paths are A* over doors and lifts, straight inside each convex room and bent round furniture; no nav grid.
- The DS2 hull’s lattice gaps were plated over from N8’s own texture so it reads as the half-built station of the film; credited as such.
- Nested rooms (`inside: parentId`) let the Falcon’s smuggling hold sit inside Bay 327.
