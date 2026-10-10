// The room builders for the second Death Star’s heights and depths, by kind (see ./index.js for the
// contract): the throne room, the reactor shaft, the gallery over it and the unfinished
// superstructure. Each lives in ./ds2/heights.js.
//
//   DS2_B: { throne, shaft, gallery, superstructure }   (kit, room, layout, { renderer }) →
//     { group, lamps, update(t), dispose() }

import { buildGallery, buildReactorShaft, buildSuperstructure, buildThrone } from './ds2/heights';

export const DS2_B = {
  throne: buildThrone,
  shaft: buildReactorShaft,
  gallery: buildGallery,
  superstructure: buildSuperstructure,
};
