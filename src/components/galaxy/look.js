// The galaxy map’s look (components/worlds/looks.js): its own. The planets,
// the stars, most of the ships and the war’s fleets are drawn in code, with
// a few models (the big ships, the Falcon, Slave I) lit under the house
// look’s shade (houseOn with its tone mapper off, ./scene.js).
//
// It shares the universe map’s lens (universe/post.js, lane 2C’s): that
// pass tone-maps the picture itself (Khronos’ neutral shoulder without its
// toe, so the faint Milky Way stays as drawn) and grades it, and its bloom
// (a threshold of 1.7, over white) is its own. So the renderer maps no
// tone, and this look owns no bloom.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'drawn in code: the planets, the stars, the lanes, most ships and the fleets; the few models take the house’s shade',
    tone: 'the universe map’s lens (universe/post.js) tone-maps and grades the picture in its last pass, so the renderer maps none',
    bloom: 'the lens’s own bloom (universe/post.js, a threshold of 1.7): only the sun, engines and shots glow',
  },
};
