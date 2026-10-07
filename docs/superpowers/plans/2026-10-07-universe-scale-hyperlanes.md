# From a galaxy to a universe: the plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task, one lane per session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The universe map’s places four times further apart, the far ones drawn as light, a web of hyperlanes in three tiers carrying traffic you can ride at hyperspeed and leave anywhere, and the director’s fights, the fronts and the other pilots spread along that web; and the galaxy’s jumps along its own routes.

**Architecture:** Four lanes on disjoint files. Lane A is the foundation (scale, impostors, regions, the lane graph, riding, the drive) and merges first; Lanes B (traffic and the look) and C (the director, fights, pilots) start from `origin/main` once A is in, and never touch each other’s files; Lane D (the galaxy) is independent and starts now. Every rule is a pure module with a test beside it; the drawing files read the rules. `scene.js` (5,400 lines, over the health cap) gains only hook lines.

**Tech Stack:** three r186 (WebGL 2), vitest, eslint, headless Chromium through `scripts/universe-check.mjs`, `scripts/navmap-check.mjs`, `scripts/galaxy-check.mjs`, Nostr for the one online bit.

**Spec:** `docs/superpowers/specs/2026-10-07-universe-scale-hyperlanes-design.md`

## Global Constraints

- Branch from `origin/main` (Lane A from `origin/claude/universe-scale-hyperlanes`, which carries the spec and this plan, merged with `origin/main` first). Merge `origin/main` again right before merging the PR. Merge only after `npx eslint .`, `npx vitest run` and `npx vite build` are green locally. `npm run build` rewrites `public/github.json`: never `git add -A` after it. Merge commits, never a rebase or a force-push.
- Commit messages and PR bodies in plain prose (what changed and why, the measured numbers), British spelling, curly quotes, ending with the harness’s attribution lines; no model names in a commit or a PR.
- Rules in `*.js` with `*.test.js` beside them (`docs/health/RULES.md`); no file over 800 lines new; no runtime calls to any service; nothing new on `low` but what the spec names (the spread, the impostors, the ribbons).
- Every picture change is looked at in a browser (`npx vite --port 5188 --strictPort --host 127.0.0.1`, or the check scripts) before it’s called done, and a screenshot goes in the PR. Budgets (spec §11): on `high` at `overview`, at most +60 draw calls and +0.3 M triangles over `lab/universe/baseline/high`; at the `lane-ride` pose, frame time within 1.5 ms of `deep` today.
- Something regenerates `src/data/health/latest.json` during runs. Don’t commit it.
- Speeds, distances and names below are the spec’s; where the spec gives a number, use that number.

## Review Focus

1. A ship riding a lane when the browser tab was hidden for a minute (`dt` capped at `MAX_DT`): the ride must not overshoot the node and end inside a planet. Lane A Task 5’s “long dt” test.
2. A region whose hub lands inside a nebula or a star’s reach (the Veil is 700 across): the hub must move out, and a lane to it must still clear. Lane A Task 3’s “hub clear” test and Task 4’s “connected” test.
3. A pilot whose pose arrives with the `lane` bit set but a position off every lane (an old client, or a liar): drawn as a blip, never as a streak. Lane C Task 4’s “lane bit without a lane” test.
4. The autopilot on `lanes` when free flight is faster (a hop between two home stations): `routeTo` returns null and the autopilot of today flies it; `tripTime` says the same number as before. Lane A Task 4’s “null route” test and Task 6’s `tripTime` test.
5. A flow ship shot the frame before it wraps to `s = 0`: it must stay dead until its next wrap, not reappear at once. Lane B Task 1’s “killed until wrap” test.

---

## Lane A: the foundation

Branch `claude/universe-scale-hyperlanes` (this one). One PR for Tasks 1 to 3, a second for Tasks 4 to 7, or one if they go quickly; Task 8 is the evidence.

### Task 1: the spread (`SPREAD`)

**Files:**
- Modify: `src/components/universe/scale.js`, `scale.test.js`; `layout.js` (`FIRST`, `STEP`, `HEIGHT`, `SECTORS`, `RIM`), `layout.test.js`; `deep.js` (`WONDERS`’ `at`), `deep.test.js`; `universes.js` (writes `SPREAD` out as a number, as `HOME_SCALE`); `sector.test.js`, `nav.test.js`, `ship.test.js`, `lanes.test.js` (the numbers they pin).

