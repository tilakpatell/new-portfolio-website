// Aboard the Death Star (components/worlds/looks.js): scanned, the
// station’s kit and its people as physically based glTF, under the house
// look (Neutral through houseOn, ./scene/index.js).
//
// The bloom is over white on purpose: under the station’s lamps the walls
// and the glossy floor reach about 2 before the house tone-maps them, so a
// lower threshold glows the whole corridor into a grey veil; at 2.2 only the
// light strips and the grids glow (./module.js reads it here).

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: Object.freeze({ threshold: 2.2, strength: 0.6, radius: 0.4 }),
  why: {},
};
