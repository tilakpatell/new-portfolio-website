// Dead Man’s Tide’s look (components/worlds/looks.js): scanned, the ships
// and creatures as glTF with their own textures under the house look
// (lib/stage3d at its exposure of 0.92, Neutral through houseOn). The sea is
// a shader of its own (./sea.js) that is lit by the same sun and tone.
//
// The bloom is the house’s threshold of 1 at a softer strength (0.24) and a
// wider radius (0.5): the lanterns, the cannon flashes and the Dutchman’s
// glow, and never the white of a sail or the foam.

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: Object.freeze({ threshold: 1, strength: 0.24, radius: 0.5 }),
  why: {},
};