**Interfaces:**
- Produces: `SPREAD = 4` in `scale.js`. `layout.js`: `FIRST = 2000 * SPREAD`, `STEP = 330 * SPREAD`, `HEIGHT = 560 * SPREAD / 2`, `SECTORS.main.edge = 9000 * SPREAD`, `SECTORS.rickmorty.origin = [0, 0, -48000]`, `RIM = { inner: 8000 * SPREAD, outer: 8600 * SPREAD, height: 60 }`. `deep.js`: every main-sector wonder’s `at` is its old `at` × `SPREAD` (write the products out, or map them: either way the test below holds).

- [x] **Step 1: Write the failing tests.** `scale.test.js`: `SPREAD` is 4 and `universes.js`’s copy equals it. `layout.test.js`: the nearest fandom is 8,000 ± 1 from the origin; every fandom is at least 2,600 from every other place (planets and wonders); the main edge is 36,000; `sectorOf(0, 0, -48000)` is `'rickmorty'` and `sectorOf(0, 0, -36000)` is `'main'`. `deep.test.js`: every main-sector wonder is between 8,000 and 30,000 out and none within 1.5 of its reach of another place.
- [x] **Step 2: Run** `npx vitest run src/components/universe/scale.test.js src/components/universe/layout.test.js src/components/universe/deep.test.js` **and see them fail.**
- [x] **Step 3: Implement** the constants above. Fix what else breaks: `npx vitest run src/components/universe` lists it (trip times in `nav.test.js`, hops in `ship.test.js`, `sector.test.js`’s split; update their pinned numbers to what the code now says, after checking each by hand that it’s the spread and not a bug).
- [x] **Step 4: Run** the universe suite green. **Commit.**

### Task 2: far places as light (`farPlaces.js`)

**Files:**
- Create: `src/components/universe/farPlaces.js`, `farPlaces.test.js`
- Modify: `scene.js` (one `createFarPlaces` and one `farPlaces.update(camera, dt)` a frame; the planets’ and wonders’ groups get `visible` from it), `planets.js` and `deepspace.js` only if a place’s group isn’t reachable by id (expose `groupOf(id)` then).

**Interfaces:**
- Produces: pure `FAR_REAL = 24000`, `blend(dist, { far = FAR_REAL, fade = 2000 }) -> 0…1` (0 at and inside `far − fade`, 1 at `far` and beyond, smoothstep between), `spriteSize(r, dist, skyFar) -> px-free size` (the size at `skyFar` that keeps the angular size of radius `r` at `dist`), `pointsFor(places, cam) -> [{ id, dir: [x,y,z], size, color, k }]`. `createFarPlaces(scene, { places: [{ id, at, r, color, group }], skyFar }) -> { update(camera, dt, destinationId), dispose() }`: one `THREE.Points` with per-point size and colour, `depthTest: false`, drawn before the stars; a place’s `group.visible = blend < 1`, and the sprite’s alpha is `blend`.
- Consumes: `layout.js`’s `POSITIONS`, `REACH`; `deep.js`’s `WONDERS`, `STARS`; `deepspace.js`’s `SKY_FAR`.

- [ ] **Step 1: Write the failing tests:** `blend(21999)` is 0, `blend(24000)` is 1, `blend(23000)` is between 0.4 and 0.6; `spriteSize(100, 30000, 24000)` equals `spriteSize(80, 24000, 24000)` (same angle, same size); `pointsFor` gives one point per place with unit `dir`.
- [ ] **Step 2: Run and see them fail.** **Step 3: Implement.** **Step 4: Run green; in the browser, from `overview` the far fandoms are specks with halos and the near ones are planets; fly toward one and watch the fade.** **Commit.**

### Task 3: regions (`regions.js`)

**Files:**
- Create: `src/components/universe/regions.js`, `regions.test.js`

**Interfaces:**
- Produces: `LINK = 2600`, `HUB_LIFT = 90`, `REGIONS: [{ id, name, members: id[], hub: [x, y, z] }]` (`home` first, then by angle of the hub round the origin; `id` is the biggest member’s id, `name` “Near <Name>” or “The home system”), `regionAt(x, y, z) -> region | null`, `regionById(id)`.
- Consumes: `layout.js`’s `POSITIONS`, `REACH`, `ORDER`, `HOME_RADIUS`; `deep.js`’s `PLACES`.

