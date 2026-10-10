# The Ground War Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faction-held turf on every galaxy surface, a chunked population of soldiers that fills in round the player, and one fight model in which soldiers of every side see, shoot, take cover, break and fall against each other and the player.

**Architecture:** A new folder `src/components/galaxy/surface/ground/` of pure, tested rules (standing, turf, population, troops, fight, bolts, director, landing) composed by one three.js module (`groundScene.js`) that `scene.js` creates and updates. Population is cell bookkeeping on `src/runtime/chunkGrid.js`; brains are `hostiles.js`'s head generalised onto `src/lib/ai`; bolts are swept like the Death Star's; bodies ride the site's animator and fall as `ragdollPhysics` ragdolls.

**Tech Stack:** Three.js, Vitest (Node tests beside each file; `npm test`, `npm run test:ai`), `src/lib/ai`, `src/runtime/chunkGrid.js`, `src/lib/three/{animator,animBudget,ragdollPhysics,figureCalls}.js`.

**Spec:** `docs/superpowers/specs/2026-10-08-ground-factions-design.md` (and, for the sections it absorbs, `docs/superpowers/specs/2026-10-07-ground-sides-kashyyyk-look-ai-design.md` sections 1 to 6).

## Global Constraints

- Every rules module is pure: no `three`, no DOM, a `rand` argument where it needs chance. Tests beside the file as `x.test.js`, under a second, no network (`docs/health/RULES.md`).
- Files under 800 lines. `scene.js` (3,518 lines) may grow by at most 30 lines net; the garrison wiring it loses pays for the two calls it gains.
- Layers: `src/lib` imports no React and no world; a world imports another world only through its `index.js` or `shared/`. `lodPick` moves to `src/lib/three/lodPick.js` before the galaxy uses it.
- No new dependencies. No runtime asset-service calls. No new models or clips.
- Copy: British spelling, curly quotes, sentence case, no Oxford comma. Toasts one sentence.
- Commit messages: one plain sentence about what changed, the session's attribution lines at the end. Merge commits, never force-push.
- Numbers from the spec, verbatim: cell 48 m, radius 3, hysteresis 1; `DENSITY = { high: 3, mid: 2, low: 1 }`; `POP = { ultra: 32, high: 28, mid: 18, low: 10 }`; pad turf r 90, far turf r 110 on the ring 220–300 m; `GRUDGE = 90` s; `RAID = 150` s; `REINFORCE = 120` s; suppression 2 m for 1.5 s; facing 25°; aim error × 1 to 2.2 by range, × (1 + speed across / 6), × 1.5 first shot of a burst; rethink 0.4 s, sense 0.1 s, squads 0.5 s; brains not stepped past 120 m, bolts only within 60 m; ragdolls within 40 m, 4 at once, high and ultra only; frame budget 2 ms on high.
- Before each PR: `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke`, and `BUDGET= node scripts/galaxy-check.mjs surface` on Endor, Hoth and Tatooine at high (frame time recorded in the PR body, before and after).
- Open branches: check `claude/game-layout-textures-ai-7a0553` (touches `garrison.js`, `activity.js`) before Task 7; merge main before every PR.

## Review Focus

1. A site whose derived far turf lands in water or on a cliff on some war state (owner flips when the campaign does): `turfsOf` must snap it to standable ground or drop the far turf, never place soldiers in the sea. Test: Task 5, `far turf is standable on every landable site in every war state`.
2. The player crossing a cell boundary while a patrol is mid-fight: the patrol must be kept, not dropped and remade mid-step. Test: Task 6, `a soldier is owned by the cell it walked into`.
3. An unsworn player shot by nobody must stay neutral through a raid happening beside them; stray bolts that pass within 2 m must not start a grudge, only the player's own shots. Test: Task 9, `an enemy bolt near an unsworn you is not a grudge`.
4. A soldier's bolt that would hit the player while `state.safe` (the dodge) or while the saber is deflecting: the bolt must go through `blaster.enemy` so the existing rules apply, never straight to `hurt`. Test: Task 12 (scene wiring, manual) plus Task 10, `a bolt at you is handed on, not resolved`.
5. Figure pooling across kinds: a dropped stormtrooper's figure must never be reused for a rebel (wrong model). Test: Task 11, `pool returns a figure only to its own kind`.

---

## File structure

Create, all under `src/components/galaxy/surface/ground/` unless a path says otherwise:

| File | Responsibility |
|---|---|
| `src/components/galaxy/siteWar.js` (+ test) | `SITE_WAR`, `groundEffects` |
| `standing.js` (+ test) | `SIDE_OF_KIND`, `relation`, `standingOf`, `NATIVES` |
| `landing.js` (+ test) | `landingFor`, `covertFor` |
| `turf.js` (+ test) | `turfsOf`, `padTurf`, `farTurf`, `holderSide`, `turfAt`, `frontBetween`, `strengthOf` |
| `troops.js` (+ test) | `TROOPS`, `newSoldier`, `damageOf`, `hurt`, `hpOf` |
| `population.js` (+ test) | `createPopulation`, `rosterFor`, `DENSITY`, `POP`, `CELL` |
| `fight.js` (+ test) | `senseAll`, `threatOf`, `aimError`, `fightStep`, `squadsOf`, `GRUDGE` |
| `bolts.js` (+ test) | `createBolts`, `farExchange` |
| `director.js` (+ test) | `createDirector`, `RAID`, `REINFORCE` |
| `ground.scenario.test.js` | the rules end to end, under `test:ai` |
| `groundScene.js` | three.js: figures, pool, animator, ragdolls, the one `update` |
| `index.js` | barrel |
| `src/lib/three/lodPick.js` (+ test) | `lodPick`, `liveCount`, moved from the Death Star |

