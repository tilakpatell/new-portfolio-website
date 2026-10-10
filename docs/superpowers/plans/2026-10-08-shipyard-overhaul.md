# Shipyard Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Three pull requests, A then B then C, each merged to `main` once lint, the tests and the build are clean.

**Goal:** A Shipyard that fills the page, weapons that come from what's fitted, and a refit staged on a draft and bought in one atomic checkout.

**Architecture:** The rules are pure modules tested in Node: `weapons.js` (the weapon table and an armoury built from the loadout), `outfit.js` (two slots appended), `economy.js` (save v2: sell, checkout, a log), `yardRules.js` (the draft, what it costs, what can be sold). `showroom.js` draws the draft's ship on its own canvas with the map's own `buildShip`; `Shipyard.jsx` lays out catalogue, showroom and bill and calls the rules. `Universe.jsx` applies a draft: checkout, then the fits it already does.

**Tech Stack:** three 0.186, React 19, vitest, playwright-core for the browser check. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-shipyard-overhaul-design.md`

## Global Constraints

- British spelling, curly quotes in prose and UI copy, plain sentences; comments say why.
- Rules in pure tested modules, apart from the drawing. Tests first.
- No new 3D models; new parts carry `look` (an existing part of the slot). No runtime calls to asset services.
- Never print or commit `MESHY_API_KEY` or `SKETCHFAB_API_TOKEN`.
- Everything from the wire or storage goes through a reader; an unknown part is stock, an unknown shot code is `blaster`.
- `protocol.js`'s `DAMAGE_MAX = 30` and `PUNCH_MAX = 24` are unchanged; no weapon's `damage` exceeds 30.
- `SLOTS = ['paint', 'booster', 'thrusters', 'guns', 'shields', 'fins', 'secondary', 'ordnance']` (appended, never reordered). `tp-pilot` is version 2. `SELL_BACK = 0.6`, refunds floored. The log keeps 30 entries.
- The Shipyard's panes: catalogue 300 px, bill 320 px, three panes from 900 px up; showroom 38 vh on a phone; touch targets 44 px; the showroom at most 30 fps.
- Commit messages are one plain sentence about what changed; the body says why. Every commit ends with the session's attribution lines.
- Before every push: `npm run lint`, `npm test`, `npm run build`. Each PR adds one short paragraph to the universe section of `docs/architecture.md` and updates `docs/superpowers/HANDOFF-shipyard-overhaul.md` (create it in PR A).

## Review Focus

1. **A loadout saved before this work** (six slots) must read with `secondary` and `ordnance` stock and fly as it did. Task A2, test `an old loadout reads with stock secondary and ordnance`.
2. **A peer on the old build sending a shot with `w: 2`** must still draw as heavy ordnance, and one sending `w: 40` as a blaster bolt. Task A4, test `a shot code past the table reads as the blaster`.
3. **A checkout where the second item is short** must buy nothing and leave the wallet untouched. Task B1, test `checkout buys nothing when any item fails`.
4. **A draft Applied after another tab changed the saves** must not fit a part the plant can't run: `fit` refuses and the yard re-opens from live. Task C2, test in `useYard.test.js`: `apply re-opens the draft when a fit is refused`.
5. **A phone at 390 px with the bill expanded** must leave the nav and the safe area uncovered and Apply reachable. Task C6, the check script's phone shot and its assertion on the Apply button's bounding box.

---

## PR A: weapons from what's fitted

### Task A1: `weapons.js`, the table and the armoury from a loadout

**Files:**
- Modify: `src/components/universe/weapons.js`
- Create: `src/components/universe/weaponTable.js` (the table alone, a leaf: `outfit.js` reads it as it loads and `weapons.js` reads `outfit.js`, so the table can't live in `weapons.js` without an import cycle)
- Test: `src/components/universe/weapons.test.js`

**Interfaces:**
- Consumes: `outfit.js`'s `STOCK_LOADOUT`, `partById(slot, id)` (a part carries `weapon` on the `secondary` and `ordnance` slots; Task A2 adds them. For A1, the test fakes a loadout `{ secondary: 'ion', ordnance: 'missiles' }` and `weapons.js` reads `partById(slot, id)?.weapon ?? LINE_STOCK[line]`).
- Produces: `WEAPONS` (ids `blaster, spread, heavy, ion, flak, missiles, mk2`, each `{ code, line, cadence, count, cone, life, speed, damage, punch, scale, homing?, ammo?, reload?, heavy? }` with the spec's table), `LINES = ['primary', 'secondary', 'ordnance']`, `LINE_SLOT = { primary: 'guns', secondary: 'secondary', ordnance: 'ordnance' }`, `LINE_STOCK = { primary: 'blaster', secondary: 'spread', ordnance: 'heavy' }`, `byCode(code) → id`, `createArmory(kind, loadout = STOCK_LOADOUT) → { index, id, line, weapon, name, ammo, ammoMax, filling, select(i), cycle(dir), ready(now, cadence), fired(now), update(dt), reload(), refit(loadout) }`, `arsenalOf`, `fan`, `steer` as now. `ORDER` is removed.

- [ ] **Step 1: Write the failing tests** in `weapons.test.js`, replacing the `ORDER` test: `every weapon has its own code under 16 and damage at most 30`; `an unknown code is the blaster` (`byCode(40)`, `byCode(-1)`, `byCode('2')` all `'blaster'`); `the stock armoury is the blaster, the spread and the heavy rack` (`createArmory('xwing')` lines read `['blaster', 'spread', 'heavy']` through `cycle`, names `'Laser cannons'`, `'Ion scatter'`, `'Proton torpedoes'`); `an armoury takes its secondary and ordnance from the loadout` (loadout `{ ...STOCK_LOADOUT, secondary: 'ion', ordnance: 'missiles' }` gives `ion` on line 1 with the part's name and `ammoMax` 6); `refit keeps the line and clamps the rounds` (select line 2, fire twice from 4, refit to `mk2` (ammo 3): `ammo` is 2, `index` still 2; refit to stock: `ammo` 2 of 4); the existing cycle, pace and reload tests kept.
- [ ] **Step 2: Run them**: `npx vitest run src/components/universe/weapons.test.js`. Expected: FAIL (`ORDER` import, `ion` missing).
- [ ] **Step 3: Implement** the table and `createArmory` per Interfaces. `name` on a line is `partById(LINE_SLOT[line], loadout[slot])?.name` when that part isn't stock, else `arsenalOf(kind).names[index]`. `update` and `filling` use the ordnance line's `ammo` and `reload`.
- [ ] **Step 4: Run the tests**: PASS. Also `npx vitest run src/components/universe` to see which other tests import `ORDER` (fix them in A4 if any).
- [ ] **Step 5: Commit**: `git commit -m "The armoury is built from the loadout, with seven weapons on three lines"`.

### Task A2: `outfit.js`, two slots and six parts

**Files:**
- Modify: `src/components/universe/outfit.js:24-26` (SLOTS, labels), `:45-150` (PARTS), `:289-309` (readout, partEffects)
- Test: `src/components/universe/outfit.test.js`

**Interfaces:**
- Consumes: `weaponTable.js`'s `WEAPONS` (for the readout's ordnance row).
- Also: the weapon parts' `look` names a gun (`twin`, `fusion`), and `modules.js` draws a fitted secondary or ordnance as that gun in its own holder, set out from the primary's. The starter-parts test holds for the five flying slots; on the RV's 5 MW plant a starter weapon fits on a stock ship, not on top of every starter.
- Produces: `SLOTS` with `secondary` and `ordnance` appended; `SLOT_LABEL.guns = 'Primary'`, `secondary: 'Secondary'`, `ordnance: 'Ordnance'`; parts `secondary: STOCK ('Scatter', weapon 'spread'), ion ('Ion burst', mass 1, power 1, achievement 'rebels', hint as the incom part's, look 'twin', weapon 'ion'), flak ('Flak burst', mass 1.5, power 2, look 'twin', weapon 'flak')`; `ordnance: STOCK ('Torpedo rack', weapon 'heavy'), missiles ('Missile rack', mass 1, power 1, look 'fusion', weapon 'missiles'), mk2 ('Mk II torpedoes', mass 2, power 2, achievement 'trench', hint as the afterburner's, look 'fusion', weapon 'mk2')`; `readout` gains `{ id: 'ordnance' }` after `firepower` with `READOUT_LABEL.ordnance = 'Ordnance'`; `partEffects` says `'3 shots a burst'`, `'Rounds: 6, one back every 4.5 s'`.

- [ ] **Step 1: Write the failing tests**: `an old loadout reads with stock secondary and ordnance` (`readLoadout({ booster: 'srb' })` has `secondary` and `ordnance` equal to `STOCK`; `readOutfit(['srb','stock','stock','stock','stock'])` likewise); `the wire carries the seven parts in order` (`writeOutfit` length 7, `readOutfit(writeOutfit(l))` equals `l` for a loadout with `ion` and `mk2`); `the readout has an ordnance row` (up with `missiles`; down with `mk2`, which by the spec's `punch × ammo / reload` sustains less than the stock rack); `partEffects says a secondary's shots and an ordnance's rounds`.
- [ ] **Step 2: Run**: `npx vitest run src/components/universe/outfit.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** The ordnance measure in `measures(s)` is `s.ordnance` where `statsOf` adds `ordnance: (w.punch * w.ammo) / w.reload` of the fitted ordnance weapon divided by the stock rack's (`heavy`: 8 × 4 / 6.5). `BEST` already walks every fit.
- [ ] **Step 4: Run the universe tests**: `npx vitest run src/components/universe`. Expected: PASS (catalog's snapshot or count tests may need the new items: fix in A3, not here, unless they fail on shape).
- [ ] **Step 5: Commit**: `git commit -m "Two weapon slots after the fins: a secondary and an ordnance rack, each a part"`.

### Task A3: `catalog.js` prices the new weapons

**Files:**
- Modify: `src/components/universe/catalog.js:47-56` (`partShare`), `:62-71` (`NEW`)
- Test: `src/components/universe/catalog.test.js`

**Interfaces:**
- Produces: `partShare` adds `(count × punch / cadence) / (5 × 0.6 / 2.4) − 1` for a part with `weapon` on line `secondary`, and `(punch × ammo / reload) / (8 × 4 / 6.5) − 1` for one on `ordnance` (the weapon's numbers from `WEAPONS[p.weapon]`); `NEW` gains `'part:secondary:flak': { needs: { level: 4 } }` and `'part:ordnance:missiles': { needs: { level: 3 } }` (prices from the bands, `from: null`). The ion burst and the Mk II come out at 100 by those formulas (their worth is the harder hit, not more a second), so `NEW` prices them by hand as the incom part is: `'part:secondary:ion': 700`, `'part:ordnance:mk2': 900`, both `from: 'starwars'`.

- [ ] **Step 1: Write the failing tests**: `the new weapons are priced between 400 and 1000` (`itemFor('part','secondary','ion')`, `flak`, `ordnance/missiles`, `mk2` each `price` in `[400, 1000]`, none stock); `stock weapons are free and owned` (`itemFor('part','secondary','stock').stock === true`); `flak needs level 4 and missiles level 3`.
- [ ] **Step 2: Run**: FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/components/universe/catalog.test.js src/components/universe/economy.test.js src/components/universe/shop.test.js`: PASS.
- [ ] **Step 5: Commit**: `git commit -m "The catalogue prices a secondary by its burst and an ordnance rack by its rounds"`.

### Task A4: the scene fires the fitted armoury; the wire and the others' shots

**Files:**
- Modify: `src/components/universe/scene.js:2063-2067` (`arms`), the `setLoadout` path (search `state.loadout =`), `:2520-2540` (the readout: unchanged in shape)
- Modify: `src/components/universe/online/protocol.js:254` (`w`), `src/components/universe/online/pilots.js:278-290` (`fireBolt`)
- Modify: `src/components/universe/Hangar.jsx` (nothing but `TABS` picks up the two slots through `SLOTS`; check the slot grid's `repeat(4, 1fr)` still reads with nine tabs; add a row if not)
- Test: `src/components/universe/online/protocol.test.js`, `src/components/universe/online/pilotsRules.test.js` only if it covers `fireBolt`

**Interfaces:**
- Consumes: `createArmory(kind, loadout)`, `refit`, `byCode`, `WEAPONS`.

- [ ] **Step 1: Write the failing tests** in `protocol.test.js`: `a shot code past the table reads as the blaster` (`readShot([0,0,0,1,0,0,40]).w === 0`; `readShot([...,6]).w === 6`; `readShot([...,2]).w === 2`).
- [ ] **Step 2: Run**: FAIL on 6. **Step 3: Implement**: `w` is `data[6]` when it is an integer and some weapon in `WEAPONS` has that `code`; otherwise 0.
- [ ] **Step 4: `scene.js`**: `arms()` makes `createArmory(state.kind, state.loadout)` on a kind change and calls `armory.refit(state.loadout)` where the loadout is set. `pickWeapon` and `fire` unchanged. The DEV `__universeDebug.arms` stays.
- [ ] **Step 5: `pilots.js` `fireBolt`**: `const w = WEAPONS[byCode(s.w)]`; `if (w.heavy) one(…, 4, BOLT_LIFE * w.life, arsenalOf(s.kind).heavy)`; `else if (w.count > 1) fan(…, w.count, w.cone)` with `k * w.scale` and `w.life`; else as now.
- [ ] **Step 6: Run everything**: `npm run lint && npm test && npm run build`. Then the dev server and, on `/universe` with a crew: `R` cycles three lines, the names change with a part fitted in the old hangar's Secondary tab, the rack's pips follow the ordnance fitted.
- [ ] **Step 7: Commit, handoff, PR**: `git commit -m "The map fires the armoury the hangar fitted, and the others draw each weapon by its code"`. Create `docs/superpowers/HANDOFF-shipyard-overhaul.md` (Done: PR A; Left: B, C; Checking it) and the architecture paragraph; push `claude/shipyard-weapons`; open PR A to `main`; merge when green.

---

## PR B: the economy, staged and reversible

### Task B1: `economy.js` v2: sell, checkout, the log

**Files:**
- Modify: `src/components/universe/economy.js`
- Test: `src/components/universe/economy.test.js`

**Interfaces:**
- Produces: `VERSION = 2`; `SELL_BACK = 0.6`; `LOG_MAX = 30`; `refundOf(item) → number`; on the wallet: `canSell(item) → { ok, why: null | 'invalid' | 'stock' | 'notOwned' }`, `sell(item) → number | false`, `checkout(items) → { ok, why, item, total }`, `log` getter (array copy), `record().log`. `saves.register({ key: PILOT_KEY, version: 2, migrate: (old, v) => (v === 1 ? { ...old, log: [] } : old) })` (a v0 or junk save is still a fresh wallet: `good` stays the shape check).

- [ ] **Step 1: Write the failing tests**: `a version 1 save migrates with an empty log and nothing else changed`; `selling pays back three fifths, floored` (price 450 → 270 credits back, `owned` without the key, `earned` unchanged, `spent` unchanged); `stock and unowned items can't be sold` (`why` `'stock'`, `'notOwned'`); `checkout buys nothing when any item fails` (credits 500, items priced 300 and 300: `{ ok: false, why: 'credits', item: second }`, credits still 500, owned empty); `checkout buys all in one change` (one listener call, credits down by the sum, every key owned); `the log keeps the last 30 newest last` (31 earns → 30 entries, first is the second earn).
- [ ] **Step 2: Run**: FAIL. **Step 3: Implement** per Interfaces (`checkout` checks every `canBuy` first, then mutates, then one `changed()`). **Step 4: Run** `npx vitest run src/components/universe/economy.test.js src/components/universe/EconomyProvider* src/components/universe/useEarn*`: PASS.
- [ ] **Step 5: Commit**: `git commit -m "The wallet sells back at three fifths, buys a list at once or not at all, and keeps a log"`.

### Task B2: `yardRules.js`, the draft and the bill

**Files:**
- Create: `src/components/universe/yardRules.js`
- Test: `src/components/universe/yardRules.test.js`

**Interfaces:**
- Consumes: `outfit.js`'s `SLOTS`, `STOCK`, `equip`, `fits`, `powerOf`, `statsOf`, `isOpen`, `partById`, `readLoadout`, `readLoadouts`; `shipyard/build.js`'s `STOCK_BUILD`, `rollBuild`, `parseBuildCode`, `readHulls`; `shipyard/parts.js`'s `BUILD_SLOTS`, `moduleById`, `isModuleOpen`; `catalog.js`'s `itemFor`, `needText`; `economy.js`'s wallet (`owns`, `canBuy`, `credits`), `refundOf`; `crews.js`'s `CREWS`.
- Produces: `openDraft(live) → { build, loadout }`; `setPart(draft, slot, id)`; `setModule(draft, slot, id)`; `setHull(draft, garage, lastBuild)`; `rollDraft(draft, seed, unlocked, owned)`; `pasteDraft(draft, code) → { draft } | { error }`; `check(draft, { kind, unlocked, economy }) → { ok, issues, toBuy, total, short, power, capacity, mass }`; `diff(draft, live) → [{ slot, from, to, module }]`; `sellable({ loadouts, hulls, garage }, economy) → [{ item, refund }]`; `itemOfPart(slot, id)` and `itemOfModule(slot, id)` (the catalogue keys, so the view never builds a key).

- [ ] **Step 1: Write the failing tests**: `a draft from live is equal and not the same object`; `setPart and setModule return new drafts and leave the old` ; `setHull on opens the last build or stock`; `check lists a locked part, a part the plant can't run, and what's short` (`issues` kinds `locked`, `power`, `short`; `toBuy` holds the unowned; `total` their sum; `short` = `total − credits` when over); `check is ok on a draft of owned, open, fitting parts`; `diff puts the build first and leaves out what hasn't changed`; `pasteDraft refuses a bad code and a code with an unowned module`; `sellable leaves out what any crew flies` (an `srb` on the falcon's loadout isn't sellable; an owned `rcs` fitted nowhere is, with refund 120 for a 200 part).
- [ ] **Step 2: Run**: FAIL. **Step 3: Implement.** `check`'s texts: `'Locked. <hint>.'`, `'Not enough power: N MW short.'`, `'Short N ¢.'`. **Step 4: Run**: PASS.
- [ ] **Step 5: Commit, handoff, PR**: `git commit -m "The shipyard's rules: a draft, what it costs, what it will fit and what can be sold"`. Update the handoff (Done: B) and architecture; push `claude/shipyard-economy`; PR B; merge when green.

---

## PR C: the Shipyard

### Task C1: `showroom.js`, the ship on its own canvas

**Files:**
- Create: `src/components/universe/shipyard/showroom.js`
- Create: `src/components/universe/shipyard/showroomRules.js` (pure: the camera's distance for a canvas shape, the pulse's value at a time, the turn per drag pixel)
- Test: `src/components/universe/shipyard/showroomRules.test.js`

**Interfaces:**
- Consumes: `shipModels.js`'s `buildShip(kind, {}, { build })` and its `paint`, `outfit(loadout)`, `modules` (holders by slot name), `dispose`; `livery.js`'s `createLivery`; `paint.js`'s `parsePaint` and the paint table; `lib/three/renderer`'s `quiet`, `releaseContext`; `lib/device`'s `pixelRatio`.
- Produces: `createShowroom(canvas, { reduced = false } = {}) → { show({ kind, build, loadout }), focus(slot | null), dispose() } | null`; `showroomRules.js`: `fitDistance(aspect, length, fov) → number`, `pulseAt(t) → 0…1` (a 1.2 s sine), `yawFromDrag(dx) → radians` (0.012 a px), `FPS = 30`.

- [ ] **Step 1: Write the failing tests** for the rules: `the camera backs off on a tall canvas`, `the pulse is 0 at 0 and 1 at 0.6 s`, `a 100 px drag turns 1.2 rad`.
- [ ] **Step 2: Run**: FAIL. **Step 3: Implement** `showroomRules.js`, then `showroom.js` after `wardrobe/preview.js`'s shape: renderer, lights (key `0xfff6e8` 2.2, fill the universe's `--engine` blue 0.8, rim behind), a disc with a `GridHelper` at 0.25 opacity, `show` rebuilds only on `kind`, `build` change (compare `writeBuild`), else `outfit` and the livery's `set`; `focus(slot)` sets `emissive` on the holder's meshes through the pulse; a loop at `FPS` while `document.visibilityState === 'visible'`, stopped on `dispose`.
- [ ] **Step 4: Run** the rules tests: PASS; `npm run build` compiles the module.
- [ ] **Step 5: Commit**: `git commit -m "A showroom: the draft's ship on a turntable on its own canvas"`.

### Task C2: `useYard.js`, the draft in React

**Files:**
- Create: `src/components/universe/shipyard/useYard.js`
- Test: `src/components/universe/shipyard/useYard.test.js` (with `@testing-library/react` if present in `package.json`; else test the reducer: export `yardReducer(state, action)` and test it pure)

**Interfaces:**
- Consumes: `yardRules.js` (every export).
- Produces: `useYard({ live, kind, unlocked, economy, onApply }) → { draft, checked, dirty, setPart, setModule, setHull, roll, paste, revert, apply, looking, setLooking }` where `apply()` calls `onApply({ diff: diff(draft, live), toBuy: checked.toBuy })` and expects `{ ok, why }` back; on `ok` the draft re-opens from the new live; on a refusal it re-opens from live and returns the `why`. `dirty = diff(draft, live).length > 0`.

- [ ] **Step 1: Write the failing tests**: `a draft follows live until it's touched`; `apply re-opens the draft when a fit is refused` (onApply returns `{ ok: false, why: 'power' }`: draft equals live after); `revert drops the staged changes`.
- [ ] **Step 2: Run**: FAIL. **Step 3: Implement** (a reducer with `open`, `part`, `module`, `hull`, `roll`, `paste`, `revert` actions; `checked` memoised on `draft`, `economy.credits`, `economy.owned` size, `unlocked`). **Step 4: Run**: PASS.
- [ ] **Step 5: Commit**: `git commit -m "The yard's draft as a hook: staged until applied, dropped on revert"`.

### Task C3: `Shipyard.jsx` and `shipyard.css`

**Files:**
- Create: `src/components/universe/shipyard/Shipyard.jsx`, `YardCatalogue.jsx`, `YardBill.jsx`, `shipyard.css`
- Modify: `src/components/universe/Hangar.jsx` (becomes the button alone: keep `universe-hangar-btn`, label “Shipyard: build, paint and parts (H)”, the `H` and Escape handling moves to `Shipyard.jsx`)

**Interfaces:**
- Consumes: `useYard`, `createShowroom`, `shop.js`'s `pillOf`, `outfit.js`'s `readout`, `READOUT_LABEL`, `statsOf`, `partsFor`, `SLOT_LABEL`; `shipyard/parts.js`'s `BUILD_SLOTS`, `BUILD_SLOT_LABEL`, `modulesFor`; `build.js`'s `buildCode`; `Record.jsx`; `crews.js`'s `crewById`; `wardrobe/looks.js`'s `castOfCrew`.
- Produces: `<Shipyard open onClose ship shipName live lastBuild unlocked economy onApply onSell onCrew returnTo=".universe-hangar-btn" />`. `onSell(item)` is `economy.sell` wrapped by the page (so the note shows). Copy: title “Shipyard”; Apply “Apply and launch”; Revert “Revert”; a sell button “Sell · 270 ¢” then “Sure? · 270 ¢” for 4 s; the empty sell list “Nothing to sell: everything you own is fitted somewhere.”; the note slot's defaults as the hangar's.

- [ ] **Step 1: Build the layout** per the spec's Part 3 (three panes from 900 px, the phone's stacked layout with the bill as a bottom sheet), `role="dialog" aria-modal="true"`, focus trapped (`lib/focus.js` if it has a trap; else a small one in the file), Escape closes, `H` toggles (same typing guard as the hangar had). The rail is a `tablist`; the slot order is the spec's fourteen.
- [ ] **Step 2: Wire the showroom**: a `<canvas>` with `createShowroom` in an effect, `show({ kind, build: draft.build, loadout: draft.loadout })` on each draft change, `focus(looking?.slot ?? null)`. No WebGL → the still card.
- [ ] **Step 3: Wire the bill**: power cells (as the hangar's), the readout bars with `then` from `looking`, the wallet line, the staged list from `diff`, `total`, `short`, Apply disabled while `!checked.ok || !dirty`, each issue in a line under it; Sell from `sellable`.
- [ ] **Step 4: Check** in the browser (`npx vite`): open with H, stage three parts across tabs, see the bill, Apply with enough credits (`window.__universeDebug.economy.earn('warWin', 10)` in dev: expose `economy` on `__universeDebug` through the page if not already), Revert, sell one, phone width in devtools.
- [ ] **Step 5: Commit**: `git commit -m "The Shipyard fills the page: the catalogue, the ship in its showroom, and the bill"`.

### Task C4: the page applies a draft; the ways in

**Files:**
- Modify: `src/pages/Universe.jsx:105-160` (state), `:520-580` (render: `<Shipyard>` beside `<Wardrobe>`, `hangar` state renamed `yard`)
- Modify: `src/components/universe/UniverseMap.jsx:416` (the `<Hangar>` becomes the button alone; the map asks for no frames while `hangar` is open: pass `frozen={frozen || hangar}`)
- Modify: `src/components/universe/UniversePanel.jsx:96-99` (“Open the shipyard”)
- Modify: `src/components/universe/scene.js` near `:4719` (the dock line: when `state.at === 'projects'` and the ship is flying, `state.note = { text: 'Dock at the shipyard (H)', until: wall() + 3 }` once per approach)
- Modify: `src/components/universe/universe.css:1240-1300` (the sheet's rules go; the button's stay), `:1472-1476`

**Interfaces:**
- Consumes: `economy.checkout`, `economy.sell`, `fit`, `setBuild`, `useEconomy()`.
- Produces: `onApply({ diff, toBuy, draft })`: `yardRules.fitDraft` tries every fit on a copy first (the page's `fit` reads the loadout of the last render, so fits in a row would be stale), refusing with nothing paid; then `checkout(toBuy)`; then `setBuild` and the loadout saved in one pass; the note “Bought N parts for T ¢” through the page's earn note slot (`EarnNote` takes `{ text }`).

- [ ] **Step 1: Wire it** as above. The old `Hangar` props (`loadout`, `build`, `onBuild`, `onFit`, `dropped`) move to `<Shipyard live={{ build, loadout }} …>`; `dropped` is shown in the bill's issues line as the hangar showed it.
- [ ] **Step 2: Run** `npm run lint && npm test && npm run build`; then the browser: H from the map, the panel's button, the dock line at the projects station, Escape back to the map with nothing moved.
- [ ] **Step 3: Commit**: `git commit -m "The page opens the Shipyard, applies a draft through one checkout, and the spacedock says so"`.

### Task C5: the galaxy and the others still read the saves

**Files:**
- Verify only: `src/pages/Galaxy.jsx:153-156`, `src/pages/GalaxySurface.jsx`, `src/components/universe/online/useOnline.js:58`, `src/components/Achievements.jsx:299-306`

- [ ] **Step 1: Check** each reads `tp-universe-loadout` and `tp-universe-hull` through the readers (they do today) and that `newInHangar` says “shipyard” (change the copy to “New in your shipyard: …”).
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy src/components/universe/online src/components/Achievements*`: PASS. Commit if the copy changed.

### Task C6: `scripts/shipyard-check.mjs`

**Files:**
- Create: `scripts/shipyard-check.mjs` (after `scripts/universe-check.mjs`'s server start and shot helpers)

- [ ] **Step 1: Write it**: `node scripts/shipyard-check.mjs [--url] [--out lab/shipyard]`. Opens `/universe` with the X-wing kept as the crew (`tp-universe-ship`), presses `H`, waits for `[role=dialog][aria-label=Shipyard]`, shoots `desk.webp` at 1280 × 720 and `phone.webp` at 390 × 844 (expand the bill first); asserts the showroom canvas's colour entropy above the inspector's blank threshold; runs `window.__universeDebug.economy.earn('warWin', 10)` (level 4); clicks the Secondary tab's `Flak burst` row (the Ion burst needs the Battle of Yavin), reads the bill's total text matches `/\d+ ¢/`; clicks Apply; asserts `localStorage['tp-pilot']` (`{ v, data }`) has `owned` containing `part:secondary:flak` and `tp-universe-loadout`'s xwing `secondary === 'flak'`; on the phone shot asserts the Apply button's box is inside the viewport minus the nav's height. Exit 1 on any miss.
- [ ] **Step 2: Run it** with the dev server; open the two shots and look. Fix what they show.
- [ ] **Step 3: Commit**: `git commit -m "A browser check for the Shipyard at desk and phone widths"`.

### Task C7: docs, handoff, PR C

- [ ] **Step 1**: `docs/architecture.md`, universe section: one paragraph on `shipyard/` (the rules, the showroom, the view) and the weapon lines; `README.md` only if it names the hangar.
- [ ] **Step 2**: `docs/superpowers/HANDOFF-shipyard-overhaul.md`: Done (A, B, C with PR numbers), Left (the galaxy's armoury, phase 2; anything found), Checking it (the check script, the dev hooks, the sell confirm).
- [ ] **Step 3**: `npm run lint && npm test && npm run build`; `node scripts/autopilot-check.mjs --routes /universe --phone`; look at the shots.
- [ ] **Step 4**: merge `origin/main` in, push `claude/shipyard-view`, open PR C with the shots, merge when green.
