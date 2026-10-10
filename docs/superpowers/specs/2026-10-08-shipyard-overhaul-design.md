# The shipyard: building, weapons and the economy, made robust: design

Date: 2026-10-08. Status: written from the owner's request by an
architecting session (Fable 5.1), for an Opus 5.5 implementation session.
Built in three pull requests (the plan:
`docs/superpowers/plans/2026-10-08-shipyard-overhaul.md`).

## Intent

What the owner said: “We need to improve the ship logic (building, weapons,
economy). There should be a ship builder area and stuff instead of in the
corner and make it robust.”

What that means here. The hangar (`src/components/universe/Hangar.jsx`) is a
372 px sheet in the corner of the universe map with seven tabs: Build (the
shipyard's modules), Paint, Boosters, Thrusters, Weapons, Shields and Fins.
It works, and three things hold it back:

- **The area.** Everything is in one narrow scrolling column over the map.
  The ship being fitted is behind the sheet, in the chase camera, half
  covered; there is no room to see a module beside its stats, and on a
  phone the sheet covers the map entirely.
- **The weapons.** Every ship carries the same three weapons (`weapons.js`:
  a blaster, a spread and heavy ordnance). The hangar's Weapons tab only
  changes the blaster's rate and punch. Nothing fitted changes what the
  spread or the ordnance is, so the shop has four guns to sell and nothing
  else to shoot with.
- **The economy.** Every press on a part buys it and fits it at once. There
  is no way to see what a whole refit would cost before paying, no undo, no
  selling back, and nothing records where the credits went. A wrong tap on
  a phone is 700 credits gone.

Done looks like: a Shipyard that fills the viewport, with the ship on a
turntable in the middle, the catalogue down one side and the ship's
numbers, the wallet and the bill down the other. Changes are staged on a
draft, priced as a whole, and bought and fitted in one step that either
all goes through or none of it does. Weapons are three lines of real
choices (primary, secondary, ordnance), each a part the shop sells and the
ship fires. Credits can be got back by selling what is fitted nowhere, and
a ledger shows every credit in and out. Every rule is a pure, tested
module; the view only draws.

## Decisions

Taken by the architecting session, since the owner was not present to
ask. Each is the safer reading; the owner can overturn any of them.

1. **The Shipyard is an overlay on the universe page, not a route.** The
   map stays mounted and frozen underneath (as the wardrobe and the nav
   map already do), so closing it is instant and nothing reloads. The ship
   is shown on a canvas of its own (`showroom.js`, as
   `rickmorty/wardrobe/preview.js` does for the figures), built by the same
   `shipModels.buildShip` the map flies, so what you see is what you fly.
   A route would have torn the scene down on every visit.
2. **A draft, then one checkout.** The yard edits a draft `{ build, loadout }`.
   Nothing is bought or fitted until Apply, which buys every unowned part
   in the draft in one atomic checkout and then fits the lot. If any part
   can't be bought, nothing changes. Revert throws the draft away.
3. **Weapons are three slots, appended.** `outfit.js` keeps `guns` (now
   labelled Primary) and gains `secondary` and `ordnance` at the end of
   `SLOTS`, so the wire's `o` array and every saved loadout read as before
   (a missing slot is stock). The armoury (`weapons.js` `createArmory`) is
   built from the loadout: the primary's rate and punch, the secondary's
   weapon, the ordnance's rounds. Each weapon has a wire code; an unknown
   code draws as the blaster.
4. **The galaxy keeps flying the primary.** `galaxy/scene.js` has no
   armoury and fires on `stats.cadence` and `stats.punch` as it does now.
   Secondary and ordnance switching in the galaxy is phase 2 (as the ship
   powers were), not this work.
5. **Selling pays back three fifths.** `SELL_BACK = 0.6`, floored to whole
   credits. Only an item fitted on no crew (in no saved loadout, hull or
   garage build, after the draft is applied) can be sold. Stock can't be
   sold, nor anything not owned.
6. **The save is `tp-pilot` version 2.** It adds `log`, the last 30
   entries of `{ t, kind: 'earn' | 'buy' | 'sell', what, n }`. Version 1
   migrates by adding an empty log. Nothing else in the save changes.
7. **The corner button stays as the way in.** It is relabelled Shipyard,
   keeps `H` and its place beside the flight settings, and the panel's
   “Open the hangar” becomes “Open the shipyard”. The old sheet's body is
   removed: there is one way to fit a ship, not two.
8. **No new models.** New parts are drawn as an existing part of their slot
   (`outfit.js`'s `look`, as the economy's new parts are). New weapons are
   new numbers in `weapons.js` and a colour. The showroom draws what the
   map already draws.

## What already exists

- `universe/outfit.js`: the parts by slot, `statsOf`, `equip`, `loadoutOf`,
  `readout`, the wire's `writeOutfit`/`readOutfit`. Kept in
  `tp-universe-loadout` per crew.
- `universe/shipyard/parts.js` and `build.js`: the garage build's modules,
  `rollBuild`, `statsOfBuild`, `buildCode`. Kept in `tp-universe-hull` and
  `tp-universe-garage` per crew. `modules3d.js` assembles one.
- `universe/weapons.js`: `WEAPONS` (blaster, spread, heavy), `ARSENAL` (each
  crew's names), `createArmory(kind)`, `fan`, `steer`.
- `universe/economy.js`: the wallet (`createEconomy`), `EARN`, levels,
  `canBuy`, `buy`, `spend`, `grant`, `record`; save `tp-pilot` v1.
- `universe/catalog.js`: a price and `needs` for every part, module and
  paint; `itemFor`, `priceOf`, `needText`. `shop.js`: `pillOf`, `ownsItem`,
  `ownedModules`.
- `universe/Hangar.jsx`: the sheet. `pages/Universe.jsx` holds the state
  (`loadouts`, `hulls`, `garage`, `fit`, `setBuild`) and passes it through
  `UniverseMap.jsx`.
- `universe/scene.js`: `arms()` makes the armoury per ship kind; `fire()`
  fires the armoury's weapon through `spawnBolt` or `launch`; the HUD's
  weapon readout; `pickWeapon`. `online/pilots.js` draws others' shots by
  the wire code.
- `universe/shipModels.js` `buildShip(kind, T, { build })` → `{ group,
  paint, outfit(loadout) → modules, … }`; `livery.js`; `modules.js`
  `buildModules` with a holder per slot.
- `rickmorty/wardrobe/preview.js`: a figure on a turntable on its own
  canvas. The pattern the showroom follows.
- `universe/stations.js` `projects`: the spacedock, a shipyard drawn in the
  world with nothing to do at it.

## Design

### Part 1: weapons from what's fitted

**`weapons.js`** (pure, tested). `WEAPONS` becomes a table of every weapon
the ship can carry, by id, each with a unique integer `code` for the wire
and a `line` (`'primary' | 'secondary' | 'ordnance'`):

| id | line | code | cadence | count | cone | life | speed | damage | punch | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| blaster | primary | 0 | 1 | 1 | 0 | 1 | 1 | 10 | 1 | as now |
| spread | secondary | 1 | 2.4 | 5 | 0.075 | 0.55 | 0.9 | 6 | 0.6 | as now |
| heavy | ordnance | 2 | 3.2 | 1 | 0 | 2.8 | 0.5 | 30 | 8 | homing 2.4, ammo 4, reload 6.5: as now |
| ion | secondary | 3 | 3 | 3 | 0.05 | 0.7 | 0.85 | 8 | 1.2 | scale 0.9 |
| flak | secondary | 4 | 2 | 7 | 0.12 | 0.4 | 0.95 | 4 | 0.45 | scale 0.65 |
| missiles | ordnance | 5 | 2.2 | 1 | 0 | 2.2 | 0.65 | 20 | 5 | homing 3.4, ammo 6, reload 4.5 |
| mk2 | ordnance | 6 | 4 | 1 | 0 | 3.2 | 0.45 | 30 | 12 | homing 2.0, ammo 3, reload 9 |

`damage` never exceeds `protocol.js`'s `DAMAGE_MAX` (30). `LINES =
['primary', 'secondary', 'ordnance']`. `byCode(code)` returns the id, or
`'blaster'` for anything else. `ORDER` goes; the armoury's order is the
lines'.

`createArmory(kind, loadout = STOCK_LOADOUT)` → the same face as now
(`index`, `id`, `weapon`, `name`, `ammo`, `ammoMax`, `filling`, `select`,
`cycle`, `ready`, `fired`, `update`, `reload`) plus `refit(loadout)`, which
keeps the line selected and the rounds left (clamped to the new rack).
The weapon on each line comes from the part fitted in that line's slot:
`outfit.js`'s parts for `secondary` and `ordnance` carry `weapon: <id>`;
stock is `spread` and `heavy`. The name on each line is the part's name,
or for stock the crew's `ARSENAL` name as now. The primary's cadence and
punch stay `scene.js`'s business (`stats.cadence`, `stats.punch`), as now.

**`outfit.js`.** `SLOTS = ['paint', 'booster', 'thrusters', 'guns',
'shields', 'fins', 'secondary', 'ordnance']`; `SLOT_LABEL.guns =
'Primary'`, `secondary: 'Secondary'`, `ordnance: 'Ordnance'`. New parts
(`look` names the part each is drawn as, so nothing new is modelled):

- secondary: stock Scatter (`weapon: 'spread'`); Ion burst (`ion`, mass
  1, power 1, achievement `rebels`, look `twin`); Flak burst (`flak`, mass
  1.5, power 2, level 4 in the catalogue, look `twin`).
- ordnance: stock Torpedo rack (`weapon: 'heavy'`); Missile rack
  (`missiles`, mass 1, power 1, level 3, look `fusion`); Mk II torpedoes
  (`mk2`, mass 2, power 2, achievement `trench`, look `fusion`).

`readOutfit` and `writeOutfit` need no change: they walk `PARTS_SLOTS`. A
loadout saved before this reads with both new slots stock. `readout` gains
one row, `ordnance` (`punch × ammo / reload` of the ordnance weapon against
stock's), labelled “Ordnance”. `partEffects` says a secondary's shots and
cone and an ordnance's rounds and reload in words.

**`catalog.js`.** `partShare` prices the new numbers: a secondary by
`(count × punch / cadence)` against the stock spread's, an ordnance by
`(punch × ammo / reload)` against the stock rack's, each as a share added
on. The three non-stock weapons land in the 400 to 1000 bands.

**`scene.js`.** `arms()` rebuilds the armoury when the kind changes (as
now) and calls `refit` when the loadout does (`setLoadout` already runs on
a fit). `fire()` is unchanged in shape: `w.heavy` launches, else a fan.
`net.shot` sends `w.code`. The HUD readout shows the line's name and, on
an ordnance line, the rounds, as now.

**`online/protocol.js`.** `readShot`'s `w` accepts any code in `WEAPONS`
(`byCode` makes an unknown one the blaster). `online/pilots.js` draws a
shot by the weapon's `heavy` and `count`, not by equality with a code.
`PUNCH_MAX` and `DAMAGE_MAX` stay as they are and still clamp.

### Part 2: the economy, staged and reversible

**`economy.js`** (pure, tested). Save version 2: `{ credits, xp, spent,
earned, owned, tally, bySide, log }`. `register({ key: PILOT_KEY, version:
2, migrate })`: a v1 save gains `log: []`; a v0 or junk save is a fresh
wallet as now (with the fitted-parts grant). New on the wallet:

- `SELL_BACK = 0.6`; `refundOf(item) → Math.floor(item.price × SELL_BACK)`.
- `canSell(item) → { ok, why }`: `'invalid'`, `'stock'`, `'notOwned'`.
- `sell(item) → refund | false`: takes the key off `owned`, adds the refund
  to `credits` (not to `earned`), logs it.
- `checkout(items) → { ok, why, item, total }`: every item through
  `canBuy` first (the first failure names its item and why, nothing
  bought), then all bought, one save, one `changed`. An empty list is
  `{ ok: true, total: 0 }`.
- `log` getter: a copy of the last 30 entries, newest last. `earn`, `buy`,
  `sell` and `spend` each push one. `record()` gains `log`.
- `on`, `flush`, `grant`, `spend` as now. `buy` stays, as `checkout([item])`.

**`yardRules.js`** (new, pure, tested; beside `shop.js`). The draft and
what it costs. No React, no three.js.

```
openDraft(live) → { build, loadout }                 // a copy of what's flown
setPart(draft, slot, id) → draft                     // paint and parts
setModule(draft, slot, id) → draft                   // the build's (opens a build from STOCK_BUILD if null)
setHull(draft, garage, lastBuild) → draft            // stock ⇄ garage build
rollDraft(draft, seed, unlocked, owned) → draft
pasteDraft(draft, code) → { draft } | { error }      // a build code
check(draft, { kind, unlocked, economy }) → {
  ok, issues: [{ slot, id, why: 'locked' | 'power' | 'unowned' | 'short', text }],
  toBuy: [item], total, short, power, capacity, mass }
diff(draft, live) → [{ slot, from, to, module }]     // what Apply will fit, in fit order
sellable({ loadouts, hulls, garage }, economy) → [{ item, refund }]
```

`check` is the one place the rules of a whole refit live: a locked part is
an issue whatever the wallet says; the plant must run the draft
(`outfit.js`'s `fits`); every unowned item is in `toBuy` with the sum in
`total`, and `short` is `max(0, total − credits)` (an issue of its own when
over nought). `ok` is no issues. `diff` puts the build before the parts
(the hull decides the plant) and leaves out what hasn't changed.
`sellable` walks every crew's saved loadout, hull and garage build and
lists each owned, non-stock item fitted in none of them.

**Applying a draft** (`Universe.jsx`, thin): `economy.checkout(toBuy)`;
if `ok`, `setBuild` then `fit` for each change in `diff`. `fit` already
refuses a part the plant can't run, so a draft that passed `check` fits
whole. The wallet's note slot says “Bought 3 parts for 1,450 ¢” or the
refusal.

**`catalog.js`** and **`shop.js`** are unchanged in shape; `pillOf` is
still what a row says before it's staged.

### Part 3: the Shipyard

**Where.** `src/components/universe/shipyard/Shipyard.jsx` with
`shipyard.css`, beside the data modules already there. Rendered by
`pages/Universe.jsx` beside the wardrobe, open while `yard` is true. Opened
by the corner button (`UniverseMap.jsx` keeps the button alone, relabelled
“Shipyard”, `H`), the panel's “Open the shipyard”, and a “Dock at the
shipyard (H)” line in the HUD's note slot while the ship is within reach
of the projects station (`state.at === 'projects'`): the spacedock drawn
in `stations.js` finally does something. The map is `frozen` while it's
open and asks for no frames; the HUD is hidden under it.

**Layout.** A `role="dialog"` `aria-modal="true"` panel filling the page
under the nav, focus trapped, Escape closes (the draft is kept until the
page is left or Revert is pressed). Three panes from 900 px up:

- **Left, the catalogue (300 px).** A rail of slots (Hull, Cockpit, Wings,
  Engines, Tail, Extras, Paint, Boosters, Thrusters, Primary, Secondary,
  Ordnance, Shields, Fins), then the slot's list: each row the name, what it
  does, its mass and power, and its pill (Owned, the price, short by, or the
  lock's sentence). The staged row is marked; the flown one too. A Stock /
  Garage build switch and Roll and the code field sit above the build
  slots. Pointing at a row previews it in the stats (as now) and lights its
  hardpoint in the showroom.
- **Centre, the showroom.** A canvas with the draft's ship on a turntable,
  under a dock's light, drag to turn, pinch or wheel to zoom a little. A
  slot pointed at or staged pulses the holder it's bolted to (`modules.js`'s
  holder per slot; a build's module groups). Under it, a line: the crew,
  the hull, the build code.
- **Right, the bill (320 px).** The power cells and mass; the read-out bars
  (now with Ordnance); the wallet (credits, level, title); the changes
  staged, each with its price or “owned”; the total and “short N ¢” when it
  is; Apply (disabled with issues, each said in a line under it), Revert;
  then Sell, a list of what's owned and fitted nowhere with its refund and a
  Sell button each (confirmed in place: a second press within 4 s); then
  Record and Dress the crew (as the hangar had).

Under 900 px: the showroom on top (38 vh), the slot rail as a scrolling
row of chips, the list under it, and the bill as a sheet pinned to the
bottom with the total and Apply, which expands on a tap. Nothing covers
the nav or the safe area.

**`showroom.js`** (`universe/shipyard/`, three.js, not unit-tested beyond
its pure helpers): `createShowroom(canvas, { reduced }) → { show({ kind,
build, loadout }), focus(slot | null), dispose() }`. One renderer at the
device's pixel ratio capped at 2, `quiet`-ed and released on dispose as the
wardrobe's is; a key, fill and rim light in the universe's colours; a disc
with a grid. `show` builds with `buildShip(kind, {}, { build })` and puts
the iconic ships' own models over the stand-in, as the map and the galaxy do
(amended at the owner's word, 2026-10-08), `createLivery` for the paint and
`model.outfit(loadout)` for the parts, disposes the last. A change of paint
or part is a new `outfit` and `set`, not a rebuild; a change of hull or
module is a rebuild. `focus` sets an emissive pulse on the named holder.
Slow turn unless `reduced`. The frame loop runs only while the yard is
open, at most 30 fps, and stops when the tab is hidden.

**State.** `useYard({ live, kind, unlocked, economy })` (a hook in
`Shipyard.jsx` or `useYard.js`): the draft, `set*` through `yardRules`,
`checked = check(draft, …)` memoised, `apply()` and `revert()`.
`Universe.jsx` passes `live = { build, loadout }`, `onApply(diff, toBuy)`.

**Keyboard and screen readers.** The rail is a `tablist`; rows are
buttons with `aria-pressed` for staged; the bill's lines are a list; the
note is `aria-live="polite"`. Tab order: rail, list, showroom (focusable,
arrows turn it), bill.

**Phone.** Touch targets 44 px; the showroom's drag doesn't scroll the
page; the sheet's expand is a button.

### Error handling

- Anything read from storage or the wire goes through the readers: an
  unknown part or weapon id is stock; an unknown shot code is the blaster.
- `checkout` is all or nothing; a wallet that can't be read yet (the
  provider still loading) disables Apply with “The shop's still opening”.
- `check` runs on every draft change, so Apply can never be pressed on a
  draft that won't fit; if `fit` still refuses (the saves changed in
  another tab), the yard says so and re-opens the draft from live.
- The showroom's renderer failing to start (no WebGL) leaves a still
  card with the ship's name and hull; everything else works.
- Selling asks for a second press; nothing sells on one tap.
- The draft lives in React state: a reload drops it, and nothing unpaid
  is ever in a save.

### Testing

- Vitest: `weapons.test.js` (every weapon's code is unique and under 16, an
  unknown code is the blaster, an armoury from a loadout has the right
  weapon on each line, `refit` keeps the line and clamps the rounds,
  damage never over `DAMAGE_MAX`), `outfit.test.js` (an old loadout reads
  with stock secondary and ordnance, the wire round-trips eight slots, the
  readout's ordnance row), `catalog.test.js` (the new parts are priced in
  band and keyed), `economy.test.js` (v1 migrates with an empty log, sell
  refunds three fifths floored, stock and unowned can't be sold, checkout
  is atomic on the first failure, the log keeps 30), `yardRules.test.js`
  (a draft from live is equal and not the same object, `check` lists each
  issue kind, `diff` orders the build first, `sellable` leaves out what
  any crew flies, a pasted code with an unowned module is an error),
  `protocol.test.js` (a shot with code 6 reads as mk2, with 40 as the
  blaster).
- `scripts/shipyard-check.mjs` (Playwright, as `universe-check.mjs` starts
  its server): opens `/universe`, picks a crew, presses `H`, shoots the
  yard at 1280 × 720 and 390 × 844 (the showroom's canvas not blank by the
  inspector's entropy), stages a part, reads the total, grants credits
  through `window.__universeDebug.economy.earn`, applies, and reads
  `localStorage['tp-pilot']` and `tp-universe-loadout` back. Exit 1 on
  any miss.
- `npm run lint`, `npm test`, `npm run build` clean before every merge.
  `node scripts/autopilot-check.mjs --routes /universe --phone` and a look
  at the shots.

### Out of scope

- Weapon switching in the galaxy and on its worlds (phase 2).
- New 3D models for parts or weapons; contracts, missions or a bounty
  board; trading between pilots; ship-level purchases (a hull is a module).
- Changing `EARN`, the levels, or the price bands.

## Order of work (each a PR, merged)

1. **PR A, weapons:** `weapons.js`, `outfit.js`, `catalog.js`, `scene.js`'s
   `arms`, `protocol.js`, `pilots.js`. The old hangar sells the new parts in
   its Weapons tabs so A ships on its own.
2. **PR B, the economy:** `economy.js` v2, `yardRules.js`. No UI change
   yet; the hangar still buys a part at a time through `buy`.
3. **PR C, the Shipyard:** `showroom.js`, `Shipyard.jsx`, `shipyard.css`,
   `Universe.jsx`, `UniverseMap.jsx`, `UniversePanel.jsx`, `scene.js`'s
   dock line, the removal of the sheet from `Hangar.jsx`, the check script,
   `docs/architecture.md` and the handoff.
