# Endor speeder bike chase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Endor's mission, *The Speeder Bike Chase*, playable at `/galaxy/endor/surface?mission=chase`.

**Architecture:** Pure, tested rules (`missions/chase.js`) decide the route, the scouts and the result; a drawing module (`missions/chaseScene.js`) shows them; the surface scene gains a mission mode (start on the bike, fire while riding, the mission's crash rule) and the page a HUD and a result card.

**Tech Stack:** React 19, three.js, Vitest. **Spec:** `docs/superpowers/specs/2026-10-05-endor-chase-design.md`

## Global Constraints

- No sequel-trilogy content; lines are the site's own words (short famous lines only).
- Rules pure and tested; drawing apart. New pure logic gets its test first.
- Scene starts from `lib/device`'s tier, is disposed on leave; nothing new downloaded (the bike and the scout are already placer's and figures.js's).
- British spelling, curly quotes in copy, comments say why.

## Review Focus

1. A waypoint inside a trunk: the planned route is still clear of every solid (Task 1 test).
2. A long frame (a tab back from the background): `stepChase` with `dt` 1 s substeps, so no scout jumps a trunk or overshoots the bunker unseen (Task 2 test).
3. You overtake the scouts: they keep going (they sprint, never stop) (Task 2 test).
4. Shooting a scout that's already down: no second `down` (Task 2 test).
5. Again after a result: a fresh chase shares nothing with the last (Task 2 test).

---

### Task 1: The route

**Files:** Create `src/components/galaxy/surface/missions/chase.js`, `src/components/galaxy/surface/missions/chase.test.js`

**Interfaces:**
- Consumes: `pushOut(solid, x, z, r)` and `createSolids()` from `../walker`.
- Produces: `planRoute(waypoints: [x, z][], solids, { step = 4, margin = 2.6, smooth = 3 }) → { pts: [x, z][], len: number, at(s) → { x, z, tx, tz }, project(x, z) → s }`.

- [ ] Test `planRoute`: (a) straight two-point route, no solids: `len` ≈ distance, `at(len / 2)` is the midpoint, tangent unit length; (b) a circle solid r 2 on the midpoint of a waypoint pair: every `pts` sample is ≥ 2 + 2.6 − 0.05 from its centre; (c) `project` of a point beside the route returns its `s` within one step.
- [ ] Implement: sample each segment every `step`; push each sample out of every `solids.near(x, z, r)` with `pushOut(sol, x, z, margin)` (three passes); `smooth` passes of neighbour averaging keeping the ends fixed, re-pushing after each; cumulative lengths for `at` (linear between samples) and `project` (nearest sample).
- [ ] `npx vitest run src/components/galaxy/surface/missions/chase.test.js` passes.

### Task 2: The scouts and the result

**Files:** Modify `missions/chase.js`, `missions/chase.test.js`

**Interfaces:**
- Produces:
  - `newChase(mission, route) → chase` (`{ t, phase: 'count' | 'run' | 'won' | 'lost', count, stall, scouts: [{ id, s, lane, off, vOff, speed, hp, down, how, fireIn }] }`)
  - `stepChase(chase, dt, { you: { x, z, vx, vz }, solids }) → events[]`: `{ type: 'count', n }`, `{ type: 'go' }`, `{ type: 'down', id, how: 'shot' | 'tree' }`, `{ type: 'bump', id, push: [x, z] }`, `{ type: 'shoot', id }`, `{ type: 'escaped', id }`, `{ type: 'won' }`, `{ type: 'lost' }`
  - `hitScout(chase, id) → events[]`, `knockYou(chase)` (sets `stall` 1.6 s), `scoutAt(chase, i) → { x, z, yaw, s }` (the chase keeps its route), `aimAssist(from, dir, targets, { cone = 0.12, range = 90 }) → [dx, dy, dz] | null`, `starsFor(mission, t) → 0..3`, `chaseView(chase) → { phase, count, t, left, total, lead }`
- Values: count 3 s; scouts move by `s += speed * k * dt` (k 0.85 when the scout is > 140 m ahead of you along the route, 1.12 when < 25 m, else 1); lane spring `vOff += (−(off − lane)·6 − vOff·4)·dt`; down by tree when its r 0.8 circle meets a solid at speed > 12; bump when you're within 1.7 m: `vOff += side·max(9, |lateral relative speed|·1.5)`, your push the opposite; a hit takes 1 hp and kicks `vOff` ±4 (alternating); shoot when you're 4–55 m behind it, every 2.4 s (first after 1.5 + 0.6·i s); escaped at `s ≥ len`; dt split into ≤ 0.05 s steps.

- [ ] Tests: count then go; scouts advance and the leader escapes → `escaped` then `lost`; shove into a tree → `down` how `tree`; three hits → one `down` how `shot`, a fourth hit nothing; all down → `won` once; overtaken scouts keep advancing; `stepChase(dt 1)` ≈ twenty 0.05 steps (no NaN); two `newChase` are independent; `aimAssist` picks the nearer-angled target inside the cone, null outside it; `starsFor` thresholds `[45, 60]` → 3, 2, 1.
- [ ] Implement; tests pass.
- [ ] Commit (rules).

### Task 3: The mission's data

**Files:** Create `missions/index.js`; extend `missions/chase.test.js`

**Interfaces:** Produces `MISSIONS.endor.chase` (`{ id, system, name, kind: 'chase', start: [x, z], yaw, waypoints, scouts: 4, gaps: [34, 48, 62, 76], lanes: [-1.3, 1.1, -0.4, 0.8], speeds: [31, 32.5, 30, 33.5], hp: 3, stars: [45, 60], achievement: 'speederchase', lines }`) and `missionOf(system, id)`.

- Waypoints: `[60, 250] → [-40, 330] → [-210, 250] → [-300, 70] → [-220, -120] → [-40, -230] → [120, -170] → [236, -28]` (the scouts' camp to the bunker's door, about 1.25 km).
- [ ] Test: lengths of gaps, lanes and speeds equal `scouts`; every system with a mission has a surface site; `missionOf('endor', 'chase')` returns it, unknown ids null.

### Task 4: The drawing and the scene's mission mode

**Files:** Create `missions/chaseScene.js`; modify `surface/scene.js`

**Interfaces:** `createChaseScene({ parent, placer, world, mission, route }) → { update(dt, chase, t), targets: [{ x, y, z, r, id }], boom(id), dispose() }`. Scene: `ctx.mission` (an id); emits `{ type: 'mission', view, event? }`; DEV `missionDo('win' | 'lose')`; `input.restart()`.

- [ ] With `ctx.mission`: no landing; you on a speeder bike at `mission.start` facing `yaw`; the scouts at their gaps.
- [ ] Fire while riding in a chase (from the bike's nose, `aimAssist` over the scouts' targets), hits through `hitScout`.
- [ ] `ride()`'s hit > 20, or health to 0, → `knockYou` (stall: no throttle, a shake), never the respawn.
- [ ] Scouts' shots through `blaster.enemy`; `bump` pushes your bike.
- [ ] Browser: the chase runs; DEV `missionDo('win')` and `('lose')` reach the result.

### Task 5: The page, the briefing and the achievement

**Files:** Create `surface/ChaseHud.jsx`; modify `pages/GalaxySurface.jsx`, `galaxy/systems.js`, `components/Achievements.jsx`, `surface/surface.css`

- [ ] HUD: the count, scouts left (four marks), the leading scout's way to the bunker (a bar), the clock; result card: won (time, stars, best, kept as `tp-galaxy-missions`) or lost; **Again** (`input.restart()`), **Back to the system** (`/galaxy/endor`).
- [ ] `systems.js` Endor: `status: 'live'`, `to: '/galaxy/endor/surface?mission=chase'`; `speederchase` achievement; the lines.
- [ ] Gate: `node scripts/autopilot-check.mjs --routes /galaxy/endor/surface?mission=chase,/galaxy/endor/mission`; screenshots read; PR; CI; merge.
