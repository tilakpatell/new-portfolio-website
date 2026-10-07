# Aboard the Death Star implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Both Death Stars walkable room by room at `/deathstar/inside`, with people who work, patrol, talk and fight, two stories a station (Rebel and Imperial) over free roam, Easter eggs, and HD exteriors for both stations.

**Architecture:** One world module on `src/runtime` in the Death Star island (`src/components/deathstar/inside/`). Pure rules in `rules/` run the whole game at a fixed 30 Hz from a seeded random and are tested in Node; `scene/` draws what the rules hold and owns nothing the game needs; `module.js` binds input, steps and draws; `Inside.jsx` is the UI over it. A station is a room graph: walls, floors, doors, lifts and the paths people walk all come from it.

**Tech Stack:** React 19, three 0.186, vitest, `src/runtime`, `src/lib/ai`, `src/lib/three` (gltf, textures, house, pace, renderer, clips), Playwright (`playwright-core` with `/opt/pw-browsers/chromium`) for the browser checks.

**Spec:** `docs/superpowers/specs/2026-10-07-deathstar-inside-design.md`

## Global Constraints

- Route `/deathstar/inside`. Module `{ id: 'deathstar-inside', shading: 'glsl', mb }` with `mb === WORLD_MB['/deathstar/inside']`. Save key `tp-deathstar-inside`, version 1. Achievements prefixed `ds-`.
- Units are metres; +x east, +z south, +y up; yaw 0 faces −z, turning towards +x is positive. Positions in rules are `{ x, y, z }` objects (as `src/lib/ai` takes them).
- The sim steps at 30 Hz (`STEP = 1 / 30`); a frame runs at most 4 steps and drops the rest of a long `dt`.
- Rules never import three.js, React or the DOM; they take a seeded `rand` (`src/lib/seeded.js`), never `Math.random`. Tests sit beside each file and each runs under a second.
- Body: radius 0.35, height 1.8 (crouched 1.2), eyes 1.62 (crouched 1.05), walk 1.6 m/s, run 4.2, crouch 1.0, jump 4.2 m/s up, gravity 9.8 m/s², step 0.4 m. A fall onto a floor more than 6 m down, or into a void, puts you back at the last safe spot with a fall counted.
- Health 100; regenerates 8 a second after 5 s unhurt. Doors open within 2.2 m for anyone allowed, in 0.45 s.
- Weapons (damage, seconds between shots, heat a shot, bolt m/s, spread° player / NPC, range m): `e11` 18, 0.18, 0.09, 55, 0.6 / 2.4, 60; `dl44` 30, 0.32, 0.14, 50, 0.4 / 2.0, 50; `dh17` 16, 0.14, 0.07, 55, 0.8 / 2.8, 45; `a280` 24, 0.22, 0.10, 60, 0.4 / 2.0, 80. Heat 1 overheats and vents for 2 s; heat cools 0.5 a second.
- At most 3 NPCs hold a shot token against one target at a time.
- Perception: sight 22 m, cone cosine 0.57 (55° either side), `far` 1.2 s; hearing 18 m for shots, 6 m for running steps. Officers and Royal Guards see 26 m; mouse droids 8 m.
- Budgets (measured with `renderer.info` in the check script): draw calls 300 desktop / 150 phone; triangles 750 k / 300 k; animated people near you 24 high, 14 mid, 8 low.
- Worlds are islands: the inside imports only `src/lib`, `src/runtime`, `src/data`, `../plating.js`/`../planetPaint.js` (its own island) and its own files. Models from other worlds are loaded by URL, never imported as code.
- Every model through `lib/three/gltf.js` `loadGltf`; every image through `lib/three/textures.js` `loadTexture`/`sharpen`; the house look through `houseOn`. No new GLTFLoader or TextureLoader.
- Copy: British spelling, curly quotes (’ “ ”), plain sentences, no exclamation runs; only short famous lines quoted; signs, logs and barks original. No sequel-trilogy names anywhere (`rules/canon.test.js` bans `FN-2187`, `Starkiller`, `First Order`, `Kylo`, `Rey`, `Finn`, `Poe`, `Snoke`, `Hux`, `Phasma`).
- Comments say why; no TODO, FIXME or HACK; no file over 800 lines; no new `eslint-disable`.
- Before every push: `npm run lint`, `npm test`, `npx vite build`, `node scripts/health.mjs --check --skip build`. Never `git add -A` after a build (prebuild rewrites `public/github.json`).
- Don’t edit files in open PRs (#540: `src/pages/DeathStar.jsx`, `src/components/deathstar/{battle,voicelines,voicelines.test}.js`, `TrenchRun.jsx`).
- Commits end with the session’s attribution lines; no model names in code, docs or commits.

## Review Focus

1. **A hidden tab coming back** (a `dt` of seconds): at most 4 steps; a bolt already in flight is swept along its whole path, so it can’t skip through a wall. Tests in Tasks 1.7 and 2.4.
2. **Standing in a doorway when it shuts** (a lockdown sealing a blast door on you): you are pushed out to the side your centre is on, never left inside the wall or the leaf. Test in Task 1.5.
3. **A lift leaving with someone half in the car**: only bodies wholly inside the car’s box ride; anyone else stays on the landing and the doors don’t close on them. Test in Task 1.7.
4. **A room’s scene freed while its people are still fighting you** (you backed off four doors): people, bolts and doors live in the rules, so freeing the scene changes nothing in the fight; their figures come back where the rules say. Test in Task 1.9 (stream keeps rules untouched) and 2.7.
5. **Reloading in the middle of a scripted step** (the compactor’s walls closing, a cinematic): a story step restarts from its checkpoint, the state as it began, never mid-scene. Test in Task 3.6.

---

## Phase 1: the station you can walk (foundation)

### Task 1.1: Shared code down to the library; `worldAt` picks the longest match

**Files:**
- Create: `src/lib/three/clips.js` (moved from `src/components/rickmorty/portal/clips.js`, unchanged)
- Modify: `src/components/rickmorty/portal/clips.js` → `export * from '../../../lib/three/clips';` and nothing else
- Modify: `src/components/worlds/worlds.js` (`worldAt`)
- Test: `src/components/worlds/worlds.test.js`

**Interfaces:**
- Produces: `src/lib/three/clips.js` exports `RICK_HIPS`, `borrowClips(names, { loader })`, `retarget(clip, hipsY, from)`, `heading`, `faceForward`, `faceAhead` (same as today).
- Produces: `worldAt(pathname)` returns the world whose `to` is the longest prefix match.

- [ ] **Step 1: Failing test** — in `worlds.test.js`: `expect(worldAt('/dot-matrix/64').to).toBe('/dot-matrix/64')`, `expect(worldAt('/dot-matrix/64/castle').to).toBe('/dot-matrix/64')`, `expect(worldAt('/deathstar').to).toBe('/deathstar')`.
- [ ] **Step 2:** `npx vitest run src/components/worlds/worlds.test.js` → FAIL on `/dot-matrix/64`.
- [ ] **Step 3:** `worldAt` filters every match and returns the one with the longest `to`. Move clips.js; re-export from the old path.
- [ ] **Step 4:** `npx vitest run src/components/worlds src/components/rickmorty src/components/universe/footScene` (and the import test `src/imports.test.js`) → PASS.
- [ ] **Step 5:** Commit.

### Task 1.2: The route and every registry

**Files:**
- Create: `src/pages/DeathStarInside.jsx`, `src/components/deathstar/inside/module.js` (stub), `src/components/deathstar/inside/module.test.js`
- Modify: `src/App.jsx` (lazy import, `<Route path="/deathstar/inside">`, Footer exclusion), `src/components/universe/universes.js` (starwars `pages`: `{ to: '/deathstar/inside', world: 'Aboard the Death Star' }` after `/deathstar`; `byPath` maps it to starwars), `universes.test.js` (WORLDS order), `src/components/worlds/worlds.js` (`'/deathstar/inside': 6`), `src/components/guide/routes.js` and `pages.js` (keys, touch, tips), `src/components/tour/brief.js` and `briefs.js` (3–6 steps, the last at `'guide'`), `src/components/CommandPalette.jsx` (`w-dsin`), `src/components/universe/online/where.js` (place name “aboard the Death Star”), `src/components/Achievements.jsx` (`ds-aboard`).

**Interfaces:**
- Produces: `export default { id: 'deathstar-inside', shading: 'glsl', mb: 6, label: 'Aboard the Death Star', async create(rt, props) }` and `export const KEYS` (Task 1.7 fills it).
- Produces: `DeathStarInside.jsx` renders `<Inside mode="page" />` (lazy, `src/components/deathstar/inside/Inside.jsx`) when `use3D().on`, else the no-3D section, as `pages/Minecraft.jsx` does; then an About section with `WorldSwitcher` and a link back to `/deathstar`.

- [ ] **Step 1: Failing test** `module.test.js`: module matches `{ id: 'deathstar-inside', shading: 'glsl', mb: 6 }`; `WORLD_MB['/deathstar/inside'] === 6`; `worldAt('/deathstar/inside').to === '/deathstar/inside'`; `byPath('/deathstar/inside').id === 'starwars'`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add the registries. The guide’s `pages.js` entry lists the keys of Task 1.7 and Task 2.9; the brief’s steps point at `data-tour` marks Task 1.10 puts on the HUD (`ds-objective`, `ds-map`, `guide`).
- [ ] **Step 4:** `npx vitest run src/components/universe src/components/worlds src/components/guide src/components/tour scripts/prerender.test.mjs src/components/deathstar/inside` → PASS.
- [ ] **Step 5:** Commit.

### Task 1.3: The room graph and the layout it makes

**Files:**
- Create: `src/components/deathstar/inside/rules/layout.js`, `layout.test.js`, `rules/stations/ds1.js`, `rules/stations/index.js`

**Interfaces:**
- Produces the station data shape (each station file exports one):
  ```js
  {
    id: 'ds1', name: 'The Death Star', era: 'anh',
    sections: { bay327: 'Docking Bay 327', … },               // id → name the intercom uses
    rooms: [{ id, kind, name, section, x, z, w, d, y, h,       // centre x/z, width (x), depth (z), floor y, ceiling h
              round?: true,                                    // a round room: w is the diameter
              floors?: [{ x, z, w, d, y }],                    // room-relative; absent: one floor over the whole room
              restricted?: true, dark?: true, look?: string }],
    doors: [{ id, a, b, x, z, axis: 'x' | 'z', w, h, kind: 'slide' | 'blast' | 'arch' | 'hatch', lock?: string }],
    lifts: [{ id, stops: [roomId, …] }],                       // each stop a room of kind 'lift'
    starts: { rebel: { room, x, z, yaw }, imperial: { room, x, z, yaw } },
    spots: { [name]: { room, x, z, yaw } },                    // named places stories and brains use
  }
  ```
  `axis` is the wall’s direction (`'x'`: the wall runs along x, so the door is crossed along z). `lock` is `'flag:<name>'`, `'code:<digits>'`, `'scomp'` or `'side:imperial'`.
- Produces `buildLayout(station) → layout`:
  ```js
  {
    station, rooms: Map<id, room & { box: { x0, x1, z0, z1 }, doors: [doorId], floors: [{ x0, x1, z0, z1, y }] }>,
    doors: Map<id, door & { y }>,
    walls: [{ x0, z0, x1, z1, y0, y1, room, door?: doorId }],  // segments; a door's gap is its own segment with `door`
    lifts: Map<id, lift>,
    roomAt(x, y, z) → roomId | null,                           // the room whose box holds x,z with y within [floor − 0.5, ceiling]
    floorAt(room, x, z) → y | null,                            // null: a void (a shaft, a chasm)
  }
  ```
  Round rooms make 24 wall segments.
- Produces `validateStation(station) → string[]` (empty when good): every door’s centre lies on a wall of both its rooms (within 0.05 m) and inside that wall’s span; door ids unique; every room reachable from `starts.rebel.room` through doors and lifts; no two rooms overlap in x, z and y-range; every lift stop is a room of kind `'lift'`; every spot’s room exists; every `kind` is in `ROOM_KINDS`.
- Produces `ROOM_KINDS` (exported array): `'hangar','control','corridor','lift','lobby','detention','cellbay','cell','compactor','chute','shaft','chasm','conference','overbridge','firecontrol','tiebay','meditation','archive','maintenance','reactor','throne','holding','command','dock','superstructure','gallery'`.
- `ds1.js` in this phase holds: `hold` (the Falcon’s smuggling hold, its own small room inside `bay327`’s footprint but above it in y), `bay327` (64 × 48, h 26, its south wall the magnetic field: a door of kind `'arch'` to the room `field327`, a void-floored strip that is space), `ctl327` (Docking Control 327, 10 × 7, h 3, raised 6 m over the bay on its north side, a window over the bay), `corr327` (a corridor 3.2 wide), `lobby1` and `lift1-l2` / `lift1-l5` / `lift1-l6`, plus a second corridor ring stub. Phase 3 adds the rest.

- [ ] **Step 1: Failing tests** (`layout.test.js`): `validateStation(DS1)` is `[]`; a copy with a door moved 1 m off a wall gives an error naming the door; a copy with an unreachable room gives an error naming it; `buildLayout(DS1).roomAt(…bay327 centre…)` is `'bay327'`; `floorAt('field327', …)` is `null`; a 4 m door makes two wall segments plus one gap segment with `door` set; a round room makes 24 segments.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Walls: each side of a box, cut at every door on it.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

### Task 1.4: The walker

**Files:** Create `rules/walker.js`, `walker.test.js`.

**Interfaces:**
- Consumes: layout (Task 1.3); `passable(doors, doorId)` (Task 1.5).
- Produces `BODY` constants (the Global Constraints’ numbers) and:
  ```js
  createBody({ x, y, z, yaw = 0, r = 0.35, h = 1.8, room }) → body
    // body: { x, y, z, vy, yaw, r, h, room, ground: true, crouch: false, safe: { x, y, z, room }, falls: 0 }
  stepBody(body, { dir: { x, z }, run, jump, crouch }, dt, { layout, open: (doorId) => bool, solids: [] }) → events
    // dir: the wanted direction in the world, length ≤ 1; events: [{ type: 'land' | 'fell' | 'respawn' | 'room', … }]
  pushOut(body, layout, open, solids) → void            // out of walls (closed door gaps count as walls) and solids
  lineClear(layout, open, a, b) → bool                   // nothing solid between two points at a height (sight, shots)
  ```
  `solids` are `{ box: { x0, x1, z0, z1, y0, y1 } }` or `{ circle: { x, z, r, y0, y1 } }`. A solid whose top is within a step above your feet is stood on.

- [ ] **Step 1: Failing tests:** walking into a wall stops at r from it; walking diagonally into a corner stops in the corner without passing through either wall; a closed door’s gap stops you, an open one lets you through and `room` changes with a `'room'` event; walking off a ledge onto a floor 3 m down lands with `'land'`; off into a void gives `'fell'` then `'respawn'` at `safe` and `falls` is 1; a 0.3 m box is stepped onto, a 0.6 m box blocks; crouch lowers `h` to 1.2 and refuses to stand under a 1.5 m ceiling.
- [ ] **Step 2–4:** FAIL, implement (circle against segment, resolve up to 4 times), PASS.
- [ ] **Step 5:** Commit.

### Task 1.5: Doors

**Files:** Create `rules/doors.js`, `doors.test.js`.

**Interfaces:**
- Produces:
  ```js
  createDoors(layout) → doors      // { [id]: { open: 0…1, want: false, sealed: false, locked: bool } }
  stepDoors(doors, layout, dt, { near: [{ x, z, side, disguised }], flags: Set, lockdown: Set<section> }) → events
    // events: [{ type: 'open' | 'close' | 'seal' | 'unseal' | 'denied', door }]
  passable(doors, id) → bool       // open ≥ 0.8
  unlock(doors, layout, id, how)   // how: { flag } | { code } | { scomp: true }
  clearDoorway(doors, layout, bodies) → void   // a door closing on a body pushes it to the side its centre is on
  ```
  `'slide'` doors open for Imperials and the disguised; `'blast'` doors seal while their room’s section is in lockdown and stay sealed until it lifts; `'arch'` never closes; `'hatch'` opens only by `unlock`.
- [ ] Tests: a door opens in 0.45 s when an Imperial is 2 m away and closes when they leave; a Rebel without a disguise is `'denied'` at a slide door marked `lock: 'side:imperial'`; lockdown seals a blast door and `passable` is false; a body standing in the doorway as it seals ends on the side its centre was on, outside the wall’s thickness (Review Focus 2); `unlock` with the right code opens a `code:3263827` hatch and the wrong one doesn’t.
- [ ] Commit.

### Task 1.6: Paths

**Files:** Create `rules/nav.js`, `nav.test.js`.

**Interfaces:**
- Produces:
  ```js
  createNav(layout) → nav
  route(nav, from: { x, z, room }, to: { x, z, room }, { canPass = () => true, solidsOf = () => [] } = {}) → [{ x, z, room, door?, lift? }] | null
  ```
  A* over doors and lift stops (a door is a node at its centre; a lift costs 8 m a level), then within each room the straight line from point to point, with corners round any of the room’s solids (expanded by 0.4 m) the line would cross.
- [ ] Tests: a route from `bay327` to `ctl327` goes through the door between them; with that door refused by `canPass` it is `null` when there is no other way; a route between two lift landings uses the lift; inside `bay327` a route past the Falcon’s box goes round it (no segment crosses the box); the same start and end in one room is a single point.
- [ ] Commit.

### Task 1.7: The game and the world module

**Files:** Create `rules/game.js`, `game.test.js`, `rules/save.js`, `save.test.js`; fill `module.js`, `module.test.js`.

**Interfaces:**
- Produces `STEP = 1 / 30`, `ticksFor(dt, left) → { ticks, left }` (at most 4), and:
  ```js
  newGame({ station: 'ds1' | 'ds2', side: 'rebel' | 'imperial', mode: 'story' | 'roam', hero, seed, save }) → g
    // g: { station, layout, doors, you: body & { hp, gun, heat, armour, helmet, hero }, flags: Set, seen: Set<room>,
    //      lift: null | { id, from, to, t }, time, events: [] , rand }
  step(g, input, dt = STEP) → void      // pushes to g.events
  drain(g) → events
  input: { dir: { x, z }, yaw, pitch, run, jump, crouch, use, fire, aim, alt, reload, helmet, roar, map, choice }
  ```
  `use` near a lift’s call panel starts a ride: the car’s doors close (only if no body stands in their gap), 3 s pass, every body wholly inside the car moves by the offset between the two lift rooms, the doors open (Review Focus 3).
- `save.js`: `SAVE = 'tp-deathstar-inside'`, `SAVE_VERSION = 1`, `blank()`, `clean(old)`; the save holds `{ settings: { view: 'third' | 'first', sound, subtitles }, ds1: { story: { rebel: step, imperial: step }, seen: [], eggs: [] }, ds2: { … } }`.
- `module.js`: binds `KEYS` (`forward` W/↑, `back` S/↓, `left` A/←, `right` D/→, `run` Shift, `jump` Space, `crouch` C, `use` E, `fire` mouse 0 via the page, `aim` mouse 2, `reload` R, `view` V, `helmet` H, `roar` G, `map` M/Tab, `pause` Esc/P, `talk1`–`talk4` Digit1–4), runs `ticksFor`, turns the stick and camera yaw into `dir`, draws through the scene (Task 1.8), and emits `'ui'` (mode, objective, prompt, talk, map), `'hud'` (hp, heat, gun, alert, section, room) and `'achievement'` events. Draws with `frame.renderer` every frame. Exposes `window.__deathstar` in development: `{ g, teleport(room, x, z), do(name, arg), info() }`.
- [ ] Tests: `ticksFor(1)` is `{ ticks: 4, left: 0 }`; `ticksFor(0.04, 0)` is `{ ticks: 1, left ≈ 0.0067 }`; a new DS1 rebel game starts in `hold`; walking 5 s north from the start in `bay327` changes room on the way through the door to the corridor (the door opened for an Imperial; for an undisguised Rebel the test sets a flag first); a lift ride moves you from `lift1-l2` to `lift1-l5` and leaves a body standing half out where it was; `clean` of `null`, of a v0 shape and of garbage gives `blank()`’s shape.
- [ ] Commit.

### Task 1.8: The Imperial kit and the first rooms

**Files:** Create `scene/kit.js`, `scene/rooms/index.js`, `scene/rooms/hangar.js`, `scene/rooms/control.js`, `scene/rooms/corridor.js`, `scene/rooms/lift.js`, `scene/probe.js`; tests `scene/kit.test.js` (pure parts only: the panel maths, the merge grouping).

**Interfaces:**
- Consumes: `paintPlating({ seed, size, kind })` from `../plating.js`; `loadTexture`, `sharpen`; `houseOn`.
- Produces:
  ```js
  createKit(renderer, { tier, small }) → kit
    // kit.mat(role): 'floor' (glossy black), 'wall' (grey plating), 'trim', 'grid' (the wall light grids, emissive),
    //   'ceiling', 'console', 'screen' (animated Aurebesh canvas), 'glass', 'red' (alert), 'rail', 'grate', 'black'
    // kit.panelWall(w, h, { lights, seed }) → geometry pieces; kit.lightGrid(w, h) ; kit.merge(parts) → Group (one mesh a material)
    // kit.dispose()
  ROOM_BUILDERS: { [kind]: (kit, room, layout, opts) → { group, lamps: [{ x, y, z, color, intensity, distance }], update?(t, dt, ctx), dispose() } }
  makeProbe(renderer, group, at) → { envMap, dispose }   // a 128-px cube made once when a room is built
  ```
  Bay 327: glossy black deck with recessed light rows, grey walls with tall rib bays, overhead gantries, the magnetic field as a faint blue shimmer on the south opening with stars and Alderaan’s rubble or Yavin beyond (`views.js` comes in Phase 6; a star sphere until then), the Falcon (`/models/universe/falcon.glb` scaled to 34.75 m long) on its landing gear with its ramp down, mooring clamps, the gantry office window glowing above. Docking Control 327: consoles round the window, the closet, the low door frame (the head-bump), the scomp link socket, a security camera. Corridors: the wall light grids every 4 m, black floors, grey ceilings with light strips. Lift: a small car with a call panel and level readout.
- [ ] Commit (visual checks are Task 1.11).

### Task 1.9: Streaming the rooms

**Files:** Create `scene/stream.js`, `stream.test.js` (the choice of what to build, show and free is a pure function).

**Interfaces:**
- Produces:
  ```js
  plan(layout, here: roomId, open: (doorId) => bool) → { build: Set<room>, show: Set<room>, free: Set<room> }
    // build: within 2 doors (lifts don't count); show: here plus rooms seen through open doors (one hop, two through open arches);
    // free: built rooms more than 4 doors away
  createStream(kit, layout, scene, { renderer }) → { update(here, open, t, dt, ctx), built: Map, dispose() }
  ```
  Building is spread over frames (one room a frame); a room’s lamps join the scene only while it is shown, and the tier caps lamps shown at once (high 12, mid 8, low 4), nearest first.
- [ ] Tests: in `bay327` with every door shut, `show` is `{ bay327 }`; with the door to `corr327` open, `show` gains `corr327`; a room 5 doors away that was built is in `free`; `plan` never touches game state (it takes only the layout and the open test) — Review Focus 4.
- [ ] Commit.

### Task 1.10: The player, the camera and the HUD

**Files:** Create `scene/figures.js`, `scene/camera.js`, `scene/index.js` (`createScene`), `Inside.jsx`, `inside.css`, `ui/Start.jsx`, `ui/Hud.jsx`, `ui/Map.jsx`, `ui/Touch.jsx`; test `scene/camera.test.js` (the pull-in maths).

**Interfaces:**
- Consumes: `borrowClips`, `retarget`, `RICK_HIPS` from `src/lib/three/clips.js`; `loadGltf`.
- Produces:
  ```js
  loadPerson(kind, { tall, tint }) → Promise<person>
    // person: { object, play(name, { loop, fade }), setAim(yaw, pitch), hold(gun), update(dt), dispose() }
    // clips: idle, walk, run from Rick's; hit, die, dieFwd, dieBlown, kneel, taunt from /models/galaxy/troops/clip-*.glb;
    //        shoot, shot, punch from /games/meshy/clips-*.glb
  cameraPose(body, { view: 'third' | 'first', yaw, pitch, aim }, hits: (from, to) => distance) → { pos, look }
    // third: 2.6 m behind, 0.55 m right, at 1.7 m; aiming 1.4 m behind; pulled in to 0.2 m before any wall
  createScene(renderer, { tier, small, station }) → { scene, camera, sync(g, alpha), resize(w, h), render(), dispose() }
  ```
  `Inside.jsx`: `<Inside mode="page" />` mounts the module with `useWorld`; the start screen (station, side, hero for Rebels: Luke, Han, Leia, Obi-Wan; for Imperials: a stormtrooper; story or free roam; Continue when a save exists); the HUD: health, the gun’s heat, the objective (`data-tour="ds-objective"`), the section and its security, the prompt (“E — call the lift”), subtitles, and the blueprint map (`data-tour="ds-map"`) that shows rooms seen; pause (resume, view, sound, subtitles, controls, quit); touch: a stick, a look pad, fire, aim, use, jump, crouch.
- [ ] Test: `cameraPose` pulls in to a wall 1 m behind; first person sits at the eyes.
- [ ] Commit.

### Task 1.11: Seeing it

**Files:** Create `scripts/deathstar-check.mjs`.

- [ ] The script starts `npx vite --port 5199`, opens Chromium (`/opt/pw-browsers/chromium`, WebGL through SwiftShader), loads `/#/deathstar/inside?station=ds1&side=rebel&mode=roam`, waits for `window.__deathstar`, then for each room in `ROOMS` (argv) teleports there, waits two seconds, writes `docs/superpowers/shots/deathstar-inside/<room>.png` and prints `renderer.info` (calls, triangles) and any console error. Exit 1 on a console error or no canvas.
- [ ] Run it for `bay327 ctl327 corr327 lift1-l2`; look at each shot against a film still and fix what reads wrong (scale, light, gloss); repeat until they read as the Death Star.
- [ ] Gates (lint, test, build, health) → commit.

---

## Phase 2: people and fights

### Task 2.1: The cast

**Files:** Create `rules/cast.js`, `cast.test.js`.

- Produces `CAST[kind] = { name, model, tall, tint?, side: 'empire' | 'rebel' | 'neutral', gun?, hp, voice?, role, speed?, armour? }` for: `stormtrooper` (`/models/galaxy/troops/stormtrooper.glb`, 1.83, `e11`, 60, voice `stormtrooper`), `dstrooper` (Death Star trooper: `/models/galaxy/crew/officer.glb` tinted black with a helmet built in code, 1.8, `e11`, 60), `gunner` (as `dstrooper` without a gun), `officer` (`officer.glb`, 1.78, `dh17`, 40, voice `imperialofficer`), `tiepilot`, `technician`, `vader` (`crew/vader.glb`, 2.03, saber, scripted), `tarkin` and `motti` and `tagge` (`officer.glb` with rank tints), `jerjerrod`, `emperor` (`crew/palpatine.glb`, 1.73), `royalguard` (`crew/senateguard.glb` tinted red, 1.9, a pike), `leia`, `luke`, `han`, `obiwan`, `chewie` (built in code), `threepio` (`surface/c3po.glb`), `artoo` (`surface/r2d2.glb`), `mouse` (`surface/mousedroid.glb`), `gonk` (`surface/gonk.glb`), `r5` (`surface/r5.glb`), `ito` (built in code), `dianoga` (built in code).
- Tests: every model path exists under `public/`; every voice is in `scripts/voices` sources or `allow-voiceless.json`; every gun is in `WEAPONS` (Task 2.4).

### Task 2.2: Security

**Files:** Create `rules/alarm.js`, `alarm.test.js`.

- Produces `ALARM = ['calm', 'wary', 'alert', 'lockdown', 'hunt']`, `createAlarm(station)`, `raise(alarm, section, how, at, now)` with `how` in `'odd' | 'seen' | 'shots' | 'body' | 'camera' | 'intercom'`, `stepAlarm(alarm, dt, now) → events` (`{ type: 'level', section, level }`, `{ type: 'intercom', key, section }`), `lockdowns(alarm) → Set<section>`.
- Timings: wary falls to calm after 20 s; `'seen'` makes alert; alert goes to lockdown after 6 s or at once on `'shots'`; lockdown turns to hunt 10 s after the last sighting; hunt stands down to wary after 60 s unseen; neighbouring sections go wary when one goes to lockdown.
- Tests for each transition and that a fresh sighting during hunt returns to lockdown.

### Task 2.3: The disguise

**Files:** Create `rules/disguise.js`, `disguise.test.js`.

- Produces `doubtStep(doubt, ctx, dt) → { doubt, blown, says }` with `ctx: { armour, helmet, running, shooting, restricted, escorting, ordered, officerAt, watchers }`: shooting or a helmet off in sight blows it at once; running seen +0.12/s; a restricted room +0.08/s; an officer within 3 m +0.05/s; escorting a prisoner without the `ordered` flag +0.06/s; nobody watching −0.04/s; `says` names the challenge line when doubt crosses 0.5 (“TK-421…”-style, the site’s own words but the one famous line).
- Tests for each rate and the instant cases.

### Task 2.4: Weapons and bolts

**Files:** Create `rules/combat.js`, `combat.test.js`.

- Produces `WEAPONS` (Global Constraints), `createCombat()`, `fire(combat, { from, dir, owner, side, weapon, npc }) → bolt | null`, `stepCombat(combat, dt, { layout, open, bodies }) → events` (`'hit'`, `'wall'`, `'deflect'`, `'vented'`), `heatStep(gun, dt)`, `hurt(target, amount, now) → 'hurt' | 'down' | 'dead'`, `regen(target, dt, now)`.
- Bolts are swept from their last position to the next against walls (closed door gaps included) and every body’s capsule (Review Focus 1); a body with `deflect` (a saber guard facing the bolt within 70°) sends it back along its path with the owner’s side changed.
- Tests: a bolt fired at a wall 3 m away gives `'wall'` within 0.1 s with the wall’s normal; with `dt = 2` a bolt still hits the wall, never a body behind it; five quick shots overheat an E-11 at the eleventh, it vents 2 s; deflection flips the side.

### Task 2.5: Minds

**Files:** Create `rules/brains.js`, `rules/routines.js`, `rules/fight.js`, tests beside each.

- Produces:
  ```js
  createCrew({ rand, layout, nav }) → crew
  addPerson(crew, { id, kind, room, x, z, yaw, role, squad?, hostile?, script? }) → person
    // role: { type: 'patrol', spots: [name] } | { type: 'post', spot } | { type: 'work', spot } | { type: 'chat', with }
    //       | { type: 'march', spots } | { type: 'droid' } | { type: 'scripted' }
  stepCrew(crew, dt, { you, alarm, doors, combat, flags, now, open }) → events
    // events: 'saw', 'lost', 'challenge', 'shoot' (→ fire), 'call' (radio: raise the alarm), 'say', 'died', 'fled', 'arrive'
  person: { id, kind, x, y, z, yaw, room, hp, mode: 'routine' | 'wary' | 'fight' | 'search' | 'flee' | 'down' | 'dead' | 'scripted',
            anim: 'idle' | 'walk' | 'run' | 'aim' | 'shoot' | 'hit' | 'die' | 'kneel' | 'talk' | 'work' | 'attention', aim: { x, y, z } | null }
  ```
  Perception from `lib/ai/perception` with `seesThrough` = `lineClear`; fights choose with `lib/ai/utility` among hold, cover (`spatial.cover` over candidate points in the room and the next), flank (through another door when `nav` has one), advance, fall back, search (`lib/ai/search` over the section’s spots), with `squad.createTokens({ pools: { shot: 3 } })`; routines are `lib/ai/tree` trees; movement follows `nav.route` with `steer.separate` among people; mouse droids flee a roar within 8 m and squeal; the Royal Guard and Vader stand where the story puts them.
- Tests (seeded, with a small `simulate(steps)` helper in `brains.test.js`): a patrol walks its round through two doors and back; a trooper who sees an undisguised Rebel at 10 m goes to `fight` and claims a shot token, a fourth trooper waits; a squad that loses you searches the section and goes back to routine after the alarm stands down; nobody’s path crosses a wall; a mouse droid runs from a roar.

### Task 2.6: Conversations

**Files:** Create `rules/talk.js`, `talk.test.js`, `rules/talks/ds1.js`.

- Produces `TALKS` (`{ [id]: { start, nodes: { [id]: { who, say, next?, choices?: [{ say, to, when?, set? }], end?, set?, does? } } } }`), `talkFor(person, ctx) → id | null`, `openTalk(id, ctx) → talk`, `choose(talk, i, ctx) → { talk, effects }`, `validateTalk(tree) → string[]`.
- Tests: every tree validates; the detention officer’s tree offers the 1138 transfer only with the `transfer` flag; choosing the last line of Han’s intercom ends with `does: 'shoot-panel'`.

### Task 2.7: The game runs them

**Files:** Modify `rules/game.js`, `game.test.js`.

- `step` now runs doors, crew, combat, alarm, disguise and talk in that order; events become `'say'`, `'intercom'`, `'alert'`, `'hit'`, `'died'`, `'achievement'`; `fire` from input makes a player bolt; hurt and death of the player (respawn at the section’s checkpoint in roam, the step’s checkpoint in a story).
- Tests: a scripted fight in `corr327` where you shoot two troopers ends with two `'died'` and the section on lockdown; a rebel who walks calmly past a post in armour keeps `doubt < 0.5`; the same rebel running past is challenged.

### Task 2.8: People and fights drawn

**Files:** Create `scene/people.js`, `scene/guns.js`, `scene/fx.js`; modify `scene/index.js`.

- Produces `createPeople(scene, kit, { tier })` → `{ sync(crew, alpha, cameraAt), dispose() }` (loads each kind once, clones; only the tier’s count near you animate, the rest pose still or hide; a dead body stays where it fell until its room is freed), `buildGun(kind) → Group` (E-11, DL-44, DH-17, A280 built in code: the E-11’s scope, folding stock and barrel shroud), `createFx(scene)` → `{ bolt(b), spark(at, n), scorch(at, normal), flare(at), smoke(at), explode(at, size), update(dt), dispose() }`, all pooled, the bolt a red or green emissive capsule with a glow sprite, one flare light kept in the scene at 0.

### Task 2.9: Fight and talk in the UI

**Files:** Modify `ui/Hud.jsx`, `inside.css`; create `ui/Talk.jsx`.

- The crosshair (in third person off-centre with the camera), hit markers, the heat bar with its vent, a red edge when hurt, the section’s security as a strip (“Detention block AA-23 — LOCKDOWN”), the disguise’s doubt as an eye that fills, the conversation box with numbered choices (keys 1–4, taps), subtitles with the speaker’s name.

### Task 2.10: Sound

**Files:** Create `scene/sounds.js`.

- Produces `createSounds(bus, ctx)` → `{ hum(room kind), door(kind), lift(on), alarm(level), blaster(weapon, at, listener), hit(at), saber(on), step(surface), say(who, text), music(mood), update(listener), dispose() }`. Synthesised in Web Audio (the station’s low hum and vents per room kind, the door’s hiss, the klaxon), blasters through `lib/sfx` `blast`/`laser`, voices through `lib/voiced` `sayVoiced`, music original (a low brass-like drone with a march figure for alerts).

Gates and the check script over the Phase 1 rooms with people in them → commit.

---

## Phase 3: the first Death Star, whole

### Task 3.1: The whole DS1 graph

Complete `rules/stations/ds1.js` with sections and rooms: `bay327`, `field327`, `hold`, `ctl327`, `corr327`, the Level 5 corridors, `lobby5`, `aa23` (detention control), `cellbay` (curved, cells 2180–2190 as rooms of kind `cell`, `cell2187` among them, the chute grate in its wall), `chute`, `compactor` (3263827: 10 × 4, h 4, water 1 m deep as a floor at y − 0.9 with a walkway), `maint` (maintenance corridors), `core6` (Level 6 core shaft corridor), `tractor` (the terminal ledge over a void shaft, kind `shaft`), `chasm` (two ledges, kind `chasm`, a void between them, a bridge as a floor that exists only while the flag `bridge` is set), `officers` deck: `conference`, `overbridge`, `firecontrol`, `tiebay`, `archive` (the librarian), `meditation` (inspired, flagged in its `name`). Spots for every story step. Tests: `validateStation(DS1)` is `[]`; every story spot exists.

### Task 3.2: Furnishing (pure)

`rules/furnish.js` → `furnish(room) → { solids, props: [{ kind, x, y, z, yaw, scale?, tag? }], spots }` per room kind, so the walker, the paths and the drawing agree on where the table is. Tests: every prop’s footprint lies inside its room; no prop blocks a door’s 1 m in front of it.

### Task 3.3: Room builders for DS1

`scene/rooms/{detention,cellbay,cell,compactor,chute,shaft,chasm,conference,overbridge,firecontrol,tiebay,archive,meditation,maintenance}.js`, each from `furnish` plus its look: the detention block’s console horseshoe and cameras; the curved cell bay with numbered doors; cell 2187’s bench and the IT-O; the compactor’s murky water (a cheap animated normal), junk, ribbed walls on `moves` (the walls close in story), the dianoga’s eyestalk and tentacle (built, animated); the tractor beam terminal’s levers and lights over a glowing column with a long falloff of haze; the chasm’s depth (a long shaft with light bands receding, fog to black), the bridge’s extend; the conference room’s black round table and twelve seats (one empty); the overbridge’s pentagon screen and tulip stations and the window; fire control’s green button banks and the beam tunnel with eight tributaries; the TIE bay’s racks; the archive’s tape stacks.

### Task 3.4: The DS1 stories

`rules/story.js` (`storyStep(progress, story, event) → { progress, effects }`; step types `reach`, `talk`, `use`, `hide`, `escort`, `fight`, `kill`, `choose`, `timer`, `scene`, `swap` (play as someone else), each with `start`/`end` effects and a `checkpoint`) and `rules/stories/ds1Rebel.js`, `ds1Imperial.js` as the spec lists. Tests: each story played to its end by a script of events, with no step unreachable.

### Task 3.5: Scenes and scripted moments

`scene/cinematics.js`: the tractor beam pull into Bay 327 (from outside the station, the HD exterior once Phase 6 lands), Vader and Obi-Wan’s duel watched from the bay door, the swing across the chasm, the escape (the Falcon lifting through the field). Each is a camera path and a list of people’s actions the rules run as a `scene` step.

### Task 3.6: Checkpoints

Saving during a step stores the step’s checkpoint (the state at its start); loading restarts it (Review Focus 5). Test: save while the compactor’s walls are closing; load; the walls are open and the step is at its start.

Check script over every DS1 room → fix → gates → commit.

## Phase 4: the second Death Star

### Task 4.1: The DS2 graph — `rules/stations/ds2.js`: `dock` (ST 321’s bay), `command` (the DS2 command centre off the equatorial trench), `hangar272` (vast; troops in ranks are instanced figures), `holding` (the antechamber), `towerlift`, `throne` (the stairs, the throne on its swivel, the round window, the bridge over the reactor shaft, kind `throne`, its shaft a void), `reactorshaft`, `gallery` and `superstructure` (walkways over girders and the reactor chamber’s glow), `corridors2`.
### Task 4.2: Room builders for DS2 — red accents, the window’s spoked frame showing Endor, the fleet and the battle (Task 6.3’s views), the unfinished station’s girders.
### Task 4.3: Sabers and the Force — `rules/saber.js` (strokes light and heavy, guard, parry window 0.18 s, deflect, stamina), `rules/force.js` (push, pull, choke, lightning, the mind trick, distraction), with tests; `scene/saber.js` (blades with a core and glow, trails, sparks on clash, lightning arcs).
### Task 4.4: The DS2 stories — `ds2Rebel.js`, `ds2Imperial.js` as the spec lists, with the duel against Vader as a saber fight, the Emperor’s lightning, the unmasking scene, the reactor run out.
Check script over every DS2 room → gates → commit.

## Phase 5: Easter eggs, voices, sound

### Task 5.1: `rules/eggs.js` — the spec’s list, each `{ id, achievement, when(event, g) }`; tests that each fires from its event and only once.
### Task 5.2: Achievements — every `ds-*` id in `Achievements.jsx` with a title and a line; unlocked from `'achievement'` events in `Inside.jsx`.
### Task 5.3: `voicelines.js` — `VOICELINES` for every spoken line; `npm run voices:lines && npm run voices:tidy`; a GitHub issue labelled `voices` listing new speakers (tarkin, palpatine, jerjerrod, motti, intercom).
### Task 5.4: Music and ambience pass in `scene/sounds.js`.

## Phase 6: HD exteriors and the ways in

### Task 6.1: DS1 HD — re-run Quiznos323’s source (`scripts/sketchfab-galaxy.mjs` pattern; `SKETCHFAB_API_TOKEN` from the environment, never printed) at 4096 into `public/models/universe/death-star.hq.glb`; bake a 4096 detail normal from `paintStation` (`scripts/deathstar-normal.mjs`, run in Node with a canvas shim or as `sharp` raw pixels) and put it in the `.hq` file as KTX2 UASTC if `scripts/ktx2.mjs verdict` passes, else lossless WebP; `galaxy/models.js` serves `.hq` on high and ultra.
### Task 6.2: DS2 HD — N8’s Death Star II re-exported at 2048 (`deathstar2.glb`) and 4096 (`deathstar2.hq.glb`) with a new LOD; credits; Endor’s sky keeps `ds2sky.glb` or moves to the new file if lighter.
### Task 6.3: `scene/views.js` — what windows show: stars, a planet (Alderaan, Yavin, Endor at the right size and light), the fleet battle for DS2, the station’s own HD exterior for the arrival and the escape.
### Task 6.4: Ways in — the galaxy’s Alderaan `board` → `/deathstar/inside?station=ds1&at=bay327`, Endor’s `deathstar2` gets `board` → `?station=ds2&at=dock` when its shield is down, Yavin’s → `?station=ds1&at=tiebay`; `systems.test.js` and `world.test.js` updated; Terminal commands `board` and `aboard`; the `/deathstar` page’s “Go aboard” button once #540 has merged.
### Task 6.5: gen3d issues for Chewbacca, the dianoga, the Royal Guard and Tarkin (`desktop-jobs` skill), each with its reference; the built stand-ins stay until the models land.

## Phase 7: proof

### Task 7.1: Budgets — the check script on high, mid and low (`--quality`), every room under the budgets; fix what isn’t.
### Task 7.2: Phone — the check script at 390 × 844 with touch; the controls work and the text fits.
### Task 7.3: The bot — `scripts/deathstar-bot.mjs` plays each story by the dev hook’s `do` and asserts it ends.
### Task 7.4: Hand-off — `docs/superpowers/HANDOFF-deathstar-inside.md` (Done, Left, Checking it), the Death Star paragraph of `docs/architecture.md`, the README world row, `npm run credits`.
