// Shoney's from outside, for ./street.js, as "The Rickshank Rickdemption"
// has it: pale yellow walls, a dark brown roof trimmed in red, red and white
// awnings over the windows, glass doors under a gable with the name on it, a
// tall sign on a pole; the Meshy model fitted over rules.js's DINER footprint
// (or a stand-in to the same lines). In front, its parking lot: asphalt with
// white lines, the two cars rules.js parks there, and the roadside sign by
// the sidewalk where a house would have its mailbox.

import * as THREE from 'three';
import { DECOR, DINER, ROAD } from './rules';
import { at, fitModel } from './kit';
import { fitText } from './interiors/shell';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const WALK = ROAD.w / 2 + ROAD.sidewalk;
const YELLOW = 0xf0dc86;
const RED = 0xb8262c;
const ROOF = 0x4a3426;

// b: the street's batch; mats: the kit's materials
export function shoneys(b, mats, model) {
  const group = new THREE.Group();
  group.name = 'shoneys';
  const x0 = DINER.x - DINER.w / 2;
  const x1 = DINER.x + DINER.w / 2;
  const z0 = DINER.z - DINER.d / 2;
  const front = DINER.z + DINER.d / 2;
  const name = sign(mats);
  if (model) {
    // the model's own blank sign on its pole stands at its west end: the building's the rest
    const fit = fitModel(model, { x0, x1, z0, z1: front }, { ky: 1 });
    group.add(fit.holder);
    fit.holder.updateMatrixWorld(true);
    const { box } = fit;
    // the name over the doors, on the gable: found by a ray from in front, at
    // the gable's middle (the model's own units, measured off it)
    const at0 = new THREE.Vector3((box.min.x + box.max.x) / 2 + (box.max.x - box.min.x) * 0.06, box.min.y + (box.max.y - box.min.y) * 0.46, box.max.z).applyMatrix4(model.matrixWorld);
    const hit = new THREE.Raycaster(new THREE.Vector3(at0.x, at0.y, front + 6), new THREE.Vector3(0, 0, -1)).intersectObject(model, true)[0];
    if (hit) board(group, name, at0.x, at0.y + 0.05, hit.point.z + 0.04, 1.9, 0.46);
  } else standIn(b, mats, group, name, { x0, x1, z0, front });

  // ── the lot ──
  const tar = mats.toon(0x5d6066);
  const paint = mats.toon(0xf2efe6);
  b.add(BOX, tar, at(DINER.x, 0.012, (front + -WALK) / 2, 0, DINER.w + 3, 0.024, -WALK - front));
  // the bays, either side of the way to the door
  for (const x of [x0 + 0.6, x0 + 3.2, x0 + 5.4, DINER.x + 0.6 + 1.2, x1 - 3.2, x1 - 0.6])
    b.add(BOX, paint, at(x, 0.026, front + 3.6, 0, 0.1, 0.006, 4.4));
  // the cars, where rules.js parks them
  for (const d of DECOR.filter((o) => o.kind === 'car')) car(b, mats, d);
  // the roadside sign
  const s = DECOR.find((d) => d.id === 'shoneys-sign');
  if (s) {
    b.add(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 10), mats.toon(0x8a9096), at(s.x, 2.6, s.z));
    b.add(BOX, mats.toon(RED), at(s.x, 5.6, s.z, 0, 3.1, 1.5, 0.36));
    for (const side of [-1, 1]) board(group, name, s.x, 5.6, s.z + side * 0.19, 2.8, 1.25, side < 0 ? Math.PI : 0);
  }
  return { group };
}

// the name as the sign has it: red letters on yellow, a red frame
function sign(mats) {
  return mats.painted('shoneys-name', 512, 224, (g, w, h) => {
    g.fillStyle = '#b8262c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6e04a';
    g.fillRect(16, 16, w - 32, h - 32);
    fitText(g, 'SHONEY’S', w / 2, h / 2 + 6, w - 72, 120, { color: '#c8262e', font: 'Georgia, serif', weight: '900' });
  });
}
function board(group, mat, x, y, z, w, h, ry = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  p.position.set(x, y, z);
  p.rotation.y = ry;
  group.add(p);
}

// a car in the lot: a body, a cabin, its windows, four wheels, nose to the diner
function car(b, mats, d) {
  const paint = mats.toon(d.tint);
  const glass = mats.toon(0x9cc6d8);
  const dark = mats.toon(0x1a1b1e);
  b.add(BOX, paint, at(d.x, 0.55, d.z, 0, d.w - 0.1, 0.55, d.d));
  b.add(BOX, paint, at(d.x, 1.0, d.z + 0.3, 0, d.w - 0.3, 0.45, d.d * 0.5));
  b.add(BOX, glass, at(d.x, 1.02, d.z + 0.3, 0, d.w - 0.26, 0.34, d.d * 0.46));
  const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(wheel, dark, at(d.x + sx * (d.w / 2 - 0.12), 0.34, d.z + sz * (d.d / 2 - 0.8)));
  wheel.dispose();
}

// Shoney's in shapes: the walls, the hip roof trimmed red, the gable over the
// doors, the doors and the windows with their awnings
function standIn(b, mats, group, name, { x0, x1, z0, front }) {
  const wall = mats.toon(YELLOW);
  const roof = mats.toon(ROOF);
  const red = mats.toon(RED);
  const w = x1 - x0;
  const d = front - z0;
  const cx = (x0 + x1) / 2;
  b.add(BOX, wall, at(cx, 1.6, z0 + d / 2, 0, w, 3.2, d));
  b.add(BOX, red, at(cx, 3.25, z0 + d / 2, 0, w + 0.5, 0.18, d + 0.5));
  b.add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.2, 2.2, 4, 1).rotateY(Math.PI / 4).scale(w / Math.hypot(w, d), 1, d / Math.hypot(w, d)), roof, at(cx, 4.4, z0 + d / 2));
  b.add(BOX, mats.toon(0x9cc6d8), at(cx, 1.1, front + 0.02, 0, 1.8, 2.2, 0.06));
  for (const s of [-1, 1]) {
    b.add(BOX, mats.toon(0x9cc6d8), at(cx + s * 3.6, 1.4, front + 0.02, 0, 3.4, 1.4, 0.06));
    b.add(BOX, red, at(cx + s * 3.6, 2.35, front + 0.4, 0, 3.6, 0.08, 0.9, 0.35));
  }
  board(group, name, cx, 2.9, front + 0.06, 3, 0.75);
}
