# Handoff: multiplayer you can see, pilots you can reach, one economy

The design is `docs/superpowers/specs/2026-10-07-multiplayer-economy-design.md` and the plan is `docs/superpowers/plans/2026-10-07-multiplayer-economy.md`.

## Done

- The architecture: the spec and the plan, written by a Fable session from a read of `universe/online/` (`protocol.js`, `client.js`, `pilots.js`, `Online.jsx`, `useOnline.js`, `where.js`), `standing.js`, `sides.js`, `outfit.js`, `shipyard/`, `Hangar.jsx`, `runtime/saves.js`, `galaxy/warState.js`, `ranks.js`, `allegiance.js`, `tally.js`, and `scene.js`'s `travel`, `frontSpace`, `deed` and the HUD's threat arrows.
- PR A, the economy (Tasks A1 to A4): `economy.js` (the wallet, levels, buying, the migration, `deedToEarn`), `catalog.js` (a price and a lock on every part, module and paint, and nine new paints and parts drawn with existing looks), `shop.js` and `pilotMarks.js` (the hangar's pills, the standing and rank lookups), `EconomyProvider.jsx` (one wallet, loaded lazily), `Record.jsx`, `useEarn.js` and `EarnNote.jsx`. The hangar sells; the roll picks only owned modules. The universe scene, the galaxy scene, the war front and the galaxy's worlds pay in. Where the plan and the code disagreed, the plan's lines were fixed to the code (owned ids are catalogue keys; Hutt gold needs level 8; the earn note is a page element, not the scene's note slot).

## Left

- PR B (tags and factions) and PR C (flying to a pilot), in parallel, off main once A is merged.
- B3 should also open `Record.jsx` from the roster's “You're …” row (spec Part 4), since `Online.jsx` was outside PR A.

## Checking it

- Two browsers online: `npx vite --port 5173`, then `node scripts/online-check.mjs /universe` (the roster and the tags), and once PR C is in, `node scripts/flyto-check.mjs`.
- The wallet: on `/universe` in dev, `window.__universeDebug` has `state`, `hunters`, `deed` and `economy`; `__universeDebug.deed('killHunter')` shows `+40 ¢`; the hangar's Buy fits the part; `localStorage['tp-pilot']` holds it after a reload.
- `npm run lint`, `npm test`, `npm run build` all green at every merge.
