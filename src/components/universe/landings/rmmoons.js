// Down on the Rick and Morty sector's worlds (universes.js's MOONS): the
// things landings.js names for Gazorpazorp, Planet Squanch, Bird World and
// Gear World, one file between them. The portal is the C-137 landing's
// (./rickmorty.js), open on the ground as the show draws it; the rest are
// the places' own: the women's gate and the men's rocks, Squanchy's
// suckulents and cat trees, Birdperson's perches and the feathers, Gear
// World's cogs and bolts. The houses and the people are models (landings.js).

import * as THREE from 'three';
import { ball, box, cyl, part, rockGeometry } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';
import { PROPS as RM } from './rickmorty';

const { PI, cos, sin } = Math;

export const PROPS = {
  portal: RM.portal,

  // a rock of the desert (or Bird World's grey)
  rock(k, { seed = 1, size = 2, color = '#8a3a2a' } = {}) {
    const g = rockGeometry(seed, { sharp: 0.4, flat: 0.6 }).scale(size, size * 0.8, size);
    return { object: k.build([part(g, { color, to: 'stone' })], { name: 'rock' }), solids: [{ circle: [0, 0, size * 0.9] }] };
  },

  // the gate of the women's city: two pillars of red stone, a lintel, the doors
  gate(k) {
    const red = '#9a4a3a';
    const parts = [
      part(box(2, 9, 2), { at: [-4.5, 0, 0], color: red, to: 'stone' }),
      part(box(2, 9, 2), { at: [4.5, 0, 0], color: red, to: 'stone' }),
      part(box(12, 1.2, 2.4), { at: [0, 9, 0], color: '#7a3a2a', to: 'stone' }),
      part(box(3.4, 7, 0.4), { at: [-1.75, 0, 0], color: '#d8b25a', to: 'metal' }),
      part(box(3.4, 7, 0.4), { at: [1.75, 0, 0], color: '#d8b25a', to: 'metal' }),
      ball(0.5, [0, 10.6, 0], 1, { color: '#ff9a6a', to: 'glow' }, 10),
    ];
    return { object: k.build(parts, { name: 'gate' }), solids: [{ box: [-4.5, 0, 1.1, 1.1] }, { box: [4.5, 0, 1.1, 1.1] }, { box: [0, 0, 3.5, 0.3] }] };
  },

  // a suckulent: a fat pink-green succulent with a mouth in the top
  suckulent(k, { seed = 1 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + rand() * 0.4;
      parts.push(ball(0.5 + rand() * 0.2, [cos(a) * 0.55, 0.5, sin(a) * 0.55], [1, 1.4, 1], { color: i % 2 ? '#8ab84a' : '#c86a8a', to: 'leaf' }, 10));
    }
    parts.push(ball(0.6, [0, 0.9, 0], [1, 0.7, 1], { color: '#c84a6a', to: 'paint' }, 10));
    parts.push(ball(0.25, [0, 1.25, 0], [1, 0.4, 1], { color: '#3a1a2a', to: 'dark' }, 8));
    return { object: k.build(parts, { name: 'suckulent' }), solids: [{ circle: [0, 0, 0.9] }] };
  },

  // a perch: a pole with a crossbar, for a bird person to land on
  perch(k, { h = 5 } = {}) {
    const parts = [part(cyl(0.18, 0.14, h, 8), { color: '#6b4a32', to: 'bark' }), part(box(2.4, 0.16, 0.16), { at: [0, h, 0], color: '#8a6a4a', to: 'bark' })];
    return { object: k.build(parts, { name: 'perch' }), solids: [{ circle: [0, 0, 0.3] }] };
  },

  // a cog lying flat, teeth round its rim; `bigcog` one the size of a house, turning
  cog(k, { r = 2, seed = 1 } = {}) {
    const parts = cogParts(r, 0.3, '#c89a4a');
    return { object: k.build(parts, { name: `cog${seed}` }), solids: [{ circle: [0, 0, r * 1.05] }] };
  },
  bigcog(k) {
    const object = k.build(cogParts(7, 1.2, '#b88a3a'), { name: 'bigcog' });
    return {
      object,
      solids: [{ circle: [0, 0, 7.4] }],
      update(t) {
        object.rotation.y = t * 0.08;
      },
    };
  },
};

function cogParts(r, h, color) {
  const parts = [part(cyl(r, r, h, 24), { color, to: 'metal' }), part(cyl(r * 0.3, r * 0.3, h * 1.3, 12), { color: '#6a4a2a', to: 'dark' })];
  const n = Math.max(8, Math.round(r * 5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    parts.push(part(box(r * 0.22, h, r * 0.18), { at: [cos(a) * r * 1.05, 0, sin(a) * r * 1.05], rot: [0, -a, 0], color, to: 'metal' }));
  }
  return parts;
}

export const SCATTER = {
  rock(k, { seed = 2, color = '#8a3a2a' } = {}) {
    return { parts: [{ geometry: k.geometry([part(rockGeometry(seed, { sharp: 0.4 }).scale(0.8, 0.6, 0.8), { color, to: 'stone' })]), material: k.mats.stone }], radius: 0.8 };
  },
  bone(k) {
    const parts = [part(cyl(0.05, 0.05, 0.7, 6), { rot: [0, 0, PI / 2], at: [0, 0.06, 0], color: '#e8e0c8', to: 'paint' }), ball(0.09, [0.35, 0.08, 0], 1, { color: '#e8e0c8', to: 'paint' }, 6), ball(0.09, [-0.35, 0.08, 0], 1, { color: '#e8e0c8', to: 'paint' }, 6)];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.paint }], radius: null };
  },
  suckulent(k, { seed = 3 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      parts.push(ball(0.35 + rand() * 0.15, [cos(a) * 0.35, 0.35, sin(a) * 0.35], [1, 1.4, 1], { color: i % 2 ? '#8ab84a' : '#c86a8a', to: 'leaf' }, 8));
    }
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.leaf }], radius: 0.6 };
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
  cog(k, { seed = 5 } = {}) {
    const rand = rng(seed);
    const r = 0.5 + rand() * 0.6;
    return { parts: [{ geometry: k.geometry(cogParts(r, 0.14, '#c89a4a')), material: k.mats.metal }], radius: r * 1.1 };
  },
  bolt(k) {
    const parts = [part(cyl(0.12, 0.12, 0.1, 6), { color: '#8a7a5a', to: 'metal' }), part(cyl(0.05, 0.05, 0.3, 6), { at: [0, 0.1, 0], color: '#6a5a3a', to: 'metal' })];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.metal }], radius: null };
  },
};

// (THREE is in scope for the kit's geometry helpers' types; nothing here makes its own meshes)
void THREE;
