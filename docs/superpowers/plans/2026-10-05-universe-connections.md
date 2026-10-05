# Universe connections implementation plan (PR 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From any page one step to its place on the universe map, and from the map one step into any page, the galaxy's systems included; shareable links to every wonder; a grand tour; `fly` in the terminal and "Fly to" in ⌘K.

**Architecture:** `nav.js` (pure, tested) grows the destination list (the galaxy's systems, reached through the gate) and a tour order; `Universe.jsx` carries the onward trip and the tour as page state over the scene's `arrived`/`jumped` events; the footer, the terminal and the palette read `nav.js`'s destinations and `universes.js`'s `byPath`.

**Tech Stack:** React 19, react-router 7, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-05-universe-expansion-design.md`, sub-project 3.

## Global Constraints

- `DESTINATIONS` keeps its order (stations, worlds, wonders) and gains the systems after the wonders; `findDestinations`'s existing tests stay green.
- A system destination is never a `GOALS` entry: `tripTime`, `parkFor` and `distanceTo` go through `goalOf(id)` (its `via`).
- The URL stays the selection for universes (`/universe/marvel`); a wonder's URL (`/universe/aurelia`) is a start, not a selection: the panel shows the wonder's card and the page's selected universe is null.
- No new routes.

## Review Focus

1. A tour started with no ship (3D off): the Tour button is hidden; `tourFrom` is only called with a ship.
2. An onward trip to a system cancelled by the pilot taking the stick: the page's `onward` clears when the scene reports `auto` ended without arriving (the `arrived` event carries `done: false`), so a later arrival at the gate doesn't jump into the galaxy unasked.
3. `fly` with a name that matches two destinations ("earth" matches Earth and nothing else, but "the" would match many): the first in map order wins, and the terminal says which.
4. A wonder deep link with a ship already parked at a universe (remembered): `startAt` wins for a fresh scene only; the page reports where it put you.
5. ⌘K's generated entries have unique ids (`fly-<id>`) and keywords from the destination's name, kind and fandom.

---

### Task 1: The galaxy's systems and the tour, as rules

**Files:**
- Modify: `src/components/universe/nav.js`, `src/components/universe/nav.test.js`
- Modify: `src/components/universe/layout.js` (`parseWonder`), `src/components/universe/layout.test.js`

**Interfaces:**
- `DESTINATIONS` gains, after the wonders, one entry per `SYSTEM_NAMES` key (`galaxy/names.js`): `{ id: 'sys:<id>', name, kind: 'system', type: 'Star system', at: POSITIONS.starwars, reach: REACH.starwars, color: SYSTEM_MARKS[id][2], about: 'Through the hyperspace gate: <name>, in a galaxy far, far away.', to: '/galaxy/<id>', via: 'starwars' }`.
- `KINDS` gains `{ id: 'system', name: 'Star systems' }`.
- `goalOf(id) → string`: `destinationById(id)?.via ?? id`. `tripTime`, `parkFor`, `distanceTo` use it.
- `tourFrom(ship, ids = TOUR_IDS) → string[]`: nearest-neighbour from the ship, by `distanceTo`, every id once; `TOUR_IDS` is every destination that is not a system.
- `parseWonder(param) → id | null` in `layout.js` (a `WONDERS` id as it is, else null; never a prototype key).

- [ ] **Step 1: Tests.** `nav.test.js`: the systems are listed once each with `via: 'starwars'` and a `to` matching `/galaxy/<id>`; `tripTime(ship, 'sys:hoth', 'super')` equals `tripTime(ship, 'starwars', 'super')`; `findDestinations('system', 'hoth')` is `['sys:hoth']`; `tourFrom` from the home edge visits every `TOUR_IDS` id once, the first being the nearest. `layout.test.js`: `parseWonder('aurelia')` is `'aurelia'`, `parseWonder('marvel')`, `'__proto__'`, `''` are null. Run → FAIL.
- [ ] **Step 2: Implement.** Run → PASS. Commit `Nav: the galaxy's systems through the gate, and a tour order`.

### Task 2: The nav map and the page: onward through the gate, the tour, wonder links

**Files:**
- Modify: `src/components/universe/NavMap.jsx`, `navmap.css` (a Tour button beside 3D view; system rows show "through the gate"; a Copy link button on the card)
- Modify: `src/components/universe/scene.js` (`emit({ type: 'arrived', id, done })` when the autopilot ends; `startAt` prop: a wonder id to start parked by)
- Modify: `src/components/universe/UniverseMap.jsx` (passes `startAt`)
- Modify: `src/pages/Universe.jsx` (`onward`, `tour`, the wonder card, `parseWonder`)
- Modify: `src/components/universe/UniversePanel.jsx` (a `wonder` prop: its card)
- Modify: `src/components/Achievements.jsx` (`grandtour: { name: 'Seen it all', desc: 'Toured every place on the universe map' }`)

**Interfaces:**
- Scene event `{ type: 'arrived', id, done: boolean }`: the autopilot's trip to `id` ended, parked (`done`) or not.
- `Universe.jsx`: `travel(id, d)`: if `destinationById(id).via`, `map.current.travel(via, d)` and `setOnward({ via, to })`; on `arrived`/`jumped` with `id === onward.via` and `done`, `go(byId(via), onward.to)` (`go(u, to = u.to)`); on `arrived` with `done: false`, clear `onward`.
- `tour`: `{ ids, i, timer }`; `startTour()` → `ids = tourFrom(where().ship)`, travel to `ids[0]`; on `arrived`/`jumped` for `ids[i]` with `done`, a 6 s timer then travel to `ids[i + 1]`; at the end `unlock('grandtour')`; Escape (the page's handler) and any `travel` from elsewhere clears it. A pill over the map: "Touring, 3 of 27: next Glacia. Esc stops."
- Wonder link: `parseWonder(useParams().id)` → `startAt` for the scene (parked beside it, as `parkFor` says) and `wonder` for the panel (name, type, about from `destinationById`, a Fly here button → `travel(id, drive)`).

- [ ] **Step 1: Implement** (scene code: browser-checked; page logic small).
- [ ] **Step 2: Headless:** `scripts/navmap-check.mjs desktop` still passes; a new `scripts/links-check.mjs`: open `/#/universe/aurelia` with a ship and check `__universe().ship` is within `reachOf(aurelia) + 20` of it; pick `sys:hoth` on the nav map with hyperspeed and check the hash becomes `#/galaxy/hoth` within 20 s.
- [ ] **Step 3: Commit** `The nav map goes through the gate, tours the map, and links to every wonder`.

### Task 3: Every page to its place: the footer, the terminal, ⌘K, the guide

**Files:**
- Modify: `src/components/Footer.jsx` (`byPath(pathname)` → a "This page on the universe map" link to `/universe/<id>`)
- Modify: `src/pages/Terminal.jsx` (`fly <place>`, `universe`, `map`; HELP lines)
- Modify: `src/components/CommandPalette.jsx` (`DESTINATIONS.map((d) => ({ id: `fly-${d.id}`, group: 'The universe', label: `Fly to ${d.name}`, keywords: `${d.type} ${d.kind} ${byId(d.id)?.label ?? ''} universe map fly`, icon: RiRocket2Line, run: go(d.via ? d.to : `/universe/${d.id}`) }))`)
- Modify: `src/components/GuidePanel.jsx` (`/universe` tips: "Through the gate", "The tour", "Links")
- Modify: `README.md` (the nav map paragraph)
- Test: `src/pages/terminal.test.js` if one exists for commands, else `nav.test.js` for `findDestination(query)` (the first match by id, then by folded name)

**Interfaces:**
- `findDestination(query) → destination | null` in `nav.js`: exact id (or `sys:` + id), else the first `findDestinations('all', query)`.

- [ ] **Step 1: Test** `findDestination('hoth')` → `sys:hoth`; `findDestination('Avengers HQ')` → `marvel`; `findDestination('nope')` → null. FAIL → implement → PASS.
- [ ] **Step 2: Implement** the footer, terminal, palette, guide, README.
- [ ] **Step 3: Verify** `npx eslint . && npx vitest run && npx vite build`; commit `Every page to its place on the map: the footer, the terminal and ⌘K`; push; PR 4; merge.
