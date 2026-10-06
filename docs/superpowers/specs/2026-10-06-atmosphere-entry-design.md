# Atmosphere entry: fly in to land

Date: 2026-10-06. Status: approved (the owner picked "the planet's landing" as where an entry comes out, and asked that the crash keep working).

## What and why

On the universe map, landing on a fandom planet was a key: `G` at a planet set the ship down on it (`footScene.js`), from wherever it was parked. The owner wants it flown instead: fly down into a planet's air and you're taken in, the way the galaxy's worlds come down (a re-entry glow, the sky coming up, through the clouds), and out onto the planet's own landing (`landings/`: the Shire by Bag End, the desert by the RV, the Smiths' street…), its crew stepping out as before.

Flying into a planet too fast is still a crash, and the crash still takes you into the world's page (`crash.js`, `pages/Universe.jsx`'s `crashInto`). The two are told apart by speed: come in at a normal speed and the air takes you down; come in boosting and you go through the air and hit.

## Decisions

- **The air is the halo you see.** Every planet already draws its air as a halo out to 1.2 of its radius (`planets.js`'s `HALO`). That is the air's top (`entry.js`'s `AIR`, which `planets.js` now reads), so what you see glowing round a planet is what you fly into. Stations (`kind: 'core'`), the Star Wars gate (`portal`) and anything `airless` have no air: nothing changes for them.
- **Fly in, at a normal speed, going down.** The entry starts the frame the ship is inside a landable planet's air, coming down through it (`ENTRY.sink`, map units a second toward the middle, at least), at no more than `ENTRY.fast` (12: over the cruise's 5.5, under the boost's 20). Skimming along the top isn't going in.
- **Too fast is a crash, as before.** Faster than `ENTRY.fast`, nothing takes the ship: it carries on through the air into the ground and `ship.js`'s `step` reports the crash as it always has (into it faster than `SHIP.crash`). The HUD says "Too fast to land: ease off the boost" while the ship is in the air too fast. The air is 0.2 of a radius deep (3.4 map units for a planet of 17), so even at `ENTRY.fast` a frame (50 ms at most) can't carry a ship from above the air into the ground: an entry always gets its frame.
- **No entry while something else is flying the ship.** Not on the autopilot (it parks at the planet's reach, far outside its air, but a trip past one mustn't land you), not mid-jump, mid-crash, mid-dive, on foot or with the page leaving.
- **Back out before going back in.** Taking off climbs out above the air (`liftFrame` rises to `AIR × R + ENTRY.clear`), and a planet just taken off from can't be entered again until the ship has been out past its air's top by `ENTRY.clear` (`rearm`), so a ship still climbing never drops straight back in.
- **G and the Land button fly you in.** They no longer set the ship down where it is. At a planet, they put the ship on a short autopilot (`state.auto = { id, descend: true }`) that points its nose down into the air at cruise speed (`descendInput`), and the entry takes it from there. Any stick or key input takes the ship back, as with any autopilot. On foot, G is what it was (a door, or back in the ship). The prompt reads "Fly down into Middle-earth's air to land (G)".
- **Where you come down: ahead of you.** The spot is along the ship's ground track from where it went in, further the faster it was going (`entrySpot`: the arc it would glide at its speed, held to `ENTRY.arc`), leaned toward the day side (at most `ENTRY.lean` radians), so you land roughly where you were heading and in daylight more often than not. Beside a friend already down there, it's beside them, as before (the path goes round the planet over the ground to get there).
- **One continuous flight, then the landing as it was.** The entry is part of `footScene`'s `land` phase (so everything that reads `phase === 'land'`, the engine, the plumes, the hidden crew, the network, already does the right thing), with `S.entry` set while it runs. It flies the ship down a path in the planet's own frame (a point on the ground, `n`, and a height, `h`): its ground point moving along the great circle from where it went in to the spot, decelerating to a stop over it, and its height falling fast at first and levelling off at the hover height over the spot; then a short settle straight down onto it. The path never goes under the ground (tested). When it's down, `S.entry` clears and the `land` phase's own last frame holds the ship parked, waiting on the crew to load, as before.
- **The show.** `reentry.js` draws it, in the planet's frame (in `footScene`'s `root`), from the timeline's numbers (`fxAt(t)`): the ship's bow shock (an additive sheath round its nose, white-hot to orange, flickering), streaks and sparks streaming off behind it, the camera shaking under it (`state.shake`, not with reduced motion), the sky coming up from black to the landing's own (`footScene`'s sky × `sky`), then through the cloud deck (soft sprites rushing past the camera and a white-out at the thickest), and out under the clouds over the landing. The place's name comes up as you break out of the clouds, not as you hit the air. A rumble (`sounds.js`'s `entrySound`) rises and falls with the burn.
- **Reduced motion and phones.** With reduced motion: no shake, no rushing clouds (they fade in and out where they are), the burn's flicker held still. On `small` (phones), half the sprites and sparks. The effects are made once with the foot scene and hidden, so the first entry doesn't compile shaders mid-flight.
- **The crash stays exactly as it was:** `crash.js`, `startCrash`, `crashInto`, the crater, the wash into the page. Only what's slow enough to land never reaches the ground to crash.

