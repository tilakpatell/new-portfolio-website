// A landing’s look (components/worlds/looks.js): scanned. The galaxy
// surface’s kit (galaxy/surface/kit.js) and its props, furnished
// (./furnish.js), and the people as their casts: Rick and Morty’s are the
// toon-ramped casts of their own worlds (rickmorty/portal/meshyCast.js,
// drawn by ../footScene.js), left so on purpose. A landing is drawn in the map’s
// own scene by the map’s renderer and through its post (../post.js), so its
// tone and its bloom are the map’s (../look.js), not a stage’s.

import { LOOK as MAP } from '../look';

export const LOOK = {
  art: 'scanned',
  tone: 'none',
  bloom: MAP.bloom,
  why: {
    art: 'Rick and Morty walk out as the toon-ramped casts of their own worlds (rickmorty/portal/meshyCast.js); everything else is scanned',
    tone: 'drawn through the universe map’s post, which tone-maps after the bloom (../look.js)',
  },
};
