// The wardrobe’s look (components/worlds/looks.js): painted. Morty or Rick
// on a turntable (./preview.js) in the cast’s toon look under a studio’s
// light, in the clothes picked (./looks.js and ./gear.js, whose colours are
// the palette). A small renderer of its own with no tone mapper and no
// bloom: the clothes are seen as their colours are written.

export const LOOK = {
  art: 'painted',
  palette: ['#f7b500', '#f3d84b', '#f0b49a', '#eef3f4', '#e98a3a', '#e2468f', '#7dff5c', '#b8323b'],
  tone: 'none',
  bloom: false,
  why: {
    tone: 'a turntable over the page, the clothes’ colours authored as final',
  },
};
