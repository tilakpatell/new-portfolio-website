# Handoff: the shipyard overhaul (building, weapons, the economy)

Spec: `docs/superpowers/specs/2026-10-08-shipyard-overhaul-design.md`.
Plan: `docs/superpowers/plans/2026-10-08-shipyard-overhaul.md` (three pull requests: A weapons, B the economy, C the Shipyard view).

## Done
- **PR A, weapons** (`claude/shipyard-weapons`): `weaponTable.js` (seven weapons, each a wire code), `weapons.js` (the armoury from the loadout, `refit`), `outfit.js` (the `secondary` and `ordnance` slots and six parts, the read-out's Ordnance row), `catalog.js` (their prices and locks), `modules.js` (a fitted secondary or ordnance drawn as the gun it borrows the look of), `scene.js` (the armoury refits with the loadout; the HUD's rack shows as many pips as the rack holds), `online/protocol.js` and `online/pilots.js` (any code in the table, drawn by what the weapon is).

## Left
- PR B: the wallet's save v2 (sell, checkout, the log) and `yardRules.js`.
- PR C: the Shipyard overlay, the showroom, the check script.
- Phase 2: weapon switching in the galaxy and on its worlds.

## Rulings worth knowing
- The ion burst and the Mk II torpedoes are priced by hand (700 and 900): by the spec's formula they come out at 100, their worth being the harder hit, not more a second.
- The read-out's Ordnance row is rounds a second against the stock rack's, as the spec says: it rises with the missile rack and falls with the Mk II.
- On the RV's 5 MW plant, a starter weapon fits on a stock ship but not on top of every other starter part.

## Checking it
- `npm run lint`, `npm test`, `npm run build`.
- On `/universe` with a crew: `R` cycles three lines; fit the Missile rack in the hangar's Ordnance tab and the HUD's rack shows six pips; the line's name is the part's.
