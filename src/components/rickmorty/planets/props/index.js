// The Rick and Morty planets' builds, in the galaxy's prop style
// (galaxy/surface/props/index.js has what a builder gives): the rides'
// bodies (./rides.js), the towns and places (./towns.js), the hazards
// (./hazards.js) and the ground cover (./scatter.js). A planet's page lays
// these over the galaxy's (scene.js's ctx.props, ctx.scatter), so a planet
// keeps the galaxy's rocks and lamps too.

import { PROPS as rides, RIDE_RADIUS } from './rides';
import { PROPS as towns } from './towns';
import { PROPS as hazards } from './hazards';
import { SCATTER as scatter } from './scatter';

export { RIDE_RADIUS };
export const PROPS = { ...rides, ...towns, ...hazards };
export const SCATTER = { ...scatter };
