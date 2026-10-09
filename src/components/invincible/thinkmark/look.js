// Think, Mark!’s look (components/worlds/looks.js): scanned, the city
// under a photographed sky and the cast as HD figures, through the HQ
// engine under the house look.
//
// The bloom keeps the numbers the scene was lit by, a threshold of 0.9, so
// its glows stay as they were until they are lifted over white with hot().

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: Object.freeze({ threshold: 0.9, strength: 0.55, radius: 0.45 }),
  why: {
    bloom: 'the scene draws with the bloom it was lit by (0.9) until its glows are lifted over white with hot()',
  },
};
