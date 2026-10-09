// Naboo's props, built in code (props/index.js has what a builder
// returns): Theed's buildings, its palace, hangar and plaza over the
// waterfalls, the N-1s and the Queen's ship, the Gungans' sacred place,
// their shield, their sub and Otoh Gunga, Varykino, the shaak and the
// droid army. Each is what the world places when there's no model of it
// (yet, catalog/core.js), and what there's no model of at all. A part of
// its own (props/core/index.js has the rest) so Naboo can grow.
//
//   PROPS     theed, theedpalace, waterfall, n1fighter, royalship, hangar,
//             plaza, boomas, stonehead, ruins, grove, shield, mtt, aat,
//             droideka, bongo, otohgunga, varykino, shaak
//             (kit, opts) → { object, solids?, floors?, update? }
//   SCATTER   nabootree, grass: (kit, opts) → { parts, radius }

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod } from '../../kit';
import { rng } from '../../noise';
import { canopy } from '../forest';
import { canvasTexture, lit, loft, lump, rail, trap8, turned, vary } from './shared';

const { PI, cos, sin, abs } = Math;

// a roof's prism: the ridge along x, w long, d across, h high
const prism = (w, d, h) =>
  new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]), { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(PI / 2);

// an arched window (or door), dark, in a wall facing (sin yaw, cos yaw)
function arch(parts, x, y, z, yaw, w, h, color = '#2c2a2c') {
  parts.push(part(box(w, h - w / 2, 0.5), { at: [x, y, z], rot: [0, yaw, 0], color, to: 'dark' }));
  parts.push(part(new THREE.CylinderGeometry(w / 2, w / 2, 0.5, 10, 1, false, 0, PI).rotateZ(PI / 2).rotateY(PI / 2), { at: [x, y + h - w / 2, z], rot: [0, yaw, 0], color, to: 'dark' }));
}

// a light-scrolling material for falling water, a holo sign, a shield…
function streakTexture(seed, { base = 0.25, n = 260 } = {}) {
  const r = rng(seed);
  return canvasTexture(128, (c, s) => {
    c.clearRect(0, 0, s, s);
    c.fillStyle = `rgba(255,255,255,${base})`;
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
      c.fillRect(r() * s, r() * s, 1 + r() * 3, 10 + r() * 50);
    }
  });
}

const STONE = '#dcc0a6';
const TRIM = '#c8aa8e';
const VERDIGRIS = '#5c9a82';
const COLUMN = '#f3ecdc';

