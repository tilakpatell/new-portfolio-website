# Handoff: Dimension C-137 (`#/c-137`), round 5

Spec: `docs/superpowers/specs/2026-10-05-c137-world-design.md`, Amendment 5.
Code: `src/components/rickmorty/world/`. The rules are in `rules.js` (tested
by `rules.test.js`), `scene.js` draws them, `RmWorld.jsx` drives them, and
the rooms are in `interiors/*.js`.

The user's asks:
- Merge each part to main as it's finished, and always merge the worktree.
- Work directly: no subagents.
- Keep output terse.

## Done
- **A bigger world** (merged):
  - The street is x ±150, z ±55.
  - OUTSKIRTS houses are solid in the rules and drawn in `street.js`.
  - The edge is a hedge all round, with red and white barriers across the road.
  - The cruiser flies in FLY (±400 / ±260) up to a ceiling of 120, and lands only in the street.
- **The school's class** (PR #131, merged): Goldenfold, the principal, and
  Jessica, Brad, Tammy, Ethan and Tiny Rick sitting, all to talk to.
- **Jumping and the stoop** (PR #127, merged).
  - `MORTY.step`/`jump`/`gravity`/`height` in `rules.js`, plus CLIMB, CEILING, `supportAt` and `solidIn`.
  - Colliders carry `top`. `stepMorty` takes `move.jump`.
  - STOOP is in the rules, drawn in `street.js`.
- **School cast models** are fetched to `public/games/meshy/` (PR #127). They still need to be added to `portal/meshyCast.js` and placed in the school.
- **Rick's garage, the show's size** (PR #117, merged). It is 7.2 × 8 m:
  `AREAS.garage` is x -303.6..-296.4, z 98..106. The layout is in the rules
  FURNITURE (workbench, bench-arm, laundry, plumbus, shelf-garage, worktable,
  portalpanic, govportal). HATCH is in the SW corner and GOV_PORTAL is on the
  east wall facing west.

## In progress (all done; kept for reference)
- **The school's Meshy cast (models DONE):** goldenfold, principal, jessica,
  brad, tammy, ethan and tinyrick.
  - Their entries are in `scripts/meshy.mjs` (set `c137`, rigged).
  - The concept images are done; they are gitignored, in `lab/meshy/c137/`.
  - Each finished step's task id is kept in `scripts/meshy-tasks.json`, so
    re-running a step never pays twice.
  - To continue:
    `NODE_USE_ENV_PROXY=1 node --no-warnings scripts/meshy.mjs <models|rig|anim|fetch> goldenfold principal jessica brad tammy ethan tinyrick`
  - The output goes to `public/games/meshy/<name>{,-idle,-walk,-run}.glb`.
  - Then add the names to `portal/meshyCast.js` (MESHY, RIGGED, C137_PEOPLE).
  - Coach Feratu is never shown in the show, so he isn't drawn.
- **School interior** (`interiors/school.js`, area x -308..-292, z 194..206):
  - Lay out Mr. Goldenfold's classroom from the stills: the green chalkboard
    with sums, his desk, rows of desks with the kids sitting at them, the
    principal by the door, Tiny Rick in the class.
  - Sit the kids with Rick's sit clip, using `sitting()` + `facingAhead` from
    `interiors/people.js`, as the diner agent does.
  - The kids need PEOPLE, HOTSPOTS and SAY lines (the site's own words).

## To do
- Nothing open. Ideas for later:
  - More streets off the main road (side roads).
  - A gym and hallway for the school.
  - Morty's walking animation pausing while he's in the air.

## How to check
- `npm run lint`, `npx vitest run` and `npm run build` must all be clean.
- Dev server: `npx vite --config lab/c137/vite.t11.config.mjs --port 5197 --strictPort &`
- Shots: `node lab/c137/t11-shot.mjs '[["name",["garage",x,z,face,0,0.2],8]]'`
- Real-page flow: `node lab/c137/t16-page.mjs`; `CRUISER=1` runs only the
  cruiser part.
- `lab/` is gitignored (local tooling only).
- To merge: push the branch `claude/elegant-pasteur-m2jd13`, open a PR, then
  merge it with the GitHub MCP tools. After a merge, restart the branch from
  `origin/main`.
