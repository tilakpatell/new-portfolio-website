# The galaxy's ground (Kashyyyk, sides, AI, look, layouts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. One pull request per PR section; merge each once CI is green before starting the next (the repo's convention: merge commits, never rebase, never red).

**Goal:** Kashyyyk's battle works and makes sense, the ground respects the war and your side, the soldiers fight intelligently, the ground looks modern, and the worst planet layouts are fixed.

**Architecture:** Pure, Node-tested rules modules (`siteWar.js`, `standing.js`, `landing.js`, the AI rules) wired into the existing surface scene (`src/components/galaxy/surface/scene.js`), the quest/activity system and the assault engine; site data edits in `surface/sites/*.js`; rendering changes in `lib/three/house.js`, `surface/ground.js`, `surface/scene.js`, `universe/post.js`.

**Tech Stack:** React 19, three.js, Vite, Vitest (Node), Playwright-core + Chromium for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-07-ground-sides-kashyyyk-look-ai-design.md`

## Global Constraints

- Every rules module is pure (no three.js, no DOM), seeded through a `rand` argument where needed, and tested in Node first (`npx vitest run <path>`).
- Gates before every commit that ends a task: `npx vitest run src/components/galaxy` passes, `npx eslint <changed files>` is clean. Before every PR: `npm test`, `npm run lint`, `npm run build`.
- Match the codebase's voice: comments in plain British English, explaining *why*, as the surrounding files do; no TypeScript.
- Do not touch Mustafar's or Nevarro's layouts (`sites/edge.js` mustafar, `sites/outer.js` nevarro): open work elsewhere.
- In `walker.js`, add new functions; do not rewrite existing lines (PR #566 edits them).
- Frame time on `high` must stay within 2 ms of before for the look's changes (measured with `window.__surface().ms`).
- Browser checks use the scratch driver: Vite in-process on port 5291 with `hmr: false`, Chromium `--use-angle=metal --disable-gpu-vsync --disable-frame-rate-limit`, localStorage `tp-3d=on`, `tp-intro=1`, `tp-sound=off`; `window.__surface()`, `window.__surfaceDo(name, …)`, `window.__surfaceScene` (DEV only).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A quest whose enemies spawn somewhere they can't reach you (under water, inside a solid, leash shorter than the gap) — the validity test (Task 1) must catch it for every site, not only Kashyyyk.
2. A player unsworn in a world's war must be able to do everything they can today (talk, quests, land at the pad) — Task 7's tests pin "unsworn changes nothing".
3. Swearing mid-visit (the assault's choose card) must re-evaluate the garrison and the givers without a reload — Task 9 pins it.
4. Bolts against solids must not stop bolts at invisible or `solid: false` things, and a box lower than the bolt must be shot over — Task 11 pins both.
5. The look's changes must not break `low`/`mid` tiers or the space view sharing `universe/post.js` — Task 17 and 18 pin the tier switches.

---

## PR 2 — Kashyyyk's battle and the validity guard

### Task 1: The validity test for every site's spawns, givers and posts

**Files:**
- Create: `src/components/galaxy/surface/sites/validity.test.js`
- Create: `src/components/galaxy/surface/sites/validity.js` (pure helpers the test and later tasks use)

**Interfaces:**
- Produces: `heightFor(site) → (x, z) => number` (the site's height field with its flats and pits: `makeHeight({ ...site.ground, flats: site.flats, pits: site.pits })`); `standable(site, [x, z], { wade = 0.8 } = {}) → boolean` (ground at least 0.2 m above `site.water.level`, or no deeper than `wade` under it when the spawn says `wade: true`; always true with no water); `spawnProblems(site) → string[]` (every hostile spawn of every quest step: not standable, or `leash` shorter than the distance from its `at` to the step's `at`/the giver); `namedTwice(site) → string[]` (named life entries — `named: true` or a quest giver `id` — whose `name` appears more than once).

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { SITES, siteOf } from '.';
import { ASSAULTS } from '../missions/assaults';
import { heightFor, namedTwice, spawnProblems, standable } from './validity';

describe('every world can be played as written', () => {
  for (const id of Object.keys(SITES)) {
    const site = siteOf(id);
    it(`${id}: every quest's enemies stand somewhere they can come to you from`, () => {
      expect(spawnProblems(site)).toEqual([]);
    });
    it(`${id}: nobody named is there twice`, () => {
      expect(namedTwice(site)).toEqual([]);
    });
    it(`${id}: every quest giver stands on dry ground`, () => {
      for (const a of site.life.filter((l) => l.quest)) expect(standable(site, a.at), a.id).toBe(true);
    });
  }
  for (const [id, m] of Object.entries(ASSAULTS)) {
    it(`the battle on ${id}: every post on dry ground`, () => {
      const site = siteOf(m.system);
      for (const p of m.posts) expect(standable(site, p.at), p.id).toBe(true);
    });
  }
  it('knows the lagoon from the beach (Kashyyyk)', () => {
    const site = siteOf('kashyyyk');
    expect(heightFor(site)(40, 40)).toBeGreaterThan(0.2);
    expect(standable(site, [150, 120])).toBe(false);
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/components/galaxy/surface/sites/validity` — FAIL: module not found.
- [ ] **Step 3: Implement `validity.js`.** `spawnProblems` walks `site.quests[].steps[]` whose `spawn` (one or an array) has `hostile`; for each spawn compute `standable(site, sp.at, { wade: sp.wade ? 0.8 : 0 })` and the reach: `target = step.at ?? giverAt(site, quest.giver)` (`giverAt` finds the life entry with `id === quest.giver`), `need = hypot(sp.at − target) − 6` (6 m: where the fight can reach you from), `leash = sp.leash ?? (sp.roam ?? 8) + 10 + (sp.hostile.range ?? 30)` (the leash plus its firing range: it can hit you from its tether); a problem when `need > leash` and the step has no `respawn`. Steps in a zone (`st.zone`) and spawns with `level` (floors) are skipped (their ground is a floor). Messages read `"<quest>/<tag>: under water at [x,z] (−3.8 m)"` / `"<quest>/<tag>: leash 16 m, 73 m to go"`.
- [ ] **Step 4: Run it** — expect the Kashyyyk beachhead failure (and any others it finds). Record every failure that is not Kashyyyk's in the PR description; fix the cheap ones in the owning site file in this task (move the spawn to standable ground near the old one, or raise `leash`); any that need layout work go to PR 6's task list.
- [ ] **Step 5: Commit** — "A test that every world's quests can be played: enemies on dry ground, in reach, no one named twice".

### Task 2: Kashyyyk's beach, reshaped

**Files:**
- Modify: `src/components/galaxy/surface/sites/forest.js` (kashyyyk: `ground.flats`, places `beach`, `lagoon`, `command`, `kachirho`, `things`, `life`, `water`)
- Modify: `src/components/galaxy/surface/sites/quests.js` (kashyyyk `life`: Gree and Tarfful positions)
- Modify: `src/components/galaxy/surface/props/forest.js` (the `barricade` prop's solid `top`)
- Test: `src/components/galaxy/surface/sites/validity.test.js` (add Kashyyyk cases)

**Interfaces:**
- Consumes: `heightFor`, `standable` (Task 1).
- Produces: Kashyyyk's battlefield coordinates used by Tasks 3–4: the beach `[-20…120, 0…70]` at about +1.0 m, the shallows `[0…120, 75…105]` at −0.3 to −0.6 m (the droids' wading ground), the barricade line at z ≈ 58, the command post at `[-60, 10]`.

- [ ] **Step 1: Write the failing tests** (append to `validity.test.js`):

```js
describe('Kashyyyk, as Revenge of the Sith has it', () => {
  const site = siteOf('kashyyyk');
  const h = heightFor(site);
  it('has a beach in front of the landing, and shallows in front of the beach', () => {
    for (const x of [0, 40, 80, 110]) expect(h(x, 40), `beach ${x}`).toBeGreaterThan(0.4);
    for (const x of [20, 60, 100]) {
      expect(h(x, 90), `shallows ${x}`).toBeLessThan(0);
      expect(h(x, 90), `shallows ${x}`).toBeGreaterThan(-0.8);
    }
  });
  it('faces its barricades to the water, in front of the cover', () => {
    const bar = site.things_all.filter((t) => t.kind === 'barricade');
    expect(bar.length).toBeGreaterThanOrEqual(4);
    for (const b of bar) expect(b.at[1]).toBeGreaterThan(50);
  });
  it('puts the spider-droid wreck on the sand, not in the lagoon', () => {
    const w = site.things_all.find((t) => t.kind === 'homingspider');
    expect(standable(site, w.at)).toBe(true);
  });
  it('has one Gree and one Tarfful, both where you can talk to them', () => {
    const named = site.life.filter((a) => /Gree|Tarfful/.test(a.name ?? ''));
    expect(named.map((a) => a.name).sort()).toEqual(['Commander Gree', 'Tarfful']);
    const tarfful = named.find((a) => a.name === 'Tarfful');
    // (outside Kachirho's trunk: 18 m round its middle)
    expect(Math.hypot(tarfful.at[0] + 140, tarfful.at[1] + 30)).toBeGreaterThan(22);
  });
  it('has no droids wandering the lagoon floor', () => {
    for (const a of site.life.filter((l) => ['battledroid', 'superdroid', 'dwarfspider'].includes(l.kind))) {
      for (const p of a.path ?? [a.at]) expect(standable(site, p), `${a.kind} at ${p}`).toBe(true);
    }
  });
});
```

(`site.things_all`: check `sites/index.js`'s `siteOf` return for the gathered things list's real name — the sites test uses `site.things_all`; use the same.)

- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/sites/validity` — FAIL on each.
- [ ] **Step 3: Implement the site edits:**
  - `ground.flats` (Kashyyyk had none; `siteOf` adds the land's and places' flats after these): add `{ at: [50, 35], r: 62, edge: 26, h: 1.0 }` (the beach) and `{ at: [60, 92], r: 52, edge: 22, h: -0.45 }` (the shallows where the droids land). Remove the `beach` place's own `flat` (it was the 1.2 m spit) — keep the place, `at: [50, 40]`, `r: 60`.
  - Barricades (beach place `things`, coordinates relative to the place's `at`): five sharpened-log barricades on the waterline facing south, `{ kind: 'barricade', at: [-50, 18], yaw: 0.05, opts: { len: 12 } }`, `[-25, 20]`, `[0, 19]`, `[25, 20]`, `[50, 18]` (yaws 0, −0.05, 0.03, 0.05, −0.04) — absolute z ≈ 58–60. Cover in front of them on the sand (absolute z 64–74): `crates` at [10, 66] and [86, 70], `rock` (scale 1.6) at [40, 70] and [−10, 72], `log` at [64, 66] yaw 0.2. The stores (crates, lamp) stay behind at z ≈ 30.
  - `props/forest.js` `barricade`: its box solid gains `top: 1.25` (find the `barricade(k, o)` builder's `solids: [{ box: … }]`; add the `top` key — the `walker.js` solids' box takes `{ top }` as the hostile line-of-sight code reads it: check `world.solids.box`'s signature in `walker.js` and pass it the way other props with `top` do, e.g. grep `top:` in `props/*.js`).
  - The wreck: `homingspider` and its `wrecksmoke` from `[128, 92]` to `[96, 50]` (on the sand at the beach's east end).
  - `command` place: from `[180, -150]` to `[-60, 10]` (by Kachirho's foot, overlooking the beach), `flat: { r: 14 }`; its `about` keeps the Order 66 story. Life: Yoda `[182,-146]` → `[-58, 8]`; the second "Commander Gree" life entry is removed; its two clones move to `[-64, 14]`.
  - Tarfful (quests.js life `tarfful`): `[-130, -24]` → `[-112, -12]` (Kachirho's foot, outside the trunk), `face: -0.6`. The pod's `Tarfful` life entry (`[-125, -374]`) is removed; Chewbacca stays.
  - Gree (quests.js life `gree`): `[48, 30]` → `[30, 28]` (behind the line, by the stores), `face: 0.2`.
  - Life: remove the `battledroid`, `dwarfspider` and `superdroid` entries; the beach's `wookiee` (n 6) and `clone` (n 5) entries become defenders: `{ kind: 'clone', n: 5, at: [50, 54], spread: 40, still: true, face: 0, … }` and `{ kind: 'wookiee', n: 4, at: [50, 52], spread: 40, still: true, face: 0, … }` keeping their `says`; the AT-RTs' path moves behind the line (`[[0, 40], [60, 36], [110, 40], [60, 36]]`), the AT-AP to `[[20, 30], [90, 30]]`.
  - `water`: add `wadeMax: 1.2` (used by Task 3).
- [ ] **Step 4: Run** the validity tests and `npx vitest run src/components/galaxy/surface/sites` — PASS. Fix any coordinate the tests reject (the height grid in Task 2's Step 1 is the truth; re-sample with a scratch `heightFor` print if needed).
- [ ] **Step 5: Browser check** — Kashyyyk top-down (`topdown.mjs`, half 200) and the landing view; the beach reads as a beach, barricades on the waterline. Commit: "Kashyyyk's beach as the film has it: a shore in front of Kachirho, the barricades on the waterline, the wreck on the sand, one Gree and one Tarfful where you can reach them".

### Task 3: Deep water is a wall on Kashyyyk

**Files:**
- Modify: `src/components/galaxy/surface/walker.js` (a new exported function, no edits to existing lines except one call)
- Test: `src/components/galaxy/surface/walker.test.js`

**Interfaces:**
- Produces: `tooDeep(world, x, z) → boolean` — true when `world.wadeMax != null && world.water != null && world.water − world.heightAt(x, z) > world.wadeMax`. `world.wadeMax` is set from `site.water.wadeMax` where the world object is made (`surface/scene.js`, where `world.water` is set — grep `water:` in the world construction).

- [ ] **Step 1: Failing test:**

```js
it('stops you at the deep water where a world says so', () => {
  const world = { water: 0, wadeMax: 1.2, heightAt: (x) => (x < 10 ? 0.5 : -3), solids: emptySolids(), floors: [] };
  expect(tooDeep(world, 5, 0)).toBe(false);
  expect(tooDeep(world, 20, 0)).toBe(true);
  expect(tooDeep({ ...world, wadeMax: undefined }, 20, 0)).toBe(false);
});
it('walking into the deep water goes nowhere', () => {
  // (use the file's existing walk helper and a walker at x 9 pushing +x for a second)
});
```

(Write the second test with the file's own walker-step helper as the existing wading tests do; assert `s.x` stays under 10.2.)

- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/walker` — FAIL.
- [ ] **Step 3: Implement** `tooDeep`, and in the on-foot step, after the move is computed and before it is applied, reject the horizontal move (keep x, z) when `tooDeep(world, nx, nz) && !tooDeep(world, s.x, s.z)` — one guarded line where the new position is committed. Hostiles (`activity.js` movement) and actors use the same check where they commit a move (one line each).
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** — "Kashyyyk's lagoon is deep past the shallows: no more wading out to the karsts".

### Task 4: The Battle of Kashyyyk: the quest's waves with allies, and no re-dressing

**Files:**
- Modify: `src/components/galaxy/surface/sites/quests.js` (kashyyyk `beachhead`)
- Modify: `src/components/galaxy/surface/scene.js:387` (`questOf`: stop calling `garrisonQuest`)
- Modify: `src/components/galaxy/surface/garrison.js` (remove `garrisonQuest`) and `garrison.test.js`
- Test: `validity.test.js` (Task 1's spawn checks now pass for Kashyyyk), `quests.test.js`

**Interfaces:**
- Consumes: the beach/shallows coordinates (Task 2).
- Produces: quest `beachhead` with three `shoot` steps tagged `lagoondroids` (the tag the war counts).

- [ ] **Step 1: Failing test** (in `validity.test.js`):

```js
it('Kashyyyk: the droids come out of the shallows in three waves, with clones and Wookiees beside you', () => {
  const q = siteOf('kashyyyk').quests.find((x) => x.id === 'beachhead');
  const shoots = q.steps.filter((s) => s.type === 'shoot');
  expect(shoots).toHaveLength(3);
  for (const s of shoots) {
    const spawns = [].concat(s.spawn);
    expect(spawns.some((sp) => sp.side === 'yours')).toBe(true);
    for (const sp of spawns.filter((x) => x.hostile)) {
      expect(sp.at[1]).toBeGreaterThan(75); // out of the water
      expect(sp.wade).toBe(true);
    }
    expect(s.at).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the quest (keep id, name, giver, intro, done):

```js
const LAGOON = { leash: 90, roam: 8, tag: 'lagoondroids', wade: true };
steps: [
  { type: 'shoot', tag: 'lagoondroids', n: 6, at: [50, 62], text: 'The first wave: hold the barricades',
    spawn: [
      { ...LAGOON, kind: 'battledroid', n: 6, at: [50, 92], spread: 30, hp: 1, hostile: { ...H(45, 2.4, 7), chase: 1.2 } },
      { kind: 'clone', n: 2, at: [30, 56], spread: 10, roam: 4, hp: 4, side: 'yours', hostile: H(45, 1.6, 6) },
      { kind: 'wookiee', n: 2, at: [70, 56], spread: 10, roam: 5, hp: 5, side: 'yours', hostile: H(30, 1.4, 8) },
    ] },
  { type: 'shoot', tag: 'lagoondroids', n: 6, at: [50, 62], text: 'The second wave: the super battle droids',
    spawn: [
      { ...LAGOON, kind: 'battledroid', n: 4, at: [30, 94], spread: 24, hp: 1, hostile: { ...H(45, 2.4, 7), chase: 1.2 } },
      { ...LAGOON, kind: 'superdroid', n: 2, at: [80, 94], spread: 16, hp: 3, hostile: { ...H(40, 1.6, 8), chase: 0.9, burst: { n: 3, gap: 0.15 } } },
      { kind: 'clone', n: 2, at: [30, 56], spread: 10, roam: 4, hp: 4, side: 'yours', hostile: H(45, 1.6, 6) },
      { kind: 'wookiee', n: 2, at: [70, 56], spread: 10, roam: 5, hp: 5, side: 'yours', hostile: H(30, 1.4, 8) },
    ] },
  { type: 'shoot', tag: 'lagoondroids', n: 6, at: [50, 62], text: 'The last wave: droidekas',
    spawn: [
      { ...LAGOON, kind: 'droideka', n: 2, at: [50, 95], spread: 12, hp: 2, hostile: { ...H(40, 1.8, 7), shield: 3, burst: { n: 2, gap: 0.12 }, chase: 1.6 } },
      { ...LAGOON, kind: 'battledroid', n: 4, at: [90, 92], spread: 20, hp: 1, hostile: { ...H(45, 2.4, 7), chase: 1.2 } },
      { kind: 'clone', n: 2, at: [30, 56], spread: 10, roam: 4, hp: 4, side: 'yours', hostile: H(45, 1.6, 6) },
      { kind: 'wookiee', n: 2, at: [70, 56], spread: 10, roam: 5, hp: 5, side: 'yours', hostile: H(30, 1.4, 8) },
    ] },
],
```

(`H(range, every, damage)` is the file's existing hostile helper; check its signature at the top of `quests.js`. `wade: true` spawns stand on the shallows' ground under the water: in `activity.js`, where a spawn's height is set from `groundAt`, keep that height — they wade — and the validity test accepts them because `wade` allows 0.8 m.)

  Then remove `garrisonQuest` from `garrison.js` (and its tests and import), and make `scene.js`'s `questOf` return the quest unchanged:

```js
const questOf = (id) => site.quests.find((q) => q.id === id) ?? (mission?.quest?.id === id ? mission.quest : null);
```

- [ ] **Step 4: Run** `npx vitest run src/components/galaxy` — PASS.
- [ ] **Step 5: Browser check** (scenario): land on Kashyyyk, `__surfaceDo('teleport', 30, 26, 0)`, start the quest by talking to Gree (press `e` near him), then poll `__surface().fight` for 20 s: expect hostile entries appearing with `z` decreasing toward 60 and ally entries firing. Screenshot at the barricades facing south mid-wave. Commit: "The Battle of Kashyyyk's waves come out of the shallows at the barricades, with clones and Wookiees beside you; quests keep the enemies they were written with".

### Task 5: The full Battle of Kashyyyk (assault map) and space's weight

**Files:**
- Modify: `src/components/galaxy/surface/missions/assaults.js` (add `kashyyyk` between `endor` and `coruscant`)
- Modify: `src/components/galaxy/systems.js` (kashyyyk `also`, `war.weight: 3`)
- Modify: `src/components/galaxy/battles.js:202` (NAMES)
- Test: `src/components/galaxy/surface/missions/assault.test.js` (or the file that tests `ASSAULTS`; grep `ASSAULTS` in `*.test.js`), `validity.test.js` (posts on dry ground — already generic)

- [ ] **Step 1: Failing test:**

```js
it('Kashyyyk: the droids come for the beach, the gun line and Kachirho', () => {
  const m = ASSAULTS.kashyyyk;
  expect(m.sides.attack.id).toBe('separatists');
  expect(m.sides.defend.kinds.map(([k]) => k)).toEqual(expect.arrayContaining(['clone', 'wookiee']));
  expect(m.phases.map((p) => p.posts.length).every((n) => n > 0)).toBe(true);
  const b = newBattle(m, { n: 6, seed: 3 });
  expect(b.posts.find((p) => p.fixed === 'attack')).toBeTruthy();
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement:**

```js
  kashyyyk: {
    id: 'assault',
    system: 'kashyyyk',
    kind: 'assault',
    name: 'The Battle of Kashyyyk',
    line: 'The droid army is wading out of the lagoon. The clones and the Wookiees hold the beach at Kachirho, or the city falls.',
    ride: null,
    start: [10, 0],
    yaw: 3.0,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: { attack: SEPARATISTS, defend: { ...REPUBLIC, name: 'The Republic and the Wookiees', short: 'Republic', kinds: [['clone', 2], ['wookiee', 1]] } },
    posts: [
      { id: 'shallows', name: 'The droids’ landing', at: [60, 96], r: 22, fixed: 'attack' },
      { id: 'barricades', name: 'The barricades', at: [50, 58], r: 24 },
      { id: 'gunline', name: 'The gun line', at: [40, 20], r: 20 },
      { id: 'command', name: 'The command post', at: [-60, 10], r: 16 },
      { id: 'lift', name: 'Kachirho’s lift', at: [-112, -14], r: 14, fixed: 'defend' },
    ],
    phases: [
      { name: 'The beach', posts: ['barricades'], tickets: 90 },
      { name: 'The gun line', posts: ['gunline'], tickets: 70 },
      { name: 'The command post', posts: ['command'], tickets: 60 },
    ],
    tickets: { attack: 100, defend: 150 },
    forward: 60,
    hideLife: ['clone', 'wookiee', 'atrt', 'atap'],
    lines: /* copy the shape of endor's `lines` (start, won, lost by crew) with Kashyyyk's words */,
    barks: { attack: ['Roger, roger.', 'Move, move, move.', 'Wookiees! Uh…'], defend: ['Hold the line!', 'Here they come!', '(A Wookiee roar along the barricades.)'] },
    ends: /* copy the shape of endor's `ends` with Kashyyyk's words */,
  },
```

Write `lines` and `ends` in full, following `endor`'s structure exactly (read it at `assaults.js:224-285`): the words are the implementer's to write in the crews' voices, as `endor`'s are. Then `systems.js` kashyyyk: `war: { worth: 1, weight: 3, kind: 'blockade', area: 'core' }` and

```js
also: [{ id: 'assault', title: 'The Battle of Kashyyyk', text: 'A galactic assault on the shore at Kachirho: the droid army wades out of the lagoon for the barricades, the gun line and the command post, and the clones and Wookiees hold each as long as they can. Fight for either side.', to: '/galaxy/kashyyyk/surface?mission=assault', go: 'Fight it now' }],
```

placed where Hoth's `also` sits in its entry. `battles.js:202`: `kashyyyk: 'The Battle of Kashyyyk'`.
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy` — PASS (fix any test that asserts `weight` values or NAMES).
- [ ] **Step 5: Browser check** — `#/galaxy/kashyyyk/surface?mission=assault`, choose defend, wait 30 s, `__surface().mission` shows soldiers up on both sides and a post meter moving; screenshot. Commit: "The Battle of Kashyyyk as a galactic assault, and the Separatists come for Kashyyyk more often in the sky". Open PR 2.

---

## PR 3 — The ground's war and sides

### Task 6: `siteWar.js`, `oathIn`, `groundEffects`

**Files:**
- Create: `src/components/galaxy/siteWar.js`, `src/components/galaxy/siteWar.test.js`
- Modify: `src/components/galaxy/allegiance.js` (add `oathIn`), `allegiance.test.js`
- Modify: `src/components/galaxy/battleLines.js:29` (`PLACES` re-exported from `SITE_WAR`)

**Interfaces:**
- Produces: `SITE_WAR: { [sysId]: 'clone'|'gcw'|'remnant' }`; `siteWarOf(sysId, theatre) → war` (the table's, else the theatre); `oathIn(a, war) → { war, side, sworn, turncoat }`; `groundEffects(sysId, a, now = Date.now()) → effects & { side, rank, war }` (null when `effectsFor` is null).

- [ ] **Step 1: Failing tests:**

```js
import { SITE_WAR, groundEffects, siteWarOf } from './siteWar';
import { readAllegiance, swear } from './allegiance';
import { LANDABLE } from './surface/sites';

it('stages every world you can land on in a war', () => {
  for (const id of LANDABLE) expect(['clone', 'gcw', 'remnant'], id).toContain(SITE_WAR[id]);
  expect(SITE_WAR.geonosis).toBe('clone');
  expect(SITE_WAR.kashyyyk).toBe('clone');
  expect(SITE_WAR.endor).toBe('gcw');
  expect(SITE_WAR.sorgan).toBe('remnant');
});
it('reads the ground in its own war, with your oath in that war', () => {
  const rebel = swear(readAllegiance(null), 'rebel');
  const e = groundEffects('geonosis', rebel, 0);
  expect(e.war).toBe('clone');
  expect(e.side).toBe(null); // (sworn in the Civil War, not the Clone Wars)
  expect(e.troops).not.toBe('stormtrooper');
  const endor = groundEffects('endor', rebel, 0);
  expect(endor.side).toBe('rebel');
  expect(typeof endor.rank).toBe('number');
});
it('falls back to the theatre for a world not in the table', () => {
  expect(siteWarOf('nowhere', 'gcw')).toBe('gcw');
});
```

and in `allegiance.test.js`: `oathIn(a, 'clone')` on a Rebel oath gives `{ war: 'clone', side: null, sworn: 0 }`-shaped unsworn; `oathIn(a, 'gcw').side === 'rebel'`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** `oathIn = (a, war) => ({ ...unsworn(war), ...(a.oaths[war] ?? {}), war })` beside `current` (reuse the file's `unsworn`). `groundEffects` moves the page's `effects` memo body (`GalaxySurface.jsx:122-128`) into a pure function, parameterised by war: `const war = siteWarOf(sysId, a.war); const oath = oathIn(a, war); const e = effectsFor(sysId, warNow(now, war), oath); if (!e) return e; const rank = oath.side ? rankOf(oath.side, mine(war).points) : null; return { ...e, war, side: oath.side ?? null, rank: rank ? (RANKS[oath.side]?.findIndex((r) => r.id === rank.id) ?? 0) : 0 };` (import `warNow`, `mine`, `rankOf`, `RANKS` from where `GalaxySurface.jsx` imports them; `mine` reads storage — keep it as the page does, since it's already used there). `PLACES` in `battleLines.js` becomes `export { SITE_WAR as PLACES } from './siteWar'` only if `battleLines` tests still pass with the fuller table; otherwise leave `PLACES` alone and note why in a comment.
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy` — PASS.
- [ ] **Step 5: Commit** — "Every world's ground is staged in its film's war, and read with your oath in that war".

### Task 7: `standing.js`: friend, foe or neither

**Files:**
- Create: `src/components/galaxy/surface/standing.js`, `standing.test.js`

**Interfaces:**
- Produces: `sideOfKind(kind, war) → side id | 'native' | null`; `NATIVE_LEANS: { [kind]: 'light' | 'dark' | null }`; `standingOf(entry, effects) → 'ally' | 'enemy' | 'neutral'` where `entry` is a life entry / quest giver (`{ kind, side?, leans? }`) and `effects` is `groundEffects`'s.

- [ ] **Step 1: Failing tests:**

```js
const rebelOnEndor = { war: 'gcw', side: 'rebel', owner: 'empire' };
const unsworn = { war: 'gcw', side: null, owner: 'empire' };
it('a stormtrooper is a Rebel’s enemy, nobody’s when you are unsworn', () => {
  expect(standingOf({ kind: 'stormtrooper' }, rebelOnEndor)).toBe('enemy');
  expect(standingOf({ kind: 'stormtrooper' }, unsworn)).toBe('neutral');
});
it('your own side is your ally', () => {
  expect(standingOf({ kind: 'rebel' }, rebelOnEndor)).toBe('ally');
});
it('an Ewok leans to the light side; a Jawa to nobody', () => {
  expect(standingOf({ kind: 'ewok' }, rebelOnEndor)).toBe('ally');
  expect(standingOf({ kind: 'ewok' }, { ...rebelOnEndor, side: 'empire' })).toBe('neutral');
  expect(standingOf({ kind: 'jawa' }, rebelOnEndor)).toBe('neutral');
});
it('an entry’s own side wins over its kind (Gree is the Republic’s whatever he wears)', () => {
  expect(standingOf({ kind: 'clone', side: 'republic' }, { war: 'clone', side: 'separatists' })).toBe('enemy');
});
it('stormtroopers are the Remnant’s in the Remnant War', () => {
  expect(sideOfKind('stormtrooper', 'remnant')).toBe('remnant');
  expect(sideOfKind('stormtrooper', 'gcw')).toBe('empire');
});
it('the Hutts are nobody’s ally and nobody’s enemy on the ground', () => {
  expect(standingOf({ kind: 'mercenary' }, rebelOnEndor)).toBe('neutral');
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** with tables: trooper families (from `garrison.js` FAMILIES) plus `droideka`, `dwarfspider`, `homingspider` → separatists; `deathtrooper`, `shoretrooper`, `probe`, `atst`, `atat` → the war's dark Imperial side (`empire` in gcw, `remnant` in remnant); `clonephase1`, `atrt`, `atap`, `atte` → republic; `rebelpilot` → the war's light side. The light/dark of a war comes from `WARS[war].liberator` / `.raider` (`sides.js`). `NATIVE_LEANS`: wookiee light, ewok light, gungan light, geonosian dark, kaminoan null, jawa null, tusken null, villager null. **Step 4: Run** — PASS. **Step 5: Commit** — "standing.js: who on the ground is your ally, your enemy or neither, by the world's war and your oath in it".

### Task 8: Where you set down: `landing.js` and covert spots

**Files:**
- Create: `src/components/galaxy/surface/landing.js`, `landing.test.js`
- Modify: `src/components/galaxy/surface/sites/*.js` (add `covert: { at, yaw }` to Endor, Hoth, Yavin, Scarif, Bespin, Tatooine, Naboo, Geonosis, Kamino, Kashyyyk, Coruscant, Mandalore, Lothal, Sorgan, Dagobah — each 120–250 m from `land.at`, out of sight of the pad behind terrain or forest; choose with a top-down shot per site)
- Modify: `src/components/galaxy/surface/scene.js` (where `site.land` positions the ship and you: use `landingFor`)

**Interfaces:**
- Produces: `landingFor(site, effects, height) → { at, yaw, covert, line }`; `covertFor(site, height) → [x, z]`.

- [ ] **Step 1: Failing tests:**

```js
it('lands at the pad on your own side’s world, or unsworn', () => {
  expect(landingFor(site, { yours: true }, h).at).toEqual(site.land.at);
  expect(landingFor(site, { side: null, hostile: false }, h).covert).toBe(false);
});
it('lands out of sight on the other side’s world', () => {
  const l = landingFor(site, { side: 'rebel', owner: 'empire', hostile: true, yours: false }, h);
  expect(l.covert).toBe(true);
  expect(Math.hypot(l.at[0] - site.land.at[0], l.at[1] - site.land.at[1])).toBeGreaterThan(110);
  expect(l.line).toMatch(/out of sight/);
});
it('a Hutt world lands you at the pad (they sell you, they don’t shoot you)', () => {
  expect(landingFor(site, { side: 'rebel', owner: 'hutt', hostile: true }, h).covert).toBe(false);
});
it('finds a dry covert spot on a world with none written', () => {
  const at = covertFor({ ...site, covert: undefined }, h);
  expect(h(...at)).toBeGreaterThan((site.water?.level ?? -Infinity) + 0.3);
});
```

- [ ] **Step 2–4:** implement (`covertFor`: 24 candidates on rings of 150, 185, 220 m round `land.at`; reject under water + 0.3, slope over 0.25 (sample ±3 m), outside `REACH − 40`; score by distance from the garrison posts (`garrisonAt`'s post positions) and flatness; seeded by the site id for ties). The line: `` `${OWNER_NAME[owner]}-held. We set down out of sight of the garrison.` `` where `OWNER_NAME` is from `sides.js` (`SIDES[owner].short`). Wire into `scene.js`: replace the reads of `site.land.at`/`site.land.yaw` for the ship and spawn with `const landing = landingFor(site, ctx.effects, world.heightAt)` computed once at create; the arrival line goes out through `say` with the crew's first line after it.
- [ ] **Step 5:** browser check — a Rebel oath (`tp-gcw-side` = `{"since":<campaign>,"war":"gcw","oaths":{"gcw":{"side":"rebel","sworn":1}}}`; read `readAllegiance` for the exact shape) on Endor: `__surface().ship.at` is the covert spot. Commit: "On the other side's world you set down out of sight of its garrison".

### Task 9: The garrison's attitude, givers by side, and talk with your side

**Files:**
- Modify: `src/components/galaxy/surface/garrison.js` (+ tests): `garrisonLife` skips named/quest entries; `garrisonAt(site, effects, faction, standing)` returns `{ life, hostiles }`.
- Modify: `src/components/galaxy/surface/activity.js`: `standing(groups)` — always-on hostile groups not tied to a quest step (same spawn shape as a step's `spawn`), shown at create and kept until `clear()`; their kills emit `{ type: 'kill', tag }` like quest ones.
- Modify: `src/components/galaxy/surface/scene.js` (life build at :334, talk prompt at ~1289, quest offer at ~1401), `src/pages/GalaxySurface.jsx` (effects from `groundEffects`), `src/pages/Galaxy.jsx:226` (handover effects from `groundEffects`).
- Modify: `src/components/galaxy/surface/sites/*.js` + `quests.js`: give each quest giver whose side matters a `side` (Gree, Dodonna, Sefla, the Endor scout and strike team, Hoth's officers: their faction's id); `quest.side` defaults to its giver's `side`.

**Interfaces:**
- Consumes: `standingOf`, `groundEffects`, `landingFor`.
- Produces: `questOpen(quest, giver, effects) → { open: boolean, line?: string }`.

- [ ] **Step 1: Failing tests** (`garrison.test.js`, `quests.test.js`):

```js
it('never re-dresses someone named or with a quest', () => {
  const life = [{ kind: 'clone', id: 'gree', named: true, quest: 'beachhead', name: 'Commander Gree', says: ['x'] }, { kind: 'clone', n: 3 }];
  const out = garrisonLife(life, 'rebel');
  expect(out[0]).toBe(life[0]);
  expect(out[1].kind).toBe('rebel');
});
it('an enemy garrison is hostiles, not people to talk to', () => {
  const { life, hostiles } = garrisonAt(site, { troops: 'stormtrooper', owner: 'empire', side: 'rebel', hostile: true, yours: false });
  expect(life).toEqual([]);
  expect(hostiles.length).toBeGreaterThan(0);
  for (const h of hostiles) expect(h.hostile).toBeTruthy();
});
it('a friendly garrison greets you by rank', () => {
  const { life } = garrisonAt(site, { troops: 'rebel', owner: 'rebel', side: 'rebel', yours: true, rank: 3 });
  expect(life.some((e) => e.says.some((s) => /Commander|Captain|Lieutenant|General|sir/i.test(s)))).toBe(true);
});
it('a giver of the other side won’t give you the quest', () => {
  const r = questOpen({ id: 'q', side: 'republic' }, { kind: 'clone', side: 'republic' }, { war: 'clone', side: 'separatists' });
  expect(r.open).toBe(false);
  expect(r.line).toBeTruthy();
  expect(questOpen({ id: 'q', side: 'republic' }, { kind: 'clone' }, { war: 'clone', side: null }).open).toBe(true);
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** `garrisonAt` keeps its party layout; by `standingOf({ kind: troops }, effects)`: `enemy` → the beats and posts as hostile spawns (`{ kind, n, at, spread: 6, roam: 14, leash: 40, hp: 2, tag: 'garrison', hostile: { range: 42, every: 1.8, damage: 8, memory: 6 } }`) in `hostiles`, nothing in `life`; `ally` → life with lines by rank (`['Commander.', 'Good to have you back.', …]` picked by `effects.rank`); `neutral` → today's life. `scene.js`: `life` from `garrisonLife` + `garrisonAt(...).life`; `activity.standing(garrisonAt(...).hostiles)` after the activity is made; the talk prompt is not offered for an actor whose `standingOf` is `enemy`; when a quest giver is talked to, `questOpen` decides between the intro and the refusal line. `GalaxySurface.jsx`'s `effects` memo becomes `groundEffects(id, oathKept)`; `Galaxy.jsx:226` passes `groundEffects(id, oath)` (the raw allegiance, not `current`); on an oath change mid-visit the page already passes new `effects` in props — make `scene.js`'s `update(props)` (≈:3116) set `ctx.effects = props.effects` when it changed and rebuild the garrison (`life.replace` if `createActors` has one; otherwise dispose and recreate the garrison entries only — read `actors.js` for an add/remove API before choosing).
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy` — PASS.
- [ ] **Step 5: Browser checks:** (a) Rebel on Endor: the garrison's troopers are in `__surface().fight` as hostiles, none in `people` with `garrison`; walking into their sight they fire. (b) Rebel on Hoth (Rebel-held at opening): no hostiles, a trooper's line names your rank. (c) Unsworn on Tatooine: as before. (d) Geonosis unsworn: `people` has no `stormtrooper`. Commit: "The ground knows your side: an enemy garrison hunts you, a friendly one salutes, and the other side keeps its quests"; open PR 3.

---

## PR 4 — Soldiers who think

Each task: pure rule first with its test in `hostiles.test.js` / `blaster.test.js` / `assault.test.js` / `actors.test.js`, then the wiring, then the browser check named.

### Task 10: Bolts stop at solids

- Files: `src/components/galaxy/surface/blaster.js` (+ test), `walker.js` (a pure `segmentHitsSolid(solids, a, b) → { t, point } | null` over circles and boxes with `top`), `scene.js` (sparks at the hit).
- Test: a bolt from (0,1,0) to (10,1,0) through a circle at (5,0) r 1 stops at t≈0.4; a box with `top: 0.8` under a bolt at y 1.2 does not stop it; `solid: false` things are not in `world.solids` (assert via a placer-free fake).
- Wiring: every bolt's step (yours and theirs) checks the segment it moves this frame; on a hit it ends with the existing impact effect.
- Browser: stand behind Kashyyyk's barricade kneeling; droid bolts end on the logs (count `blaster.debug()` impacts or watch hits on you drop to 0 over 10 s). Commit.

### Task 11: Fire discipline, awareness, aim with error

- Files: `hostiles.js` (+ test), `activity.js` (the firing loop ≈:897-954), `lib/ai/perception.js` (detection meter).
- Tests: (1) no shot when `lineClear` from muzzle to the target's true chest is false, even with a fresh belief; one suppressive burst at the last-seen point allowed within 1 s of losing sight, then none; (2) no shot when facing error > 25°, it turns at its turn rate first; (3) detection meter: in sight at 10 m reaches 1 in ≤ 0.5 s, at 50 m in ≥ 1.2 s, crouched in cover ×1.5; `?` state below 1; (4) aim spread: `spreadFor({ range, max, targetSpeed, suppress, burstIndex })` — at the edge of range ≥ 2× point blank; 6 m/s crossing ×1.6; suppressed ×1.5; first shot of a burst ×1.3; non-decreasing in each input; (5) hearing: a shot 50 m away with a clear line alerts, without a line only within 25 m.
- Wiring: the scene's enemy shot aim (`scene.js` ≈:2888) uses `spreadFor`.
- Browser: from behind a wall on Endor's bunker quest, enemies stop firing within 1 s of losing sight. Commit.

### Task 12: Bodies that collide, close to range, morale and suppression

- Files: `hostiles.js`, `activity.js` (movement commit ≈:803), `lib/ai/spatial.js` (cover spots out of solids).
- Tests: (1) a hostile walking into a circle solid ends outside it (uses `pushOut` from `walker.js`); (2) spawn and cover candidates inside a solid are moved out or dropped; (3) a shooter seeing you at 1.3× range scores `close` and moves toward you; once engaged its leash is `roam + range`; (4) a bolt passing within 2 m adds suppression (0.35, fading 0.25/s); over 0.45 it prefers cover and aims worse; (5) a group with half its number down and a hurt member falls back toward home/cover; a lone survivor with hp < 30% runs.
- Browser: Kashyyyk wave 1 — droids flow round the cover rocks, none inside them; after half fall, the rest pull back to the water. Commit.

### Task 13: Targets are everyone; the companion fights

- Files: `activity.js` (≈:85-97 target choice; a belief per target id), `scene.js` (mate ≈:1093-1259: proactive engagement, being targeted, sidestep; assault hits count).
- Tests: (1) `pickTarget(t, candidates)` prefers whoever shot it in the last 3 s, then the nearest with a clear line, never one without a line when another has one; (2) the mate engages an enemy with `seen` true within 35 m without a lock (pure helper `mateWants(enemies, you, mate)`); (3) enemies' token pool for shots at the mate is separate from yours (2 at once).
- Browser: Tatooine Tusken quest — Tuskens shoot at the companion too; it fires first. Commit.

### Task 14: Ambient walkers avoid boxes; battles see

- Files: `actors.js` (≈:534 steering: boxes as well as circles; flee routes round them), `missions/assault.js` (shots need a clear line through `env.solids`; your bolts passing within 2 m suppress), `missions/assaultScene.js` (pass the solids and your bolt path).
- Tests: `actors.test.js` — a walker heading through a box detours round it; `assault.test.js` — two soldiers with a wall between them never hit each other over 20 s; a bolt of yours passing a soldier adds suppression.
- Browser: Hoth assault — soldiers behind the trench walls survive longer (compare kills over 60 s with walls vs a stub without; just log both). Commit; open PR 4.

---

## PR 5 — A look from this decade

Each task: before/after screenshots (landing view, a mid view, top-down) for Kashyyyk, Tatooine, Hoth, Endor, Naboo, Geonosis on `high`, with `__surface().ms` before/after; the tier switches tested in Node where pure.

### Task 15: Sun shadows back on high and ultra

- Files: `surface/scene.js` (≈:174-217 shadow setup; ≈:3061-3074 `groundWorld(... keepShadows)`), `lib/three/groundwork.js` (only if `keepShadows` needs the bake to skip its sun-shadow term).
- Test: a pure `shadowPlan(tier, budget) → { on, type: 'soft', size, extent }` in a small new `surface/shadowPlan.js`: high → 2048, ultra → `budget.shadowMap` (4096), mid/low → off (the bake only); extent 60.
- Browser: Kashyyyk and Tatooine — buildings and trees cast; frame time within 2 ms. Commit.

### Task 16: Shade keeps its texture

- Files: `lib/three/house.js` (a `tint` mode: shadow colour × three's own light, not a replacement; the existing mode unchanged for its other users), `surface/look.js` (the galaxy uses `tint`; softer `edge`), `house.test.js`.
- Test: in `tint` mode the shader chunk string contains the multiply path and not the replace path (follow `house.test.js`'s existing chunk assertions).
- Browser: a shaded cliff on Tatooine shows its scan relief. Commit.

### Task 17: Layered photo-scanned terrain

- Files: `surface/ground.js` (a splat of up to 3 ground layers + triplanar rock on slopes; roughness/AO; `antiTile`; fade 150 m), `sites/*.js` (`ground.layers`: Kashyyyk `mud`, `leaves`, `mossrock`; Tatooine `sand`, `redsoil`; Hoth `snow`, `stone`; Endor `leaves`, `mud`, `mossrock`; Naboo `grass`, `gravel`; Geonosis `redsoil`, `redrock` — names from `public/cc0/galaxy/index.json`), `ground.test.js`.
- Also: a normal map baked from the pure height function over the walkable square (2048² on high, 4096² on ultra, none on low/mid) through `lib/three/groundmap.js`'s bake path, sampled in `ground.js` in place of the vertex normal inside the square; the ground map at 1024 (2048 ultra) (`scene.js:282`).
- Test: `layerPlan(ground, tier)` pure — low: none; mid: 1 layer + slope rock; high/ultra: up to 3 + slope rock, `normalMap` 2048/4096; unknown scan names throw in the sites test. `bakeNormals(height, { size, half })` on a plane gives (0,1,0) and on a 45° ramp gives a normal with y ≈ 0.707.
- Browser: before/after on the six worlds; frame time. Commit.

### Task 18: A filmic tone curve, GTAO, foliage MSAA, water that reflects

- Files: `universe/post.js` (`createPost({ look })` option: `'neutral'` tone curve and optional GTAO pass; space keeps its default), `surface/scene.js` (pass `look: 'neutral'`, `ao: tier !== 'low' && tier !== 'mid'`), `post.js:217` (samples 2 at pixel ratio ≥ 1.75 on high/ultra), `surface/water.js:205-220` (reflect `scene.environment`).
- Test: `post.test.js` — `toneFor('neutral')` matches the Khronos PBR Neutral reference at 0.18, 1.0, 4.0 (±0.01); `samplesFor({ tier, ratio })` gives 2 for high at 2.0, 0 for low.
- Browser: before/after; the space view unchanged (galaxy-check pose). Commit.

### Task 19: Props' scans, Kashyyyk's trees and karsts

- Files: `lib/three/core.js` (`wear()` applies the scan's roughness/AO), `surface/kit.js` (scan strength 0.55 → 0.75; rods/cylinders `seg()` up close), `props/forest.js` (`wroshyrParts` default bark `#6b5440` with deeper furrows; the Kashyyyk scatter's `bark` → `#5e4a38`, `leaf` → `#3d5a30`; karsts on the rock scan with vertical streaks and moss tops), `sites/forest.js`.
- Browser: Kashyyyk landing view before/after. Commit; open PR 5.

---

## PR 6 — Layouts that make sense

Each task edits one site file, adds that world's assertions to `validity.test.js` (distances between the places the film keeps together, the landing within 80 m of the main place, nobody inside a structure), checks a top-down and the landing view, and commits.

### Task 20: Tatooine
- `sites/desert.js`: land in Mos Eisley's bay ([300,-230] area; Bay 94 `model: false`); the Sarlacc within 220 m of Jabba's palace; a `paths` strip through Mos Eisley under its arches.
- Assert: `hypot(sarlacc − palace) < 220`; `hypot(land − moseisley) < 80`.

### Task 21: Geonosis
- `sites/core.js` geonosis: arena, foundry, hangar within 150 m of each other round the hive; land by the arena; the audit's three fixes (`docs/research/2026-10-07-star-wars-buildings-audit.md`: arena collision, foundry pickups, Mace's spot).
- Assert: pairwise distances < 160; Mace and the foundry pickups `standable` and outside the arena's footprint (radius from the catalogue entry).

### Task 22: Hoth
- `sites/ice.js`: `ECHO.yaw` turned to face the walkers' approach (+z); wampa cave, probe crater and Han's shelter within 200 m of each other.
- Assert: the hangar's facing vector · (walkers − base) > 0.

### Task 23: Naboo
- `sites/core.js` naboo: land yaw facing Theed; Theed's halls along a paved `paths` road hangar → palace; the grove on dry ground.

### Task 24: Sorgan, Lothal, Mandalore
- `sites/outer.js`: Sorgan's `water` (swamp) and krill ponds round the village, huts at the pond edge, the AT-ST raid spawned at the village; Lothal's factory and towers inside Capital City; Mandalore's mines entrance (pit + ramp) beside Sundari. (Do not touch Nevarro.)

### Task 25: Scarif, Yavin, Dagobah
- `sites/edge.js` scarif: the last sunset at the Citadel's foot (not mustafar); `sites/yavin.js`: land on the landing field; `sites/forest.js` dagobah: Luke's camp beside the X-wing. Open PR 6.

---

## Execution notes

- The paths in PR 4–6 tasks are confirmed against the audits; the implementer reads the named lines before editing and adapts the exact hook to what is there.
- After each PR: `git fetch origin && git merge origin/main`, trial-merge against open branches (`git merge-tree --write-tree --name-only HEAD origin/<branch>`), gates, push, PR, merge after CI.
