# The Citadel of Ricks, inside — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A walkable 3D Citadel concourse at `#/c-137/citadel` where you play Rick C-137 through five scenes (Day Care, Simple Rick's, the Council, Vote Morty, Get to the cruiser), with Meshy figures in the show's cel look.

**Architecture:** A third town on the `towns/` kit (walker, story, talk, watchers, keys, map, TownHud), shaped like Bree: pure tested rules (`layout`, `story`, `daycare`, `wafers`), drawing modules (`concourse`, `rooms`, `people`, `scene`) behind one `createCitadelWorld` API, and a `CitadelWorld.jsx` that runs the loop, input and HUD. The look is Portal panic's: `MeshToonMaterial` + `InkPass` + bloom on `lib/stage3d`.

**Tech Stack:** React 18, Vite 5, three 0.180, Vitest, Meshy API (`scripts/meshy.mjs`), Kenney CC0 kits (`scripts/kenney.mjs`), Playwright on `/opt/pw-browsers/chromium` for QA.

**Spec:** `docs/superpowers/specs/2026-10-05-citadel-world-design.md`

## Global Constraints

- Coordinates: metres, +x east, +z south (north is −z); a walker's `face` turns +x to `(cos face, −sin face)`; a Meshy figure faces +z, so its `rotation.y = face + π/2`.
- Walkable disc radius 40; floor flat at y = 0.
- Quality over quantity: every person is a Meshy rigged figure; no code-built stand-in figures (fallback when a model fails: leave that person out, never a box).
- Crowd walkers by tier: `high` 10, `mid` 6, `low` 3.
- Seal ids exactly: `daycare`, `wafers`, `council`, `votemorty`, `citadelout`.
- localStorage keys exactly: `tp-citadel-done`, `tp-citadel-at`. Dev hook `window.__CITADEL__ = { api, sim, complete }` (DEV only).
- Route exactly `/c-137/citadel`; leaving goes to `/c-137`.
- New Meshy names exactly: `councilrick-a`, `councilrick-b`, `councilrick-c`, `cowboyrick`, `factoryrick`, `copmorty`; spend cap ~300 credits.
- Copy in the site's voice: plain sentences, curly quotes (’ “ ”), no exclamation-mark spam; British spelling as the rest of the site (colour, centre).
- Every commit: `npm test` and `npm run lint` clean. Commit messages end with the session's attribution lines.

## Review Focus

1. **Cornered Mortys** — a Morty fleeing into the outer wall, the core or the pen fence must slide along it, never freeze in place with Rick behind it. (Test in Task 5.)
2. **Coming back mid-scene** — reload while inside the factory or the chamber, or mid-herd, or mid-chase: the saved spot must be a clear place on the concourse (`validAt`), the herd and the line start fresh, and the progress is the saved one. (Test in Task 3 `validAt`; checked in Task 12.)
3. **Spamming the drop** — pressing Space faster than the line can lay layers, or holding it (key repeat), must lay one layer per press and never two in one frame. (Test in Task 6.)
4. **A model that fails to load** — a missing or broken GLB (offline, 404) must leave that person out and the world still running, not a blank canvas. (Checked in Task 12 by renaming a file in dev.)
5. **Losing the tab** — a hidden tab, a context loss, or leaving the page mid-chase must stop sounds and timers and dispose the stage; coming back shows cards with "Try 3D again" on loss. (Checked in Task 12.)

---

### Task 1: Meshy figures for the Citadel (runs in the background while Tasks 2–6 go on)

**Files:**
- Modify: `scripts/meshy.mjs` (add the `citadel` set)
- Create (generated): `public/games/meshy/{councilrick-a,councilrick-b,councilrick-c,cowboyrick,factoryrick,copmorty}{,-idle,-walk,-run}.glb`
- Modify (generated): `scripts/meshy-tasks.json`, `public/games/credits.json`

**Interfaces:**
- Produces: GLBs at `/games/meshy/<name>.glb` and `/games/meshy/<name>-{idle,walk,run}.glb`, same layout as `rick`, loadable by `createMeshyCast` (Task 7).