Modify: `src/components/galaxy/allegiance.js` (`oathIn`), `src/pages/GalaxySurface.jsx:127-132` (effects from `groundEffects`), `src/pages/Galaxy.jsx:274` (the flown landing's effects, same call), `src/components/galaxy/surface/garrison.js` (drop `garrisonAt`, `garrisonQuest`; add `padTurf` placing), `src/components/galaxy/surface/scene.js:349,376,514-600,2864-2931` (create/update ground, landing spot, shooters), `src/components/galaxy/surface/weaponRules.js` (`dc15`, `e5`), `src/components/galaxy/surface/sites/validity.js` and `.test.js`, `src/components/deathstar/inside/scene/people.js` (import `lodPick` from lib), `docs/architecture.md` (the surface's entry).

---

## PR 1: the ground's war, friend or foe, where you set down

### Task 1: `SITE_WAR` and `groundEffects`

**Files:**
- Create: `src/components/galaxy/siteWar.js`, `src/components/galaxy/siteWar.test.js`
- Modify: `src/components/galaxy/allegiance.js` (add `oathIn`), `src/components/galaxy/allegiance.test.js`

**Interfaces:**
- Consumes: `effectsFor(sysId, table, current)` (`warEffects.js`), `warNow(now, war)` (`warState.js`), `current(a)`, `WARS`, `DEFAULT_WAR` (`sides.js`), `rankOf`, `RANKS` (`ranks.js`), `mine(war, now)` (`warState.js`).
- Produces: `SITE_WAR: { [sysId]: 'clone' | 'gcw' | 'remnant' }`; `siteWarOf(sysId, theatre) → war id` (the table's, else `theatre`); `oathIn(a, war) → { war, side, sworn, turncoat }`; `groundEffects(sysId, a, now) → effects | null` = `effectsFor(...)` plus `{ side, rank, war, control, front, attack }` (`control` 0..1 from the war row, `front` boolean, `attack` boolean).

- [ ] **Step 1: Write the failing tests**

```js
// siteWar.test.js
test('each film world is staged in its film war', () => {
  expect(SITE_WAR.geonosis).toBe('clone'); expect(SITE_WAR.hoth).toBe('gcw'); expect(SITE_WAR.nevarro).toBe('remnant');
  expect(siteWarOf('alderaan', 'gcw')).toBe('gcw');
});
test('groundEffects reads the site war, not the theatre', () => {
  const a = swear(readAllegiance(null, { now: T }), 'republic', T); // theatre clone; then setTheatre(a, 'gcw')
  const e = groundEffects('geonosis', setTheatre(a, 'gcw'), T);
  expect(e.war).toBe('clone'); expect(e.side).toBe('republic'); expect(typeof e.control).toBe('number'); expect(e.front === true || e.front === false).toBe(true);
});
test('groundEffects is null off the war map', () => expect(groundEffects('dagobah-nowhere', readAllegiance(null), T)).toBeNull());
// allegiance.test.js
test('oathIn gives the oath in another war, unsworn when none', () => {
  const a = swear(readAllegiance(null, { now: T }), 'rebel', T);
  expect(oathIn(a, 'clone')).toEqual({ war: 'clone', side: null, sworn: 0, turncoat: false });
  expect(oathIn(a, 'gcw').side).toBe('rebel');
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/components/galaxy/siteWar.test.js src/components/galaxy/allegiance.test.js`. Expected: FAIL, modules or exports missing.
- [ ] **Step 3: Implement** `oathIn(a, war)` in `allegiance.js` (the same shape `current` gives, for `war`); `SITE_WAR`, `siteWarOf`, `groundEffects` in `siteWar.js`. `rank` as `GalaxySurface.jsx:130-131` computes it today (copy that expression; the page then calls `groundEffects`).
- [ ] **Step 4: Run to verify pass** — same command. Expected: PASS.
- [ ] **Step 5: Wire the page and the flown landing**: `src/pages/GalaxySurface.jsx:127-132` becomes `useMemo(() => groundEffects(id, oathKept, Date.now()), [id, oathKept])`; the flown landing's call is `src/pages/Galaxy.jsx:274` (`effects: effectsFor(...)` inside `surfaceProps`): make the same change there; `src/components/galaxy/scene.js:277` is the orbit's (the director's) and stays on the theatre. Replace `battleLines.js`'s `PLACES` with an import of `SITE_WAR` if the values agree (grep `PLACES` in `scene.js:349`); if they differ, keep `PLACES` and note it in the PR.
- [ ] **Step 6: Run** `npx vitest run src/components/galaxy && npx eslint src/components/galaxy src/pages`. Expected: PASS, no lint errors.
- [ ] **Step 7: Commit** — `git add -A src/components/galaxy src/pages && git commit -m "The ground keeps its film's war: siteWar.js stages each world in the war its film is set in, and your oath there is the one that counts"`

### Task 2: `standing.js`: sides of kinds, and the relation between any two sides

**Files:**
- Create: `ground/standing.js`, `ground/standing.test.js`

**Interfaces:**
- Consumes: `SIDES`, `WARS`, `otherSide`, `warOfSide` (`galaxy/sides.js`).
- Produces: `SIDE_OF_KIND: { [kind]: { [war]: sideId } | sideId }`; `NATIVES: { [kind]: { leans: 'light' | 'dark' } }`; `sideOfKind(kind, war) → sideId | 'native' | null`; `relation(a, b, war) → 'ally' | 'enemy' | 'neutral'` where `a`, `b` are side ids, `'hutt'`, `{ native: kind }` objects, or `null`; `standingOf(npcSide, you: { side: sideId | null, war }) → 'ally' | 'enemy' | 'neutral'`.

- [ ] **Step 1: Write the failing tests**

```js
test('a kind is its war\'s side', () => {
  expect(sideOfKind('stormtrooper', 'gcw')).toBe('empire'); expect(sideOfKind('stormtrooper', 'remnant')).toBe('remnant');
  expect(sideOfKind('rebel', 'remnant')).toBe('newrepublic'); expect(sideOfKind('battledroid', 'clone')).toBe('separatists');
  expect(sideOfKind('weequay', 'gcw')).toBe('hutt'); expect(sideOfKind('wookiee', 'clone')).toBe('native'); expect(sideOfKind('womprat', 'gcw')).toBeNull();
});
test('relation: same side ally, the war\'s two sides enemies, the Hutts everyone\'s enemy, natives by lean, nobody neutral', () => {
  expect(relation('rebel', 'rebel', 'gcw')).toBe('ally'); expect(relation('rebel', 'empire', 'gcw')).toBe('enemy');
  expect(relation('hutt', 'empire', 'gcw')).toBe('enemy'); expect(relation('hutt', 'rebel', 'gcw')).toBe('enemy');
  expect(relation({ native: 'wookiee' }, 'republic', 'clone')).toBe('ally'); expect(relation({ native: 'wookiee' }, 'separatists', 'clone')).toBe('neutral');
  expect(relation({ native: 'geonosian' }, 'republic', 'clone')).toBe('neutral'); expect(relation(null, 'empire', 'gcw')).toBe('neutral');
  for (const w of Object.keys(WARS)) for (const a of Object.keys(SIDES)) for (const b of Object.keys(SIDES)) expect(relation(a, b, w)).toBe(relation(b, a, w)); // symmetric
});
test('standingOf: unsworn is neutral to all', () => {
  expect(standingOf('empire', { side: null, war: 'gcw' })).toBe('neutral'); expect(standingOf('empire', { side: 'rebel', war: 'gcw' })).toBe('enemy'); expect(standingOf('rebel', { side: 'rebel', war: 'gcw' })).toBe('ally');
});
```

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/components/galaxy/surface/ground/standing.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Kinds from the ground-sides spec section 2 (`garrison.js`'s `FAMILIES` and `TROOP_NAMES` list the trooper kinds; add `droideka`, `dwarfspider`, `probe`, `deathtrooper`, `shoretrooper`, `atst`, `atrt`, `atap`, `atte`). Natives: wookiee, ewok, gungan (light); geonosian (dark); jawa, kaminoan (no lean: neutral to all). A side not in `WARS[war]`'s pair, not Hutt, is `neutral` to everyone (a Clone Wars kind standing on a Civil War world).
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** — `"Friend or foe on the ground: standing.js says what any two sides are to each other in a world's war, and what each is to you"`

### Task 3: `landing.js`: the covert landing

**Files:**
- Create: `ground/landing.js`, `ground/landing.test.js`
- Modify: `src/components/galaxy/surface/sites/validity.js` (export a `standableAt(site, height, [x, z])` the landing can call with a prebuilt height, if `standable` rebuilds the height each call: check `validity.js:29`).

**Interfaces:**
- Consumes: `standable(site, [x, z])` (`sites/validity.js`), `lineClear(solids, a, b)` (`walker.js`) through a `seesThrough` callback, `standingOf`.
- Produces: `landingFor(site, effects, { standable, seesThrough, posts }) → { at: [x, z], yaw, covert: boolean, line: string | null }`; `covertFor(site, { standable, seesThrough, posts, rand }) → [x, z] | null` (the ring 150–220 m, 24 bearings × 3 radii tried, best = standable, dry, out of every post's sight, furthest from the nearest post; null when none).

- [ ] **Step 1: Write the failing tests**

```js
const posts = [[20, 0], [-20, 0]];
test('your side\'s, the Hutts\' and an unsworn world land at the pad', () => {
  for (const e of [{ owner: 'rebel', side: 'rebel' }, { owner: 'hutt', side: 'rebel' }, { owner: 'empire', side: null }]) expect(landingFor(SITE, { ...e, war: 'gcw' }, { standable: () => true, seesThrough: () => true, posts })).toMatchObject({ at: SITE.land.at, covert: false, line: null });
});
test('the other side\'s world lands covert, 150 to 220 m out, out of the posts\' sight', () => {
  const l = landingFor(SITE, { owner: 'empire', side: 'rebel', war: 'gcw' }, { standable: () => true, seesThrough: (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 100, posts });
  const d = Math.hypot(l.at[0] - SITE.land.at[0], l.at[1] - SITE.land.at[1]);
  expect(l.covert).toBe(true); expect(d).toBeGreaterThanOrEqual(150); expect(d).toBeLessThanOrEqual(220); expect(l.line).toMatch(/Imperial-held/);
});
test('site.covert wins when authored; nowhere standable falls back to the pad with no line', () => { /* two cases */ });
```

- [ ] **Step 2–4: fail, implement, pass.** The line by owner's short name: `"${SIDES[owner].short}-held. We set down out of sight of the garrison."` (Imperial for the Empire and the Remnant: use `'Imperial'` when `SIDES[owner].stance === 'dark'` and the war is gcw/remnant, `'Separatist'` for clone's raider).
- [ ] **Step 5: Commit** — `"Where you set down: on the other side's world the ship lands out of the garrison's sight"`

### Task 4: PR 1 wiring in `scene.js`, and the garrison's lines

**Files:**
- Modify: `src/components/galaxy/surface/scene.js:514` (`landAt` from `landingFor`), `:593-600` (spawn beside the ship as now, at the new `landAt`), `garrison.js:35` (`garrisonLife` re-dresses unnamed only: skip entries with `id`, `named` or `quest`), `scene.js:349` (`garrisonQuest` call removed; grep it), `garrison.js` (friendly/neutral lines by `standingOf`: ally `['Commander.', 'Good to have you back.']` by rank ≥ 3 `'General.'`; neutral `['Move along.']`).
- Test: `garrison.test.js` (named entries untouched; lines by standing).

- [ ] **Step 1: Failing tests** for `garrisonLife` keeping a `{ id: 'gree', kind: 'clone' }` entry's kind and `says`; for `garrisonLines(standing, rank)`.
- [ ] **Step 2–4: fail, implement, pass.**
- [ ] **Step 5: Wire** `landingFor` at `scene.js:514` with `standable` from `sites/validity.js` over the built `world` (`heightAt`, `water`), `seesThrough` = `(a, b) => lineClear(world.solids, a, b)`, posts from `garrisonAt`'s posts for now (Task 7 replaces with the pad turf). Show `line` through the arrival line the scene already emits for `site.line` (grep `site.line`).
- [ ] **Step 6: Verify in the browser**: `node scripts/galaxy-check.mjs surface` on Endor with the oath set to `rebel` in localStorage (`tp-gcw-side`), screenshot shows the ship off the pad; on Hoth as `rebel` the pad as before. Record both shots in the PR.
- [ ] **Step 7: Full checks** (Global Constraints list). **Commit** — `"The garrison knows your side: it salutes its own, watches the unsworn, and never re-dresses a named person"`. Open PR 1.

---

## PR 2: turf, population, and the fight against you

### Task 5: `turf.js`

**Files:**
- Create: `ground/turf.js`, `ground/turf.test.js`, `ground/fixtures/site.js` (a small flat site with `land`, `places`, `ground` layers, water at −2)
- Modify: `garrison.js` (`padTurf` placing moved from `garrisonAt`'s numbers: beats at offsets 34 and 48, posts at r 26 as `garrison.js:53-70` place them)

**Interfaces:**
- Consumes: `standable`, `heightFor` (`sites/validity.js`), `effects` from Task 1.
- Produces: `turfsOf(site, effects, { standable, height, rand }) → Turf[]`; `Turf = { id, at: [x, z], r, holder: 'owner' | 'other' | 'hutt' | 'native' | sideId, posts: [[x, z]], beats: [[[x, z], ...]], strength, front?: { at: [x, z], dir: [dx, dz] } }`; `padTurf(site, effects) → Turf` (r 90, three posts, two beats, as `garrisonAt` placed them); `farTurf(site, pad, effects, { standable, height }) → Turf | null` (r 110, centre on the ring 220–300 m at the bearing furthest from pad posts, flattest standable of 36 candidates; null when none); `holderSide(turf, effects) → sideId`; `strengthOf(turf, effects) → number` (owner: `control`; other: `1 − control`; fixed: 1); `turfAt(turfs, x, z) → Turf | null`; `frontBetween(a, b) → { at, dir } | null` (null unless `relation(holderSide(a), holderSide(b)) === 'enemy'`); `bendBeat(beat, front) → beat` (one point replaced by `front.at`).

- [ ] **Step 1: Failing tests**

```js
test('a quiet world has the pad turf only, the owner\'s, at full strength of its hold', () => {
  const t = turfsOf(SITE, { owner: 'empire', control: 0.7, front: false, attack: false, war: 'gcw' }, kit);
  expect(t).toHaveLength(1); expect(t[0]).toMatchObject({ id: 'pad', holder: 'owner', r: 90 }); expect(strengthOf(t[0], E)).toBeCloseTo(0.7); expect(t[0].posts).toHaveLength(3); expect(t[0].beats).toHaveLength(2);
});
test('a front adds the other side\'s far turf 220 to 300 m out, its beats bent to the front', () => {
  const t = turfsOf(SITE, { ...E, front: true }, kit); const far = t.find((x) => x.id === 'far');
  const d = Math.hypot(far.at[0] - SITE.land.at[0], far.at[1] - SITE.land.at[1]);
  expect(d).toBeGreaterThanOrEqual(220); expect(d).toBeLessThanOrEqual(300); expect(strengthOf(far, { ...E, front: true })).toBeCloseTo(0.3);
  expect(frontBetween(t[0], far)).not.toBeNull(); expect(far.beats[0].some((p) => p[0] === far.front.at[0])).toBe(true);
});
test('a Hutt world has mercenaries and no far turf even on a front', () => { /* owner 'hutt', front true → one turf, holderSide 'hutt' */ });
test('far turf is standable on every landable site in every war state', () => {
  for (const id of LANDABLE) for (const owner of ['rebel', 'empire', 'hutt']) { const site = siteOf(id); const t = turfsOf(site, { owner, control: 0.5, front: true, attack: false, war: 'gcw' }, kitFor(site)); for (const turf of t) for (const p of turf.posts) expect(standable(site, p)).toBe(true); }
});
test('turfAt picks the nearest centre where discs overlap, null in no man\'s land', () => { /* three asserts */ });
```

- [ ] **Step 2–4: fail, implement, pass.** `turf.test.js` over every site may take over a second: if it does, keep the loop in `sites/validity.test.js` (Task 13) and test three sites here.
- [ ] **Step 5: Commit** — `"Turf: who holds which ground on a world, the pad's turf and, on a front, the other side's beyond the ridge"`

### Task 6: `troops.js` and `population.js`

**Files:**
- Create: `ground/troops.js` (+ test), `ground/population.js` (+ test)
- Modify: `weaponRules.js:25-33` (add `dc15`: `{ damage: 1, every: 0.4, burst: 3, spread: 0.012, range: 120 }`, `e5`: `{ damage: 1, every: 0.5, spread: 0.03, range: 70 }`, both `side: 'galaxy'`, `npc: true` so the hero panel skips them: check how `HeroPanel.jsx` lists `WEAPONS` and gate on `npc`); `activity.js:103` `ARMS`, `garrison.js:18` `FAMILIES`, `needs.js:125-129` `SOLDIERS` re-exported from `troops.js` with the same values (a test in each asserts equality with the old literal, then the literal goes).

**Interfaces:**
- Consumes: `createChunkGrid` (`src/runtime/chunkGrid.js`), `turfsOf`, `turfAt`, `holderSide`, `strengthOf`, `cover`/`candidates` (`src/lib/ai/spatial`), `WEAPONS`.
- Produces (`troops.js`): `TROOPS: { [kind]: { hp, weapon, range, speed, cone, nerve, tall } }` (stormtrooper 100/`rifle`/48/3.2/0.3/1; rebel 100/`a280`; clone 100/`dc15`; battledroid 60/`e5`/0.5 nerve 0; superdroid 160/`rifle` nerve 0; droideka 120 shield 3; mercenary 90/`westar`; weequay 90/`westar`; probe 40 no weapon); `newSoldier(spec, rand) → Soldier`; `Soldier = { id, kind, side, hp, hpMax, weapon, b: { x, z, yaw, to, wait }, home, leash, beat, role, mode, mind, beliefs, squad, suppressed: 0, heat: 0, grudge: 0, alive: true }`; `damageOf(weapon, dist) → number` (the row's `damage × 10`, × 0.6 past two thirds of `range`); `hurt(s, damage) → 'hurt' | 'down'`; `hpOf(spec) → spec.hp × 10`.
- `effects.covertAt: [x, z] | null` is set by `scene.js` from Task 3's landing before the population is made (Task 8).
- Produces (`population.js`): `CELL = 48`, `RADIUS = 3`, `DENSITY`, `POP`; `createPopulation({ site, turfs, effects, tier, seed, rand, standable }) → { update({ x, z, heading }) → { make: Soldier[], drop: id[] }, soldiers: Map<id, Soldier>, died(id), move(id, x, z), cellOf(x, z), reinforce(cellKey, specs) }`; `rosterFor(cellKey, turfs, effects, tier, seed, standable) → Spec[]` with `Spec = { id, kind, side, role: 'post' | 'patrol' | 'fill', at, yaw, home, beat?, turf, squad }`.

- [ ] **Step 1: Failing tests (troops)**: `TROOPS` covers every kind in `SIDE_OF_KIND`; `damageOf('rifle', 10) === 10` and `damageOf('rifle', 100) === 6`; `hurt` returns `'down'` at 0; the three re-export equality tests.
- [ ] **Step 2: Failing tests (population)**

```js
test('a cell\'s roster is the same every time, and only in turf', () => {
  expect(rosterFor('0,0', turfs, E, 'high', 7, ok)).toEqual(rosterFor('0,0', turfs, E, 'high', 7, ok));
  expect(rosterFor('9,9', turfs, E, 'high', 7, ok)).toEqual([]); // no man's land
});
test('a post holds two (one on low), a patrol is three (two on low), fill is DENSITY × strength', () => { /* count roles per tier */ });
test('walking across cells makes ahead and drops behind, dead stay dead', () => {
  const p = createPopulation({ site, turfs, effects: E, tier: 'high', seed: 7, rand, standable: ok });
  const a = p.update({ x: 0, z: 0, heading: [1, 0] }); expect(a.make.length).toBeGreaterThan(0);
  const id = a.make[0].id; p.died(id);
  p.update({ x: 400, z: 0, heading: [1, 0] }); // far: dropped
  const back = p.update({ x: 0, z: 0, heading: [-1, 0] }); expect(back.make.find((s) => s.id === id)).toBeUndefined();
});
test('the cap: never more than POP[tier] live, the furthest left unmade', () => { /* dense turfs, assert soldiers.size <= POP.high and the unmade are the furthest */ });
test('a soldier is owned by the cell it walked into', () => { /* make, move(id) across a boundary, update: not in drop while its new cell is loaded */ });
test('nobody within 25 m of a covert landing', () => { /* effects.covertAt set: roster has none within 25 m */ });
```

- [ ] **Step 3: Run to verify failure.** **Step 4: Implement.** The grid: `createChunkGrid({ size: CELL, radius: RADIUS, inFlight: 1, hysteresis: 1 })`; `update` calls `grid.update` then builds the next cell `grid.cells` names that is not loaded (`began`/`done` the same frame: the roster is sync; the figure making is the scene's), returns `make` for the cell's live specs not dead and under the cap, and `drop` for the ids of cells `grid` says to unload (keeping their records in a `cells: Map<key, { specs, dead: Set }>`).
- [ ] **Step 5: Run to verify pass.** **Step 6: Commit** — `"One table of troops, and a population that fills the turf round you cell by cell and lets go behind you"`

### Task 7: `fight.js`: everyone chooses among everyone

**Files:**
- Create: `ground/fight.js`, `ground/fight.test.js`
- Modify: `hostiles.js` (export `OPTIONS`, `walkTo`, `leashed` helpers if not exported, or move them to `fight.js` and have `hostiles.js` import back: pick the move, keep `hostileStep`'s behaviour byte for byte, its tests passing)

**Interfaces:**
- Consumes: `hostileStep`, `sensesFor`, `STEP`, `HOSTILE_BODY` (`hostiles.js`); `sense`, `belief`, `target` (`lib/ai/perception`); `pick`, `consider` (`lib/ai/utility`); `createSquads`, `confidence`, `posture`, `advance`, `withdraw`, `flankers`, `frontline`, `createTokens`, `morale` (`lib/ai/squad`); `relation`; `TROOPS`.
- Produces: `GRUDGE = 90`; `senseAll(s, world, dt) → void` (`world.bodies: [{ id, x, z, vel, side, kind, firingAt? }]`, `world.seesThrough`); `threatOf(s, world) → belief | null` (enemies by `relation(s.side, b.side, world.war)`; the unsworn `you` with `s.grudge > 0` counted enemy; shooting at `s` or its squad first, then nearest, then has a line; momentum on `s.target`); `aimError(s, target, dist, { first }) → radians`; `fightStep(s, world, dt, rand) → { x, z, yaw, mode, moving, aim, fire, guessed, target }` (`fire` only with a clear line and facing within 25°, `Math.PI / 7.2`; lost: one burst at the last place within 2 s); `squadsOf(soldiers, { reach: 18 }) → { update(dt), of(id), postureOf(id), confidenceOf(id) }` (per side); `suppress(s, now)` (sets `s.suppressed = now + 1.5`); `grudge(s, squads, now)` (every squad member's `grudge = now + GRUDGE`).

- [ ] **Step 1: Failing tests**

```js
test('no shot without a line, and none until facing within 25°', () => { /* a soldier facing away with a clear line: fire false, yaw turns; next steps: fire true once facing */ });
test('a wall between: no fire; lost 1 s: one burst at the last place, then none', () => {});
test('threats: whoever shoots at my squad first, then the nearest enemy, never an ally or a neutral', () => {
  // three bodies: an ally 5 m, an enemy 30 m firing at a squadmate, an enemy 10 m idle → the 30 m one
});
test('an unsworn you is neutral until you shoot at one, then its squad for GRUDGE seconds', () => {});
test('aim error grows with range, crossing speed and suppression, and the first shot of a burst', () => {
  expect(aimError(s, { vel: [0, 0] }, 1, {})).toBeCloseTo(spread); expect(aimError(s, { vel: [0, 0] }, range, {})).toBeCloseTo(spread * 2.2, 2);
  expect(aimError({ ...s, suppressed: 99 }, t, 1, {}) / aimError(s, t, 1, {})).toBeCloseTo(2); expect(aimError(s, t, 1, { first: true }) / aimError(s, t, 1, {})).toBeCloseTo(1.5);
});
test('a retreating squad takes only back and cover, a pressing one sends flankers', () => { /* drive confidence via losses; assert picked modes */ });
test('tokens are per target: three may fire at you and three more at your mate', () => {});
test('a soldier with no enemy walks its beat or holds its post', () => { /* mode patrol → moves along beat; post → mode post, no move */ });
test('engaged, the leash is roam + range; a target beyond range is closed on', () => {});
```

- [ ] **Step 2: Fail. Step 3: Implement** on `hostileStep`'s structure: `fightStep` builds the `world` `hostileStep` expects (`you` = the chosen threat's belief position, `allies` = same side within 30 m, `tokens` = the per-target pool from `createTokens({ pools: { shot: 3, melee: 1 }, timeout: 0.9 })` keyed by target id) and adds the line-of-sight, facing and posture gates round it. Keep `hostiles.test.js` green.
- [ ] **Step 4: Pass. Step 5: Commit** — `"The fight: a soldier of any side senses everyone, picks its threat, and fires only with a line, facing it, as its squad's nerve allows"`

### Task 8: `groundScene.js` (population and the fight against you) and the `scene.js` hook

**Files:**
- Create: `src/lib/three/lodPick.js` (+ test, moved from `deathstar/inside/scene/people.js:95-115`; `people.js` imports it), `ground/groundScene.js`, `ground/index.js`
- Modify: `scene.js:349` (life without `garrisonAt`), after `:376` (`const ground = createGround({ parent: scene, world, site, turfs, effects: ctx.effects, tier, kit, warm, blaster, standable, seesThrough })`), `:1570` (`shootable` returns `[...ground.targets, ...(assaultOn() ? assault.targets : activity.targets)]`), `:2864` (`for (const s of ground.update(dt, me().st, state.t, { mate: mateBody(), bodies: activity.bodies?.() ?? [] })) ...` feeding `s.at === 'you'` shots into the same branch as `activity.shooters`' bolts at `:2927`, the `blaster.enemy` call), `:1182` (the mate's foe search includes `ground.targets`), dispose.
- `groundScene.js` responsibilities: figure pool by kind (`anyFigure`, one made a frame, `warm`ed), `animatorCalls` per figure, `bodyFrom` with `HOSTILE_BODY` plus `patrol: { base: null }`, `post: { scan: true }` rows, `createAnimBudget({ max: POP[tier] })` + `budgetClock` per figure, `lodPick` live/still/hidden at `far: 120`, `createReactions` for `hit` and `down`, guns through `createGunplay` where `RightHand` exists (as `activity.js:103-130` does: copy the pattern, not the code), health bar and `?`/`!` marks through the same helpers `activity.js` uses (export them from `activity.js` if private), `targets` (`{ x, y, z, r, hit(damage, { at }) }` per live soldier), `update(dt, you, t, { mate, bodies }) → shots` (`{ from, to, spread, damage, at: 'you' | 'mate' | id, who }`), `dispose`.

- [ ] **Step 1: `lodPick` move**: test file moved with it; `npx vitest run src/lib/three/lodPick.test.js src/components/deathstar` green; commit `"lodPick moves to lib/three: the Death Star and the galaxy share who's live, still and hidden"`.
- [ ] **Step 2: Build `groundScene.js`** per the responsibilities above. Keep it under 800 lines; split `groundFigures.js` (pool, animator, reactions, ragdoll later) from `groundScene.js` (update, targets, shots) from the start.
- [ ] **Step 3: Wire `scene.js`** as listed. Confirm `scene.js` grew by ≤ 30 lines net (`git diff --stat`).
- [ ] **Step 4: Browser check**: Tatooine unsworn: the pad's troopers stand and patrol as before (compare the before shot from Task 4); Endor as `rebel`: walk toward the pad, a patrol's `?` then `!`, it fires, you take damage, you kill one and it goes down with its die clip; walk 200 m out and back: the same patrol minus the dead. `BUDGET= node scripts/galaxy-check.mjs surface` on Endor high: ground update ≤ 2 ms (add the measure to `galaxy-check.mjs` if it does not time the scene's sub-updates: grep `BUDGET`).
- [ ] **Step 5: Full checks. Commit** — `"The ground fills in round you: the holder's soldiers at their posts and on their beats, cell by cell, and they fight you when the war says so"`. Open PR 2.

---

## PR 3: bolts that fly, soldiers against soldiers, the director's war, bodies that fall

### Task 9: `bolts.js`

**Files:**
- Create: `ground/bolts.js`, `ground/bolts.test.js`

**Interfaces:**
- Consumes: `sweptHit(a, b, c, r, h)` (`blaster.js:26`, pure), `seesThrough`.
- Produces: `createBolts({ speed: 90, life: 2 }) → { fire({ from: [x, y, z], dir: [x, y, z], side, owner, damage, range, target? }, rand) → bolt, step(dt, { bodies: [{ id, x, y, z, r, h, side }], seesThrough, you? }) → events, bolts }`; events `{ type: 'hit', bolt, target, at, dir } | { type: 'wall', bolt, at } | { type: 'near', bolt, target }` (a body within 2 m the bolt passed, once per bolt per body); a bolt whose `target === 'you'` is never resolved here: `step` returns `{ type: 'atYou', bolt }` and removes it, so the scene hands it to `blaster.enemy`; `farExchange(a, b, dt, rand, { aimError, damageOf }) → { hits: [{ from, to, damage }] }` (each side's shots due this `dt` by its weapon's `every`, hit when `rand() < 1 − clamp(aimError / spreadMax, 0, 0.9)`).

- [ ] **Step 1: Failing tests**: a bolt stops at a wall (`seesThrough` false between from and to: one `wall`, no `hit`); a hit swept across a long step (dt 0.5, the body 20 m along: `hit`); `near` once; `atYou` handed on, not resolved; `farExchange` over 10 s with two squads: the better-armed side's expected kills within a band; `an enemy bolt near an unsworn you is not a grudge` (bolts.js emits `near` with `target: 'you'`, and Task 10's director ignores it: assert in the director test).
- [ ] **Step 2–4: fail, implement, pass. Step 5: Commit** — `"Bolts that fly: a soldier's shot is swept against every body and stopped by the first wall, never a roll of the dice"`

### Task 10: `director.js`

**Files:**
- Create: `ground/director.js`, `ground/director.test.js`

**Interfaces:**
- Consumes: turf (`frontBetween`, `holderSide`, `strengthOf`), `population.reinforce`, `squadsOf`, `relation`.
- Produces: `RAID = 150`, `REINFORCE = 120`, `createDirector({ turfs, effects, tier, rand }) → { update(dt, { you, population, squads, seen: boolean }) → events, fights, posts }`; events `{ type: 'contact' | 'raid' | 'post-lost' | 'post-held' | 'hunt' | 'calm', side, at: [x, z], text }`; `posts: Map<postKey, { turf, holder: sideId, holders: id[] }>`; rules: a raid every `RAID / strength(far)` s while `effects.front || effects.attack`, squad of four made through `population.reinforce(cellOf(edge), specs)` at the far turf's near edge with `role: 'raid'`, target the nearest owner post; a post with every holder dead flips `holder` to the raiders' side (`post-lost`) and a `REINFORCE / strength` timer starts; reinforcement specs walk in from the nearest other post of the turf (`at` there, `home` the empty post), never made within 60 m of `you` in view (defer a frame at a time); at most two squads engaged at once within 200 m before a raid starts; `hunt` when `seen` on an enemy-held world (the nearest patrol's `beat` is replaced by `[[you.x, you.z]]`), `calm` when nobody has believed `you` for 20 s; toasts one every 12 s at most (`text` only on the first event of a kind in 12 s).

- [ ] **Step 1: Failing tests**: a raid staged at the front on schedule and not before; no raid while two fights run; post lost when holders are all dead, held again after reinforcement arrives (walked, not placed: the reinforcement's `at` is another post); reinforcement deferred while within 60 m of you; hunt then calm on timers; toast throttle; `near` on `'you'` never starts a hunt.
- [ ] **Step 2–4. Step 5: Commit** — `"The director: patrols that meet on the front, raids on a world the war is fighting over, posts lost and won back, and a hunt once you're seen"`

### Task 11: bodies: pooling, NPC-against-NPC on screen, ragdoll deaths

**Files:**
- Modify: `ground/groundFigures.js`, `ground/groundScene.js`
- Test: `ground/groundFigures.test.js` (the pool only: pure bookkeeping extracted as `createPool({ make })` → `{ take(kind, id), give(id) }`)

**Interfaces:**
- Consumes: `createBolts`, `createDirector`, `fightStep`, `farExchange`, `rigRagdoll` (`src/lib/three/ragdollPhysics.js`), `createReactions`, `blaster.tracer`, `blaster.enemy`.
- Produces in `groundScene.update`: all soldiers' bolts fired through `bolts.fire`, drawn with `blaster.tracer(from, to, colour by side)`, `hit` events into `troops.hurt` + reactions, `wall` into `fx.sparks` (the scene passes `fx`), `near` into `suppress`; `atYou` into the returned shots (as PR 2); fights past 60 m from you through `farExchange` each 0.5 s; director events returned as `events` for the page's toast (`scene.js` emits them on the scene's event channel the HUD already reads: grep `emit({ type: 'combat'`).
- Deaths: `down` within 40 m on `tier` high/ultra and under 4 live ragdolls → `rigRagdoll(bones, { collide, push: dir, speed: damage / 10 + 3, velocity })` with `collide` from `world.heightAt` and `world.solids` (`pushOut`); settled → `base` frozen, animator stopped, `DEATH.lie` then sink as `activity.js:138-141`; else the direction's die clip through `createReactions`.

- [ ] **Step 1: Failing test** `pool returns a figure only to its own kind` and `a dropped figure is reused for the next of its kind`.
- [ ] **Step 2–4. Step 5: Browser check** on Hoth as `rebel` with the war table showing Hoth a front (set the campaign clock or pick a world the current campaign fights over: `node -e` over `warTables(Date.now())` to list fronts): walk to the front, two patrols meet and fight, tracers both ways, one side breaks; a raid toast; a post lost; one soldier shot at 20 m on high falls as a ragdoll onto the slope. Record frame time (`BUDGET=`). Shots in the PR.
- [ ] **Step 6: Commit** — `"Soldiers fight each other: bolts between the sides, the dead fall as ragdolls, and the director's war runs round you"`

### Task 12: the HUD, and `scene.js`' bolt hand-off audit

**Files:**
- Modify: `src/pages/GalaxySurface.jsx:165-325` (director events to the existing toast: title the side, text the event's `text`), `scene.js` (the `atYou` branch goes through the same code as `activity.shooters`' bolts: `state.safe`, deflect, `grazes`, `hitFrom`)

- [ ] **Step 1: Wire** the toast. **Step 2: Audit** the hand-off against Review Focus 4 in the browser: dodge through a soldier's bolt (no damage); block with the saber (deflected).
- [ ] **Step 3: Commit** — `"The HUD tells the ground war's news, one line at a time"`

### Task 13: validity, the scenario test, docs

**Files:**
- Modify: `sites/validity.js`, `sites/validity.test.js` (section 11's five checks over `LANDABLE`, owner in `['rebel', 'empire', 'hutt']` × front on/off, using `turfsOf`, `covertFor`, `rosterFor` over the cells within radius of the pad)
- Create: `ground/ground.scenario.test.js` (add `'src/components/galaxy/surface/ground/*.scenario.test.js'` to `vitest.ai.config.js`'s `include`: today's globs do not cover it)
- Modify: `docs/architecture.md` (the surface's entry: a sentence on `ground/`), `docs/superpowers/HANDOFF-galaxy-surfaces.md` (a "The ground war" section: how to check it, the dev hooks, what is next: the spec's section 9 migrations)

- [ ] **Step 1: Validity tests** as section 11 lists; run `npx vitest run src/components/galaxy/surface/sites`; fix any site the test catches by moving the derived turf's candidate rules, never by skipping the site.
- [ ] **Step 2: Scenario test**: the five scenes in the spec's Testing section, on the rules only (population + fight + bolts + director stepped at 30 Hz for simulated minutes; `rand` seeded). Run `npm run test:ai -- ground`.
- [ ] **Step 3: Docs.** **Step 4: Full checks. Commit** — `"The ground war is checked on every world, played through in Node, and written up"`. Open PR 3.

---

## Follow-up plans (not this one)

Spec section 9, each its own plan and PR once PR 3 is merged and played: quest hostiles onto `troops.js`/`fight.js` (and the roll at `scene.js:2886` goes); the companion as a soldier of your side; assaults on the shared bolts and troops, Kashyyyk's far turf and map; talk and quests by side.

## Self-review notes

- Spec coverage: §1 Task 1; §2 Task 2; §3 Task 5; §4 Task 6; §5 Task 6; §6 Task 7; §7 Tasks 9, 10; §8 Tasks 3, 4; §9 follow-ups (listed); §10 Tasks 8, 11; §11 Task 13; Testing Task 13; HUD events Task 12.
- Names used across tasks: `turfsOf`, `holderSide`, `strengthOf`, `frontBetween` (5 → 6, 10); `createPopulation`'s `reinforce`, `died`, `move`, `cellOf` (6 → 10, 11); `fightStep`, `squadsOf`, `suppress`, `grudge`, `aimError` (7 → 9, 11); `createBolts` events `hit | wall | near | atYou` (9 → 11); `createDirector` events (10 → 12).
