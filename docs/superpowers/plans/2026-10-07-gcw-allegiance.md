# Galactic Civil War, revision 3 (allegiance, consequence, place, voice): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. One pull request per PR section below; merge each once CI is green before starting the next (the repo's convention: merge commits, never rebase, never red).

**Goal:** A pilot swears to the Rebellion or the Empire, and the galaxy's war reads it everywhere: control moves both ways on the films' trade routes, who holds a system decides who hunts, escorts, parks and lands there, every system fights its own kind of battle with its own fleets and commanders, and the crews, the heroes and the commanders speak to your side, your rank and your record.

**Architecture:** New pure modules beside `gcw.js`: `allegiance.js` (the oath), `warEffects.js` (what an owner means for a system), `ranks.js` and `warCast.js` (data), with `gcw.js` made two-sided and route-based, `battles.js` given a kind and a template per system, and `universe/battle.js` given one option (`objectivesOn`). The drawing and the pages change only to read those modules: `scene.js` works `effectsFor` out per system and per step and hands it on; `warfront.js` sets the team from the oath; `HoloMap.jsx`, `GalaxyPanel.jsx`, a new `WarHud.jsx` and the surface page show and ask.

**Tech Stack:** JavaScript ES modules, React 19, vitest, three 0.186 (untouched by the rules), Node 22, Playwright for the browser checks.

**Spec:** `docs/superpowers/specs/2026-10-07-gcw-allegiance-design.md` (and, where it stands, `2026-10-06-fleet-war-design.md` revision 2).

## Global Constraints

- British spelling, curly quotes in prose and UI copy; comments say why, in the repo's voice (read a neighbouring file's header first). No model names in code, docs or commits.
- Every rules module is pure (no three.js, no DOM), seeded through a `rand` argument where it needs one, tested in Node. Tests are written first.
- Nothing a visitor can do is lost: every existing test in `src/components/galaxy/` and `src/components/universe/` keeps passing, changed only where this plan says.
- `docs/health/budgets.json`: `big-files` 30, `lint-disables` 54, `todo-notes` 0. No new file over the big-file line (`scripts/health/big-files.mjs` says where it is), no `eslint-disable`, no TODO. `scene.js` (2,284 lines) and `surface/scene.js` (2,585) are already over it: add to them only the wiring named, nothing else.
- Before every push: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, all clean.
- Storage keys: `tp-gcw` (the tally, unchanged), `tp-gcw-side` (new). Read and write through `lib/hooks`' `local` or a try/catch, never bare `localStorage`.
- Points are in hundredths of a system's control, as `GCW.points` has them: `objective 3, kill 0.1, turret 0.5, win 10`, plus the new `intercept 1`, `ace 2`.
- The wire: only the `war` tally's key shape changes (`r:<sys>:<step>`, `e:<sys>:<step>`, `win:r:<sys>:<step>`, `win:e:<sys>:<step>`). Old-shape keys read as the Rebellion's.
- Commit messages: one plain sentence, ending with the session's attribution lines.

## Review Focus

1. **A save from the previous build.** `tp-gcw` holding keys of the old shape (`hoth:12`) in the current campaign must count as Rebel points, never be dropped or doubled. Pinned in Task 3: "a key of the old shape is the Rebellion's".
2. **Unsworn in a battle.** With `side: null`, `warfront.js` must run the battle with `setYou(null)`: no fighter targets you, no points are scored, no `join` line, and the `ask` event fires once per battle. Pinned in Task 4: "unsworn, the battle asks once and scores nothing".
3. **A system with no `war` entry.** A system added to `systems.js` later without `war` must still be in the war with `worth 1, weight 1, kind 'assault'` and the `DEFAULT` template. Pinned in Task 5: "a war system without a war entry gets the defaults".
4. **The other side online.** Two pilots in the same system on opposite sides: the Imperial pilot's `fight` message has no keys at a liberation and the Rebel's does; neither throws on the other's. Pinned in Task 4: "an Imperial pilot at a liberation sends no fight keys".
5. **A separatist world taken by the Rebellion.** Geonosis held by the Rebels must still send the droids (always hostile) and not the Rebellion's own hunters against a Rebel pilot. Pinned in Task 7: "a separatist world keeps its droids whoever holds it".

