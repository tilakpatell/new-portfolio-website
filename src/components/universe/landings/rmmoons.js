// Down on the Rick and Morty sector's worlds (universes.js's MOONS): the
// things landings.js names for them that aren't models, one file between
// them. The portal is the C-137 landing's (./rickmorty.js), open on the
// ground as the show draws it, and G there takes you into the place itself,
// on foot as Morty (the moon's own world, /c-137/<id>, not C-137); the rest
// is ground cover: rocks, the men's bones on Gazorpazorp, Squanch's cat
// trees, Bird World's feathers and Gear World's bolts. The places' own set
// pieces (the women's gate, the suckulents, the perches, the cogs and the
// gear monument, the houses) and the people are models (landings.js).

import * as THREE from 'three';
import { part, rockGeometry } from '../../galaxy/surface/kit';
import { PROPS as RM } from './rickmorty';
import { SCATTER as PLANET_SCATTER } from '../../rickmorty/planets/props/scatter';

export const PROPS = {
  portal: RM.portal,

  // a rock of the desert (or Bird World's grey)
  rock(k, { seed = 1, size = 2, color = '#8a3a2a' } = {}) {
    const g = rockGeometry(seed, { sharp: 0.4, flat: 0.6 }).scale(size, size * 0.8, size);
    return { object: k.build([part(g, { color, to: 'stone' })], { name: 'rock' }), solids: [{ circle: [0, 0, size * 0.9] }] };
  },
};

export const SCATTER = {
  rock(k, { seed = 2, color = '#8a3a2a' } = {}) {
    return { parts: [{ geometry: k.geometry([part(rockGeometry(seed, { sharp: 0.4 }).scale(0.8, 0.6, 0.8), { color, to: 'stone' })]), material: k.mats.stone }], radius: 0.8 };
  },
  // (the moons share the planets’ ground cover: one build of each)
  bone: PLANET_SCATTER.bone,
  cattree: PLANET_SCATTER.cattree,
  feather: PLANET_SCATTER.feather,
  bolt: PLANET_SCATTER.bolt,
};

// (THREE is in scope for the kit's geometry helpers' types; nothing here makes its own meshes)
void THREE;
