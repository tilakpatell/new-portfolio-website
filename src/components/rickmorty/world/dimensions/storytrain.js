// The Story Train ("Never Ricking Morty"): one carriage of it, red velvet
// seats in rows down both sides, a strip of carpet up the aisle, brass
// luggage racks, lamps in a row along the ceiling, and the windows showing
// the anthology going by as painted scenes that slide past (a canvas each
// side, scrolled). Story Lord stands at the far end; the conductor is in
// the aisle, and wants a ticket. One is under a seat (./destinations.js).

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { stage } from './stage';

const LIGHT = { sun: [0xffe8c8, 0.7], hemi: [0xffe0b8, 0x4a2a1a, 1.7], fog: null, background: 0x1a0c08 };
const PANEL = 0x5a1e18;
const BRASS = 0xc8a24a;
const VELVET = 0x8a1e22;

const CARPET = (g, w, h) => {
  g.fillStyle = '#6a1a1e';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#c8a24a';
  for (let x = 8; x < w; x += 32) for (let y = 8; y < h; y += 32) g.fillRect(x, y, 4, 4);
};

// the anthology outside: a strip of scenes, each a different sky and shape,
// repeating (the texture wraps as it slides)
function anthology(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const scenes = [
    ['#f6d27a', '#c86a3a', 'desert'],
    ['#2a2a5a', '#6a8aff', 'city'],
    ['#9ad8ff', '#f2f2f2', 'wedding'],
    ['#1a0c20', '#ff5a9a', 'heist'],
    ['#4aa84a', '#2a6a2a', 'forest'],
    ['#ffe0b8', '#8a4a2a', 'tavern'],
  ];
  const sw = w / scenes.length;
  for (const [i, [sky, land, kind]] of scenes.entries()) {
    const x0 = i * sw;
    g.fillStyle = sky;
    g.fillRect(x0, 0, sw, h);
    g.fillStyle = land;
    g.fillRect(x0, h * 0.62, sw, h * 0.38);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    if (kind === 'city') for (let k = 0; k < 6; k++) g.fillRect(x0 + 10 + k * (sw / 6.5), h * (0.25 + (k % 3) * 0.1), sw / 9, h);
    if (kind === 'desert') for (let k = 0; k < 3; k++) g.fillRect(x0 + 20 + k * 40, h * 0.42, 6, h * 0.22);
    if (kind === 'forest') for (let k = 0; k < 7; k++) g.fillRect(x0 + 8 + k * (sw / 7.2), h * 0.3, 5, h * 0.35);
    if (kind === 'wedding') {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x0 + sw / 2, h * 0.5, h * 0.18, Math.PI, 0);
      g.fill();
    }
    if (kind === 'heist') {
      g.fillStyle = '#ffe24a';
      for (let k = 0; k < 12; k++) g.fillRect(x0 + ((k * 37) % sw), (k * 53) % (h * 0.6), 2, 2);
    }
    if (kind === 'tavern') {
      g.fillStyle = '#5a2a1a';
      g.fillRect(x0 + sw * 0.3, h * 0.3, sw * 0.4, h * 0.35);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function buildStorytrain(kit) {
  const S = stage(kit, 'storytrain', { floor: CARPET, floorTile: 1.5, wall: PANEL, ceiling: 0xf2e6d0, skirt: BRASS });
  const { R, P, A } = S;
  const H = S.d.ceiling;
  const L = A.z1 - A.z0;

  // the seats: a velvet bench each side of the aisle in every row, brass legs
  for (const dz of [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10]) {
    for (const side of [-1, 1]) {
      const f = R.frame(...P(side * 3.1, dz), side > 0 ? -Math.PI / 2 : Math.PI / 2);
      f.box(VELVET, 0, 0.42, 0, 1.1, 0.5, 2.9).box(VELVET, 0, 0.9, 0.0, 1.1, 0.05, 2.9);
      f.box(VELVET, 0.5, 0.92, 0, 0.12, 0.9, 2.9);
      f.box(0x6a1a1e, 0, 0.92, -1.42, 1.1, 0.5, 0.06).box(0x6a1a1e, 0, 0.92, 1.42, 1.1, 0.5, 0.06);
      for (const u of [-1.3, 1.3]) f.box(BRASS, -0.4, 0, u, 0.08, 0.42, 0.08);
    }
  }
  // the luggage racks, brass rails under the windows' tops
  for (const side of [-1, 1]) R.frame(...P(side * 4.3, 0), 0, { list: 'fixed' }).box(BRASS, 0, 2.5, 0, 0.04, 0.04, L - 0.4).box(BRASS, side * -0.4, 2.5, 0, 0.04, 0.04, L - 0.4);
  // the lamps down the middle of the ceiling
  for (let dz = -12; dz <= 12; dz += 3) R.frame(...P(0, dz), 0, { list: 'fixed' }).cyl(BRASS, 0, H - 0.5, 0, 0.05, 0.5).glow(BALL, 0xffe0a0, 1.7, 0, H - 0.6, 0, 0, 0.36);
  // the windows: a long pane each side, the anthology sliding past outside
  const panes = [];
  if (typeof document !== 'undefined') {
    for (const side of [-1, 1]) {
      const tex = R.own(anthology(1536, 192));
      tex.repeat.set(L / 12, 1);
      const mat = R.own(new THREE.MeshBasicMaterial({ map: tex }));
      const m = new THREE.Mesh(R.own(new THREE.PlaneGeometry(L - 0.4, 1.3)), mat);
      const [x, z] = P(side * (A.x1 - A.x0) / 2 - side * 0.1, 0);
      m.position.set(x, 1.85, z);
      m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      R.add(m, { ink: false });
      panes.push([tex, side]);
    }
  }
  // the frames between the windows, brass
  for (const side of [-1, 1]) for (let dz = -13.75; dz <= 13.75; dz += 2.5) R.frame(...P(side * ((A.x1 - A.x0) / 2 - 0.08), dz), 0, { list: 'fixed' }).box(BRASS, 0, 1.15, 0, 0.1, 1.4, 0.12);
  for (const side of [-1, 1]) R.frame(...P(side * ((A.x1 - A.x0) / 2 - 0.08), 0), 0, { list: 'fixed' }).box(BRASS, 0, 1.15, 0, 0.1, 0.08, L).box(BRASS, 0, 2.5, 0, 0.1, 0.08, L);
  // the route map on the east wall, and the door to the next carriage at the far end
  R.cell('train-map', 192, 96, (g, w, h) => {
    g.fillStyle = '#f2e6d0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a1e22';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(12, h / 2);
    g.lineTo(w - 12, h / 2);
    g.stroke();
    const stops = ['COLD OPEN', 'ACT I', 'ACT II', 'ACT III', 'TAG'];
    for (const [i, s] of stops.entries()) {
      const x = 12 + (i * (w - 24)) / 4;
      g.fillStyle = '#8a1e22';
      g.beginPath();
      g.arc(x, h / 2, 5, 0, Math.PI * 2);
      g.fill();
      fitText(g, s, x, h / 2 + (i % 2 ? 18 : -18), 40, 9, { color: '#2a1a1a' });
    }
  });
  R.frame(...P((A.x1 - A.x0) / 2 - 0.1, -7.5), -Math.PI / 2, { list: 'fixed' }).box(BRASS, 0, 1.05, 0, 1.3, 0.8, 0.04).decal('train-map', 0, 1.45, 0.04, 1.2, 0.7);
  const D = R.frame(...P(0, -(L / 2) + 0.14), 0, { list: 'fixed' });
  D.box(0x3a1210, 0, 0, 0, 1.4, 2.4, 0.1).box(BRASS, 0, 0, 0.02, 1.5, 0.08, 0.14).glow(BOX, 0xffe0a0, 1.2, 0, 1.7, 0.06, 0, 0.5, 0.5, 0.02);
  // the ticket, a slip of card under the seat, gone once taken
  const ticketMat = R.own(new THREE.MeshBasicMaterial({ color: 0xf2e6a0 }));
  const ticket = new THREE.Mesh(R.own(new THREE.BoxGeometry(0.28, 0.01, 0.14)), ticketMat);
  const [tx, tz] = P(2.2, 7.4);
  ticket.position.set(tx, 0.08, tz);
  ticket.rotation.y = 0.4;
  R.add(ticket, { ink: false });

  S.people();
  let rock = 0;
  const area = S.done(LIGHT, (t, dt, state) => {
    for (const [tex, side] of panes) tex.offset.x = side * t * 0.06;
    rock = Math.sin(t * 1.7) * 0.004;
    R.group.position.y = rock;
    ticket.visible = !(state?.done ?? []).includes('storytrain');
  });
  return area;
}
