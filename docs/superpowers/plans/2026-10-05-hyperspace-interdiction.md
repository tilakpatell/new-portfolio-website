# Hyperspace interdiction: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After ten to fifteen hyperspace jumps in a galaxy far, far away, an Imperial Interdictor pulls the ship out of hyperspace short of its destination, launches TIEs and holds the hyperdrive until the pilot is clear of its gravity well.

**Architecture:** A pure, tested rules module (`galaxy/interdiction.js`) decides when and where; a three.js set piece (`galaxy/interdictor.js`) draws the cruiser and its well; `galaxy/scene.js` cuts the jump, drops the ship, launches the existing hunters (`interdict: true`) and holds the drive; the page and the panel show it; the crews say it (`galaxy/lines.js`).

**Tech Stack:** React 19, Vite 8, three.js r186, Vitest 5 (plain Node, no DOM), Playwright-core with the container's Chromium for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-05-hyperspace-interdiction-design.md`

## Global constraints

- Nothing from the sequel trilogy. The Interdictor is the Immobilizer 418 of *Rebels* and the old Expanded Universe.
- Pure rules in `interdiction.js`, no three.js; the scene only reads numbers from it.
- Storage key `tp:galaxy-jumps` (`sessionStorage`), JSON `{ n, due }`; anything unreadable is a fresh cycle.
- Comments and copy in the repo's voice: plain British English, full sentences.
- Before every merge: `npm run lint`, `npm test`, `npm run build` clean.
- One PR per part, merged to main with the GitHub MCP tools; the branch carries on from `origin/main` after each merge.

## Review focus

- A stored count with garbage in it (`"x"`, `{}`, `{ n: -3 }`, `{ n: 99, due: 2 }`): a fresh cycle, never a throw, never an instant trap (test in Task 1).
- `due` is always within `INTERDICTION.jumps` inclusive, whatever `rand` gives (0 and 0.999…) (test in Task 1).
- The jump that bites is the `due`th: nine jumps never trap at `due` 10; the tenth does; the eleventh of the next cycle doesn't (test in Task 1).
- `cutAt` never cuts before the tunnel's built (at least 1.2 s in) and never after the jump would have ended (test in Task 1).
- `dropPoint` keeps the height and bearing of the arrival and lands inside `EDGE` (test in Task 1).
- `startJump` while held: no jump state, one `held` event, the count untouched.
- The hold lifts on every one of the three ways out, and only then; the Interdictor leaves only once no hunters are active.
- A crash (into the planet) or leaving the page while interdicted: the hold is dropped on the next system (`enter` resets it), nothing stuck.

---

## Part 1: the rules, the hull, the lines (PR 2)

### Task 1: `interdiction.js` and its tests

**Files:**
- Create: `src/components/galaxy/interdiction.js`, `src/components/galaxy/interdiction.test.js`

- [ ] Write the tests first: the count across a cycle, the store round trip and its garbage, `due`'s range, `cutAt`, `dropPoint`, `interdictorPlace`, `inWell`.
- [ ] Implement `INTERDICTION`, `createInterdiction`, `cutAt`, `dropPoint`, `interdictorPlace`, `inWell`.
- [ ] `npx vitest run src/components/galaxy/interdiction.test.js` green.

### Task 2: the Interdictor hull

