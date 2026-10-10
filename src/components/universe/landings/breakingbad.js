// Down on Breaking Bad's planet: the desert out past Albuquerque, where
// Walt and Jesse park the RV to cook. The RV, the Aztek, the water tower,
// the cacti, tumbleweed and the barrels are the site's models (landings.js
// names them), and so are the rocks, the stones, the dry grass and the
// junipers (Quaternius's); here are the rest: the cook's camp table, the
// mesas on the skyline and White Sands' dunes.

import * as THREE from 'three';
import { ball, box, cyl, part, rockGeometry } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';

const { PI, cos, sin } = Math;

export const PROPS = {
  // the cook, outside: a folding table, the propane tank, a flask and a
  // pot on it, a camp chair, and a gas mask left on the seat
  cook(k) {
    const metal = '#9aa0a6';
    const parts = [
      part(box(1.6, 0.04, 0.7), { at: [0, 0.74, 0], color: '#c8c2b4', to: 'paint' }),
      ...[
        [-0.72, -0.28],
        [0.72, -0.28],
        [-0.72, 0.28],
        [0.72, 0.28],
      ].map(([x, z]) => part(cyl(0.015, 0.015, 0.74, 6), { at: [x, 0, z], color: metal, to: 'metal' })),
      // the tank
      part(cyl(0.18, 0.18, 0.62, 14), { at: [1.15, 0, 0.1], color: '#e4e2dc', to: 'paint' }),
      part(new THREE.SphereGeometry(0.18, 14, 8, 0, PI * 2, 0, PI / 2), { at: [1.15, 0.62, 0.1], color: '#e4e2dc', to: 'paint' }),
      part(cyl(0.05, 0.05, 0.08, 8), { at: [1.15, 0.78, 0.1], color: '#6a6a6a', to: 'metal' }),
      // on the table: a flask, a pot, a tray
      part(new THREE.SphereGeometry(0.11, 14, 10), { at: [-0.4, 0.88, 0], color: '#cfe8f0', to: 'glass' }),
      part(cyl(0.025, 0.02, 0.18, 8), { at: [-0.4, 0.96, 0], color: '#cfe8f0', to: 'glass' }),
      part(cyl(0.16, 0.16, 0.2, 16), { at: [0.25, 0.76, 0.05], color: '#7c8288', to: 'metal' }),
      part(box(0.5, 0.03, 0.34), { at: [0.1, 0.76, -0.2], color: '#a9c8d8', to: 'glass' }),
      // the chair
      part(box(0.5, 0.04, 0.48), { at: [-0.3, 0.44, 0.75], color: '#2f4f6a', to: 'cloth' }),
      part(box(0.5, 0.5, 0.04), { at: [-0.3, 0.46, 0.99], rot: [-0.18, 0, 0], color: '#2f4f6a', to: 'cloth' }),
      ...[
        [-0.53, 0.53],
        [-0.07, 0.53],
        [-0.53, 0.97],
        [-0.07, 0.97],
      ].map(([x, z]) => part(cyl(0.012, 0.012, 0.44, 6), { at: [x, 0, z], color: metal, to: 'metal' })),
      // the mask on the seat
      ball(0.1, [-0.3, 0.52, 0.72], [1, 0.7, 1], { color: '#2b2b2b', to: 'dark' }),
      part(cyl(0.045, 0.05, 0.06, 10), { at: [-0.22, 0.47, 0.68], rot: [0, 0, PI / 2], color: '#d9b43a', to: 'paint' }),
    ];
    return { object: k.build(parts, { name: 'cook' }), solids: [{ box: [0, 0, 0.85, 0.4] }, { circle: [1.15, 0.1, 0.22] }] };
  },

  // a mesa on the skyline: a flat-topped rock in bands of red sandstone,
  // stepping in as it goes up, its sides broken by the weather
  mesa(k, { seed = 2, h = 26, r = 16 } = {}) {
    const rand = rng(seed * 97 + 3);
    const bands = ['#a4603c', '#c27e52', '#b06a44', '#d49868', '#9a5634'];
    const parts = [];
    let y = -2;
    let rr = r;
    for (let i = 0; i < 4; i++) {
      const th = (h / 4) * (0.8 + rand() * 0.4);
      const top = rr * (0.82 + rand() * 0.1);
      const g = new THREE.CylinderGeometry(top, rr, th, 22, 3);
      const p = g.attributes.position;
      const v = new THREE.Vector3();
      for (let j = 0; j < p.count; j++) {
        v.fromBufferAttribute(p, j);
        const a = Math.atan2(v.z, v.x);
        const k2 = 1 + 0.12 * sin(a * 3 + seed + i) + 0.07 * sin(a * 7 + i * 2.3) + (rand() - 0.5) * 0.06;
        p.setXYZ(j, v.x * k2, v.y, v.z * k2 * 0.75);
      }
      g.computeVertexNormals();
      parts.push(part(g.translate(0, th / 2, 0), { at: [0, y, 0], color: bands[(i + seed) % bands.length], to: 'stone' }));
      y += th;
      rr = top * (i === 2 ? 0.9 : 0.97);
    }
    // boulders fallen round its foot
    for (let i = 0; i < 9; i++) {
      const a = rand() * PI * 2;
      parts.push(part(rockGeometry(seed * 10 + i), { at: [cos(a) * r * 1.05, 0, sin(a) * r * 0.8], scale: 1.5 + rand() * 2.5, color: bands[i % bands.length], to: 'stone' }));
    }
    return { object: k.build(parts, { name: 'mesa' }), solids: [{ box: [0, 0, r * 0.95, r * 0.72] }] };
  },
};

export const SCATTER = {
  // White Sands: a gypsum dune, long and low, its steep face downwind
  dune(k, { seed = 5 } = {}) {
    const g = new THREE.SphereGeometry(1, 20, 10, 0, PI * 2, 0, PI / 2);
    const p = g.attributes.position;
    const rand = rng(seed);
    const lump = rand() * 6;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // (the slip face: steeper on +x)
      const y = p.getY(i) * (x > 0 ? 1 - x * 0.35 : 1) * (1 + 0.15 * sin(z * 3 + lump));
      p.setXYZ(i, x * 9, y * 2.2, z * 4);
    }
    g.computeVertexNormals();
    return { parts: [{ geometry: k.geometry([part(g, { color: '#f2eee4', to: 'stone' })]), material: k.mats.stone }], radius: null };
  },
};
