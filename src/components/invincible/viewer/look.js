// The model viewer’s look (components/worlds/looks.js): scanned, one HD figure on a
// holo-plinth under a photographed sky, through the HQ engine under the
// house look.
//
// The bloom keeps the numbers it was lit by, a threshold of 0.9, until the
// figures’ glowing parts are lifted over white with hot().

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: Object.freeze({ threshold: 0.9, strength: 0.5, radius: 0.5 }),
  why: {
    bloom: 'the viewer draws with the bloom it was lit by (0.9) until the figures’ glows are lifted over white with hot()',
  },
};
