// The universe map's scale against the ship, in one place.
//
// LENGTH: how long a ship is drawn, in map units (shipModels.js builds every
// hull to it; the HUD's ship-lengths are counted in it).
//
// HOME_SCALE: how much bigger the home system's stations are drawn against
// the ship than they were on 2026-10-05, when Home was 32 ship lengths
// across and read as a toy beside a parked Falcon. At 3 it is 97 across.
// The rest of the home system (the sun, the stations' ring, the belt, its
// edge) grows by the cube root, HOME_SPREAD: a station then takes
// HOME_SCALE^(2/3) more of the view from any spot in the system, the sun
// keeps its place against the ring (so its corona and light fall on the
// stations as before), and the system doesn't stretch so far that the
// stations shrink to specks across it.
//
// The range that works is about 1 to 3.5: a station must stay smaller than
// the smallest world, and the sun under the ship's ceiling (scale.test.js
// checks both). Rerun ship.test.js and nav.test.js on any change: the
// autopilot's hops, and the super-speed trip home, fly through this system.
//
// WORLD_SCALE: the same for the fandoms' planets, so the sizes stay in
// order with the stations grown: a ship, a station (84 to 97 ship lengths),
// a world (about four times a station across: 360 to 450 ship lengths), a
// deep-space star bigger again. Only the planets' radius grows: where they
// sit (layout.js), the Star Wars gate (its own size), the people on foot
// (foot.js's METRE) and the ship stay as they were; on foot the ground is
// the planet itself, so it just curves away more gently. A world must stay
// smaller than every deep-space star (scale.test.js).
//
// (No imports: everything sized by it imports this, never the other way.
// universes.js writes HOME_SCALE and WORLD_SCALE out as numbers instead, so
// the prerender can load it in Node; scale.test.js keeps them the same.)

export const LENGTH = 0.26;
export const HOME_SCALE = 3;
export const HOME_SPREAD = Math.cbrt(HOME_SCALE);
export const WORLD_SCALE = 3;
