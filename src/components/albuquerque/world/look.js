// Albuquerque's look (components/worlds/looks.js): scanned. The town's
// models and the scanned ground under the house look (houseOn), the house
// tone mapper; its bloom a hair over white, stronger at night (scene.js's
// BLOOM keeps the night's lift, the softening and the levels).

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: { threshold: 1.05, strength: 0.32, radius: 0.3 },
  why: {
    art: 'the Aztek’s driver wears what the visitor chose in C-137’s wardrobe, a toon-ramped cast (rickmorty/wardrobe): theirs to bring, so it stays',
  },
};