- [ ] **Step 1: Add the set.** In `scripts/meshy.mjs`, after the `HQ` block, add a `CITADEL` object and merge it with `set: 'citadel'` (output dir `OUT`, the same as the portal cast; extend the `sets` map in `main()` with `citadel`). Each entry: `rig: true`, `tex: 1024`, `poly: 14000`, `height` 1.8 for Ricks and 1.5 for Morty, `prompt` ending in `${BODY}`, default `STYLE`. Prompts:
  - `councilrick-a`: Rick Sanchez of the Council of Ricks (spiky pale blue-grey hair, unibrow) in a long formal white ceremonial robe with a tall stiff collar, gold trim and a gold chain of office.
  - `councilrick-b`: a Council Rick with a long grey beard and a ponytail, in dark navy formal robes with silver trim and silver shoulder plates.
  - `councilrick-c`: a Council Rick, bald with a goatee, in a white high-collared military coat with gold epaulettes and a sash.
  - `cowboyrick`: Cowboy Rick: Rick’s hair and unibrow under a brown cowboy hat, brown leather vest over a white shirt, red bandana, jeans, a big belt buckle, cowboy boots.
  - `factoryrick`: a Simple Rick’s wafer factory worker: Rick with a white hairnet over his hair, a tired face, a pale blue factory jumpsuit with a name patch, black work boots.
  - `copmorty`: Cop Morty: Morty Smith (short brown hair, round head) in a navy police uniform, a police cap with a badge, a duty belt, black shoes.
- [ ] **Step 2: Concept images.** Run `node scripts/meshy.mjs images citadel` (the key is already in the environment). Expected: six `image … 9 credits` lines.
- [ ] **Step 3: Judge them.** Read each `lab/meshy/citadel/<name>.png`. Reject any that is off-model (wrong hair or face, a prop in hand, not A-pose, text): delete that name’s `image` entry in `scripts/meshy-tasks.json` and rerun Step 2 for that name only.
- [ ] **Step 4: Models, rig, idle, fetch.** Run in order, each for `citadel`: `models`, then `rig`, then `anim`, then `fetch`. Expected: each prints a line per name; `fetch` prints the four files per name; `balance` still above 2700.
- [ ] **Step 5: Judge the models.** Read the `lab/meshy/citadel/<name>-front.png` thumbnails; any off-model: delete its `model`, `rig`, `idle` entries and rerun Step 4 for that name.
- [ ] **Step 6: Commit** the script change, `scripts/meshy-tasks.json`, `public/games/credits.json` and the 24 GLBs: “Citadel: six Meshy figures (the Council, Cowboy Rick, a wafer worker, Cop Morty)”.

### Task 2: Kenney Space Station props, recoloured

**Files:**
- Modify: `scripts/kenney.mjs` (add the `station` kit and its models)
- Create (generated): `public/games/kenney/station-*.glb`
- Modify (generated): `public/games/credits.json`

**Interfaces:**
- Produces: `/games/kenney/station-{chair,table,computer,computer-wide,container,container-tall,rail,pipe,banner,display}.glb`, loadable by `createModels({ base: '/games/kenney' })` (`src/lib/models.js`).

- [ ] **Step 1:** Add `station: { dir: 'kenney_space-station-kit/Models/GLB format', name: 'Space Station Kit', url: 'https://kenney.nl/assets/space-station-kit' }` to `KITS` and map: `station-chair: chair-cushion`, `station-table: table-large`, `station-computer: computer-system`, `station-computer-wide: computer-wide`, `station-container: container-flat`, `station-container-tall: container-tall`, `station-rail: rail`, `station-pipe: pipe`, `station-banner: wall-banner`, `station-display: display-wall-wide`. (Read the script’s converter first; if it reads GLTF with a separate texture, point it at the GLB folder instead.)
- [ ] **Step 2:** Run `KENNEY=<scratchpad>/kenney npm run kenney` (the kits are already unzipped in the session scratchpad; re-download from the URLs above if not). Expected: the ten `station-*.glb` written, each under 60 KB.
- [ ] **Step 3: Commit** “Citadel: Kenney Space Station props (CC0)”.

### Task 3: The concourse’s layout (pure)

**Files:**
- Modify: `src/components/middleearth/towns/story.js:14,20` and `towns/story.test.js` (`needs` may be an array)
- Create: `src/components/rickmorty/citadel/layout.js`
- Test: `src/components/rickmorty/citadel/layout.test.js`