// a Theed colonnade: columns along x from x0 to x1 at z, h tall, with the
// beam across their tops
function colonnade(parts, x0, x1, z, y, h, n, { yaw = 0, r = 0.6 } = {}) {
  const c = cos(yaw);
  const s = sin(yaw);
  const at = (x, yy, zz) => [x * c + zz * s, yy, -x * s + zz * c];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    parts.push(part(cyl(r, r * 0.85, h, 12), { at: at(x, y, z), color: COLUMN, to: 'stone' }));
    parts.push(part(box(r * 2.6, r * 0.8, r * 2.6), { at: at(x, y + h - 0.1, z), rot: [0, yaw, 0], color: TRIM, to: 'stone' }));
  }
  parts.push(part(box(abs(x1 - x0) + r * 3, h * 0.12, r * 3), { at: at((x0 + x1) / 2, y + h + r * 0.6, z), rot: [0, yaw, 0], color: TRIM, to: 'stone' }));
}
// a green dome on its drum, with a lantern and a finial
function theedDome(parts, x, y, z, r, { drum = r * 0.6, tall = 0.9 } = {}) {
  parts.push(part(cyl(r, r, drum, 28), { at: [x, y, z], color: STONE, to: 'stone' }));
  parts.push(part(ring(r * 1.04, r * 0.06, 28), { at: [x, y + drum, z], color: TRIM, to: 'stone' }));
  parts.push(part(dome(r * 1.02, r * tall, 28), { at: [x, y + drum, z], color: VERDIGRIS, to: 'paint' }));
  const top = y + drum + r * tall;
  parts.push(part(cyl(r * 0.16, r * 0.14, r * 0.3, 10), { at: [x, top - r * 0.05, z], color: STONE, to: 'stone' }));
  parts.push(part(dome(r * 0.19, r * 0.18, 10), { at: [x, top + r * 0.25, z], color: VERDIGRIS, to: 'paint' }));
  parts.push(part(cyl(r * 0.03, 0.02, r * 0.4, 6), { at: [x, top + r * 0.4, z], color: '#c9b46a', to: 'metal' }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    arch(parts, x + sin(a) * r * 0.99, y + drum * 0.2, z + cos(a) * r * 0.99, a, r * 0.16, drum * 0.6);
  }
}

// N-1 starfighter: a long yellow needle, chrome behind, its engines out on
// the wingtips and their spikes trailing; parked on three legs. 11 m.
function n1Parts(H = 1.25) {
  const YEL = '#ecc63a';
  const CHROME = '#e2e6ea';
  const parts = [];
  const fl = [1, 0.62, 1];
  parts.push(part(turned([[0.02, -5.6], [0.16, -4.4], [0.5, -3.5], [0.82, -1.8], [0.9, -0.6]], 18), { at: [0, H, 0], scale: fl, color: CHROME, to: 'metal' }));
  parts.push(part(turned([[0.9, -0.6], [0.92, 0.4], [0.78, 2.0], [0.45, 3.8], [0.05, 5.6]], 18), { at: [0, H, 0], scale: fl, color: YEL, to: 'paint' }));
  for (const x of [-2.75, 2.75]) {
    parts.push(part(turned([[0.02, -5.0], [0.1, -4.0], [0.3, -2.9], [0.42, -1.6], [0.44, 0.2]], 14), { at: [x, H + 0.05, -0.2], color: CHROME, to: 'metal' }));
    parts.push(part(turned([[0.44, 0.2], [0.44, 1.2], [0.3, 2.3], [0.06, 2.8]], 14), { at: [x, H + 0.05, -0.2], color: YEL, to: 'paint' }));
    parts.push(part(box(2.2, 0.16, 2.0), { at: [x / 2, H - 0.05, -0.9], rot: [0, x > 0 ? -0.18 : 0.18, 0], color: YEL, to: 'paint' }));
  }
  parts.push(part(new THREE.SphereGeometry(0.5, 14, 10), { at: [0, H + 0.42, 0.9], scale: [0.95, 0.75, 2.1], color: '#2a3440', to: 'glass' }));
  parts.push(part(new THREE.SphereGeometry(0.28, 12, 8, 0, PI * 2, 0, PI / 2), { at: [0, H + 0.42, -1.35], color: '#e8ecf0', to: 'paint' }));
  parts.push(part(ring(0.27, 0.05, 12), { at: [0, H + 0.5, -1.35], color: '#3a5ab8', to: 'paint' }));
  for (const [x, z] of [[0, 2.6], [-0.9, -1.8], [0.9, -1.8]]) {
    parts.push(rod([x, 0.1, z], [x * 0.8, H - 0.3, z * 0.95], 0.1, 0.12, { color: '#55585c', to: 'metal' }));
    parts.push(part(cyl(0.24, 0.24, 0.12, 10), { at: [x, 0, z], color: '#3a3c40', to: 'metal' }));
  }
  return parts;
}

export const PROPS = {
  // A Theed building, 40 m: cream stone, colonnades, a green dome. A hall,
  // a tower or a rotunda.
  theed(k, { style } = {}) {
    const r = k.rand;
    const s = style ?? ['hall', 'tower', 'rotunda'][Math.floor(r() * 3)];
    const parts = [];
    const solids = [];
    if (s === 'hall') {
      const w = 30;
      const d = 22;
      const h = 16;
      parts.push(part(box(w + 2, 1.2, d + 2), { color: TRIM, to: 'stone' }));
      parts.push(part(box(w, h, d), { color: STONE, to: 'stone' }));
      parts.push(part(box(w + 1.4, 1.1, d + 1.4), { at: [0, h, 0], color: TRIM, to: 'stone' }));
      parts.push(part(box(w, 1.2, d), { at: [0, h + 1.1, 0], color: STONE, to: 'stone' }));
      for (const row of [2.5, 9.5]) for (let i = 0; i < 6; i++) for (const z of [-d / 2 - 0.05, d / 2 + 0.05]) arch(parts, -w / 2 + 3 + i * ((w - 6) / 5), row, z, 0, 1.8, 4.6);
      for (const row of [2.5, 9.5]) for (let i = 0; i < 4; i++) for (const x of [-w / 2 - 0.05, w / 2 + 0.05]) arch(parts, x, row, -d / 2 + 3.5 + i * ((d - 7) / 3), PI / 2, 1.8, 4.6);
      parts.push(part(box(w, 1.2, 6), { at: [0, 0, d / 2 + 3], color: TRIM, to: 'stone' }));
      colonnade(parts, -w / 2 + 1.5, w / 2 - 1.5, d / 2 + 4.6, 1.2, 10, 8);
      theedDome(parts, 0, h + 2.3, 0, 8);
      for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
        parts.push(part(cyl(2.4, 2.4, 4, 16), { at: [x, h, z], color: STONE, to: 'stone' }));
        parts.push(part(dome(2.5, 2.4, 16), { at: [x, h + 4, z], color: VERDIGRIS, to: 'paint' }));
      }
      solids.push({ box: [0, 2, w / 2 + 1, d / 2 + 4, 0] });
    } else if (s === 'tower') {
      parts.push(part(box(24, 12, 16), { color: STONE, to: 'stone' }));
      parts.push(part(box(25, 1, 17), { at: [0, 12, 0], color: TRIM, to: 'stone' }));
      parts.push(part(box(11, 30, 11), { at: [6, 0, 0], color: STONE, to: 'stone' }));
      parts.push(part(box(12, 1, 12), { at: [6, 30, 0], color: TRIM, to: 'stone' }));
      for (const y of [4, 13, 21]) for (const [x, z, a] of [[6, 5.55, 0], [6, -5.55, 0], [11.55, 0, PI / 2], [0.45, 0, PI / 2]]) arch(parts, x, y, z, a, 2.2, 5.5);
      for (let i = 0; i < 4; i++) for (const z of [-8.05, 8.05]) arch(parts, -10 + i * 3, 3, z, 0, 1.6, 5);
      theedDome(parts, 6, 31, 0, 5.2, { drum: 3, tall: 1.25 });
      colonnade(parts, -11, -1, 9.6, 0, 8, 5, { r: 0.45 });
      solids.push({ box: [0, 0.8, 12.5, 9.2, 0] });
    } else {
      parts.push(part(cyl(14, 14, 1.2, 36), { color: TRIM, to: 'stone' }));
      parts.push(part(cyl(10, 10, 14, 32), { at: [0, 1.2, 0], color: STONE, to: 'stone' }));
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2;
        parts.push(part(cyl(0.6, 0.5, 12, 10), { at: [sin(a) * 12.6, 1.2, cos(a) * 12.6], color: COLUMN, to: 'stone' }));
        if (i % 2 === 0) arch(parts, sin(a) * 10.05, 4, cos(a) * 10.05, a, 2, 6);
      }
      parts.push(part(cyl(13.6, 13.6, 1.4, 36), { at: [0, 13.2, 0], color: TRIM, to: 'stone' }));
      theedDome(parts, 0, 14.6, 0, 10.5, { drum: 4, tall: 0.85 });
      solids.push({ circle: [0, 0, 13.4] });
    }
    return { object: k.build(parts, { name: 'theed' }), solids };
  },

  // The Royal Palace of Theed: the great rotunda under its green dome, its
  // colonnaded wings, the towers at their ends, the steps down to the plaza
  theedpalace(k) {
    const parts = [];
    parts.push(part(box(132, 2.2, 54), { at: [0, 0, -4], color: TRIM, to: 'stone' }));
    // the rotunda
    parts.push(part(cyl(17, 17, 26, 40), { at: [0, 2.2, -6], color: STONE, to: 'stone' }));
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * PI * 2;
      if (cos(a) < -0.3) continue;
      parts.push(part(cyl(0.9, 0.8, 22, 12), { at: [sin(a) * 19, 2.2, -6 + cos(a) * 19], color: COLUMN, to: 'stone' }));
      arch(parts, sin(a) * 17.05, 8, -6 + cos(a) * 17.05, a, 2.4, 9);
    }
    parts.push(part(cyl(20.2, 20.2, 2.2, 40), { at: [0, 24.2, -6], color: TRIM, to: 'stone' }));
    theedDome(parts, 0, 26.4, -6, 15, { drum: 7, tall: 0.88 });
    // the wings, their colonnades, their roofs
    for (const sx of [-1, 1]) {
      const x = sx * 40;
      parts.push(part(box(46, 18, 26), { at: [x, 2.2, -10], color: STONE, to: 'stone' }));
      parts.push(part(box(47.5, 1.2, 27.5), { at: [x, 20.2, -10], color: TRIM, to: 'stone' }));
      parts.push(part(box(46, 1.4, 26), { at: [x, 21.4, -10], color: STONE, to: 'stone' }));
      for (const y of [5, 13]) for (let i = 0; i < 9; i++) arch(parts, x - 20 + i * 5, y, 3.05, 0, 2, 5.4);
      colonnade(parts, x - 21, x + 21, 7.5, 2.2, 13, 12, { r: 0.7 });
      parts.push(part(box(44, 1.2, 8), { at: [x, 2.2, 6], color: TRIM, to: 'stone' }));
      // the tower at the wing's end
      const tx = sx * 62;
      parts.push(part(box(14, 30, 14), { at: [tx, 2.2, -8], color: STONE, to: 'stone' }));
      for (const y of [8, 18]) for (const [dx, dz, a] of [[0, 7.05, 0], [sx * 7.05, 0, PI / 2]]) arch(parts, tx + dx, y, -8 + dz, a, 2.6, 6.5);
      parts.push(part(box(15, 1.2, 15), { at: [tx, 32.2, -8], color: TRIM, to: 'stone' }));
      theedDome(parts, tx, 33.4, -8, 6.2, { drum: 3, tall: 1.2 });
      // small domes along the wing's roof
      for (const dx of [-12, 12]) theedDome(parts, x + dx, 22.8, -10, 3.4, { drum: 2, tall: 1 });
    }
    // the steps down to the plaza
    for (let i = 0; i < 6; i++) parts.push(part(box(34 - i * 0.6, 0.38, 2.2), { at: [0, 1.85 - i * 0.37, 23.4 + i * 2.1], color: TRIM, to: 'stone' }));
    parts.push(part(box(38, 2.2, 12), { at: [0, 0, 16], color: TRIM, to: 'stone' }));
    // the great doors
    arch(parts, 0, 2.2, 11.2, 0, 7, 14, '#3a3024');
    return {
      object: k.build(parts, { name: 'theedpalace', shadows: true }),
      solids: [{ circle: [0, -6, 21] }, { box: [-40, -8, 24, 16, 0] }, { box: [40, -8, 24, 16, 0] }, { box: [-62, -8, 8, 8, 0] }, { box: [62, -8, 8, 8, 0] }, { box: [0, 16, 19, 6, 0] }, { box: [0, 34, 62, 12.5, 0] }, { box: [0, -36, 62, 11, 0] }],
    };
  },

  // A waterfall pouring off a ledge: a sheet of water arcing out and down
  // `h` metres (its top at y = 0, on the lip), spray where it lands
  waterfall(k, { h = 30, w = 12, out = 7 } = {}) {
    const tex = k.own(streakTexture(5, { base: 0.32 }));
    tex.repeat.set(Math.max(1, w / 8), Math.max(1, h / 12));
    const geo = k.own(new THREE.PlaneGeometry(w, 1, 6, 18));
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = 0.5 - p.getY(i);
      p.setXYZ(i, p.getX(i) * (1 + 0.35 * t), -h * t, out * Math.sqrt(t) + 0.4);
    }
    geo.computeVertexNormals();
    const mat = k.own(new THREE.MeshBasicMaterial({ map: tex, color: '#e4f4ff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    const sheet = new THREE.Mesh(geo, mat);
    const object = k.build([part(box(w + 3, 1.2, 2.4), { at: [0, -1.1, 0], color: TRIM, to: 'stone' }), part(box(w + 3, 0.5, 2.6), { at: [0, -1.3, 0.3], color: '#c8b896', to: 'stone' })], { name: 'waterfall' });
    object.add(sheet);
    // the spray at its foot
    const mist = [];
    const mistMat = k.own(new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.32, depthWrite: false }));
    const mistGeo = k.own(lump(9, 0.25, 10, 8));
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(mistGeo, mistMat);
      m.position.set((i - 1.5) * w * 0.28, -h + 1.5, out + 1.5);
      m.scale.set(w * 0.55, w * 0.32, w * 0.4);
      object.add(m);
      mist.push(m);
    }
    return {
      object,
      update(t) {
        tex.offset.y = (t * 0.9) % 1;
        mist.forEach((m, i) => {
          const f = 1 + 0.12 * sin(t * 2.3 + i * 1.7);
          m.scale.set(w * 0.55 * f, w * 0.32 * f, w * 0.4 * f);
        });
      },
    };
  },

  // an N-1 starfighter, parked
  n1fighter(k) {
    return { object: k.build(n1Parts(), { name: 'n1fighter' }), solids: [{ box: [0, -0.3, 3.4, 4.6, 0] }] };
  },

  // the Royal Starship: chrome, 76 m, its nose and tail drawn to points,
  // the engines out on its flanks; on its landing legs
  royalship(k) {
    const CHROME = '#e6eaee';
    const H = 4.2;
    const parts = [part(turned([[0.2, -38], [2.4, -33], [7.5, -24], [12.2, -10], [13.5, 2], [11.5, 15], [6.5, 27], [2, 34], [0.2, 38]], 32), { at: [0, H, 0], scale: [1, 0.3, 1], color: CHROME, to: 'metal' })];
    // the raised spine and the bridge's windows
    parts.push(part(turned([[0.2, -20], [3, -12], [4, 4], [2.6, 16], [0.2, 22]], 20), { at: [0, H + 2.2, 0], scale: [1, 0.35, 1], color: CHROME, to: 'metal' }));
    parts.push(part(box(3.4, 0.5, 2), { at: [0, H + 2.6, 18.5], rot: [-0.25, 0, 0], color: '#18202a', to: 'glass' }));
    for (const sx of [-1, 1]) {
      parts.push(part(turned([[0.2, -16], [1.2, -12], [2.6, -6], [2.9, 4], [2.2, 9], [0.4, 11]], 18), { at: [sx * 12.5, H + 0.6, -14], color: CHROME, to: 'metal' }));
      parts.push(part(new THREE.CylinderGeometry(1.9, 1.9, 0.2, 18), { at: [sx * 12.5, H + 0.6, -24], rot: [PI / 2, 0, 0], color: lit('#9ad8ff', 2), to: 'glow' }));
    }
    for (const [x, z] of [[-6, 16], [6, 16], [-8, -12], [8, -12], [0, 26]]) {
      parts.push(rod([x, 0, z], [x * 0.8, H - 0.4, z], 0.3, 0.4, { color: '#8a8e94', to: 'metal' }));
      parts.push(part(cyl(0.9, 0.9, 0.3, 12), { at: [x, 0, z], color: '#5a5e64', to: 'metal' }));
    }
    // the ramp, down
    parts.push(part(box(3, 0.3, 9), { at: [0, 1.6, -4], rot: [0.32, 0, 0], color: '#c8ccd2', to: 'metal' }));
    return { object: k.build(parts, { name: 'royalship' }), solids: [{ box: [0, 0, 10, 30, 0] }, { box: [0, -14, 15, 8, 0] }] };
  },

  // the Theed Hangar, on one side of the palace: stone outside, its great
  // door open, the floor polished, strip lights under the roof. Wookieepedia:
  // a heavy blast-proof door at its back to the city's plasma generator, a
  // blast-proof roof, and over the hangar the air traffic controllers' room
  // (its windows high on the back wall, a gallery in front of them)
  hangar(k, { w = 70, d = 48, h = 22 } = {}) {
    const parts = [];
    const ST = '#b98f7a'; // (this hangar's stone, warmer than the palace's)
    parts.push(part(box(w, h, 3), { at: [0, 0, -d / 2 + 1.5], color: ST, to: 'stone' }));
    for (const sx of [-1, 1]) {
      parts.push(part(box(3, h, d), { at: [sx * (w / 2 - 1.5), 0, 0], color: ST, to: 'stone' }));
      for (const y of [4, 13]) arch(parts, sx * (w / 2 + 0.05), y, -6, PI / 2, 2.4, 6);
    }
    // the front: one wall with a 34 m half-round mouth cut in it
    const front = new THREE.Shape();
    front.moveTo(-w / 2, 0);
    front.lineTo(-17, 0);
    front.lineTo(-17, 3);
    front.absarc(0, 3, 17, PI, 0, true);
    front.lineTo(17, 0);
    front.lineTo(w / 2, 0);
    front.lineTo(w / 2, h);
    front.lineTo(-w / 2, h);
    parts.push(part(new THREE.ExtrudeGeometry(front, { depth: 3.4, bevelEnabled: false }), { at: [0, 0, d / 2 - 3.4], color: ST, to: 'stone' }));
    // its hood: a segment of a ring round (0, -6), cut level at y 12, out
    // over paired columns
    const [ro, ri] = [31.5, 30.5];
    const [ao, ai] = [Math.asin(18 / ro), Math.asin(18 / ri)];
    const hood = new THREE.Shape();
    hood.absarc(0, -6, ro, ao, PI - ao, false);
    hood.lineTo(Math.cos(PI - ai) * ri, -6 + Math.sin(PI - ai) * ri);
    hood.absarc(0, -6, ri, PI - ai, ai, true);
    hood.closePath();
    parts.push(part(new THREE.ExtrudeGeometry(hood, { depth: 6, bevelEnabled: false, curveSegments: 32 }), { at: [0, 0, d / 2], color: ST, to: 'stone' }));
    const columns = [-24.5, -22.5, 22.5, 24.5];
    for (const x of columns) parts.push(part(cyl(0.9, 0.8, 12, 14), { at: [x, 0, d / 2 + 3], color: COLUMN, to: 'stone' }));
    parts.push(part(box(w + 2, 1.4, d + 2), { at: [0, h, 0], color: VERDIGRIS, to: 'paint' }));
    parts.push(part(box(w - 6, 0.12, d - 4), { at: [0, 0, 0], color: '#b8b2a4', to: 'tiles' }));
    for (let i = 0; i < 5; i++) parts.push(part(box(w - 10, 0.2, 0.5), { at: [0, h - 0.4, -d / 2 + 6 + i * 9], color: lit('#fff2d0', 2.2), to: 'glow' }));
    // its floor markings, and the bay doors' tracks
    for (const x of [-12, 12]) parts.push(part(box(0.5, 0.02, d - 6), { at: [x, 0.13, 0], color: '#e8c838', to: 'paint' }));
    // pilasters down the walls inside, green-capped
    for (let z = -d / 2 + 6; z < d / 2 - 6; z += 8)
      for (const sx of [-1, 1]) parts.push(part(box(1.2, h - 1, 0.9), { at: [sx * (w / 2 - 3.4), 0, z], color: COLUMN, to: 'stone' }), part(box(1.6, 0.8, 1.2), { at: [sx * (w / 2 - 3.4), h - 1.8, z], color: VERDIGRIS, to: 'paint' }));
    // the blast door to the generator, shut: grey plate in bands, in a deep frame
    const back = -d / 2 + 3;
    parts.push(part(box(14, 11, 0.8), { at: [0, 0, back + 0.4], color: '#5a5e62', to: 'metal' }));
    for (let i = 0; i < 6; i++) parts.push(part(box(13.4, 0.35, 0.2), { at: [0, 1 + i * 1.8, back + 0.9], color: '#44484c', to: 'metal' }));
    parts.push(part(box(0.25, 10.6, 0.25), { at: [0, 0, back + 0.95], color: '#2a2c2e', to: 'dark' }));
    for (const sx of [-1, 1]) parts.push(part(box(1.4, 12.2, 1.6), { at: [sx * 7.6, 0, back + 0.6], color: TRIM, to: 'stone' }));
    parts.push(part(box(16.6, 1.4, 1.6), { at: [0, 11.2, back + 0.6], color: TRIM, to: 'stone' }));
    // the controllers' room over it: a row of lit windows, the gallery
    parts.push(part(box(30, 0.5, 2.6), { at: [0, 13.6, back + 1.3], color: '#d8ccb0', to: 'stone' }), part(box(30, 1.1, 0.12), { at: [0, 14.1, back + 2.55], color: '#b8c2c8', to: 'metal' }));
    for (let i = 0; i < 6; i++) parts.push(part(box(3.6, 3.4, 0.12), { at: [-12.5 + i * 5, 15.4, back + 0.05], color: lit('#cfe6ff', 1.3), to: 'glow' }));
    return {
      object: k.build(parts, { name: 'hangar' }),
      solids: [
        { box: [0, -d / 2 + 1.5, w / 2, 1.5, 0] },
        { box: [-(w / 2 - 1.5), 0, 1.5, d / 2, 0] },
        { box: [w / 2 - 1.5, 0, 1.5, d / 2, 0] },
        { box: [-26, d / 2 - 1.7, 9, 1.7, 0] },
        { box: [26, d / 2 - 1.7, 9, 1.7, 0] },
        ...columns.map((x) => ({ circle: [x, d / 2 + 3, 1] })),
      ],
    };
  },

  // a paved plaza, cream flagstones in a grid, a fountain in its middle
  plaza(k, { w = 60, d = 40, fountain = true } = {}) {
    // (polished slabs, a metre each: the scan's own joints; a darker band
    // every 6 m, and a kerb round the edge)
    const parts = [part(box(w, 0.3, d), { color: '#d6c6b8', to: 'tiles' })];
    for (let x = -w / 2 + 6; x < w / 2 - 1; x += 6) parts.push(part(box(0.3, 0.02, d - 0.4), { at: [x, 0.3, 0], color: '#a89a8e', to: 'stone' }));
    for (let z = -d / 2 + 6; z < d / 2 - 1; z += 6) parts.push(part(box(w - 0.4, 0.02, 0.3), { at: [0, 0.3, z], color: '#a89a8e', to: 'stone' }));
    for (const sx of [-1, 1]) parts.push(part(box(0.8, 0.45, d), { at: [sx * (w / 2 - 0.4), 0, 0], color: '#cfc2a2', to: 'stone' }), part(box(w, 0.45, 0.8), { at: [0, 0, sx * (d / 2 - 0.4)], color: '#cfc2a2', to: 'stone' }));
    const solids = [];
    if (fountain) {
      parts.push(part(cyl(5, 5, 0.9, 32), { at: [0, 0.3, 0], color: '#cfc2a2', to: 'stone' }), part(cyl(4.4, 4.4, 0.92, 32), { at: [0, 0.3, 0], color: '#5e9aa4', to: 'glass' }));
      parts.push(part(cyl(0.6, 0.45, 3.4, 12), { at: [0, 0.3, 0], color: COLUMN, to: 'stone' }), part(dome(1.8, 0.7, 16), { at: [0, 3.2, 0], color: VERDIGRIS, to: 'paint' }));
      solids.push({ circle: [0, 0, 5], top: 1.2 });
    }
    return { object: k.build(parts, { name: 'plaza' }), floors: [{ x: 0, z: 0, hw: w / 2, hd: d / 2, yaw: 0, y: 0.3 }], solids };
  },

  // a Gungan cart of boomas: energy balls in a wicker basket, glowing blue
  boomas(k) {
    const r = rng(61);
    const parts = [part(cyl(1.1, 1.4, 1.1, 14, true), { color: '#8a6a3a', to: 'bark' }), part(ring(1.4, 0.08, 14), { at: [0, 1.1, 0], color: '#6a4a2a', to: 'bark' })];
    for (let i = 0; i < 9; i++) parts.push(part(new THREE.SphereGeometry(0.32, 10, 8), { at: [(r() - 0.5) * 1.4, 1.0 + r() * 0.4, (r() - 0.5) * 1.4], color: lit('#5ab4ff', 2.6), to: 'glow' }));
    for (const s of [-1, 1]) parts.push(part(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), { at: [s * 1.3, 0.5, 0], rot: [0, 0, PI / 2], color: '#5a4028', to: 'bark' }));
    return { object: k.build(parts, { name: 'boomas' }), solids: [{ circle: [0, 0, 1.4], top: 1.2 }] };
  },

  // a great stone head at the Gungans' sacred place, mossy, half sunk
  stonehead(k, { s = 1 } = {}) {
    const r = k.rand;
    const G = vary('#8e8c78', r, 0.1);
    const MOSS = '#5f7440';
    const DARK = '#24241c';
    const parts = [
      // the skull and the long face, the brow, the nose, the lips
      part(new THREE.SphereGeometry(3, 20, 16), { at: [0, 4.4, -0.4], scale: [1, 1.15, 1], color: G, to: 'stone' }),
      part(new THREE.SphereGeometry(2.4, 18, 14), { at: [0, 2.2, 0.8], scale: [1.05, 1.25, 1], color: G, to: 'stone' }),
      part(new THREE.CylinderGeometry(0.5, 0.5, 5.2, 10).rotateZ(PI / 2), { at: [0, 4.4, 2.35], scale: [1, 1, 0.9], color: G, to: 'stone' }),
      part(new THREE.ConeGeometry(0.75, 2.6, 4), { at: [0, 2.7, 3.05], rot: [-0.25, PI / 4, 0], color: G, to: 'stone' }),
      part(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 8).rotateZ(PI / 2), { at: [0, 1.0, 3.05], color: G, to: 'stone' }),
      part(box(2.0, 0.16, 0.4), { at: [0, 0.85, 3.05], color: DARK, to: 'dark' }),
      // the crown band of carving round the brow
      part(new THREE.TorusGeometry(2.95, 0.32, 6, 24), { at: [0, 5.3, -0.4], rot: [PI / 2 + 0.15, 0, 0], color: '#7c7a66', to: 'stone' }),
      // moss over the top and down the back
      part(new THREE.SphereGeometry(3.08, 18, 10, 0, PI * 2, 0, PI * 0.32), { at: [0, 4.6, -0.5], scale: [1.01, 1.15, 1.01], color: MOSS, to: 'stone' }),
    ];
    for (const x of [-1.15, 1.15]) {
      parts.push(part(new THREE.SphereGeometry(0.62, 12, 8), { at: [x, 3.7, 2.35], scale: [1.2, 0.75, 0.5], color: DARK, to: 'dark' }));
      parts.push(part(new THREE.SphereGeometry(0.3, 8, 6), { at: [x, 3.7, 2.48], scale: [1, 0.8, 0.5], color: '#a8a690', to: 'stone' }));
    }
    // the long lobes down each side (a Gungan's ears), braided
    for (const x of [-1, 1]) {
      parts.push(part(new THREE.CapsuleGeometry(0.75, 5.5, 4, 10), { at: [x * 2.9, 1.0, -0.2], rot: [0.12, 0, x * 0.1], scale: [1, 1, 0.7], color: G, to: 'stone' }));
      for (let i = 0; i < 4; i++) parts.push(part(new THREE.TorusGeometry(0.78, 0.12, 5, 12), { at: [x * (2.9 - i * 0.03), 2.6 - i * 1.2, -0.2 + i * 0.12], rot: [PI / 2, 0, 0], scale: [1, 0.7, 1], color: i % 2 ? MOSS : '#7c7a66', to: 'stone' }));
    }
    const object = k.build(parts, { name: 'stonehead' });
    object.scale.setScalar(s);
    const holder = new THREE.Group();
    holder.add(object);
    return { object: holder, solids: [{ circle: [0, 0, 3.4 * s] }] };
  },

  // broken columns, a fallen one, an arch still standing, old steps
  ruins(k, { seed = 1 } = {}) {
    const r = rng(seed);
    const G = '#8a8a78';
    const MOSS = '#4c5a36';
    const parts = [];
    const solids = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2 + r();
      const d = 9 + r() * 6;
      const h = 2 + r() * 7;
      const [x, z] = [sin(a) * d, cos(a) * d];
      parts.push(part(cyl(0.9, 0.8, h, 12), { at: [x, 0, z], color: vary(G, r), to: 'stone' }));
      parts.push(part(cyl(0.95, 0.85, 0.6, 12), { at: [x, h * 0.55, z], color: MOSS, to: 'stone' }));
      if (r() < 0.5) parts.push(part(box(2.4, 0.7, 2.4), { at: [x, h, z], rot: [0, r(), 0.1], color: G, to: 'stone' }));
      solids.push({ circle: [x, z, 1] });
    }
    // the arch
    for (const x of [-3.2, 3.2]) parts.push(part(box(1.6, 9, 1.6), { at: [x, 0, -4], color: G, to: 'stone' }));
    parts.push(part(new THREE.TorusGeometry(3.2, 0.8, 8, 16, PI), { at: [0, 9, -4], color: G, to: 'stone' }));
    parts.push(part(box(9, 1.2, 2), { at: [0, 12.2, -4], color: MOSS, to: 'stone' }));
    solids.push({ circle: [-3.2, -4, 1.1] }, { circle: [3.2, -4, 1.1] });
    // a column fallen across, in pieces
    for (let i = 0; i < 3; i++) parts.push(part(cyl(0.85, 0.85, 3.2, 12), { at: [-8 + i * 3.4, 0.85, 6 + i * 0.4], rot: [0, 0, PI / 2 + (r() - 0.5) * 0.2], color: vary(G, r), to: 'stone' }));
    solids.push({ box: [-4.6, 6.4, 5, 0.9, 0], top: 1.7 });
    // a stepped ruin behind the arch, its tops mossy, a stair up its front
    let y = 0;
    for (const [w, d] of [
      [14, 10],
      [10, 7],
      [6, 4],
    ]) {
      parts.push(part(box(w, 2.2, d), { at: [0, y, -18], color: G, to: 'stone' }), part(box(w + 0.2, 0.25, d + 0.2), { at: [0, y + 2.1, -18], color: MOSS, to: 'stone' }));
      y += 2.2;
    }
    for (let i = 0; i < 18; i++) parts.push(part(box(2.4, (i + 1) * 0.37, 0.3), { at: [0, 0, -10.4 - i * 0.27], color: i % 3 ? G : MOSS, to: 'stone' }));
    solids.push({ box: [0, -18, 7, 5, 0] });
    return { object: k.build(parts, { name: 'ruins' }), solids };
  },

  // a grove of Naboo's forest trees: straight trunks, buttressed roots,
  // high broad canopies; `n` of them within `r`
  grove(k, { n = 12, r: R = 22, seed = 3 } = {}) {
    const r = rng(seed);
    const parts = [];
    const solids = [];
    for (let i = 0; i < n; i++) {
      const a = r() * PI * 2;
      const d = Math.sqrt(r()) * R;
      const x = sin(a) * d;
      const z = cos(a) * d;
      const h = 13 + r() * 10;
      const tr = 0.45 + r() * 0.35;
      parts.push(part(cyl(tr, tr * 0.6, h * 0.8, 9), { at: [x, -0.3, z], color: vary('#5e4a36', r, 0.1), to: 'bark' }));
      for (let j = 0; j < 4; j++) {
        const b = (j / 4) * PI * 2 + r();
        parts.push(rod([x + sin(b) * tr * 2.6, -0.2, z + cos(b) * tr * 2.6], [x, 2.4, z], 0.12, tr * 0.5, { color: '#56442f', to: 'bark' }));
      }
      for (let j = 0; j < 3; j++) {
        const b = r() * PI * 2;
        parts.push(rod([x, h * 0.55, z], [x + sin(b) * 3.5, h * 0.82, z + cos(b) * 3.5], tr * 0.35, 0.08, { color: '#56442f', to: 'bark' }));
      }
      // (the crown: rounded lobes of leaf cards, a holm oak's, the dark
      // olive green of the Naboo woods as filmed)
      const lobes = 4 + Math.floor(r() * 3);
      for (let j = 0; j < lobes; j++) {
        const b = r() * PI * 2;
        const o = j ? 2.2 + r() * 2.5 : 0;
        const s = 5.5 + r() * 3.5;
        parts.push(...canopy([x + sin(b) * o, h * (0.72 + r() * 0.2), z + cos(b) * o], s, { flat: 0.72, color: vary(['#4c6236', '#566e3c', '#46592f'][j % 3], r, 0.06, 0.02), seed: seed * 101 + i * 7 + j, density: 0.8 }));
      }
      solids.push({ circle: [x, z, tr + 0.2] });
    }
    return { object: k.build(parts, { name: 'grove' }), solids };
  },

  // the Gungan Grand Army's shield: a shimmering dome, thrown up from the
  // generator on a fambaa's back in the middle of it
  shield(k, { r: R = 64 } = {}) {
    const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#9ad6ff') } };
    const mat = k.own(
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vN; varying vec3 vW; void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader:
          'uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vW; void main() { vec3 v = normalize(cameraPosition - vW); float f = 1.0 - abs(dot(normalize(vN), v)); float band = 0.5 + 0.5 * sin(vW.y * 0.5 - uTime * 2.2 + sin(vW.x * 0.04 + uTime * 0.7) * 3.0 + vW.z * 0.03); float a = 0.07 + pow(f, 2.2) * 0.75 + band * band * 0.08; gl_FragColor = vec4(uColor * (0.7 + band * 0.5) * a, 1.0); }',
      }),
    );
    const bubble = new THREE.Mesh(k.own(new THREE.SphereGeometry(R, 56, 22, 0, PI * 2, 0, PI / 2)), mat);
    bubble.renderOrder = 4;
    // the fambaa, and the generator on its back
    const SKIN = '#6c7f84';
    const BELLY = '#a99a7a';
    const parts = [
      part(new THREE.SphereGeometry(1, 20, 14), { at: [0, 4.2, 0], scale: [3.6, 2.7, 6.2], color: SKIN, to: 'leaf' }),
      part(new THREE.SphereGeometry(1, 16, 10), { at: [0, 3.2, 0.3], scale: [3.2, 1.8, 5.4], color: BELLY, to: 'leaf' }),
      part(new THREE.CapsuleGeometry(1.1, 4, 4, 10), { at: [0, 5.4, 7.5], rot: [1.1, 0, 0], color: SKIN, to: 'leaf' }),
      part(new THREE.SphereGeometry(1.3, 14, 10), { at: [0, 6.6, 9.8], scale: [1, 0.8, 1.5], color: SKIN, to: 'leaf' }),
      part(new THREE.CapsuleGeometry(0.9, 6, 4, 10), { at: [0, 3.4, -8.5], rot: [-1.25, 0, 0], color: SKIN, to: 'leaf' }),
    ];
    for (const [x, z] of [[-2.6, 3.4], [2.6, 3.4], [-2.6, -3.4], [2.6, -3.4]]) parts.push(part(cyl(0.95, 0.8, 3.4, 12), { at: [x, 0, z], color: SKIN, to: 'leaf' }));
    // the generator: a saddle, a mast, a ring of fins, the glowing bulb
    parts.push(part(box(4, 1, 6), { at: [0, 6.8, -0.5], color: '#7a5a3a', to: 'bark' }));
    parts.push(part(cyl(0.7, 0.45, 8, 12), { at: [0, 7.6, -0.5], color: '#8a7050', to: 'bark' }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      parts.push(rod([0, 9.5, -0.5], [sin(a) * 3.2, 13.5, -0.5 + cos(a) * 3.2], 0.2, 0.1, { color: '#a07a50', to: 'bark' }));
      parts.push(part(new THREE.SphereGeometry(0.45, 10, 8), { at: [sin(a) * 3.2, 13.6, -0.5 + cos(a) * 3.2], color: lit('#ffb070', 2.4), to: 'glow' }));
    }
    parts.push(part(new THREE.SphereGeometry(1.1, 16, 12), { at: [0, 16.2, -0.5], scale: [1, 1.3, 1], color: lit('#ff9ad0', 2.2), to: 'glow' }));
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * PI * 2;
      parts.push(part(new THREE.SphereGeometry(0.5, 6, 4), { at: [sin(a) * R, 0.2, cos(a) * R], scale: [2.6, 0.5, 2.6], color: lit('#8ad0ff', 2.2), to: 'glow' }));
    }
    const object = k.build(parts, { name: 'shield' });
    object.add(bubble);
    return {
      object,
      solids: [{ circle: [0, 0, 4] }, { circle: [0, 7, 1.6] }],
      update(t) {
        uniforms.uTime.value = t;
      },
    };
  },

  // a Multi-Troop Transport: the droid army's carrier, its bulbous nose
  // (its doors) to the front, hovering, 31 m
  mtt(k) {
    const TAN = '#a98d62';
    const DARK = '#6a5638';
    const H = 1.6;
    const hull = loft([
      { z: -15, pts: trap8(9, 7, 9, 1.4, H + 6) },
      { z: -12, pts: trap8(11.5, 9, 11.5, 1.8, H + 6.4) },
      { z: 6, pts: trap8(12, 9.5, 12.2, 1.8, H + 6.6) },
      { z: 10, pts: trap8(10.5, 8, 11.5, 1.6, H + 6.3) },
    ]);
    const parts = [part(hull, { color: TAN, to: 'paint' })];
    // the nose: a great bulb, split down the middle (its doors), the eyes
    parts.push(part(new THREE.SphereGeometry(1, 24, 16), { at: [0, H + 6, 11], scale: [5.4, 5.6, 5.4], color: TAN, to: 'paint' }));
    parts.push(part(box(0.3, 9.5, 2), { at: [0, H + 1.4, 16.1], color: DARK, to: 'metal' }));
    for (const x of [-3.2, 3.2]) parts.push(part(new THREE.SphereGeometry(0.75, 12, 8), { at: [x, H + 9.2, 14.1], scale: [1, 0.7, 0.6], color: lit('#ffcf6a', 1.6), to: 'glow' }));
    // the ridge along its back, vents, repulsor pods
    parts.push(part(box(3, 1.4, 22), { at: [0, H + 12.6, -3], color: DARK, to: 'metal' }));
    for (let i = 0; i < 6; i++) for (const x of [-6.1, 6.1]) parts.push(part(box(0.3, 3, 1.4), { at: [x, H + 4, -11 + i * 3.6], color: DARK, to: 'metal' }));
    for (const x of [-3.5, 3.5]) for (const z of [-9, 4]) parts.push(part(cyl(1.6, 1.2, 1.2, 14), { at: [x, H - 1.2, z], color: '#3a3226', to: 'metal' }));
    return { object: k.build(parts, { name: 'mtt' }), solids: [{ box: [0, 0, 6.2, 15, 0] }, { circle: [0, 12, 5.4] }] };
  },

  // an Armored Assault Tank: a hover tank, its prow forward, the turret
  // and its long gun on top, the cannon pods either side; 9.75 m
  aat(k) {
    const TAN = '#bba37a';
    const STRIPE = '#7a3a2a';
    const H = 1.1;
    const hull = loft([
      { z: -4.4, pts: trap8(4.6, 3.6, 2.2, 0.4, H + 1.1) },
      { z: 1.4, pts: trap8(4.8, 3.4, 2.2, 0.4, H + 1.1) },
      { z: 4.9, pts: trap8(2.2, 1.2, 1.0, 0.2, H + 0.7) },
    ]);
    const parts = [part(hull, { color: TAN, to: 'paint' })];
    parts.push(part(box(4.9, 0.25, 0.6), { at: [0, H + 1.6, 0.4], color: STRIPE, to: 'paint' }));
    parts.push(part(box(3.2, 1.0, 3.2), { at: [0, H + 2.2, -1.6], color: TAN, to: 'paint' }));
    parts.push(part(new THREE.CylinderGeometry(0.14, 0.18, 5.6, 8), { at: [0, H + 2.8, 2.6], rot: [PI / 2, 0, 0], color: '#5a4a36', to: 'metal' }));
    for (const x of [-2.3, 2.3]) {
      parts.push(part(new THREE.CylinderGeometry(0.45, 0.5, 3.6, 10), { at: [x, H + 0.9, 2.2], rot: [PI / 2, 0, 0], color: TAN, to: 'paint' }));
      parts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), { at: [x, H + 0.9, 4.6], rot: [PI / 2, 0, 0], color: '#3a3226', to: 'metal' }));
    }
    for (const x of [-1.4, 1.4]) parts.push(part(box(0.6, 0.6, 0.15), { at: [x, H + 1.2, 4.0], color: lit('#ffb84a', 1.5), to: 'glow' }));
    parts.push(part(box(3.8, 0.4, 7), { at: [0, H - 0.4, -0.6], color: '#4a3e2e', to: 'metal' }));
    return { object: k.build(parts, { name: 'aat' }), solids: [{ box: [0, 0, 2.6, 4.6, 0] }] };
  },

  // a droideka, deployed: bronze, three-legged, its arms' twin blasters
  // forward, its shield up (or not); 1.8 m
  droideka(k, { shield = false } = {}) {
    const BRONZE = '#8a6a46';
    const DARK = '#3a3028';
    const parts = [
      part(new THREE.SphereGeometry(0.22, 14, 10), { at: [0, 1.45, 0.22], scale: [1.1, 0.8, 1.6], color: BRONZE, to: 'metal' }),
      part(new THREE.TorusGeometry(0.5, 0.15, 8, 16, PI * 1.05), { at: [0, 0.95, -0.12], rot: [0, PI / 2, PI / 2 + 0.2], color: BRONZE, to: 'metal' }),
      part(new THREE.SphereGeometry(0.2, 12, 8), { at: [0, 1.05, 0.05], scale: [1.4, 1, 1.4], color: DARK, to: 'metal' }),
    ];
    for (const x of [-0.06, 0.06]) parts.push(part(new THREE.SphereGeometry(0.035, 8, 6), { at: [x, 1.47, 0.55], color: lit('#ff5a3a', 2), to: 'glow' }));
    for (const s of [-1, 1]) {
      parts.push(rod([s * 0.2, 1.12, 0.1], [s * 0.34, 0.98, 0.45], 0.04, 0.04, { color: DARK, to: 'metal' }));
      for (const y of [0.93, 1.03]) parts.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), { at: [s * 0.36, y, 0.62], rot: [PI / 2, 0, 0], color: DARK, to: 'metal' }));
      parts.push(rod([s * 0.18, 0.95, 0.08], [s * 0.36, 0.55, 0.3], 0.05, 0.04, { color: BRONZE, to: 'metal' }));
      parts.push(rod([s * 0.36, 0.55, 0.3], [s * 0.42, 0, 0.42], 0.04, 0.03, { color: BRONZE, to: 'metal' }));
    }
    parts.push(rod([0, 0.6, -0.55], [0, 0, -0.75], 0.05, 0.04, { color: BRONZE, to: 'metal' }));
    const object = k.build(parts, { name: 'droideka' });
    if (shield) {
      const m = new THREE.Mesh(k.own(new THREE.SphereGeometry(1.05, 20, 14)), k.own(new THREE.MeshBasicMaterial({ color: '#4a9aff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })));
      m.position.y = 0.85;
      object.add(m);
    }
    return { object, solids: [{ circle: [0, 0, 0.6] }] };
  },

  // a Gungan bongo: an orange-red sub, its bubble cockpits at the front,
  // the three fins at its tail turning; 15 m (floating, its belly under)
  bongo(k) {
    const BODY = '#c8693e';
    const LIGHT = '#e8a874';
    const parts = [
      part(turned([[0.2, -6.5], [1.2, -5], [2.2, -1.5], [2.5, 2], [2.1, 4.6], [1.0, 6.2], [0.2, 6.8]], 24), { scale: [1.5, 0.65, 1], color: BODY, to: 'leaf' }),
      part(new THREE.SphereGeometry(1, 20, 12), { at: [0, 0.8, 1.6], scale: [3, 1.0, 4.2], color: LIGHT, to: 'leaf' }),
    ];
    for (const [x, s] of [[0, 1.35], [-2.3, 0.95], [2.3, 0.95]]) parts.push(part(new THREE.SphereGeometry(s, 16, 12), { at: [x, 1.0, 5.0 - abs(x) * 0.6], color: '#cfeaff', to: 'glass' }));
    // the side fins
    for (const sx of [-1, 1]) parts.push(part(new THREE.SphereGeometry(1, 14, 8), { at: [sx * 4.3, -0.1, -0.5], rot: [0, sx * 0.4, sx * 0.2], scale: [2.4, 0.18, 1.4], color: BODY, to: 'leaf' }));
    const object = k.build(parts, { name: 'bongo' });
    const tail = k.build(
      Array.from({ length: 3 }, (_, i) => part(new THREE.SphereGeometry(1, 12, 8), { at: [sin((i / 3) * PI * 2) * 1.3, cos((i / 3) * PI * 2) * 1.3, -2.2], rot: [0, 0, -(i / 3) * PI * 2], scale: [0.6, 1.6, 2.8], color: i === 0 ? LIGHT : BODY, to: 'leaf' })),
      { name: 'bongo-tail' },
    );
    tail.position.z = -6.3;
    object.add(tail);
    const holder = new THREE.Group();
    holder.add(object);
    return {
      object: holder,
      solids: [{ box: [0, 0, 3, 7, 0] }],
      update(t, dt) {
        tail.rotation.z += (dt ?? 0) * 1.4;
        object.position.y = sin(t * 0.8) * 0.12;
        object.rotation.z = sin(t * 0.6) * 0.03;
      },
    };
  },

  // the tops of Otoh Gunga's bubbles, glowing up through the lake
  otohgunga(k) {
    const r = rng(17);
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2 + r();
      const d = i ? 14 + r() * 26 : 0;
      const s = i ? 7 + r() * 8 : 16;
      const at = [sin(a) * d, -s * (0.25 + r() * 0.3), cos(a) * d];
      parts.push(part(new THREE.SphereGeometry(s, 24, 16), { at, color: '#bfe2dc', to: 'glass' }));
      parts.push(part(new THREE.SphereGeometry(s * 0.82, 18, 12), { at, color: i % 3 ? lit('#ffb060', 1.4) : lit('#ff8a50', 1.4), to: 'glow' }));
      // its frame: four ribs over it, a dark finial on top
      for (let j = 0; j < 4; j++) parts.push(part(new THREE.TorusGeometry(s * 1.01, s * 0.02, 4, 24), { at, rot: [0, (j * PI) / 4, 0], color: '#4a3a2a', to: 'metal' }));
      parts.push(part(new THREE.ConeGeometry(s * 0.06, s * 0.2, 8).translate(0, s * 0.1, 0), { at: [at[0], at[1] + s, at[2]], color: '#2e241a', to: 'metal' }));
      // a hub's ring of lights round it, at the water
      parts.push(part(ring(s * 0.86, 0.25, 24), { at: [at[0], 0.1, at[2]], color: lit('#fff4c8', 2), to: 'glow' }));
    }
    return { object: k.build(parts, { name: 'otohgunga', shadows: false }) };
  },

  // the lake retreat at Varykino: cream walls and terracotta roofs over a
  // terrace on the water, a round tower, steps down to a boat dock
  varykino(k) {
    const WALL = '#ead7b2';
    const ROOF = '#b5583a';
    const parts = [];
    const house = (x, z, w, d, h, yaw = 0) => {
      parts.push(part(box(w, h, d), { at: [x, 0, z], rot: [0, yaw, 0], color: WALL, to: 'adobe' }));
      parts.push(part(prism(w + 1.2, d + 1.4, d * 0.32), { at: [x, h, z], rot: [0, yaw, 0], color: ROOF, to: 'paint' }));
      for (let i = 0; i < Math.floor(w / 3.2); i++) {
        const ox = -w / 2 + 1.8 + i * 3.2;
        for (const y of [1, h * 0.55]) arch(parts, x + ox * cos(yaw), y, z + d / 2 + 0.05 - ox * sin(yaw), yaw, 1.2, h * 0.32, '#3a3a40');
      }
    };
    parts.push(part(box(46, 2.6, 28), { at: [0, -2.4, -2], color: '#c9b693', to: 'stone' }));
    house(-6, -6, 20, 11, 9);
    house(12, -10, 12, 9, 7, -0.3);
    house(-20, 2, 8, 8, 6, 0.4);
    // the tower
    parts.push(part(cyl(3.4, 3.4, 16, 20), { at: [12, 0, 2], color: WALL, to: 'adobe' }));
    parts.push(part(new THREE.ConeGeometry(4.3, 4.2, 20).translate(0, 2.1, 0), { at: [12, 16, 2], color: ROOF, to: 'paint' }));
    for (const y of [5, 11]) arch(parts, 12, y, 5.45, 0, 1.3, 2.6, '#3a3a40');
    // the terrace over the water: columns, the balustrade, the loggia's roof
    parts.push(part(box(20, 0.5, 9), { at: [-4, 0, 6], color: '#d8c8a6', to: 'stone' }));
    for (let i = 0; i < 6; i++) parts.push(part(cyl(0.3, 0.3, 4.4, 10), { at: [-13 + i * 3.6, 0.5, 9.8], color: COLUMN, to: 'stone' }));
    parts.push(part(prism(21, 4.4, 1.2), { at: [-4, 4.9, 8.6], color: ROOF, to: 'paint' }));
    parts.push(part(box(20, 1, 0.3), { at: [-4, 0.5, 10.4], color: '#d8c8a6', to: 'stone' }));
    // steps down to the dock, the dock, a boat
    for (let i = 0; i < 8; i++) parts.push(part(box(4, 0.4, 1.2), { at: [16, -0.4 - i * 0.4, 6 + i * 1.2], color: '#cdbb98', to: 'stone' }));
    parts.push(part(box(5, 0.4, 12), { at: [16, -3.8, 20], color: '#7a5a3c', to: 'bark' }));
    parts.push(part(new THREE.SphereGeometry(1, 14, 8), { at: [20, -3.6, 22], scale: [1.2, 0.5, 3.4], color: '#e8e0cc', to: 'paint' }));
    // flowers along the terrace's edge
    for (let i = 0; i < 10; i++) parts.push(part(new THREE.SphereGeometry(0.7, 8, 6), { at: [-13 + i * 2, 1.4, 10.2], scale: [1, 0.6, 0.7], color: i % 2 ? '#d86a8a' : '#f2c84a', to: 'leaf' }));
    return {
      object: k.build(parts, { name: 'varykino' }),
      solids: [{ box: [-6, -6, 10.5, 6, 0] }, { box: [12, -10, 6.5, 5, -0.3] }, { box: [-20, 2, 4.5, 4.5, 0.4] }, { circle: [12, 2, 3.6] }, ...rail([-14, 10.4], [6, 10.4])],
    };
  },

  // a shaak, grazing on the plains: round, mottled, on little legs
  shaak(k) {
    const r = k.rand;
    const FUR = vary('#b59c78', r, 0.1);
    const parts = [
      part(new THREE.SphereGeometry(1, 18, 12), { at: [0, 1.25, 0], scale: [0.95, 0.85, 1.25], color: FUR, to: 'leaf' }),
      part(new THREE.SphereGeometry(0.5, 12, 8), { at: [0, 1.55, -0.2], scale: [1.6, 1.0, 1.9], color: '#e6dcc4', to: 'leaf' }),
      part(new THREE.SphereGeometry(0.32, 12, 8), { at: [0, 1.05, 1.25], scale: [1, 0.9, 1.3], color: '#6a5440', to: 'leaf' }),
    ];
    for (const x of [-0.12, 0.12]) parts.push(part(new THREE.SphereGeometry(0.05, 6, 4), { at: [x, 1.15, 1.6], color: '#141210', to: 'dark' }));
    for (const [x, z] of [[-0.45, 0.6], [0.45, 0.6], [-0.45, -0.6], [0.45, -0.6]]) parts.push(part(cyl(0.12, 0.1, 0.55, 8), { at: [x, 0, z], color: '#5a4836', to: 'leaf' }));
    const body = k.build(parts, { name: 'shaak' });
    const object = new THREE.Group();
    object.add(body);
    let ph = r() * 10;
    return {
      object,
      update(t, dt, move = 0) {
        ph += (dt ?? 0) * (2 + move * 9);
        body.rotation.z = sin(ph) * 0.07 * move;
        body.position.y = abs(sin(ph)) * 0.08 * move;
        body.rotation.x = move < 0.05 ? 0.18 + sin(t * 0.7) * 0.05 : 0;
      },
    };
  },
};

// Things scattered by the dozen (drawn instanced)
export const SCATTER = {
  // a lone Naboo tree on the plains: a trunk and a broad, layered canopy
  nabootree(k, { seed = 4 } = {}) {
    const r = rng(seed);
    const trunk = [part(cyl(0.5, 0.32, 7, 8), { color: '#5e4a36', to: 'bark' })];
    for (let j = 0; j < 3; j++) {
      const b = (j / 3) * PI * 2;
      trunk.push(rod([0, 4, 0], [sin(b) * 2.4, 6.6, cos(b) * 2.4], 0.2, 0.08, { color: '#56442f', to: 'bark' }));
    }
    // (a broad crown of leaf cards in lobes, on smooth cores)
    const leaves = [];
    for (let j = 0; j < 5; j++) {
      const b = (j / 5) * PI * 2;
      const o = j ? 2.4 : 0;
      const s = j ? 4 + r() : 5.5;
      leaves.push(...canopy([sin(b) * o, 7 + r() * 1.2, cos(b) * o], s, { flat: 0.55, color: vary(['#566e3c', '#4c6236', '#62783f'][j % 3], r, 0.06), seed: seed * 11 + j }));
    }
    const by = (to) => leaves.filter((p) => p.to === to);
    return {
      parts: [
        { geometry: k.geometry(trunk), material: k.mats.bark },
        { geometry: k.geometry(by('foliage')), material: k.mats.foliage },
        { geometry: k.geometry(by('crown')), material: k.mats.crown },
      ],
      radius: 0.6,
    };
  },
  // a tuft of long grass, some of it in flower
  grass(k, { color = '#6f9a3e', flower = null } = {}) {
    const r = rng(7);
    const blades = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      blades.push(part(new THREE.ConeGeometry(0.05, 0.7 + r() * 0.4, 3).translate(0, 0.4, 0), { at: [sin(a) * 0.12, 0, cos(a) * 0.12], rot: [cos(a) * 0.35, 0, -sin(a) * 0.35], color: vary(color, r, 0.12), to: 'leaf' }));
    }
    if (flower) for (let i = 0; i < 3; i++) blades.push(part(new THREE.SphereGeometry(0.07, 6, 4), { at: [sin(i * 2.1) * 0.3, 0.75 + i * 0.08, cos(i * 2.1) * 0.3], color: flower, to: 'leaf' }));
    return { parts: [{ geometry: k.geometry(blades), material: k.mats.leaf, shadow: false }], radius: null };
  },
};
