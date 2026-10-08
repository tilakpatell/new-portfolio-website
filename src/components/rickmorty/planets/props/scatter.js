// The planets' ground cover, drawn instanced by the hundred (a scatter
// builder: (kit, opts) → { parts, radius }, radius null to walk through
// it): Gazorpazorp's red rocks and the men's bones, Squanch's cat trees,
// Bird World's feathers and eggs, Gear World's bolts, Pluto's ice shards,
// the Purge Planet's lanterns. The bones, cat trees, feathers and bolts were
// the universe map's moons' (landings/rmmoons.js), which take them from here.

import * as THREE from 'three';
import { ball, box, cyl, part, rockGeometry } from '../../../galaxy/surface/kit';
import { rng } from '../../../galaxy/surface/noise';

const { PI } = Math;
const one = (k, parts, material, radius) => ({ parts: [{ geometry: k.geometry(parts), material: k.mats[material] }], radius });

export const SCATTER = {
  // a boulder of Gazorpazorp's red rock
  redrock(k, { seed = 6, color = '#8a3a2a' } = {}) {
    return one(k, [part(rockGeometry(seed, { sharp: 0.45 }).scale(1.1, 0.8, 1.1), { color, to: 'rock' })], 'rock', 1);
  },
  bone(k) {
    const parts = [part(cyl(0.05, 0.05, 0.7, 6), { rot: [0, 0, PI / 2], at: [0, 0.06, 0], color: '#e8e0c8', to: 'paint' }), ball(0.09, [0.35, 0.08, 0], 1, { color: '#e8e0c8', to: 'paint' }, 6), ball(0.09, [-0.35, 0.08, 0], 1, { color: '#e8e0c8', to: 'paint' }, 6)];
    return one(k, parts, 'paint', null);
  },
  // a cat tree: a carpeted post with platforms, Squanch's kind of tree
  cattree(k, { seed = 4 } = {}) {
    const rand = rng(seed);
    const parts = [part(cyl(0.35, 0.3, 5 + rand() * 2, 8), { color: '#d8c8a8', to: 'cloth' })];
    for (let i = 1; i <= 3; i++) parts.push(part(box(1.8 - i * 0.2, 0.2, 1.8 - i * 0.2), { at: [0, 1.6 * i, 0], color: i % 2 ? '#c8a888' : '#e8d8b8', to: 'cloth' }));
    parts.push(ball(0.3, [0.9, 5.4, 0], 1, { color: '#ff6a8a', to: 'paint' }, 8));
    return one(k, parts, 'cloth', 0.6);
  },
  feather(k) {
    const parts = [part(box(0.06, 0.02, 0.5), { at: [0, 0.01, 0], rot: [0, 0.6, 0], color: '#e8f0e0', to: 'paint' }), part(box(0.22, 0.01, 0.3), { at: [0, 0.015, 0.05], rot: [0, 0.6, 0], color: '#d8e8d0', to: 'paint' })];
    return one(k, parts, 'paint', null);
  },
  bolt(k) {
    const parts = [part(cyl(0.12, 0.12, 0.1, 6), { color: '#8a7a5a', to: 'metal' }), part(cyl(0.05, 0.05, 0.3, 6), { at: [0, 0.1, 0], color: '#6a5a3a', to: 'metal' })];
    return one(k, parts, 'metal', null);
  },
  // a shard of Pluto's ice, pale blue, leaning
  iceshard(k, { seed = 3 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 3; i++) parts.push(part(new THREE.ConeGeometry(0.25 + rand() * 0.2, 1.2 + rand() * 1.4, 5).translate(0, 0.6, 0), { at: [(rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6], rot: [(rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6], color: '#c8e0f0', to: 'paint' }));
    return one(k, parts, 'paint', 0.4);
  },
  // an egg in a nest of twigs, Bird World's
  egg(k) {
    const parts = [part(new THREE.TorusGeometry(0.32, 0.1, 6, 12).rotateX(PI / 2), { at: [0, 0.08, 0], color: '#8a6a3a', to: 'bark' }), ball(0.18, [0, 0.2, 0], [1, 1.3, 1], { color: '#e8e0b8', to: 'paint' }, 10)];
    return one(k, parts, 'paint', null);
  },
  // a paper lantern on a post, the Purge Planet's village lights
  lantern(k) {
    const parts = [part(cyl(0.05, 0.05, 1.8, 6), { color: '#4a3a2a', to: 'wood' }), ball(0.22, [0, 1.95, 0], [1, 1.25, 1], { color: new THREE.Color('#ffb050').multiplyScalar(1.8), to: 'glow' }, 10)];
    return { parts: [{ geometry: k.geometry(parts.slice(0, 1)), material: k.mats.wood }, { geometry: k.geometry(parts.slice(1)), material: k.mats.glow }], radius: 0.2 };
  },
};
