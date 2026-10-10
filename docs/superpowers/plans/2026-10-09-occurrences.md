# Occurrences Implementation Plan (lane H)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Things happen: seeded features in every cell as the ground generates (wrecks with salvage, caves with something in them, camps that are hostile, beacons that call) and timed events a director rolls and announces to the room (storms, raids, launches, eruptions, migrations, the Purge), each planet its own, the same for pilots together.

**Architecture:** `occurrences.js` (pure) is the catalogue of occurrence kinds with a placement and a rule; `roster.js` (lane G) gains `occurrences` per cell from `lifeTables`' list; `director.js` (pure) rolls the planet's events on a clock with cooldowns and a `ttl`, and the scene plays each (weather through the galaxy's `weather.js` kinds, ships through lane G's air, ground through lane G's life); events go out on the room as `event` and come in checked.

**Tech Stack:** `universe/director.js`'s shape, `galaxy/surface/weather.js`, `galaxy/surface/storm.js`, lane G's pools and brains, lane C's room, lane B's loader (a beacon may mark a built thing).

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 4, decisions 11, 15, 17); the note's table (occurrences and events columns).

## Global Constraints

- Starts from `main` after lanes D and G merge. Touches `src/lib/land/flight/{occurrences,director}.js`, `src/components/expanse/flight/{events,occurrenceScene}.js`, `flightProtocol.js` (the `event` action, rate `[0.5, 3]`), `scene.js`.
- Caps: `OCC_CAP = 6` a cell; `EVENT_MIN_GAP = 45` s between events, `EVENT_FIRST = 60` s after arrival, one event at a time, `ttl` per kind under 240 s; an event announced by a peer is believed only with a known kind, within `NET_CELL × 3` of its `at`, and not more often than the rate.
- A per-cell occurrence is seeded (the same for everyone); a timed event is rolled locally and announced, so pilots together see one event (the first announcer wins by `id` order; a later roll of the same kind within `ttl` is dropped).
- Weather changes visibility through the scene's fog only; it never changes the terrain's heights except `lava surge` (a uniform the ground shader reads) and `quake` (a visual offset, not the field).
- No model names in code, docs, commits. Commits end with the harness's attribution lines.
- Before the PR: lint, tests, build, health, smoke on `/fly/hoth,/fly/purge,/fly/mustafar`, `node scripts/online-check.mjs --fly` (two browsers see one storm).

## Review Focus

1. **Two pilots roll different events in the same second**: the lower `id` wins, the other is dropped by both; a test with two directors and a fake room. Task 2.
2. **The Purge at sundown**: villagers turn hostile for 180 s then calm, once a visit, at a seeded hour, and a pilot arriving mid-Purge is told by `hi`. Task 3.
3. **A camp occurrence under a POI's flat edge**: never placed within `r + edge`; test in Task 1.
4. **Leaving the planet mid-event**: every event cleared, weather reset, no timer left. Task 3.
5. **An asteroid shower's craters**: a visual-only decal set per visit, capped at 40, never written to the field. Task 3.

---

### Task 1: The occurrence catalogue (pure)

**Files:**
- Create: `src/lib/land/flight/occurrences.js`, `occurrences.test.js`; Modify: `lifeTables.js` (each planet's `occurrences: [kind…]`), `roster.js` (`occurrences` per cell, `OCC_CAP`)

**Interfaces:**
- Produces: `OCCURRENCES = { wreck: { place: { kinds: [...], r }, rule: 'salvage' }, cave: { place: 'pit', rule: 'lair' }, camp: { rule: 'hostile', r: 300 }, beacon: { rule: 'call' }, outpost: ..., ruin: ..., field: ... }`; `applyRule(occ, ship, state, dt) → { toast?, marker?, hostile?: [...], pickup? }`.

- [ ] Tests: every kind in every planet's list exists; placement avoids POI flats and slopes over 0.7; a camp is hostile within `r` and not outside; a salvage pickup is taken once per visit.
- [ ] Write; PASS; **Commit** `Occurrences: things in the cells, each with a rule`.

### Task 2: The director (pure) and the wire

**Files:**
- Create: `src/lib/land/flight/director.js`, `director.test.js`; Modify: `flightProtocol.js` (`writeEvent`, `readEvent`), `flightProtocol.test.js`

**Interfaces:**
- Produces: `EVENTS[kind] → { ttl, cooldown, needs?: (ctx) => boolean, pick: (rng, ctx) => params }`; `createFlightDirector({ life, rand, now }) → { update(dt, ctx) → [{ id, kind, at, t0, ttl, params }], announce(ev), receive(ev) → accepted, active(), clear() }`; `readEvent` as the spec's checks.

- [ ] Tests: nothing before `EVENT_FIRST`; a gap of `EVENT_MIN_GAP`; one at a time; `needs` respected (no Purge by day; no eruption without a volcano biome loaded); two directors with a fake room converge on the lower id; `clear()` empties.
- [ ] Write; PASS; **Commit** `A director rolls what happens and tells the room`.

### Task 3: Playing them

**Files:**
- Create: `src/components/expanse/flight/events.js`, `events.test.js` (fake scene), `occurrenceScene.js`; Modify: `scene.js`, `FlightHud.jsx`

- [ ] Each event kind's play: weather (`storm`, `blizzard`, `sandstorm`, `fog`, `rain`, `glass storm`) through the galaxy's weather kinds and the fog; `raid`, `scramble`, `patrol`, `hunt` through lane G's air and life; `eruption` (rocks as bolts, ash as weather, a glow), `lava surge` (a ground uniform), `quake` (a visual offset), `shower` (rocks and decal craters, capped), `migration` (a herd or flock crosses), `launch`, `parade`, `festival`, `purge`, `portal`, `bridge`, `kraken`, `mythosaur` (rare, one surface). A toast a sentence at the start; a marker on the map while active.
- [ ] Occurrences drawn through lane E's landmark kit where it exists, else the code-built stand-ins; their rules applied each frame near the ship.
- [ ] Leaving clears everything (a test). Two browsers on `/fly/hoth`: one storm, both see it. Screenshots: a blizzard on Hoth, the Purge at sundown, an eruption on Mustafar.
- [ ] **Commit** `Things happen on the planets, and everyone there sees them`.

### Task 4: Docs and the PR

- [ ] A paragraph in `docs/architecture.md`; the handoff's lane H row. Merge `origin/main`, the checks, push, PR, CI, no merge.
