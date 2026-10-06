// The Outer Rim worlds' own props (sites/outer.js): Mandalore's, as The
// Mandalorian shows it after the Purge. Sundari's great dome, dark grey and
// broken open on one side; the angular towers of the city under it, their
// tops sheared off; and the glass the bombing left of the plains.

import * as THREE from 'three';
import { box, part, rockGeometry } from '../kit';
import { rng } from '../noise';

const { PI } = Math;

// a surface with its triangles turned to face the other way (the inside of a
// shell or a wall, seen from within)
const inward = (g) => {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.computeVertexNormals();
  return g;
};

export const PROPS = {
  // Sundari's dome (r: its radius): twelve sectors of dark grey shell over a
  // ringed foot, the ribs between them; `broken` sectors are torn away down
  // to a jagged band, the way in. Walls all round but there.
  sundaridome(k, { r = 46, h = 30, broken = [4, 5], seed = 3 } = {}) {
    const rand = rng(seed);
    const shell = '#57534d';
    const rib = '#3e3c39';
    const foot = '#6a665e';
    const parts = [];
    const sectors = 12;
    const step = (2 * PI) / sectors;
    const k2 = h / r; // (squashed: a dome lower than it is wide)
    for (let i = 0; i < sectors; i++) {
      const gone = broken.includes(i);
      // a broken sector keeps a band at the foot, ragged: a fifth to a third of the way up
      const top = gone ? PI / 2 - (0.18 + rand() * 0.16) * (PI / 2) : 0;
      const outer = new THREE.SphereGeometry(r, 6, 10, i * step, step, top, PI / 2 - top);
      outer.scale(1, k2, 1);
      parts.push(part(outer, { color: shell, to: 'concrete' }));
      const inner = inward(new THREE.SphereGeometry(r - 0.8, 6, 10, i * step, step, top, PI / 2 - top));
      inner.scale(1, (h - 0.8) / (r - 0.8), 1);
      parts.push(part(inner, { color: '#4a4743', to: 'concrete' }));
      // the rib on its edge, where the shell still stands
      if (!gone && !broken.includes((i + sectors - 1) % sectors)) {
        const arc = new THREE.TorusGeometry(r + 0.3, 0.7, 6, 18, PI / 2);
        arc.scale(1, k2, 1);
        // (a sphere's longitude φ runs from (-x) round to (+z): the arc, which
        // rises from +x, turned to meet it)
        parts.push(part(arc, { rot: [0, PI - i * step, 0], color: rib, to: 'metal' }));
      }
    }
    // the foot: a low wall the shell stands on, open where it's broken (a
    // cylinder's angle θ runs from +z round to +x: sector i's is φ - π/2)
    for (let i = 0; i < sectors; i++) {
      if (broken.includes(i)) continue;
      const wall = (rr) => new THREE.CylinderGeometry(rr, rr, 3.2, 4, 1, true, i * step - PI / 2, step).translate(0, 1.6, 0);
      parts.push(part(wall(r + 1.2), { color: foot, to: 'concrete' }));
      parts.push(part(inward(wall(r - 0.6)), { color: foot, to: 'concrete' }));
    }
    // walls to bump into round it, but not where it's broken open
    const solids = [];
    for (let phi = 0; phi < 2 * PI; phi += 3 / r) {
      if (broken.includes(Math.floor(phi / step) % sectors)) continue;
      solids.push({ circle: [-(r + 0.3) * Math.cos(phi), (r + 0.3) * Math.sin(phi), 1.8] });
    }
    return { object: k.build(parts, { name: 'sundaridome' }), solids };
  },

  // one of Sundari's towers, sheared off by the bombing: a tall angular
  // block of blue-grey on a broader foot, narrowing in steps, its slit
  // windows dark, its top broken to a jagged edge, rubble round it
  sundariruin(k, { h = 24, w = 9, seed = 1 } = {}) {
    const rand = rng(seed);
    const wall = '#5d666b';
    const trim = '#454c50';
    const parts = [];
    parts.push(part(box(w * 1.35, 3.5, w * 1.35), { color: trim, to: 'concrete' }));
    let y = 3.5;
    let ww = w;
    const tiers = 2 + Math.floor(rand() * 2);
    for (let t = 0; t < tiers; t++) {
      const th = ((h - 3.5) / tiers) * (0.8 + rand() * 0.3);
      parts.push(part(box(ww, th, ww), { at: [0, y, 0], color: wall, to: 'concrete' }));
      // slit windows, dark, up each face
      for (let f = 0; f < 4; f++) {
        const yaw = (f * PI) / 2;
        for (let j = 0; j < 3; j++) {
          const wx = (j - 1) * ww * 0.28;
          parts.push(part(new THREE.BoxGeometry(0.5, th * 0.6, 0.12), { at: [Math.sin(yaw) * (ww / 2 + 0.02) + Math.cos(yaw) * wx, y + th * 0.2, Math.cos(yaw) * (ww / 2 + 0.02) - Math.sin(yaw) * wx], rot: [0, yaw, 0], color: '#14171a', to: 'dark' }));
        }
      }
      parts.push(part(box(ww + 0.6, 0.6, ww + 0.6), { at: [0, y + th, 0], color: trim, to: 'concrete' }));
      y += th;
      ww *= 0.72;
    }
    // the broken top: jagged slabs leaning off it
    for (let i = 0; i < 5; i++) {
      const s = 1.2 + rand() * 2;
      parts.push(part(new THREE.BoxGeometry(ww * (0.3 + rand() * 0.4), s * 2, 0.5), { at: [(rand() - 0.5) * ww, y + s * 0.6, (rand() - 0.5) * ww], rot: [(rand() - 0.5) * 0.6, rand() * PI, (rand() - 0.5) * 0.6], color: wall, to: 'concrete' }));
    }
    // rubble at its foot
    for (let i = 0; i < 7; i++) {
      const a = rand() * 2 * PI;
      const d = w * (0.8 + rand() * 0.6);
      const s = 0.8 + rand() * 1.8;
      parts.push(part(rockGeometry(seed * 13 + i, { sharp: 0.6, flat: 0.6 }), { at: [Math.cos(a) * d, 0, Math.sin(a) * d], scale: [s * 1.4, s, s * 1.2], color: '#5a5f60', to: 'concrete' }));
    }
    return { object: k.build(parts, { name: 'sundariruin' }), solids: [{ box: [0, 0, w * 0.68, w * 0.68] }] };
  },
};

export const SCATTER = {
  // the glass the bombing made of the sand: shards of it standing up out of
  // the ground, catching the light (walked through)
  glassshard(k) {
    const g = new THREE.ConeGeometry(0.35, 1.6, 4, 1).translate(0, 0.55, 0).rotateZ(0.35);
    const g2 = new THREE.ConeGeometry(0.22, 0.9, 4, 1).translate(0.4, 0.3, 0.2).rotateZ(-0.5);
    const color = new THREE.Color('#8fa6a8');
    const paint = (geo) => {
      const n = geo.attributes.position.count;
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [color.r, color.g, color.b][i % 3]), 3));
      return geo;
    };
    return { parts: [{ geometry: k.own(paint(g)), material: k.mats.glass }, { geometry: k.own(paint(g2)), material: k.mats.glass }], radius: null };
  },
};
