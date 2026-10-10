// The Rick and Morty planets' models, by kind: the book a planet's page lays
// over the galaxy's (scene.js's ctx.models), never written into it. Every
// file is one the site already has: the set pieces C-137's dimensions and
// the universe map's moons stand about (/models/c137/rm/), and the Meshy
// cast's people (/games/meshy/), rigged on the shared skeleton.
//
//   url     the file (catalog/index.js's modelUrlFor loads it as it is: no
//           light or ultra cut is guessed at)
//   tall | wide | long   the one size, in metres, it's brought to (by its
//           height, its widest across or its longest along the ground, as
//           the moons' landings size theirs: landings/models.js's sizeFor);
//           the files aren't in metres, as the galaxy's are
//   rigged  a person of the cast: ./cast.js's createRmFigures makes it on
//           the cast's own animator, so it walks on its feet and plays the
//           clip library's clips; its `tall` is the cast's height for it
//
// What isn't here and has no model is built in code (./props.js).

const SET = '/models/c137/rm';
const piece = (file, size) => ({ url: `${SET}/${file}.glb`, ...size });
// (a person of the cast: as tall as the cast stands them, portal/meshyCast.js's MESHY)
const person = (kind, tall) => ({ url: `/games/meshy/${kind}.glb`, tall, rigged: true });

export const RM_MODELS = {
  // Gazorpazorp: the women's gate (as long as the landing's had it on the
  // surface: the city wall runs off its two ends) and the men's Gazorpazorpfield
  gazorpgate: piece('gazorpgate', { long: 16 }),
  gazorpazorpfield: piece('gazorpazorpfield', { tall: 1.5 }),
  // Planet Squanch: Squanchy's house, his party's guests, the suckulents
  'squanchy-house': piece('squanchy-house', { tall: 9 }),
  'magdalian-a': piece('magdalian-a', { tall: 1.55 }),
  'magdalian-b': piece('magdalian-b', { tall: 1.55 }),
  'magdalian-c': piece('magdalian-c', { tall: 1.6 }),
  suckulent: piece('suckulent', { tall: 2.2 }),
  'suckulent-small': piece('sm/suckulent', { tall: 1.6 }),
  // Bird World: Birdperson's nest on the rocks, the perches
  'birdperson-house': piece('birdperson-house', { tall: 14 }),
  birdperch: piece('birdperch', { tall: 6 }),
  // Gear World: its people, the gear monument, the cogs
  'gearperson-a': piece('gearperson-a', { tall: 1.8 }),
  'gearperson-b': piece('gearperson-b', { tall: 1.8 }),
  gearbig: piece('gearbig', { tall: 12 }),
  gearcog: piece('gearcog', { wide: 5 }),
  'gearcog-small': piece('sm/gearcog', { wide: 1.8 }),
  // Pluto's miners
  'plutonian-a': piece('plutonian-a', { tall: 1.35 }),
  'plutonian-b': piece('plutonian-b', { tall: 1.35 }),
  // Snake Planet: the rocket, its astronaut, the snakes
  snakerocket: piece('snakerocket', { tall: 12 }),
  snakeastronaut: piece('snakeastronaut', { tall: 1.2 }),
  'snake-a': piece('snake-a', { tall: 0.9 }),
  'snake-b': piece('snake-b', { tall: 0.9 }),
  // Cronenberg World: the Smiths' house as they kept it, a wrecked car
  cronhouse: piece('cronhouse', { tall: 8.6 }),
  croncar: piece('croncar', { tall: 1.6 }),
  // the Purge Planet's village: a cottage, the barn, the bell, the well
  purgecottage: piece('purgecottage', { tall: 6 }),
  purgebarn: piece('purgebarn', { tall: 9.5 }),
  purgesiren: piece('purgesiren', { tall: 7 }),
  purgewell: piece('purgewell', { tall: 2.8 }),

  // the people, rigged
  gazorpian: person('gazorpian', 2.8),
  marsha: person('marsha', 2.3),
  mortyjr: person('mortyjr', 2.0),
  squanchy: person('squanchy', 1.15),
  birdperson: person('birdperson', 2.0),
  phoenixperson: person('phoenixperson', 2.05),
  tammy: person('tammy', 1.62),
  unity: person('unity', 1.75),
  gromflomite: person('gromflomite', 2.3),
  gearhead: person('gearhead', 1.8),
  flippynips: person('flippynips', 1.5),
  scroopy: person('scroopy', 1.4),
  arthricia: person('arthricia', 1.6),
  // (the Cronenbergs came without a skeleton: they lurch in their step, a model's sway)
  cronenberg: { url: '/games/meshy/cronenberg.glb', tall: 1.45 },
};