**Interfaces:**
- Consumes: `pushOut`, `sightClear` from `towns/walker.js`.
- Produces (all exported from `layout.js`):
  - `WORLD = { radius: 40 }`, `RICK = { radius: 0.42, walk: 3.6, run: 6.8, accel: 16, turn: 11 }` (the `body` for `makeWalker`)
  - `CORE = { x: 0, z: 0, r: 5 }`
  - `START = { x: 0, z: 31, face: Math.PI / 2 }`, `ESCAPE_START = { x: -17.5, z: -17.5, face: -Math.PI / 4 }` (in front of the booth, facing the core)
  - `PEN = { x: -25, z: 0, w: 14, d: 12, gate: { x: -18, z0: -2, z1: 2 } }`, `inPen(x, z) → boolean` (inside the fence, 0.3 m in)
  - `DOORS = { factory: { x: 40, z: 0 }, council: { x: 0, z: -40 }, hangar: { x: 27.6, z: 27.6, w: 7 }, portal: { x: 0, z: 35.5 } }`
  - `SPOTS: [{ id, x, z, r }]` with ids `daycare` (−15.5, 0), `factory` (37.2, 0), `council` (0, −37.2), `ballot` (−19.4, −19.4), `hangar` (25.4, 25.4), `portal` (0, 35); r 2.2
  - `spot(id)`
  - `COLLIDERS` (circles/boxes as `towns/walker.js` documents; `low: true` for benches and the fence posts; `id` on each; kiosks, planters, the core and the customs desk tall)
  - `WALLS` (the pen fence as low wall segments with the gate gap), `HANGAR_WALLS` (the closed blast doors)
  - `ROUNDS` (four Cop Rick patrols between the booth and the hangar, `[[x, z], …][]`)
  - `CAST: [{ id, name, kind, x, z, face, moods: ['day'|'election'|'red'], lines: [], vote?: string }]` and `castFor(mood)`; kinds are Task 7’s kind names. Ids: `customs` (cop, at the desk), `daycarerick` (rick), `cowboy` (cowboyrick, votes), `worker` (factoryrick, votes), `copmorty` (copmorty, votes), `janitor` (meeseeks), `guard1`, `guard2` (cop, at the Council doors), `evilmorty` (moods `election`, `red`)
  - `CROWD_LOOPS: [[x, z], …][]` (closed loops on open floor)
  - `validAt(at, done) → { x, z, face }` (a saved spot if clear and inside the disc, else `START`; `ESCAPE_START` once `votemorty` is done and `citadelout` isn’t)

- [ ] **Step 1: Failing test for `needs` arrays** in `towns/story.test.js`:

```js
it('a quest can need several', () => {
  const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c', needs: ['a', 'b'] }];
  expect(progress(qs, ['a']).quests[2].open).toBe(false);
  expect(progress(qs, ['a', 'b']).quests[2].open).toBe(true);
  expect(progress(qs, ['a', 'c']).done).toEqual(['a']);
});
```

- [ ] **Step 2:** `npx vitest run src/components/middleearth/towns/story.test.js` → FAIL.
- [ ] **Step 3:** In `progress`, read `needs` through `[].concat(q.needs ?? [])` and require every one done (both for counting `done` and for `open`). Run again → PASS.
- [ ] **Step 4: Failing layout tests** in `citadel/layout.test.js`, mirroring `towns/bree/layout.test.js`’s `clear` and BFS `reachable` helpers (0.5 m cells inside `WORLD.radius`):
  - `START`, `ESCAPE_START`, every `SPOTS` entry, every `CAST` member and every `CROWD_LOOPS` point stand clear (`pushOut` with radius 0.45 leaves them where they are).
  - every spot is reachable from `START`; the `daycare` spot is outside the pen and `inPen(PEN.x, PEN.z)` is true; `inPen(-15.5, 0)` is false.
  - with `HANGAR_WALLS` closed the hangar spot is still reachable (the doors are behind it) and from `ESCAPE_START` the hangar is reachable.
  - every `ROUNDS` corner is clear for radius 0.45, and each round’s legs pass `sightClear` against `COLLIDERS` and `WALLS` at walking height (no patrol walks through the core).
  - the core blocks sight: `sightClear(-10, 0, 10, 0, COLLIDERS, WALLS)` is false; a bench doesn’t: pick one bench and check sight across it is clear.
  - `validAt(null, [])` is `START`; `validAt({ x: 0, z: 0, face: 0 }, [])` (inside the core) is `START`; `validAt({ x: 99, z: 0 }, [])` is `START`; `validAt({ x: 10, z: 10, face: 1 }, [])` keeps it; `validAt(null, ['daycare','wafers','council','votemorty'])` is `ESCAPE_START`.
