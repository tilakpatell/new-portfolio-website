# Hand-off: the universe spread out, with hyperlanes

The design is [the spec](specs/2026-10-07-universe-scale-hyperlanes-design.md) and the work is split in [the plan](plans/2026-10-07-universe-scale-hyperlanes.md). This file says what has landed, what is left, and how to check it.

## Done

Lane A, the foundation (Tasks 1 to 8), in the PR from `claude/universe-scale-hyperlanes`:

- **The spread.** `scale.js`’s `SPREAD` is 4. The nearest fandom is 8,000 out, the main edge 36,000, and the Rick and Morty sector sits at z −48,000. The things placed beside the places moved with them: the supernova sites, the wars’ battle lines and the stars’ lighting reaches.
- **Far places as light.** Beyond 24,000 from the camera, `farPlaces.js` draws each place as a speck with a halo, in one draw call on every tier.
- **Regions.** `regions.js` makes eight neighbourhoods by complete linkage, plus the home system. `regionAt` gives the region a point is in, or null in the void.
- **The lane graph.** `hyperlanes.js` has 36 nodes and 47 lanes:
  - 28 local lanes at 1,200 a second;
  - 16 trunk lanes at 1,500;
  - 3 express lanes at 4,000.

  It also gives `carriageway`, `laneAt`, `routeTo`, `rampOf` and `nodeById`. The home system has four beacons round its edge: `beacon:home`, `-e`, `-n` and `-w`.
- **Riding.** `ride.js` has `enter`, `step` and `poseOf`. `lanePilot.js` has:
  - `laneFrame`, the per-frame hook;
  - `lanePlan` and `laneAim`, the autopilot on the `lanes` drive;
  - `rideLine`, for the HUD.
- **The drive.** In `nav.js` the `lanes` drive comes first and is the default, and `HYPER.recharge` is 30.
- **The chart and the HUD.** The chart draws the lanes by tier and plots the route along them. The HUD shows a plain lane line, `.universe-lane`.
- **Poses.** `poses.js` has `far-rim` and `lane-ride`, and `scripts/universe-check.mjs` takes both.

Several spec numbers changed when they met the data, and the spec says so in each case:

- Regions are made by complete linkage down to eight, not single linkage at 2,600. 2,600 is now only `regionAt`’s radius.
- Local lanes run at 1,200, not 600.
- The home system has four beacons, not one.
- Ramps sit level with their place.
- Free legs are costed as they are flown: a quarter of the pulse drive inside the home system, and the boost for the last leg in.
- `tripTime` on `lanes` is flown in Node, like the other drives.

## Left

1. **Lane B, the traffic and the look** (start from `origin/main`).
   - `laneFlow.js` reads `LANES`, `TIERS`, `R` and `carriageway`.
   - `laneStreaks.js` and `laneRibbons.js` sample `carriageway(lane, way)` with `lanes.js`’s `bezier` and `tangent`.
   - The ride’s look reads `state.ride`, which is `ride.js`’s ride: `{ lane, way, s, off, speed }`.
   - The lane line in `UniverseMap.jsx` is deliberately plain. Its data is `rideLine`’s `{ name, tier, next, eta }`, sent as the scene event `{ type: 'ride', on, line }`.
   - In `scene.js`, add your lines beside `rode()` and the `laneFrame` call in `fly`. Don’t move them.
2. **Lane C, spread out.**
   - The director’s `zoneOf` needs `regionAt` (from `regions.js`) and `laneAt` (from `hyperlanes.js`).
   - The ambush’s end node is `nodeById(ride.way === 'out' ? ride.lane.to : ride.lane.from)`.
   - An interdiction ends a ride by setting `state.ride = null`. The ship keeps the ride’s speed and `ship.js`’s drop brings it down.
   - The pose’s lane bit is `Boolean(state.ride)`.
   - Getting on a lane already clears the hunters and emits `{ type: 'escaped', why: 'lane' }`.
3. **`scripts/navmap-check.mjs`** jumps to “The Citadel” at (1755, −4660). That is where the Citadel was before it moved into the Rick and Morty sector, so the jump and charging steps fail on `main` as well. Fixing it means picking a main-sector wonder, such as Aurelia, by name and reading its position from `__universeDebug.wonders`.
4. **Trip times.** Lane trips come out about the same as super speed:

   | From the home edge to | Lanes | Super speed |
   |---|---|---|
   | Middle-earth | 22.5 s | 23.1 s |
   | The Star Wars gate | 19.6 s | 16.9 s |
   | Breaking Bad | 33.7 s | 27.1 s |

   Most of the cost is the slow flight out of the home system and the spool on getting on. If the lanes should be clearly quicker, the levers are `RAMP_S`, `SPOOL` and the home beacons’ distance.
5. **Settling into the tube.** A ship that comes in through a ring settles to the tube’s edge (`off` at `R`), not its middle. If that looks wrong once ribbons are drawn, the place to change it is `ride.js`’s settle.

## Checking it

- **Tests.** `npx vitest run src/components/universe` covers all of it. The tests to read first:
  - `lanePilot.test.js` flies whole trips in Node.
  - `hyperlanes.test.js` covers clearance, connection, the home ring, routes and the null route.
  - `ride.test.js` covers the long-dt end, dropping out, drifting and junctions.
- **In a browser.** Run `npx vite --port 5188 --strictPort --host 127.0.0.1`, then in the console:
  - `__universeDebug.travel('middleearth', 'lanes')` starts a lanes trip;
  - `__universe().lanes()` shows the legs and which one the ship is on;
  - `__universe().ride()` shows the ride.
- **Software rendering is slow.** Headless swiftshader runs about 50 times slower than real time, so a whole trip won’t fit in a check. Move the ship near a beacon first, through `__universeDebug.state.ship`.
- **Measuring.** `node scripts/universe-check.mjs --poses overview,far-rim,lane-ride --url http://127.0.0.1:5188`.
