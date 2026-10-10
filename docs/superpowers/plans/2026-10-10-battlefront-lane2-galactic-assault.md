# Battlefront lane 2: Galactic Assault. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoth's Galactic Assault plays end to end in the headless sim: the walkers' advance, the shield generator, the hangars and the transports as the stage file orders them, with tickets, capture meters, arm-and-destroy countdowns, an escort objective, team spawning by stage, Battle Points earned and spent on reinforcements, and a commander that plays both teams' bots to the objectives; and both sides can win.

**Architecture:** `modes/galacticAssault.js` is a pure state machine over the stage file and the sim's events; `spawn.js` chooses where a team deploys from the stage's spawn sets, the map's points and polygons and the game's squad-spawn rule; `battlePoints.js` keeps each entity's balance from the earn table and the deploy screen's view; `ai/commander.js` assigns squads to objectives and spends the bots' points; `eor.js` makes the end card. The sim gains a `mode` slot that receives events and returns objectives, spawn sets and win state.

**Tech Stack:** lane 1's `sim.js`, `nav.js`, `soldier.js`, `ai/*`; lane 0's `rulebook.js` (`stagesOf`, `mapOf`, `pointsOf`, `teamsFor`); Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-game-design.md` (catalogue sections 4, 6, 7; decision 3; section 9; open assumptions 1 and 3).

## Global Constraints

- Lane 1's constraints hold (pure, seeded, `STEP 0.05`, numbers from the rulebook).
- The game's rules that the data holds as graphs are constants with a comment naming the asset: capture thirds `0.33`, `0.66` (`PF_CapturePoint`), overtime while contested (`PF_CapturePoint_Overtime_Function`), `CAPTURE_SECONDS = 60` for one attacker alone to take a point from 0 to 1 (the `60` in `PF_CapturePoint`'s cast), `ARM_SECONDS = 6`, `FUSE_SECONDS = 30`, `DEFUSE_SECONDS = 6` (`SW02_VO_BombInteract`'s shape; hand), `STAGE_PAUSE = 6` s between stages and `STAGE_SETUP = 12` s before the first (`PF_GameMode_Conquest_Staged`'s `6.0` and `12.0` delays), `OOB_SECONDS = 10`, `SPAWN_PROTECTION = 3`, `WAVE = 10` s for bots.
- Battle Points from `points.json` only.
- Files under 800 lines; tests beside files; the full arena under `test:ai` may take up to 120 s.
- Copy, commits, gates as lane 1.

## Review Focus

1. **A stage with two capture points and the attackers take one while the defenders retake the other**: the stage does not advance until both are held at once; a retaken point drops back toward the defenders at the same rate. Task 1's `two points, one retaken`.
2. **An attacker alone inside a point with a defender also inside**: contested, the meter holds and overtime runs; when the defender dies the meter moves again. Task 1's `contested holds`.
3. **Tickets reach 0 while attackers are still alive**: no respawn for attackers; the stage is lost when the last attacker dies, not at 0 tickets. Task 1's `last life`.
4. **A spawn set whose every point is within 30 m of an enemy**: `spawn.js` falls back to the polygon's point furthest from enemies, never returns `null` for a living team. Task 2's `no safe point still spawns`.
5. **A bot with enough points for a hero when one is already out**: the commander buys a reinforcement instead; two heroes never stand for one team. Task 4's `one hero at a time`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `modes/galacticAssault.js` (+ test) | `createAssault`, `onEvent`, `tick`, `objectives`, `spawnSets`, `result`, `view` |
| `modes/objectives.js` (+ test) | `capture`, `arm`, `escort`, `hold`: each `{ create, tick, onEvent, view }` |
| `spawn.js` (+ test) | `pickSpawn`, `squadSpawn`, `protect`, `waves` |
| `battlePoints.js` (+ test) | `createPoints`, `earn`, `canBuy`, `buy`, `balance`, `offers` |
| `ai/commander.js` (+ test) | `createCommander`, `assign`, `spend`, `wave` |
| `eor.js` (+ test) | `endCard` |
| `sim.js` | gains `mode`, `deploy(sim, id, choice)`, `respawn`, the dying→down→deploy flow, OOB |
| `arena.test.js` | gains the full Galactic Assault run |
| `scripts/battlefront-balance.mjs` | gains `--assault` |

---

### Task 1: The mode and its objectives

**Files:**
- Create: `modes/objectives.js`, `modes/objectives.test.js`, `modes/galacticAssault.js`, `modes/galacticAssault.test.js`

**Interfaces:**
- Consumes: `stagesOf(rb, 'hoth', 'galacticAssault')`, `mapOf(rb, 'hoth')` (`volumes` by id, `waypoints` by id), sim events (`hit`, `down`, `enter`/`leave` of a volume, `interact`).
- Produces:
  - `objectives.js`: `capture.create({ volume, teams }) → o` with `o.meter` (−1 defenders' to +1 attackers'), `o.owner`, `o.contested`; `capture.tick(o, dt, { inside: { attack: n, defend: n } })` moves the meter by `(advantage / CAPTURE_SECONDS) × dt` toward the side with more inside (advantage capped at `ADVANTAGE_MAX = 4`), holds when equal and both present (`contested`, overtime), decays nothing when empty; `o.done` when the meter reaches +1. `arm.create({ volume })`: `tick` with `inside` and `interactions` (`{ team, id, held: boolean }`): an attacker holding `interact` for `ARM_SECONDS` arms it (`o.armed`, `fuse = FUSE_SECONDS`); a defender holding for `DEFUSE_SECONDS` disarms; the fuse runs to 0 then `o.done`. `escort.create({ waypoints, count, health })`: `tick` with `{ walkers: [{ at, hp, disabled }] }` from lane 4's vehicles or, until then, the sim's `escortProxy` entities (a walker is an entity of kind `'walker'` with `hp` `health` that moves along the waypoints at `WALKER_SPEED = 2.5` m/s while any attacker is within 60 m and not `disabled`, and is damaged by bolts and lane 2's `ion` interaction); `o.done` when a walker reaches the last point; `o.failed` when all walkers are at 0 hp. `hold.create({ volume, seconds })`: `done` when attackers have held it `seconds`.
  - `galacticAssault.js`: `createAssault({ rulebook, stages, map, teams, attackers: 'dark' | 'light', seed }) → ga` with `ga.stage` (index), `ga.phase` (`'setup' | 'live' | 'pause' | 'over'`), `ga.tickets` (`ticketsStart`, attackers only), `ga.objectives` (the live stage's), `ga.result` (`null | { winner: team, why: 'tickets' | 'wiped' | 'objectives' | 'timer', stage }`); `tick(ga, dt, world)` (world gives `inside` per volume, `interactions`, `walkers`, `alive` per team); `onEvent(ga, e)` (`down` of an attacker costs 1 ticket when respawn is allowed; `down` of a defender nothing); `spawnSets(ga) → { attack: ids, defend: ids }` for the stage; `canRespawn(ga, team) → boolean` (attackers only while `tickets > 0`); `view(ga) → { stage: { id, name, nameDefend, index, count }, objectives: [{ type, name, meter, owner, contested, armed, fuse, progress }], tickets, phase, timer }`. On a stage's objectives all done: `phase 'pause'` for `STAGE_PAUSE`, tickets `+= ticketsTopUp[next]`, next stage, or `result` when it was the last. Defenders win on `tickets === 0 && alive.attack === 0` (`'wiped'`) or on the escort's `failed` (`'objectives'`), or when `stageTimer > 0` runs out (`'timer'`).

- [ ] **Step 1: Failing tests**: `capture` with 2 attackers inside reaches +1 after `60 / 2` s from 0 (`CAPTURE_SECONDS / advantage`); `contested holds` (1 and 1 inside: meter unchanged over 10 s, `contested true`, then the defender gone: it moves); `two points, one retaken` (stage of two captures; A done, B retaken to −0.2: stage index unchanged; B done: index advances after `STAGE_PAUSE`); `arm` armed after 6 s of a held interaction, defused by a defender in 6 s, else `done` 30 s after arming; `escort` walker moves only with an attacker near, `failed` at 0 hp; `last life` (tickets 0, two attackers alive: `result null`; both down: `result.why 'wiped'`); the whole Hoth stage file runs through four stages when every objective is forced done (a test helper `force(ga)`), with the ticket top-ups applied (300 → 360 → 420 → 480 less deaths).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Galactic Assault as a state machine over the stage file, with the four objective kinds`.