- [ ] **Step 5:** Run → FAIL (no module). Write `layout.js` with the values above; place benches, planters and the two kiosks so that both the direct line booth → hangar and the line round the core’s west side each pass at least two tall pieces of cover. Run → PASS.
- [ ] **Step 6: Commit** “Citadel: the concourse’s layout, and quests that need several”.

### Task 4: The story (pure)

**Files:**
- Create: `src/components/rickmorty/citadel/story.js`
- Test: `src/components/rickmorty/citadel/story.test.js`

**Interfaces:**
- Consumes: `progress` (Task 3), `talkOn`, `newTalk` from `towns/talk.js`.
- Produces: `QUESTS` (ids `daycare`, `wafers`, `council`, `votemorty` with `needs: ['daycare','wafers','council']`, `citadelout` with `needs: 'votemorty'`; each with `name`, `where`, `blurb`, `go`, `locked`), `SEAL` (id → seal id, identical ids), `citadelProgress(done) → { …progress, objective, mood }` with `mood` = `'red'` when `votemorty` done and `citadelout` not, `'election'` when the first three are done and `votemorty` not, else `'day'`; `CONVOS` with keys `council` and `ballot`; `SPEAKERS`; `COPS` (watcher options).

- [ ] **Step 1: Failing tests:**
  - order: `citadelProgress([]).next === 'daycare'`, `.mood === 'day'`; with the three done `.next === 'votemorty'` and `.mood === 'election'`; with four `.mood === 'red'` and `.next === 'citadelout'`; with all five `.finished` and `.mood === 'day'`; `citadelProgress(['votemorty']).done` is `[]`.
  - every `CONVOS` link (`next`, each `choices[].to`) names a node of that convo; every convo has a path from `start` to a `won` end (BFS over `talkOn` with every choice); no node is unreachable.
  - the Council convo can be lost-and-retried: at least one choice of its first question leads back to that question (contempt), not to an end.
  - `COPS` keys equal Bree’s `NAZGUL` keys and `COPS.ringSight === 0`.
- [ ] **Step 2:** Run → FAIL. Write `story.js`. Copy:
  - `go` lines: Day Care: “Morty Day Care’s gate is open and its Mortys are loose. Get them back in before the Day Care Rick looks up.”; Simple Rick’s: “Simple Rick’s is short a Rick on the line. Stack three good wafers.”; Council: “The Council of Ricks would like a word with Rick C-137. Their doors are at the north end.”; Vote Morty: “It’s election day. Hear out three voters, then cast your ballot at Candidate Morty’s booth.”; Get to the cruiser: “Candidate Morty won, and his first order is your arrest. Get to the cruiser in the hangar without the Cop Ricks seeing you.”; finished objective: “The Citadel’s behind you. Portal home, or look round once more.”
  - the Council: three Council Ricks (`councila`, `councilb`, `councilc` in `SPEAKERS` as “Council Rick”, “Zeta Alpha Rick”, “Ricktiminus Sancheziminius”) accuse C-137 of killing Ricks and stealing their Mortys; two questions; the C-137 answers (dismissive, accurate, rude) advance; grovelling or lying get “Contempt of Council.” and loop back; ends `won` with “Dismissed. Get out of our chamber, C-137.”
  - the ballot: Evil Morty at the booth (“Candidate Morty”), three choices (him, “the Rick in the good suit”, write in “Rick C-137”); every choice leads to the count node: “The count is in. Candidate Morty wins in a landslide.” → `won`.
  - `COPS = { sight: 11, cone: 0.55, smell: 1.6, hear: 4, ringSight: 0, alert: 0.7, chase: 5.2, patrol: 1.6, giveUp: 6, leash: 16, catch: 1, look: 1.6 }`.
- [ ] **Step 3:** Run → PASS. **Commit** “Citadel: the story, the Council and the ballot”.

### Task 5: Morty Day Care (pure)

**Files:**
- Create: `src/components/rickmorty/citadel/daycare.js`
- Test: `src/components/rickmorty/citadel/daycare.test.js`

