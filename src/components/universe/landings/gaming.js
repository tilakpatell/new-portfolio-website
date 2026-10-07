// Down on the gaming planet: Dot Matrix, in a Game Boy's four greens. The
// giant Game Boy, Mario and the Piranha Plant are the planet's own models
// (universe/gaming.glb, mario.glb, piranha.glb: landings.js names them);
// here are the rest, built in blocks: a warp pipe, a row of bricks with a ?
// block bobbing over it, the flagpole, cartridges standing like monoliths
// (one for each of my projects, its name on the label), and blocky trees
// and bushes.

import * as THREE from 'three';
import { box, cyl, part } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';
import { projects } from '../../../data/projects';
import { sharpen } from '../../../lib/three/textures';

// a Game Boy's greens, darkest first
export const GREENS = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
const [G0, G1, G2, G3] = GREENS;
const { sin } = Math;

// a label in the screen's greens, for a cartridge
function label(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = G3;
  x.fillRect(0, 0, 256, 320);
  x.fillStyle = G1;
  x.fillRect(14, 14, 228, 196);
  x.fillStyle = G2;
  for (let i = 0; i < 9; i++) x.fillRect(24 + ((i * 53) % 200), 30 + ((i * 37) % 160), 18, 18);
  x.fillStyle = G0;
  x.font = 'bold 26px "Press Start 2P", monospace';
  x.textAlign = 'center';
  const words = String(text).toUpperCase().split(/\s+/);
  const lines = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 11) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  lines.slice(0, 3).forEach((l, i) => x.fillText(l.slice(0, 12), 128, 246 + i * 28, 236));
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const PROPS = {
  // a warp pipe, 3 m tall, its lip wider, dark down inside; and a plant
  // (one of the landing's models) up out of it, if it has one
  async pipe(k, { h = 3, plant = null } = {}) {
    const parts = [part(cyl(1.1, 1.1, h - 0.7, 20), { color: G1, to: 'paint' }), part(cyl(1.35, 1.35, 0.7, 20), { at: [0, h - 0.7, 0], color: G2, to: 'paint' }), part(cyl(1.05, 1.05, 0.02, 20), { at: [0, h + 0.005, 0], color: G0, to: 'dark' })];
    const object = k.build(parts, { name: 'pipe' });
    const model = plant && k.specs?.[plant] ? await k.models.get(k.specs[plant]) : null;
    if (model) {
      model.position.y = h - 0.3;
      object.add(model);
    }
    return {
      object,
      solids: [{ circle: [0, 0, 1.35] }],
      update: model ? (t) => (model.position.y = h - 0.3 + Math.max(0, sin(t * 0.9)) * 0.4) : null,
    };
  },

  // bricks in a row 4 m up, and a ? block bobbing over the middle one
  blocks(k) {
    const parts = [];
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      parts.push(part(box(1, 1, 1), { at: [i, 4, 0], color: i % 2 ? G1 : G2, to: 'paint' }));
    }
    const object = k.build(parts, { name: 'blocks' });
    const q = k.build([part(box(1.04, 1.04, 1.04), { color: G3, to: 'paint' }), part(box(0.3, 0.42, 1.08), { at: [0, 0.3, 0], color: G0, to: 'dark' }), part(box(0.3, 0.12, 1.08), { at: [0, 0.08, 0], color: G0, to: 'dark' })], { name: 'question' });
    q.position.y = 4;
    object.add(q);
    return {
      object,
      solids: [],
      update(t) {
        q.position.y = 4 + Math.abs(sin(t * 2.2)) * 0.25;
        q.rotation.y = t * 0.6;
      },
    };
  },

  // the flagpole at the end of the level, its flag up, a block at its foot
  flagpole(k) {
    const parts = [part(box(1, 1, 1), { color: G1, to: 'paint' }), part(cyl(0.08, 0.08, 10, 8), { at: [0, 1, 0], color: G2, to: 'metal' }), part(new THREE.SphereGeometry(0.28, 12, 8), { at: [0, 11.1, 0], color: G3, to: 'paint' })];
    const flag = new THREE.Shape();
    flag.moveTo(0, 0);
    flag.lineTo(-1.8, 0.7);
    flag.lineTo(0, 1.4);
    parts.push(part(new THREE.ShapeGeometry(flag), { at: [-0.05, 8.8, 0], color: G0, to: 'cloth' }));
    return { object: k.build(parts, { name: 'flagpole' }), solids: [{ circle: [0, 0, 0.7] }] };
  },

  // a cartridge stood on end, 3.2 m tall: one of my projects, its name on the label
  cartridge(k, { project = 0 } = {}) {
    const p = projects[project % projects.length];
    const parts = [part(box(2.2, 3.2, 0.5), { color: '#8a8f86', to: 'paint' }), part(box(2.0, 0.25, 0.54), { at: [0, 2.6, 0], color: '#6e736c', to: 'paint' })];
    for (let i = 0; i < 5; i++) parts.push(part(box(0.06, 0.4, 0.52), { at: [-0.8 + i * 0.4, 0.1, 0], color: '#6e736c', to: 'paint' }));
    const object = k.build(parts, { name: 'cartridge' });
    const tex = k.own(label(p?.title ?? 'GAME'));
    const face = new THREE.Mesh(k.own(new THREE.PlaneGeometry(1.7, 2.1)), k.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })));
    face.position.set(0, 1.5, 0.26);
    object.add(face);
    return { object, solids: [{ box: [0, 0, 1.1, 0.3] }] };
  },
};

export const SCATTER = {
  // a tree in blocks: a trunk and a stack of green cubes
  tree(k, { seed = 2 } = {}) {
    const rand = rng(seed);
    const leaves = [part(box(3, 2, 3), { at: [0, 3, 0], color: G1, to: 'leaf' }), part(box(2, 1.2, 2), { at: [0, 5, 0], color: G2, to: 'leaf' })];
    if (rand() < 0.7) leaves.push(part(box(1, 1, 1), { at: [0.5, 6.2, 0], color: G2, to: 'leaf' }));
    return {
      parts: [
        { geometry: k.geometry([part(box(0.8, 3, 0.8), { color: G0, to: 'bark' })]), material: k.mats.bark },
        { geometry: k.geometry(leaves), material: k.mats.leaf },
      ],
      radius: 0.6,
    };
  },
  // a bush in blocks
  bush(k) {
    const parts = [part(box(1.6, 0.8, 1), { color: G2, to: 'leaf' }), part(box(0.8, 0.5, 0.8), { at: [-0.3, 0.8, 0], color: G3, to: 'leaf' })];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.leaf }], radius: null };
  },
};
