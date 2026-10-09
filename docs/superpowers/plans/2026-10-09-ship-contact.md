# Ship contact: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the universe map and in the galaxy, flying your ship into any other ship glances, rams or crashes, scaled to the closing speed and the other ship's size, with the other ship taking the hit the way a shot would give it.

**Architecture:** One pure law in `src/lib/combat/contact.js` (shared by both maps, tested in Node). One collector, `src/components/universe/shipHits.js`, that sweeps your ship's way each frame against plain `bodies` every ship system answers from what it already keeps. Big ships become `solids` the two scenes hand `ship.js`'s `step`, so the planet's bump and crash rule plays against them unchanged. Each scene gains under 60 additive lines beside its rock sweep.

**Tech Stack:** three.js 0.186 (only in files that already import it), Vitest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-09-ship-contact-design.md`. Read it first: it says what exists today (with line numbers), what is out of scope, and the numbers.

## Global Constraints

- The layers of `docs/health/RULES.md`: `src/lib` imports no world and no React; `universe/shipHits.js` reads plain objects only (no `three`); the galaxy imports from `universe/` only what it already does plus `shipHits.js` and the lib.
- No file grows past 800 lines that is under it today; `universe/scene.js` and `galaxy/scene.js` (over the ceiling already) gain additive lines only, never a reformatted one. `big-files` in `docs/health/budgets.json` stays 30; `boundary-breaks` gains no new pair of folders.
- Every rule is in a pure file with a test beside it (`x.js` has `x.test.js`); a test runs under a second and touches no network.
- Every number of the law lives in `CONTACT` in `src/lib/combat/contact.js`; a scene reads it, never copies it.
- What a kill does (the pop, the fire, the `kill` event, `heat`, `killed`, `deed`, `pay`, `scored`) is never written a second time: a ram's `down` goes through the scene's existing kill handling.
- British spelling, curly quotes, sentence case in any text a visitor reads (`state.note`).
- Before every commit: `npm run lint`, `npm test` (the files touched at least; all of it before the last), `npm run build` and `node scripts/health.mjs --check --skip build` before the final push.
- One branch, `claude/dazzling-meitner-ltnrn5`; commit after each task; push at the end of each phase.

## Review Focus

1. A long frame (a hidden tab coming back, dt of seconds): `step` clamps dt to 0.05 but the before and after positions can be far apart; the sweep must use the positions, never dt alone, so a body in the middle of the way is found and `into` is bounded (Task 2 pins a 40-unit way; `closingSpeed` is from velocities, never from distance ÷ dt).
2. A hunter with the `rammer` trait already bursts on you (`hunterRules.js:1112-1116`); if it were also a body you would be hurt twice for one contact (Task 3's hunters test pins its absence).
3. Just back from a crash (`state.clock < state.safeUntil`), a ram must push and bump but never hurt, else the arrival point beside a destroyer loops you into death (Task 5 wires `hurt` behind the guard the rocks use; the dev hook check in Task 7 flies the arrival).
4. The galaxy's battle capital hulls are already solids (`warfront.js`'s `hulls()`): they must not also be bodies, or a crash into one would also count a ram (Task 3's warfront bodies are fighters only; Task 4 adds no galaxy hull solid twice).
5. A pilot online whose ship is parked on a planet (`sh.parked`, their crew on foot) or not `shown` is not there to hit, and a ram on a pilot's ship must tell the network nothing (Task 3's pilots test pins both).

---

# Phase 1: the law and the collector

### Task 1: The contact law

**Files:**
- Create: `src/lib/combat/contact.js`, `src/lib/combat/contact.test.js`
- Modify: `src/components/universe/targeting.js:255-268` (`sweptHit` becomes a re-export of the lib's `sweptSpheres`)

**Interfaces (produces):**
```
export const CONTACT = { soft: 1.3, crash: 2.4, base: 6, perSize: 7, perSpeed: 0.5, most: 45, cool: 0.35, slow: 0.3, glance: 0.85, punchEvery: 5, punchMost: 4 };
export const bodyRadius = (size) => size * 0.5 + 0.08;
export function sweptSpheres(a0, a1, b0, b1, r) → number | null   // points as { x, y, z } or [x, y, z]; the maths of targeting.js's sweptHit, verbatim
export function closingSpeed(vYou, vThem, normal) → number         // max(0, (vThem − vYou) · normal) with normal from them toward you… see Step 3
export function contact(into, size) → { kind: 'glance' | 'ram', damage, punch, keep }
```

- [ ] **Step 1: Write the failing tests** in `src/lib/combat/contact.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { CONTACT, bodyRadius, closingSpeed, contact, sweptSpheres } from './contact';