**Interfaces:**
- Consumes: `PEN`, `inPen`, `COLLIDERS`, `WALLS` (Task 3); `makeWalker` for `push`.
- Produces: `HERD = { count: 6, time: 75, scare: 4.5, flee: 3.1, wander: 0.9, radius: 0.35 }`; `newHerd(seed = 1) → { mortys: [{ id, x, z, face, speed, penned }], t, state: 'loose'|'won'|'out', penned }`; `stepHerd(herd, rick: { x, z }, dt, { push }) → Array<{ type: 'penned', id } | { type: 'won' } | { type: 'out' }>`.

- [ ] **Step 1: Failing tests** (`DT = 1/30`, `push` from `makeWalker({ radius: 40, colliders: COLLIDERS, walls: WALLS }).push`):
  - `newHerd()` has 6 Mortys, none `inPen`, each clear of colliders, all within 14 m of the pen gate, and `newHerd(1)` equals `newHerd(1)` (seeded).
  - with Rick 20 m away, no Morty moves faster than `HERD.wander`.
  - a Morty 3 m east of Rick moves east (its x grows) at about `HERD.flee` after 0.5 s.
  - **cornered:** a Morty at (38.5, 0) with Rick at (35, 0): after 3 s it has moved at least 2 m (slid along the wall), and it is never pushed outside the disc.
  - **into the pen:** a Morty at (−14, 0) with Rick following 3 m east of it (re-placed each step) is `penned` within 6 s, and a `penned` event fires once.
  - a penned Morty stays `inPen` for 20 s with Rick walking about outside.
  - all six penned → one `won` event and `state === 'won'`; the clock passing `HERD.time` with Mortys loose → one `out` event and `state === 'out'`.
- [ ] **Step 2:** Run → FAIL. Implement: loose Mortys wander (a heading that drifts) unless Rick is within `scare`, then flee away from him; when the push moves a fleeing Morty back by more than half its step, turn its heading ±90° (the side away from Rick) so it slides; within 5 m of the gate mouth, blend the heading toward the gate when it already points that way (dot > 0.3); crossing into `inPen` sets `penned`; penned Mortys wander inside, kept in by the fence walls. Run → PASS.
- [ ] **Step 3: Commit** “Citadel: the Mortys loose from day care”.

### Task 6: Simple Rick’s line (pure)

**Files:**
- Create: `src/components/rickmorty/citadel/wafers.js`
- Test: `src/components/rickmorty/citadel/wafers.test.js`

**Interfaces:**
- Produces: `LINE = { layers: 5, need: 3, wafers: 6, good: 0.7, speed: 0.55, speedUp: 0.12, travel: 0.75, miss: 0.02 }`; `newLine() → { state: 'ready'|'won'|'out', layer, below: { x, w }, x, w, phase, stack: [{ x, w }], good, made, dropped }`; `stepLine(line, dt)` (moves the dispenser: `x = sin(phase) * travel`, `phase += dt * (speed + layer * speedUp) * 2π`; clears `dropped`); `dropLayer(line) → Array<{ type: 'layer'|'cut'|'spoilt'|'wafer'|'good'|'won'|'out', … }>`.

- [ ] **Step 1: Failing tests:**
  - five drops with `x` forced to 0 make one wafer, `w` stays 1, events end with `good`; `good === 1`.
  - a drop at `x = 0.2` over a full layer cuts to `w ≈ 0.8` centred at 0.1 (event `cut`).
  - a drop at `x = 1.1` → `spoilt`, `made` +1, the next wafer starts at layer 0 with `w = 1`.
  - three good wafers → `won`; six made with two good → `out`; neither fires twice.
  - the dispenser’s speed at layer 4 is higher than at layer 0 (compare phase advance per `stepLine(line, 0.1)`).
  - **one per press:** two `dropLayer` calls without a `stepLine` between lay one layer (the second returns `[]`).
- [ ] **Step 2:** Run → FAIL. Implement (the overlap of `[x − w/2, x + w/2]` and `below`; under `miss` is spoilt; a finished wafer is `good` when its top `w ≥ LINE.good`). Run → PASS.
- [ ] **Step 3: Commit** “Citadel: Simple Rick’s line”.

### Task 7: The people

**Files:**
- Modify: `src/components/rickmorty/portal/meshyCast.js:70,48,140` (`createMeshyCast({ kinds = MESHY, rigged = RIGGED } = {})`; `make` and `loadOne` read those)
- Create: `src/components/rickmorty/citadel/people.js`

