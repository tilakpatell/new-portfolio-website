// The agency ("Pickle Rick"): the embassy's security floor in grey steel
// and glass, a desk of screens with Pickle Rick sitting on it (the cast's
// pickle, a model), Jaguar's cell with its bars, pillars and crates for
// cover, a key on a hook under a sign, and the hole into the sewer with the
// rats about it. The guards walk their rounds and the rats theirs
// (./destinations.js). Unlocking the cell ('unlocked') swings its door.

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xf0f4ff, 0.85], hemi: [0xdfe8f0, 0x3a3e44, 1.8], fog: null, background: 0x0c0e12 };
const STEEL = 0x5a6068;
const DARK = 0x2a2e34;

export async function buildAgency(kit) {
  const S = stage(kit, 'agency', { floor: specks('#4a4e56', ['#444850', '#50545c'], 15, 900, 2), floorTile: 3, wall: STEEL, ceiling: DARK, skirt: DARK });
  const { R, P, A } = S;
  const H = S.d.ceiling;
  const W = A.x1 - A.x0;

  for (let dz = -14; dz <= 14; dz += 7) R.frame(...P(0, dz), 0, { list: 'fixed' }).box(DARK, 0, H - 0.3, 0, W - 1, 0.2, 0.4).glow(BOX, 0xffffff, 1.2, 0, H - 0.34, 0, 0, W - 2, 0.04, 0.2);
  // the desk of screens, Pickle Rick's (he sits on it: the data lifts him)
  const [dx, dz] = P(-2, -16);
  R.frame(dx, dz, 0).box(DARK, 0, 0, 0, 6, 1.0, 1.6).box(STEEL, 0, 1, 0, 6.1, 0.06, 1.7);
  R.cell('agencyscreens', 256, 96, (g, w, h) => {
    g.fillStyle = '#060608';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k === 5 ? '#4a8a3a' : '#2a3a4a';
      g.fillRect(6 + (k % 4) * 62, 6 + Math.floor(k / 4) * 44, 56, 38);
      g.fillStyle = '#9ab8c8';
      g.fillRect(10 + (k % 4) * 62, 12 + Math.floor(k / 4) * 44, 48, 3);
      g.fillRect(10 + (k % 4) * 62, 22 + Math.floor(k / 4) * 44, 30, 3);
    }
    fitText(g, 'ПИКЛ', 6 + 5 * 62 - 215, 6 + 44 + 30, 40, 9, { color: '#d8ff80' });
  });
  R.frame(...P(-2, -(A.z1 - A.z0) / 2 + 0.14), 0, { list: 'fixed' }).box(0x060608, 0, 1.6, 0, 8, 3, 0.1).decal('agencyscreens', 0, 3.1, 0.07, 7.8, 2.8, { bright: true });
  // Jaguar's cell: bars on three sides and a door that swings when unlocked
  const [cx, cz] = P(17, -12);
  const C = R.frame(cx, cz, 0);
  C.box(DARK, 0, 0, 0, 5, 0.2, 5).box(DARK, 0, 3, 0, 5, 0.2, 5);
  for (let u = -2.4; u <= 2.4; u += 0.4) {
    C.cyl(0x9aa0a8, u, 0.2, -2.4, 0.04, 2.8);
    if (u < -1.0 || u > 0.6) C.cyl(0x9aa0a8, u, 0.2, 2.4, 0.04, 2.8);
  }
  for (let v = -2.0; v <= 2.0; v += 0.4) C.cyl(0x9aa0a8, -2.4, 0.2, v, 0.04, 2.8);
  const door = new THREE.Group();
  const barMat = R.own(new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.6 }));
  const barGeo = R.own(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8));
  for (let u = 0; u <= 1.6; u += 0.4) {
    const b = new THREE.Mesh(barGeo, barMat);
    b.position.set(u, 1.6, 0);
    door.add(b);
  }
  door.position.set(cx - 1.0, 0, cz + 2.4);
  R.add(door);
  // the key on its hook, under the sign
  R.cell('donot', 64, 32, (g, w, h) => {
    g.fillStyle = '#c83a3a';
    g.fillRect(0, 0, w, h);
    fitText(g, 'DO NOT', w / 2, h / 2, w - 8, 14, { color: '#ffffff' });
  });
  const [kx, kz] = P(-16.4, -2);
  R.frame(kx, kz, Math.PI / 2).box(DARK, 0, 0.9, 0, 1, 0.6, 0.1).decal('donot', 0, 1.7, 0.08, 0.8, 0.4).cyl(0xd8b25a, 0, 1.0, 0.1, 0.02, 0.2);
  const keyMat = R.own(new THREE.MeshBasicMaterial({ color: 0xd8b25a }));
  const key = new THREE.Mesh(R.own(new THREE.TorusGeometry(0.08, 0.02, 6, 12)), keyMat);
  key.position.set(kx + 0.12, 1.0, kz);
  R.add(key, { ink: false });
  // pillars, crates, the hole into the sewer
  for (const [px, pz] of [
    [-4, -2],
    [4, -2],
  ]) R.frame(...P(px, pz), 0).cyl(DARK, 0, 0, 0, 0.8, H).cyl(STEEL, 0, 0, 0, 1, 0.3);
  R.frame(...P(-10, -10), 0.1).box(STEEL, 0, 0, 0, 2.2, 1.5, 2.2).box(DARK, 0, 1.5, 0, 2.3, 0.1, 2.3);
  R.frame(...P(6, 10), -0.2).box(STEEL, 0, 0, 0, 2, 1.3, 2);
  const [hx, hz] = P(-16, 14);
  R.frame(hx, hz, 0).cyl(0x0a0a0c, 0, 0.01, 0, 1.2, 0.04).cyl(0x3a3e44, 0, 0, 0, 1.3, 0.06);
  for (let k = 0; k < 6; k++) R.frame(hx + Math.cos(k * 1.1) * 1.6, hz + Math.sin(k * 1.1) * 1.6, k, { list: 'fixed' }).box(0x8a8a90, 0, 0, 0, 0.3, 0.1, 0.12).ball(0x6a4a3a, 0.2, 0.05, 0.1, 0.06);
  // a laser grid across the east doorway, for show
  for (let y = 0.4; y <= 2.2; y += 0.45) R.frame(A.x1 - 0.6, P(0, 6)[1], 0, { list: 'fixed' }).glow(BOX, 0xff3a3a, 1.6, 0, y, 0, 0, 0.02, 0.02, 4);
  R.frame(A.x1 - 0.6, P(0, 6)[1], 0, { list: 'fixed' }).glow(BALL, 0xff3a3a, 1.8, 0, 2.5, -2.1, 0, 0.1).glow(BALL, 0xff3a3a, 1.8, 0, 2.5, 2.1, 0, 0.1);

  S.people();
  let open = false;
  const area = S.done(LIGHT, (t, dt, state) => {
    const want = open ? -1.6 : 0;
    door.rotation.y += (want - door.rotation.y) * Math.min(1, dt * 3);
    key.visible = !(state?.used ?? []).includes?.('cellkey');
  });
  area.actions = {
    ...area.actions,
    unlocked: () => {
      open = true;
    },
    calm: () => {
      open = false;
      S.calm();
    },
  };
  return area;
}
