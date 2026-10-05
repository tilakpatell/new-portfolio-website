// The Oval Office (../scene.js's AREA_BUILDERS; through the President's
// portal in Rick's garage), as "The Rickchurian Mortydate" has it: the oval
// room in cream with white panelling, pilasters and a crown moulding; three
// tall windows behind the desk hung with gold drapes; the big dark wooden
// desk with a red phone, folders and a lamp; the Stars and Stripes and the
// President's flag behind it; the blue rug with the seal; two cream couches
// facing over a coffee table; the fireplace with a portrait over it; a
// grandfather clock; doors under pediments. The President stands behind the
// desk, a general either side of it; the portal back is at the south end.
// Everything stands where rules.js's FURNITURE says, inside its RINGS ellipse.

import * as THREE from 'three';
import { FURNITURE, LINKS, PEOPLE, RINGS, RUGS } from '../rules';
import { at, rng } from '../kit';
import { BALL8, TAU, makeRoom, tiledPaint, windowView } from './shell';
import { person, toonPerson } from './people';
import { govPortal } from './govportal';
import { RUN, inward, ringAt, ringCeiling, ringFloor, ringWall } from './round';

const RING = RINGS.oval;
const H = 3.4;
const CREAM = 0xf0e6c4;
const WHITE = 0xf8f4ea;
const GOLD = 0xd8b25a;
const WOOD = 0x5a321c;
const BACK = LINKS.find((l) => l.id === 'oval-portal');
// the windows behind the desk (angles round the ring, north is 3π/2) and the
// doors, each in the middle of a run of the wall (it's drawn half a run round)
const WINDOWS = [-2, 0, 2].map((k) => 1.5 * Math.PI + k * RUN);
const DOORS = [3 * RUN, 13 * RUN];
const PHASE = RUN / 2;
const LOOKS = {
  president: { skin: 0x5a3a2a, shirt: 0xf4f4f0, coat: 0x1f2a44, pants: 0x1f2a44, shoes: 0x111111, hair: 0x2a2420, tie: 0xa83232 },
  general: { skin: 0xe8c4a0, shirt: 0xc8d8c0, coat: 0x2f3d2a, pants: 0x2f3d2a, shoes: 0x111111, hair: 0xd8c8b8, tie: 0x111111 },
};
const TALL = { president: 1.88, general: 1.82 };

