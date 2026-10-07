// What you can ride on a world: how each one handles (walker.js's ride()),
// where you sit on it, how far back the camera keeps, and what it's
// called. The thing itself is placed like any other (placer.js: its model,
// or its build in props/*.js); a creature you ride (a tauntaun, a kaadu, a
// bantha) is one of figures.js's, walking under you.
//
// top, boost: m/s; accel, brake: m/s²; turn: rad/s at speed; hover: metres
// over the ground (0: on its feet); bank: radians, leaning into a turn;
// radius: its footprint; grip: 0…1, how much it goes where it's pointed
// (less: it drifts); seat: [x, y, z] where you sit, in its own frame; cam:
// [distance, height]; trail: it leaves a mark in the ground behind it;
// figure: a creature (figures.js's kind)

export const RIDES = {
  landspeeder: { name: 'the landspeeder', top: 24, boost: 33, accel: 9, brake: 20, turn: 1.35, hover: 0.8, bank: 0.28, radius: 1.5, grip: 0.84, seat: [-0.42, 0.42, -0.05], cam: [9, 3.2], hum: 'speeder' },
  speederbike: { name: 'the speeder bike', top: 34, boost: 52, accel: 17, brake: 28, turn: 1.75, hover: 1.0, bank: 0.55, radius: 0.75, grip: 0.92, seat: [0, 0.62, -0.4], cam: [6.5, 2.2], hum: 'bike' },
  // (the tauntaun's and the kaadu's seats sit on their catalogue models'
  // backs, which the ride swaps in once loaded: the tauntaun's back rises
  // from its tail to 1.8 m at the shoulders, the kaadu's saddle tops out at 2 m)
  tauntaun: { name: 'the tauntaun', figure: 'tauntaun', top: 8, boost: 13, accel: 6, brake: 12, turn: 2.1, hover: 0, bank: 0.08, radius: 0.8, grip: 1, seat: [0, 1.85, 0.1], cam: [6.5, 2.8] },
  kaadu: { name: 'the kaadu', figure: 'kaadu', top: 9, boost: 14, accel: 7, brake: 12, turn: 2.2, hover: 0, bank: 0.08, radius: 0.8, grip: 1, seat: [0, 2.0, 0], cam: [6.5, 2.6] },
  bantha: { name: 'the bantha', figure: 'bantha', top: 4.5, boost: 7, accel: 3, brake: 6, turn: 1.1, hover: 0, bank: 0, radius: 1.6, grip: 1, seat: [0, 2.7, -0.2], cam: [9, 3.6] },
};
