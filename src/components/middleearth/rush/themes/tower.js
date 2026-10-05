// The Tower of Cirith Ungol's mess: black stone, iron, red torchlight,
// orc-shields with the Eye on them, bones in the corners, and webs dragged
// up from Shelob's tunnels on the floor (the ',' tiles) and in the corners.

import * as THREE from 'three';
import { hot } from '../../../../lib/stage3d';
import { B, ball, cyl } from '../../shire/props';
import { V, webTexture } from './common';

export const TOWER = {
  sky: { background: 0x0a0606, fog: [0x120808, 12, 32], hemi: [0x8a6a6a, 0x1a0a08, 0.6], sun: [0xff9a6a, 0.8] },
  setup({ mats }) {
    const black = mats.ashlar.clone();
    black.color = new THREE.Color(0x4a4442);
    const web = new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false, opacity: 0.85 });
    const eye = new THREE.MeshBasicMaterial({ color: hot(0xff3a10, 1.6) });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.8 });
    return { black, web, eye, bone, oven: black };
  },
  room({ bk, room, at, mats, W, D, X, Z, wallH, lamps }, { black, web, eye, bone }) {
    bk.add(black, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.4 });
    const zb = Z(0) - 0.2;
    bk.add(black, B(W + 2, wallH + 1, 0.4), { p: [0, (wallH + 1) / 2, zb - 0.1], uv: 0.4 });
    for (const sx of [-1, 1]) bk.add(black, B(0.4, wallH + 1, D + 1), { p: [sx * (W / 2 + 0.2), (wallH + 1) / 2, 0], uv: 0.4 });
    // iron bands, spikes along the top, and shields with the red Eye
    bk.add(mats.iron, B(W + 2, 0.12, 0.06), { p: [0, 2.3, zb + 0.12] });
    for (let n = 0; n < 13; n++) bk.add(mats.iron, new THREE.ConeGeometry(0.06, 0.4, 5), { p: [-W / 2 + n * (W / 12), wallH + 1.2, zb] });
    for (let n = 0; n < 4; n++) {
      const x = -W / 2 + 1.8 + n * ((W - 3.6) / 3);
      bk.add(mats.iron, cyl(0.32, 0.32, 0.05, 10), { p: [x, 1.7, zb + 0.15], r: [Math.PI / 2, 0, 0] });
      bk.add(eye, ball(0.08, 8, 6), { p: [x, 1.7, zb + 0.19], s: [1, 0.5, 0.4] });
      lamps.push(V(x + 1.2, 2.0, zb + 0.3));
    }
    // bones in the corners
    for (let n = 0; n < 6; n++) bk.add(bone, cyl(0.02, 0.02, 0.3, 5), { p: [(n % 2 ? 1 : -1) * (W / 2 - 0.3), 0.03, Z(D - 2) + n * 0.1], r: [Math.PI / 2, n, 0] });
    // webs on the floor, and slung across the corners
    for (let j = 0; j < D; j++)
      for (let i = 0; i < W; i++)
        if (at(i, j) === ',') {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), web);
          w.rotation.set(-Math.PI / 2, 0, (i * 7 + j * 3) % 6);
          w.position.set(X(i + 0.5), 0.012 + ((i + j) % 3) * 0.002, Z(j + 0.5));
          room.add(w);
        }
    for (const [x, y, ry] of [[-W / 2 + 0.2, 2.6, Math.PI / 4], [W / 2 - 0.2, 2.6, -Math.PI / 4]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), web);
      w.position.set(x, y, zb + 0.6);
      w.rotation.y = ry;
      room.add(w);
    }
  },
  counter: (c, stone, { mats, m }, { black }) => [black, c === 'S' ? m.darkWood : mats.iron],
  stations: {
    W({ bk }, { black }) {
      // a black stone trough
      bk.add(black, B(0.86, 0.28, 0.6), { p: [0, 0.14, 0], uv: 1 });
    },
  },
  extras({ room, scene, lamps }) {
    // torches in iron brackets, and their red light
    const flame = new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 3) });
    const geo = new THREE.ConeGeometry(0.09, 0.32, 6);
    const flames = lamps.map((p) => {
      const f = new THREE.Mesh(geo, flame);
      f.position.copy(p);
      room.add(f);
      return f;
    });
    const lights = [-0.28, 0.28].map((sx) => {
      const l = new THREE.PointLight(0xff5a20, 3.2, 10, 1.5);
      l.position.set(sx * 12, 2.2, lamps[0]?.z ?? 0);
      scene.add(l);
      return l;
    });
    return {
      tick(dt, t) {
        flames.forEach((f, k) => f.scale.set(1, 1 + Math.sin(t * 13 + k) * 0.18, 1));
        lights.forEach((l, k) => (l.intensity = 3 + Math.sin(t * 9 + k * 2) * 0.5));
      },
    };
  },
};
