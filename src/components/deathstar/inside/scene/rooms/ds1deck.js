// The room builders for the first Death Star’s officers’ deck, by kind (see ./index.js for the
// contract): the conference room, the overbridge, superlaser fire control, the records archive and
// Vader’s meditation chamber. Each lives in ./deck/rooms.js and draws its furnishings from ./deck/props.js.
//
//   DS1_DECK: { conference, overbridge, firecontrol, archive, meditation }   (kit, room, layout, { renderer }) →
//     { group, lamps, update(t), dispose() }

import { buildArchive, buildConference, buildFirecontrol, buildMeditation, buildOverbridge } from './deck/rooms';

export const DS1_DECK = {
  conference: buildConference,
  overbridge: buildOverbridge,
  firecontrol: buildFirecontrol,
  archive: buildArchive,
  meditation: buildMeditation,
};