### Task 2: Spawning

**Files:**
- Create: `spawn.js`, `spawn.test.js`
- Modify: `sim.js` (down → deploy → respawn; OOB)

**Interfaces:**
- Consumes: `spawnsFor(map, { ids })`, polygons by id, `ga.spawnSets`, `ga.canRespawn`, entities.
- Produces: `pickSpawn({ map, ids, team, enemies: [[x, z]], rand }) → { at, yaw } | null`: enabled spawn points in `ids` by `priority` (highest first), those `>= SAFE = 30` m from every enemy preferred, `rand` among the best; when none is safe, the point in the set's polygons furthest from the nearest enemy (`no safe point still spawns`); `squadSpawn({ squad, me, enemies }) → { at, yaw } | null` (a living squadmate not within `SAFE` of an enemy and not `suppressed`: a point 1.5 m behind them); `protect(entity, now)` sets `entity.safeUntil = now + SPAWN_PROTECTION` (bolts skip a protected body; firing ends it); `waves(team, now) → nextWaveAt` (bots respawn together every `WAVE` s). In `sim.js`: a `down` entity is removed after `TimeForCorpse`; a bot or player with `canRespawn` enters `deploying` and `deploy(sim, id, { classId | reinforcementId | heroId, spawn: 'point' | 'squad', slot })` places it with `protect`; a player's `deploy` is an input, a bot's the commander's (Task 4). OOB: an entity outside its team's `oob` volumes for `OOB_SECONDS` dies (`why 'oob'`), with `view.oob = seconds left`.

