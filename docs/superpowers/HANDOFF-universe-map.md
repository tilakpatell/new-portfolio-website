# Handoff: the universe map

Worktree `.claude/worktrees/universe`, branch `claude/universe`. Read the spec and the plan first:

- Spec: `docs/superpowers/specs/2026-10-04-universe-map-design.md`
- Plan: `docs/superpowers/plans/2026-10-04-universe-map.md`

The user wants terse updates and no checkpoint questions. Use your own recommended defaults and keep building. Still ask before pushing, opening a PR, deleting anything, or spending Meshy credits.

## Done (committed; lint, 190 tests and the build all pass)

- **Plan Task 1:** `universes.js`, `layout.js` and `flight.js` (pure, tested). `worlds.js` derives `WORLDS` from `UNIVERSES`.
- **Tasks 2–3:** the cards moved unchanged into `interests/cards.jsx` (`CARDS[id]`). Home's Off the clock now shows `MiniMap` (as links) and an **Open the universe** button.
- **Task 4 (mostly):**
  - `App.jsx` has the `/universe/:id?` route.
  - The page key stays `/universe` for every `/universe/*` path, so selecting a planet doesn't remount the page. The same goes for `ErrorBoundary`.
  - No footer on the page, and no scroll-to-top when only the id changes.
  - `pages/Universe.jsx` handles selection through `navigate(…, { replace: true })`, Escape scoped to the page (skipped when the event was handled or a modal is open), and the Enter plan with its timer cleared on unmount.
  - `UniversePanel.jsx` has the card, Enter, and previous / next.
  - Page CSS is in `universe.css`.
- **Stub:** `UniverseMap.jsx` only renders the SVG `MiniMap` for now. `handle.current.live` stays false, so Enter navigates immediately.
- **Fix:** `pages/Music.jsx` imports `Tabla.jsx` by its full name. On macOS, `Tabla` resolved to `tabla.js` and the build failed; this came from threejs-core.
- **Meshy models:** five built at about 8k triangles, optimised by `scripts/build-universe.py`. They're in `public/models/universe/{gaming,marvel,breakingbad,transformers,music}.glb`, 112–163 KB each, meshopt with 256 px WebP textures. Load them the way `src/components/office/kit.js` does: `GLTFLoader().setMeshoptDecoder(MeshoptDecoder)`. The task ids and prompts are in the script header. 150 of the 743 credits were spent.

## Next

1. **Task 5, the 3D map:**
   - Write `planets.js` and `scene.js`, a `create(canvas, ctx)` module for `lib/three/useScene` modelled on `travel/globe3d/scene.js`.
   - Make `UniverseMap.jsx` call `useScene(() => import('./scene'), { id: 'universe', props })` and render the nine label buttons once.
   - The scene writes each label's `style.transform` and `data-behind` through refs passed in props. No React state per frame.
   - Show `<MiniMap selected onSelect />` only when `!meant`. While loading, show the `data-gl="loading"` state, not the SVG.
   - Set `handle.current = { live: on, dive(id) }`.
   - Camera: `flight.js` (`cover`, `overviewPose`, `focusPose`, `startFlight`, `poseAt`, `worldPos`). Lens shift is `camera.setViewOffset(w, h, -sx, -sy, w, h)`. Pass `cover` the panel width (desktop) or the sheet height (phone), plus `top: nav height`.
   - The planet looks are in the plan's Task 5 table. Five signature objects are the GLBs above, orbiting their planets. The Death Star, the Ring, the mug, the crystals, the Stones and the travel arcs stay procedural.
   - Budget: under 120 draw calls, under 300k triangles, under 24 MB of textures.
2. **Task 6, the ways in:**
   - `WorldSwitcher` becomes two links: **Universe map** (`byPath`) and **Next universe** (`nextWorld`).
   - Travel gets a quiet Universe map link.
   - Add a ⌘K entry (`id: 'w-uni'`) and Guide tips for `/universe`.
3. **Task 7, verification:**
   - Test in headless Chromium with Metal. The app's browser pane runs at 1 fps when hidden; see memory `hq-3d-browser-testing`.
   - Check desktop and phone, 3D on and off, every universe, keyboard only.
   - Report `renderer.info` numbers.

## Gotchas

- `node_modules` in this worktree is a symlink to `../threejs-core/node_modules`, which has the same package.json. It's gitignored.
- Another session's dev server runs in the main folder. Start this worktree's own server for browser checks (`.claude/launch.json`).
- `vitest --root /` hangs. Run tests from the worktree root.
