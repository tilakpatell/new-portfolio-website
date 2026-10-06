// The props every world has about it, from Sketchfab: crates, barrels and
// the like, the galaxy's own (`node scripts/sketchfab-surface.mjs common`).
// Fields as in desert.js, and:
//   cluster  [kind, x, z, yaw, y] …: no model of its own, its members put
//            together (metres, in its own frame), turned and scaled with it
export const MODELS = {
  // an Imperial cargo crate, green-grey and strapped
  impcrate: { uid: 'c148bb00b7ba4c838fb2697aae9c009f', as: 'the Imperial cargo crates', metres: 1.7, along: 'max', yaw: 0, tris: 7000, tex: 512 },
  // a long grey cargo case, its ends cut off square
  longcrate: { uid: '33158565f8424faf989a886e972900ad', as: 'the long cargo cases', metres: 2, along: 'max', yaw: 0, tris: 3200, tex: 512 },
  // two fuel barrels, one banded red
  barrels: { uid: '10b2191029b44f81a6dfe08955a7ff5d', as: 'the barrels', metres: 1.2, along: 'y', yaw: 0, tris: 2500, tex: 512 },
  // a ridged supply cooler
  cooler: { uid: '3444fba1f62a45abb905fd71da1a4331', as: 'the supply coolers', metres: 0.9, along: 'y', yaw: 0, tris: 6700, tex: 512 },
  // a rusted metal tub, stacked
  rustycrate: { uid: '9fd17f87069b459d913352fef61ab2d3', as: 'the rusted crates', metres: 1.5, along: 'max', yaw: 0, tris: 2400, tex: 512 },
  // the crates and barrels anywhere cargo is left about
  crates: { as: 'cargo', metres: 3, cluster: [['impcrate', 0, 0, 0.1], ['longcrate', 1.9, 0.6, 1.5], ['barrels', -1.3, 0.9, 0.4], ['cooler', 0.6, -1.3, 0.3], ['rustycrate', -0.6, -1.6, 2.2]] },
};
