// The Shipyard showroom’s look (components/worlds/looks.js): the map’s own
// ships (buildShip and the iconic ships’ models, as the map flies them) on a
// turntable on a canvas of its own, under a dock’s light: a warm key, a blue
// fill and a rim. That canvas maps no tone and has no post, so no bloom: its
// lights were set for colours as drawn, and a paint swatch in the yard is
// the colour on the hull.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: false,
  why: {
    art: 'the universe map’s own ships, built as the map builds them (../look.js)',
    tone: 'a canvas of its own with no post: its dock light was set for colours as drawn, so the yard’s paint reads as it will on the hull',
  },
};
