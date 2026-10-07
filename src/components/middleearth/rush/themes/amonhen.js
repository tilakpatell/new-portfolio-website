// Amon Hen: the Fellowship's last camp, on the lawn at Parth Galen by day,
// the woods behind and Nen Hithoel in front; campfires with spits, elven
// boats drawn up on the shore, and Amon Hen and its Seat over the trees.
// Ducks paddle about off the shore, and the mist of the Falls of Rauros
// drifts up the lake over the water.

import * as THREE from 'three';
import { B, ball, cyl } from '../../shire/props';
import { V, campfire, fountain, motes } from './common';
import { sharpen } from '../../../../lib/three/textures';

export const AMON_HEN = {
  sky: { background: 0x9ec4e0, fog: [0xb8ccd8, 24, 70], hemi: [0xe8f2ff, 0x5a7a3a, 1.5], sun: [0xfff0d0, 2.6] },
  setup({ paint }) {
    // the boats' grey wood (seen from inside too), and the spring
    const hull = paint(0xa8a49a).clone();
    hull.side = THREE.DoubleSide;
    const spring = new THREE.MeshStandardMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.75, roughness: 0.1, emissive: 0x2a5a6a });
    return { hull, spring };
  },
  room({ bk, mats, W, D, Z }) {
    // the lawn, running back into the trees and down to the lake (the
    // front row is the water's edge)
    const shore = Z(D - 1);
    const deepBack = 16;
    bk.add(mats.turf, B(W + 36, 0.1, deepBack + D - 1), { p: [0, -0.05, shore - (deepBack + D - 1) / 2], uv: 0.3, color: 0x9ab860 });
    // pebbles along the water
    bk.add(mats.stone, B(W + 36, 0.06, 0.34), { p: [0, -0.06, shore + 0.1], uv: 1 });
    // the woods behind, and down the sides
    for (let n = 0; n < 34; n++) {
      const side = n % 3 === 0 ? (n % 2 ? 1 : -1) : 0;
      const x = side ? side * (W / 2 + 1.6 + (n % 4) * 1.1) : -W / 2 - 6 + ((n * 7.3) % (W + 12));
      const z = side ? Z(0) + ((n * 2.7) % (D - 1)) : Z(0) - 1.4 - ((n * 3.1) % 6);
      const h = 2.6 + ((n * 1.7) % 1.6);
      bk.add(mats.trunk, cyl(0.12, 0.18, h, 7), { p: [x, h / 2, z] });
      bk.add(mats.foliage, new THREE.ConeGeometry(0.9 + (n % 3) * 0.2, h * 0.9, 8), { p: [x, h * 0.85, z], color: n % 4 ? 0x4a7a3a : 0x6a8a3a });
    }
  },
  // (the boats are in the lake: no counter under them)
  counter: (c, stone, { mats, m }) => (c === 'S' ? null : [stone ? mats.ashlar : mats.barnwood, stone ? mats.dressed : m.board]),
  stations: {
    S({ bk, mats }, { hull }) {
      // an elven boat, its bow drawn up on the shore, packed for the morning
      bk.add(hull, new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), { p: [0, -0.78, -0.45], s: [0.8, 0.55, 2.1] });
      bk.add(hull, new THREE.TorusGeometry(0.5, 0.03, 4, 28), { p: [0, -0.78, -0.45], r: [Math.PI / 2, 0, 0], s: [0.8, 2.1, 1] });
      for (const zz of [-0.35, 0.35]) bk.add(hull, B(0.7, 0.03, 0.1), { p: [0, -0.84, -0.45 + zz] });
      bk.add(mats.sack, ball(0.13, 8, 6), { p: [0.08, -0.82, -1.05], s: [1, 0.7, 1.2] });
      bk.add(mats.canvas, ball(0.11, 8, 6), { p: [-0.1, -0.84, 0.05], s: [1.2, 0.6, 1] });
    },
    O: campfire,
    T: (ctx, { spring }) => fountain(ctx, spring),
  },
  water({ room, W, D, Z }) {
    // Nen Hithoel: the lake, the whole width of the front, ruffled; and over
    // the trees, Amon Hen and its Seat against the sky
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#4f7a92';
    g.fillRect(0, 0, 128, 128);
    for (let n = 0; n < 60; n++) {
      g.strokeStyle = `rgba(220, 240, 250, ${0.08 + Math.random() * 0.22})`;
      g.lineWidth = 1 + Math.random();
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 6, y - 2, x + 10 + Math.random() * 8, y);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    sharpen(tex);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((W + 36) / 3, 8);
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(W + 36, 24), new THREE.MeshStandardMaterial({ map: tex, color: 0xcfe6f0, roughness: 0.15, metalness: 0.1, emissive: 0x0a2a36, emissiveIntensity: 0.4 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0, -0.07, Z(D - 1) + 12);
    room.add(lake);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, 26), new THREE.MeshBasicMaterial({ color: 0x9ec4e0, fog: false }));
    sky.position.set(0, 9, Z(0) - 22);
    const hill = new THREE.Mesh(new THREE.ConeGeometry(9, 11, 9), new THREE.MeshStandardMaterial({ color: 0x55684a, roughness: 1, flatShading: true }));
    hill.position.set(-5, 4.5, Z(0) - 16);
    const seat = new THREE.Mesh(B(0.9, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0xb8b4a8, roughness: 0.9 }));
    seat.position.set(-5, 10.2, Z(0) - 16);
    room.add(sky, hill, seat);
    // (the lake only ruffles)
    return { tex, tick: (dt) => (tex.offset.x += dt * 0.03) };
  },
  extras(ctx) {
    const { room, W, D, Z } = ctx;
    const shore = Z(D - 1);
    // the mist of Rauros, drifting up the lake on the wind, thin over the water
    const mist = motes(ctx, { n: 34, colour: 0xeaf4ff, size: 0.9, rise: 0.06, sway: 0.7, life: [4, 8], glow: 0.28, from: () => V((Math.random() - 0.5) * (W + 4), 0.05 + Math.random() * 0.4, shore + 0.4 + Math.random() * 1.6) });
    // ducks, paddling about between the boats and the rocks: drakes green-headed
    const body = new THREE.SphereGeometry(0.16, 10, 7);
    const head = new THREE.SphereGeometry(0.075, 8, 6);
    const beak = new THREE.ConeGeometry(0.03, 0.09, 6).rotateZ(-Math.PI / 2);
    const brown = new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 0.9 });
    const grey = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.9 });
    const green = new THREE.MeshStandardMaterial({ color: 0x1e6a3a, roughness: 0.45, metalness: 0.2 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe8a030, roughness: 0.6 });
    const ducks = [
      [-0.31, 0.03],
      [-0.03, 0.015],
      [0.04, 0.015],
      [0.3, 0.025],
    ].map(([f, span], i) => {
      const d = new THREE.Group();
      const drake = i % 2 === 0;
      const b = new THREE.Mesh(body, drake ? grey : brown);
      b.scale.set(1.5, 0.75, 0.9);
      const h = new THREE.Mesh(head, drake ? green : brown);
      h.position.set(0.2, 0.14, 0);
      const k = new THREE.Mesh(beak, orange);
      k.position.set(0.29, 0.13, 0);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 5).rotateZ(Math.PI / 2 + 0.5), drake ? grey : brown);
      tail.position.set(-0.24, 0.07, 0);
      d.add(b, h, k, tail);
      d.scale.setScalar(i === 1 ? 0.7 : 1);
      room.add(d);
      return { d, x0: f * W, z: shore + 0.75 + (i % 2) * 0.35, ph: i * 1.7, sp: 0.22 + (i % 3) * 0.05, span: span * W };
    });
    return {
      tick(dt, t) {
        mist.tick(dt, t);
        for (const q of ducks) {
          const a = t * q.sp + q.ph;
          const x = q.x0 + Math.sin(a) * q.span;
          const z = q.z + Math.sin(a * 0.7) * 0.15;
          // facing the way it paddles, and bobbing on the ruffle
          const vx = Math.cos(a) * q.span * q.sp;
          const vz = Math.cos(a * 0.7) * 0.1 * q.sp;
          q.d.position.set(x, -0.04 + Math.sin(t * 2.3 + q.ph) * 0.018, z);
          q.d.rotation.set(0, Math.atan2(-vz, vx), Math.sin(t * 2.3 + q.ph) * 0.05);
        }
      },
    };
  },
  flame: ['O'],
  spit: true,
};