- [x] **Step 1: Write the failing tests:** between 6 and 10 regions; every planet and wonder of the main sector in exactly one; no hub within 1.5 × reach of any member or any solid (the “hub clear” test, Review Focus 2); `regionAt` of a member’s position is its region; `regionAt(0, 0, 20000)` is null if that point is more than `LINK` from everything (pick the test point from the data).
- [x] **Step 2: Run and fail.** **Step 3: Implement** single-linkage clustering (union-find over pairs within `LINK`), the reach-weighted centroid, the lift alternating up and down by index, and a push straight away from any solid the hub is inside until clear. **Step 4: Run green. Commit.**

### Task 4: the lane graph (`hyperlanes.js`)

**Files:**
- Create: `src/components/universe/hyperlanes.js`, `hyperlanes.test.js`
- Modify: `lanes.js` (export `bezier`, `tangent`, `laneLength`, `clearance` if any isn’t already)

**Interfaces:**
- Produces: `TIERS = { local: { speed: 600, density: 400 }, trunk: { speed: 1500, density: 900 }, express: { speed: 4000, density: 2500 } }`, `RAMP_OUT = 1.6`, `LIFT = [60, 110]`, `GAP = 24`, `R = 6`, `RING = 12`, `RAMP_S = 3`. `NODES: [{ id, kind: 'ramp' | 'beacon', at, place?: id, region: id }]`, `LANES: [{ id, tier, from: nodeId, to: nodeId, pts: [a, b, c], length, name }]` (name: “<From> – <To> local”, “<Region> trunk”, “The <Gate> express”). `carriageway(lane, way: 'out' | 'in') -> [a, b, c]` (offset `GAP / 2` to the right of travel, reversed for `in`). `laneAt(x, y, z, lanes = LANES) -> { lane, way, s, off } | null` (inside `R × 1.3`). `routeTo(ship: { x, y, z, speed }, toId, { pulse = SHIP.pulse } = {}) -> { legs: [{ kind: 'fly' | 'ride', from, to, lane?, way? }], time } | null`. `rampOf(placeId) -> node`.
- Consumes: Task 3’s `REGIONS`; `layout.js`; `deep.js`’s `PLACES`, `DEEP_SOLIDS`; `ship.js`’s `SOLIDS`, `SHIP`.

- [x] **Step 1: Write the failing tests:** every lane clears `SOLIDS` by more than 2.0 (`clearance`); the graph is connected (every node reaches `home`’s beacon); every region has a local lane from each member and a trunk to home; three express lanes, to the Star Wars gate, the portal and the Maw; `laneAt` of a point on a carriageway at `s = 0.5` gives that lane, way and `s` within 0.01, and of a point `R × 2` off gives null; `routeTo` from home’s edge to the furthest fandom is a `fly`, rides and a `fly`, with `time` under 40 s; `routeTo` between two home stations is null (Review Focus 4); `routeTo`’s `time` for a ride equals the lanes’ lengths over their speeds plus `RAMP_S` a node plus the free legs at `pulse`.
- [x] **Step 2: Run and fail.** **Step 3: Implement.** The lift alternates by index; a lane that fails clearance tries `LIFT[1] × 1.5` and `× 2` before being dropped. Dijkstra over nodes; the start is the ship (a `fly` to each ramp within 6,000, cost at `pulse`), the end the place’s ramp then a `fly` to the place. **Step 4: Run green. Commit.**

### Task 5: riding (`ride.js`)

**Files:**
- Create: `src/components/universe/ride.js`, `ride.test.js`
- Modify: `ship.js` (`startAt`: the `STARTS` list gains every region’s hub, `d` 60 off it; nothing else), `ship.test.js`

