// The Citadel’s look (components/worlds/looks.js): painted, as C-137 is: the
// show’s flat colours on a toon ramp with ink, the palette its rooms’ and
// concourse’s own (./rooms.js: the factory’s blue-grey walls, its steel, the
// dark ceiling, the neon). The house tone (Neutral, through houseOn, its
// exposure kept). Its bloom is under white: the Citadel is a city at night
// in space, and its signs, its lifts and its neon strips are the light.

export const LOOK = {
  art: 'painted',
  palette: ['#b8c4d6', '#3a4254', '#8a96aa', '#5b6f8f', '#d8dee8', '#6ff3ff', '#fff0cc', '#34296a'],
  tone: 'house',
  bloom: { strength: 0.5, radius: 0.42, threshold: 0.9 },
  why: {
    art: 'Rick’s and Mortytown’s people are the shared cast (../portal/meshyCast.js), dressed from the wardrobe',
    bloom: 'a city at night: the neon, the signs and the lifts glow, and its walls are dark enough to stay under the threshold',
  },
};