---

## PR 1 — spec and plan

### Task 1: Commit the documents

**Files:**
- Create: `docs/superpowers/specs/2026-10-07-gcw-allegiance-design.md` (written)
- Create: `docs/superpowers/plans/2026-10-07-gcw-allegiance.md` (this)

- [ ] **Step 1:** Commit: "Design and plan for the Galactic Civil War's sides, consequences, places and voices".
- [ ] **Step 2:** Push, open the PR, wait for CI, merge.

---

## PR 2 — the oath and a two-sided war (pure)

### Task 2: `galaxy/allegiance.js`

**Files:**
- Create: `src/components/galaxy/allegiance.js`, `src/components/galaxy/allegiance.test.js`

**Interfaces:**
- Produces: `SIDE_KEY = 'tp-gcw-side'`; `SIDES = ['rebel', 'empire']`; `readAllegiance(raw, { now }) → { side, since, sworn, turncoat }` (`raw` a JSON string, an object or nothing; a `since` from another campaign than `campaignAt(now).n` resets to unsworn); `writeAllegiance(a) → string`; `swear(a, side, now) → a'` (same side: unchanged; first oath: `sworn 1`, `turncoat false`; another side in the same campaign: `sworn + 1`, `turncoat true`, `side` the new one); `suggestSide({ crew, hero }) → 'rebel' | 'empire' | null` (`crew` a crew id: `xwing`, `falcon` → `rebel`; `hero` a `heroes.js` id whose `side` wins over the crew when set); `teamFor(side, battle) → 0 | 1 | null` (`battle.attacker` `'rebel'` → rebel 0, empire 1; `'empire'` → reverse; `side` null → null); `otherSide(side)`.

- [ ] **Step 1:** Write `allegiance.test.js`: "nothing kept is unsworn", "a bad save is unsworn", "an oath from a past campaign is forgotten", "swearing the other side in a campaign is a turncoat", "swearing the same side again changes nothing", "the X-wing and the Falcon suggest the Rebellion, the cruiser nothing, Fett the Empire" (import `HEROES` once Task 15 lands; until then pass `hero: { side }` objects: the function takes an id or an object with `side`), "teamFor both attackers and unsworn".
- [ ] **Step 2:** Run `npx vitest run src/components/galaxy/allegiance` — fails: module not found.
- [ ] **Step 3:** Implement `allegiance.js` (imports `campaignAt` from `./gcw`; the hero lookup is lazy: `heroById` from `./heroes`, which has no `side` yet, so `?.side ?? null`).
- [ ] **Step 4:** Run the tests — pass. Commit: "allegiance.js: the oath to a side of the Galactic Civil War, kept for the campaign".

### Task 3: `gcw.js` two-sided, on the routes, with worth and regions

**Files:**
- Modify: `src/components/galaxy/gcw.js`, `src/components/galaxy/gcw.test.js`
- Modify: `src/components/galaxy/systems.js` (the `war` entries, Task 5 fills them; this task adds the field to the four it needs for its tests: Hoth `weight 4`, Coruscant `worth 3`, Endor `worth 2`, Yavin `weight 2`) and `src/components/galaxy/systems.test.js` (shape only: `war`, when present, is `{ worth: 1|2|3, weight: 1|2|4, kind: string, flagships?, cast? }`)

