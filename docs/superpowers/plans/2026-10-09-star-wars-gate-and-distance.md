# The universe further apart, the Star Wars gate, the jump and the names. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the owner chose inline execution, one PR merged at a time). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the universe's places 1.5x further apart, a Star Wars gate that reads as a galaxy from anywhere, one continuous jump into the galaxy, and one name per place with no collisions on either map.

**Architecture:** four PRs off `main`, each merged when its gates pass. PR 1 is numbers (`scale.js`'s `SPREAD` and the fixed distances that must follow it). PR 2 adds pure naming and label-ranking modules and moves `labelPlace.js` to `src/lib/`. PR 3 rebuilds `galaxy/gateway.js` as three small modules plus a landmark. PR 4 adds `flight.js`'s `gatePlan` and wires the scene, the jump overlay and the galaxy's arrival to it.

**Tech stack:** React 18, three.js, Vitest (Node, no jsdom), Playwright-core with the cached Chromium for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-09-star-wars-gate-and-distance-design.md`

## Global constraints

- `SPREAD = 6` (was 4). The Rick and Morty origin `[0, 0, -66000]`. The Expanse `SECTOR = 120000`. Online `FAR = 90000`. The camera's far plane 45,000.
- One name per place: `nameOf(u) = u.label`; `worldOf(u) = u.world`; `inSentence` lowercases a leading "The " or "A ".
- The gate jump's style is always lightspeed, whatever the crew.
- Rules in `docs/health/RULES.md` (layers, size, what may import what) and `.claude/skills/autopilot/SKILL.md` hold; prose comments in the repo's voice (no arrows, plain sentences).
- Before each PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; trial-merge against open branches (`git merge-tree --write-tree --name-only HEAD <branch>`), then `gh pr create` and `gh pr merge --merge`.

## Review focus

1. A pilot online on the old site (SPREAD 4) and one on the new (SPREAD 6) see each other at their raw coordinates: positions must still pass `protocol.js`'s bounds (`FAR`), never rejected. Test: a pose at z −70,000 passes.
2. A save from before (a parked ship at the old gate position, a stored Expanse sector id) must not put the ship inside a planet or outside every sector: `sectorOf` of an old stored point still returns a valid sector. Test in Task 1.
3. On a 340 px phone chart every name is inside the circle or dropped, never cut. Test in Task 4 (labelPlace with a circle bound).
4. A 3D name hidden by rank must fade, not flicker on alternate frames when two names are near-equal rank: rank ties break by id. Test in Task 5.
5. Picking Star Wars with reduced motion goes straight to `/galaxy` with no approach or tunnel. Test in Task 9 (`gatePlan` with `reduced`).

---

## PR 1: further apart

### Task 1: SPREAD 6 and the numbers that follow it

**Files:**
- Modify: `src/components/universe/scale.js` (`SPREAD = 6`, the comment's history line), `src/components/universe/universes.js:37` (`SPREAD = 6`)
- Modify: `src/components/universe/layout.js:50-51` (the Rick and Morty origin `[0, 0, -66000]`, its comment's numbers)
- Modify: `src/components/expanse/gen/grid.js:10` (`SECTOR = 120000`)
- Modify: `src/components/universe/online/protocol.js` (`FAR = 90000`, its comment)
- Modify: `src/components/universe/scene.js:485` (far plane `45000`), the whole-map view's cap (`scene.js` near 1362)
- Modify: `src/components/universe/flight.js` (`overviewPose` framing)
- Test: `scale.test.js`, `layout.test.js`, `deep.test.js`, `ship.test.js`, `nav.test.js`, `portals.test.js`, `expanse/gen/*.test.js`, `online/protocol.test.js`

- [ ] **Step 1:** change `scale.test.js`'s pin to `expect(SPREAD).toBe(6)` and add to `layout.test.js`:

```js
it('keeps the sectors apart with the spread', () => {
  expect(SECTORS.main.edge).toBe(54000);
  expect(SECTORS.rickmorty.origin[2] + SECTORS.rickmorty.edge).toBeLessThan(-SECTORS.main.edge);
  expect(sectorOf(0, 0, -66000)).toBe('rickmorty');
  expect(sectorOf(0, 0, -50000)).toBe('main');
  expect(sectorOf(130000, 0, 0)).toBe('E:1,0');
});
```

and to `online/protocol.test.js` a pose at `[0, 0, -70000]` that parses.
- [ ] **Step 2:** run `npx vitest run src/components/universe/scale.test.js src/components/universe/layout.test.js`: FAIL.
- [ ] **Step 3:** make the edits listed under Files.
- [ ] **Step 4:** run `npx vitest run src/components/universe src/components/expanse`; update every test that pins an old distance or trip time to the new measured number (not a looser bound), with its comment.
- [ ] **Step 5:** browser: the overview and a parked view at Middle-earth (the scratch harness's `overview`/`home` scenarios); worlds in frame, nothing clipped by the far plane.
- [ ] **Step 6:** commit `feat(universe): the places half as far apart again (SPREAD 6)`; gates; PR; merge.

## PR 2: names

### Task 2: one name per place

**Files:**
- Create: `src/components/universe/names.js`, `names.test.js`
- Modify: `nav.js:105-156` (destination `name` from `nameOf`, `sub` from `worldOf`), `NavMap.jsx` (sentences through `inSentence`, the list's subtitle), `UniverseMap.jsx:337` (Jump button), `regions.js:118`, `farFights.js:76`

**Interfaces:** Produces `nameOf(u) → string`, `worldOf(u) → string | null`, `inSentence(name) → string`.

- [ ] **Step 1:** test:

```js
import { inSentence, nameOf, worldOf } from './names';
import { byId } from './universes';
it('names a fandom by its fandom everywhere', () => {
  expect(nameOf(byId('starwars'))).toBe('Star Wars');
  expect(worldOf(byId('starwars'))).toBe('A galaxy far, far away');
  expect(nameOf(byId('marvel'))).toBe('Marvel');
});
it('lowercases a leading article mid-sentence', () => {
  expect(inSentence('The Maw')).toBe('the Maw');
  expect(inSentence('A galaxy far, far away')).toBe('a galaxy far, far away');
  expect(inSentence('Star Wars')).toBe('Star Wars');
  expect(inSentence('The Office')).toBe('The Office'); // (a title, kept: names.js's TITLES)
});
```

- [ ] **Step 2:** run, FAIL. **Step 3:** implement (`TITLES`: the fandom labels, never lowercased). **Step 4:** wire the callers; `nav.test.js` names updated. **Step 5:** commit.

### Task 3: labelPlace shared, in a circle

**Files:**
- Move: `src/components/galaxy/labelPlace.js` to `src/lib/labelPlace.js` (galaxy path re-exports); its test moves too.
- Modify: `src/lib/labelPlace.js` (an optional `bounds: { circle: [cx, cy, r] }`: a spot is out if any corner of its box is outside the circle)
- Test: `src/lib/labelPlace.test.js`

- [ ] **Step 1:** test: a name at the circle's right edge is placed to the left (inside), and one that can't fit anywhere is dropped (`placed[i] === null`).
- [ ] **Step 2–4:** FAIL, implement, PASS; galaxy tests still pass.
- [ ] **Step 5:** commit.

### Task 4: the M chart's names placed

**Files:** Modify `NavMap.jsx:380-402`, `navmap.css`; `nav.js` (the portal folded into Rick and Morty when within a name's height on the chart; the range rings retuned).

- [ ] Steps: test in `nav.test.js` that `chartNames(view, size)` (new, pure: returns `{ id, x, y, text, anchor }` for the shown names, placed by `labelPlace` with every dot an obstacle and the chart's circle the bound) gives no two overlapping boxes and no box over another dot at 340, 600 and 745 px; implement; `navmap-check.mjs` gains names-against-dots; commit.

### Task 5: 3D names give way

**Files:** Create `src/components/universe/labelRank.js` + test; modify `scene.js` (`placeLabels` and `deepspace.js`'s names through it), `deepspace.js` (sector filter, far-plane clamp), `front.js` (sector filter).

**Interfaces:** `rankLabels(items: [{ id, x, y, w, h, picked, aimed, going, dist }]) → Set<id>` of the shown ones.

- [ ] Steps: tests (a picked name beats a nearer one; ties by id; non-overlapping all shown); implement; wire with a 0.2 s opacity ease; commit.

### Task 6: MiniMap and the galaxy map

**Files:** `MiniMap.jsx` (stations folded into "Home system" at whole scale), `galaxy/HoloMap.jsx:311-361` (region names' boxes as `labelPlace` obstacles), `galaxy/MapSvg.jsx` (Wild Space tag), `scripts/galaxy-map-check/lib.mjs` (region names measured).

- [ ] Steps: labelPlace test with a region obstacle on Mandalore's right; implement; galaxy map check; commit; gates; PR; merge.

## PR 3: the gate

### Task 7: the painted spiral and the stars

**Files:** Create `src/components/galaxy/gateway/galaxyDisc.js` (+ test of the painter's pure density function `armDensity(r, a)`), modify `gateway.js` to use it; star shader sized by projection (`uProj = renderer height / (2·tan(fov/2))`, set in `update`), dimmed by distance.

- [ ] Steps: test that `armDensity` peaks on the two arms and falls off past the rim; implement painter + three stacked discs; browser shots at 500/1500/4000; commit.

### Task 8: ring, pylons, surface, light, far landmark

**Files:** Create `gateway/ring.js`, `gateway/lod.js` (+ test: `gateWeights(dist) → { landmark, real }` crossfading over the last fifth before `realAt`, summing to 1); modify `planets.js`'s `BUILDERS.starwars` (a blue `PointLight` reach 600), `landmarks.js` (the gate's spiral as a landmark, least 3°), `farStars.js` (the gate isn't a far star: it's a landmark).

- [ ] Steps: test; implement; browser shots from home, 4000, 1500, 500, side; commit; gates; PR; merge.

## PR 4: the jump

### Task 9: gatePlan

**Files:** Modify `flight.js` (`gatePlan({ reduced })` → `[{ phase: 'approach', ms: 1100 }, { phase: 'through', ms: 350 }, { phase: 'jump', style: 'lightspeed' }]`, or `[{ phase: 'go' }]` reduced); `flight.test.js`.

- [ ] Steps: tests (phases and times; reduced goes; the style lightspeed for the cruiser and the RV); implement; commit.

### Task 10: the scene flies through

**Files:** `scene.js` (an `approach` that steers the ship at the gate's centre and the chase camera behind; the plane crossing emits `portal`; `state.through` reset on start; portal bodies not solid in `ship.js`); `Universe.jsx` (`go` for the gate runs `gatePlan`, `jumpOut` with `style: 'lightspeed'` entered at its streak phase); the gate's surface quickens during approach.

- [ ] Steps: `ship.test.js`: a ship flown into a portal body's plane inside its ring isn't pushed out; implement; browser jump frames; commit.

### Task 11: the card over the tunnel, the arrival

**Files:** `GalaxyView.jsx` / `GalaxyIntro.jsx` (the card drawn above the held tunnel; the hold released when drawn and the card done), `jumps/` overlay (darkening eased), `galaxy/scene.js` (arrival runs the `hyperspaceExit` with an eased FOV), prefetch when the gate's in view (`Universe.jsx`, `scene.js` emitting `gate-near`).

- [ ] Steps: `jumpIn.test.js` (hold until both drawn and card done); implement; `scripts/gate-check.mjs` with the black-frame probe; commit; gates; PR; merge.
