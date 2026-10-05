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
- **Rick's garage, the show's size** (PR #117, merged). It is 7.2 × 8 m:
  `AREAS.garage` is x -303.6..-296.4, z 98..106. The layout is in the rules
  FURNITURE (workbench, bench-arm, laundry, plumbus, shelf-garage, worktable,
  portalpanic, govportal). HATCH is in the SW corner and GOV_PORTAL is on the
  east wall facing west.

## In progress
- **The school's Meshy cast:** goldenfold, principal, jessica, brad, tammy,
  ethan and tinyrick.
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
- **Jumping** (Space on foot):
  - Add `y` and `vy` to the Morty state in `stepMorty`.
  - Colliders get `top` (the furniture's `h`). A collider blocks only while
    `top > y + STEP` (STEP about 0.3). Morty stands on the highest top under
    him; gravity applies otherwise.
  - Give each room area a ceiling: house and upstairs 2.6, garage and school
    2.9 (check the other rooms).
  - Add a raised porch and steps at the house door in the rules, drawn in
    `street.js`.
  - The scene's Morty y comes from `scene.js:326`. The camera follows it.
  - `RmWorld.jsx:615`: Space walking is currently the page's; make it jump.
    Add a jump button for touch.
- **A bigger world:**
  - `AREAS.street` is x -60..60, z -40..40. Grow it with more streets and
    houses in the rules (NEIGHBOURS, TREES, FENCES and DECOR are data).
  - The edges should be things you can see (hedges, a tree line).
  - CRUISER: ceiling 40 → much higher. stepCruiser clamps to the street with
    EDGE; widen the flying bounds past the walkable ones. FED loop
    (`ship.js`) and its EDGE clamp too.

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
