# Albuquerque games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rigged 3D cast, accurate rooms, deeper play and stronger feel in Walt's Metherria, and Face Off with the letter board as one 3D game at Casa Tranquila.

**Architecture:** The office's cast module (`src/components/office/people.js`) gains standing and wheelchair poses, gestures, tool-reaching arms and spec objects; Albuquerque passes its own wardrobe table. Metherria keeps its rules/scene split (`rules.js` pure and tested, `scene.js` draws `live`), with rooms moving into their own module. Casa Tranquila is a new rules module, scene and component beside the existing 2D fallbacks.

**Tech Stack:** React 18, Vite 5, three@0.180 (GLTFLoader + Meshopt, SkeletonUtils), Vitest, Playwright (QA scripts in the scratchpad), Python 3 with numpy for asset builds.

**Spec:** `docs/superpowers/specs/2026-10-04-albuquerque-games-design.md`

## Global Constraints

- CC0 assets only: Poly Haven, ambientCG, Quaternius, Kenney; textures 1K (512 for small parts).
- 3D first: 2D only without WebGL or after a lost context; slowness lowers resolution and shadows, never drops to 2D.
- About 300 draw calls per scene on desktop, shadows included (read from `diagnostics()` / `info()`).
- Copy: American spelling, no em-dashes in new copy, the site's plain voice.
- No gore in Face Off.
- Don't touch other worlds' pages (Cybertron, Avengers, and so on).
- Every PR: `npm run lint`, `npx vitest run`, `npm run build` pass; browser QA screenshots; merged into `main`, then the branch resets to `origin/main`.
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01S156mgRHzyZLCLFjXVEWx6`.

## Review Focus

- A career saved before this work (no heat, no new upgrades, old upgrade list) must load and play; Task 3.1 tests it.
- The cast models failing to load (network, 404): Metherria and Casa Tranquila must still play, Metherria on its standee cut-outs; Task 1.4 and Task 5.3 cover it with a forced failure in QA.
- Rapid repeated input (holding Space on the bell, mashing Ding during the finale) must not skip phases or double-count rings; Task 5.1 tests it.
- A tall, narrow phone screen: name tags, the heat meter and the board must stay readable at 390×844; every phase's QA includes a mobile capture.
- Leaving the page mid-shift or mid-explosion and coming back (the frame loop pauses off screen) must not jump the clock or end the shift; Task 3.4 tests heat decay with a long gap capped.

---

## Phase 1 (PR 1): characters, 3D customers, Walt and Jesse

### Task 1.1: New parts in the cast build

**Files:**
- Modify: `scripts/build-cast.py` (SOURCES, PACKS['men']['parts'])
- Modify: `src/components/office/people.test.js`
- Regenerate: `public/models/office/cast-men.glb`

**Interfaces:**
- Produces: men's pack meshes `head_beard` (Adventurer_Head: Skin→skin, Hair→hair, Eyebrows→brows, Eye→eyes) and `body_hoodie` (Casual_Body of Casual_Hoodie: Skin→skin, Purple→top).

- [ ] **Step 1:** In `people.test.js` add `it('ships the parts Albuquerque wears', ...)` asserting `packs.men.meshes.map(m => m.name)` contains `'head_beard'` and `'body_hoodie'`.
- [ ] **Step 2:** Run `npx vitest run src/components/office/people.test.js`; expect FAIL (missing parts).
- [ ] **Step 3:** Add `'men_Adventurer': '1fzSq1Rr037f7QkfXPWEAzmbLMNx-FpPA'` to SOURCES and the two part tuples; run `python3 scripts/build-cast.py`.
- [ ] **Step 4:** Run the test; expect PASS. Check `cast-men.glb` stays under 450 KB.
- [ ] **Step 5:** Commit.

### Task 1.2: Poses, gestures and reaching in the cast module

**Files:**
- Modify: `src/components/office/people.js`
- Test: `src/components/office/people.test.js`

**Interfaces:**
- Produces:
  - `person(idOrSpec, { pose = 'sit' | 'stand' | 'wheelchair', seat = 0.535, shadows, typing, idle, keys })`. A spec is `{ pack, parts, height, colors, belly?, glasses?, tie?, gloves? }`; `gloves: 0xRRGGBB` colours skin vertices whose weights are mostly on Wrist/finger bones.
  - On the returned person: `gesture(name)` with name in `'nod' | 'shake' | 'shrug' | 'fold' | 'cheer' | 'wave'`, and `reach(side: 'left' | 'right', point: THREE.Vector3 | null)` (null returns the hand to the pose).
  - Unchanged: `look`, `headAt`, `update(t, dt) -> boolean`, `group`, `id`.
  - Export `GESTURES` (the names, for tests and callers).
- Behavior:
  - `stand`: legs as bound, feet on the floor (rig moved so the lowest foot joint is at 0.085), arms down by IK to the thighs.
  - `wheelchair`: the seated legs, no lean, hands by IK onto armrests at `(±0.24, seat + 0.2, 0.05)`.
  - Gestures last under 1.6 s each and return `update()` true while running.

- [ ] **Step 1:** Test `it('names every gesture the callers use')` asserting `GESTURES` equals `['nod','shake','shrug','fold','cheer','wave']`. Test `it('takes a wardrobe as a spec, not only an office id')` asserting a spec missing `pack` or `parts` makes the pure validator `isSpec(spec)` return false and a full one true.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `isSpec`, `GESTURES`, the poses, `gesture()`, `reach()`. The gloves are coloured in `dress()` by bone weight, as `widen()` already does for the belly.
- [ ] **Step 4:** Run tests; PASS. Render each pose and gesture with the scratchpad `seated.mjs` lineup (extend it with `pose` and `gesture` options); look at the captures.
- [ ] **Step 5:** Re-run the office QA (`office.mjs`, `toss.mjs`) to show the office is unchanged; commit.

### Task 1.3: The Albuquerque wardrobe

**Files:**
- Create: `src/components/albuquerque/cast.js`
- Test: `src/components/albuquerque/cast.test.js`

**Interfaces:**
- Consumes: `isSpec` (Task 1.2), metherria `CUSTOMERS`.
- Produces:
  - `ABQ`: `{ [id]: spec }` for jesse, badger, pete, tuco, mike, gus, lydia, declan, saul, hank, hector, nurse, walt.
  - `HAZMAT = 0xe8c21a`.
  - `moodGesture(mood) -> gesture | null`: great→'cheer', good→'nod', okay→'shrug', bad→'shake', restless→'fold', wait→null.
- Wardrobe:
  - Jesse: `body_hoodie`, red-orange hoodie.
  - Tuco: `head_bald`.
  - Mike: `head_bald`, tan windbreaker.
  - Gus: `head_short`, suit, glasses.
  - Lydia: `head_long`, `body_blazer`.
  - Declan: `head_beard`.
  - Saul: `head_parted` thin hair, a loud shirt, a tie.
  - Hank: `head_bald`.
  - Hector: `head_swept`, white hair.
  - The nurse: women's tee.
  - Walt and Jesse at the bench: `HAZMAT` on top and legs, with gloves `0x1a1a1a`. Walt has `head_bald_moustache` and glasses.

- [ ] **Step 1:** Tests:
  - `it('dresses every Metherria customer')`: every id in `CUSTOMERS` is in `ABQ`.
  - `it('dresses everyone from parts their pack ships')`: same GLB check as `people.test.js`.
  - `it('reacts to each mood')`: the `moodGesture` table above, exactly.
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3:** Write `cast.js`.
- [ ] **Step 4:** Run; PASS; commit.

### Task 1.4: Customers, Walt and Jesse in Metherria's scene

**Files:**
- Modify: `src/components/albuquerque/metherria/scene.js` (standees → people; Walt; Jesse)
- Modify: `src/components/albuquerque/metherria/Metherria.jsx` (`live.reaction` in `serve`)

**Interfaces:**
- Consumes:
  - `loadPeople()` and `person(spec, opts)` (Task 1.2).
  - `ABQ`, `moodGesture` (Task 1.3).
  - `live.serving` / `live.lobby` entries `{ customer, mood, id }` (existing).
- Produces:
  - `live.reaction = { mood, at }`, set in `serve()`.
  - `standeeAnchors()` keeps its signature and returns points over each figure's head (`headAt() + 0.3`).
- Behavior:
  - **Customers:** one figure per customer id, made on first sight and reused, `pose: 'stand'`.
    - The front customer stands outside the hatch at `(-4.4, 0, -1.25)` facing +z and looks at the camera.
    - The queue stands at the existing slots, idle on.
    - A change of the front customer's mood plays `moodGesture(mood)` once.
  - **Walt:** `pose: 'stand'`, at `(STATIONS[station] - 0.42, 0, 0.42)` facing -z, gliding with the camera. His right hand reaches for:
    - the base or blue drum's spout while `b.pour` is set;
    - the gauge while cooking;
    - the hammer while breaking;
    - the pack while packing.
  - **Jesse:** `pose: 'stand'` at `(-2.9, 0, 0.5)`, looks at Walt, plays `moodGesture(live.reaction.mood)` on each new reaction.
  - **If `loadPeople()` gives no figures:** the standees stay as now.

- [ ] **Step 1:** Capture before/after with a scratchpad `meth.mjs` (intro, a served order at the hatch, each station at 1200×800 and 390×844); log `__METH_GL__.diagnostics()`.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Run QA. Expect:
  - Figures at the hatch, name tags over their heads.
  - Walt's hand on the tool at each station.
  - ≤ 300 calls.
  - No console errors.
  - With `/models/office/cast-*.glb` routed to 404, the standees appear.
- [ ] **Step 4:** Lint, test, build; commit; push; PR; merge; reset the branch.

## Phase 2 (PR 2): the RV and the superlab

### Task 2.1: References and materials

**Files:**
- Modify: `scripts/build-textures.py` (new sets), `public/cc0/README.md`
- Create: `public/cc0/materials/<set>/{color,normal,arm}.webp` for the new sets
- Test: `src/components/albuquerque/metherria/rooms.test.js`

**Interfaces:**
- Produces: material sets `rv-panel` (wood paneling), `rv-carpet`, `rv-curtain` (fabric), `lab-steel` (brushed metal), `lab-epoxy` (floor). Each is a Poly Haven or ambientCG asset chosen against the reference stills and recorded in the README.

- [ ] **Step 1:** Fetch reference stills of the RV interior and the superlab through the Breaking Bad Fandom MediaWiki API (`api.php?action=query&prop=images|imageinfo`) into the scratchpad; not shipped.
- [ ] **Step 2:** Test `it('ships every material the rooms use')`: for each name in `ROOM_MATERIALS` (exported by `rooms.js`, Task 2.2), the three webp files exist under `public/cc0/materials/<name>/`. Run; FAIL.
- [ ] **Step 3:** Add the sets to `build-textures.py`, run it, update the README.
- [ ] **Step 4:** Commit (the test passes after Task 2.2).

### Task 2.2: The rooms

**Files:**
- Create: `src/components/albuquerque/metherria/rooms.js`
- Modify: `scene.js` (room code moves out; the stations stay)

**Interfaces:**
- Produces:
  - `ROOM_MATERIALS: string[]`.
  - `buildRooms({ renderer, scene, T }) -> { setPlace(place: 'rv' | 'superlab'), ready: Promise, dispose() }`, keeping the hatch at `HATCH` and the bench at `BENCH_Y` (exported from `rooms.js`, imported by `scene.js`).
- Contents (from the spec):
  - **RV:** wood-panel walls, curtained windows onto the desert, the bench seat, a propane tank, the gas mask on a hook, the door with its steps.
  - **Superlab:** steel benches, the stainless reactor with pipes, epoxy floor, fluorescent tubes, Madrigal drums, hazmat suits on hooks, the laundry door.
  - Merge static props per material (`kit.merge`-style) to hold the budget.

- [ ] **Step 1:** Implement, side by side with the reference stills.
- [ ] **Step 2:** Run `rooms.test.js`; PASS. QA captures of both rooms (buy the superlab through `__METH__` in dev), ≤ 300 calls each.
- [ ] **Step 3:** Lint, test, build; commit; PR; merge; reset.

## Phase 3 (PR 3): deeper gameplay

All in `src/components/albuquerque/metherria/rules.js`, tests in `rules.test.js`.

### Task 3.1: New fields, saved careers

**Interfaces:**
- Produces: `newCareer(saved)` adds `bestStreak` (number ≥ 0, default 0); `UPGRADES` gains:
  - `carwash`: Saul's car wash, 120.
  - `crew`: Mike's crew, 90.
  - `methylamine`: the methylamine barrel, 110.
  - `vamonos`: the Vamonos Pest tent, 100.

- [ ] Test `it('loads a career saved before heat and the new upgrades')`: `newCareer({ day: 4, money: 30, points: 50, upgrades: ['burner', 'nope'] })` gives `upgrades: ['burner']` and `bestStreak: 0`. Test the four new upgrades buy once each. FAIL → implement → PASS → commit.

### Task 3.2: The day: prep, rush hour, close, stars

**Interfaces:**
- Produces:
  - `newDay(career, rand)` returns `{ day, queue, rush: [start, end] | null, quiet: boolean }`.
  - The rush is the arrivals from 35% to 65% of the day's span, with gaps halved.
  - `quiet` is true when the career has `vamonos` and `day % 7 === 0`; a quiet day has no rush.
  - `inRush(plan, clock) -> boolean`.
  - `starsFor(totals: number[]) -> 0 | 1 | 2 | 3`, from the average: ≥90 → 3, ≥75 → 2, ≥60 → 1, else 0.

- [ ] Tests:
  - Rush gaps are half the others (seeded `rng(3)`).
  - `inRush` at the window's edges.
  - A day with `vamonos` that's a multiple of 7 is quiet, with no rush.
  - `starsFor([95, 91])` is 3, `starsFor([80, 70])` is 2, `starsFor([40])` is 0.
  - Then FAIL → implement → PASS → commit.

### Task 3.3: Specials and streaks

**Interfaces:**
- Produces:
  - `SPECIALS`:
    - `pollos`: Gus, large, purity 99, box, pay ×2.
    - `czech`: Lydia, medium (two trays), barrel, purity ≥ 97, pay ×2.
    - `tucorush`: Tuco, medium, patience ×0.5, pay ×2.
  - From day 4, `newDay` gives at most one special a day, to a customer in the roster; its queue entry carries `special: id`.
  - `streakMultiplier(n) -> 1 | 1.5 | 2 | 3` (n ≤ 1 → 1, 2 → 1.5, 3 → 2, ≥ 4 → 3).
  - `payFor(order, total, upgrades, { rush = false, streak = 0, special = null } = {})` applies:
    - rush ×1.5;
    - `streakMultiplier(streak)`;
    - the special's pay;
    - `methylamine` ×1.25 on large.
  - `waitScore` reads the special's patience.

- [ ] Tests:
  - A special appears on day 4+ only, at most once, for a rostered customer.
  - A `czech` order is medium + barrel.
  - The `streakMultiplier` table.
  - `payFor` with each modifier alone and combined (exact integers for a fixed order and total 95).
  - The existing `payFor` tests unchanged.
  - Then FAIL → implement → PASS → commit.

### Task 3.4: Heat

**Interfaces:**
- Produces:
  - `M.heat = { perSale: 6, lowPurity: 6, rushFactor: 1.5, decay: 0.05, hankAt: 60, max: 100 }`.
    - `lowPurity` applies when the made purity is below 90.
    - `decay` is per second; `carwash` doubles it.
  - `heatAfterSale(heat, { purity, rush }, upgrades) -> number`, clamped to [0, 100].
  - `heatDecay(heat, seconds, upgrades)`, where `seconds` is capped at 2 per call.
  - `hankDue(before, after) -> boolean` (crossing `hankAt`).
  - `busted(heat) -> boolean` (at `max`).
  - `crewWarns(heat, upgrades) -> boolean` (`crew` and heat ≥ `hankAt - 10`).

- [ ] Tests:
  - A clean sale adds 6, a sale at purity 85 in the rush adds 18.
  - Car wash decay is twice the plain rate.
  - A 30 s gap decays as 2 s.
  - Crossing 60 makes Hank due once.
  - 100 is busted.
  - The crew warns at 50 and not without the upgrade.
  - Then FAIL → implement → PASS → commit.

### Task 3.5: Wiring it into the game

**Files:**
- Modify: `Metherria.jsx`, `Ticket.jsx`, the Metherria styles in `src/index.css` (or its existing stylesheet)

**Interfaces:**
- Consumes: Tasks 3.1–3.4.
- Behavior:
  - **HUD:** a day clock, a "Rush hour" banner while `inRush`, a streak counter, a heat meter. The crew's warning appears as a call.
  - **Hank:** raids come from `hankDue` instead of the random `raidAt`. `busted` ends the shift with a "Hank's at the door" summary.
  - **Tickets:** a special shows a badge (`Pollos run`, `Czech shipment`, `Rush order`).
  - **Summary:** shows stars and the day's best streak; `bestStreak` is saved.
  - **The shop:** lists the new upgrades with their text from the spec.

- [ ] QA: play a seeded shift through `__METH__` to a rush, a special, a streak of 3 and a raid; capture each at desktop and 390×844. Lint, test, build; commit; PR; merge; reset.

## Phase 4 (PR 4): game feel

### Task 4.1: Effects

**Files:**
- Create: `src/components/albuquerque/metherria/fx.js` (+ `fx.test.js`)
- Modify: `scene.js`, `Metherria.jsx`, `src/lib/sfx.js`

**Interfaces:**
- Produces:
  - `shakeAt(since: number, strength: number) -> number`: offset in metres. Equals `strength` at 0, decays to 0 by 0.25 s, 0 after.
  - `pushIn(since) -> number`: 0..1, eased over 0.6 s and back by 1.4 s.
  - `live.fx = [{ kind: 'strike' | 'perfect' | 'pour' | 'serve', at }]` (last few), written by `Metherria.jsx`, read by `scene.js`.
  - In `sfx.js`: `pour()`, `bubbling(level)` (looping, returns a stop function), `crack()`, `rustle()`, `register()`, all procedural.
- Scene:
  - Splash droplets in the flask while pouring.
  - Shards flying from each strike.
  - Blue sparkles and a push-in on a station scored ≥ 95.
  - The camera shakes on strikes.
  - All instanced, within the budget.
- Score pops: the existing `say()` per station stays, and gains the streak count.

- [ ] Tests: `shakeAt(0, 0.02) === 0.02`, `shakeAt(0.3, 0.02) === 0`, monotone decreasing in between; `pushIn(0) === 0`, `pushIn(0.6) === 1`, `pushIn(1.5) === 0`. FAIL → implement → PASS.
- [ ] QA: captures mid-strike and on a perfect; ≤ 300 calls. Lint, test, build; commit; PR; merge; reset.

## Phase 5 (PR 5): Casa Tranquila

### Task 5.1: The rules

**Files:**
- Create: `src/components/albuquerque/casa/rules.js`, `casa/rules.test.js`

**Interfaces:**
- Produces:
  - `ROWS = ['ABCDEF','GHIJKL','MNOPQR','STUVWX','YZ']`, `WORDS` as in `HectorBoard.jsx`.
  - `newGame(rand) -> state`, with `phase: 'rows'` and three words.
  - `stepGame(state, dt) -> state`: moves the finger every `speed(w)` seconds, where `speed(w) = max(0.38, 0.56 - 0.07 w)`. Rows cycle; letters go back to rows after two passes.
  - `ring(state) -> { state, event }`, with event one of: `'row'`, `'letter'`, `'miss'`, `'word'`, `'gus'`, `'bell'`, `'boom'`, `'ignored'`.
  - The phases: `'rows' | 'letters' | 'gus' | 'bell' | 'boom' | 'after'`.
  - `score(state) = round(seconds + 5 * misses)`.
- Finale:
  - The last word spelled → `'gus'`: Gus walks in for 2.5 s of `stepGame`, then `'bell'`.
  - In `'bell'`, three rings → `'boom'`; after 2.6 s, `'after'`.
  - Rings in `'gus'` or `'boom'` are `'ignored'`.

- [ ] Tests:
  - Ringing on a lit row picks it.
  - The right letter fills the word.
  - A wrong letter is a miss and returns to rows.
  - Two silent passes return to rows.
  - Each word is faster than the last.
  - The last word goes to `'gus'`, and a ring there is ignored.
  - Three rings in `'bell'` boom.
  - Ten rings in one frame during `'bell'` still give exactly one `'boom'` (Review Focus).
  - Score with 2 misses in 20 s is 30.
- [ ] FAIL → implement → PASS → commit.

### Task 5.2: The scene

**Files:**
- Create: `src/components/albuquerque/casa/scene.js`

**Interfaces:**
- Consumes: `loadPeople`/`person` with `ABQ.hector` (`pose: 'wheelchair'`), `ABQ.nurse` and `ABQ.gus` (`pose: 'stand'`); the stage helpers in `src/components/office/stage3d.js` (`createStage`, `lightOffice`).
- Produces: `createCasa3D(canvas, { onLost }) -> Promise<{ render(state, { dt, ms }), resize(w, h), info(), dispose(), lost }>`.
- Contents:
  - **The room:** CC0 plaster and linoleum, a window onto the desert, the bed, the door.
  - **Hector:** a procedural wheelchair, the bell on its tray. His head turns to the board; he glares on `'miss'`.
  - **The nurse:** holds the board, a canvas-textured plane repainted when the lit cell or the word changes. Her right hand reaches to the lit cell.
  - **Gus:** walks in during `'gus'` (procedural stride), then stands.
  - **`'boom'`:** a flash light, fireball sprites with `cloud.webp`, smoke, instanced debris, and a scorched room after.
  - **`'after'`:** Gus walks out, tie gesture (`reach('right', tie)`).
- Budget: ≤ 300 calls.

- [ ] QA captures of each phase at desktop and mobile; diagnostics logged; commit.

### Task 5.3: The component and the page

**Files:**
- Create: `src/components/albuquerque/casa/CasaTranquila.jsx`
- Modify: `src/pages/Albuquerque.jsx` (the two sections become one "Face Off at Casa Tranquila" section), the page styles

**Interfaces:**
- Consumes: Tasks 5.1, 5.2; `use3D` from `src/lib/gpu`; `HectorBoard` and `HectorBell` as the fallback.
- Behavior:
  - **Input:** Ding button, Space/Enter and tapping the canvas ring.
  - **Display:** the HUD shows the word, the count, misses and the best score (`tp-hector-best`).
  - **Sound:** `sfx` ding/buzz/boom/crumble as now.
  - **Fallback:** without WebGL, on a lost context, or if `createCasa3D` rejects, the two 2D games show.

- [ ] QA:
  - A full game through the finale at desktop and 390×844.
  - Hold Space through the finale: one boom.
  - The 2D fallback with WebGL disabled.
- [ ] Lint, test, build; commit; PR; merge; reset.