describe('contact', () => {
  it('is a glance under soft and a ram from it', () => {
    expect(contact(1.29, 0.3)).toEqual({ kind: 'glance', damage: 0, punch: 0, keep: CONTACT.glance });
    const r = contact(1.31, 0.3);
    expect(r.kind).toBe('ram');
    expect(r.keep).toBe(CONTACT.slow);
  });
  it('hurts by the other ship’s size and the closing speed, capped', () => {
    expect(contact(14, 0.3).damage).toBeCloseTo(6 + 2.1 + 0.5 * (14 - 1.3), 5);
    expect(contact(12, 0.7).damage).toBeCloseTo(6 + 4.9 + 0.5 * (12 - 1.3), 5);
    expect(contact(300, 2).damage).toBe(CONTACT.most);
  });
  it('is worth one hit on the other ship, one more every punchEvery past soft, at most punchMost', () => {
    expect(contact(1.3, 0.3).punch).toBe(1);
    expect(contact(6.3, 0.3).punch).toBe(2);
    expect(contact(14, 0.3).punch).toBe(3);
    expect(contact(30, 0.3).punch).toBe(CONTACT.punchMost);
  });
  it('bodyRadius is tighter than a laser’s hit radius', () => {
    expect(bodyRadius(0.3)).toBeCloseTo(0.23, 5);
  });
});

