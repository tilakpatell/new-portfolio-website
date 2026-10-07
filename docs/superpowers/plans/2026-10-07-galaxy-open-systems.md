# The galaxy's open systems, finished: the plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development and verification-before-completion. One session. Steps use checkbox (`- [ ]`) syntax for tracking. The design: `specs/2026-10-07-galaxy-open-systems-design.md`.

## Constraints

Edit only `src/components/galaxy/`, `src/pages/Galaxy.jsx`, `src/components/guide/pages.js`, the galaxy line of `docs/architecture.md` and `HANDOFF-galaxy-roam.md`. Keep the spec's numbers. No new models or textures. Nothing new drawn on `low` beyond the points. Merge commits only. Never commit `src/data/health/latest.json`.

### Task 1: super speed (`space.js`)

- [ ] **Step 1: Write the failing tests** in `space.test.js`: `wideAlong` is 0 at the planet's reach + 400, 1 at reach + 1,100, between at + 750; `overdriveAt` is 1 at the planet and 3 out by the edge; boosting with `overdrive: space.overdriveAt(...)` from the edge toward the planet reaches over 300 on the way and is under `SHIP.boost + 0.5` at the planet's reach; the autopilot with `od` 3 from the edge parks at the planet (done, within the park's reach) in under 25 s of sim time.
- [ ] **Step 2: Fail. Step 3: Implement. Step 4: Green. Commit.**

### Task 2: the places (`places.js`)

- [ ] **Step 1: Write the failing tests** in `places.test.js`: every system has 3 to 6 places; the same call twice gives the same; each within `inner`…`outer` of the origin and ±180 high; every pair at least `apart` apart; no kind twice in a system; every place clear of `hazardsOf(sys)`; the nebula has `r` 0 and a reach; `createFinds` with a stub store: `mark` is true once then false, `count` follows, a corrupt store reads as none, `found` survives a new `createFinds` on the same store.
- [ ] **Step 2: Fail. Step 3: Implement. Step 4: Green. Commit.**

### Task 3: drawn (`placesDraw.js`), and in the world

- [ ] **Step 1: Write a smoke test** `placesDraw.test.js`: `createPlaces` for Tatooine makes a group of two children (a Mesh and Points), one child on `small`; `update` runs; `dispose` empties it.
- [ ] **Step 2: Implement.** `world.js` builds them after the rocks: `addSolid` each place with `goal: true, name, kind, place: true`, and ticks `update`.
- [ ] **Step 3:** `npx vitest run src/components/galaxy`. **Commit.**

### Task 4: the scene, the page, the panel, the lines

- [ ] `scene.js`: `input.overdrive` and the autopilot's `od` from `state.space.overdriveAt`; the crew's `overdrive` line once past 150; `createFinds` on `localStorage`; on `at` a place: `find` event, `earn`; `__galaxyDebug.finds`, `wide` in `__galaxy()`.
- [ ] `Galaxy.jsx`: `finds` state from `find` events (and on arrival, from the store); `GalaxyPanel.jsx`: `Out there` section; `GalaxyView.jsx`: places in the labels, unfound by kind.
- [ ] `lines.js`: a `find` exchange per crew. `guide/pages.js`: a tip on the open systems.
- [ ] `npx vitest run src/components/galaxy src/components/guide`, `npx eslint .`. **Commit.**

### Task 5: evidence and the hand-off

- [ ] `scripts/galaxy-check.mjs` on `high` and `low` at Tatooine and Coruscant against `lab/galaxy/baseline/`; a probe that flies the edge to the planet on super speed and reports the top speed and the arrival speed; screenshots of a place found and the panel; `docs/architecture.md`'s galaxy line and `HANDOFF-galaxy-roam.md` updated. PR, merge on green.
