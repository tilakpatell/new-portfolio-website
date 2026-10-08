// The planets' four rides' bodies, built in code in the galaxy's prop style
// (galaxy/surface/props/index.js has what a builder gives): no model of any
// of them exists. Each stands on y = 0 with its nose to +z, in metres, and
// is as wide as its ride's footprint (../rides.js reads RIDE_RADIUS), the
// scene holding it up at its hover. `opts.color` paints its body, `opts.look`
// its trim.

import * as THREE from 'three';
import { ball, box, cyl, part, rockGeometry } from '../../../galaxy/surface/kit';

const { PI } = Math;
const lit = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);
// (a ride's footprint: its solid, and its ride's radius, one number)
export const RIDE_RADIUS = { rocksled: 1.4, gearbike: 0.75, purgeskiff: 1.5, birdglider: 2 };
const footprint = (kind) => [{ circle: [0, 0, RIDE_RADIUS[kind]] }];

export const PROPS = {
  // Gazorpazorp's rock sled: a slab of the red desert's own rock, hollowed
  // to sit in, on two bone runners, a hover coil glowing under it (the men
  // made it; Rick put the coil in)
  rocksled(k, { color = '#8a3a2a', look = '#e8e0c8' } = {}) {
    const slab = rockGeometry(5, { sharp: 0.25, flat: 0.8 }).scale(1.25, 0.32, 1.7);
    const parts = [part(slab, { at: [0, 0.3, 0], color, to: 'rock' })];
    // the hollow you sit in, and its lip
    parts.push(part(box(1.1, 0.12, 1.4), { at: [0, 0.48, -0.25], color: '#4a1e14', to: 'dark' }));
    // two bone runners, their knuckles at the ends
    for (const x of [-0.85, 0.85]) {
      parts.push(part(cyl(0.07, 0.07, 3, 8), { at: [x, 0.08, -1.5], rot: [PI / 2, 0, 0], color: look, to: 'paint' }));
      parts.push(ball(0.13, [x, 0.08, 1.5], 1, { color: look, to: 'paint' }, 8), ball(0.13, [x, 0.08, -1.5], 1, { color: look, to: 'paint' }, 8));
    }
    // the coil under it, and a tusk on its nose
    parts.push(part(new THREE.TorusGeometry(0.55, 0.08, 8, 20).rotateX(PI / 2), { at: [0, 0.05, 0], color: lit('#8dff5a', 2.2), to: 'glow' }));
    parts.push(part(new THREE.ConeGeometry(0.12, 0.7, 8).rotateX(PI / 2), { at: [0, 0.55, 1.85], color: look, to: 'paint' }));
    return { object: k.build(parts, { name: 'rocksled' }), solids: footprint('rocksled') };
  },

  // Gear World's gear bike: a frame of brass, a cog for each wheel turned
  // on its side as a hover disc, a seat and bars
  gearbike(k, { color = '#b8892e', look = '#5a4a2a' } = {}) {
    const parts = [part(box(0.32, 0.3, 2.2), { at: [0, 0.45, 0], color, to: 'metal' })];
    for (const z of [-0.85, 0.85]) {
      parts.push(part(cyl(0.42, 0.42, 0.14, 12), { at: [0, 0.18, z], color: look, to: 'metal' }));
      // (the cog's teeth)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        parts.push(part(box(0.12, 0.14, 0.12), { at: [Math.cos(a) * 0.46, 0.18, z + Math.sin(a) * 0.46], rot: [0, -a, 0], color: look, to: 'metal' }));
      }
    }
    parts.push(part(box(0.4, 0.1, 0.6), { at: [0, 0.78, -0.4], color: '#3a2a1a', to: 'cloth' }));
    parts.push(part(cyl(0.035, 0.035, 0.7, 6), { at: [-0.35, 1.02, 0.7], rot: [0, 0, PI / 2], color: look, to: 'metal' }));
    parts.push(part(cyl(0.05, 0.05, 0.5, 6), { at: [0, 0.6, 0.7], color, to: 'metal' }));
    parts.push(part(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10).rotateX(PI / 2), { at: [0, 0.5, -1.12], color: lit('#ffc060'), to: 'glow' }));
    return { object: k.build(parts, { name: 'gearbike' }), solids: footprint('gearbike') };
  },

  // Arthricia's skiff, from the Purge Planet's farms: a flat-bottomed wooden
  // hull on a hover pan, a bench for two, a lantern on a pole at the bow
  purgeskiff(k, { color = '#7a5a3a', look = '#c8a060' } = {}) {
    const parts = [part(box(2.2, 0.2, 3.4), { at: [0, 0.15, 0], color, to: 'wood' })];
    // its sides, raked out, and the stern board
    for (const x of [-1.05, 1.05]) parts.push(part(box(0.1, 0.45, 3.3), { at: [x, 0.3, 0], rot: [0, 0, x < 0 ? 0.2 : -0.2], color, to: 'wood' }));
    parts.push(part(box(2.1, 0.5, 0.1), { at: [0, 0.3, -1.65], color, to: 'wood' }));
    parts.push(part(box(1.6, 0.12, 0.5), { at: [0, 0.5, -0.4], color: look, to: 'wood' }));
    parts.push(part(cyl(0.04, 0.04, 1.6, 6), { at: [0, 0.3, 1.5], color: '#3a2a1a', to: 'wood' }));
    parts.push(ball(0.12, [0, 1.95, 1.5], 1, { color: lit('#ffb050', 1.8), to: 'glow' }, 8));
    // the hover pan under it, an old tractor's
    parts.push(part(cyl(0.9, 1.0, 0.12, 14), { at: [0, 0, 0], color: '#5a5a58', to: 'metal' }));
    return { object: k.build(parts, { name: 'purgeskiff' }), solids: footprint('purgeskiff') };
  },

  // Bird World's glider: a seat slung under two broad feathered wings and
  // a tail, a bird's span, for riding the thermals off the cliffs
  birdglider(k, { color = '#e8dcc0', look = '#2a8a9a' } = {}) {
    const parts = [part(box(0.5, 0.3, 1.6), { at: [0, 0.3, 0], color: '#5a3a22', to: 'wood' })];
    for (const s of [-1, 1]) {
      parts.push(part(box(1.9, 0.06, 1.1), { at: [s * 1.15, 1.1, 0.1], rot: [0, s * 0.15, s * 0.08], color, to: 'cloth' }));
      // its feathers' tips, dark, along the trailing edge
      for (let i = 0; i < 4; i++) parts.push(part(box(0.38, 0.04, 0.5), { at: [s * (0.5 + i * 0.45), 1.08, -0.6], rot: [0, s * 0.3, 0], color: look, to: 'cloth' }));
      parts.push(part(cyl(0.03, 0.03, 0.9, 6), { at: [s * 0.25, 0.3, 0.2], rot: [0, 0, -s * 0.3], color: '#3a2a1a', to: 'wood' }));
    }
    parts.push(part(box(0.9, 0.05, 0.6), { at: [0, 0.95, -1.2], color, to: 'cloth' }));
    parts.push(part(new THREE.ConeGeometry(0.16, 0.5, 6).rotateX(PI / 2), { at: [0, 0.35, 0.95], color: '#e8a030', to: 'paint' }));
    return { object: k.build(parts, { name: 'birdglider' }), solids: footprint('birdglider') };
  },
};