**Interfaces:**
- Produces: `SPOOL = 2.5`, `DRIFT = 4`, `enter(ship, { lanes = LANES, nodes = NODES }) -> ride | null` (a ride is `{ lane, way, s, off: [u, v] (across the tube, right and up), speed, age }`; through a ramp ring: within `RING` of a node and heading within 40° of a lane’s way out of it; merging: `laneAt` inside `R`, heading within 25° of the tangent, `speed >= SHIP.boost`), `step(ride, ship, input, dt) -> { ride, ship, out: null | 'end' | 'dropped' }` (speed smoothsteps from the entry speed to the tier’s over `SPOOL`; `input.turn` and `input.climb` move `off` at `DRIFT` a second, clamped to `R`; `input.throttle < -0.5` held `0.5` s, or `|off| > R × 1.3`, drops; at `s >= 1`, `'end'` with the ship at the node’s off-ramp at `SHIP.boost` facing along the lane, or straight onto the next lane when `input.throttle > 0.5` and a lane of the same or higher tier leaves the node within 30°), `poseOf(ride) -> { x, y, z, heading, pitch, bank, speed, vy }`.
- Consumes: Task 4; `ship.js`’s `SHIP`, `headingTo`, `forward`.

- [x] **Step 1: Write the failing tests:** `enter` through a ring succeeds and from 50° off fails; merging at cruise fails and at boost succeeds; after `SPOOL` s the speed is the tier’s within 1%; a ride on a 15,000-unit trunk ends after `15000 / 1500 + ~SPOOL/2` s within 0.5 s; `step` with `dt = 5` (the “long dt” test, Review Focus 1) ends at the node, `s` exactly 1, never past; the throttle back for 0.6 s drops, for 0.3 s doesn’t; `startAt` with a stub `rand` lands on a region hub and `clearToStart` holds.
- [x] **Step 2: Run and fail.** **Step 3: Implement.** **Step 4: Run green. Commit.**

### Task 6: the drive and the scene

**Files:**
- Modify: `nav.js` (`DRIVES` + `lanes`, `parseDrive` default, `HYPER.recharge = 30`, `tripTime` on `'lanes'`), `nav.test.js`; `NavMap.jsx` (lanes by tier on the chart, the plotted route); `scene.js` (`state.ride`; in `fly`: when `state.ride`, `ride.step` owns the pose and `ship.js`’s `step` is skipped; `enter` tried each frame while not riding and not landed; the `lanes` autopilot flies `routeTo`’s legs: `state.auto` gains `route` and `leg`; hunters get `escaped` `why: 'lane'` when a ride starts; `emit({ type: 'ride', on, lane })` for the HUD); `UniverseMap.jsx` (a plain lane line: name, tier, next node, time, “S to drop out”; Lane B makes it good); `guide/pages.js` (the drive’s row).

**Interfaces:**
- Produces: `DRIVES[0] = { id: 'lanes', name: 'Hyperlanes', verb: 'Take the lanes', about: 'The autopilot takes the lanes, riding with the traffic. You fly the whole way and can pull out any time.' }`; `tripTime(ship, id, 'lanes')` is `routeTo(...).time` or the `'super'` time when the route is null. `scene.js`’s `state.ride` is `ride.js`’s ride or null; `window.__universe().ride()` for the checks.

- [ ] **Step 1: Write the failing tests** in `nav.test.js`: `parseDrive('nonsense')` is `'lanes'`; `tripTime` on `'lanes'` from home’s edge to the furthest fandom is under 40 s and on `'super'` over 60 s; between two home stations the two are equal (Review Focus 4); `HYPER.recharge` is 30.
- [ ] **Step 2: Run and fail. Step 3: Implement** `nav.js`, then the scene hooks, then the chart (each lane a polyline of 12 chart points, stroke by tier: express 2 px bright, trunk 1.5, local 1 faint; the route over them). **Step 4:** `npx vitest run src/components/universe`, `npx eslint .`; in the browser: M, pick Middle-earth, Hyperlanes: the ship flies to a ramp, rides (the pose changes, the HUD line shows), comes off, parks. Press S mid-ride: it drops out and the speed falls to the pulse drive’s. **Commit.**

### Task 7: the architecture notes and the hand-off

- [ ] `docs/architecture.md`: a paragraph after `layout.js`’s on `scale.js`’s `SPREAD`, `farPlaces.js`, `regions.js`, `hyperlanes.js`, `ride.js` and the `lanes` drive, in the file’s voice. `README.md`’s universe section: two sentences on the lanes. `docs/superpowers/HANDOFF-universe-scale.md`: what landed, how to check it, what Lanes B and C take from here. **Commit.**

### Task 8: evidence

