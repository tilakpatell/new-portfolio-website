# Handoff: multiplayer you can see, pilots you can reach, one economy

The design is `docs/superpowers/specs/2026-10-07-multiplayer-economy-design.md` and the plan is `docs/superpowers/plans/2026-10-07-multiplayer-economy.md`.

## Done

- The architecture: the spec and the plan, written by a Fable session from a read of `universe/online/` (`protocol.js`, `client.js`, `pilots.js`, `Online.jsx`, `useOnline.js`, `where.js`), `standing.js`, `sides.js`, `outfit.js`, `shipyard/`, `Hangar.jsx`, `runtime/saves.js`, `galaxy/warState.js`, `ranks.js`, `allegiance.js`, `tally.js`, and `scene.js`'s `travel`, `frontSpace`, `deed` and the HUD's threat arrows.

## Left

Everything in the plan: PR A (the economy), then PR B (tags and factions) and PR C (flying to a pilot) in parallel.

## Checking it

- Two browsers online: `npx vite --port 5173`, then `node scripts/online-check.mjs /universe` (the roster and the tags), and once PR C is in, `node scripts/flyto-check.mjs`.
- The wallet: on `/universe` in dev, `window.__universeDebug` has `state`, `hunters`, `deed`; a kill shows `+40 ¢`; the hangar's Buy fits the part; `localStorage['tp-pilot']` holds it after a reload.
- `npm run lint`, `npm test`, `npm run build` all green at every merge.
