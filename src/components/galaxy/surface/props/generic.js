// Props any world can have: rocks to scatter, landing pads, crates, lamps,
// a campfire. (props/index.js has what a builder returns.)

import * as THREE from 'three';
import { box, cyl, part, rockGeometry, rod } from '../kit';

const { PI, cos, sin } = Math;

export const PROPS = {

  // a 74-Z speeder bike: a long thin body, the steering vanes out front on
  // their booms, a saddle, 3.2 m long, nose to +z
  speederbike(k, { color = '#5a5e52' } = {}) {
    const dark = '#2a2c28';
    const parts = [
      part(new THREE.CapsuleGeometry(0.22, 1.5, 4, 12), { at: [0, 0.55, -0.35], rot: [Math.PI / 2, 0, 0], scale: [1.2, 1, 1], color, to: 'paint' }),
      part(box(0.38, 0.22, 0.9), { at: [0, 0.6, -1.0], color: dark, to: 'metal' }),
      part(box(0.3, 0.12, 0.55), { at: [0, 0.78, -0.25], color: '#3a302a', to: 'cloth' }),
      part(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), { at: [0, 0.6, -1.47], rot: [Math.PI / 2, 0, 0], color: new THREE.Color('#ff8a40').multiplyScalar(2), to: 'glow' }),
    ];
    // the booms and the vanes on their ends
    for (const x of [-0.12, 0.12]) parts.push(rod([x, 0.55, 0.4], [x * 1.6, 0.45, 1.55], 0.03, 0.03, { color: dark, to: 'metal' }));
    for (const x of [-0.28, 0.28]) parts.push(part(box(0.05, 0.36, 0.5), { at: [x, 0.28, 1.5], color, to: 'paint' }));
    // the handlebars
    parts.push(rod([-0.3, 0.95, 0.15], [0.3, 0.95, 0.15], 0.02, 0.02, { color: dark, to: 'metal' }));
    return { object: k.build(parts, { name: 'speederbike' }) };
  },
  // a landing pad: a ring of lights round a disc, `r` across
  pad(k, { r = 14, color = '#7e7a72', light = '#ffb24a' } = {}) {
    const parts = [part(cyl(r, r, 0.25, 40), { color, to: 'metal' }), part(cyl(r * 0.92, r * 0.92, 0.27, 40), { color: '#5c5852', to: 'metal' })];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2;
      parts.push(part(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8), { at: [cos(a) * r * 0.96, 0.3, sin(a) * r * 0.96], color: new THREE.Color(light).multiplyScalar(3), to: 'glow' }));
    }
    // the markings: a cross of strips
    for (const a of [0, PI / 2]) parts.push(part(new THREE.BoxGeometry(r * 1.1, 0.02, 0.5), { at: [0, 0.28, 0], rot: [0, a, 0], color: '#d8c890', to: 'paint' }));
    return { object: k.build(parts, { name: 'pad' }), floors: [{ x: 0, z: 0, r, y: 0.27 }] };
  },

  // a stack of crates
  crates(k, { color = '#8a7556' } = {}) {
    const r = k.rand;
    const parts = [];
    const n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const s = 0.8 + r() * 0.6;
      parts.push(part(box(s, s, s), { at: [(r() - 0.5) * 2.4, i > 2 ? s : 0, (r() - 0.5) * 2.4], rot: [0, r() * PI, 0], color: new THREE.Color(color).offsetHSL(0, 0, (r() - 0.5) * 0.12), to: 'paint' }));
    }
    return { object: k.build(parts, { name: 'crates' }), solids: [{ circle: [0, 0, 1.6], top: 1.4 }] };
  },

  // a lamp post, its light glowing
  lamp(k, { h = 4, light = '#ffd9a0', color = '#4a4844' } = {}) {
    const parts = [part(cyl(0.12, 0.08, h, 8), { color, to: 'metal' }), part(new THREE.SphereGeometry(0.22, 12, 8), { at: [0, h + 0.1, 0], color: new THREE.Color(light).multiplyScalar(4), to: 'glow' })];
    return { object: k.build(parts, { name: 'lamp' }), solids: [{ circle: [0, 0, 0.2] }] };
  },

  // a campfire: stones round embers, its flame flickering
  fire(k) {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      parts.push(part(rockGeometry(i + 3), { at: [cos(a) * 0.75, -0.05, sin(a) * 0.75], scale: 0.38, color: '#5a5048', to: 'stone' }));
    }
    for (let i = 0; i < 4; i++) parts.push(rod([cos(i) * 0.5, 0.05, sin(i) * 0.5], [-cos(i) * 0.4, 0.25, -sin(i) * 0.4], 0.06, 0.05, { color: '#3a2a1c', to: 'bark' }));
    const object = k.build(parts, { name: 'fire' });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3a').multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    k.own(flame.geometry);
    k.own(flame.material);
    flame.position.y = 0.5;
    object.add(flame);
    const light = new THREE.PointLight('#ff9a4a', 6, 14, 2);
    light.position.y = 1;
    object.add(light);
    return {
      object,
      solids: [{ circle: [0, 0, 0.9], top: 0.4 }],
      update(t) {
        const f = 1 + 0.18 * sin(t * 13) + 0.1 * sin(t * 29);
        flame.scale.set(1, f, 1);
        light.intensity = 5 + f * 2;
      },
    };
  },
};

// Things scattered by the dozen (drawn instanced): each gives its
// geometries, with the material each is drawn with, and how wide its
// footprint is at scale 1 (null: you walk through it).
export const SCATTER = {
  rock(k, { seed = 1, color = '#8a7a66', sharp = 0.4 } = {}) {
    const g = rockGeometry(seed, { sharp, detail: 1 });
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'stone' })]), material: k.mats.stone }], radius: 0.42 };
  },
  // pebbles and small stones you walk over
  stones(k, { seed = 2, color = '#7a6c5c' } = {}) {
    const g = rockGeometry(seed, { sharp: 0.2, detail: 0, flat: 0.4 });
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'stone' })]), material: k.mats.stone }], radius: null };
  },
};