- [ ] `poses.js` gains `'far-rim'` (the ship at home’s edge looking out at the furthest fandom: the impostors) and `'lane-ride'` (the ship held mid-way on the home–Middle-earth trunk, heading along it). `scripts/universe-check.mjs` takes them; run the three tiers against `lab/universe/baseline/` and put the numbers (draw calls, triangles, frame time) in the PR against the budgets. `node scripts/navmap-check.mjs` for the chart. Screenshots of `overview`, `far-rim`, `lane-ride` and the chart in the PR. Merge on green.

---

## Lane B: the traffic and the look (after Lane A merges)

Branch `claude/universe-lane-traffic` from `origin/main`.

### Task 1: the flow (`laneFlow.js`)

**Files:** Create `src/components/universe/laneFlow.js`, `laneFlow.test.js`.

**Interfaces:**
- Produces: `countFor(lane) -> n` (`ceil(length / TIERS[tier].density)` a carriageway), `slotOf(lane, way, i) -> { off: [u, v], v: 0.9…1.1, phase: 0…1, kind }` (deterministic by a hash of `lane.id`, `way`, `i`; `off` within `R × 0.7`; `kind` from `sides.js`’s everyday traffic of the side that holds the region of `lane.from`, convoys on trunks (`column: true`, 4 to 7), the side’s capital on the express), `flowAt(lane, way, t, dead = new Set()) -> [{ i, s, off, kind, speed }]` with `s = (phase + v * speed * t / length) mod 1`, a dead `i` left out until its next wrap (`wrapsOf(i, t)` counts them: dead is `{ i, wraps }`), `kill(dead, lane, way, i, t)`.
- Consumes: Lane A’s `LANES`, `TIERS`, `R`, `carriageway`; `sides.js`.

- [ ] **Step 1: Write the failing tests:** `flowAt` at `t = 0` and `t = 1000` give the same count; a ship’s `s` advances by `speed × dt / length`; two pilots (two calls) agree exactly; a killed ship is absent at `t + 0.1` and present again only after its wrap (Review Focus 5); `off` never beyond `R × 0.7`.
- [ ] **Step 2: Run and fail. Step 3: Implement. Step 4: Run green. Commit.**

### Task 2: streaks and ribbons (`laneStreaks.js`, `laneRibbons.js`)

**Files:** Create `laneStreaks.js`, `laneRibbons.js`; modify `scene.js` (create and `update(t, camera)` a frame).

**Interfaces:**
- Produces: `createLaneStreaks(scene, { lanes, flow, level }) -> { update(t, camera, dead), dispose() }`: one `InstancedMesh` of quads, each stretched along its tangent by `clamp(speed / 300, 1, 8)` units, additive, `depthWrite: false`, the shader clamping the on-screen length to at least 1.5 px; `low` draws every second ship, `small` every fourth. `createLaneRibbons(scene, { lanes, level }) -> { update(t), dispose() }`: one `LineSegments` (or a thin ribbon mesh) for all carriageways, 48 segments a lane, additive, brightness by tier (express 0.9, trunk 0.6, local 0.35), a dash pattern moving at the tier’s speed in the shader, fading past 20,000 from the camera.
- Consumes: Task 1; Lane A’s `LANES`, `carriageway`, `bezier`, `tangent`.

- [ ] **Step 1:** no pure logic beyond Task 1; **write a smoke test** that `createLaneStreaks` with a stub scene makes one mesh with `count` equal to the sum of `countFor` (vitest with three’s pure classes, as `traffic.test.js` does). **Step 2: Implement. Step 3:** in the browser from `far-rim` the lanes read as threads of moving light; `renderer.info` before and after at `overview` within budget. **Commit.**

### Task 3: near traffic in the lanes (`laneTraffic.js`)

**Files:** Create `laneTraffic.js`, `laneTraffic.test.js`; modify `scene.js` (create, `update`, hits from the guns: `targeting.js`’s hit test gets the lane traffic’s list as `traffic.js`’s already is), `standing.js` (`DEEDS.freighter` applies).

