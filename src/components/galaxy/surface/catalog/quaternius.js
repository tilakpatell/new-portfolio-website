// Ground cover and far trees from Quaternius's Stylized Nature MegaKit
// (CC0 1.0: public/cc0/README.md lists them, no credit owed): the forest
// worlds' ferns, clover, mushrooms, pebbles and grass, and giant pines and
// dead trees for the far ring, where a low-poly shape reads as well as a
// scan. Never near trees, buildings or people (the kit is toy-like; the
// galaxy is photo-real). Brought in by scripts/quaternius-import.mjs, one
// file a kind (variety from a scatter's scale and seed); the foliage's
// normals made at import (--foliage), so the placer draws them as they are.
// Fields as in the other groups, and:
//   made    'quaternius'
export const MODELS = {
  qfern: { made: 'quaternius', as: 'the ferns', metres: 1.6, along: 'max', tris: 4000, tex: 512 },
  qclover: { made: 'quaternius', as: 'the clover', metres: 0.25, tris: 4000, tex: 512 },
  qmushroom: { made: 'quaternius', as: 'the mushrooms', metres: 0.25, tris: 4000, tex: 512 },
  qpebble: { made: 'quaternius', as: 'the pebbles', metres: 0.3, along: 'max', tris: 4000, tex: 512 },
  qgrass: { made: 'quaternius', as: 'the tall grass', metres: 0.6, tris: 4000, tex: 512 },
  qpine: { made: 'quaternius', as: 'the far pines', metres: 42, tris: 1500, tex: 512, lod: true },
  qdeadtree: { made: 'quaternius', as: 'the dead trees', metres: 14, tris: 4000, tex: 512 },
};