**Interfaces:**
- Consumes: `createMeshyCast` (now with options), `CAST`, `CROWD_LOOPS`, `castFor` (Task 3), `device()` tier.
- Produces: `KINDS` (kind → `{ a, h, shirts? }` in metres: `rick 1.85`, `cop 1.85`, `morty 1.5`, `daycare` = morty with shirts `[0xf3d84b, 0x7fc77a, 0xe0795a, 0xa98ad8, 0x63b5d9, 0xf0a0c0]`, `evilmorty 1.5`, `copmorty 1.5`, `meeseeks 1.95`, `cowboyrick 1.95`, `factoryrick 1.85`, `councila/b/c 1.85` on `councilrick-a/b/c`); `createPeople(scene, { tier }) → Promise<{ rick, cast: Map<id, figure>, mortys: figure[], cops: figure[], council: figure[], workers: figure[], update(state, t, camera), headOf(kind, id) → Vector3|null, dispose() }>`.

- [ ] **Step 1:** Change `createMeshyCast` to take `{ kinds, rigged }` with today’s tables as defaults; `npx vitest run src/components/rickmorty` → PASS (Portal panic unchanged).
- [ ] **Step 2:** Write `people.js`: load every asset `KINDS` names with clips `['idle','walk','run']`; make Rick, the named cast, six day-care Mortys (`daycare` kind, variants 0–5), four Cop Ricks, three Council members, three factory Ricks, and the crowd (10/6/3 by tier: Ricks and Mortys alternating, each walking its `CROWD_LOOPS` loop at 1.2–1.5 m/s from a different start). `update` places each from the render state (`rotation.y = face + π/2`), feeds `move` (speed / run speed) to `figure.update`, hides the crowd and the named cast in `red` mood, and updates mixers of figures over 30 m from the camera every third frame only. A kind whose asset failed is skipped (no figure, no throw).
- [ ] **Step 3:** `npm run lint` clean. **Commit** “Citadel: the people, from the Meshy cast”.

### Task 8: The concourse and the rooms

**Files:**
- Create: `src/components/rickmorty/citadel/concourse.js`, `src/components/rickmorty/citadel/rooms.js`

**Interfaces:**
- Consumes: Task 3’s layout values; `toon`, `toonify` from `portal/toon.js`; `createModels` from `lib/models.js` (Task 2’s props); `canvasTexture` from `lib/stage3d`.
- Produces:
  - `buildConcourse(renderer, { models, tier }) → { group, glows: Material[], setMood(mood), update(t, dt, { hangarOpen, escapeT }), lights: [{ x, y, z, color }], hide: Object3D[] }` (`hide`: what the ink pass skips: the sky, the holo-ring, glows).
  - `ROOMS = { factory: Vector3(0, -60, 0), council: Vector3(80, -60, 0) }`; `buildRooms(renderer, { models }) → { group, update(room, beat, t, dt, state) → { at: Vector3, look: Vector3 }, wafer: { setLine(line) }, lights }`.

- [ ] **Step 1: The concourse,** each part sized from `layout.js` so colliders match: deck-plate floor (the pattern `portal/paint.js` paints for its Citadel, as a canvas texture), the outer wall of shopfront bays (Simple Rick’s, the Council doors, the hangar doors, the portal terminal arch and its green swirl, generic bays with lit signs), the core column with cyan light rings and the holo-ring (a canvas texture: Simple Rick’s ad by day, Vote Morty on election day, a red alert by `red`), the Day Care pen (low fence with its gate, a slide, a ball pit), benches, planters, kiosks, the customs desk, the booth (shuttered until `election`), the dome’s ribs and glass, a star sky, the Citadel’s other spires outside, three transport tubes over the dome with pods running through them, the mezzanine ring. Static parts go through `towns/bake.js` `bake()`.
- [ ] **Step 2: The rooms:** the factory (the line: belt, dispenser, the stacked layers from `setLine`, vats, pipes and Kenney props, the “Simple Rick’s” sign) with camera beats `line` and `floor`; the Council chamber (dark half-round room, high bench with three seats and spotlights, the C-137 stand) with beats `hearing` and `dismissed`.
- [ ] **Step 3:** `npm run lint` clean. **Commit** “Citadel: the concourse and its two rooms”.

### Task 9: The scene

**Files:**
- Create: `src/components/rickmorty/citadel/scene.js`

