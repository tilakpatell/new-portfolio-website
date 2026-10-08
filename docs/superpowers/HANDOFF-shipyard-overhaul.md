# Handoff: the shipyard overhaul (building, weapons, the economy)

Spec: `docs/superpowers/specs/2026-10-08-shipyard-overhaul-design.md`.
Plan: `docs/superpowers/plans/2026-10-08-shipyard-overhaul.md` (three pull requests: A weapons, B the economy, C the Shipyard view).

## Done
- **PR A, weapons** (#671, merged): `weaponTable.js` (seven weapons, each a wire code), `weapons.js` (the armoury from the loadout, `refit`), `outfit.js` (the `secondary` and `ordnance` slots and six parts, the read-out's Ordnance row), `catalog.js` (their prices and locks), `modules.js` (a fitted secondary or ordnance drawn as the gun it borrows the look of), `scene.js` (the armoury refits with the loadout; the HUD's rack shows as many pips as the rack holds), `Comms.jsx` (any ordnance round plays the launch sound), `online/protocol.js` and `online/pilots.js` (any code in the table, drawn by what the weapon is).
- **PR B, the economy** (#674): `economy.js` save v2 (`checkout`, `sell`, `canSell`, `refundOf`, the log; a v1 save migrates with an empty log), `yardRules.js` (the draft, `check`, `diff`, `sellable`, `pasteDraft`).
- **PR C, the Shipyard** (#675): `shipyard/showroom.js` and `showroomRules.js`, `useYard.js`, `Shipyard.jsx`, `YardCatalogue.jsx`, `YardBill.jsx`, `rail.js`, `shipyard.css`; `yardRules.fitDraft`; `Universe.jsx` applies a draft (fits tried on a copy, one checkout, then saved); `Hangar.jsx` is the corner button alone; the map is frozen under the yard; the panel's “Open the shipyard”; “Dock at the shipyard (H)” on arriving at the projects station; the achievements' toast says “New in your shipyard”; `scripts/shipyard-check.mjs`.

## Left
- Weapon switching in the galaxy and on its worlds (phase 2): `galaxy/scene.js` still flies the primary on `stats.cadence` and `stats.punch`.
- Secondary and ordnance rounds leave from the primary's muzzles, not from the gun drawn for them: a per-line muzzle list from `modules.js` would fix it.
- A build module can't be lit alone in the showroom (`modules3d.js` merges a build by material): pointing at one lights the whole hull.

## Rulings worth knowing
- The showroom shows the iconic ships' own models (the X-wing, the Falcon, the RV, the cruiser with its crew), not the plain hulls the spec named: the owner asked for the real ships, and the galaxy, which the spec cited, loads them too. A garage build is still drawn as its modules.
- When a garage build flies in place of the crew's own ship, the panel says so (`yardRules.hullLine`): a build saved from the old hangar had quietly replaced the X-wing everywhere.
- The ion burst and the Mk II torpedoes are priced by hand (700 and 900): by the spec's formula they come out at 100, their worth being the harder hit, not more a second.
- The read-out's Ordnance row is rounds a second against the stock rack's, as the spec says: it rises with the missile rack and falls with the Mk II.
- On the RV's 5 MW plant, a starter weapon fits on a stock ship but not on top of every other starter part.
- Apply tries every fit before it pays (the spec had checkout first): a draft the saves no longer allow costs nothing.
- The yard renders on the body, over the site's floating cards (the tour's offer sat over it inside the route's stacking context).

## Checking it
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- `node scripts/shipyard-check.mjs` (starts the dev server; shots and a report in `lab/shipyard/`): H opens it, the showroom draws a ship, a part bought through the bill is owned and flown, Apply is on screen under the nav on a phone.
- By hand on `/universe` with a crew: H or the corner button; stage parts on three tabs and watch the bill; Revert; Apply with too few credits (Apply is disabled, “Short N ¢”); in dev, `window.__universeDebug.economy.earn('warWin', 10)` for credits; Sell asks “Sure?” and sells on a second press within four seconds.
