# NPC Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executed inline (executing-plans): the user asked for no subagents, and for a pull request merged at the end of each PR section.

**Goal:** One pure, tested AI toolkit (`src/lib/ai/`) and the universe map's characters, its hunters, the galaxy's surface hostiles and armies, and the seven worlds' watchers moved onto it, so NPCs perceive, remember, weigh, search and coordinate instead of reading your position and running timers.

**Architecture:** Eight pure modules in `src/lib/ai/` over `{ x, y, z }` points and a caller-supplied `rand()`, each with its own vitest file. Each world's rules module (already pure and tested) calls into them; the drawing layers (`npcs.js`, `hunters.js`, `activity.js`, the towns' scenes) do not change except to voice new events. Every brain reads the player through `perception.sense`, never `world.you` directly, except the director.

**Tech Stack:** JavaScript ES modules, vitest 5, three 0.186 (untouched by this plan), Node 22.

**Spec:** `docs/superpowers/specs/2026-10-07-npc-intelligence-design.md` (research: `docs/research/2026-10-07-game-ai-npcs.md`)

## Global Constraints

- British spelling, curly quotes in prose and UI copy; comments say why. No model names in code, docs or commits.
- Every rules module is pure (no three.js), seeded through a `rand` argument, tested in Node. Tests are written first.
- A brain's intent shape stays `{ to?, match?, speed?, fire?, fireRate?, say?, event?, leave?, delegate?, hostile? }`.
- Nothing a visitor can do is lost: every existing test in the touched worlds keeps passing unchanged.
- `docs/health/budgets.json`: `big-files` 30, `lint-disables` 54, `todo-notes` 0. No new file over the big-file line (see `scripts/health/big-files.mjs`), no `eslint-disable`, no TODO.
- Before every push: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, all clean.
- One PR per section below, on branch `claude/vibrant-fermi-0pmrpa` reset from `main` after each merge; merge commit; never merge red.
- Commit messages are one plain sentence ending with the session's attribution lines.

## Review Focus

1. **A target that was never seen.** `belief(me, id)` must return `null`, and a brain given no belief must do what it did with `world.you` null (leave, wait, patrol), never throw. Pinned by `perception.test.js` "a target never sensed has no belief" and `npcRules.test.js` "a brain with no belief of you behaves as with no you".
2. **A frame of zero or huge `dt`.** `sense`, `tick`, `createSearch.update` and `createTokens.audit` with `dt = 0` change nothing; with `dt = 5` a belief fades at most to zero and a timer at most to its end. Pinned by `perception.test.js` "a long frame fades a belief no further than gone".
3. **A seesThrough callback that is missing.** Every sense and sweep call takes `seesThrough` optional and treats absence as clear, so a world that has no line-of-sight geometry still works. Pinned by `perception.test.js` "without seesThrough everything in the cone is seen".
4. **A squad whose every member dies in one frame.** `createSquads.update` drops it, `createTokens.audit` reclaims its tokens, `confidence` is never computed with no enemies (division by zero). Pinned by `squad.test.js` "an empty squad is dropped and its tokens come back" and "confidence with no enemy is neutral".
5. **A watcher town that passes the old option table.** `stepWatchers` with `NAZGUL` as it is today (no `suspicious`, no `search` keys) must patrol, see, chase, catch and lose exactly as before, with the detection timer defaulting so the first `seen` comes within the old `alert` window. Pinned by `watchers.test.js` "an old option table runs as before".

---

## PR 1 — research, design and plan

### Task 1: Commit the documents

**Files:**
- Create: `docs/research/2026-10-07-game-ai-npcs.md` (written)
- Create: `docs/superpowers/specs/2026-10-07-npc-intelligence-design.md` (written)
- Create: `docs/superpowers/plans/2026-10-07-npc-intelligence.md` (this)