**Interfaces:**
- Consumes: Tasks 7–8; `createStage` (`lib/stage3d.js`), `InkPass` (`portal/toon.js`), `device()`.
- Produces: `createCitadelWorld(canvas, { onLost }) → Promise<{ render(state, ms), fx(type), screenOf(kind: 'cast'|'room', id) → { x, y }|null, resize(w, h), dispose(), info(), get lost(), get suggestYaw() }>`. `state` = `{ rick, mood, mode: 'walk'|'talk'|'inside'|'escape', room, beat, stepT, mortys, line, cops, chased, talking, camYaw, camPitch, camDist, near, talk, markers, hangarOpen, escapeT, debugCam }`. `fx` types: `portal`, `penned`, `scatter`, `layer`, `cut`, `spoilt`, `good`, `contempt`, `vote`, `red`, `seen`, `caught`, `liftoff`.

- [ ] **Step 1:** Stage as Portal3D sets it up (`createStage(canvas, { soft: tier === 'low', shadows: false, fov: 50, near: 0.1, far: 500, bloom: { strength: 0.6, radius: 0.45, threshold: 0.85 }, onLost })`, the `InkPass` inserted at composer index 1 unless soft, `hide` from the concourse); hemisphere + key light + a pool of point lights lent to the concourse or the room; moods set the grade, the light strips and the key light (red: strips and holo-ring red, key light ×0.55, a slow alarm pulse).
- [ ] **Step 2:** The camera: Bree’s orbit (`camYaw`, `camPitch`, `camDist`) pulled in by a clearance test against the tall colliders, eased (8 walking, 2.5 otherwise, snapped on a mode or beat change), `suggestYaw` when boxed in; inside, the room’s beat camera; in `escape`, a fixed hangar camera following the cruiser up and out.
- [ ] **Step 3:** `await stage.precompile()` before resolving; `dispose()` disposes rooms, concourse, people, models, then the stage. **Commit** “Citadel: the scene”.

### Task 10: CitadelWorld

**Files:**
- Create: `src/components/rickmorty/citadel/CitadelWorld.jsx`, `citadel.css`, `sounds.js`

**Interfaces:**
- Consumes: everything above; `TownHud` (`QuestList`, `Bubble`, `Convo`, `Stick`), `towns/map.js` `drawMap`, `towns/keys.js`, `useFrameLoop`, `useInView`, `useMediaQuery`, `local`, `use3D`, `useAchievements`, `readPad`, `lib/clips` `playClip`.
- Produces: `export default function CitadelWorld({ onLeave })`.

- [ ] **Step 1:** Follow `towns/bree/BreeWorld.jsx` for the outer component (`done` from `tp-citadel-done` through `citadelProgress`, `complete(id)` → `unlock(SEAL[id])`), the `World` loop, keys, pad, drag, stick, toast, bubble and cards. The walker is `makeWalker({ radius: WORLD.radius, colliders: COLLIDERS, walls: WALLS, body: RICK })`, with `HANGAR_WALLS` closed until the escape.
- [ ] **Step 2: The scenes:**
  - `daycare` spot (“Morty Day Care” / “Round them up”): `newHerd()`, the gate opens, `fx('scatter')`, the HUD shows “Mortys in N of 6” and the clock; `penned` → `fx('penned')` and a line; `won` → `complete('daycare')`; `out` → “The Day Care Rick looks up. They scatter again.” and a fresh herd. Leaving the area (over 25 m from the pen) pauses nothing: the clock runs.
  - `factory` spot (“Simple Rick’s” / “Go in”): inside, `room: 'factory'`, beat `line` until done (then `floor`); Space / the button drops (`e.repeat` ignored); events → fx and lines; `won` → the jingle line, `complete('wafers')`; `out` → “The foreman Rick sends you to the back of the line.” and a fresh line; Esc / “Back to the concourse” leaves.
  - `council` spot (“The Council of Ricks” / “Go in”): inside, `room: 'council'`, the `council` convo through `Convo`; `won` → `complete('council')`, beat `dismissed` for 2.5 s, then out at `spot('council')` facing south.
  - election: approaching a voter (`CAST` with `vote`) while `mood === 'election'` shows their `vote` line and counts them; the `ballot` spot opens after three (“Candidate Morty’s booth” / “Cast your ballot”); the `ballot` convo; `won` → `complete('votemorty')`, `fx('red')`, “Candidate Morty wins in a landslide. His first order: arrest Rick C-137.”, Rick at `ESCAPE_START`, fresh watchers on `ROUNDS`.
  - escape: `stepWatchers(…, COPS, …)`; `seen` → `fx('seen')` + a line; `caught` → `fx('caught')`, “A Cop Rick grabs your collar. You slip him, back by the booth.”, Rick at `ESCAPE_START`, fresh watchers; the `hangar` spot (not while chased) → mode `escape`, `hangarOpen`, `fx('liftoff')`, `complete('citadelout')` after 4 s, back to walking.
  - `portal` spot: always (“Portal home” / “Back to C-137”) → `onLeave()`; once finished, the `hangar` spot does the same.
  - the rim: “The rest of the Citadel can wait. It has four hundred levels.” at most every 6 s.