**Interfaces:**
- Produces: `pointsKey(side, sys, step)` → `` `${side[0]}:${sys}:${step}` `` (`'r'`/`'e'`); `winKey(side, sys, step)` → `` `win:${side[0]}:${sys}:${step}` ``; `readKey(key) → { side, win, sys, step } | null` (old shapes `sys:step` and `win:sys:step` → `side 'rebel'`); `NEIGHBOURS` from routes; `regionOf(id)`; `GCW` gains `supply: 1, regionBonus: 2, routeReach: 2.2, points.intercept: 1, points.ace: 2`, loses `majors`; `history(n, ms, value)` returns `{ owner, control, fronts, attack, rates, major, step, regions, over }`; `warTable(ms, value)` gains `regions`, `over`, and per system `worth`, `kind`.
- Consumes: `ROUTES`, `REGIONS`, `SYSTEMS` from `./systems`.

- [ ] **Step 1:** Add tests to `gcw.test.js`: "a key of the old shape is the Rebellion's" (`value` returning 50 for `'hoth:3'` lifts Hoth as `pointsKey('rebel','hoth',3)` would); "Imperial points push a front down" (a front at control 0.3 with `e:` points 20 at step k ends lower than with none); "a win is the side's that won it" (`win:e:` at a defence costs the system); "supply: a front with more attacker neighbours moves faster than one with fewer" (two synthetic owners through a `supplyOf(id, owner, attacker)` export); "a region held whole gives its side's bordering fronts the bonus"; "every route's systems are a chain in NEIGHBOURS" (consecutive snapped systems are neighbours); "the major order is the highest worth front"; "a campaign is over early when one side holds everything" (`value` returning huge `r:` points everywhere → `over === 'rebel'`); keep every existing test, updating `pointsKey`/`winKey` calls to the new arity.
- [ ] **Step 2:** Run `npx vitest run src/components/galaxy/gcw` — the new tests fail.
- [ ] **Step 3:** Implement. Routes: for each route, snap each point to the nearest war system within `GCW.routeReach` (skip points with none), dedupe consecutive, join consecutive pairs; then the nearest two by distance per system; then `GCW.links`. Regions: `regionOf(id)` = the first `REGIONS` ring whose `r` ≥ `hypot(pos − centre)` where the centre is `systems.js`'s (export `CENTRE` from `systems.js` if it is a local). In `history`'s step: `pts = (rebel points − empire points)/100 + win share signed by side`; a front's rate = seeded rate + `supply × (attackerNeighbours − 1) − supply × (defenderNeighbours − 1)` + `regionBonus` when a bordering region is whole for the attacker; the attack pick weights by `war.weight ?? 1`; the front order by `war.worth ?? 1` desc then the campaign's seeded order; `over` when every owner is one side (stop stepping).
- [ ] **Step 4:** Run the galaxy and universe tests — pass. `npm run lint`.
- [ ] **Step 5:** Commit: "gcw.js: a two-sided war on the trade routes, with supply, regions, worth and an early end".

### Task 4: `warState.js` with sides, `ranks.js`, `warfront.js` scoring both ways

**Files:**
- Create: `src/components/galaxy/ranks.js`, `src/components/galaxy/ranks.test.js`
- Modify: `src/components/galaxy/warState.js`, `warState.test.js`, `warfront.js`, `warfront.test.js`