**Interfaces:**
- Produces: `RESOLVE = 12`, `NEAR = 400`; pure `nearest(flow, ship, n, near) -> [{ lane, way, i, s, dist }]`; `createLaneTraffic(parent, { models: trafficModels, fleet: glbFleet, small }) -> { update(dt, t, ship, flowAt, dead) -> events, hit(bolt) -> { kind, at, size } | null, dispose() }`: a pool of `RESOLVE` models reassigned to the nearest flow ships, posed by `carriageway` and `off`, nose along the tangent, scaled from the streak over 0.4 s; a hit calls `kill` and pops as `traffic.js` does; `events: [{ type: 'kill', kind }]`.

- [ ] **Step 1: Write the failing tests** for `nearest` (sorted, capped, within `near`). **Step 2: Fail. Step 3: Implement. Step 4:** in the browser, ride a trunk: freighters and fighters ride beside you, shootable; `low` has none. **Commit.**

### Task 4: the ride’s look

**Files:** Move `src/components/galaxy/speedLines.js` to `src/lib/three/speedLines.js` (the galaxy path re-exports it); modify `scene.js` (speed lines on while riding, `stretch` by `ride.speed / SHIP.pulse` clamped 0…1; the FOV widening scaled by the same), `UniverseMap.jsx` (the lane line styled: name and tier chip, next node and time, the drop hint, the heat bar hidden), `guide/pages.js` (the rows: “S (hold) drop out of a lane”, “W (hold) carry on through a junction”), `galaxy/speedLines.test.js` if one exists (path).

- [ ] **Step 1:** `guide/pages.test.js` runs green with the rows. **Step 2: Implement. Step 3:** browser: a ride streaks the stars and the lane ribbon streams past; `npx eslint .`; `npx vitest run src/components/galaxy src/components/universe src/components/guide`. **Commit.**

### Task 5: evidence and the hand-off

- [ ] `scripts/universe-check.mjs` at `far-rim`, `lane-ride`, `overview` on the three tiers, numbers in the PR against the budgets; a screenshot each. `docs/architecture.md`: a paragraph on `laneFlow.js`, `laneStreaks.js`, `laneRibbons.js`, `laneTraffic.js`. `HANDOFF-universe-scale.md` updated. Merge on green.

---

## Lane C: spread out (after Lane A merges, beside Lane B)

Branch `claude/universe-spread` from `origin/main`. Touches none of Lane B’s files; where both need a line in `scene.js`, this lane’s lines are in `happen`, `farFight` and the pilots’ `update` only.

### Task 1: the director’s zones

**Files:** Modify `director.js`, `director.test.js`.

**Interfaces:**
- Produces: `ZONES = ['place', 'lane', 'void']`; every `EVENTS` entry gains `zones` (the spec §8 table: place: hunt, distress, remover, eclipse, escort, meteors, convoy; lane: interdiction, lanejam, convoy, ambush; void: leviathan, comet, rift, flare, supernova, bounty; `destroyer`, `council`, `roadblock` are `['place', 'lane']`). `update` keeps returning the id; a new pure `playAs(id, zone) -> id` maps those three to `'interdiction'` and `hunt` to `'ambush'` when `zone === 'lane'`, and the scene plays `playAs`’s id. `update(dt, { …, zone })` picks only events whose `zones` has `zone`; `zoneOf(ship, { regionAt, laneAt }) -> zone`.

- [ ] **Step 1: Write the failing tests:** on a lane with a Star Wars side the picks over 200 seeded updates are only lane events; in the void only void events; `playAs('destroyer', 'lane')` is `'interdiction'`, `playAs('destroyer', 'place')` is `'destroyer'`; `zoneOf` at a member’s position is `'place'`, on a carriageway `'lane'`, elsewhere `'void'`.
- [ ] **Step 2: Fail. Step 3: Implement. Step 4: Green. Commit.**

### Task 2: the lane events in the scene

**Files:** Modify `scene.js` (`happen`: `interdiction` places the side’s capital (`setpieces.js`’s destroyer, the Council’s cruisers, the roadblock) across the carriageway `600` units ahead and sets `state.ride = null` with the dropped-out speed (the gravity well), the existing `destroyer`/`council`/`roadblock` fight following; `lanejam` is `minefield.js`’s band placed across the carriageway `900` ahead; `ambush` is `hunt` with `entryPoint`’s `from` at the ride’s end node; `convoy` on a lane is a flow convoy you overtake, no spawn), `minefield.js` (`bandAcross(pts, s, r)` for a lane), `minefield.test.js`, `hunterRules.js` (`entryPoint` accepts `{ at }`: the pack comes in round that point, never inside a solid), `hunterRules.test.js`.