- [ ] **Step 1: Failing tests**: `pickSpawn` with an enemy 10 m from the only high-priority point picks a lower-priority safe one; `no safe point still spawns` (enemies within 30 m of every point: a polygon point is returned, non-null); `squadSpawn` behind a safe mate, `null` when all mates are in contact; a protected body is skipped by `bolts.step` and loses protection on `fire`; a bot down at `t` is deploying by `t + 4.5` and back by the next wave; an entity 12 s outside OOB is `down` with `why 'oob'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; lane 1's arena still green (`mode null` keeps the old respawn-less behaviour).
- [ ] **Step 5: Commit** `Spawning by stage, squad spawn, spawn protection, waves and out of bounds`.

### Task 3: Battle Points and the deploy offers

**Files:**
- Create: `battlePoints.js`, `battlePoints.test.js`
- Modify: `sim.js` (`earn` on events; `deploy` checks `canBuy`)

**Interfaces:**
- Consumes: `pointsOf(rb)` (`earn`, `cost`, `limits`, `bpRate`), `teamsFor(rb, level)` (`reinforcements`, `heroes`, `vehicles`), `reinforcementOf`, `heroOf`.
- Produces: `createPoints({ points, teams, bpRate = 1 }) → bp`; `earn(bp, id, event)` (`kill` 100, `assist` 50 to everyone who hurt the target within `ASSIST_WINDOW = 8` s, `objectiveTick` 10 a second inside a moving meter, `objectiveDamage` per hp on an escort, `vehicleKill`, `heroKill`, `squadSpawn` to the mate spawned on; all `× bpRate`); `balance(bp, id)`; `offers(bp, id, team, { out: { heroes: n, reinforcements: n } }) → [{ kind: 'class' | 'reinforcement' | 'hero' | 'vehicle', id, cost, affordable, available, why? }]` (a hero `available` only when `out.heroes < limits.heroesPerTeam`, a reinforcement when `out.reinforcements < limits.reinforcementsPerTeam`); `canBuy(bp, id, offer) → boolean`; `buy(bp, id, offer)` debits. `sim.deploy` refuses an unaffordable or unavailable choice with `{ ok: false, why }`.

- [ ] **Step 1: Failing tests**: a kill credits 100 and an assist 50 to a second shooter who hit within 8 s; 10 s inside a moving meter credits 100; `offers` with 4000 shows the hero `affordable true`, with 3999 `false`; `one hero at a time` (out.heroes 1: `available false`, `why 'limit'`); `buy` debits and a second `buy` of the same hero is refused.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Battle Points earned by the table and spent at the deploy screen`.

### Task 4: The commander