**Interfaces:**
- Produces: `RANKS = { rebel: [{ id, name, at }×6], empire: [...×6] }` (Rebellion: Flight Cadet 0, Pilot 5, Flight Leader 15, Squadron Leader 35, Captain 70, Commander 120; Empire: Ensign 0, Lieutenant 5, Flight Officer 15, Wing Commander 35, Captain 70, Admiral 120); `rankOf(side, points) → RANKS[side][i]`; `warState.addPoints(side, sys, step, points, now)`, `addWin(side, sys, step, now)`, `mine(now) → { points, wins, battles, systems: [{ id, wins, losses }], major }` (own shares only; `major` when a win key's system was the major at that step: `history` is asked per win); `warfront.createWarFront(..., { allegiance: () => a })` with `info.team`, `info.asked`, `swear(side)` as a dev hook, and events `ask` (once a battle while unsworn), `intercept`, `ace`.
- Consumes: Task 2's `teamFor`, Task 3's keys.

- [ ] **Step 1:** `ranks.test.js`: "six ranks a side, `at` strictly rising from 0", "rankOf at 0, at a boundary, past the top". `warState.test.js`: "points go under the side's key", "mine sums only own shares", "a win is counted once a side". `warfront.test.js`: "unsworn, the battle asks once and scores nothing" (a fake battle emitting `down { mine: true }`; `addPoints` not called; `emit` saw `{ id: 'battle', sub: 'ask' }` once over two updates); "an Imperial pilot at a liberation sends no fight keys" (`net.fight` never called with keys; `net.war` carries `e:` keys after a `down`); "a defender's bomber down near the flagship is an intercept"; "the ace down is `ace` points and the ace line".
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Implement. `warfront.js`: `team = teamFor(allegiance().side, on)`; `battle.setYou(team)`; after `start`, `if (team === null && !asked) { asked = true; say('ask'); }`; on `allegiance` change (poll `allegiance().side` each update; it is cheap) call `setYou` again and `say('join')` when it becomes non-null with `tookPart`; scoring by `team`: `e.mine` points go to the pilot's side; `intercept` when `e.type === 'down' && e.mine && e.kind` is a bomber role and the pilot's team is the defender; `ace` when `e.ace`. `REBELS` constant goes.
- [ ] **Step 4:** Run `npx vitest run src/components/galaxy` — pass. Lint, build, health.
- [ ] **Step 5:** Commit: "The war scores for the side you swore to, ranks you for it, and asks when you haven't". Push, PR, CI, merge.

---

## PR 3 — place: a kind of battle and a template for every system

### Task 5: `systems.js` `war` entries and `battles.js` kinds and templates

**Files:**
- Modify: `src/components/galaxy/systems.js`, `systems.test.js`, `battles.js`, `battles.test.js`

**Interfaces:**
- Produces: every war system's `war: { worth, weight, kind, flagships?: { rebel?, empire? }, cast: { rebel: [], empire: [] } }` per the spec's section 4 (cast ids filled in Task 10; until then `cast` may be empty arrays); `BATTLE_KINDS = { assault, evacuation, siege, interdiction, blockade, ambush }` each `{ id, name, text: { rebel, empire }, objective: 'flagship' | 'interdictor' | 'runners' | 'bridge', runners: null | { side: 'defender' | 'attacker', kind, count, need }, rocks: boolean, line: boolean }`; `kindFor(sysId)`; `templateFor(id)` returns a template for every war system (each with `rebels`, `empire`, `fighters`, optional `ace: { rebels?, empire? }` of `{ kind, name, hp }`); `layBattle(sys, battle, opts)` returns createBattle options including `objectivesOn`, `runners`, `avoid` (rocks for `ambush`: `rocks.js`'s field centres), `kind`.
- Consumes: `SIZE`, `obstacles` as now.

- [ ] **Step 1:** `systems.test.js`: "every war system has a war entry with a known kind" (`WAR_SYSTEMS` from `gcw.js`; `kind in BATTLE_KINDS`); "a war system without a war entry gets the defaults" (`kindFor` and `templateFor` on a synthetic id through `templateFor({ id: 'x', war: undefined })` → `DEFAULT`, `kind 'assault'`). `battles.test.js`: "a template for every war system, every ship kind sized" (`SIZE[kind]` defined for every escort and flagship); "each kind lays out clear of its obstacles" (for each war system, `layBattle` → no capital's start inside an obstacle sphere); "an interdiction puts the objectives on the Interdictor" (`objectivesOn === 'interdictor'` and the empire line has an `interdictor`); "a blockade's runners are the attacker's, an evacuation's the defender's"; "an ambush has rocks to avoid and no line".
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Fill `systems.js` `war` for every war system (the spec's worth/weight table; kinds: `siege` Endor, Scarif, Coruscant; `evacuation` Hoth, Yavin, Lothal; `interdiction` Mandalore, Nevarro, Mustafar, Kessel; `blockade` Naboo, Kamino, Kashyyyk, Sorgan, Bespin; `ambush` Tatooine, Geonosis; any other `assault`. Check `WAR_SYSTEMS` for the full list and give each the nearest kind). Write `TEMPLATES` for each with the films' flagship names. `layBattle`: `objectivesOn` from the kind; runners from the kind with `addRunner`'s shape (`warfront.js` makes them after `createBattle`, as Hoth's piece does today).
- [ ] **Step 4:** Run — pass. Commit: "Every system in the war fights its own kind of battle with its own fleets".

### Task 6: `universe/battle.js` `objectivesOn`, aces, runner wins

**Files:**
- Modify: `src/components/universe/battle.js`, `battle.test.js`; `src/components/galaxy/warfront.js`, `warfront.test.js`; `src/components/galaxy/warpieces/hoth.js` → the transports' run moved to `warpieces/evacuation.js` (Hoth's piece keeps the ion cannon and uses it)

**Interfaces:**
- Produces: `createBattle({ ..., objectivesOn = 'flagship', ace = { 0: null, 1: null }, runners = null })`: with `objectivesOn: 'interdictor'` the defender's subsystems sit on the first escort of kind `interdictor` (its hull spheres, `SUBSYSTEMS.interdictor` added to `wars.js`: two generators on the domes, a bridge, a reactor); `ace[team]` flags one fighter: `f.ace = true`, `f.tgt.name = ace.name`, hp `ace.hp`, and its `down` event carries `ace: true`; `runners` → `{ side, kind, count, need, speed }` makes `addRunner`s at the start and ends the battle for that side's win when `need` escape (`over { why: 'runners' }`), for the other side when all are down.
- Consumes: Task 5's `layBattle` output.

- [ ] **Step 1:** `battle.test.js`: "objectives on the interdictor are reachable by bolts from all round" (the existing all-round bolt test, run on an interdiction layout); "the ace is named and its down says so"; "runners escaping win the battle for their side, all down loses it". `warfront.test.js`: "a battle of each kind starts and runs ten seconds without throwing" (fake scene, `force(attacker, kind)` dev hook).
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run `npx vitest run src/components/universe src/components/galaxy` — pass; lint, build, health.
- [ ] **Step 5:** Commit: "Battles with their objectives on an Interdictor, a named ace, and runners that decide them". Push, PR, CI, merge.

---

## PR 4 — consequence: who holds a system decides what meets you there

### Task 7: `galaxy/warEffects.js` and the Rebellion's hunters

**Files:**
- Create: `src/components/galaxy/warEffects.js`, `warEffects.test.js`
- Modify: `src/components/galaxy/hunted.js`, `hunted.test.js`, `roamRules.js`, `roamRules.test.js`, `lines.js` (the `rebellion`, `rebelnavy` and `escort` hunted lines for all four crews), `lines.test.js` (`HUNTED` gains `rebellion`, `rebelnavy`, `escort`)

**Interfaces:**
- Produces: `effectsFor(sysId, table, allegiance) → effects` with the spec's exact shape (`table` is `warTable`'s result; `allegiance` Task 2's object); `garrisonFleet(effects) → [{ kind, size }]`; `hunted.FACTIONS.rebellion`, `.rebelnavy`, `KINDS.redleader`, `NAMES.redleader = 'Red Leader'`, `AHEAD.rebellion`; `roamRules.galaxySide(sys, effects)` (effects optional: without it, as today) and `ROLES.rebellion`; `ROAM_EVENTS.escort`.
- Consumes: Task 3's `warTable`.

- [ ] **Step 1:** `warEffects.test.js`: "every war system, both sides and unsworn, gives the full shape" (iterate; every key present, `hostile false` when unsworn); "a separatist world keeps its droids whoever holds it" (Geonosis owned `rebel`, pilot `rebel`: `garrison 'rebellion'`, and `droids: true`: add `droids: boolean` to the shape); "a deserter is hunted in the space they left"; "a front adds heat 1, an attack 2"; "traffic is the owner's plus the system's civil kinds". `roamRules.test.js`: "a Rebel system with a Rebel pilot has no hunt faction and an escort event"; "with an Imperial pilot the Rebellion hunts". `hunted.test.js`: the new rows have the row shape.
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass.
- [ ] **Step 5:** Commit: "warEffects.js: what holding a system means, and the Rebellion as hunters and escorts".

### Task 8: wiring `scene.js`, `world.js`, traffic, the director

**Files:**
- Modify: `src/components/galaxy/scene.js` (the `effects` computation at `enter` and on the war's `stateKey` change; `roam.update` gets `side: galaxySide(sys, effects)` and `calm: !effects.hostile`; `hunters.stock` for the garrison's `AHEAD`; the `escort` event plays `universe/wingmen.js`'s wing with the side's kinds; `info.effects`; `__galaxyDebug.effects`), `src/components/galaxy/world.js` (`setEffects(e)`: fleet pieces by `e.fleet`, battle pieces by front-or-attack-in-lull, `garrisonFleet` where no piece; traffic kinds from `e.traffic`), `src/components/universe/wingRules.js` (`tie`, `interceptor` ally rows under the starwars side with `who`), `src/components/galaxy/world.test.js`

- [ ] **Step 1:** `world.test.js` (pure parts: `piecesFor(sys, effects)` extracted as a pure export): "a Rebel-held Endor shows no Imperial fleet piece", "a front in its lull shows the standing battle", "a system with no piece gets the garrison fleet".
- [ ] **Step 2:** Run — fail. **Step 3:** Implement; keep `scene.js`'s additions to the named hooks.
- [ ] **Step 4:** `npm test`, lint, build, health — clean. Browser: `npx vite --port 5188` then `OUT=/tmp/shots node scripts/galaxy-check.mjs` still passes; look at a Rebel-held and an Imperial-held system's orbit.
- [ ] **Step 5:** Commit: "The galaxy reads the war: garrisons, escorts, traffic and orbiting fleets follow who holds a system". Push, PR, CI, merge.

---

## PR 5 — voice: sides, commanders, heroes

### Task 9: `lines.js` by side, kind and place

**Files:**
- Modify: `src/components/galaxy/lines.js`, `lines.test.js`; `src/components/universe/crews.js` (`linesFor(crew, 'event', 'battle', sub, side)`: when `f[sub]` is an object with `rebel`/`empire`, return the side's, else as now), `crews.test.js`

**Interfaces:**
- Produces: `GALAXY_LINES[crew].events.battle[key] = { rebel, empire }` for `BATTLE_KEYS = ['ask', 'front', 'join', 'gens', 'bridge', 'reactor', 'won', 'lost', 'turncoat', 'ace', 'escort', 'deserter', 'intercept', 'runners', 'gate', 'interdictor', 'blockade']` (`ask` is one exchange, not per side: `{ any }`); `events.battleAt[sysId][key]` for Endor, Hoth, Scarif, Yavin, Coruscant, Lothal, Naboo, Bespin (at least `front` and `won` each, per side); `battleLines(crew, sysId, key, side)` → `battleAt` first, then `battle`.
- Consumes: `linesFor`'s `more` argument as the side.

- [ ] **Step 1:** `lines.test.js`: "every battle key has both sides in every crew" (`BATTLE_KEYS` × `['rebel','empire']`, `ask` has `any`); "every battleAt key is a battle key and its system is in the war"; "battleLines prefers the place's line". `crews.test.js`: "linesFor picks a side's battle line".
- [ ] **Step 2:** Run — fail. **Step 3:** Write the lines (four crews × 17 keys × 2 sides, plus eight systems' overrides; the crews' voices as the files have them: Rick for the Empire is funny about it, Luke for the Empire is wrong and knows it, Han takes the money, Walt admires the organisation). **Step 4:** Run — pass.
- [ ] **Step 5:** Commit: "The crews' battle lines by side, by kind of battle, and by where it's fought".

### Task 10: `warCast.js` and the commander on the comms

**Files:**
- Create: `src/components/galaxy/warCast.js`, `warCast.test.js`
- Modify: `src/components/universe/Comms.jsx` (a line's optional fourth element `{ name, color }` names the comms speaker for that line), `src/components/galaxy/systems.js` (`war.cast` filled), `systems.test.js` ("every cast id exists"), `src/components/galaxy/warfront.js` (each battle event emits `{ type: 'event', id: 'battle', sub, side, sys, rank, cast: castFor(sys, side) }`), `src/pages/Galaxy.jsx` (the comms handler: the commander's line then the crew's, through `warCast.say`)

**Interfaces:**
- Produces: `CAST` (the spec's seventeen), `castFor(sysId, side) → cast entry`, `say(entry, key, { rank, again }) → exchange` (a `['comms', text, undefined, { name, color }]` line with `{rank}` filled; `again` picks `lines.again` for `front` when set); `CAST_KEYS = ['front', 'join', 'gens', 'bridge', 'reactor', 'won', 'lost']`.
- Consumes: Task 4's `rankOf`, `mine`.

- [ ] **Step 1:** `warCast.test.js`: "every commander has every CAST_KEY and a side"; "castFor falls back to the side's general"; "{rank} is filled"; "a fourth element on a line is kept by linesFor and ignored by sounds" (`Comms.jsx` is React: test `speakerFor(line, crew)` extracted as a pure export).
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run — pass; lint, build.
- [ ] **Step 5:** Commit: "The films' commanders on the comms in the war, by system and side, who know your rank".

### Task 11: heroes with a side

**Files:**
- Modify: `src/components/galaxy/heroes.js`, `heroes.test.js`, `surface/HeroPanel.jsx`, `src/components/galaxy/allegiance.js` (`suggestSide` reads `heroById(id).side`), `allegiance.test.js`

- [ ] **Step 1:** `heroes.test.js`: "every hero has a side of rebel, empire or null and two assault lines"; `allegiance.test.js`: "Fett as hero suggests the Empire over the X-wing".
- [ ] **Step 2:** Run — fail. **Step 3:** Add `side` and `lines: { ours, theirs }` to each hero; the card's line in `HeroPanel.jsx` ("Flies for the Rebellion" / "Takes the Empire's contract" / nothing). **Step 4:** Run — pass.
- [ ] **Step 5:** Commit: "The heroes have a side, and say so". Push, PR, CI, merge.

---

## PR 6 — the table, the panel, the HUD

### Task 12: oath buttons, rank and regions on the holotable and the panel; `WarHud.jsx`; achievements; guide

**Files:**
- Modify: `src/components/galaxy/HoloMap.jsx`, `GalaxyPanel.jsx`, `GalaxyView.jsx`, `galaxy.css`, `src/pages/Galaxy.jsx` (the allegiance state: `readAllegiance(local.get(SIDE_KEY))`, `swear` → `local.set`, passed to the view's handle so `warfront.js`'s `allegiance()` reads it), `src/components/Achievements.jsx`, `src/components/guide/pages.js`
- Create: `src/components/galaxy/WarHud.jsx`

**Interfaces:**
- Consumes: Task 3's `warTable` (`regions`, `over`, `worth`, `kind`), Task 4's `mine`, `rankOf`, Task 5's `BATTLE_KINDS[kind].text[side]`, Task 10's `castFor`.
- Produces: achievements `gcwSworn`, `gcwLiberator`, `gcwMajor`, `gcwTurncoat`, `gcwAdmiral` (unlocked in `Galaxy.jsx` on the war events: `sworn`, a system's owner flipping at a step you fought in, a `won` at the major, `turncoat`, `rankOf(...).id` the top).

- [ ] **Step 1:** Extract the pure bits for tests: `HoloMap.jsx`'s `standing(row, now, side)` and the new `regionLine(regions, side)` into `galaxy/warText.js` with `warText.test.js` ("standing from the Empire's view inverts control", "a region line names the holder").
- [ ] **Step 2:** Run — fail. **Step 3:** Implement the UI: the war card's two buttons (`aria-pressed` on the sworn one, the suggested one outlined), the rank and record line, the regions list, the kind's text on a system's card and the "Fight it on the ground" button where `game.also` has an assault; the panel's war card; `WarHud.jsx` (one line: kind, objective, clock, side colour); the five achievements; the guide tip.
- [ ] **Step 4:** `npm test`, lint, build, health. Browser: `OUT=/tmp/shots node scripts/galaxy-war-check.mjs` with a new `SIDE=empire` run (the script swears through `window.__galaxyDebug.war.swear('empire')`, checks `war.info.team === 1`, scores a kill, opens the table and checks the Empire's view). Look at the screenshots.
- [ ] **Step 5:** Commit: "Swear to a side on the holotable or in the panel; your rank, your record, the regions and the battle's kind". Push, PR, CI, merge.

---

## PR 7 — the ground in the war

### Task 13: the surface assault's side and result, the garrison on the ground

**Files:**
- Modify: `src/components/galaxy/surface/missions/assault.js`, `assault.test.js` (`result.posts: { attack: n, defend: n }` taken while you were up; `sideFor(mission, side)` → `'attack' | 'defend'` from `mission.sides[x].id` against the war side (`REBELS.id`/`EMPIRE.id` in `assaults.js` are `rebels`/`empire`; map `rebel` → `rebels`)), `surface/AssaultHud.jsx` (the suggested side highlighted; picking the other calls `onSwear`), `src/pages/GalaxySurface.jsx` (reads the allegiance, posts `addWin`/`addPoints` through `warState.js` on `done`, with the system id and `campaignAt(now).step`), `src/components/galaxy/travel.js` (`surfaceProps` carries `effects`), `surface/hostiles.js` or the sites' kind lookup (`troopKind(kind, effects.troops)` mapping `stormtrooper`-family kinds to the owner's), `hostiles.test.js`

- [ ] **Step 1:** `assault.test.js`: "the result counts each post once for the side that took it"; "sideFor maps the war's side to the map's"; `hostiles.test.js`: "an Imperial trooper kind maps to the Rebellion's on a Rebel world and back".
- [ ] **Step 2:** Run — fail. **Step 3:** Implement. **Step 4:** Run; lint, build, health. Browser: `OUT=/tmp/shots node scripts/assault-check.mjs hoth` gains a check that `localStorage['tp-gcw']` holds a `win:` key after a win.
- [ ] **Step 5:** Commit: "The battles on the ground are the war's: your side, their result, and the garrison that meets you". Push, PR, CI, merge.

---

## PR 8 — docs, handoff, checks

### Task 14: documentation

**Files:**
- Modify: `docs/architecture.md` (the galaxy's war section), `README.md` (the galaxy paragraph), `docs/superpowers/HANDOFF-fleet-war.md` (a "Revision 3" section: done, left, checking it), `docs/autopilot/backlog.md`, `scripts/galaxy-war-check.mjs` (`KIND=` runs per battle kind through `war.force(attacker, kind)`)

- [ ] **Step 1:** Write them, from the code as it landed (where a doc and the code disagree, the code wins). Voice the new lines if the ElevenLabs key is to hand (`npm run voices`); else list them under Left.
- [ ] **Step 2:** lint, build, health. Commit: "Docs and checks for the war's third revision". Push, PR, CI, merge.
