# Handoff: the universe nav map

A holotable-style map for the universe (like the galaxy's `galaxy/HoloMap.jsx`): see everywhere at once, pick a place, pick how to get there, go. Two PRs so far: #109 (physics and numbers) and the one this note came in with (the map itself and the scene wiring). Both are on `main`.

## What's there

- **Three drives** (`universe/nav.js`, kept in `localStorage` as `tp-universe-drive`, default super speed). Picking a place anywhere on the page goes by the drive picked: the nav map, a name on the 3D map, the panel's arrows, a wonder clicked in deep space.
  - **Hyperspeed**: a jump. The page dispatches `tp:hyperspace` (App's full-screen jump), and the scene moves the ship to the place's parking spot at the overlay's flash (`HYPER.flash`, 1.2 s, wall clock). Hunters are left behind. It can't jump while interdicted, and recharges for 10 s; meanwhile a hyperspeed trip goes at super speed and says why. `J` jumps to the place picked.
  - **Super speed**: the autopilot with overdrive (`ship.js`: `input.overdrive`, the autopilot's `od`, `OVERDRIVE = 3`, `overdriveAt()`). It's 3× the pulse drive in the open and 2× near places, with brakes and push scaled by the square. Worlds from home take 8–13 s instead of 17–27 s. It doesn't kick in for hops between stations. Take the stick and it drops out within ~2 s.
  - **Cruise**: the autopilot as it always was.
- **The nav map** (`universe/NavMap.jsx`, `navmap.css`) opens with `M`, the compass button bottom-left (beside settings and hangar), or "Open the nav map" / "Nav map" in the panel.
  - The chart has two views: the universe on a square-root scale, and the home system to scale. It shows every station, world and wonder, your ship and heading, other pilots online, and the course, drawn by drive: a solid line for a jump, dashes for super speed, dots for cruise.
  - Filter chips and an accent-insensitive search; the list shows each place's distance.
  - Picking a place shows its trip time by each drive (run on the real physics: `tripTime()`), a go button, and "Skip the trip: straight in" for places with a page.
  - It also shows where you are, your speed, and the hyperdrive's charge.
  - "3D view" goes to the old pull-back whole-map view (previously `M`).
  - Without a ship, the camera goes to stations and worlds; wonders say to pick a ship.
- **Scene API** (`scene.js`, exposed through `UniverseMap`'s handle):
  - Methods: `travel(id, drive)`, `where()`.
  - Events: `map` (M), `jump`, `jumped`, `hyper` (couldn't jump: why).
  - Prop `charting`: the director holds off new events while the map's open.
- **Crews**: `events.hyperspeed` and `events.overdrive` lines for all four crews. They're deliberately not called `jump`: the galaxy overlays its own `events.jump` (see `galaxy/lines.test.js`).

## Verified

- `nav.test.js` (16 tests) covers:
  - Super speed: every world and wonder, world to world all the way round, no hits, under 0.65× the cruise time.
  - Station hops unchanged, the drop out of super speed, interdiction, hyperdrive state, search, the chart, the formatters.
- All 351 universe and galaxy tests pass; ESLint is clean; `vite build` succeeds.
- In headless Chrome (`scripts/navmap-check.mjs`, before the last round of fixes below):
  - The map opens from the button and `M`.
  - Times show 2.5 s / 10 s / 21 s to Avengers HQ.
  - The super speed trip reaches about 1,060 u/s.
  - A jump to the Citadel lands parked there with "charging, 9 s".
  - Escape closes the map; the home-system view renders.

## Steps left

1. **Done (desktop), 2026-10-05:** `node scripts/navmap-check.mjs desktop` passed every check: labels clear, list unsquashed, button wording, the overlay, the ship out on the first frame past the flash, the card cleared, the charging status, Escape. The only failures were the frames being too slow to hold the charge (the script now forces it). Originally: **re-run the browser check** on the last fixes, which haven't been seen in a browser: `npx vite --port 5173` in one shell, `OUT=/tmp/shots node scripts/navmap-check.mjs` in another. Headless Chrome draws in software here at about 5 fps, so allow minutes. Clicks go through `el.click()` in `page.evaluate`, since Playwright's own clicks stall on the slow frames. The fixes to check:
   - The jump is now timed on the wall clock (`wall()` in `scene.js`). Confirm the ship moves under the overlay's flash, and the `.hyperspace-canvas` overlay shows.
   - Going to a wonder now clears the page's selection, so the panel doesn't keep the last world's card. Deselecting no longer cancels a trip out to a wonder (`select()`: `isPlace(state.auto?.id)`).
   - Labels: The Maw and Glacia now sit under their dots (`UNDER` in `NavMap.jsx`), so they no longer overlap The Caribbean and the galaxy gate.
   - The side panel no longer squashes the place list under the key hints (`.navmap-side > * { flex-shrink: 0 }`).
   - The go button now reads "Jump to …", "Super speed to …" or "Cruise to …".
2. **Phone layout** (390×844) hasn't been seen: the screenshot timed out in software GL. Check:
   - The chart over the side panel, and the panel's scroll.
   - Wonder names hidden except when picked.
   - The compass button at `left: 112px` beside settings and hangar (`universe.css`, the `max-width: 767px` block), and that it doesn't collide with the Multiplayer pill.
3. **README**: the keys tables mention `M` and `J` (done in this PR). A short paragraph on the drives under "The universe" would help.
4. **Nice to have, not started**:
   - A super speed look in 3D: stronger streaks or FOV past the pulse drive. `STREAK_SPEED` caps the streaks at the boost's speed now.
   - A "hyperdrive ready" chime.
   - Showing hunters on the chart.
   - Keyboard 1/2/3 to pick a drive inside the map.
   - Remembering the chart view between opens.
5. **Galaxy**: `/galaxy` has its own HoloMap and jumps. The overdrive is generic (`step()`/`autopilot()` take any `space`), so super speed could be offered there too. Leave it to whoever owns the galaxy branch (`claude/inspiring-rubin-rjq2tf` was active in `galaxy/` on 2026-10-05).

## Files

`src/components/universe/`:
- New: `nav.js`, `nav.test.js`, `NavMap.jsx`, `navmap.css`.
- Changed: `ship.js` (overdrive), `scene.js` (travel, jump, where, keys), `UniverseMap.jsx` (button, props, handle), `UniversePanel.jsx` (nav map buttons, key hints), `crews.js` and `crews.test.js` (lines), `universe.css` (the button).

Also changed: `src/pages/Universe.jsx` (state, events, NavMap), `scripts/navmap-check.mjs`, `README.md`.
