// Ithilien, the garden of Gondor: a fern dell in green woods, bay and
// cedar, herbs underfoot, an old carved stone among the trees, a spring in
// a broken basin, and the fire with a coney on the spit.

import * as THREE from 'three';
import { B, ball, cyl } from '../../shire/props';
import { basin, campfire, fountain } from './common';

export const ITHILIEN = {
  sky: { background: 0xb8c8a0, fog: [0xa8b890, 20, 55], hemi: [0xf0f4d8, 0x4a6a2a, 1.4], sun: [0xffe8b8, 2.4], sunAt: [-5, 10, 6] },
  setup({ mats }) {
    const moss = mats.ashlar.clone();
    moss.color = new THREE.Color(0xa0a888);
    const spring = new THREE.MeshStandardMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.75, roughness: 0.1, emissive: 0x2a5a6a });
    return { moss, spring };
  },
  room({ bk, mats, W, D, Z }, { moss }) {
    bk.add(mats.turf, B(W + 36, 0.1, D + 26), { p: [0, -0.05, -6], uv: 0.3, color: 0x7a9a48 });
    // ferns and herbs about the dell's edges
    for (let n = 0; n < 40; n++) {
      const side = n % 2 ? 1 : -1;
      const x = n < 24 ? -W / 2 - 1 + ((n * 5.3) % (W + 2)) : side * (W / 2 + 0.8 + (n % 3) * 0.6);
      const z = n < 24 ? Z(0) - 0.8 - (n % 3) * 0.7 : Z(0) + ((n * 1.7) % D);
      bk.add(mats.foliage, new THREE.ConeGeometry(0.35, 0.5, 6), { p: [x, 0.25, z], s: [1, 0.7, 1], color: n % 3 ? 0x4a7a2a : 0x6a8a3a });
    }
    // bay and cedar behind
    for (let n = 0; n < 16; n++) {
      const x = -W / 2 - 4 + n * ((W + 8) / 15);
      const z = Z(0) - 3.5 - (n % 3) * 1.6;
      const h = 3 + (n % 4) * 0.6;
      bk.add(mats.trunk, cyl(0.14, 0.22, h, 7), { p: [x, h / 2, z] });
      bk.add(mats.foliage, ball(1.2 + (n % 2) * 0.4, 9, 7), { p: [x, h + 0.4, z], s: [1, 0.8, 1], color: n % 2 ? 0x3e6a2a : 0x5a7a34 });
    }
    // an old king's statue, fallen among the trees
    bk.add(moss, B(0.9, 2.2, 0.7), { p: [-W / 2 + 1.5, 1.1, Z(0) - 2.2], r: [0, 0.3, 0], uv: 1 });
    bk.add(moss, ball(0.45, 10, 8), { p: [-W / 2 + 2.6, 0.3, Z(0) - 1.6] });
  },
  counter: (c, stone, { mats, m }, { moss }) => [moss, c === 'S' ? m.darkWood : stone ? mats.dressed : m.board],
  stations: {
    O: campfire,
    T: (ctx, { spring }) => fountain(ctx, spring),
    W: basin,
  },
  flame: ['O'],
};
