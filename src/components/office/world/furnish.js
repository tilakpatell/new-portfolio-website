// The set dressing that makes a set look lived in, and the office's
// machines as machines rather than boxes.
//
// dressDesks(seats, kit) puts on and under every desk what a 2000s office
// had: a PC tower and a bin under it, a cable down the back, paper in
// stacks, manila folders, a wire in-tray, a mug, a framed photo turned to
// the chair, sticky notes round the monitor, now and then a tissue box or a
// desk calendar. Each desk its own, from a seed, so no two match.
//
// copier(), waterCooler(), fridge(), microwave(), coffeeMaker() and
// cupboards(w, d) build the machines at the origin, standing on y = 0 and
// facing +z. Everything here is plain painted geometry and a few small
// canvases, so ./batch.js folds it into a handful of draws.
//
// makeFurnish() → { dressDesks, copier, waterCooler, fridge, microwave, coffeeMaker, cupboards, dispose }

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rng } from '../../../lib/texture';
import { sharpen } from '../../../lib/three/textures';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// four framed photos in one canvas: a family, a dog, a beach, a wedding
function photosTex() {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  const r = rng(11);
  const cells = [
    ['#8fb3d6', '#6b8f4f'],
    ['#d9c7a3', '#8a6a3a'],
    ['#7fb6d9', '#e8d7a8'],
    ['#efe9de', '#c9b8a8'],
  ];
  cells.forEach(([sky, ground], i) => {
    const ox = (i % 2) * 128;
    const oy = Math.floor(i / 2) * 128;
    x.fillStyle = sky;
    x.fillRect(ox, oy, 128, 128);
    x.fillStyle = ground;
    x.fillRect(ox, oy + 76, 128, 52);
    // people (or a dog): heads and bodies
    const n = i === 1 ? 1 : 2 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const px = ox + 26 + k * (76 / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0) + (n === 1 ? 38 : 0);
      x.fillStyle = ['#2f3d55', '#7c1f24', '#e8e4da', '#3a5a3a', '#c97a3a'][Math.floor(r() * 5)];
      if (i === 1) {
        x.fillStyle = '#b07a3a';
        x.beginPath();
        x.ellipse(px, oy + 86, 26, 14, 0, 0, Math.PI * 2);
        x.fill();
        x.beginPath();
        x.ellipse(px + 24, oy + 70, 12, 11, 0, 0, Math.PI * 2);
        x.fill();
        continue;
      }
      x.fillRect(px - 11, oy + 62, 22, 40);
      x.fillStyle = ['#f0c8a0', '#c8946a', '#8a5a3a'][Math.floor(r() * 3)];
      x.beginPath();
      x.arc(px, oy + 52, 10, 0, Math.PI * 2);
      x.fill();
    }
  });
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// a copier's control panel: a little lit screen, a keypad, a green start
function panelTex() {
  const c = canvas(256, 96);
  const x = c.getContext('2d');
  x.fillStyle = '#4a4d52';
  x.fillRect(0, 0, 256, 96);
  x.fillStyle = '#9cc8d8';
  x.fillRect(14, 14, 96, 54);
  x.fillStyle = '#2f5866';
  x.font = 'bold 13px sans-serif';
  x.fillText('READY', 24, 34);
  x.font = '11px sans-serif';
  x.fillText('Copies: 1', 24, 54);
  x.fillStyle = '#d6d4cc';
  for (let i = 0; i < 12; i++) x.fillRect(128 + (i % 3) * 22, 12 + Math.floor(i / 3) * 18, 16, 12);
  x.fillStyle = '#3cb54a';
  x.beginPath();
  x.arc(226, 40, 15, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#c0392b';
  x.beginPath();
  x.arc(226, 74, 8, 0, Math.PI * 2);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// the notes on the fridge
function notesTex() {
  const c = canvas(256, 128);
  const x = c.getContext('2d');
  const note = (ox, bg, lines, ink = '#1b1b1b') => {
    x.fillStyle = bg;
    x.fillRect(ox, 0, 128, 128);
    x.fillStyle = ink;
    x.font = 'bold 15px "Comic Sans MS", "Marker Felt", cursive';
    lines.forEach((l, i) => x.fillText(l, ox + 10, 30 + i * 22));
  };
  note(0, '#fbf6e4', ['Whoever keeps', 'eating my', 'yogurt: STOP.', '   — Angela']);
  note(128, '#fdf08a', ['CLEAN OUT', 'FRIDAY', 'Everything', 'goes. — Mgmt'], '#7a1d1d');
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeFurnish() {
  const own = [];
  const keep = (x) => (own.push(x), x);
  const mats = new Map();
  // one material per finish, shared by everything with that finish
  const paint = (color, roughness = 0.6, metalness = 0, extra = {}) => {
    const k = `${color}|${roughness}|${metalness}|${JSON.stringify(extra)}`;
    if (!mats.has(k)) mats.set(k, keep(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })));
    return mats.get(k);
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = null) => {
    const o = new THREE.Mesh(keep(geo), mat);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent?.add(o);
    return o;
  };
  const photos = keep(photosTex());
  const photoMat = keep(new THREE.MeshStandardMaterial({ map: photos, roughness: 0.35 }));
  const led = paint(0x0a2a0a, 0.4, 0, { emissive: 0x3dff6a, emissiveIntensity: 2.2 });

  // ── on and under the desks ──
  // (in each desk's own frame: its front edge, where the chair is, at +z)
  const dressDesks = (seats) => {
    for (const s of seats.values()) {
      if (!s.depth || !s.width) continue;
      const g = s.group;
      const r = rng(97 + (s.i ?? 0) * 31);
      const top = s.top;
      const front = s.depth / 2;
      const w = s.width;
      const left = -w / 2;
      const right = w / 2;
      // under the desk: the tower on the side away from its drawers, a bin, the monitor's cable
      const towerSide = s.pedestals === 'left' ? 1 : s.pedestals === 'both' ? 0 : -1;
      if (towerSide && !s.exec) {
        const tw = mesh(new RoundedBoxGeometry(0.19, 0.42, 0.45, 2, 0.01), paint(r() < 0.5 ? 0x2b2d31 : 0xd6d2c4, 0.5), towerSide * (w / 2 - 0.2), 0.21, -0.02, g);
        tw.rotation.y = (r() - 0.5) * 0.12;
        const face = tw.position.z + 0.226;
        mesh(new THREE.BoxGeometry(0.15, 0.035, 0.004), paint(0x8b8d91, 0.4), tw.position.x, 0.36, face, g); // a drive bay
        mesh(new THREE.BoxGeometry(0.15, 0.035, 0.004), paint(0x8b8d91, 0.4), tw.position.x, 0.315, face, g);
        mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), led, tw.position.x + 0.05, 0.25, face + 0.001, g);
      }
      mesh(new THREE.BoxGeometry(0.012, top - 0.02, 0.012), paint(0x141414, 0.6), 0.12, (top - 0.02) / 2, -front + 0.03, g).castShadow = false;
      // paper: a stack or two on the left, a folder or three on top
      const stacks = 1 + Math.floor(r() * 2);
      for (let k = 0; k < stacks; k++) {
        const h = 0.01 + r() * 0.04;
        const p = mesh(new THREE.BoxGeometry(0.215, h, 0.28), paint(k ? 0xf4f2ea : 0xf7f6f0, 0.85), left + 0.22 + k * 0.03, top + h / 2, 0.02 + k * 0.05, g);
        p.rotation.y = (r() - 0.5) * 0.35;
        const folders = Math.floor(r() * 3);
        for (let f = 0; f < folders; f++) {
          const fo = mesh(new THREE.BoxGeometry(0.235, 0.006, 0.305), paint([0xd9b779, 0xd2ae6c, 0xc94b3a, 0x3f6fae][Math.floor(r() * 4)], 0.8), p.position.x + (r() - 0.5) * 0.04, top + h + 0.003 + f * 0.007, p.position.z + (r() - 0.5) * 0.05, g);
          fo.rotation.y = p.rotation.y + (r() - 0.5) * 0.3;
        }
      }
      // a two-tier wire in-tray, back left of the monitor
      if (r() < 0.65 && !s.exec) {
        const tray = new THREE.Group();
        tray.position.set(-0.42, top, -front + 0.2);
        tray.rotation.y = (r() - 0.5) * 0.2;
        g.add(tray);
        const wire = paint(0x1d1e21, 0.4, 0.6);
        for (const y of [0.01, 0.085]) {
          mesh(new THREE.BoxGeometry(0.26, 0.006, 0.33), wire, 0, y, 0, tray);
          mesh(new THREE.BoxGeometry(0.22, 0.012 + r() * 0.025, 0.28), paint(0xf2f0e8, 0.85), 0, y + 0.012, 0, tray);
        }
        for (const [px, pz] of [
          [-0.12, -0.15],
          [0.12, -0.15],
          [-0.12, 0.15],
          [0.12, 0.15],
        ])
          mesh(new THREE.BoxGeometry(0.008, 0.09, 0.008), wire, px, 0.045, pz, tray).castShadow = false;
      }
      // a mug, somewhere on the right
      if (s.who !== 'michael' && r() < 0.8) {
        const m = new THREE.Group();
        m.position.set(right - 0.14, top, front - 0.2 - (s.i % 3 === 0 ? 0.32 : 0));
        g.add(m);
        const body = paint([0xf2f0ea, 0x1f4e8c, 0xb3222b, 0x2e6b3a, 0xe2b13c, 0x1b1d21][Math.floor(r() * 6)], 0.25);
        mesh(new THREE.CylinderGeometry(0.041, 0.038, 0.098, 18), body, 0, 0.049, 0, m);
        mesh(new THREE.CircleGeometry(0.036, 16), paint(0x3a2414, 0.15), 0, 0.09, 0, m).rotation.x = -Math.PI / 2;
        const h = mesh(new THREE.TorusGeometry(0.024, 0.007, 6, 14, Math.PI), body, 0.04, 0.052, 0, m);
        h.rotation.z = -Math.PI / 2;
        m.rotation.y = r() * Math.PI * 2;
      }
      // a framed photo, back right, turned to the chair
      if (r() < 0.7) {
        const f = new THREE.Group();
        f.position.set(0.36, top, -front + 0.16);
        f.rotation.y = -0.35 - r() * 0.3;
        g.add(f);
        const frame = mesh(new THREE.BoxGeometry(0.15, 0.2, 0.018), paint(r() < 0.5 ? 0x2a1d14 : 0xb8b3a6, 0.4, r() < 0.3 ? 0.7 : 0), 0, 0.1, 0, f);
        frame.rotation.x = -0.18;
        // one of the four photos: its quarter of the canvas (the top two
        // are the upper half of the texture)
        const k = Math.floor(r() * 4);
        const u0 = (k % 2) * 0.5;
        const v0 = k < 2 ? 0.5 : 0;
        const geo = new THREE.PlaneGeometry(0.12, 0.165);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
        const pic = mesh(geo, photoMat, 0, 0.1, 0.0095, f);
        pic.rotation.x = -0.18;
        pic.position.y += 0.0017;
        pic.castShadow = false;
      }
      // sticky notes round the monitor's frame
      const notes = Math.floor(r() * 4);
      for (let k = 0; k < notes; k++) {
        const side = k % 2 ? 1 : -1;
        const n = mesh(new THREE.PlaneGeometry(0.05, 0.05), paint([0xfdf08a, 0xfdb6c8, 0xa8e4f0, 0xc6f0a0][Math.floor(r() * 4)], 0.9, 0, { side: THREE.DoubleSide }), side * 0.235, top + 0.3 + k * 0.06 - (k > 1 ? 0.1 : 0), -front + 0.2 + 0.02, g);
        n.rotation.z = (r() - 0.5) * 0.3;
        n.castShadow = false;
      }
      // now and then: a tissue box, a desk calendar
      if (r() < 0.3) {
        mesh(new THREE.BoxGeometry(0.24, 0.09, 0.12), paint([0x6e9fc9, 0xd9a6c4, 0x9cc79a][Math.floor(r() * 3)], 0.7), right - 0.2, top + 0.045, -0.05, g).rotation.y = 0.3;
        mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), paint(0xffffff, 0.9), right - 0.2, top + 0.1, -0.05, g).rotation.y = 0.3;
      } else if (r() < 0.4) {
        const cal = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.09), paint(0xf3f1ea, 0.8), right - 0.24, top + 0.05, -0.08, g);
        cal.rotation.set(-0.45, -0.25, 0);
      }
      // a bin under every desk that hasn't one, at the back of the knee space
      if (s.who !== 'jim') {
        const b = mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 18, 1, true), paint(0x2a2c30, 0.55, 0, { side: THREE.DoubleSide }), towerSide * 0.08, 0.15, -front + 0.24, g);
        mesh(new THREE.CircleGeometry(0.1, 18), paint(0x2a2c30, 0.55), b.position.x, 0.004, b.position.z, g).rotation.x = -Math.PI / 2;
      }
    }
  };

  // ── the copier: drawers, a lit panel, the glass and its lid, an output tray ──
  const copier = (w = 0.96, d = 0.58) => {
    const g = new THREE.Group();
    const body = paint(0xd9d7cf, 0.5);
    const dark = paint(0x55585d, 0.45);
    mesh(new RoundedBoxGeometry(w, 0.62, d, 2, 0.02), body, 0, 0.33, 0, g);
    mesh(new THREE.BoxGeometry(w * 0.96, 0.04, d * 0.96), dark, 0, 0.02, 0, g); // the plinth
    // three paper drawers with their handles
    for (let k = 0; k < 3; k++) {
      mesh(new THREE.BoxGeometry(w * 0.92, 0.004, 0.004), dark, 0, 0.2 + k * 0.15, d / 2 + 0.001, g);
      mesh(new THREE.BoxGeometry(0.16, 0.022, 0.025), dark, 0, 0.13 + k * 0.15, d / 2 + 0.012, g);
    }
    // the printer engine above, set back, and the scanner and its lid on top
    mesh(new RoundedBoxGeometry(w * 0.86, 0.3, d * 0.9, 2, 0.02), body, -w * 0.05, 0.79, -d * 0.03, g);
    mesh(new THREE.BoxGeometry(w * 0.84, 0.03, d * 0.88), dark, -w * 0.05, 0.955, -d * 0.03, g);
    const lid = mesh(new RoundedBoxGeometry(w * 0.82, 0.05, d * 0.84, 2, 0.01), body, -w * 0.05, 0.995, -d * 0.04, g);
    lid.rotation.x = -0.04;
    // the control panel, tilted up at the front right
    const panel = new THREE.Group();
    panel.position.set(w * 0.3, 0.97, d / 2 - 0.05);
    panel.rotation.x = -0.75;
    g.add(panel);
    mesh(new THREE.BoxGeometry(0.3, 0.12, 0.03), dark, 0, 0, 0, panel);
    const lit = keep(panelTex());
    const face = mesh(new THREE.PlaneGeometry(0.28, 0.105), keep(new THREE.MeshStandardMaterial({ map: lit, emissive: 0xffffff, emissiveMap: lit, emissiveIntensity: 0.25, roughness: 0.4 })), 0, 0, 0.016, panel);
    face.castShadow = false;
    // the output tray on the left, with a few copies in it
    const tray = mesh(new THREE.BoxGeometry(0.28, 0.012, 0.3), paint(0xbdbbb3, 0.45), -w / 2 - 0.12, 0.7, 0, g);
    tray.rotation.z = 0.12;
    mesh(new THREE.BoxGeometry(0.21, 0.01, 0.28), paint(0xf7f6f0, 0.85), -w / 2 - 0.12, 0.713, 0, g).rotation.z = 0.12;
    return g;
  };

  // ── the water cooler: a cabinet, two taps, a drip tray and the blue jug ──
  const waterCooler = () => {
    const g = new THREE.Group();
    const white = paint(0xeeede8, 0.45);
    mesh(new RoundedBoxGeometry(0.3, 0.95, 0.3, 2, 0.02), white, 0, 0.475, 0, g);
    mesh(new THREE.BoxGeometry(0.2, 0.2, 0.012), paint(0x9ea2a6, 0.4, 0.5), 0, 0.72, 0.151, g); // the recess
    mesh(new THREE.BoxGeometry(0.16, 0.02, 0.08), paint(0x7c8085, 0.35, 0.6), 0, 0.58, 0.18, g); // the drip tray
    for (const [x, c] of [
      [-0.05, 0x2f6fd8],
      [0.05, 0xc8202a],
    ]) {
      mesh(new THREE.BoxGeometry(0.035, 0.03, 0.05), paint(c, 0.35), x, 0.78, 0.17, g);
      mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), paint(0xd8dadc, 0.2, 1), x, 0.755, 0.185, g);
    }
    mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.03, 20), white, 0, 0.965, 0, g);
    // the jug, upside down, clear blue
    const pts = [
      [0.0, 0.0],
      [0.04, 0.0],
      [0.045, 0.06],
      [0.13, 0.12],
      [0.135, 0.2],
      [0.13, 0.3],
      [0.135, 0.38],
      [0.12, 0.44],
      [0.0, 0.46],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const jug = mesh(new THREE.LatheGeometry(pts, 28), keep(new THREE.MeshStandardMaterial({ color: 0x8ec3ea, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false })), 0, 0.98, 0, g);
    jug.castShadow = false;
    mesh(new THREE.CylinderGeometry(0.128, 0.13, 0.3, 24), keep(new THREE.MeshStandardMaterial({ color: 0x5aa6e0, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false })), 0, 1.12, 0, g).castShadow = false; // the water in it
    return g;
  };

  // ── the fridge: top freezer, handles, magnets, the notes ──
  const fridge = (w = 0.7, d = 0.54) => {
    const g = new THREE.Group();
    const white = paint(0xefeeea, 0.32, 0.05);
    mesh(new RoundedBoxGeometry(w, 1.78, d - 0.06, 2, 0.02), white, 0, 0.9, -0.03, g);
    mesh(new RoundedBoxGeometry(w - 0.01, 0.48, 0.06, 2, 0.015), white, 0, 1.53, d / 2 - 0.03, g); // the freezer door
    mesh(new RoundedBoxGeometry(w - 0.01, 1.24, 0.06, 2, 0.015), white, 0, 0.66, d / 2 - 0.03, g); // the fridge door
    const steel = paint(0xc9cbce, 0.25, 0.85);
    mesh(new THREE.BoxGeometry(0.025, 0.22, 0.03), steel, -w / 2 + 0.06, 1.42, d / 2 + 0.02, g);
    mesh(new THREE.BoxGeometry(0.025, 0.5, 0.03), steel, -w / 2 + 0.06, 1.0, d / 2 + 0.02, g);
    mesh(new THREE.BoxGeometry(w * 0.9, 0.04, 0.02), paint(0x2a2c30, 0.6), 0, 0.04, d / 2 - 0.02, g); // the grille
    // magnets and the notes they hold
    const notes = keep(notesTex());
    const noteMat = keep(new THREE.MeshStandardMaterial({ map: notes, roughness: 0.85 }));
    for (const [k, x, y, rz] of [
      [0, 0.06, 1.08, 0.05],
      [1, 0.12, 0.76, -0.08],
    ]) {
      const geo = new THREE.PlaneGeometry(0.15, 0.15);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 2);
      const n = mesh(geo, noteMat, x, y, d / 2 + 0.002, g);
      n.rotation.z = rz;
      n.castShadow = false;
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10), paint([0xc8202a, 0x2f6fd8][k], 0.4), x, y + 0.065, d / 2 + 0.006, g).rotation.x = Math.PI / 2;
    }
    for (const [x, y, c] of [
      [-0.12, 1.25, 0xf2c230],
      [0.2, 1.62, 0x2e9b4b],
      [-0.05, 0.5, 0xe0503a],
    ])
      mesh(new RoundedBoxGeometry(0.05, 0.035, 0.012, 1, 0.004), paint(c, 0.4), x, y, d / 2 + 0.006, g);
    return g;
  };

  // ── the microwave: a door with its window, the keypad, a handle ──
  const microwave = () => {
    const g = new THREE.Group();
    mesh(new RoundedBoxGeometry(0.5, 0.29, 0.37, 2, 0.012), paint(0x232427, 0.4), 0, 0.145, 0, g);
    mesh(new THREE.BoxGeometry(0.34, 0.21, 0.004), paint(0x0b0c0e, 0.05, 0.2), -0.06, 0.15, 0.186, g); // the door's glass
    mesh(new THREE.BoxGeometry(0.11, 0.24, 0.004), paint(0x6d7075, 0.3, 0.5), 0.18, 0.145, 0.186, g); // the panel
    for (let i = 0; i < 9; i++) mesh(new THREE.BoxGeometry(0.022, 0.014, 0.004), paint(0xc9ccd0, 0.4), 0.16 + (i % 3) * 0.022, 0.1 + Math.floor(i / 3) * 0.022, 0.19, g).castShadow = false;
    mesh(new THREE.BoxGeometry(0.06, 0.02, 0.003), paint(0x062a10, 0.3, 0, { emissive: 0x3aff6a, emissiveIntensity: 1.6 }), 0.18, 0.225, 0.19, g); // the clock
    mesh(new THREE.BoxGeometry(0.018, 0.2, 0.025), paint(0x8b8e93, 0.3, 0.7), 0.105, 0.15, 0.2, g);
    return g;
  };

  // ── the coffee maker, its carafe half full ──
  const coffeeMaker = () => {
    const g = new THREE.Group();
    const black = paint(0x161719, 0.35);
    mesh(new RoundedBoxGeometry(0.22, 0.04, 0.24, 2, 0.01), black, 0, 0.02, 0, g); // the base
    mesh(new RoundedBoxGeometry(0.22, 0.36, 0.1, 2, 0.015), black, 0, 0.2, -0.07, g); // the tower
    mesh(new RoundedBoxGeometry(0.22, 0.08, 0.24, 2, 0.015), black, 0, 0.36, 0, g); // the head
    mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 20), paint(0x3a3c40, 0.3, 0.6), 0, 0.044, 0.03, g); // the hot plate
    const glass = keep(new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false }));
    mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.15, 20, 1, true), glass, 0, 0.125, 0.03, g).castShadow = false;
    mesh(new THREE.CylinderGeometry(0.07, 0.074, 0.075, 20), paint(0x2b1709, 0.15), 0, 0.087, 0.03, g); // the coffee
    mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), black, 0.08, 0.13, 0.03, g).rotation.z = -Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.01, 0.01, 0.003), paint(0x2a0505, 0.3, 0, { emissive: 0xff3a1a, emissiveIntensity: 2 }), 0.07, 0.2, -0.019, g); // on
    return g;
  };

  // ── doors and handles on the kitchen's cupboards, under the counter and
  // on the wall units over it ──
  // (w wide; the group's origin on the floor at the counter's front, the
  // wall units' fronts `overZ` behind it)
  const cupboards = (w, { under = 0.86, over = [1.5, 2.2], overZ = -0.044 } = {}) => {
    const g = new THREE.Group();
    const line = paint(0xb9b2a2, 0.6);
    const handle = paint(0xb8bbbf, 0.25, 0.85);
    const n = Math.max(2, Math.round(w / 0.5));
    const seam = (x, y0, y1, z) => (mesh(new THREE.BoxGeometry(0.004, y1 - y0, 0.004), line, x, (y0 + y1) / 2, z + 0.002, g).castShadow = false);
    const pull = (x, y, z) => (mesh(new THREE.BoxGeometry(0.012, 0.11, 0.02), handle, x, y, z + 0.01, g).castShadow = false);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / n;
      const by = i % 2 ? -1 : 1; // the handle by the door's opening edge
      if (i < n - 1) {
        seam(-w / 2 + ((i + 1) * w) / n, 0.1, under - 0.04, 0);
        seam(-w / 2 + ((i + 1) * w) / n, over[0] + 0.01, over[1] - 0.01, overZ);
      }
      pull(x + by * (w / n / 2 - 0.05), under - 0.2, 0);
      pull(x + by * (w / n / 2 - 0.05), over[0] + 0.1, overZ);
    }
    mesh(new THREE.BoxGeometry(w, 0.004, 0.004), line, 0, 0.1, 0.002, g).castShadow = false; // the kick
    return g;
  };

  return {
    dressDesks,
    copier,
    waterCooler,
    fridge,
    microwave,
    coffeeMaker,
    cupboards,
    dispose() {
      for (const o of own) o.dispose?.();
    },
  };
}
