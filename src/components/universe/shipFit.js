// How a model is fitted to the size it flies at. A ship's size is its
// length, nose to tail (galaxy/battles.js: a ship's real length at 53 metres
// to a map unit), so a ship is fitted along its nose, and its wings and fins
// stand out past that as far as they do: an ARC-170 is half as wide again as
// it is long, a TIE taller than it is long. Fitted by its biggest side, as
// every model was till now, a ship wider or taller than its length came out
// short of it (the ARC-170 at 0.62 of its length, the YT-2400 at 0.63, the
// TIE at 0.87).
//
// A few are still fitted by their biggest side. The stations, because they
// are round or a ring, and world.js's solids and landing are shares of that
// side. Slave I and the B-wing, because each flies upright: the length every
// reference gives them is the long side that stands up in flight, so fitted
// along the nose they would come out twice their size. And the universe's
// travellers who are not ships, whose size is their height or their span (a
// Meeseeks, Birdperson, a Gromflomite on the wing, the balloon).
//
// fitScale(kind, box) → the scale that makes a model of that box (nose
// along +z) 1 long, or 1 at its biggest side for the kinds in BY_SPAN.

export const BY_SPAN = new Set([
  // the stations
  'deathstar',
  'deathstar2',
  'cloudcity',
  'gate',
  'coreship',
  // the ships that fly upright
  'slave1',
  'bwing',
  // the travellers
  'meeseeks',
  'birdperson',
  'phoenixperson',
  'gromflomite',
  'balloon',
]);

export const fitScale = (kind, { x, y, z }) => 1 / Math.max(BY_SPAN.has(kind) ? Math.max(x, y, z) : z, 1e-6);
