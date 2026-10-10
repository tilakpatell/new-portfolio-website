// The galaxy map’s look (components/worlds/looks.js): its own. The planets,
// the stars, most of the ships and the war’s fleets are drawn in code, with
// a few models (the big ships, the Falcon, Slave I) lit under the house
// look’s shade (houseOn with its tone mapper off, ./scene.js).
//
// It shares the universe map’s lens (universe/post.js, lane 2C’s): that
// pass tone-maps the picture itself (Khronos’ neutral shoulder without its
// toe, so the faint Milky Way stays as drawn) and grades it. So the
// renderer maps no tone.
//
// The bloom is its own, a halo and not a veil. With the map’s (a threshold
// of 1.7, strength 0.8, radius 0.55) a battle’s dogfight had the darkest
// half of the frame lifted to a mean luma of 0.09–0.15 from black: three’s
// pass glows a texel’s whole light once it’s over the line, and a radius
// of 0.55 weighs the widest, 1/32-scale mip as much as the sharpest, so a
// few hundred bolts fogged the whole frame green. Here only the light over
// the line glows (a soft knee of 0.5 round 1.4), the wide mips fall away
// (falloff), a flare scales it by 1.6 at the most, and its first level is
// up to 960 across on a large screen, so a thin bolt’s glow holds still.
// Measured at a forced Endor battle (scripts/galaxy-bloom-check.mjs): the
// darkest half of a dogfight 0.022, of a panorama 0.0004 (from 0.033–0.044).

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: Object.freeze({ threshold: 1.4, knee: 0.5, strength: 0.5, radius: 0, falloff: Object.freeze([1, 0.6, 0.3, 0.12, 0.04]), flareMax: 1.6, cap: 960 }),
  why: {
    art: 'drawn in code: the planets, the stars, the lanes, most ships and the fleets; the few models take the house’s shade',
    tone: 'the universe map’s lens (universe/post.js) tone-maps and grades the picture in its last pass, so the renderer maps none',
    bloom: 'a halo, not a veil: only the light over 1.4 glows (a soft knee), the wide mips fall away, so a battle’s hundreds of bolts don’t fog the frame; the sun, engines and shots glow',
  },
};
