// The flight's look (components/worlds/looks.js): painted. Flat colours on
// the house look, the ground coloured by height and slope from the planet's
// palette (./ground.js), the ship and the clutter code-built from this strip
// (the ice world's: snow, snow in shade, rock, ice, deep shadow, the sun's gold, the
// engines' red, the night). The house tone (Neutral, through houseOn); no
// bloom, as nothing here burns brighter than the snow.

export const LOOK = {
  art: 'painted',
  palette: ['#e9f0f7', '#c4d2e2', '#6b7a8c', '#9fb7d1', '#2b3d55', '#ffd37a', '#ff6b4a', '#1a1f2b'],
  tone: 'house',
  bloom: false,
};
