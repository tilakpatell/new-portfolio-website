# Battlefront lane 1: the sim, the soldiers and the bots. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic, headless battle simulation in which two teams of bots built from the game's AI tables fight on Hoth's real spawn layout with the game's weapon, health and movement numbers: they see, take cover as the game's cover queries score it, fire in the game's burst patterns, suppress, fall back, flank and die, with no renderer and no mode yet.

**Architecture:** `src/lib/battlefront/` pure modules composed by `sim.js`, which steps at a fixed 50 ms from a seed: affectors and abilities on entities, weapons with heat and dispersion, bolts swept against bone capsules and the navgrid's solids, soldiers with the class rows, and bots whose brain is a utility pick over the game's tactics branches, with squads and alerts. The navgrid is built from a height function and solid boxes; for the Node arena it is a fitted plane under Hoth's real spawns and volumes.

**Tech Stack:** `src/lib/ai/` (utility, perception, squad, spatial, steer, vec), `src/lib/combat/bolt.js` and `accuracy.js`, `src/lib/seeded.js`, Vitest (`npm test`, `npm run test:ai` for the scenario).

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-game-design.md` (decisions 3, 4, 7, 8; catalogue sections 1, 2, 3, 7, 8; section 9 "Testing").

## Global Constraints

- Pure: no `three`, no DOM, no React under `src/lib/battlefront/`; every random draw through the sim's `rand` from `lib/seeded.js`; the step is `STEP = 0.05` s; bots think on a stagger (`THINK = 0.2` s, each on its own phase), sense every `SENSE = 0.1` s, squads every `SQUAD = 0.5` s.
- Numbers come from `rulebook.js` (lane 0), never typed again in code; a rule the data lacks is a named constant with a comment saying it is the game's rule by observation (`SPAWN_PROTECTION = 3`, `OOB_SECONDS = 10`, `SQUAD_SIZE = 4`, `HEAD_MULTIPLIER` when lane 0 found none).
- Coordinates are the export's (metres, +Y up, +Z forward); an entity is `{ id, team, kind, at: [x, y, z], yaw, vel, hp, hpMax, state, ... }`.
- Files under 800 lines; tests beside files, under a second each, no network; the arena under `test:ai` may take up to 120 s.
- Copy: British spelling, curly quotes; commits one plain sentence with the session's attribution lines; merge commits.
- Before the PR: `npm run lint`, `npm test`, `npm run test:ai`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **A bot whose path is blocked by another bot standing in a doorway**: it must wait or route round, never push through a solid or stand forever. Task 1's `a path round a blocked cell` and Task 8's "no bot stuck 20 s" assertion.
2. **A bolt fired from inside cover at a target also in cover**: the sweep must stop at the cover solid, not pass through because both ends are "in cover". Task 5's `a bolt stops at a solid between two covers`.
3. **Heat at exactly the threshold**: `0.8` with threshold `0.8` overheats (the game's compare is `>=`); the active-cooling press at the window's edge `0.65` counts as a success. Task 3's tests.
4. **A suppressed bot with no cover within reach**: it must fall back toward its squad or go prone, not freeze. Task 7's `suppressed with no cover falls back`.
5. **Two runs with one seed**: identical event logs, including bot decisions (the stagger phases come from the seed, not from entity creation order). Task 6's `determinism` test.

---

## File structure

| File | Responsibility |
| --- | --- |
| `nav.js` (+ test) | `buildNav`, `cellAt`, `heightAt`, `walkable`, `findPath`, `lineClear`, `coverSlots`, `nearestSlot` |
| `fixtures/field.js`, `fixtures/hothFlat.js` | a synthetic field with a wall and a hill; Hoth's spawns and volumes over a fitted plane |
| `affectors.js` (+ test) | `createStack`, `apply`, `remove`, `resolve` |
| `abilities.js` (+ test) | `createAbilities`, `press`, `tick`, `blocked` |
| `weapons.js` (+ test) | `createGun`, `fire`, `tick`, `vent`, `coolPress`, `dispersionFor`, `damageAt` |
| `soldier.js` (+ test) | `newSoldier`, `capsulesOf`, `hurt`, `tick`, `stanceOf`, `speedOf` |
| `bolts.js` (+ test) | `createBolts`, `fire`, `step` |
| `sim.js` (+ test) | `createSim`, `step`, `addPlayer`, `view`, `events` |
| `ai/cover.js` (+ test) | `scoreSlots`, `pickCover` |
| `ai/soldierBrain.js` (+ test) | `createBrain`, `think`, `act` |
| `ai/squad.js` (+ test) | `createSquads`, `update`, `alert` |
| `arena.test.js` | the skirmish, under `test:ai` |
| `scripts/battlefront-balance.mjs` | `--skirmish` runs the arena N times and prints a table |

---

### Task 1: The navgrid

**Files:**
- Create: `src/lib/battlefront/nav.js`, `nav.test.js`, `fixtures/field.js`

**Interfaces:**
- Produces:
  - `buildNav({ heightAt(x, z) → y, bounds: { min: [x, z], max: [x, z] }, cell = 2, solids = [{ at: [x, y, z], half: [x, y, z], yaw }], maxSlope = 0.9 }) → nav` where `nav = { cell, cols, rows, origin: [x, z], height: Float32Array, walk: Uint8Array (1 walkable), solid: Uint8Array, slots: [{ at: [x, y, z], facing: yaw, height: 'crouch' | 'stand', protectedWidth }] }`. A cell is unwalkable when inside a solid's footprint, or when the height difference to a neighbour exceeds `maxSlope × cell`. Cover slots are found along each solid's walkable edge every `SlotSpacing` (2.2 m from `ai.json`'s cover constants, passed in as `cover`), facing away from the solid, `height` `'crouch'` when the solid's top is between `CrouchHeight` and `StandHeight` above the cell, `'stand'` when higher.
  - `cellAt(nav, x, z) → [c, r] | null`; `heightAt(nav, x, z) → y` (bilinear); `walkable(nav, x, z) → boolean`.
  - `findPath(nav, from: [x, z], to: [x, z], { blocked = new Set() } = {}) → [[x, z]] | null`: A* on 8-neighbours with octile heuristic, string-pulled (a cell removed when the line to the next is clear), a `blocked` set of cell indices (bots standing still) treated as unwalkable, at most `MAX_EXPAND = 20000` expansions (then `null`).
  - `lineClear(nav, a: [x, y, z], b: [x, y, z]) → boolean`: samples every `cell / 2` m along the segment; false when a sample is inside a solid's box (with its height) or below the terrain.
  - `coverSlots(nav, near: [x, z], r) → slots within r`; `nearestSlot(nav, at, facingThreat: [x, z])`.

- [ ] **Step 1: Failing tests** on `fixtures/field.js` (`heightAt` flat 0 with a hill `y = 6 × smoothstep` of radius 20 m at `[60, 60]`; one wall solid `at [0, 1, 20] half [15, 1, 0.5]`; one crate `at [10, 0.6, −10] half [0.6, 0.6, 0.6]`; bounds ±100): `buildNav` gives `cols === rows === 100`; `walkable` false inside the wall, true beside it; the hill's steep flank unwalkable where slope exceeds 0.9 (compute one cell and assert); `findPath([0, 0], [0, 40])` goes round the wall (every point's `|x| > 15` or `z` outside `[19, 21]`), is non-null, and its first point is `[0, 0]`; `a path round a blocked cell` (block the only gap: the path still exists round the other end); `lineClear` false across the wall at `y 1`, true over it at `y 3`; `coverSlots` finds slots along the wall's south face `2.2` m apart with `height 'stand'` (the wall is 2 m tall) and the crate's with `height 'crouch'` (1.2 m).
- [ ] **Step 2: Run** `npx vitest run src/lib/battlefront/nav.test.js` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A navgrid with paths, lines of sight and the game's cover slots`.

