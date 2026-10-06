// Outside, off the loading dock: the back of the Scranton Business Park
// building (white, two storeys, dark ribbon windows), its parking lot (worn
// asphalt, white stall lines, curbs, light poles, a few trees), the cars of
// the people inside it (a red Trans Am among them), the dumpster where
// people go to talk to the camera, and the park's sign at the lot's front.
// Under a pale, overcast Pennsylvania sky.
//
// buildOutside() → { group, dispose }

import * as THREE from 'three';
import { merge } from '../kit';
import { CARS, DUMPSTER, LIGHT_POLES, LOT, PARK_SIGN, TREES, WAREHOUSE } from './layout';
import { sharpen } from '../../../lib/three/textures';
import { makeCars } from './cars';
import { buildScenery, makeTree } from './scenery';

function asphaltTex() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#5d5e5c';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const g = 70 + Math.random() * 70;
    x.fillStyle = `rgba(${g},${g},${g - 4},${Math.random() * 0.35})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6);
  }
  x.strokeStyle = 'rgba(30,30,30,0.35)';
  x.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    let px = Math.random() * 512;
    let py = Math.random() * 512;
    x.moveTo(px, py);
    for (let k = 0; k < 6; k++) {
      px += (Math.random() - 0.5) * 60;
      py += (Math.random() - 0.5) * 60;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  sharpen(t);
  return t;
}
function signTex() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#3d5a7a';
  x.fillRect(0, 0, 1024, 512);
  x.strokeStyle = '#e9e4d6';
  x.lineWidth = 10;
  x.strokeRect(18, 18, 988, 476);
  x.fillStyle = '#f4f1e8';
  x.textAlign = 'center';
  x.font = 'bold 92px Georgia, "Times New Roman", serif';
  x.fillText('SCRANTON', 512, 140);
  x.font = 'bold 64px Georgia, "Times New Roman", serif';
  x.fillText('BUSINESS PARK', 512, 220);
  x.fillStyle = '#e9e4d6';
  x.fillRect(120, 252, 784, 4);
  x.font = '40px Arial, Helvetica, sans-serif';
  ['Dunder Mifflin Paper Co.', 'Vance Refrigeration', 'Suite 100–300'].forEach((l, i) => x.fillText(l, 512, 318 + i * 56));
  x.font = 'bold 34px Arial, Helvetica, sans-serif';
  x.fillText('1725 SLOUGH AVENUE', 512, 486);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildOutside() {
  const group = new THREE.Group();
  const own = [];
  const keep = (x) => {
    own.push(x);
    return x;
  };
  const mat = (o) => keep(new THREE.MeshStandardMaterial(o));
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = group) => {
    const o = new THREE.Mesh(keep(geo), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const cx = LOT.x + LOT.w / 2;
  const cz = LOT.z + LOT.d / 2;

  // the sky, the tree line on the horizon (./scenery.js), and the land beyond the lot
  const scenery = buildScenery({ centre: { x: cx, z: cz } });
  group.add(scenery.group);
  const grass = mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), mat({ color: 0x7c8a5a, roughness: 1 }), cx, -0.02, cz);
  grass.castShadow = false;

  // ── the lot ──
  const at = keep(asphaltTex());
  at.repeat.set(LOT.w / 6, LOT.d / 6);
  const lot = mesh(new THREE.PlaneGeometry(LOT.w, LOT.d).rotateX(-Math.PI / 2), mat({ map: at, roughness: 0.92 }), cx, 0.005, cz);
  lot.castShadow = false;
  {
    // stall lines, in two double rows, and the curbs round the edge
    const lines = [];
    for (const rowX of [62, 72, 78])
      for (let z = LOT.z + 2; z <= LOT.z + LOT.d - 2; z += 3.4) lines.push(new THREE.BoxGeometry(5, 0.004, 0.1).translate(rowX, 0.01, z));
    const m = mesh(keep(merge(lines)), mat({ color: 0xf2f0ea, roughness: 0.7 }));
    m.castShadow = false;
    const curbs = [];
    curbs.push(new THREE.BoxGeometry(LOT.w, 0.15, 0.3).translate(cx, 0.075, LOT.z));
    curbs.push(new THREE.BoxGeometry(LOT.w, 0.15, 0.3).translate(cx, 0.075, LOT.z + LOT.d));
    curbs.push(new THREE.BoxGeometry(0.3, 0.15, LOT.d).translate(LOT.x + LOT.w, 0.075, cz));
    mesh(keep(merge(curbs)), mat({ color: 0xbdb9ad, roughness: 0.9 }));
    // the planted strip by the road, past the curb
    const strip = mesh(new THREE.PlaneGeometry(4, LOT.d).rotateX(-Math.PI / 2), mat({ color: 0x6f8a4a, roughness: 1 }), LOT.x + LOT.w + 2, 0.01, cz);
    strip.castShadow = false;
  }

  // ── the building's back: white, two storeys, dark ribbon windows ──
  {
    const white = mat({ color: 0xece9e1, roughness: 0.85 });
    const glass = mat({ color: 0x1d2630, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.2 });
    const X = LOT.x + 0.16;
    const parts = [];
    const glazing = [];
    const piece = (z0, z1, y0, y1) => parts.push(new THREE.BoxGeometry(0.3, y1 - y0, z1 - z0).translate(X, (y0 + y1) / 2, (z0 + z1) / 2));
    const band = (z0, z1, y0, y1) => glazing.push(new THREE.BoxGeometry(0.06, y1 - y0, z1 - z0).translate(X + 0.17, (y0 + y1) / 2, (z0 + z1) / 2));
    const wz0 = WAREHOUSE.z;
    const wz1 = WAREHOUSE.z + WAREHOUSE.d;
    // the wings either side of the warehouse, full height
    piece(LOT.z - 6, wz0, 0, 8.2);
    piece(wz1, LOT.z + LOT.d + 6, 0, 8.2);
    // over the dock doors, and between them
    piece(wz0, wz1, 3.6, 8.2);
    const doors = [cz - 3.5, cz + 3.5];
    piece(wz0, doors[0] - 1.6, 0, 3.6);
    piece(doors[0] + 1.6, doors[1] - 1.6, 0, 3.6);
    piece(doors[1] + 1.6, wz1, 0, 3.6);
    // ribbon windows: the office floor upstairs, all the way along; the wings downstairs too
    band(LOT.z - 5, LOT.z + LOT.d + 5, 4.9, 6.4);
    band(LOT.z - 5, wz0 - 0.6, 1.2, 2.6);
    band(wz1 + 0.6, LOT.z + LOT.d + 5, 1.2, 2.6);
    mesh(keep(merge(parts)), white);
    mesh(keep(merge(glazing)), glass).castShadow = false;
    // the parapet's dark cap, and the mullions
    mesh(new THREE.BoxGeometry(0.4, 0.2, LOT.d + 12), mat({ color: 0x5a5d61, roughness: 0.6 }), X, 8.3, cz);
    const mull = [];
    for (let z = LOT.z - 5; z <= LOT.z + LOT.d + 5; z += 1.6) {
      mull.push(new THREE.BoxGeometry(0.08, 1.5, 0.06).translate(X + 0.2, 5.65, z));
      if (z < wz0 - 0.6 || z > wz1 + 0.6) mull.push(new THREE.BoxGeometry(0.08, 1.4, 0.06).translate(X + 0.2, 1.9, z));
    }
    mesh(keep(merge(mull)), mat({ color: 0xbfc2c4, roughness: 0.4, metalness: 0.6 })).castShadow = false;
    // the dock's canopy
    mesh(new THREE.BoxGeometry(2.4, 0.15, WAREHOUSE.d - 2), mat({ color: 0x8e9196, roughness: 0.5, metalness: 0.5 }), X + 1.2, 4.2, cz);
  }

  // ── the parked cars (./cars.js) ──
  const cars = makeCars();
  for (const [x, z, turn, colour, kind] of CARS) {
    const car = cars.car(kind, colour);
    car.position.set(x, 0, z);
    car.rotation.y = turn;
    group.add(car);
  }

  // ── the park's sign: a stone base, the blue panel ──
  {
    const g = new THREE.Group();
    g.position.set(PARK_SIGN.x, 0, PARK_SIGN.z);
    g.rotation.y = PARK_SIGN.turn;
    group.add(g);
    const stone = mat({ color: 0xc8bfa8, roughness: 0.95 });
    mesh(new THREE.BoxGeometry(3.6, 0.5, 0.7), stone, 0, 0.25, 0, g);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.35, 2.1, 0.6), stone, s * 1.7, 1.05, 0, g);
    const tex = keep(signTex());
    const panel = mesh(new THREE.BoxGeometry(3.1, 1.55, 0.18), [mat({ color: 0x3d5a7a }), mat({ color: 0x3d5a7a }), mat({ color: 0x3d5a7a }), mat({ color: 0x3d5a7a }), mat({ map: tex, roughness: 0.5 }), mat({ map: tex, roughness: 0.5 })], 0, 1.3, 0, g);
    panel.castShadow = true;
    // shrubs round its foot
    const shrub = mat({ color: 0x4f6b34, roughness: 1 });
    for (let i = -2; i <= 2; i++) mesh(new THREE.SphereGeometry(0.35, 10, 8), shrub, i * 0.7, 0.25, 0.7, g).scale.set(1, 0.7, 1);
  }

  // ── light poles, trees, the dumpster ──
  {
    const pole = mat({ color: 0x4a4d52, roughness: 0.5, metalness: 0.6 });
    for (const [x, z] of LIGHT_POLES) {
      mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 10), pole, x, 3.75, z);
      mesh(new THREE.BoxGeometry(0.9, 0.18, 0.4), pole, x + 0.4, 7.5, z);
      mesh(new THREE.BoxGeometry(0.6, 0.02, 0.3), mat({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 0.6 }), x + 0.5, 7.4, z).castShadow = false;
      mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 12), mat({ color: 0xbdb9ad, roughness: 0.9 }), x, 0.25, z);
    }
    // the trees, each grown from its own seed
    const bark = mat({ color: 0x55463a, roughness: 0.95 });
    const leaves = mat({ color: 0xffffff, vertexColors: true, roughness: 0.9 });
    TREES.forEach(([x, z], i) => {
      const t = makeTree(i);
      const turn = i * 1.7;
      for (const [geo, m] of [
        [t.bark, bark],
        [t.leaves, leaves],
      ]) {
        const o = mesh(geo, m, x, 0, z);
        o.rotation.y = turn;
      }
    });
    const d = DUMPSTER;
    mesh(new THREE.BoxGeometry(d.w, 1.25, d.d), mat({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), d.x, 0.7, d.z);
    mesh(new THREE.BoxGeometry(d.w + 0.06, 0.06, d.d + 0.1).rotateX(-0.12), mat({ color: 0x1a1a1a, roughness: 0.7 }), d.x, 1.36, d.z);
  }

  return {
    group,
    step: scenery.step,
    dispose() {
      cars.dispose();
      scenery.dispose();
      for (const o of own) o.dispose?.();
    },
  };
}