describe('closingSpeed', () => {
  it('is how fast the two close along the normal, and 0 when they part', () => {
    // normal points from them toward you; you fly at them (−x) at 6, they at you (+x) at 8
    expect(closingSpeed({ x: -6, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(14, 5);
    expect(closingSpeed({ x: 6, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(0);
  });
});

describe('sweptSpheres', () => {
  // targeting.test.js's sweptHit cases, in both point forms
  it('meets a target crossing the way, in arrays and in objects', () => {
    expect(sweptSpheres([0, 0, 0], [0, 0, -1], [-0.5, 0, -0.5], [0.5, 0, -0.5], 0.3)).not.toBeNull();
    expect(sweptSpheres({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: -0.5, y: 0, z: -0.5 }, { x: 0.5, y: 0, z: -0.5 }, 0.3)).not.toBeNull();
  });
  it('misses one that leaves before the way reaches it', () => {
    expect(sweptSpheres([0, 0, 0], [0, 0, -1], [0, 0, -0.4], [0, 2, -0.4], 0.3)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**: `npx vitest run src/lib/combat/contact.test.js`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/combat/contact.js`** with a header comment in the house voice (what it is, the signatures, "Pure: no three.js"). `sweptSpheres` is `targeting.js:255-268` moved down, with the `X`/`Y`/`Z` accessors (`(p) => p.x ?? p[0]`, etc.) copied with it. `closingSpeed(vYou, vThem, normal)` = `Math.max(0, (vThem.x - vYou.x) * normal.x + (vThem.y - vYou.y) * normal.y + (vThem.z - vYou.z) * normal.z)` where `normal` points from them toward you (the collector supplies it). `contact(into, size)`: under `CONTACT.soft` the glance; else `damage = Math.min(CONTACT.most, CONTACT.base + CONTACT.perSize * size + CONTACT.perSpeed * (into - CONTACT.soft))`, `punch = Math.min(CONTACT.punchMost, 1 + Math.floor((into - CONTACT.soft) / CONTACT.punchEvery))`, `keep = CONTACT.slow`.

- [ ] **Step 4: Make `targeting.js`'s `sweptHit` the lib's**: replace the body at `targeting.js:255-268` with `export { sweptSpheres as sweptHit } from '../../lib/combat/contact';` keeping the comment above it (add one line: "now lib/combat/contact.js's sweptSpheres"). Remove the now-unused `X`, `Y`, `Z` helpers only if nothing else in the file uses them (check with grep; if used, leave them).

- [ ] **Step 5: Run the tests**: `npx vitest run src/lib/combat/contact.test.js src/components/universe/targeting.test.js src/components/universe/hunterRules.test.js src/components/universe/online` and `npm run lint`. Expected: PASS, clean.

- [ ] **Step 6: Commit**: `git add src/lib/combat/contact.js src/lib/combat/contact.test.js src/components/universe/targeting.js && git commit -m "Add the ship contact law and share the swept-sphere test"`.

### Task 2: The collector

**Files:**
- Create: `src/components/universe/shipHits.js`, `src/components/universe/shipHits.test.js`

**Interfaces:**
- Consumes: `CONTACT`, `bodyRadius`, `closingSpeed`, `contact`, `sweptSpheres` from `../../lib/combat/contact`; `SHIP.radius` and `shipVelocity` from `./ship` and `./hunterRules` (both pure).
- Produces:
```
createShipHits({ sources = [], cool = CONTACT.cool, radius = SHIP.radius }) → { sweep(before, after, dt, now) → hit | null, sources }
body: { key, id, kind, at, prev?, vel?, size, r?, side, hit(punch) → { down, at, size, kind, civil? } | null }
hit: { body, k, at: { x, y, z }, normal: { x, y, z }, into, outcome }
```
`before` and `after` are ship states (`{ x, y, z, heading, pitch, speed, vy }`, ship.js's); `sources` is an array of `() => body[] | null`; a source may be `null` (reduced motion makes no hunters).

- [ ] **Step 1: Write the failing tests** in `shipHits.test.js` with two fake sources (plain arrays). Pin: (a) the earliest body along the way wins when two are on it; (b) a body further than `reach` from `after` is never swept (a `hit` spy on it is not called and it is not answered); (c) after a hit, the same `key` is not answered again at `now + 0.34` but is at `now + 0.36`; (d) a `friend` at closing speed 20 answers `outcome.kind === 'glance'`; (e) a way 40 units long finds a body at its middle (as the rocks' test does); (f) a body with no `prev` and no `vel` is swept where it is, `into` from your speed alone; (g) `normal` points from the body toward your ship at the meeting point, unit length; (h) `at` is the meeting point on your way (`before + (after − before) × k`); (i) a null source is skipped. Your ship's velocity: `shipVelocity(after)`; a body's: `vel`, else `(at − prev) / dt` when `prev` is given, else zero.

- [ ] **Step 2: Run them to see them fail**: `npx vitest run src/components/universe/shipHits.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement `shipHits.js`**. Header comment as the spec's section 2 says. `reach` per frame = the longest `r` among the bodies plus `radius` plus the way's length. Prefilter by squared distance from `after` (no `Math.hypot` in the loop: every body, every frame). For each candidate: `k = sweptSpheres(before, after, body.prev ?? body.at, body.at, (body.r ?? bodyRadius(body.size)) + radius)`; keep the smallest `k`. The meeting point, the body's place at `k` (`prev + (at − prev) × k`), the normal from that place to the meeting point (unit; `[0, 1, 0]` if they coincide), `into = closingSpeed(vYou, vThem, normal)`, `outcome = body.side === 'friend' ? { kind: 'glance', damage: 0, punch: 0, keep: CONTACT.glance } : contact(into, body.size)`. The cooldown is a `Map` key → `until`, pruned when over 64 entries (as `lib/impact.js` prunes).

- [ ] **Step 4: Run the tests**: `npx vitest run src/components/universe/shipHits.test.js` and `npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -m "Add the ship contact collector"` with both files.

# Phase 2: every ship system answers its bodies or solids

Each task: a getter of a few lines reading what the system keeps, a test beside the file with its existing fakes. The order below is the order of value; each commits on its own.

### Task 3: Bodies

**Files (modify, each with its test):**
- `src/components/universe/hunters.js` (`get bodies`), `hunters.test.js`
- `src/components/universe/wingmen.js` (`get bodies`), `wingmen.test.js`
- `src/components/universe/online/pilots.js` (`get bodies`), create `online/pilots.bodies.test.js` (the file has no test today; the fake fleet of `hunters.test.js` and a `client` stub as `pilotsRules.test.js` shapes one)
- `src/components/universe/traffic.js` (`bodies(p, r)`), `traffic.test.js`
- `src/components/universe/skirmishes.js` (`get bodies`), create `skirmishes.test.js` (a fake fleet as `wingmen.test.js` has one)
- `src/components/universe/npcs.js` (`get bodies`), create `npcs.test.js`
- `src/components/universe/front.js` (`get bodies`), `front.test.js`
- `src/components/galaxy/warfront.js` (`get bodies`), `warfront.test.js`

**Interfaces (produces):** every getter answers `body[]` as Task 2 defines it. Per system:

| system | from | `key` | `at` / `prev` / `vel` | `size` | `side` | `hit(punch)` |
| --- | --- | --- | --- | --- | --- | --- |
| hunters | `hunt.live`: `h.alive && !h.pack.gone && !(h.hidden > 0) && !hasTrait(h.type, 'rammer')` | `h:${h.id}` | `h.pos` / `h.prev` / `h.vel` | `h.type.size` | `'foe'` | `answer(hunt.damage(h.id, punch))` (the file's `answer`, so a `down` is the hit `hit()` would give) |
| wingmen | `wing.live` (the rules' records, not the rounded `live` getter: add a `bodies` on `wingRules.js` too if its records are private) | `w:${w.id}` | `w.pos` / `w.prev` / `w.vel` | `w.type.size` | `'friend'` | `() => null` |
| pilots | `ships` with `sh.shown && !sh.parked`; `ghosts` with `clock >= g.goneUntil` | `p:${id}` / `g:${g.owner}:${g.hunter}` | `sh.at` / `sh.prev` / `sh.vel` (Vector3s read as `{ x, y, z }`: answer the Vector3 itself, it has `x`, `y`, `z`) | `SIZE` (0.3) / `g.type.size` | pilot: `sh.ally ? 'friend' : 'pilot'`; ghost `'foe'` | pilot: `() => null`; ghost: the body of `hit`'s ghost branch, factored into `hurtGhost(g, damage)` and used by both |
| traffic | `live` groups with `(g.grow ?? 1) >= HIDDEN`, members `alive`, within `r` of `p`, and `!TYPES[m.kind].big && m.size <= 2` | `t:${g.id}:${i}` | `m.model.group.position` / none / none | `m.size` | as `near` tells them: `civil`, `law`, else `'foe'` | the member goes down as `hit` does: `m.alive = false; give(m.kind, m.model)`; answers `{ down: true, at: position.clone(), size, kind, civil }`. Factor the two sites into `down(m)`. |
| skirmishes | `sk.hunt.live` (as hunters, side `'foe'`), `sk.wing.live` (`'friend'`), the freighter while `on && alive` (`'civil'`, size `CIVIL_SIZE[kind] ?? 0.7`) | `sk:h:${id}` etc. | their `pos` / `prev` / `vel`; the freighter's `{ x, y, z }` | | | `(punch) => sk.hit(before, after, punch)`: the collector passes `before` and `after` into `hit` as its second and third arguments, `hit(punch, before, after)`, for the systems that only test a segment |
| npcs | `brains.live` | `n:${id}` | `pos` / none / `vel` | the npc's ship size (`fleet` kind's: read what `npcs.js`'s `hit` uses) | `hostile ? 'foe' : 'friend'` | hostile: `(punch, before, after) => npcs.hit(before, after, punch)` |
| front | `battle.fighters` with `f.alive && f.team !== battle.you.team`, only while `joined !== null && battle && !battle.over` | `f:${f.id}` | `f.seen` / `f.prev` / `f.vel` | `f.size` | `'foe'` | `(punch, before, after) => battle.hit(before, after, punch)` |
| warfront | the same from its `battle` (fighters only; the hulls stay solids) | | | | | |

So the body's `hit` signature is `hit(punch, before, after)`; Task 2's collector passes all three (amend its test (a) to assert the call). Document it in `shipHits.js`'s header.

- [ ] **Step 1: For each system, write the failing test** beside it: the getter answers the right bodies (a hunter that is a `rammer` is absent; a hidden one absent; a parked pilot absent; a ghost past `goneUntil` absent; a big traffic ship absent and a small one within `r` present with the right `side`; a wingman is a `friend`; a front fighter of your own team absent), with `at`, `prev`, `size` and `key` as the table says, and `hit(punch)` doing what the table says (a hunter's `down` when `punch >= hp`; a traffic member gone after it).
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement each getter**, a few lines, no reformatting around it; the header comment of each file gains the getter in its signature list.
- [ ] **Step 4: Run the system's tests and lint.**
- [ ] **Step 5: Commit per system** (`"Hunters answer their bodies for ship contact"`, and so on).

### Task 4: Solids

**Files (modify, each with its test):**
- `src/components/universe/setpieces.js` (`get solids`), `setpieces.test.js`
- `src/components/universe/sectorFleet.js` (`sectorSolids(t)`), `sectorFleet.test.js`; `sectorFleetView.js` (`get solids`, from `sectorSolids(t)` when `here`)
- `src/components/universe/traffic.js` (`solids(p, r)`: the big members), `traffic.test.js`
- `src/components/galaxy/interdictor.js` (`get solids`), create `interdictor.test.js` (a `models` stub as `warfront.test.js` makes one, or skip the model: the getter needs only `piece`)

**Interfaces (produces):** each answers `[{ id, at: [x, y, z], r, reach: r }]`, ship.js's solid shape (`reach` so `parkBy` and the autopilot keep clear if ever handed them).

| system | solids |
| --- | --- |
| setpieces | while `cap.here` (the capital is in): one per `c.hull` sphere, `id: cap:hull:${i}`, `at: h.at`, `r: h.r` (placed each frame by `capitalRules`'s `place`; read, don't recompute); empty while jumping in or out (its smear is not solid) |
| sectorFleet | `sectorSolids(t)`: one per `sectorShips(t)`, `r: s.size * 0.16`, `id: s.id`; the view's `solids` is that while `here`, else `[]` |
| traffic | members with `TYPES[m.kind].big || m.size > 2`, within `r` of `p`: `id: t:${g.id}:${i}`, `r: m.size * 0.3` |
| interdictor | while `here`: one sphere at `piece.at`, `r` from the model's length as `interdiction.js` or the slot's size gives it (find the number it already uses for the well or the hit; name the source in a comment), `id: 'interdictor'` |

- [ ] **Step 1: Write the failing tests** (the destroyer's solids follow its hull after `arrive`; none while `state` is `'in'` or `'out'`; `sectorSolids(0)` has one per ship at its place; a big traffic ship within `r` is a solid and a small one is not; the interdictor's solid is at its `at` while here and absent otherwise).
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests and lint.**
- [ ] **Step 5: Commit per system.**

- [ ] **Push the branch**: `git push -u origin claude/dazzling-meitner-ltnrn5`.

# Phase 3: the scenes

### Task 5: The universe map

**Files:**
- Modify: `src/components/universe/scene.js` at: the imports (`createShipHits`, `CONTACT`); after `const pilots = createPilots(...)` (`:1047`): make the collector; `startCrash` (`:2876`, `SOLIDS.find` → the frame's list); `fly` (`:4131` the step's solids, `:4138` after `rocksHit`: the sweep); `crashing` (`:3874` `body` for a ship crash, `:3879` the crash's `kind`); `window.__universeDebug` (`:5543`): `ram()`.
- Modify: `src/components/universe/Comms.jsx:151-153` only if a `bump` with `hard` from a ram needs nothing new (it does not: `bumpSound` and the crew's bump line already play; leave it). `crashInto` with `kind: 'ship'` falls back to `crew.crash` in `linesFor` (`crews.js:3105`); leave it.

**Interfaces (consumes):** Task 2's collector; Task 3's and Task 4's getters; the scene's own `hurt(damage, by)` (`:2981`), `pops.hit`, `burn`, `killed(hh)` (`:2468`), `deed`, `emit`, `wall()`.

- [ ] **Step 1: The frame's solids.** Beside `SOLIDS_OPEN` (`:831`) add `let solidsNow = SOLIDS;` and in `fly`, before the step: `solidsNow = moving(siegeSt.down ? SOLIDS_OPEN : SOLIDS)` where `moving(base)` concatenates `pieces.solids`, `sectorFleet.solids` and `traffic?.solids(state.ship, 12) ?? []` only when any is non-empty (else returns `base`, no allocation). Hand `solidsNow` to `step` at `:4131`. In `startCrash`, `const solid = solidsNow.find(...)`. Also `leadOf` (`:3186`) keeps `SOLIDS`: the hunters' hold-off is not this change's.

- [ ] **Step 2: A crash into a ship.** In `startCrash`, when the solid's `id` starts with `cap:`, `t:`, `interdictor` or is a sector ship's (`solid.ship === true` set by Task 4's getters: add `ship: true` to every ship solid), set `kind: 'ship'` and `ship: true` on `state.crash`. In `crashing` (`:3874`): `body: c.ship ? null : (planetOf[c.id]?.surface ?? null)`. The `crash` event (`:3879`) carries `kind: c.kind ?? undefined` already.

- [ ] **Step 3: The collector.** After `pilots` is made:
```js
const shipHits = createShipHits({ sources: [() => hunters?.bodies, () => wingmen?.bodies, () => skirmishes?.bodies, () => npcs?.bodies, () => pilots.bodies, () => traffic?.bodies(state.ship, 6), () => front?.bodies] });
```
(`front` is a `let` set later: read it through the closure.)

- [ ] **Step 4: The sweep**, after `rocksHit` at `:4138`, in a function `shipsHit(before, ship, dt)` placed beside `rocksHit` (after `:3060`), called with the same guard as the rocks (`!state.jump && !state.held`) and returning early when `state.crash`:
  - `const h = shipHits.sweep(before, ship, dt, state.clock); if (!h) return;`
  - Put the ship back to touching: `state.ship = { ...state.ship, x: h.at.x + h.normal.x * gap, … }` where `gap` = `(h.body.r ?? bodyRadius(h.body.size)) + SHIP.radius − distance(h.at, bodyAtK)` … simpler and enough: move the ship to `bodyPlace + normal × (bodyR + SHIP.radius)`; the collector answers `h.body.place` (its place at `k`) for this: add it to the hit in Task 2 (one more assertion in its test (h)).
  - Glance: `speed × outcome.keep`; `if (!reduced) state.shake = Math.max(state.shake, 0.25)`; `emit({ type: 'bump', id: h.body.kind, hard: false })`.
  - Ram: `pops.hit({ point: new THREE.Vector3(h.at.x, h.at.y, h.at.z), normal: popDir.set(h.normal.x, h.normal.y, h.normal.z), radius: 0.3 })`; `if (state.clock >= state.safeUntil) hurt(h.outcome.damage)`; `if (!state.ship || state.crash) return;` (shot down by it); speed as the rocks (`:3059`): `Math.sign(speed || 1) * Math.max(SHIP.boost, |speed| × keep)`; `shake` 0.9, `flare` 1.6, `kick` 0.6 (all under `!reduced` but `flare`); `state.note = { text: `Hit a ${name}: shields −${Math.round(damage)}`, until: wall() + 2.5 }` where `name` is the hunters' `NAMES[kind] ?? kind`; `emit({ type: 'bump', id: h.body.kind, hard: true })`.
  - Then the other ship: `const r = h.body.hit(h.outcome.punch, before, ship)`. Play it as a shot's hit is played: factor the hunter branch of `moveBolts` (`:2366-2380`, from `pops.hit` to `killed(hh)`) into `hunterShot(hh, normal)` and the traffic branch (`:2417-2425`) into `trafficShot(h)`, each used by `moveBolts` and here (by `h.body.side` and `h.body.key`'s prefix: `h:` and `sk:`/`n:`/`f:` → `hunterShot`; `t:` → `trafficShot`; `g:` → the ghost branch of the pilots' hit (`:2383-2392`), factored the same way as `ghostShot(ph, punch)`). No `hitMark` for a ram (the reticle is the guns').

- [ ] **Step 5: The dev hook.** In `window.__universeDebug` add `ram: () => { … }`: a pack of one TIE put 6 units dead ahead at your height with `hunters.pack('empire', state.ship, { size: 1, ace: false, from: ahead })` (read `hunterRules`'s `from`), for the browser check.

- [ ] **Step 6: Run** `npm run lint`, `npx vitest run src/components/universe`, `npm run build`. Expected: clean.

- [ ] **Step 7: Check in a browser**: `node scripts/autopilot-check.mjs --routes /universe` passes. Then with `npm run dev` and Playwright (as `scripts/autopilot-check.mjs` drives a page), on `/universe` with a ship picked: call `__universeDebug.ram()`, hold W for three seconds, screenshot: sparks or a note "Hit a TIE fighter: shields −N" in the HUD, the shield bar down, no console error. Save the screenshot under `docs/superpowers/handoff/ship-contact/` (create it) for the handoff.

- [ ] **Step 8: Commit**: `"Ships on the universe map can be hit: a glance, a ram or a crash"`.

### Task 6: The galaxy

**Files:**
- Modify: `src/components/galaxy/scene.js` at: imports; after `pilots` (`:378`): the collector with `[() => hunters?.bodies, () => wingmen?.bodies, () => pilots.bodies, () => war?.bodies]`; `startCrash` (`:985`: `state.space.solids.find` → the frame's list); `fly` (`:1352`: `step(…, solidsNow, state.space)` with `solidsNow = moving(state.space.solids)` from `pieces?.solids` and `interdictor?.solids`; after the `events` loop and `if (state.crash) return true;` (`:1416`): the sweep, guarded also by `powers.mods.ghost`); `crashing` (`:1053`: `body` null for a ship; `:1056`: `kind`); `window.__galaxyDebug` (`:2380`): `ram()`.

**Interfaces (consumes):** the scene's `hurt` (`:1021`), `scored(hit, { src, normal })` (`:921`) and `landed`; `pops`.

- [ ] **Step 1: Mirror Task 5's Steps 1 to 4**, with the galaxy's own kill path: a ram's `down` from a hunter body goes `scored(r, { src: 'hunters', normal })`; from a war body `scored(r, { src: 'war', normal })`; a ghost's as `strike`'s pilots branch (`:949-957`), factored into `ghostShot(ph, punch)` used by both. The war's hulls are solids already; `war.bodies` is fighters only.
- [ ] **Step 2: Dev hook** `__galaxyDebug.ram()` as Task 5's.
- [ ] **Step 3: Run** lint, `npx vitest run src/components/galaxy`, build.
- [ ] **Step 4: Browser check**: `node scripts/autopilot-check.mjs --routes /galaxy` passes; the ram screenshot as Task 5's, saved beside it.
- [ ] **Step 5: Commit**: `"Ships in the galaxy can be hit"`.

# Phase 4: the record

### Task 7: Docs, the full checks, the handoff

**Files:**
- Modify: `docs/architecture.md`: in the universe map's bullet list (near `:36-45`, after the `rockHits` mention if there is one, else after `hunterRules.js`'s entry) one bullet: `src/lib/combat/contact.js` and `universe/shipHits.js`, what a glance, a ram and a crash are, which systems answer `bodies` and which `solids`, the galaxy on the same.
- Create: `docs/decisions/2026-10-09-ship-contact.md` (as `2026-10-08-three-over-babylon.md` is shaped: Context, the choice "big ships are solids, small ships are bodies; only your ship moves", Consequences: no network ram, no knock-back on the other ship).
- Create: `docs/superpowers/HANDOFF-ship-contact.md`: Done (one line per task), where the code differs from the design (if anywhere), the numbers after hand tuning, the screenshots, Not done (the spec's "Not in this design", as the next lane's list).
- Modify: `docs/superpowers/specs/2026-10-09-ship-contact-design.md` only if the numbers were tuned (update the table to the shipped values).

- [ ] **Step 1: Write the three docs.**
- [ ] **Step 2: Run the whole gate**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`. Expected: all green; `big-files` 30, `boundary-breaks` no higher than on `main` (`git stash; node scripts/health.mjs --only boundary-breaks; git stash pop` to compare if in doubt).
- [ ] **Step 3: Commit** `"Record the ship contact design, decision and handoff"` and push: `git push -u origin claude/dazzling-meitner-ltnrn5`.
- [ ] **Step 4: Report**: the commits, the gate's output (verbatim last lines), the screenshots' paths, what was tuned, and anything left undone with why. No pull request unless asked.