### Task 2: Affectors and abilities

**Files:**
- Create: `affectors.js`, `affectors.test.js`, `abilities.js`, `abilities.test.js`

**Interfaces:**
- Consumes: ability and card rows from `rulebook.js` (`{ id, kind, activation, active, recharge, cost, channels, ranks: [{ modifiers: [{ property, op, value }] }] }`).
- Produces:
  - `createStack() → stack`; `apply(stack, { id, property, op: 'set' | 'mul' | 'add', value, until? })`; `remove(stack, id)`; `resolve(stack, property, base) → number` (adds, then muls, then the last set wins; expired `until` entries dropped at `tick(stack, now)`).
  - `createAbilities(rows, { rand }) → abs`; `press(abs, slot, now) → { fired: boolean, why?: 'recharging' | 'blocked' | 'queued' }` (a press while another ability on a shared channel is active is `blocked`; a press during `activation` is queued up to `QUEUE = 3` for `QUEUE_TIMEOUT = 0.5` s, the game's input queue); `tick(abs, dt, now) → events` (`{ type: 'ability', id, phase: 'start' | 'active' | 'end' }`); `charges(abs, slot) → number` (`floor(bar / cost)`, the roll's `0.5` cost gives 2); `blocked(abs, slot) → boolean`.

- [ ] **Step 1: Failing tests**: `resolve` of base 150 with `mul 1.2` and `add 10` is `190`; a `set 800` after them is `800`; `remove` restores; an `until` entry drops after `tick`. The roll row (cost 0.5, recharge 4, active 0.1): two presses fire, a third is `recharging`; after `tick` of 4 s both charges are back; two rows on one channel: the second press while the first is active is `blocked`; a press during a 0.1 s activation is `queued` and fires on the next `tick`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Affector stacks and abilities on channels, with the game's charges and input queue`.