## How it fits together

```
scene.js fly()
  ├─ step(ship)                 ship.js: the flying, the crash events as ever
  ├─ crash?  → startCrash       (unchanged)
  ├─ entering(ship, LANDABLE, held)   entry.js (pure, tested)
  │     'enter' → startFoot({ id, entry: { at, vel } })
  │     'hot'   → the HUD note
  └─ rearm(held, ship)          entry.js
footScene.begin({ …, entry })
  ├─ spot = near ? beside(near) : entrySpot(…)  entry.js
  ├─ S.entry = { path: entryPath(…), t: 0 }     entry.js
  └─ update(): S.entry → stepEntry (the path, the ship's turn, its scale) and
               reentry.update(fxAt(t), …); done → land's last frame
```

## entry.js (pure, no three.js)

```js
export const AIR = 1.2;                    // the air's top, as a share of the radius
export const ENTRY = { fast, sink, clear, arc, lean, glide, settle, hover, … };
export const LANDABLE;                     // ship.js's PLANETS that have air and a landing
export const airTop = (p) => p.r * AIR;
export function velocityOf(ship)           // [x, y, z]: the nose × speed, plus its lift
export function entering(ship, planets, held) → { id, kind: 'enter' | 'hot', speed } | null
export function rearm(held, ship, planets) → held | null
export function entrySpot({ n, track, light, speed, R }) → { n, f }
export function entryPath({ nE, hE, nS, hH, rest, R, track }) → { T, at(t) → { n, h, p, settling, done } }
export function fxAt(t) → { burn, cloud, white, sky, shake, title }
export function descendInput(ship, planet) → { throttle, turn, climb, roll }
```

`descendInput` steers with `ship.js`'s `stickToward` (the autopilot's own stick, moved out of `autopilot` so both use it). From outside the air it aims just under the air's top; already in it, just under the ship (never back up to the top, where a ship lower down would level off and circle with nothing to take it in), no lower than it is while it's still too fast to land, and never under the ground. The hover over the spot is never higher than the ship came in at, nor lower than where it parks, so the path never climbs and always ends parked.

## Testing

- `entry.test.js`: a ship coming down through the air at cruise speed enters; the same at the boost doesn't (and `step` then reports a crash on hitting the ground); skimming level along the top doesn't; a station, the gate and a planet with no air are never entered; a held planet isn't entered until the ship's been out past its air; `entrySpot` is ahead along the track and leans no further than `ENTRY.lean` toward the light; `entryPath` starts where the ship went in, ends parked on the spot, never goes under the ground or back up, and stops over the spot; `fxAt` is 0 before and after, the clouds peak between the burn and the break-out; `descendInput` points the nose down into the air.
- In the browser (`scripts/entry-check.mjs`): fly into a planet's air at cruise and see the ship land and the crew step out; boost into another and see the crash take the page into its world; press G at a planet and see the ship fly itself in; take off and fly back in; screenshots of the burn, the clouds and the break-out.
