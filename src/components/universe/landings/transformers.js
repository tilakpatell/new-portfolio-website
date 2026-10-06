// Down on Cybertron: the plating outside Iacon, the energon in its seams.
// Optimus Prime and Megatron stand over it, War for Cybertron's and Fall of
// Cybertron's as they are in orbit (cybertron/optimus-orbit.glb,
// megatron-orbit.glb: landings.js names them); here
// are the rest: towers on the skyline in Kaon's tiers (cybertron/rollout/
// kaon.js's megastructures), a gate in its style to walk under, energon
// crystals growing out of the cracks, and wreckage strewn about.

import * as THREE from 'three';
import { gateGeometry, gateTrimGeometry, megaGeometry } from '../../cybertron/rollout/kaon';
import { cyl, part } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';

const { PI, cos, sin } = Math;
const ENERGON = '#5fd8ff';
const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// an energon crystal, about 1 tall: a long octahedron, pointed both ends
const crystal = () => new THREE.OctahedronGeometry(0.5, 0).scale(0.32, 1, 0.32).translate(0, 0.42, 0);

export const PROPS = {
  // a tower in Kaon's tiers, a dozen metres across at its foot, its collars lit
  tower(k, { seed = 1, w = 12, color = '#5a6272', glow = ENERGON } = {}) {
    const g = megaGeometry(seed).scale(w, w, w);
    g.computeBoundingBox();
    const h = g.boundingBox.max.y;
    const parts = [part(g, { color, to: 'metal' })];
    // slits of light up its faces
    const rand = rng(seed * 31 + 7);
    for (let i = 0; i < 6; i++) {
      const y = h * (0.1 + 0.12 * i);
      const a = rand() * PI * 2;
      const rr = w * 0.5 * (1 - (0.3 * y) / h);
      parts.push(part(new THREE.BoxGeometry(w * 0.18, 0.18, 0.1), { at: [cos(a) * rr, y, sin(a) * rr], rot: [0, -a + PI / 2, 0], color: hot(glow, 2.4), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'tower' }), solids: [{ circle: [0, 0, w * 0.48] }] };
  },

  // a gate over the way, 26 m across, its inner edge lit
  gate(k) {
    const parts = [part(gateGeometry(), { color: '#4a5160', to: 'metal' }), part(gateTrimGeometry(), { color: hot(ENERGON, 2.2), to: 'glow' })];
    return { object: k.build(parts, { name: 'gate' }), solids: [{ box: [-11.2, 0, 1.4, 1.6] }, { box: [11.2, 0, 1.4, 1.6] }] };
  },

  // energon growing out of a crack: a cluster of crystals, glowing
  energon(k, { seed = 2, n = 9, s = 1.6, color = ENERGON } = {}) {
    const rand = rng(seed);
    const parts = [part(cyl(1.4 * s, 1.0 * s, 0.25, 7), { at: [0, -0.1, 0], color: '#2c3038', to: 'metal' })];
    for (let i = 0; i < n; i++) {
      const a = rand() * PI * 2;
      const d = rand() * 0.8 * s;
      const tall = s * (0.8 + rand() * 1.6);
      parts.push(part(crystal(), { at: [cos(a) * d, 0, sin(a) * d], rot: [(rand() - 0.5) * 0.7, rand() * PI, (rand() - 0.5) * 0.7], scale: [tall * 0.8, tall, tall * 0.8], color: hot(color, 1.6 + rand()), to: 'glow' }));
    }
    const object = k.build(parts, { name: 'energon' });
    const light = new THREE.PointLight(color, 1.2, 9, 2);
    light.position.y = 1.2;
    object.add(light);
    return { object, solids: [{ circle: [0, 0, 1.1 * s] }] };
  },

  // a fallen Decepticon's wreckage: plates and a limb half buried
  wreck(k, { seed = 5 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const a = rand() * PI * 2;
      const d = rand() * 2.6;
      parts.push(part(new THREE.BoxGeometry(0.8 + rand() * 2, 0.15 + rand() * 0.4, 0.6 + rand() * 1.6), { at: [cos(a) * d, 0.1, sin(a) * d], rot: [(rand() - 0.5) * 0.9, rand() * PI, (rand() - 0.5) * 0.9], color: rand() < 0.4 ? '#7a1f24' : '#545b66', to: rand() < 0.4 ? 'paint' : 'metal' }));
    }
    parts.push(part(cyl(0.35, 0.28, 3.2, 8), { at: [0.6, 0.2, -0.4], rot: [1.2, 0.4, 0.2], color: '#3e434c', to: 'metal' }));
    parts.push(part(new THREE.SphereGeometry(0.15, 8, 6), { at: [-1, 0.25, 0.8], color: hot('#ff3a3a', 2.2), to: 'glow' }));
    return { object: k.build(parts, { name: 'wreck' }), solids: [{ circle: [0, 0, 2.4] }] };
  },
};

export const SCATTER = {
  // shards of plating, lying about
  shard(k, { seed = 3 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 3; i++) parts.push(part(new THREE.BoxGeometry(0.3 + rand() * 0.6, 0.05 + rand() * 0.1, 0.2 + rand() * 0.5), { at: [(rand() - 0.5) * 0.8, 0.04, (rand() - 0.5) * 0.8], rot: [(rand() - 0.5) * 0.4, rand() * PI, (rand() - 0.5) * 0.4], color: rand() < 0.5 ? '#6a7180' : '#4a505c', to: 'metal' }));
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.metal }], radius: null };
  },
  // small energon crystals in the seams
  crystals(k, { seed = 8, color = ENERGON } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(part(crystal(), { at: [(rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5], rot: [(rand() - 0.5) * 0.6, rand() * PI, (rand() - 0.5) * 0.6], scale: 0.25 + rand() * 0.35, color: hot(color, 1.4 + rand() * 0.8), to: 'glow' }));
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.glow }], radius: null };
  },
};