export async function buildOval(kit) {
  const R = makeRoom(kit, 'oval');
  const m = kit.mats;
  paintCells(R);
  const top = R.frame(0, 0, 0, { list: 'fixed' });

  // ── the room ──
  const floor = tiledPaint(m, 'c137-oval-floor', 256, 1.6, (g, w, h) => {
    const r = rng(41);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const k = 0.9 + r() * 0.16;
      g.fillStyle = `rgb(${Math.round(196 * k)},${Math.round(150 * k)},${Math.round(98 * k)})`;
      g.fillRect(0, (i * h) / n, w, h / n);
      g.fillStyle = 'rgba(90,56,30,0.5)';
      g.fillRect(0, (i * h) / n, w, 2);
      g.fillRect(((i * 37) % 8) * (w / 8), (i * h) / n, 2, h / n);
    }
  });
  R.tiled.add(R.own(ringFloor(RING)), floor, at(0, 0, 0));
  // (the ceiling unlit, as the house's are: lit from below, it'd go brown)
  R.tiled.add(R.own(ringCeiling(RING, H)), R.own(new THREE.MeshBasicMaterial({ color: 0xebe3cc })), at(0, 0, 0));
  const runs = ringWall(top, RING, { h: H, color: CREAM, thick: 0.3, gaps: [...WINDOWS, ...DOORS, Math.PI / 2], skirt: WHITE, skirtH: 0.16, phase: PHASE });
  // the panelling: a dado rail, a crown, pilasters at every other run's end
  for (const [i, r] of runs.entries()) {
    const mid = { x: (r.a.x + r.b.x) / 2, z: (r.a.z + r.b.z) / 2 };
    const p = (d) => ({ x: mid.x + Math.sin(r.turn) * d, z: mid.z + Math.cos(r.turn) * d });
    const q = p(0.02);
    top.box(WHITE, q.x, 0.95, q.z, r.len + 0.02, 0.06, 0.05, r.ry).box(WHITE, q.x, H - 0.24, q.z, r.len + 0.02, 0.24, 0.1, r.ry);
    // a panel under the rail
    top.box(0xf4ecd2, q.x, 0.22, q.z, r.len * 0.7, 0.6, 0.03, r.ry);
    if (i % 2 === 0) {
      const c = { x: r.a.x + Math.sin(r.turn) * 0.1, z: r.a.z + Math.cos(r.turn) * 0.1 };
      top.box(WHITE, c.x, 0, c.z, 0.26, H - 0.24, 0.12, r.ry).box(WHITE, c.x, H - 0.5, c.z, 0.36, 0.18, 0.16, r.ry);
    }
  }
  // the gaps: the windows behind the desk, the doors, the portal back at the south
  for (const t of WINDOWS) windowAt(R, t);
  for (const t of DOORS) doorAt(R, t);
  const south = ringAt(RING, Math.PI / 2);
  // (the gap the portal stands in, walled behind it)
  top.box(CREAM, south.x, 0, south.z + 0.4, 3.6, H, 0.2);
  govPortal(R, BACK.x, BACK.z + 0.5, Math.PI);
  // the eagle on the ceiling, in a ring of plaster
  top.cyl(WHITE, RING.x, H - 0.04, RING.z, 1.3, 0.04).decal('ceilingseal', RING.x, H - 0.045, RING.z, 2.2, 2.2, { rx: Math.PI / 2 });

  // the rug with the seal
  const rug = RUGS.find((r) => r.id === 'office');
  top.decal('rug', rug.x, 0.012, rug.z, rug.w, rug.d, { rx: -Math.PI / 2 });

  // ── what's in it ──
  for (const it of FURNITURE.filter((f) => f.area === 'oval')) {
    if (it.kind === 'resolute') desk(R, it);
    else if (it.kind === 'flag') flag(R, it, it.id === 'flag1' ? 'stars' : 'presflag');
    else if (it.kind === 'couch') couch(R, it);
    else if (it.kind === 'coffee-table') table(R, it);
    else if (it.kind === 'fireplace') fireplace(R, it);
    else if (it.kind === 'clock') clock(R, it);
  }

  // ── the President and the generals ──
  try {
    const need = kit.need ? kit.need(['president', 'general'], { clips: ['idle', 'walk', 'sit'] }) : null;
    await Promise.race([need, new Promise((done) => setTimeout(done, 9000))]);
  } catch {
    /* stand-ins */
  }
  for (const p of PEOPLE.filter((o) => o.area === 'oval')) {
    const kind = p.who ?? p.id;
    if (kit.cast?.make) person(R, kind, { ...p, h: TALL[kind], look: LOOKS[kind] });
    else {
      const fig = toonPerson(R, LOOKS[kind], TALL[kind]);
      fig.group.position.set(p.x, 0, p.z);
      fig.group.rotation.y = p.face + Math.PI / 2;
      R.group.add(fig.group);
      R.tick(fig.tick);
    }
  }

  return R.build({ light: { sun: [0xfff4e0, 0.75], hemi: [0xfff8ec, 0x9a8a70, 1.8], fog: null, background: 0x15110d } });
}

// a window behind the desk: the lawn through it in a white frame, gold drapes either side, a valance
function windowAt(R, t) {
  const p = ringAt(RING, t);
  const turn = inward(RING, t);
  const f = R.frame(p.x, p.z, turn, { list: 'fixed' });
  const w = 1.2;
  const y0 = 0.5;
  const hh = 2.4;
  // the wall round it
  for (const s of [-1, 1]) f.box(CREAM, s * 0.82, 0, -0.15, 0.5, H, 0.36);
  f.box(CREAM, 0, 0, -0.15, 1.4, y0, 0.3).box(CREAM, 0, y0 + hh, -0.15, 1.4, H - y0 - hh, 0.3);
  f.decal('lawn', 0, y0 + hh / 2, -0.2, w, hh, { bright: true });
  for (const [u, y, ww, h2] of [
    [0, y0 + hh / 2, 0.05, hh],
    [0, y0 + hh * 0.35, w, 0.05],
    [0, y0 + hh * 0.7, w, 0.05],
    [-w / 2, y0 + hh / 2, 0.08, hh + 0.08],
    [w / 2, y0 + hh / 2, 0.08, hh + 0.08],
  ])
    f.cbox(WHITE, u, y, -0.17, ww, h2, 0.06);
  // the drapes, gathered, and the valance
  for (const s of [-1, 1]) f.box(0xd8a83a, s * 0.62, 0.02, 0.05, 0.28, y0 + hh + 0.2, 0.14).box(0xb88a2a, s * 0.62, 0.02, 0.12, 0.04, y0 + hh + 0.2, 0.02);
  f.box(0xd8a83a, 0, y0 + hh + 0.05, 0.05, 1.6, 0.32, 0.16);
}