- [ ] **Step 1: Write the failing tests:** `bandAcross` returns mines within `R × 1.3` of the carriageway at `s` and none inside a solid; `entryPoint` with `at` puts every hunter within 40 of it and outside every solid.
- [ ] **Step 2: Fail. Step 3: Implement. Step 4:** browser: `window.__universe().soon('interdiction')` mid-ride drops the ship out before a Star Destroyer; `soon('ambush')` ends a ride in a fight at the ramp. **Commit.**

### Task 3: far fights and the fronts

**Files:** Create `farFights.js`, `farFights.test.js`; modify `skirmish.js` (`placeAt(node)`), `scene.js` (`farFight` picks a node of the region you’re headed for, or a random beacon, further than 2,000; the impostor shown while far), `front.js` (`frontAt(war) -> beacon` nearest the war’s own places; the front built there), `front.test.js`, `NavMap.jsx` (a “Fighting near <region>” marker; Lane B doesn’t touch NavMap after Lane A, so this is safe).

**Interfaces:**
- Produces: pure `FAR = 2000`, `impostorFor(fight: { at, size, bolts }) -> { points: n, flicker: hz }`; `createFarFights(scene) -> { update(dt, fights: [{ id, at, size, hot }], camera), dispose() }`: one `Points` cluster per fight, additive, flickering by `hot`, plus bolt flashes as short lived points; `frontAt(war, beacons) -> beacon`.

- [ ] **Step 1: Write the failing tests:** `impostorFor` scales points with size; `frontAt` for the Rick and Morty war is the beacon nearest the Council’s picket and Earth C-137’s midpoint; a skirmish `placeAt` a node sits within 200 of it and clear of solids.
- [ ] **Step 2: Fail. Step 3: Implement. Step 4:** browser: from `far-rim` a far fight flickers at a beacon; the chart names it; ride there and the real skirmish is on. `node scripts/universe-war-check.mjs` still passes. **Commit.**

### Task 4: the other pilots, spread

**Files:** Modify `online/protocol.js` (`FLAG.lane = 8`; `readPose` gives `lane: Boolean`), `protocol.test.js`; `online/pilots.js` (`DRAW = 3000`: a ship within it; beyond it with `pose.lane` and `laneAt(pose)` non-null, a streak in the pilot’s colour on the lane; else nothing drawn (the chart’s blip is `NavMap.jsx`’s, which already draws pilots if it does; else add one)), `online/Online.jsx` (the region after the place: `regionAt` on the last pose: “Universe · Near Middle-earth”, “Universe · the void”), `scene.js` (the pose’s flags gain `lane` while `state.ride`).

- [ ] **Step 1: Write the failing tests:** `writePose` with `FLAG.lane` round-trips to `lane: true`; `readPose` of an old 9-field pose gives `lane: false`; a pure `howToDraw(pose, me, { laneAt }) -> 'ship' | 'streak' | 'blip'` (put it in `protocol.js` or a new `pilotsRules.js`): within `DRAW` is `'ship'`, beyond with the bit and on a lane `'streak'`, beyond with the bit and off every lane `'blip'` (Review Focus 3).
- [ ] **Step 2: Fail. Step 3: Implement. Step 4:** `node scripts/online-check.mjs` (two browsers on the real relays) with one pilot riding: the other sees a streak then a ship as it nears; the roster names regions. **Commit.**

### Task 5: evidence and the hand-off

- [ ] `scripts/events-check.mjs` and `universe-npc-check.mjs` green; a screenshot of an interdiction mid-ride and of a far fight from `far-rim` in the PR. `docs/architecture.md`: the director’s zones, `farFights.js`, the pilots’ `DRAW`. Merge on green.

---

## Lane D: the galaxy’s routes (independent; starts now)

Branch `claude/galaxy-routes` from `origin/main`.

### Task 1: the route finder (`galaxy/routes.js`)

**Files:** Create `src/components/galaxy/routes.js`, `routes.test.js`.

