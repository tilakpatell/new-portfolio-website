// The Prancing Pony's kitchen: flagstones, plaster and timber, firelit,
// with pans and herbs hung over the back counters, hams and onions by the
// ovens, and a window on Bree's rainy night with the cat on its sill (and
// its fiddle: there is an inn, a merry old inn…). The shared stations
// (./common.js) are the Pony's own.

import * as THREE from 'three';
import { B, ball, cyl } from '../../shire/props';
import { sharpen } from '../../../../lib/three/textures';

export const INN = {
  sky: { background: 0x1a120c, fog: [0x1a120c, 18, 44], hemi: [0xffe2b8, 0x3a2414, 1.25], sun: [0xffe0b0, 2.2] },
  setup: () => ({ ham: new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.7 }), onion: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.6 }) }),
  room({ bk, mats, W, D, Z, wallH }, { ham: hamMat, onion }) {
    // flagstones underfoot, so the counters stand out from the floor
    bk.add(mats.ashlar, B(W + 2, 0.1, D + 2), { p: [0, -0.05, 0.5], uv: 0.45 });
    bk.add(mats.plaster, B(W + 2, wallH, 0.2), { p: [0, wallH / 2, Z(0) - 0.1], uv: 0.5 });
    for (const s of [-1, 1]) bk.add(mats.plaster, B(0.2, wallH, D + 1), { p: [s * (W / 2 + 0.1), wallH / 2, 0], uv: 0.5 });
    // beams and panelling on the back wall
    for (let x = -W / 2; x <= W / 2; x += 2) bk.add(mats.timber, B(0.22, wallH, 0.12), { p: [x, wallH / 2, Z(0) + 0.02], uv: 1 });
    bk.add(mats.timber, B(W + 2, 0.18, 0.14), { p: [0, wallH - 0.4, Z(0) + 0.03], uv: 1 });
    bk.add(mats.timber, B(W + 2, 0.12, 0.12), { p: [0, 1.25, Z(0) + 0.03], uv: 1 });
    for (const s of [-1, 1]) bk.add(mats.timber, B(0.12, 0.18, D + 1), { p: [s * (W / 2 + 0.02), wallH - 0.4, 0], uv: 1 });
    // hanging pans and herbs over the back counters
    for (let x = -W / 2 + 1.5; x < W / 2 - 1; x += 2.6) {
      bk.add(mats.iron, cyl(0.16, 0.12, 0.05, 12), { p: [x, 2.0, Z(0) + 0.18], r: [Math.PI / 2, 0, 0] });
      bk.add(mats.iron, B(0.03, 0.22, 0.03), { p: [x, 2.22, Z(0) + 0.14] });
      bk.add(mats.wheat, cyl(0.06, 0.02, 0.36, 5), { p: [x + 1.1, 2.15, Z(0) + 0.16], color: 0x9aa060 });
    }
    // hams and strings of onions, hung by the ovens
    for (const [x, ham] of [[W / 2 - 2.2, 1], [W / 2 - 1.5, 0], [W / 2 - 0.8, 1]]) {
      bk.add(mats.rope, cyl(0.008, 0.008, 0.3, 4), { p: [x, 2.35, Z(0) + 0.2] });
      if (ham) bk.add(hamMat, ball(0.13, 9, 7), { p: [x, 2.08, Z(0) + 0.2], s: [0.8, 1.3, 0.8] });
      else for (let k = 0; k < 4; k++) bk.add(onion, ball(0.05, 6, 5), { p: [x, 2.15 - k * 0.09, Z(0) + 0.2] });
    }
  },
  extras({ room, Z }) {
    // a window on Bree's night, rain running down it, and the cat on the sill
    const x = -1.2;
    const z = Z(0) + 0.02;
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#16203a';
    g.fillRect(0, 0, 64, 128);
    for (let n = 0; n < 50; n++) {
      g.strokeStyle = `rgba(170, 190, 230, ${0.15 + Math.random() * 0.3})`;
      g.beginPath();
      const rx = Math.random() * 64;
      const ry = Math.random() * 128;
      g.moveTo(rx, ry);
      g.lineTo(rx - 2, ry + 10 + Math.random() * 10);
      g.stroke();
    }
    const rain = new THREE.CanvasTexture(cv);
    sharpen(rain);
    rain.colorSpace = THREE.SRGBColorSpace;
    rain.wrapT = THREE.RepeatWrapping;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), new THREE.MeshBasicMaterial({ map: rain }));
    pane.position.set(x, 1.85, z);
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
    const frame = new THREE.Group();
    for (const [w, h, fx, fy] of [[1.0, 0.07, 0, 0.43], [1.0, 0.07, 0, -0.43], [0.07, 0.9, 0.48, 0], [0.07, 0.9, -0.48, 0], [0.04, 0.8, 0, 0], [0.9, 0.04, 0, 0]]) {
      const bar = new THREE.Mesh(B(w, h, 0.06), wood);
      bar.position.set(x + fx, 1.85 + fy, z + 0.02);
      frame.add(bar);
    }
    const sill = new THREE.Mesh(B(1.1, 0.06, 0.24), wood);
    sill.position.set(x, 1.4, z + 0.1);
    // the cat: tabby, curled up, tail round; its fiddle by it
    const fur = new THREE.MeshStandardMaterial({ color: 0xb07a3a, roughness: 1 });
    const cat = new THREE.Group();
    const body = new THREE.Mesh(ball(0.12, 10, 8), fur);
    body.scale.set(1.3, 0.75, 0.9);
    const head = new THREE.Mesh(ball(0.075, 10, 8), fur);
    head.position.set(0.13, 0.05, 0.04);
    for (const ez of [-0.035, 0.035]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), fur);
      ear.position.set(0.14, 0.12, 0.04 + ez);
      cat.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 5, 14, Math.PI * 1.2), fur);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(-0.02, -0.04, 0.02);
    cat.add(body, head, tail);
    cat.position.set(x - 0.22, 1.5, z + 0.13);
    const varnish = new THREE.MeshStandardMaterial({ color: 0x8a3a12, roughness: 0.3 });
    const fiddle = new THREE.Group();
    for (const [fy, r] of [[0, 0.07], [0.1, 0.055]]) {
      const half = new THREE.Mesh(ball(r, 10, 8), varnish);
      half.scale.set(1, 1, 0.35);
      half.position.y = fy;
      fiddle.add(half);
    }
    const neck = new THREE.Mesh(B(0.025, 0.16, 0.02), wood);
    neck.position.y = 0.22;
    fiddle.add(neck);
    fiddle.position.set(x + 0.28, 1.5, z + 0.1);
    fiddle.rotation.z = -0.25;
    room.add(pane, frame, sill, cat, fiddle);
    return {
      tick(dt, t) {
        rain.offset.y += dt * 0.5;
        // (the cat breathes, and now and then flicks an ear)
        body.scale.y = 0.75 + Math.sin(t * 1.6) * 0.03;
        head.rotation.z = Math.sin(t * 0.4) > 0.97 ? 0.2 : 0;
      },
    };
  },
};
