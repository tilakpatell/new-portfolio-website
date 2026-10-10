// The planets' four rides, on walker.js's ride() with the galaxy's numbers
// to start from (galaxy/surface/rides.js has what each field means). A
// planet's page lays them over the galaxy's (scene.js's ctx.rides); each is
// placed as its body built in ./props/rides.js, the same name.
//
// A hover ride rides on the water (walker.js holds it over the surface), so
// one left in Gear World's oil or a crater's lake is never lost. The glider
// is the airspeeder's flyer: Space climbs it to 14 m over the ground, let go
// and it sinks at half that (the spec's open assumption: if it feels like a
// lift, Bird World's phase adds a glide).

import { RIDES } from '../../galaxy/surface/rides';
import { RIDE_RADIUS } from './props/rides';

const { speederbike, landspeeder, airspeeder } = RIDES;

export const RM_RIDES = {
  // Gazorpazorp's rock sled: the landspeeder's handling, lower and a little slower
  rocksled: { name: 'the rock sled', top: 22, boost: 30, accel: 9, brake: 18, turn: 1.3, hover: 0.6, bank: 0.25, radius: RIDE_RADIUS.rocksled, grip: 0.8, seat: [-0.3, 0.5, 0], cam: [9, 3.2], hum: 'speeder' },
  // Gear World's bike: the speeder bike's, scoring the plating behind it
  gearbike: { ...speederbike, name: 'the gear bike', radius: RIDE_RADIUS.gearbike, trail: true },
  // Arthricia's skiff: the landspeeder's, slower, the bench further back
  purgeskiff: { ...landspeeder, name: 'Arthricia’s skiff', top: 18, boost: 25, radius: RIDE_RADIUS.purgeskiff, seat: [-0.4, 0.5, -0.2] },
  // Bird World's glider: the airspeeder's flyer, slower and higher (its boost cut with its top)
  birdglider: { ...airspeeder, name: 'the glider', top: 26, boost: 38, radius: RIDE_RADIUS.birdglider, fly: { alt: 14, climb: 7, floor: 0 } },
};
