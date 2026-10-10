// What you can ride on a world: how each one handles (walker.js's ride()),
// where you sit on it, how far back the camera keeps, and what it's
// called. The thing itself is placed like any other (placer.js: its model,
// or its build in props/*.js); a creature you ride (a tauntaun, a kaadu, a
// bantha) is one of figures.js's, walking under you.
//
// top, boost: m/s; accel, brake: m/s²; turn: rad/s at speed; hover: metres
// over the ground (0: on its feet); bank: radians, leaning into a turn;
// fly: walker.js's { alt, climb, floor } for one that flies;
// radius: its footprint; grip: 0…1, how much it goes where it's pointed
// (less: it drifts); seat: [x, y, z] where you sit, in its own frame; cam:
// [distance, height]; trail: it leaves a mark in the ground behind it;
// figure: a creature (figures.js's kind)

export const RIDES = {
  // Anakin's borrowed airspeeder: it flies (walker.js's fly: Space climbs
  // it, up to 6 m over whatever's under it, and never under Coruscant's
  // platform level), fast and loose in the turns
  airspeeder: { name: 'the airspeeder', top: 40, boost: 58, accel: 14, brake: 22, turn: 1.4, hover: 0, fly: { alt: 6, climb: 8, floor: 0 }, bank: 0.5, radius: 2, grip: 0.8, seat: [-0.5, 0.5, 0.2], cam: [10, 3.6], hum: 'speeder' },
  // (the landspeeder and the speeder bike are the game's X-34 and 74-Z
  // (catalog/bf2017-vehicles.js): each seat measured off its model, the
  // X-34's driver's cushion on the left of its cockpit and the 74-Z's saddle
  // behind its grips; rides.seat.test.js holds them to the files)
  landspeeder: { name: 'the landspeeder', top: 24, boost: 33, accel: 9, brake: 20, turn: 1.35, hover: 0.8, bank: 0.28, radius: 1.5, grip: 0.84, seat: [-0.3, 0.55, -0.85], cam: [9, 3.2], hum: 'speeder' },
  speederbike: { name: 'the speeder bike', top: 34, boost: 52, accel: 17, brake: 28, turn: 1.75, hover: 1.0, bank: 0.55, radius: 0.75, grip: 0.92, seat: [0, 0.77, -0.55], cam: [6.5, 2.2], hum: 'bike' },
  // (the tauntaun's and the kaadu's seats sit on their catalogue models'
  // backs, which the ride swaps in once loaded: the tauntaun's back rises
  // from its tail to 1.8 m at the shoulders, the kaadu's saddle tops out at 2 m)
  tauntaun: { name: 'the tauntaun', figure: 'tauntaun', top: 8, boost: 13, accel: 6, brake: 12, turn: 2.1, hover: 0, bank: 0.08, radius: 0.8, grip: 1, seat: [0, 1.85, 0.1], cam: [6.5, 2.8] },
  kaadu: { name: 'the kaadu', figure: 'kaadu', top: 9, boost: 14, accel: 7, brake: 12, turn: 2.2, hover: 0, bank: 0.08, radius: 0.8, grip: 1, seat: [0, 2.0, 0], cam: [6.5, 2.6] },
  bantha: { name: 'the bantha', figure: 'bantha', top: 4.5, boost: 7, accel: 3, brake: 6, turn: 1.1, hover: 0, bank: 0, radius: 1.6, grip: 1, seat: [0, 2.6, 0.65], cam: [9, 3.6] },
};

// The field widens with the ride's speed, so going fast reads as fast: the
// share of FAST it's doing, squared (a bantha's plod barely moves it, a
// speeder bike's boost opens it all the way), up to RIDE_FOV degrees over
// the base. Held at the base under reduced motion, as every fov change is.
export const RIDE_FOV = 10;
export const FAST = 50; // m/s: the speeder bike's boost and the airspeeder's

export function rideFov(base, speed, spec, { calm = false } = {}) {
  if (calm || !spec) return base;
  const k = Math.min(1, Math.abs(speed) / FAST);
  return base + RIDE_FOV * k * k;
}
