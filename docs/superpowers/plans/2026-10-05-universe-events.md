# Universe events implementation plan (PR 1 and PR 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five new director events on the universe map: a solar flare, a rift that jumps you somewhere, leviathans (purrgil or a Cromulon), a meteor stream you can shoot, and a bounty hunter.

**Architecture:** The director (`director.js`, pure) picks events; the scene's `happen()` plays each out through a set piece (`setpieces.js`, `leviathans.js`, `meteors.js`), the hunters (`hunterRules.js` for the bounty) and the crews' lines (`crews.js`). Pure choices (the rift's exit, the nearest star) live in `nav.js` and `deep.js` and are tested in Node.

**Tech Stack:** React 19, three 0.186, Vitest 5. Lint with `npx eslint .`, test with `npx vitest run src/components/universe`, build with `npx vite build`.

**Spec:** `docs/superpowers/specs/2026-10-05-universe-expansion-design.md`, sub-project 1.

## Global Constraints

- Pure rules stay out of three.js; drawing stays out of the tests.
- No new downloads: everything new is built in code or reuses `public/models/universe/slave1.glb` and the built `birdperson`.
- Copy in the site's voice: plain sentences, no em-dash stacks. Crew lines are `[speaker, text]` and the speaker must be one of the crew's `speakers` or `'comms'`.
- Commits end with the session's `Co-Authored-By` and `Claude-Session` lines. No model names in code or commits.
- Every PR: `npx eslint .`, `npx vitest run`, `npx vite build` clean before pushing.

## Review Focus

1. A rift that opens while the ship is parked at a planet: the exit must never be the place you're at (`riftExit` excludes `fromId`); test in `nav.test.js`.
2. A flare set off with the ship inside a star's reach (just parked by Ember): the shell must still arrive after the glow, never at a negative delay; `flare()` clamps `arrives` to at least 3 s; test in Task 2's browser check.
3. A leviathan pass asked for while one is already passing: `pass()` returns null and the director moves on; unit-checked by calling twice in `leviathans.test.js`-free browser check (no three.js in tests), so guard it in code and note it in the handoff.
4. A meteor stream whose lane would run through a planet: `meteorLane` returns null and nothing spawns; test in `meteors.test.js`.
5. A bounty hunter while the pilot's shields are under half: the director's `calm` must block it (`bounty.heat > 0`); test in `director.test.js`.

---

## PR 1: flare, rift, leviathan

### Task 1: The director knows the new events; the rift knows where it goes; the flare knows its star

**Files:**
- Modify: `src/components/universe/director.js` (EVENTS)
- Modify: `src/components/universe/director.test.js`
- Modify: `src/components/universe/nav.js` (export `riftExit`)
- Modify: `src/components/universe/nav.test.js`
- Modify: `src/components/universe/deep.js` (export `STARS`, `nearestStar`)
- Modify: `src/components/universe/deep.test.js`

**Interfaces:**
- Produces: `EVENTS.flare`, `EVENTS.rift`, `EVENTS.leviathan` (families `['starwars', 'rickmorty', 'both']`, weights 0.9 / 1.1 / 1.0, heat 0).
- Produces: `riftExit(fromId: string | null, rand = Math.random) → string` in `nav.js`: a goal id from `GOALS` that is a place (`isPlace`) or a wonder, never `fromId`, never `MAW.id`, never a Citadel part.
- Produces: `STARS: Array<{ id, at, r, color }>` (the home sun as `{ id: 'sun', at: SUN.at, r: SUN.r, color: '#ffcf6a' }` plus every `WONDERS` entry of kind `star`) and `nearestStar(x, y, z) → { star, dist }` in `deep.js`.

- [ ] **Step 1: Write the failing tests**

`director.test.js`, in `describe('the director')`:
```js
it('knows the flare, the rift and the leviathans, for every crew, and none of them is trouble', () => {
  for (const id of ['flare', 'rift', 'leviathan']) {
    expect(EVENTS[id].families).toEqual(['starwars', 'rickmorty', 'both']);
    expect(EVENTS[id].heat).toBe(0);
  }
  const d = createDirector({ rand: seeded() });
  d.soon('rift');
  expect(d.update(0.1, { family: 'rickmorty', calm: true })).toBe('rift');
});
```
`nav.test.js`, new `describe('a rift')`:
```js
it('comes out at a place or a wonder, never where you are and never the Maw', () => {
  const seen = new Set();
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const from = i % 2 ? 'marvel' : null;
    const id = riftExit(from, rand);
    expect(GOALS[id], id).toBeTruthy();
    expect(id).not.toBe(from);
    expect(id).not.toBe(MAW.id);
    expect(id.includes('-')).toBe(false);
    seen.add(id);
  }
  expect(seen.has('aurelia')).toBe(true);
  expect(seen.has('home')).toBe(true);
});
```
`deep.test.js`, in `describe('deep space')`:
```js
it('knows its stars, and which is nearest', () => {
  expect(STARS.map((s) => s.id)).toEqual(['sun', 'ember', 'halcyon']);
  expect(nearestStar(10, 0, 0).star.id).toBe('sun');
  const ember = WONDERS.find((w) => w.id === 'ember');
  expect(nearestStar(ember.at[0] + 200, ember.at[1], ember.at[2]).star.id).toBe('ember');
  expect(nearestStar(ember.at[0] + 200, ember.at[1], ember.at[2]).dist).toBeCloseTo(200, 3);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/universe/director.test.js src/components/universe/nav.test.js src/components/universe/deep.test.js`
Expected: FAIL (`riftExit`, `STARS`, `nearestStar` not exported; `EVENTS.flare` undefined).

- [ ] **Step 3: Implement**

`director.js`: three entries after `supernova`, with the header comment extended (one line each: what the flare, the rift and the leviathans are).
`deep.js`: `STARS` and `nearestStar` after `PLACES`; `nearestStar` returns `{ star, dist }` with `dist` from the point to the star's middle.
`nav.js`: `riftExit` picks uniformly among `Object.keys(GOALS).filter((id) => id !== fromId && id !== MAW.id && !id.includes('-'))`.

- [ ] **Step 4: Run the three files again**

Expected: PASS. Also `npx vitest run src/components/universe/crews.test.js` now FAILS on `event flare` (the crews have no lines yet): that is Task 3.

- [ ] **Step 5: Commit** `Director: the flare, the rift and the leviathans, as rules`

### Task 2: The set pieces: the flare and the rift

**Files:**
- Modify: `src/components/universe/setpieces.js`
- Modify: `src/components/universe/sounds.js` (export `flareSound()`, `riftSound()`)

**Interfaces:**
- Produces in `createSetPieces(...)`'s return: `flare(star, ship) → { arrives: number } | null` (null while one is going); `rift(ship) → boolean`; getter `riftAt → THREE.Vector3 | null`; `riftInside(ship) → boolean`; `closeRift()`; `update` keeps returning `busy`.
- Produces: `flareSound()` (a low rumble: `whoosh(2.4, 60, 220, 0.2)` plus a sine at 48 Hz for 1.6 s) and `riftSound()` (a hum: `tones([[110, 0, 2.5], [165, 0, 2.5]], { type: 'sine', gain: 0.05 })` plus `whoosh(1.2, 400, 1600, 0.08)`).

- [ ] **Step 1: The flare in `setpieces.js`**

State `fl = { age: -1, star: null, arrives: 0, reach: 0 }`. A sprite (the glow texture, the star's colour × 2.5, additive) at the star, and a shell: `new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))`, hidden until used.
`flare(star, ship)`: if `fl.age >= 0` return null. `dist = hypot(ship − star.at)`; `fl.arrives = max(3, 3 + (dist − star.r) / 150)`; `fl.reach = dist * 1.3`; set positions; `fl.age = 0`; return `{ arrives }`.
In `update`: `age < 3`: sprite scale `star.r * (1.2 + 2.3 * (age / 3) ** 2)`, opacity `min(1, age / 0.6)`; `age ≥ 3`: sprite fades `exp(−(age − 3) * 0.8)`; the shell radius `star.r + (age − 3) * 150`, opacity `0.22 * (1 − radius / fl.reach)`; done when radius > reach. `busy` while going.

- [ ] **Step 2: The rift in `setpieces.js`**

A `RIFT_FRAG` from `PORTAL_FRAG` with the colour remapped before output: `vec3 col = vec3(c.g * 0.55 + c.r * 0.3, c.g * 0.8, c.g * 1.25 + c.b * 0.4) * 1.5;`. One mesh on `portalGeo`, `userData.age = -1`, radius 4 (`scale.setScalar(8 * open)`), facing the camera each frame, opening over 0.6 s, open for `RIFT_LIFE = 20` s, closing over 0.6 s.
`rift(ship)`: placed `ship + forward * 35 + right * (side * 12)` at `ship.y`, where `right = [−fz, 0, fx]`; refuse (return false) if `userData.age >= 0`, or if any `SOLIDS` entry is within `o.r + 6` of the spot (import `SOLIDS` from `./ship`).
`riftAt`, `riftInside(ship)` (distance < 3.2 while open ≥ 0.9), `closeRift()` (age jumps to `RIFT_LIFE` so it closes now).

- [ ] **Step 3: The sounds in `sounds.js`**

As the Interfaces block says, beside `jumpSound`.

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/universe/setpieces.js src/components/universe/sounds.js`
Expected: clean.

- [ ] **Step 5: Commit** `Set pieces: a solar flare, and a rift in space`

### Task 3: The leviathans

**Files:**
- Create: `src/components/universe/leviathans.js`

**Interfaces:**
- Produces: `createLeviathans(parent, { small }) → { pass(ship, family, rand = Math.random) → 'purrgil' | 'cromulon' | null, update(dt, t, camera) → busy, hit(from, to) → boolean, busy (getter), dispose() }`. Points in `parent`'s space.
- Consumes: `convoyLane(ship, rand)` from `lanes.js`, `bezier`/`tangent`, `forward` from `ship.js`.

- [ ] **Step 1: Build the purrgil**

One pod group of up to five purrgil, each a group: body `CapsuleGeometry(0.9, 3.6, 6, 14)` rotated to lie along −z, a head bulge sphere at the front, a tail cone, four tentacles (`CylinderGeometry(0.06, 0.22, 3.2, 6)`) hinged at the rear and swaying (`rotation.x = 0.25 * sin(t * 1.3 + i)`), two flukes (flat boxes). Materials: `MeshStandardMaterial({ color: '#4a3f8a', roughness: 0.85 })` for the back, `'#b9b4d8'` for the belly stripe (a thinner capsule offset down), eyes as small emissive spheres `'#7fd8ff'`. Scale: 6 units long for the lead, 4.5 to 6 for the rest. The pod flies the convoy lane (`convoyLane(ship, rand)`, else null) at 2.2 units a second, each member offset behind and beside the lead; the whole pod rolls gently (`rotation.z = 0.08 * sin(t * 0.7)`) and each body pitches with a slow wave.

- [ ] **Step 2: Build the Cromulon**

A head group: `BoxGeometry(6, 7.5, 5)` in `'#8a8277'` with a slightly smaller darker box inside as the face plate, two eye sockets (dark boxes) with pale spheres, a brow ridge, and a jaw `BoxGeometry(5.2, 2, 4)` hinged at its back edge that opens to 0.45 rad over 0.4 s and shuts over 0.5 s, four times, from `age` 2.5 to 7 (the talking). Path: in from 40 units off to one side ahead, stops 24 units off facing the ship for the talking, then drifts away over 15 s.

- [ ] **Step 3: `pass`, `update`, `hit`**

`pass(ship, family, rand)`: null while `busy`; `family === 'starwars'` → purrgil, `'rickmorty'` → cromulon, `'both'` → either by `rand()`. Returns the kind.
`update` moves whichever is live; `busy` while either is live; a pass ends when the lane ends or the head has drifted 90 units off.
`hit(from, to)`: a segment test against each live body's bounding sphere (centre and radius kept per member); true on a hit (nothing happens to the leviathan).

- [ ] **Step 4: Lint** and commit `Leviathans: purrgil and a Cromulon`

### Task 4: The scene plays them out; the crews have their say; the page unlocks the rift

**Files:**
- Modify: `src/components/universe/scene.js` (`happen`, `fly`, the fire path, `adventure`'s `busy`, the debug object, dispose)
- Modify: `src/components/universe/crews.js` (lines; `linesFor` takes a `sub` for events)
- Modify: `src/components/universe/crews.test.js`
- Modify: `src/components/universe/Comms.jsx` (passes `e.sub`; plays `flareSound`/`riftSound`)
- Modify: `src/pages/Universe.jsx` (unlock `rifted`)
- Modify: `src/components/Achievements.jsx` (`rifted`)
- Modify: `src/components/Guide.jsx` (the Happenings tip)

**Interfaces:**
- Scene events: `{ type: 'event', id: 'flare' }`, `{ type: 'event', id: 'rift' }`, `{ type: 'event', id: 'rifted' }`, `{ type: 'event', id: 'leviathan', sub: 'purrgil' | 'cromulon' }`, `{ type: 'event', id: 'leviathanHit' }`, and `{ type: 'rifted', id: exitId }` for the page.
- `linesFor(crew, 'event', id, sub)`: `crew.events[id]` is an exchange, or an object keyed by `sub` with `any`.
- `state.static: number` seconds of HUD scramble left; the HUD element gets `data-static` while it's on (`universe.css`: a 90 ms jitter keyframe on `.universe-hud[data-static]`).

- [ ] **Step 1: Write the failing crews test**

In the 'have a word for being hunted…' test, after the EVENTS loop:
```js
said(linesFor(crew, 'event', 'rifted'), crew, 'rifted');
said(linesFor(crew, 'event', 'leviathanHit'), crew, 'leviathanHit');
if (family === 'both') for (const sub of ['purrgil', 'cromulon']) said(linesFor(crew, 'event', 'leviathan', sub), crew, `leviathan ${sub}`);
```
Run: `npx vitest run src/components/universe/crews.test.js` → FAIL.

- [ ] **Step 2: The lines**

For each crew, `events.flare`, `events.rift`, `events.rifted`, `events.leviathan` (cruiser: the Cromulon, with `['comms', 'SHOW ME WHAT YOU GOT!']` first; xwing and falcon: purrgil; rv: `{ purrgil: [...], cromulon: [...] }`), `events.leviathanHit`. Two to three lines each, in each crew's voice. `linesFor` as the Interfaces block says.
Run the crews test → PASS.

- [ ] **Step 3: The scene**

`happen()`:
- `flare`: `const { star } = nearestStar(ship.x, ship.y, ship.z); const f = pieces.flare(star, ship); if (!f) return; emit flare; later.push({ at: state.clock + f.arrives, run: () => { if (!state.ship || state.crash) return; hurt(15); state.static = 4; state.flare = Math.max(state.flare, 2.2); if (!reduced) state.shake = Math.max(state.shake, 0.8); } })`.
- `rift`: `if (!pieces.rift(ship)) return; emit rift; state.note = { text: 'A rift has opened ahead: fly into it', until: wall() + 5 }`.
- `leviathan`: `const sub = leviathans.pass(ship, family); if (!sub) return; later.push({ at: state.clock + 3, run: () => emit({ type: 'event', id: 'leviathan', sub }) })`.
`fly()`: after the jump block, `if (pieces.riftAt && pieces.riftInside(state.ship)) riftThrough()`, where `riftThrough` picks `riftExit(state.at, Math.random)`, `park = parkFor(exit, [s.x, s.z])`, then does what the jump's arrival does (`arriveAt`, `hunters?.clear()`, `state.interdicted = false`, `state.safeUntil`, `crashFx.arrive(...)`), `pieces.closeRift()`, `state.flare = max(state.flare, 2.4)`, `emit({ type: 'event', id: 'rifted' })`, `emit({ type: 'rifted', id: exit })`.
The fire path: after `traffic?.hit`, `if (leviathans.hit(shotFrom, b.position)) { b.visible = false; if (state.clock - leviathanSaidAt > 20) { leviathanSaidAt = state.clock; emit({ type: 'event', id: 'leviathanHit' }); } }` (both the bolt and the missile paths).
`adventure`: `busy: ... || leviathans.busy`; `state.static = max(0, state.static − dt)`; `placeHud` toggles `data-static`.
`const leviathans = createLeviathans(map, { small })` beside `pieces`; `leviathans.update(dt, t, camera)` beside `pieces.update`; in the debug object and in `dispose`.

- [ ] **Step 4: Comms, the page, achievements, the guide**

`Comms.jsx`: `say(linesFor(crew, 'event', e.id, e.sub), …)`; `if (e.id === 'flare') flareSound(); if (e.id === 'rift') riftSound();`.
`Universe.jsx` `onEvent`: `else if (e.type === 'rifted') { unlock('rifted'); comms.current?.handle(e); }` (and Comms ignores an unknown type as it does now).
`Achievements.jsx`: `rifted: { name: 'Through the rift', desc: 'Flew into a rift on the universe map and came out somewhere else' }` beside `citadelfall`.
`Guide.jsx` `/universe` Happenings: add "a star flares and its shockwave rattles the ship, a rift tears open ahead of you (fly into it and it takes you somewhere else), and something enormous swims past: purrgil, or a Cromulon with something to say."

- [ ] **Step 5: Verify**

Run: `npx eslint . && npx vitest run && npx vite build`
Expected: all clean. Then a headless pass (`scripts/navmap-check.mjs` shows the pattern): open `/#/universe`, pick a ship, `window.__universeDebug.director.soon('rift')` and check `pieces.riftAt` is set within 2 s; `soon('flare')` and check `pieces.update` reports busy; `soon('leviathan')` and check `leviathans.busy`.

- [ ] **Step 6: Commit** `The universe: a flare, a rift and the leviathans happen`, push, open PR 1, merge after CI is green.

---

## PR 2: meteors and the bounty hunter

### Task 5: The meteor stream, as rules and as rocks

**Files:**
- Create: `src/components/universe/meteors.js`, `src/components/universe/meteors.test.js`
- Modify: `src/components/universe/lanes.js` (export `meteorLane`)
- Modify: `src/components/universe/lanes.test.js`

**Interfaces:**
- Produces: `meteorLane(ship, rand) → [from, to] | null` in `lanes.js`: a straight run across the ship's path, 60 units ahead, from 70 units to one side to 70 units to the other, at the ship's height ± 2, null when `clearance([from, mid, to]) < 3`.
- Produces: `createMeteors(parent, { small }) → { storm(ship, rand) → boolean, update(dt, ship) → events, hit(from, to) → { at, size } | null, targets, count, clear(), dispose() }`. Events: `{ type: 'meteor', damage: 8 }` when a rock strikes the ship (then the rock pops).
- Pure, exported for the test: `stormPlan(lane, rand, n) → Array<{ at, vel, size }>`: `n` rocks spread along the lane's first 40 units, scattered ± 4 across and ± 3 up, all moving along the lane at 12 to 16 units a second, sizes 0.25 to 0.7.

- [ ] **Step 1: Tests** (`lanes.test.js`: a meteor lane never meets a planet and crosses ahead; `meteors.test.js`: `stormPlan` gives `n` rocks, all moving the lane's way, none on top of another, sizes in range).
- [ ] **Step 2: Implement** `meteorLane`, `stormPlan`, and `createMeteors` (one `InstancedMesh` of the belt's lumpy rock geometry, `MeshStandardMaterial` grey-brown, 32 instances; rocks tumble; a rock within `0.3 + size` of the ship hits it and is spent; a bolt within `size` of a rock pops it: `hit` returns `{ at, size }`; `targets` is the live rocks as `[{ id, at, vel, size, kind: 'meteor', hp: 1, hpMax: 1 }]` for the guns).
- [ ] **Step 3: Lint, test, commit** `Meteors: a stream of rocks across your path`

### Task 6: The bounty hunters

**Files:**
- Modify: `src/components/universe/hunterRules.js` (FACTIONS `fett`, `phoenix`; HUNTER_KINDS `slave1`, `phoenixperson`; NAMES)
- Modify: `src/components/universe/hunterRules.test.js`
- Modify: `src/components/universe/hunters.js` (`phoenixperson` is `birdperson` tinted `'#c23a2a'` on its body and `'#d9d9e0'` on its wings)
- Modify: `src/components/universe/trafficModels.js` only if `birdperson`'s builder needs a `tint` option

**Interfaces:**
- `FACTIONS.fett = { family: 'starwars', kinds: [['slave1', 1]], laser: [0.9, 0.3, 0.3], size: [1, 1] }`, `FACTIONS.phoenix = { family: 'rickmorty', kinds: [['phoenixperson', 1]], laser: [1.0, 0.45, 0.2], size: [1, 1] }`.
- `HUNTER_KINDS.slave1 = { size: 0.55, speed: 24, accel: 20, hp: 6, fire: [0.5, 0.9], tail: 0.45, lead: 0.9, spread: 0.85 }`, `HUNTER_KINDS.phoenixperson = { size: 0.42, speed: 25, accel: 21, hp: 5, fire: [0.55, 1.0], tail: 0.4, lead: 0.9 }`.
- `NAMES.slave1 = 'Slave I'`, `NAMES.phoenixperson = 'Phoenixperson'`.

- [ ] **Step 1: Test** in `hunterRules.test.js`: `packPlan(FACTIONS.fett, { size: 1 })` is `['slave1']`; a fight with `faction: 'fett'` lands shots within 60 s and the hunter takes six hits.
- [ ] **Step 2: Implement**; `crews.js` gets `hunted.fett`, `hunted.phoenix`, `kill.slave1`, `kill.phoenixperson` for the crews whose family they are (the RV both); `crews.test.js`'s FACTIONS loop covers `hunted` (exclude `fett`/`phoenix` from the `family === 'both'` rule the same way `council` is: they come by family).
- [ ] **Step 3: Lint, test, commit** `Bounty hunters: Boba Fett and Phoenixperson`

### Task 7: The director sends them; the scene plays them; the page unlocks Wanted

**Files:**
- Modify: `director.js` (`meteors` 1.2/0, `bounty` 1.0/0.8), `director.test.js` (calm blocks `bounty`)
- Modify: `scene.js` (`happen`: `meteors` → `meteors.storm(ship, Math.random)` and emit; `bounty` → `hunters.pack(family === 'starwars' ? 'fett' : 'phoenix', ship, { size: 1, ace: false, interdict: travelling })` and emit `{ type: 'event', id: 'bounty' }`; the fire path pops meteors; `meteors.update` events → `hurt(8)`; `meteors.targets` joined to the guns' candidates; `meteors.clear()` on a crash)
- Modify: `crews.js` (`events.meteors`, `events.bounty`), `Achievements.jsx` (`wanted: { name: 'Wanted', desc: 'Shot down a bounty hunter on the universe map' }`), `Universe.jsx` (`kill` of `slave1` or `phoenixperson` → `unlock('wanted')`), `Guide.jsx`.

- [ ] **Step 1: Test** `director.test.js`: with `calm: true` over 6000 s, no `bounty`; `EVENTS.meteors.heat === 0`.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify** `npx eslint . && npx vitest run && npx vite build`; headless `soon('meteors')` shows `meteors.count > 0`; `soon('bounty')` shows a hunter of kind `slave1` in `hunters.targets`.
- [ ] **Step 4: Commit** `The universe: meteors and bounty hunters happen`, push, PR 2, merge.
