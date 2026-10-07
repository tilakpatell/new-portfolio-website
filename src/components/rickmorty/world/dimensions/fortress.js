// Rick Prime's fortress ("Rickmurai Jack", "Unmortricken"): a cold grey
// hangar with ribbed steel walls and a grated floor, lit from strips in the
// ceiling. The Omega Device stands on a plinth in the middle, a black sphere
// in a cage of gold rings turning slowly, lit red from inside. Along the west
// wall the tanks of his spares, a half-made Rick floating in each. At the
// far end the console, Rick Prime at it till Morty gets there: then he's
// gone (`until: 'fortress'`), and a portal's swirl hangs where he stood for a
// few seconds (the area's 'gone').

import * as THREE from 'three';
import { BALL, BOX, CYL, fitText } from '../interiors/shell';
import { stage } from './stage';

const LIGHT = { sun: [0xdfe8ff, 0.9], hemi: [0xc8d8f0, 0x3a3e4a, 2.3], fog: null, background: 0x0a0c12 };
const STEEL = 0x5a6070;
const DARK = 0x2a2e38;
const GOLD = 0xd8b25a;

// a grated floor: dark plates with a grid of lighter bars
const GRATE = (g, w, h) => {
  g.fillStyle = '#3a3e48';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#4e5464';
  g.lineWidth = 3;
  for (let i = 0; i <= w; i += w / 8) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, h);
    g.moveTo(0, i);
    g.lineTo(w, i);
    g.stroke();
  }
};