// a door in the wall, white panels under a pediment
function doorAt(R, t) {
  const p = ringAt(RING, t);
  const turn = inward(RING, t);
  const f = R.frame(p.x, p.z, turn, { list: 'fixed' });
  for (const s of [-1, 1]) f.box(CREAM, s * 0.85, 0, -0.15, 0.5, H, 0.36);
  f.box(CREAM, 0, 2.5, -0.15, 1.4, H - 2.5, 0.3);
  f.box(WHITE, 0, 0, -0.1, 1.2, 2.4, 0.06);
  for (const u of [-0.3, 0.3]) for (const y of [0.25, 1.35]) f.box(0xece4cc, u, y, -0.06, 0.42, 0.85, 0.02);
  f.ball(GOLD, 0.48, 1.1, -0.04, 0.035);
  // the pediment over it
  f.box(WHITE, 0, 2.42, -0.08, 1.5, 0.1, 0.12);
  f.part(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), WHITE, 0, 2.66, -0.08, 0, 1.35, 0.42, 1);
}

// The desk: dark wood, carved panels down its front, a green top; on it the red phone, folders, a lamp, a pen set
function desk(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  f.box(WOOD, 0, 0, 0, w, h - 0.05, d).box(0x2a4a2a, 0, h - 0.05, 0, w - 0.06, 0.04, d - 0.06).box(WOOD, 0, h - 0.06, 0, w + 0.06, 0.03, d + 0.06);
  // carved panels on its front (south: the room's side) and its knee-hole
  for (const u of [-0.75, 0.75]) f.box(0x6e4024, u, 0.12, d / 2 + 0.005, 0.5, h - 0.3, 0.02).box(0x4a2814, u, 0.32, d / 2 + 0.012, 0.3, 0.2, 0.01);
  f.box(0x6e4024, 0, 0.12, d / 2 + 0.005, 0.7, h - 0.3, 0.02).decal('seal', 0, h / 2, d / 2 + 0.02, 0.3, 0.3);
  const y = h;
  f.box(0xc8302a, -0.6, y, -0.15, 0.24, 0.08, 0.18).box(0xc8302a, -0.6, y + 0.08, -0.15, 0.26, 0.04, 0.06);
  for (const [k, c] of [0xe8e0c8, 0xd8c890, 0xf0ece0].entries()) f.box(c, 0.2 + k * 0.03, y + k * 0.012, 0.05, 0.34, 0.012, 0.25, k * 0.15);
  f.cyl(GOLD, 0.75, y, -0.3, 0.08, 0.02).cyl(GOLD, 0.75, y, -0.3, 0.015, 0.4).part(new THREE.ConeGeometry(0.16, 0.18, 16, 1, true), 0x2a5a3a, 0.75, y + 0.42, -0.3);
  f.box(0x2a2a2a, -0.1, y, -0.32, 0.18, 0.04, 0.08);
}

// a flag on a pole with a gold eagle on top, the cloth hanging in folds
function flag(R, it, cell) {
  const f = R.frame(it.x, it.z, it.turn);
  f.cyl(0x8a6a3a, 0, 0, 0, 0.18, 0.06).cyl(GOLD, 0, 0.06, 0, 0.02, 2.3).ball(GOLD, 0, 2.38, 0, 0.06);
  f.part(new THREE.ConeGeometry(0.07, 0.16, 8), GOLD, 0, 2.5, 0);
  const cloth = new THREE.PlaneGeometry(0.85, 1.25, 8, 1);
  const p = cloth.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.05);
  cloth.computeVertexNormals();
  R.own(cloth);
  f.decal(cell, 0.44, 1.65, 0, 1, 1, { geo: cloth });
  f.decal(cell, 0.44, 1.65, -0.004, 1, 1, { geo: cloth, ry: Math.PI });
  if (cell === 'presflag') for (let k = 0; k < 6; k++) f.ball(GOLD, 0.03 + k * 0.17, 1.02, 0.02, 0.02, 1, BALL8);
}

