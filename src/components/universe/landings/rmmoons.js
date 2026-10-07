// Down on the Rick and Morty sector's worlds (universes.js's MOONS): the
// things landings.js names for them that aren't models, one file between
// them. The portal is the C-137 landing's (./rickmorty.js), open on the
// ground as the show draws it; the rest is ground cover: rocks, the men's
// bones on Gazorpazorp, Squanch's cat trees, Bird World's feathers and Gear
// World's bolts. The places' own set pieces (the women's gate, the
// suckulents, the perches, the cogs and the gear monument, the houses) and
// the people are models (landings.js).

import * as THREE from 'three';
import { ball, box, cyl, part, rockGeometry } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';
import { PROPS as RM } from './rickmorty';

const { PI } = Math;

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
  bone(k) {
    const parts = [part(cyl(0.05, 0.05, 0.7, 6), { rot: [0, 0, PI / 2], at: [0, 0.06, 0], color: '#e8e0c8', to: 'paint' }), ball(0.09, [0.35, 0.08, 0], 1, { color: '#e8e0c8', to: 'paint' }, 6), ball(0.09, [-0.35, 0.08, 0], 1, { color: '#e8e0c8', to: 'paint' }, 6)];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.paint }], radius: null };
  },
  // a cat tree: a carpeted post with platforms, Squanch's kind of tree
  cattree(k, { seed = 4 } = {}) {
    const rand = rng(seed);
    const parts = [part(cyl(0.35, 0.3, 5 + rand() * 2, 8), { color: '#d8c8a8', to: 'cloth' })];
    for (let i = 1; i <= 3; i++) parts.push(part(box(1.8 - i * 0.2, 0.2, 1.8 - i * 0.2), { at: [0, 1.6 * i, 0], color: i % 2 ? '#c8a888' : '#e8d8b8', to: 'cloth' }));
    parts.push(ball(0.3, [0.9, 5.4, 0], 1, { color: '#ff6a8a', to: 'paint' }, 8));
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.cloth }], radius: 0.6 };
  },
  feather(k) {
    const parts = [part(box(0.06, 0.02, 0.5), { at: [0, 0.01, 0], rot: [0, 0.6, 0], color: '#e8f0e0', to: 'paint' }), part(box(0.22, 0.01, 0.3), { at: [0, 0.015, 0.05], rot: [0, 0.6, 0], color: '#d8e8d0', to: 'paint' })];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.paint }], radius: null };
  },
  bolt(k) {
    const parts = [part(cyl(0.12, 0.12, 0.1, 6), { color: '#8a7a5a', to: 'metal' }), part(cyl(0.05, 0.05, 0.3, 6), { at: [0, 0.1, 0], color: '#6a5a3a', to: 'metal' })];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.metal }], radius: null };
  },
};

// (THREE is in scope for the kit's geometry helpers' types; nothing here makes its own meshes)
void THREE;