- [ ] **Step 1:** `npm run lint` passes (docs don't lint, but the tree must be clean).
- [ ] **Step 2:** Commit: "Research, design and plan for NPC intelligence across the worlds".
- [ ] **Step 3:** Push, open the PR, wait for CI, merge.

---

## PR 2 — the toolkit: `src/lib/ai/`

All eight modules, each task one module with its test. Points are `{ x, y, z }`. Helpers shared across them live in `src/lib/ai/vec.js` (Task 2) so no module imports another world's.

### Task 2: `vec.js` and `utility.js`

**Files:**
- Create: `src/lib/ai/vec.js`, `src/lib/ai/utility.js`
- Test: `src/lib/ai/utility.test.js`

**Interfaces:**
- Produces `vec.js`: `sub(a, b)`, `add(a, b, k = 1)`, `len(a)`, `apart(a, b)`, `unit(a)`, `dot(a, b)`, `lerp(a, b, t)`, `clamp(v, lo, hi)`, `wrapAngle(a)`, `yawOf(dir) → atan2(x, z)` (the surface's yaw convention), `yawDir(yaw) → { x: sin, y: 0, z: cos }`.
- Produces `utility.js`: `curve = { linear, inverse, poly(k), logistic(k = 10, mid = 0.5), peak(at, width) }` (each `(x: 0..1) → 0..1`); `consider(value, [lo, hi], fn = curve.linear) → 0..1`; `score(option, ctx) → number` where `option = { id, weight = 1, considerations: [(ctx) → 0..1] }`, multiplicative, short-circuit at 0; `pick(options, ctx, { current = null, momentum = 0.15, rank = null, rand = null, spread = 0 } = {}) → { id, score, scores: { [id]: n } } | null` (null when every option scores 0); `runtime(t, [lo, hi]) → 1 − x^6`; `cooldown(since, s) → x^5` (1 once `since ≥ s`).

- [ ] **Step 1: Write the failing tests** in `utility.test.js`:
  - "curves hit their bookends": `curve.poly(2)(0.5) === 0.25`, `curve.inverse(0.2)` is `0.8`, `curve.peak(0.5, 0.25)(0.5) === 1` and `(0.75)` under `0.05`, `curve.logistic()(0.5)` within `0.01` of `0.5`.
  - "consider clamps outside the bookends": `consider(150, [0, 100]) === 1`, `consider(-1, [0, 100]) === 0`, `consider(25, [0, 100], curve.inverse) === 0.75`.
  - "a zero consideration kills the option and stops the rest": a second consideration that throws is never called.
  - "pick holds the running option within momentum and swaps past it": options a (0.5) and b (0.56) with `current: 'a'` picks `a`; b at 0.6 picks `b`.
  - "rank beats weight": `rank: (o) => o.rank` with `{ id: 'die', rank: 9, … 0.01 }` beats `{ id: 'eat', rank: 0, … 1 }`.
  - "spread with rand picks among the near-best, never the poor": over 200 seeded picks with `spread: 0.2`, both of two options within 10 % are chosen and an option at 0.1 never is.
  - "runtime and cooldown": `runtime(0, [0, 4]) === 1`, `runtime(4, [0, 4]) === 0`; `cooldown(0, 3) === 0`, `cooldown(3, 3) === 1`, `cooldown(1.5, 3)` under `0.05`.
- [ ] **Step 2:** `npx vitest run src/lib/ai/utility.test.js`: FAIL, module not found.
- [ ] **Step 3:** Implement `vec.js` and `utility.js` to the interfaces above. Momentum multiplies the current option's score by `1 + momentum` before comparing.
- [ ] **Step 4:** Run: PASS.
- [ ] **Step 5:** Commit: "The AI toolkit's vectors and utility scoring".

### Task 3: `tree.js`

**Files:** Create `src/lib/ai/tree.js`; Test `src/lib/ai/tree.test.js`.

**Interfaces:**
- Consumes `utility.pick`.
- Produces: statuses `'running' | 'done' | 'failed'`; a leaf is `(bb, dt) → status`; `sequence(...nodes)`, `select(...nodes)`, `parallel(...nodes)` (done when all done, failed when any fails), `guard(test: (bb) → bool, node)` (failed when the test is false), `cooldown(seconds, node, key)` (failed while `bb.clock − bb[key] < seconds`; `bb.clock` the caller's clock), `repeat(node)` (restarts on done), `utility(options, nodesById, pickOpts)` (ticks the winner; `bb.chosen[key]` holds it with momentum); `tick(node, bb, dt) → status`; `reset(node, bb)`. Node state lives in `bb._tree[nodeId]` (ids assigned at build), so one tree serves many blackboards.

- [ ] **Step 1: Failing tests**: "a sequence resumes where it was" (a leaf returns running once, the sequence ticked twice reaches the second leaf once); "a select stops at the first done"; "a guard fails without running its node"; "a cooldown fails until its time"; "a utility node ticks the best option and holds it under momentum"; "two blackboards on one tree don't share state".
- [ ] **Step 2:** Run: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run: PASS.
- [ ] **Step 5:** Commit: "The AI toolkit's behaviour tree".

### Task 4: `perception.js`

**Files:** Create `src/lib/ai/perception.js`; Test `src/lib/ai/perception.test.js`.

**Interfaces:**
- Consumes `vec.js`.
- Produces: `createSenses({ sight = { range: 30, cone: 0.5, far: 2 }, hearing = { range: 12 }, smell = { range: 0 }, memory = 6, intuition = 2.5 })`; `sense(senses, me, world, dt, { seesThrough = null } = {})` where `me = { pos, dir (unit), beliefs: {} }` and `world = { targets: [{ id, at, vel?, kind?, hostile? }], stims?: [{ type, at, radius, from, loudness: 0..1 }] }`; writes `me.beliefs[id] = { id, at, vel, seenAt, heardAt, confidence, visible, timer, kind, hostile }`; `belief(me, id) → belief | null` (null once confidence is 0); `target(me, { hostile = true } = {}) → belief | null`; `share(from, to, id, { fade = 0.6 } = {})`; `forget(me, id)`. Detection: in cone and range and clear, `timer += dt / (far × d / range)` (at the edge `far` seconds, at the centre at once: `max(0.05, …)`), `confidence = min(1, timer)`, `visible = true`; out of sight: `visible = false`, for `intuition` seconds after `seenAt` the belief keeps the true `at`, then `at += vel × dt` and `confidence −= dt / memory`. A stim inside its radius sets `confidence = max(confidence, loudness × 0.8)` and `at` to the stim's `at`, `heardAt`.

- [ ] **Step 1: Failing tests**: "a target in the cone is detected in the timer's time" (range 30, far 2, target at 15 m dead ahead: confidence 1 after ~1 s, not after 0.4); "a target behind is not seen"; "a blocked line of sight is not seen" (`seesThrough: () => false`); "without seesThrough everything in the cone is seen"; "lost, the belief holds the truth for intuition seconds then coasts and fades" (moving target leaves the cone; at `+1 s` belief `at` equals the true position; at `+4 s` it is `last + vel × 1.5` and confidence under 1; at `+10 s` null); "a shot heard raises a belief without sight to 0.8 at the shot"; "a target never sensed has no belief"; "a long frame fades a belief no further than gone" (`dt = 50`: confidence 0, no NaN); "share hands a belief over at lower confidence"; "target picks the surest hostile".
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit: "The AI toolkit's perception: senses, beliefs, intuition and memory".

### Task 5: `search.js`

**Files:** Create `src/lib/ai/search.js`; Test `src/lib/ai/search.test.js`.

**Interfaces:**
- Consumes `vec.js`.
- Produces: `createSearch({ rand, spots: (belief) → [{ x, y, z }], narrow = { cautious: 1, aggressive: 3 }, time = 40, stagger = 2 })` → `{ start(belief, { aggressive = false, truth = null }), claim(id, at) → { at, phase: 1 | 2 } | null, sweep(id, at, seesThrough), done(id) → bool, release(id), update(dt), state }`. Phase 1 hands the last known position to up to `narrow[kind]` claimants (the rest get `null` and should cover); when a claimant reaches it (`arrive(id)`), aggressive searches move to phase 2 and generate spots; `claim` in phase 2 scores unsearched, unclaimed spots by `2 × d(spot, estimate) + d(spot, claimant) + 0.3 × d(spot, truth)` (lowest wins; `truth` null drops the term); `sweep` marks any unsearched spot within `seesThrough(at, spot)` as searched; `done(id)` is true once no spots remain or `time` is up, released one claimant every `stagger` seconds. `flood(grid, from, dir, { hot = 20, perStep = 25, steps = 30 })` with `grid = { cell, walkable(x, z) }` → `{ x, z } | null` (null when the start cell isn't walkable).

- [ ] **Step 1: Failing tests**: "a cautious search sends one to the last position and the rest cover"; "an aggressive search sends three, then sweeps spots"; "a spot seen on the way is searched for everyone"; "searchers are let go one at a time, stagger apart"; "the flood prefers a corridor to a dead end" (a 20×20 grid with a wall making a 3-wide corridor east and a 2-cell dead end north: the centroid lies east); "the flood stops in a wide room" (open grid: result within 5 cells of the start); "the flood never runs backwards through the barrier".
- [ ] **Steps 2–4:** FAIL, implement, PASS.
- [ ] **Step 5:** Commit: "The AI toolkit's search: two phases, shared spots and the chase flood".

### Task 6: `steer.js`

**Files:** Create `src/lib/ai/steer.js`; Test `src/lib/ai/steer.test.js`.

**Interfaces:**
- Produces: `createContext(slots = 16) → { slots, interest: Float32Array, danger: Float32Array, last: Float32Array }`; `clear(ctx)`; `interest(ctx, dir, weight = 1, falloff = 2)` and `danger(ctx, dir, weight = 1, falloff = 1)` (slot `i` is the heading `i × 2π / slots` in the x–z plane; the value written is `weight × max(0, 1 − slotsAway / falloff)`, combined by max); `seek(ctx, from, to, weight)`, `flee(ctx, from, threat, weight, range)`, `avoid(ctx, from, vel, obstacle = { at, r }, margin)` (danger scaled by `1 − d / (r + margin + lookahead)` on the slots facing it), `separate(ctx, from, others, spacing)`, `follow(ctx, from, path, lookahead)`; `resolve(ctx, { blend = 0.3 } = {}) → { dir: { x, y: 0, z }, strength }` (mask slots whose danger exceeds the minimum danger, pick the best interest, interpolate with the two neighbours, blend with `ctx.last`, write `ctx.last`).

- [ ] **Step 1: Failing tests**: "seek alone goes straight at the target"; "an obstacle in the way sends it round, never through" (target at 20 m north, a rock r 2 at 8 m north: the heading is off north by more than 20°, and simulating 100 steps of 0.3 m never enters the rock); "two targets, the clear one wins" (Fray's example); "separation keeps a pair apart"; "blend damps a flip" (a target that jumps 180° turns the heading by under 120° in one resolve).
- [ ] **Steps 2–4:** FAIL, implement, PASS.
- [ ] **Step 5:** Commit: "The AI toolkit's context steering".

### Task 7: `spatial.js`

**Files:** Create `src/lib/ai/spatial.js`; Test `src/lib/ai/spatial.test.js`.

**Interfaces:**
- Produces: `candidates(around, { ring = 8, n = 12, walkable = null }) → [{ x, y, z }]`; `scorePlace(point, tests) → number` where a test is `{ weight, value: (p) → number, norm = 'clamped', bookends = [0, 1], target = null }`; `pickPlace(points, tests, { current = null, hysteresis = 0.15, bias = null }) → { at, score } | null` (keeps `current` unless the winner beats its re-scored value by `hysteresis`; `bias(p)` adds its value to the score); tests as factories: `cover(threats, seesThrough)` (1 when hidden from all), `visible(threat, seesThrough)`, `nearTo(p, range)` (1 at `p`, 0 at `range`), `awayFrom(p, range)`, `apart(others, spacing)`, `offLine(allies, threat, width)` (0 when within `width` of a line from an ally to the threat).

- [ ] **Step 1: Failing tests**: "cover picks the point the threat can't see"; "pickPlace keeps its point under hysteresis"; "bias breaks a symmetric tie the same way every time"; "offLine keeps out of a friend's fire"; "relative normalisation ranks within the set, clamped against bookends".
- [ ] **Steps 2–4.** **Step 5:** Commit: "The AI toolkit's position picking".

### Task 8: `influence.js`

**Files:** Create `src/lib/ai/influence.js`; Test `src/lib/ai/influence.test.js`.

**Interfaces:**
- Produces: `createInfluence({ cell = 2, w, h, origin = { x: 0, z: 0 } }) → map` with `map.data: Float32Array`, `clear(map)`, `stamp(map, at, r, strength = 1, shape = 'linear' | 'threat')` (templates cached by `(r / cell, shape)`), `at(map, x, z) → number`, `working(map, center, r) → { add(other, k), multiply(other, k), normalise(), invert(), highest() → { x, z, v }, lowest() }`.

- [ ] **Step 1: Failing tests**: "a stamp peaks at the agent and is zero past r"; "two stamps add"; "threat is flat most of the way" (`at` half r over 0.9); "a working map's lowest is away from two enemies"; "stamps at the edge don't throw".
- [ ] **Steps 2–4.** **Step 5:** Commit: "The AI toolkit's influence maps".

### Task 9: `squad.js`

**Files:** Create `src/lib/ai/squad.js`; Test `src/lib/ai/squad.test.js`.

**Interfaces:**
- Consumes `vec.js`.
- Produces: `createSquads({ reach = 30 }) → { update(members: [{ id, at, side, alive, leader? }]) → squads: [{ id, side, members: [ids], centre }], of(id) → squad | null }` (merge when any member is within `reach` of any member of another squad of the side; split when no chain connects); `confidence(squad, members, enemies, { value = () => 1, kills = 0, losses = 0 }) → { ratio, level: 'panicked' | 'worried' | 'neutral' | 'confident' | 'heroic' }` with bins at ratios `0.4, 0.75, 1.5, 2.5`, a panicked member's value added to the enemy's side, `kills` added to own, `losses` to the enemy's, and no enemies → `neutral`; `morale(squad, event)` where `{ type: 'leaderDown' }` drops one bin; `frontline(squad, members, enemies, { buffer = 8, minWidth = 3 }) → { dir, centre, line, width, lanes: [{ id, at, dir }] }`; `posture(level) → 'form' | 'hold' | 'retreat' | 'press'` (`panicked | worried` retreat, `neutral` hold, `confident | heroic` press); `advance(squad, members, front) → { move: [ids], cover: [ids] }` (furthest half move) and `withdraw(...)` (nearest half move); `flankers(squad, members, front, enemies) → [{ id, at }]` (the two at the lane ends, a point `front.width × 0.6` off the enemy's nearer flank); `createTokens({ pools = {}, scale = 1, timeout = 6 }) → { claim(kind, who, { priority = 0, target = 'you' } = {}) → bool, release(kind, who), held(kind, who) → bool, steal(kind, who, priority) → bool (takes the lowest-priority holder's), audit(dt, alive: (who) → bool), count(kind, target) }`.

- [ ] **Step 1: Failing tests**: "members within reach are one squad, across a gap two"; "a chain strung out stays one squad"; "an empty squad is dropped and its tokens come back"; "confidence with no enemy is neutral"; "a panicked ally counts for the enemy"; "a leader down drops a bin"; "lanes are one per member and assigned by least movement"; "withdraw moves the nearest half, advance the furthest"; "flankers leave the rear open" (no flank point behind the enemy centre along `dir`); "never two tail tokens" (`pools: { tail: 1 }`: a second claim fails, a higher-priority steal succeeds); "audit reclaims a dead holder's token".
- [ ] **Steps 2–4.** **Step 5:** Commit: "The AI toolkit's squads: confidence, frontline, lanes and tokens".

### Task 10: `index.js`, the architecture note and the PR

**Files:** Create `src/lib/ai/index.js` (re-exports); Modify `docs/architecture.md` ("Where things live": one paragraph for `src/lib/ai/`).

- [ ] **Step 1:** `index.js` exporting every module as a namespace (`export * as utility from './utility'` and so on).
- [ ] **Step 2:** The paragraph in `docs/architecture.md` after the `src/lib/three` entry (find with `grep -n "lib/three" docs/architecture.md`).
- [ ] **Step 3:** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`: all clean.
- [ ] **Step 4:** Commit: "The AI toolkit's index and its note in the architecture". Push, PR, CI, merge. Reset the branch from `main`.

---

## PR 3 — the universe map: characters and hunters

### Task 11: Senses and beliefs in `createBrains`

**Files:** Modify `src/components/universe/npcs/index.js` (a `senses` field on `row`: default `{ sight: { range: 60, cone: 0.2, far: 1.5 }, hearing: { range: 40 } }`; a nemesis `range: 90, cone: −0.2`), `src/components/universe/npcRules.js` (`createBrains.update`: `sense` per `me` with `world.you` and `world.hunters` as targets, `blocked(a, b, world.solids)` as `seesThrough`, `world.stims` passed through; `me.you = belief(me, 'you')`; the relations read beliefs of hunters; `world.you` handed to brains becomes `me.you?.at` with `heading`/`speed` from the belief's `vel`); Test `src/components/universe/npcRules.test.js`.

**Interfaces:**
- Consumes `perception.createSenses/sense/belief/target`, `hunterRules.blocked`.
- Produces: `me.you: belief | null` for every brain; `BRAINS[name].lines` may include `'search'` and `'found'`.

- [ ] **Step 1: Failing tests** in `npcRules.test.js`: "a brain with no belief of you behaves as with no you" (a merchant parked, you 300 units off: no `offer`); "a character can't see you through a planet" (a solid r 20 between: no `seen` for `intuition`+ seconds after you go behind it); "a character fires at where it believes you are" (a rival, you behind a planet since 4 s: its `shot.to` is not your position).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS, and the whole `universe` suite still passes.
- [ ] **Step 5:** Commit: "The universe's characters see and remember instead of reading your position".

### Task 12: Utility in the fighting brains; trees in the scripted ones

**Files:** Modify `src/components/universe/npcs/brains/nemesis.js`, `rival.js`, `inspector.js`, `trickster.js`, `common.js` (`NPC.tail = 3`, `NPC.bait = 2.2`, `NPC.break = 1.2`); Modify `src/components/universe/crews.js` (every crew's `npc[id]` gains `search`, `found`, and the nemeses `bait`; one line each, in the character's voice); Test `src/components/universe/npcs/brains/nemesis.test.js` (new), `src/components/universe/crews.test.js` (already checks lines).

**Interfaces:**
- Consumes `utility.pick/consider/curve/runtime/cooldown`, `tree.*`.
- Produces: nemesis options `{ orbit, pass, jink, fallback, bait, break }` ranked by phase; `nemesis.lines` adds `'bait'`, `'search'`, `'found'`; inspector and trickster as `tree.sequence`s with the same events and lines as today.

- [ ] **Step 1: Failing tests** in `nemesis.test.js` (using `npcRules.test.js`'s `meet` helper, exported from a shared `test/meet.js` beside it): "a nemesis on your tail for NPC.tail seconds baits an overshoot" (it slows under `0.6 × speed` and says `bait`); "it breaks off your nose when you fire" (`world.stims` with a `shot` from you aimed at it: its `to` moves off your nose within 0.5 s); "the fury outranks the duel" (hp under `NPC.fury`: no `orbit` pick for 3 s); "it does not fall back twice in a row" (cooldown); "an inspector's pull-over runs as before" (the existing inspector assertions pass unchanged); "a nemesis that loses you says search, and found when it has you".
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; `crews.test.js` passes with the new lines.
- [ ] **Step 5:** Commit: "The nemeses weigh their moves, bait and break; the law and the pirate run on a tree".

### Task 13: Packs as squads with tokens, beliefs and roles

**Files:** Modify `src/components/universe/hunterRules.js` (`createHunt`: a `createSquads` per pack is unnecessary, a pack *is* a squad: `confidence` from members' hp and the pack's losses each second; `createTokens({ pools: { run: slotsFor(n), tail: 1, holdoff: 2 } })` replaces `pack.attacking/slots`; a hunter without a `run` token picks with `utility.pick` among `{ wait (restation), flank (a station on your blind side: behind your nose by more than 100°), block (a station ahead of you at FIGHT.closeFrom) }`; `sense` per hunter with `blocked` as `seesThrough`, 2.5 s intuition; aim and `want` read the belief; a pack at `worried` or lower breaks off with `escaped { why: 'broke' }`); Modify `src/components/universe/wingRules.js` (target choice by `pick`: near you, on a run, unclaimed, the one that hit you last); Test `src/components/universe/hunterRules.test.js`, `wingRules.test.js`.

**Interfaces:**
- Consumes `squad.confidence/createTokens`, `perception.*`, `utility.pick`.
- Produces: `events` gain `{ type: 'escaped', faction, why: 'broke' | 'lost' }`, `{ type: 'flank', faction, id }` (once a flank); `hunt.tokens`.

- [ ] **Step 1: Failing tests** in `hunterRules.test.js`: "a pack cannot find a ship behind a planet for intuition seconds" (a solid between: no laser aimed within `SHIP_R × 4` of you for 2.5 s after you go behind it); "a pack with half its members lost breaks off" (`escaped.why === 'broke'`); "two hunters never hold the tail token at once"; "a hunter without a run token flanks or blocks, never idles" (its `want` is nonzero and its mode is not `run`); "the existing fights still end" (every existing test unchanged). In `wingRules.test.js`: "a wingman goes for the hunter that hit you last".
- [ ] **Steps 2–4.** **Step 5:** Commit: "The hunters hunt as a pack: tokens, flanks, a blocker, nerve, and eyes that a planet blinds".

### Task 14: The director's intensity, the nemesis's memory, the scene's voices

**Files:** Modify `src/components/universe/director.js` (`intensity` meter: `+ damage / 100 × 0.5` on `note('hurt', damage)`, `+0.15` on `note('kill')`, decays `0.08` a second; events wait while `intensity > 0.75` and for `relax = 20` seconds after it peaks; `foretell` accounts for it), `src/components/universe/npcRules.js` (`memory[id].last = { how, from }` written on `retreat`, `downed`, `draw` and `fled`; `createBrains.add` passes it), `src/components/universe/npcs/brains/nemesis.js` (opens from the other side of `last.from`), `src/components/universe/scene.js` (feeds `note`, passes `stims` for your shots, voices `search`/`found`/`bait`, says `broke` on the comms through the crews' existing `escaped` line with a `why`); Test `director.test.js`, `npcRules.test.js`.

- [ ] **Step 1: Failing tests**: "nothing new comes while intensity is high, then a relax" (`director.test.js`); "a nemesis comes in from the other side next time" (`npcRules.test.js`: `memory.vader.last.from === 'behind'` → its first `to` is ahead of you).
- [ ] **Steps 2–4.**
- [ ] **Step 5:** Smoke in Chromium: `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /` and a seeded fight through `window.__universeDebug.meetNpc('vader')` with the dev hook, watching the console for errors. Commit: "The director paces by intensity; a nemesis remembers how it went". Lint, test, build, health; push, PR, CI, merge; reset the branch.

---

## PR 4 — the galaxy's surface

### Task 15: Hostiles with beliefs and a search

**Files:** Modify `src/components/galaxy/surface/hostiles.js` (`sensesFor(hostile)`: `{ sight: { range: hostile.range × 1.3, cone: hostile.cone ?? 0.3, far: 1.6 }, hearing: { range: hostile.range } }`; `hostileStep(t, world, dt, r)` → `{ x, z, yaw, mode: 'hold' | 'strafe' | 'close' | 'back' | 'flank' | 'cover' | 'look' | 'search', fire: bool }` as a `utility.pick` with `spatial.pickPlace` over `candidates` for `flank` and `cover`); Modify `src/components/galaxy/surface/activity.js` (calls `hostileStep` in place of the inline chase/strafe; fires at `t.belief.at`; a `createSearch` per spawn group with spots from `props`' solids hidden from the last position; `combat` event gains `{ looking: true }` for the HUD's `?`); Test `src/components/galaxy/surface/hostiles.test.js`.

**Interfaces:**
- Consumes `perception.*`, `utility.*`, `spatial.*`, `search.createSearch`, `walker.sightClear` as `seesThrough`.
- Produces: `hostileStep` as above; `t.belief`.

- [ ] **Step 1: Failing tests**: "a trooper that loses you behind a wall goes to where you were, then looks"; "a trooper fires at its belief, not at you"; "a blaster trooper takes cover from your line of fire; a duellist stays in your view"; "the old strafe/chase spawns run as before" (`strafeStep` kept as a helper, the existing hostiles tests unchanged).
- [ ] **Steps 2–4.** **Step 5:** Commit: "The worlds' enemies see, lose you, search and pick their ground".

### Task 16: Squad tokens and posture on the surface

**Files:** Modify `src/components/galaxy/surface/activity.js` (`createTokens({ pools: { shot: 3, melee: 1 }, scale: tier })` per scene; a hostile without a `shot` token picks among the moving options only); Modify `src/components/galaxy/surface/missions/assault.js` (`createSquads({ reach: 24 })` over each side's up soldiers; `confidence` from hp, the side's losses and its posts' meters; `posture` per squad: `retreat` moves the nearest half to the side's next post with the rest covering, `press` sends `flankers` to the lane ends; the frontline's `buffer` keeps the sides apart; `atYouMax` becomes a `shot` token pool on you); Test `assault.test.js`.

- [ ] **Step 1: Failing tests**: "a losing squad falls back in halves" (one side at a quarter hp: half its soldiers move away along the front's `−dir` while the rest hold); "a winning squad flanks from the lane ends"; "the two armies never mix" (no soldier inside the other side's buffer for the whole seeded battle); "at most three fire at you at once" (unchanged assertion, now by tokens); "both sides can still win" (existing).
- [ ] **Steps 2–4.** **Step 5:** Smoke `/galaxy/hoth/surface?mission=assault` and `/galaxy/tatooine/surface`. Commit: "The Battlefront armies fight by squads: nerve, a frontline, halves that cover halves, flankers". Lint, test, build, health; push, PR, CI, merge; reset.

---

## PR 5 — the watchers, across seven worlds

### Task 17: Detection timer, suspicion, intuition and search in `watchers.js`

**Files:** Modify `src/components/middleearth/towns/watchers.js` (`newWatchers(rounds, { spots = null, grid = null } = {})`; each watcher gains `beliefs`, `senses` from `opts` (`sight` → range, `cone`, `far: opts.far ?? 2`, `hear` → hearing range on a `running` stim, `smell` → smell range, `ringSight` → an all-round sight while `world.ring`); modes gain `suspicious` (confidence ≥ `opts.suspicious ?? 0.5`: walk to look at the belief, `look` seconds, back) and `search` (after `chase` loses you: `createSearch` shared across the watchers, aggressive, spots from `opts.spots ?? rounds`' corners, `flood` on `grid` when given; `opts.search ?? opts.giveUp × 2` seconds); `chase` steers at the belief with intuition and coast; events gain `{ type: 'suspicious', id }`, `{ type: 'searching', id }`); Test `src/components/middleearth/towns/watchers.test.js`.

**Interfaces:**
- Consumes `perception.*`, `search.createSearch/flood`, `walker.sightClear` as `seesThrough`.
- Produces: `w.mode ∈ patrol | suspicious | alert | chase | search | back | caught`; `opts.suspicious`, `opts.search`, `opts.far` optional.

- [ ] **Step 1: Failing tests**: "an old option table runs as before" (`NAZGUL` as today: patrol, `seen` within `alert × 2 + 2` s of standing in the cone at half range, chase, caught; `lost` when out of reach); "far off in the cone it takes longer to be seen than up close"; "half seen, it walks over to look and goes back"; "lost round a corner, it goes to where you were, then searches the corners, then goes back"; "two watchers split the search" (no two claim the same spot); "the Ring shows you through anything" (unchanged).
- [ ] **Steps 2–4.** **Step 5:** Commit: "The watchers take time to see you, come to look, hold your trail a moment, and search together".

### Task 18: The worlds' tables and lines

**Files:** Modify `src/components/middleearth/towns/bree/story.js` (`NAZGUL` gains `suspicious: 0.45, search: 14, far: 2.5`), `src/components/middleearth/towns/bree/BreeWorld.jsx` (voices `suspicious` and `searching`: one line each in the existing `say` style; `watchers: newWatchers(ROUNDS, { grid: LANES_GRID })` where Bree's `scene.js` can give a walkable grid cheaply, else no grid), `src/components/middleearth/shire/rules.js` (`HUNT`), `amonhen/rules.js` (`BOROMIR`, `URUKS`), `moria/rules.js` (`TROLL`), `cirithungol/rules.js`, `marshes/rules.js`, `src/components/rickmorty/citadel/CitadelWorld.jsx` (the guards): each table tuned (a troll is slow to suspect, Shelob searches by smell), each world voicing the two new events where it voices `seen`; Test: each world's existing `rules.test.js` unchanged.

- [ ] **Step 1:** Tables and lines. **Step 2:** `npm test` green. **Step 3:** Smoke each route (`/middleearth/bree`, `/middleearth/shire`, `/middleearth/amonhen`, `/middleearth/moria`, `/middleearth/cirithungol`, `/middleearth/marshes`, `/rickmorty/citadel`: confirm the exact routes with `grep -n "path=" src/main.jsx`) with `autopilot-check.mjs --only smoke`; in dev, walk into a Nazgûl's cone at Bree and watch the `?` and the search through `window.__BREE__` or the world's dev hook.
- [ ] **Step 4:** Commit: "Seven worlds' watchers suspect, search and speak of it". Lint, test, build, health; push, PR, CI, merge; reset.

### Task 19: The handoff

**Files:** Create `docs/superpowers/HANDOFF-npc-intelligence.md` (what's on the toolkit, what each PR did, what the spec's section 5 leaves: Bob-omb Ridge, Cybertron, Invincible, the Citadel's crowd, surface advertisements; the checks to run); Modify `docs/architecture.md` (the NPC paragraphs name the toolkit); Modify `README.md` only if a visitor-facing line describes the NPCs (grep `hunters`).

- [ ] **Step 1:** Write them. **Step 2:** Commit: "Handoff for the NPC intelligence work". Push with PR 5 (or its own PR if PR 5 has merged).