export async function buildFortress(kit) {
  const S = stage(kit, 'fortress', { floor: GRATE, floorTile: 4, wall: STEEL, ceiling: DARK, skirt: DARK });
  const { R, P, A } = S;
  const H = S.d.ceiling;
  const W = A.x1 - A.x0;
  const L = A.z1 - A.z0;

  // ribs up the walls, and strip lights across the ceiling
  for (let dz = -16; dz <= 16; dz += 4) for (const x of [A.x0 + 0.2, A.x1 - 0.2]) R.frame(x, P(0, dz)[1], 0, { list: 'fixed' }).box(DARK, 0, 0, 0, 0.4, H, 0.6);
  for (let dx = -18; dx <= 18; dx += 4) for (const z of [A.z0 + 0.2, A.z1 - 0.2]) R.frame(P(dx, 0)[0], z, 0, { list: 'fixed' }).box(DARK, 0, 0, 0, 0.6, H, 0.4);
  for (let dz = -14; dz <= 14; dz += 7) R.frame(...P(0, dz), 0, { list: 'fixed' }).box(DARK, 0, H - 0.4, 0, W - 1, 0.3, 0.6).glow(BOX, 0xdfe8ff, 1.5, 0, H - 0.44, 0, 0, W - 2, 0.04, 0.3);

  // the Omega Device: a plinth, a black sphere, three gold rings about it, a red core
  const [ox, oz] = P(5, -4);
  const base = R.frame(ox, oz, 0);
  base.cyl(DARK, 0, 0, 0, 1.5, 0.4).cyl(STEEL, 0, 0.4, 0, 1.1, 0.8).cyl(GOLD, 0, 1.2, 0, 0.5, 0.1);
  for (let k = 0; k < 8; k++) base.glow(BALL, 0xff3a2a, 1.6, Math.cos((k / 8) * Math.PI * 2) * 1.3, 0.42, Math.sin((k / 8) * Math.PI * 2) * 1.3, 0, 0.12);
  const omega = new THREE.Group();
  omega.position.set(ox, 2.3, oz);
  const sphere = new THREE.Mesh(BALL, R.own(new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.35, metalness: 0.6 })));
  sphere.scale.setScalar(1.4);
  omega.add(sphere);
  const coreMat = R.own(new THREE.MeshBasicMaterial({ color: 0xff3a2a }));
  const core = new THREE.Mesh(BALL, coreMat);
  core.scale.setScalar(0.5);
  omega.add(core);
  const ringGeo = R.own(new THREE.TorusGeometry(1.1, 0.05, 8, 48));
  const ringMat = R.own(new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.4, metalness: 0.8 }));
  const rings = [0, 1, 2].map((i) => {
    const r = new THREE.Mesh(ringGeo, ringMat);
    r.scale.setScalar(1 + i * 0.18);
    omega.add(r);
    return r;
  });
  R.add(omega);
  // the device's name on the plinth
  R.cell('omega-plate', 128, 32, (g, w, h) => {
    g.fillStyle = '#d8b25a';
    g.fillRect(0, 0, w, h);
    fitText(g, 'OMEGA', w / 2, h / 2, w - 10, 18, { color: '#2a1a0a' });
  });
  base.decal('omega-plate', 0, 0.8, 1.11, 0.9, 0.22);

  // the tanks along the west wall: glass tubes on dark bases, a Rick in each, lit cyan
  const tubeMat = R.own(new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.22, depthWrite: false }));
  const tubeGeo = R.own(new THREE.CylinderGeometry(0.95, 0.95, 3, 20, 1, true));
  const ricks = [];
  for (const dz of [-10, -6, -2, 2, 6, 10]) {
    const [x, z] = P(-18.2, dz);
    const f = R.frame(x, z, 0);
    f.cyl(DARK, 0, 0, 0, 1.1, 0.5).cyl(DARK, 0, 3.5, 0, 1.1, 0.4).glow(CYL, 0x6ad8ff, 1.3, 0, 0.5, 0, 0, 2, 0.02, 2);
    for (let k = 0; k < 3; k++) f.glow(BALL, k ? 0x6aff8a : 0xff5a3a, 1.5, -0.6 + k * 0.6, 3.95, 0.9, 0, 0.08);
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(x, 2, z);
    R.add(tube, { ink: false });
    // the spare: a pale figure in a lab coat, eyes shut, floating
    const rick = new THREE.Group();
    const skin = R.own(new THREE.MeshStandardMaterial({ color: 0xc8d8e0, roughness: 0.9 }));
    const coat = R.own(new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.9 }));
    const hair = R.own(new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: 0.9 }));
    const b = new THREE.Mesh(BOX, coat);
    b.scale.set(0.5, 0.9, 0.3);
    b.position.y = 1.15;
    const h = new THREE.Mesh(BALL, skin);
    h.scale.set(0.34, 0.42, 0.34);
    h.position.y = 1.85;
    const hr = new THREE.Mesh(BOX, hair);
    hr.scale.set(0.4, 0.3, 0.3);
    hr.position.set(0, 2.1, -0.04);
    const legs = new THREE.Mesh(BOX, R.own(new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 })));
    legs.scale.set(0.42, 0.7, 0.28);
    legs.position.y = 0.35;
    rick.add(b, h, hr, legs);
    rick.position.set(x, 0.55, z);
    R.add(rick, { ink: false });
    ricks.push(rick);
  }

  // the console at the far end, his, the screens green on black
  const [cx, cz] = P(0, -14);
  const C = R.frame(cx, cz, 0);
  C.box(DARK, 0, 0, 0, 7, 1.1, 1.6).box(STEEL, 0, 1.1, 0, 7.1, 0.08, 1.7);
  C.box(0x0a0a10, 0, 1.2, -0.5, 6.4, 1.6, 0.14, 0, -0.35);
  C.glow(BOX, 0x4aff7a, 1.3, 0, 1.6, -0.42, 0, 6, 1.2, 0.02, -0.35);
  for (let k = 0; k < 10; k++) C.glow(BALL, k % 3 ? 0x4aff7a : 0xff5a3a, 1.6, -2.7 + k * 0.6, 1.16, 0.5, 0, 0.08);
  // the big screen on the north wall over it: the Curve, and the dimensions he's done with
  R.cell('prime-screen', 256, 128, (g, w, h) => {
    g.fillStyle = '#060a08';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4aff7a';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w * 0.42, h * 0.38, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#4aff7a';
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      const r = 0.5 + ((k * 37) % 11) / 24;
      g.fillRect(w / 2 + Math.cos(a) * w * 0.42 * r, h / 2 + Math.sin(a) * h * 0.38 * r, 2, 2);
    }
    g.fillStyle = '#ff5a3a';
    for (let k = 0; k < 9; k++) g.fillRect(w * (0.2 + (k * 0.07) % 0.6), h * (0.3 + ((k * 0.13) % 0.4)), 4, 4);
    fitText(g, 'CENTRAL FINITE CURVE', w / 2, h - 12, w - 20, 11, { color: '#4aff7a' });
  });
  R.frame(...P(0, -(L / 2) + 0.14), 0, { list: 'fixed' }).box(0x0a0a10, 0, 2.6, 0, 10, 5, 0.1).decal('prime-screen', 0, 5.1, 0.07, 9.6, 4.6, { bright: true });
  // the picture on the east wall: a garage, a family, two faces scribbled out
  R.cell('prime-picture', 96, 72, (g, w, h) => {
    g.fillStyle = '#2a1a0a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2e2b8';
    g.fillRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#9aa0a8';
    g.fillRect(8, h * 0.3, w - 16, h * 0.6);
    const heads = ['#f2c8a0', '#f2c8a0', '#f2c8a0'];
    for (const [i, c] of heads.entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(w * (0.3 + i * 0.2), h * 0.5, 7, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    for (const i of [0, 2]) {
      const x = w * (0.3 + i * 0.2);
      g.beginPath();
      g.moveTo(x - 9, h * 0.5 - 9);
      g.lineTo(x + 9, h * 0.5 + 9);
      g.moveTo(x + 9, h * 0.5 - 9);
      g.lineTo(x - 9, h * 0.5 + 9);
      g.stroke();
    }
  });
  R.frame(A.x1 - 0.14, P(0, -8)[1], -Math.PI / 2, { list: 'fixed' }).decal('prime-picture', 0, 1.9, 0.06, 1.2, 0.9);
  // crates in the south-east corner
  R.frame(...P(14, 10), 0.2).box(STEEL, 0, 0, 0, 2.4, 1.6, 2.4).box(DARK, 0, 1.6, 0, 2.5, 0.1, 2.5);
  R.frame(...P(16.6, 8), -0.3).box(STEEL, 0, 0, 0, 1.8, 1.2, 1.8);

  // the swirl where he stood, for when he's gone
  const swirlMat = R.own(kit.portal());
  const swirl = new THREE.Mesh(R.own(new THREE.PlaneGeometry(2.6, 3)), swirlMat);
  swirl.position.set(cx, 1.6, cz + 1.6);
  swirl.visible = false;
  R.add(swirl, { ink: false });

  S.people();
  let goneAt = null;
  const area = S.done(LIGHT, (t, dt, state, camera) => {
    omega.rotation.y = t * 0.3;
    rings[0].rotation.x = t * 0.7;
    rings[1].rotation.y = t * 0.5;
    rings[2].rotation.z = t * 0.4;
    coreMat.color.setHex(Math.sin(t * 3) > 0 ? 0xff3a2a : 0xaa1a10);
    for (const [i, r] of ricks.entries()) r.position.y = 0.55 + Math.sin(t * 0.8 + i) * 0.12;
    if (goneAt != null) {
      const age = t - goneAt;
      swirl.visible = age < 5;
      swirlMat.uniforms.t.value = t;
      swirlMat.uniforms.open.value = age < 4 ? 1 : Math.max(0, 5 - age);
      if (camera) swirl.rotation.y = Math.atan2(camera.position.x - swirl.position.x, camera.position.z - swirl.position.z);
    }
  });
  let now = 0;
  R.tick((t) => (now = t));
  area.actions = {
    gone: () => {
      goneAt = now;
    },
    calm: () => {},
  };
  return area;
}