- [ ] **Step 3:** Sounds in `sounds.js` (Web Audio, as `towns/bree/sounds.js`): `hum()` (`{ stop, level }`), `chime()`, `portal()`, `clunk()`, `cut()`, `alarm()` (`{ stop }`), `doors()`, `liftoff()`; the show’s clips where they fit (`portalGun` on arrival and leaving, `riggity` on the Council won, `imIn` on getting to the hangar).
- [ ] **Step 4:** `citadel.css` on top of `shire/shire.css`: the Citadel’s HUD palette (white panels, cyan accents, red in `data-mood="red"`), the herd counter and the line’s gauge.
- [ ] **Step 5:** `npm run lint` and `npm test` clean. **Commit** “Citadel: the world, its scenes and its HUD”.

### Task 11: The page and the ways in

**Files:**
- Create: `src/pages/Citadel.jsx`
- Modify: `src/App.jsx` (lazy route `/c-137/citadel`), `src/pages/RickMorty.jsx` (hero button), `src/components/universe/deep.js:76` (`page: '/c-137/citadel'` on the Citadel), `src/components/universe/scene.js:1609,1976` (keep `page` on the crash; `onCrash(c.world ?? c.id, c.page)`), `src/pages/Universe.jsx:103-118` (`crashInto(id, page)` navigates to `page ?? u.to`), `src/components/Achievements.jsx` (the five seals, text from the spec’s table), `src/components/CommandPalette.jsx` (“The Citadel of Ricks”, keywords `citadel council ricks simple rick wafers morty day care evil morty vote`), `src/components/worlds/worlds.js` (`'/c-137'` comment and MB measured from the Network panel), `README.md` (a line under “Where things live”).

- [ ] **Step 1:** `Citadel.jsx`: `useDocumentTitle('The Citadel of Ricks')`, the world under the nav (`onLeave={() => navigate('/c-137')}`), and below it a short credits line (`ModelCredits` if it applies, else the Meshy and Kenney credits from `public/games/credits.json`) and a “Back to Dimension C-137” link.
- [ ] **Step 2:** `npm test` (the universe tests parse `App.jsx`’s routes) and `npm run lint` clean; `npm run build` succeeds.
- [ ] **Step 3: Commit** “Citadel: its page, and the ways in (C-137, the universe map, ⌘K)”.

### Task 12: Playtest and polish in the browser

**Files:** whatever the findings touch.

- [ ] **Step 1:** `npm run dev`; a Playwright script in the scratchpad (Chromium at `/opt/pw-browsers/chromium`) opens `http://localhost:5173/#/c-137/citadel`, waits for `window.__CITADEL__`, and saves screenshots: arrival; the concourse from three angles; the herd mid-way; the line; the chamber; election day; red alert with cops; the liftoff. Read each screenshot.
- [ ] **Step 2:** Judge each against the spec’s look (silhouette, the ink line, palette, every figure grounded and facing its way, nothing floating or clipping, text fitting). Fix, re-shoot, until each reads as the show’s Citadel.
- [ ] **Step 3:** Play each scene through with `sim.speedup` off at least once; check the Review Focus list (reload mid-scene, spam Space, a GLB renamed away, hide the tab, `?quality=low`); `info()` frame time and draw calls on `?quality=high` and `?quality=low`; zero console errors.
- [ ] **Step 4: Commit** each fix with what it fixes.

### Task 13: Review and ship

- [ ] **Step 1:** `npm test`, `npm run lint`, `npm run build` clean.
- [ ] **Step 2:** Whole-branch review (superpowers:requesting-code-review); fix what it finds.
- [ ] **Step 3:** `git push -u origin claude/zen-clarke-oz2htg`.