**Files:**
- Create: `ai/commander.js`, `ai/commander.test.js`
- Modify: `ai/soldierBrain.js` (an `objective` goal: go to and stay inside a volume; `interact` with an arm objective), `sim.js` (bots deploy through the commander)

**Interfaces:**
- Consumes: `ga.objectives`, `ga.spawnSets`, `squads`, `battlePoints`, `aiOf(rb).instantAction` (`EnemyHeroCount`, `EnemyReinforcementCount`, `EnemyVehicleCount` as the caps the commander spends toward), `points.limits`.
- Produces: `createCommander({ team, side: 'attack' | 'defend', ga, squads, bp, rand }) → c`; `assign(c, world) → Map<squadId, { objective, role: 'take' | 'hold' | 'counter' | 'escort' }>` every `ASSIGN = 5` s: attackers split squads across live objectives by weight (an undone capture 1, an unarmed arm 1.2, an armed one 0.3 to guard, the escort 1 for one squad), defenders hold the most threatened (most attackers inside or nearest) with one squad per objective and the rest `counter` toward the nearest attacker cluster; a squad's `objective` becomes each member's brain `objective` goal; an attacker at an arm objective sets `interact` when inside and no enemy is believed within 10 m; a defender at an armed one likewise to defuse. `spend(c, world)` at each bot's deploy: buy a hero when `balance >= cost` and `out.heroes < min(limits, instantAction.EnemyHeroCount)`, else a reinforcement by the same test, else a class chosen round-robin with at most one officer and one specialist a squad; a hero bot is a lane 3 brain (until lane 3, a hero deploys as its class row with `heroBrain = null` and the soldier brain). `wave(c, now)`: bots deploy on the team's wave.

- [ ] **Step 1: Failing tests**: with two live captures and three squads, two squads `take` one each and the third the one with fewer attackers; defenders with one attacker cluster at point A `hold` A with one squad and `counter` with the rest; `one hero at a time` (balance 9000, `out.heroes 1`: `spend` buys a reinforcement, not a hero); an attacker brain inside an arm volume with no enemy near sets `interact true`; the round-robin never gives a squad two officers.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A commander that plays the objectives and spends the bots' points`.

### Task 5: The end card, the full arena and the balance table

**Files:**
- Create: `eor.js`, `eor.test.js`
- Modify: `arena.test.js`, `scripts/battlefront-balance.mjs`, `sim.js` (`view` gains `mode`, `deploy`, `oob`, `points`)

**Interfaces:**
- Produces: `endCard(sim, ga) → { winner, why, stage, duration, teams: { 1: { kills, deaths, captures, arms, points }, 2 }, best: [{ id, kills, points, cls }], mvp }`; `sim.view()` gains `mode: ga.view()`, `deploy: { open, offers, team, timeLeft }` for the player, `points: balance`, `oob`. The arena's full run: `createSim` with `mode: 'galacticAssault'`, 20 bots a side, `hothFlatNav`, seed 1, stepped until `result` or 25 minutes: asserts `result` non-null, `stage >= 1` reached (the walkers got somewhere), and across 20 seeds attackers win between 8 and 12 times (40 to 60 percent; `AIM_SCALE`, `CAPTURE_SECONDS`'s advantage cap, `ticketsStart` and the commander's weights are the levers, in that order, each change recorded in `docs/superpowers/evidence/battlefront-lane2/balance.md`), median duration between 8 and 18 minutes, two runs with one seed equal, wall time for one run under 90 s. `scripts/battlefront-balance.mjs --assault --runs 20` prints `seed, winner, why, stage, minutes, kills1, kills2, heroes1, heroes2, ms`.

- [ ] **Step 1: Write the arena run; run** `npm run test:ai -- src/lib/battlefront` → tune by the levers until the assertions pass as written; keep the evidence file honest about every change.
- [ ] **Step 2: Write `endCard` and its test** (a finished sim gives a winner and an mvp with the most points). Run → PASS.
- [ ] **Step 3: Docs**: `HANDOFF-battlefront.md` lane 2 done with the table; the spec's "Departures" gains a line for any constant that moved.
- [ ] **Step 4: Commit** `Galactic Assault plays out on Hoth with nobody at the keyboard`; lint, test, test:ai, build, health; PR titled `Battlefront lane 2: Galactic Assault in the sim`.