### Task 3: Weapons

**Files:**
- Create: `weapons.js`, `weapons.test.js`

**Interfaces:**
- Consumes: a weapon row (`firing`, `heat | ammo`, `damage`, `dispersion`, `recoil`, `range`).
- Produces: `createGun(row, { rand }) → gun` with `gun.heat` (0 to 1), `gun.state` (`'ready' | 'firing' | 'overheated' | 'venting' | 'deploying'`), `gun.cooling` (`null | { at, window: [a, b], super: [a, b] }` while overheated); `fire(gun, now, { stance, moving }) → shot[] | null` (`null` when not ready or the interval `60 / rof` has not passed; a burst weapon returns its `burst` shots `60 / rofForBurst` apart as scheduled shots `{ at, dir: jitter }`); `tick(gun, dt, now)` (heat drops at `dropPerSecond` after `dropDelay` since the last shot, `× overheatedDrop` while overheated; `penalty` seconds then `'venting'` for `vent` seconds then `'ready'`); `vent(gun, now)` (a manual vent: heat to 0 after `vent` seconds); `coolPress(gun, now) → 'success' | 'super' | 'fail'` while overheated (the bar runs 1 to 0 over `penalty` s; a press inside `window` is a success that ends the penalty after `successPenalty`, inside `super` ends it at once, else `failurePenalty` is added and the window resets to its start); `dispersionFor(gun, stance, moving) → radians` (the row's `dispersion` entry for the stance, `min` plus the shot-accumulated `perShot × shots` capped at `max`, decaying at `decay` a second after `noFireDelay`; degrees in the data, radians out); `damageAt(row, dist) → number` (linear from `damage.start` at `startDistance` to `damage.end` at `endDistance`, times `min`/`max` multipliers; when `damage` is absent, `HAND_DAMAGE = { rifle: 35, heavy: 30, pistol: 40, longRange: 55, shortRange: 25, special: 30 }` by family, with a comment).

- [ ] **Step 1: Failing tests** with the A280C row from `rulebook.js`: two `fire` calls 0.05 s apart give one shot (interval 0.1 s at rof 600); 24 shots take heat past `0.8` and `state` is `'overheated'` (heat `>= threshold`, `at exactly the threshold overheats`); `coolPress` at a bar value of `0.7` is `'success'`, at `0.65` is `'success'` (inclusive edge), at `0.35` is `'super'`, at `0.9` is `'fail'` and the next window starts at `[0.8, 0.65]` again; after a success the next overheat's window is `[0.8 − shrink…]` narrower by one step; `dispersionFor` at stance `'stand'` with no shots is `0`, after 10 shots is `min(0.8, 0.8) °` in radians; `damageAt` at 0 m is `damage.start` and at `endDistance + 10` is `damage.end`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Guns with the game's heat, active cooling, bursts and dispersion`.

### Task 4: Soldiers

**Files:**
- Create: `soldier.js`, `soldier.test.js`

**Interfaces:**
- Consumes: a class row, `affectors.js`, `abilities.js`, `weapons.js`.
- Produces: `newSoldier(classRow, { id, team, at, yaw, rand, bot = true }) → s` with `{ id, team, kind: 'soldier', cls, at, yaw, vel: [x, y, z], hp, hpMax, state: 'stand' | 'crouch' | 'roll' | 'dying' | 'down', stance, moving, gun, abilities, stack, lastHurt, suppressed, alive }`; `capsulesOf(s) → [{ part: 'head' | 'chest' | 'hips' | 'armL' | 'armR' | 'legL' | 'legR', a: [x, y, z], b, r }]` from the stance (head radius 0.12 at 1.65 m standing, 1.2 crouching; chest 0.2; limbs 0.1); `hurt(s, { damage, part, from, by, now }) → 'hurt' | 'down'` (`HEAD_MULTIPLIER` 1.5 when lane 0 found none, with its comment; `ArmorMultiplier` through the stack; `state 'dying'` at 0 hp then `'down'` after `TimeForCorpse` from the row); `tick(s, dt, now)` (regen `rate` a second after `delay` since `lastHurt`, `gun`, `abilities`, the roll's movement); `speedOf(s) → m/s` (`WALK = 4.2`, `SPRINT = 6.5`, `CROUCH = 2.4` as the game's rules by observation, the row's multipliers through the stack); `move(s, dir: [x, z], dt, nav)` (steps along `dir` at `speedOf` onto `nav.heightAt`, stopped by unwalkable cells).

- [ ] **Step 1: Failing tests**: `hp === 150` for the Assault row; `hurt` of 35 to the chest leaves 115; to the head `150 − 52.5`; regen does nothing for 6 s then `30` a second to the max; `hurt` to 0 gives `'down'` after `tick` of 4.5 s; `capsulesOf` standing has the head top at `≈ 1.77`; crouching lower; `move` across the field fixture stops at the wall.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Soldiers from the class rows: health, regen, stances, bone capsules`.

### Task 5: Bolts

**Files:**
- Create: `bolts.js`, `bolts.test.js`

**Interfaces:**
- Consumes: `lib/combat/bolt.js` (the swept segment against capsules), `nav.lineClear`.
- Produces: `createBolts() → bolts`; `fire(bolts, { from, dir, speed, damage, range, team, owner, colour, now }) → bolt`; `step(bolts, dt, { bodies: [{ id, team, capsules, alive }], nav }) → events` with `{ type: 'hit', bolt, target, part, at, dir }`, `{ type: 'wall', at }`, `{ type: 'near', bolt, target, dist }` (passed within `NEAR = 2` m of a body: suppression), `{ type: 'gone' }` (range or `TimeToLive`); a bolt moves `speed × dt` a step and its whole segment is swept, first solid or body wins by distance; friendly bodies are skipped (`team ===`).

- [ ] **Step 1: Failing tests**: a bolt at 700 m/s from `[0, 1.5, 0]` toward `+z` hits a body at `z 30` within one step and the event names the part; `a bolt stops at a solid between two covers` (the field's wall at z 20 between shooter at z 0 and body at z 40: `wall`, no `hit`); a body 1.5 m off the line gets `near`; a bolt past `range` is `gone`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Bolts swept against bodies and the navgrid`.

### Task 6: The sim

**Files:**
- Create: `sim.js`, `sim.test.js`, `fixtures/hothFlat.js`

**Interfaces:**
- Consumes: everything above; `rulebook.js`.
- Produces:
  - `createSim({ rulebook, level = 'hoth', era = 'Orig', nav, seed, teams: { 1: side, 2: side }, bots: { 1: n, 2: n }, mode = null }) → sim` with `sim.entities: Map`, `sim.time`, `sim.events` (the log, cleared by `drain()`), `sim.nav`, `sim.rand`.
  - `step(sim, inputs = []) → events` (one `STEP`; `inputs` are `{ id, move: [x, z], look: yaw, fire, aim, crouch, roll, ability: 1 | 2 | 3, vent, cool }` for players).
  - `addPlayer(sim, { team, classId, at, yaw }) → id`; `removeEntity(sim, id)`.
  - `view(sim) → { time, teams: { 1: { alive, dead, kills }, 2 }, entities: [{ id, team, kind, at, yaw, hp, hpMax, state, stance, moving, aim, firing, heat }] , bolts: [{ at, dir, colour }] }` (what a renderer and the HUD need, allocated once and mutated).
  - `fixtures/hothFlat.js`: `hothFlatNav(rulebook) → nav` from `mapOf(rb, 'hoth')`: a plane fitted (least squares) through every spawn's `[x, y, z]`, bounds the map's, `cell 2`, solids: a 2 m tall, 1 m thick wall along each capture volume's edge with a 4 m gap every 20 m (so there is cover and doors), plus 40 crates seeded round the volumes.
  - Bots are added by `createSim` from `teams[t].classes` round-robin at the team's spawns (`spawnsFor(map, { mode: 'galacticAssault', team })`, priority order, `rand` among equal priority) until `bots[t]`.

- [ ] **Step 1: Failing tests**: `createSim` with 4 bots a side has 8 entities on walkable cells; `step` advances `time` by 0.05; `determinism`: two sims with seed 7 stepped 600 times give equal event logs (`JSON.stringify`); `addPlayer` and an input `fire: true` with a bot 20 m ahead produces a `hit` event within 1 s; `view()` returns the same object twice.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (bots have no brain yet: they stand; Task 7 adds it). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The battle sim: a fixed step from a seed, entities, bolts, events, a view`.

### Task 7: The bots

**Files:**
- Create: `ai/cover.js` (+ test), `ai/soldierBrain.js` (+ test), `ai/squad.js` (+ test)
- Modify: `sim.js` (bots get a brain; think on the stagger)

**Interfaces:**
- Consumes: `aiOf(rb)` (`templates`, `tactics`, `weapons`, `patterns`, `cover`, `difficulty`), `lib/ai/utility` (`pick`, considerations with curves), `lib/ai/perception` (`sense`, beliefs with coast and fade), `lib/ai/squad` (`createSquads`, `confidence`, `posture`, `frontline`, `flankers`, `createTokens`), `nav.js`.
- Produces:
  - `scoreSlots(slots, { me, threat: [x, z], squad, objective, query }) → [{ slot, score }]` where `query` is a cover query row (`ai.json.cover.queries[name]`: terms `distanceToThreat`, `distanceToMe`, `distanceToObjective`, `protection`, `avoidEnemies`, `inZone` with weights; a term unknown to the scorer is skipped and counted once in `ai.unknownTerms`); `pickCover(nav, ctx) → slot | null` with the query named by the brain's branch (`Attack_*` while attacking, `Hide_*` when suppressed or hurt, `Flee_*` when the squad breaks, `Protective_*` for an officer).
  - `createBrain(s, { role, tactics, template, pattern, rand }) → brain`; `think(brain, world, now) → intent` where `intent = { mode: 'attack' | 'advance' | 'cover' | 'hide' | 'flee' | 'close' | 'follow' | 'hold', target, goal: [x, z] | null, stance, fire: boolean, aim: [x, y, z] | null }` chosen by `lib/ai/utility.pick` over considerations the tactics table parameterises: engage when a believed enemy is within `engage.distance`; attack from a cover slot when one scores; advance by `pattern` (fire the frames whose bit is set, move on the others); hide when `suppressed > suppression.value` or hp under 40 percent; flee when the squad's posture is `retreat`; close combat when the enemy is within `closeCombat.distance`; follow the squad leader when no enemy is believed; `aim` with error from the difficulty curve at the target's distance (degrees from the curve's `y` at `x = distance` scaled by `AIM_SCALE = 0.1`, a knob) and `lib/combat/accuracy`'s lead.
  - `act(brain, intent, s, dt, nav, bolts, now)`: path to `goal` (re-planned every `REPLAN = 1.5` s or when blocked), stance, fire through the soldier's `gun` only with `lineClear` to the target's chest.
  - `createSquads(sim) → squads` on `lib/ai/squad` (`SQUAD_SIZE = 4`, by spawn group); `update(squads, sim, dt)` every `SQUAD` s: confidence, posture, frontline; `alert(squads, from, at, now)`: an alert propagates at `alertPropagationSpeed` to squadmates (a belief planted when the wave reaches them).
  - Suppression: a `near` event adds `suppression.value` (the tactics' `WeaponSuppressionSettings.SuppressionValue`) to the body's `suppressed`, fading over `suppression.time`.

- [ ] **Step 1: Failing tests**: `scoreSlots` prefers a slot whose `protection` faces the threat and is nearer the objective; `pickCover` is `null` with no slot within the query's range; a brain with an enemy at 30 m in the open picks `attack` and `fire true` only when `lineClear`; with the enemy at 60 m (past engage 40) picks `advance`; `suppressed with no cover falls back` (suppressed 1.0, no slots: `mode 'hide'` with `goal` away from the threat toward the squad's centre, not `null`); an alert planted at 10 m arrives after 5 s (`2` m/s); the firing pattern id 1 fires on its set bits (step the brain through 12 frames and compare `fire` to `bits`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; wire into `sim.js` (`THINK` stagger phases from `rand` at creation). **Step 4: Run** → PASS; `sim.test.js`'s determinism still holds.
- [ ] **Step 5: Commit** `Bots from the game's tactics: cover queries, firing patterns, suppression, squads and alerts`.

### Task 8: The arena and the balance runner

**Files:**
- Create: `src/lib/battlefront/arena.test.js`, `scripts/battlefront-balance.mjs`
- Modify: `vitest.ai.config.js` (include `src/lib/battlefront/**/arena.test.js`), `package.json` only if `test:ai` lacks the glob

**Interfaces:**
- Produces: `arena.test.js`: `createSim` on `hothFlatNav` with 20 bots a side, seed 1, stepped 3,600 times (3 minutes): kills on both sides `> 5`; no bot alive and not in `cover`/`hide` has `at` unchanged for 400 consecutive steps (20 s); every bot's `at` is on a walkable cell at every 100th step; two seeds differ in their logs; one seed twice is equal; wall time under 60 s (`performance.now`). `node scripts/battlefront-balance.mjs --skirmish [--runs 10] [--bots 20] [--seconds 180]` prints `seed, kills1, kills2, alive1, alive2, stuck, ms` per run and a summary; `--profile` prints the share of time in `think`, `bolts.step`, `findPath`.

- [ ] **Step 1: Write the arena test; run** `npm run test:ai -- src/lib/battlefront` → it fails on whatever the bots do wrong; fix in the owning module (a stuck bot is a nav or brain bug; one-sided kills a cover or aim bug) until it passes with the assertions as written. Record the summary table in `docs/superpowers/evidence/battlefront-lane1/skirmish.md`.
- [ ] **Step 2: Write the runner; run** 10 runs; paste the table into the evidence file and the PR body.
- [ ] **Step 3: Docs**: `docs/superpowers/HANDOFF-battlefront.md` lane 1 done with the numbers and the knobs (`AIM_SCALE`, `HEAD_MULTIPLIER`, `HAND_DAMAGE`); `docs/architecture.md` gains a line for `src/lib/battlefront/`.
- [ ] **Step 4: Commit** `The skirmish arena and the balance runner`; lint, test, test:ai, build, health; PR titled `Battlefront lane 1: the sim and the bots on Hoth`.