// a couch in cream damask, rolled arms, cushions
function couch(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d } = it;
  const C = 0xeadcb0;
  f.box(0x6e4024, 0, 0, 0, w, 0.12, d - 0.05).box(C, 0, 0.12, 0.05, w - 0.2, 0.32, d - 0.15).box(C, 0, 0.12, -d / 2 + 0.12, w, 0.72, 0.24);
  for (const s of [-1, 1]) f.box(C, s * (w / 2 - 0.1), 0.12, 0, 0.2, 0.5, d - 0.05).cyl(C, s * (w / 2 - 0.1), 0.62, 0, 0.12, d - 0.05, Math.PI / 2);
  for (const u of [-0.5, 0.5]) f.box(0xf2e8c4, u, 0.44, 0.08, w / 2 - 0.25, 0.1, d - 0.3);
  for (const s of [-1, 1]) f.box(0xb83a3a, s * 0.75, 0.48, -d / 2 + 0.3, 0.32, 0.3, 0.12, 0, 0.2);
}

// the coffee table, a bowl on it
function table(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  f.box(WOOD, 0, 0.38, 0, it.w, 0.05, it.d);
  for (const s of [-1, 1]) for (const t of [-1, 1]) f.box(WOOD, (s * (it.w - 0.1)) / 2, 0, (t * (it.d - 0.1)) / 2, 0.06, 0.38, 0.06);
  f.part(new THREE.SphereGeometry(0.14, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), 0xe8e4d8, 0, 0.56, 0);
  for (const [u, v, c] of [
    [-0.04, 0.03, 0xd83a2a],
    [0.05, -0.02, 0x7ab84a],
    [0, 0.06, 0xf2c23a],
  ])
    f.ball(c, u, 0.5, v, 0.05);
}

// the fireplace: a white marble surround, the dark hearth, the mantel with
// candlesticks, and the portrait over it in a gold frame
function fireplace(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, h } = it;
  f.box(0xf2efe8, 0, 0, 0, w, h, 0.4).box(0x1a1614, 0, 0.1, 0.05, w * 0.5, h * 0.55, 0.32).box(0xf8f6f0, 0, h, 0.05, w + 0.2, 0.08, 0.5);
  for (const s of [-1, 1]) f.cyl(GOLD, s * 0.7, h + 0.08, 0.05, 0.04, 0.3).ball(0xfff2c8, s * 0.7, h + 0.42, 0.05, 0.03);
  f.box(0x6a3a1a, 0, 0.1, 0.1, w * 0.4, 0.06, 0.2);
  f.box(GOLD, 0, h + 0.4, -0.15, 1.1, 1.3, 0.06).decal('portrait', 0, h + 1.05, -0.115, 0.95, 1.15);
}

// a grandfather clock: a tall dark case, the face, the pendulum's window
function clock(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  f.box(0x4a2814, 0, 0, 0, it.w, it.h - 0.4, it.d).box(0x5a321c, 0, it.h - 0.4, 0, it.w + 0.06, 0.4, it.d + 0.04);
  f.cyl(0xf6f0de, 0, it.h - 0.2, it.d / 2 + 0.01, 0.15, 0.02, Math.PI / 2).decal('clockface', 0, it.h - 0.2, it.d / 2 + 0.025, 0.28, 0.28);
  f.box(0xd8b25a, 0, 0.7, it.d / 2 + 0.01, 0.18, 0.6, 0.01);
}

// ── paint ──

