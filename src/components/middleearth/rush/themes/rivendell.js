// Rivendell: pale stone, a back wall of slender pillars and arches open to
// the valley's evening sky, elvish lamps, and a stream through the kitchen.

import * as THREE from 'three';
import { B, ball, cyl } from '../../shire/props';
import { V, basin, lampsAt, motes, skyBehind, stream } from './common';

export const RIVENDELL = {
  sky: { background: 0x3a3448, fog: [0x5a5060, 18, 44], hemi: [0xfff0d8, 0x5a5040, 1.45], sun: [0xffd8a0, 2.6], sunAt: [-7, 10, 4] },
  setup: ({ mats }) => ({ oven: mats.ashlar }),
  room({ bk, mats, W, D, Z, wallH, lamps }) {
    // pale stone underfoot, and a back wall of slender pillars and arches,
    // open to the valley's evening sky
    bk.add(mats.dressed, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.35 });
    const zb = Z(0) - 0.1;
    const span = W / 5;
    for (let n = 0; n <= 5; n++) {
      const x = -W / 2 + n * span;
      bk.add(mats.dressed, cyl(0.16, 0.2, wallH, 10), { p: [x, wallH / 2, zb] });
      bk.add(mats.dressed, B(0.42, 0.2, 0.42), { p: [x, 0.1, zb], uv: 1 });
      if (n < 5) bk.add(mats.dressed, new THREE.TorusGeometry(span / 2 - 0.16, 0.07, 6, 18, Math.PI), { p: [x + span / 2, wallH - span / 2 + 0.05, zb] });
    }
    bk.add(mats.dressed, B(W + 2, 0.3, 0.3), { p: [0, wallH + 0.1, zb], uv: 1 });
    bk.add(mats.dressed, B(W + 2, 0.5, 0.18), { p: [0, 0.25, zb], uv: 1 }); // a low balustrade
    for (const sx of [-1, 1]) {
      for (let k = 0; k <= 3; k++) bk.add(mats.dressed, cyl(0.14, 0.17, wallH, 10), { p: [sx * (W / 2 + 0.1), wallH / 2, -D / 2 + k * (D / 3)] });
      bk.add(mats.dressed, B(0.2, 0.5, D + 1), { p: [sx * (W / 2 + 0.1), 0.25, 0], uv: 1 });
    }
    // elvish lamps on the pillars
    for (let n = 0; n <= 5; n++) lamps.push(V(-W / 2 + n * span, 2.2, zb + 0.22));
  },
  counter: (c, stone, { mats, m }) => [stone ? mats.ashlar : m.paleWood, c === 'S' ? m.darkWood : mats.dressed],
  stations: { W: basin },
  shelf: ({ mats, m }) => [m.paleWood, mats.dressed],
  water: (ctx) => stream(ctx, { kerb: ctx.mats.dressed }),
  extras(ctx) {
    const { room, at, W, D, X, Z } = ctx;
    // lily pads on the stream, and a little fall where it comes in under the wall
    const pad = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.6 });
    const bloom = new THREE.MeshStandardMaterial({ color: 0xf6e8f0, roughness: 0.5 });
    const wet = [];
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) if (at(i, j) === '~') wet.push([i, j]);
    wet.forEach(([i, j], n) => {
      if (n % 3) return;
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12, 0.3, Math.PI * 1.8), pad);
      p.rotation.set(-Math.PI / 2, 0, n);
      p.position.set(X(i + 0.3 + (n % 2) * 0.4), 0.03, Z(j + 0.35 + ((n * 7) % 3) * 0.15));
      room.add(p);
      if (n % 2 === 0) {
        const f = new THREE.Mesh(ball(0.04, 8, 6), bloom);
        f.position.copy(p.position).add(V(0, 0.03, 0));
        room.add(f);
      }
    });
    const top = wet.filter(([, j]) => j === 0);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(top.length || 2, 0.7), new THREE.MeshStandardMaterial({ color: 0xcfeef8, transparent: true, opacity: 0.7, roughness: 0.1, emissive: 0x1a4a5a }));
    const fx = top.length ? X(top.reduce((a, [i]) => a + i, 0) / top.length + 0.5) : 0;
    fall.position.set(fx, 0.38, Z(0) - 0.12);
    room.add(fall);
    const spray = motes(ctx, { n: 30, colour: 0xe8f8ff, size: 0.09, rise: 0.25, sway: 0.2, life: [0.6, 1.4], glow: 0.9, from: () => V(fx + (Math.random() - 0.5) * (top.length || 2), 0.05, Z(0) + 0.15) });
    // the valley's evening sky through the arches, and its far cliffs, dark against it
    skyBehind(ctx, [[0, '#2a2a4a'], [0.55, '#a8708a'], [0.8, '#f0b870'], [1, '#f8d898']]);
    const cliffs = new THREE.Shape();
    cliffs.moveTo(-W / 2 - 15, -2);
    for (let n = 0; n <= 14; n++) cliffs.lineTo(-W / 2 - 15 + n * ((W + 30) / 14), 1.2 + Math.sin(n * 1.7) * 0.9 + (n % 3) * 0.5);
    cliffs.lineTo(W / 2 + 15, -2);
    const hills = new THREE.Mesh(new THREE.ShapeGeometry(cliffs), new THREE.MeshBasicMaterial({ color: 0x4a3a4a, fog: false }));
    hills.position.set(0, 0, Z(0) - 3.8);
    room.add(hills);
    lampsAt(ctx, { glow: 0xffe2a8, light: 0xffd8a0 });
    return spray;
  },
};