**Files:**
- Modify: `src/components/galaxy/fleetRebels.js` (`interdictor(k)`, `FLEET`, `INFO`)
- Test: `src/components/galaxy/fleet.test.js` (the fleet's kinds and their info already have a test; `interdictor` joins it)

- [ ] Build the wedge (the universe's code-built Star Destroyer's proportions, shorter), the trench, the bridge tower, the engines, and four globes on the flanks (two a side, on short pylons) with a cool blue-violet glow material the scene can pulse (`update(t)`).
- [ ] `INFO.interdictor = { name: 'Interdictor cruiser', meters: 600, side: 'empire' }`.

### Task 3: the crews' lines and the achievement

**Files:**
- Modify: `src/components/galaxy/lines.js` (`interdicted` per crew, `events.wellclear` per crew, `galaxyCrew`), `src/components/galaxy/lines.test.js` (`EVENTS` gains `wellclear`; a new check that every crew has `interdicted`), `src/components/Achievements.jsx` (`interdicted`)

- [ ] Four crews, two exchanges each, in their voices; no straight quotes; Artoo and Chewie in brackets.
- [ ] `npm test` green, `npm run lint` clean. PR 2.

---

## Part 2: the set piece and the scene (PR 3)

### Task 4: `interdictor.js`

**Files:**
- Create: `src/components/galaxy/interdictor.js`

- [ ] `createInterdictor(parent, { models, small })`: a `models.slot('interdictor', SIZE)` holder, hidden until `arrive`; the drop-in smear and flash as `universe/setpieces.js` does it (stretch along the line of flight, a flash sprite); `here` while it stays; `leave()` to go the same way in reverse; the globes' pulse through the model's `update(t)`; the well as a `SphereGeometry` shell with a fresnel shader (`BackSide`, additive, faint, rippling with `uTime`), scaled to `INTERDICTION.well`.
- [ ] `update(dt, t)` returns busy while anything moves; `dispose()` frees it all.

### Task 5: the scene

**Files:**
- Modify: `src/components/galaxy/scene.js`

- [ ] `createInterdiction({ store: sessionStorage adapter })` once; `state.interdicted = null` (`{ at, since, said }` while held).
- [ ] In `jumpFrame`, at the `align → spool` step (and the `spool` start when there's no align): `const verdict = interdiction.jumped()`; `j.interdicted = verdict.interdicted`; `j.cut = cutAt(j.dur)`.
- [ ] In `tunnel`: if `j.interdicted && j.ready && j.age >= j.cut`: drop at `dropPoint(arrival(j.to, j.from))`, place the Interdictor (`interdictorPlace`), `state.interdicted = { … }`, the jolt (`flare`, `shake`, `kick`), `sfx.alarm`, `emit({ type: 'interdicted', to, from })`, `later` the pack at `INTERDICTION.launch` with `{ from: hangar, size: 4, ace: rand < 0.6, interdict: true }`; then `exit` as usual (`onArrive` still fires, so the page follows).
- [ ] `startJump`: while `state.interdicted`, emit `{ type: 'jump', phase: 'held', to }` and return false.
- [ ] `fly`: while interdicted, the boost stays `SHIP.boost` (pass a space whose `boostAt` is capped, or clamp the stepped speed).
- [ ] `adventure`: the hold lifts when `!hunters.active` after the pack came, or `!inWell(ship, at, well)`, or `clock - since > hold`; then `emit({ type: 'event', id: 'wellclear' })`, `interdiction.clear()`, and `interdictor.leave()` once no hunters are active (`emit({ type: 'event', id: 'leave' })`). No new random hunts while held (the pack is the hunt).
- [ ] `enter(sys)` and `dispose`: reset the hold, hide the piece.
- [ ] DEV: `window.__galaxy()` reports `interdicted` and `jumps`; `window.__galaxyDebug.interdiction` for forcing (`interdiction.force()` makes the next jump bite).

### Task 6: the page and the panel

**Files:**
- Modify: `src/pages/Galaxy.jsx`, `src/components/galaxy/GalaxyPanel.jsx`, `src/components/galaxy/galaxy.css`

- [ ] `Galaxy.jsx`: `interdicted` state set on `{ type: 'interdicted' }`, cleared on `{ type: 'event', id: 'wellclear' }` (both still go to the comms); `held` nudge on `{ type: 'jump', phase: 'held' }` (clears itself after 3 s); `unlock('interdicted')` on `wellclear`.
- [ ] `GalaxyPanel.jsx`: a red `.galaxy-jumping[data-interdicted]` banner: "Interdicted: an Imperial Interdictor pulled you out of hyperspace short of {name}. Its gravity well holds you: no jump till you're clear of it." With `held`: "The hyperdrive won't take."
- [ ] Browser check with Playwright: force the trap (`__galaxyDebug.interdiction.force()`), jump, screenshot the drop-out and the cruiser; fly clear, see the banner go. Fix what's off. PR 3.

---

## Part 3: the docs (PR 4, or in PR 3)

- [ ] README: a line under "A galaxy far, far away" and the key table's `J` row; `docs/architecture.md`'s galaxy paragraph; `docs/superpowers/HANDOFF-galaxy-surfaces.md` untouched (it's the surfaces').