function paintCells(R) {
  R.cell('lawn', 96, 192, windowView(7, { house: false }));
  R.cell('rug', 256, 220, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#c8a64a';
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#2b3f73';
    g.beginPath();
    g.ellipse(w / 2, h / 2, w / 2 - 12, h / 2 - 12, 0, 0, TAU);
    g.fill();
    seal(g, w / 2, h / 2, 62);
    g.fillStyle = '#e8d07a';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      star(g, w / 2 + Math.cos(a) * (w / 2 - 26), h / 2 + Math.sin(a) * (h / 2 - 24), 5);
    }
  });
  R.cell('ceilingseal', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f8f4ea';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, TAU);
    g.fill();
    g.strokeStyle = '#d8ceb4';
    g.lineWidth = 3;
    g.stroke();
    eagle(g, w / 2, h / 2 + 4, 34, '#d8ceb4');
  });
  R.cell('seal', 96, 96, (g, w, h) => seal(g, w / 2, h / 2, w / 2 - 2));
  R.cell('stars', 160, 236, (g, w, h) => {
    // the Stars and Stripes, hung: the stripes down, the canton top left
    for (let i = 0; i < 13; i++) {
      g.fillStyle = i % 2 ? '#f6f2ea' : '#c8302a';
      g.fillRect(0, (i * h) / 13, w, h / 13 + 1);
    }
    g.fillStyle = '#2b3f73';
    g.fillRect(0, 0, w * 0.45, h * (7 / 13));
    g.fillStyle = '#f6f2ea';
    for (let r = 0; r < 9; r++) for (let c = 0; c < 6; c++) star(g, 8 + c * 11 + (r % 2) * 5, 8 + r * 13, 2.6);
  });
  R.cell('presflag', 160, 236, (g, w, h) => {
    g.fillStyle = '#2b3f73';
    g.fillRect(0, 0, w, h);
    seal(g, w / 2, h / 2, 46);
    g.fillStyle = '#e8d07a';
    for (const [x, y] of [
      [20, 20],
      [w - 20, 20],
      [20, h - 20],
      [w - 20, h - 20],
    ])
      star(g, x, y, 7);
  });
  R.cell('portrait', 96, 116, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5a4a3a');
    gr.addColorStop(1, '#2a221a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1612';
    g.beginPath();
    g.ellipse(w / 2, h * 0.86, w * 0.42, h * 0.3, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#f2f0ea';
    g.fillRect(w / 2 - 8, h * 0.6, 16, 14);
    g.fillStyle = '#e8c4a0';
    g.beginPath();
    g.ellipse(w / 2, h * 0.44, 16, 20, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#f0ece4';
    g.beginPath();
    g.ellipse(w / 2, h * 0.36, 20, 12, 0, Math.PI, 0);
    g.fill();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(w / 2 + s * 17, h * 0.42, 6, 0, TAU);
      g.fill();
    }
  });
  R.cell('clockface', 64, 64, (g, w, h) => {
    g.fillStyle = '#f6f0de';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 3, 0, TAU);
    g.stroke();
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2, 12);
    g.moveTo(w / 2, h / 2);
    g.lineTo(w / 2 + 14, h / 2 + 6);
    g.stroke();
  });
}

// the seal: a gold ring on navy, an eagle, the words round it
function seal(g, x, y, r) {
  g.fillStyle = '#c8a64a';
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = '#2b3f73';
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, TAU);
  g.fill();
  eagle(g, x, y + r * 0.06, r * 0.5, '#e8d07a');
  g.save();
  g.fillStyle = '#2b3f73';
  g.font = `bold ${Math.max(6, r * 0.13)}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const words = 'SEAL OF THE PRESIDENT';
  for (let i = 0; i < words.length; i++) {
    const a = -Math.PI * 0.85 + (i / (words.length - 1)) * Math.PI * 0.7;
    g.save();
    g.translate(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    g.rotate(a + Math.PI / 2);
    g.fillText(words[i], 0, 0);
    g.restore();
  }
  g.restore();
}

// an eagle, wings spread, in one colour
function eagle(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s * 0.55);
  g.quadraticCurveTo(x - s * 0.6, y - s * 0.8, x - s, y - s * 0.1);
  g.lineTo(x - s * 0.55, y);
  g.lineTo(x - s * 0.25, y + s * 0.2);
  g.lineTo(x - s * 0.2, y + s * 0.7);
  g.lineTo(x, y + s * 0.5);
  g.lineTo(x + s * 0.2, y + s * 0.7);
  g.lineTo(x + s * 0.25, y + s * 0.2);
  g.lineTo(x + s * 0.55, y);
  g.lineTo(x + s, y - s * 0.1);
  g.quadraticCurveTo(x + s * 0.6, y - s * 0.8, x, y - s * 0.55);
  g.fill();
  g.beginPath();
  g.arc(x, y - s * 0.62, s * 0.14, 0, TAU);
  g.fill();
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}