**Interfaces:**
- Produces: `SNAP = 1.2` (grid squares), `JUMP = { base: 2.5, perSquare: 1.2, max: 12, offLane: 1.6 }`; `laneGraph(lanes = LANES, systems = SYSTEMS) -> { nodes, edges }` (each lane’s points as nodes joined in order; a system snapped to the nearest lane point within `SNAP` becomes a node on it; lanes sharing a point within 0.3 join); `routeBetween(fromId, toId) -> { pts: [[x, z], …], squares, onLane: boolean }` (Dijkstra over the graph by length when both ends snap and are connected; else the straight line with `onLane: false`); `jumpTime(route) -> seconds` (`min(max, base + perSquare × squares)`, `× offLane` when off the lanes).
- Consumes: `systems.js`’s `LANES`, `SYSTEMS`.

- [ ] **Step 1: Write the failing tests:** Coruscant to Tatooine is on the lanes (the Corellian Run) and its `squares` is within 10% of the lane’s length between them; Dagobah to Hoth is off the lanes (check the data; pick a pair that is) and `jumpTime` is `× 1.6`; `jumpTime` never over 12; a route’s `pts` start and end at the systems.
- [ ] **Step 2: Fail. Step 3: Implement. Step 4: Green. Commit.**

### Task 2: the jump takes the route

**Files:** Modify `galaxy/scene.js` (the jump’s `holdJump(jumpTime(route) * 1000)`; the tunnel’s `length` scaled by the time over 2.45), `galaxy/interdiction.js` (`INTERDICTION.jumps` window comes two jumps sooner when the last jump was off the lanes: `nextWindow(count, offLane)`), `interdiction.test.js`, `galaxy/HoloMap.jsx` (the course drawn along `routeBetween(...).pts` in place of the straight line; a “via the Corellian Run” caption from the lanes it uses), `galaxy/travel.js` if the jump’s timing lives there.

- [ ] **Step 1: Write the failing test** in `interdiction.test.js`: `nextWindow(8, true)` bites where `nextWindow(10, false)` does. **Step 2: Fail. Step 3: Implement. Step 4:** browser: plot Coruscant → Tatooine, the holomap bends along the Run, the tunnel runs about 8 s; Dagobah → Hoth is longer and straight. **Commit.**

### Task 3: open systems and hyperspace traffic in the sky

**Files:** Modify `galaxy/space.js` (`EDGE = 2400`, `PULSE = 120`), `space.test.js`, `galaxy/world.js` if a set piece is placed by the edge, `galaxy/scene.js` (streaks: ships leaving and arriving along `courseTo` to each system the lanes join this one to: a `Points` of stretched sprites, `3 to 6` at a time, each a 2.5 s life from the planet’s far side out to the sky, or the reverse; `low` none), `galaxy/sky.js` only if the sky’s stars hide the streaks.

- [ ] **Step 1:** `space.test.js` pins the new edge and pulse, and `openness` still 0 at the planet. **Step 2: Implement. Step 3:** `node scripts/galaxy-check.mjs` at Tatooine and Coruscant parked, numbers against `lab/galaxy/baseline/` within budget; screenshots in the PR. **Commit.**

### Task 4: the hand-off

- [ ] `HANDOFF-galaxy-roam.md`: Phase 6 ticked for what landed, what’s left (journeys with deep-space stops). `docs/architecture.md`’s galaxy line: a sentence on `routes.js`. Merge on green.

---

## Self-review notes

- Spec coverage: §1 A1, §2 A2, §3 A3, §4 A4, §5 A5 + B4, §6 A6, §7 B1–B3, §8 C1–C2, §9 C3–C4, §10 D1–D3, §11 the budgets in Global Constraints and each lane’s evidence task.
- Names used across tasks: `LANES`, `NODES`, `TIERS`, `R`, `GAP`, `RING`, `carriageway`, `laneAt`, `routeTo`, `rampOf` (A4) are what B1–B3, C1–C4 consume; `regionAt`, `REGIONS` (A3) what A4, C1, C4 consume; `flowAt`, `kill`, `countFor` (B1) what B2–B3 consume; `state.ride` (A6) what B4, C2, C4 read.
- Lane B and Lane C both add lines to `scene.js`: B in `create` (the lane layers) and `fly` (speed lines); C in `happen`, `farFight` and the pilots’ pose flags. Whichever merges second merges `origin/main` first and resolves by keeping both.
