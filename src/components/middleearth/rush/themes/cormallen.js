// The Field of Cormallen, the day of the feast: a bright meadow in
// Ithilien, pavilions in a row behind with the banners of Gondor and Rohan,
// tables under white cloths, carving tables, and the ovens.

import * as THREE from 'three';
import { B, ball, cyl } from '../../shire/props';
import { basin } from './common';

// a banner: black with the White Tree (Gondor), or green with the white horse (Rohan)
function banner(gondor) {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = gondor ? '#14141a' : '#2a5a2a';
  g.fillRect(0, 0, 64, 128);
  g.strokeStyle = g.fillStyle = '#f2efe6';
  g.lineWidth = 3;
  if (gondor) {
    g.beginPath();
    g.moveTo(32, 108);
    g.lineTo(32, 40);
    for (const [y, w] of [[48, 18], [60, 22], [72, 20], [84, 14]]) {
      g.moveTo(32, y);
      g.lineTo(32 - w, y - 12);
      g.moveTo(32, y);
      g.lineTo(32 + w, y - 12);
    }
    g.stroke();
    for (let k = 0; k < 7; k++) g.fillRect(14 + (k % 4) * 11, 14 + Math.floor(k / 4) * 9, 4, 4);
  } else {
    g.beginPath();
    g.ellipse(32, 64, 18, 10, -0.3, 0, Math.PI * 2);
    g.fill();
    g.fillRect(20, 68, 4, 26);
    g.fillRect(40, 66, 4, 26);
    g.beginPath();
    g.moveTo(44, 58);
    g.lineTo(52, 34);
    g.lineTo(58, 40);
    g.lineTo(48, 62);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const CORMALLEN = {
  sky: { background: 0xa8d0f0, fog: [0xc0d8e8, 26, 75], hemi: [0xf0f8ff, 0x5a8a3a, 1.55], sun: [0xfff4d8, 2.8] },
  setup({ mats }) {
    return { cloth: mats.canvas, tent: mats.canvas, green: new THREE.MeshStandardMaterial({ color: 0x3a6a3a, roughness: 0.9, side: THREE.DoubleSide }), oven: mats.ashlar };
  },
  room({ bk, mats, W, D, Z }, { tent, green }) {
    bk.add(mats.turf, B(W + 36, 0.1, D + 26), { p: [0, -0.05, -6], uv: 0.3, color: 0x9ac060 });
    // the pavilions in a row behind, each with its pennant
    for (let n = 0; n < 5; n++) {
      const x = -W / 2 + 0.5 + n * ((W - 1) / 4);
      const z = Z(0) - 2.6 - (n % 2) * 0.8;
      bk.add(n % 2 ? green : tent, cyl(1.1, 1.1, 1.6, 12), { p: [x, 0.8, z] });
      bk.add(n % 2 ? tent : green, new THREE.ConeGeometry(1.35, 1.3, 12), { p: [x, 2.25, z] });
      bk.add(mats.timber, cyl(0.03, 0.03, 0.8, 5), { p: [x, 3.2, z] });
    }
    // trees of Ithilien round the field
    for (let n = 0; n < 12; n++) {
      const side = n % 2 ? 1 : -1;
      const x = side * (W / 2 + 2 + (n % 3) * 1.4);
      const z = Z(0) - 1 + ((n * 2.3) % (D + 2));
      bk.add(mats.trunk, cyl(0.14, 0.2, 2.6, 7), { p: [x, 1.3, z] });
      bk.add(mats.foliage, ball(1.2, 9, 7), { p: [x, 3, z], color: 0x5a8a34 });
    }
  },
  counter: (c, stone, { mats, m }, { cloth }) => [stone ? mats.dressed : m.paleWood, c === 'A' ? m.board : stone ? mats.dressed : c === 'S' || c === '#' ? cloth : m.board],
  stations: {
    A({ bk, mats }) {
      // a carving table: the board, and a knife and fork laid by it
      bk.add(mats.steel, B(0.04, 0.01, 0.3), { p: [0.4, 0.01, 0.1] });
      bk.add(mats.steel, B(0.03, 0.01, 0.26), { p: [-0.4, 0.01, 0.1] });
    },
    W: basin,
  },
  shelf: ({ mats, m }) => [m.paleWood, mats.dressed],
  extras({ room, W, Z }) {
    // the banners of Gondor and Rohan, on tall poles, stirring
    const flags = [];
    for (let n = 0; n < 4; n++) {
      const x = -W / 2 - 0.6 + n * ((W + 1.2) / 3);
      const pole = new THREE.Mesh(cyl(0.04, 0.05, 4, 6), new THREE.MeshStandardMaterial({ color: 0x6a5a3a }));
      pole.position.set(x, 2, Z(0) - 1.2);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), new THREE.MeshStandardMaterial({ map: banner(n % 2 === 0), side: THREE.DoubleSide, roughness: 0.9 }));
      flag.position.set(x + 0.4, 3.1, Z(0) - 1.2);
      room.add(pole, flag);
      flags.push(flag);
    }
    return { tick: (dt, t) => flags.forEach((f, k) => (f.rotation.y = Math.sin(t * 1.3 + k) * 0.25)) };
  },
};
