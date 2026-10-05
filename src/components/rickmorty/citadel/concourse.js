// The Citadel's concourse, drawn: a round atrium of white panels and cyan
// light under a glass dome, the core rising through the middle with its
// ring of holo-ads, two floors of shopfronts round the edge (Simple Rick's,
// the Council's doors, the hangar, the portal terminal among them), the
// Morty Day Care pen, Candidate Morty's booth, kiosks, planters and
// benches, glass transport tubes over it all, and, through the dome, space
// and the Citadel's other spires. Built in code in the show's toon look;
// every size comes from ./layout.js, so what you see is what you bump into.

import * as THREE from 'three';
import { SWIRL_GLSL } from '../swirl';
import { toon, toonify } from '../portal/toon';
import { bake } from '../../middleearth/towns/bake';
import { makeCanvas } from '../../../lib/paint';
import { hot } from '../../../lib/stage3d';
import { ARCH, BALLPIT, BENCHES, BOOTH, BOOTH_BACK, CORE, DESKS, DOORS, KIOSKS, PEN, PLANTERS, PLANTER_R, SLIDE } from './layout';

const R = 40.6; // the shopfronts' face
const UP = 7; // the mezzanine's floor
const TOP = 16; // where the dome starts
const DOME_H = 22; // and how high it rises
const BAYS = 24;

// the Citadel's colours
const C = {
  panel: 0xeef1f6,
  panel2: 0xc9d2de,
  trim: 0x5b6f8f,
  dark: 0x232b3b,
  floor: 0x8d9ab0,
  glow: 0x6ff3ff,
  red: 0xff3b4a,
  glass: 0x9fdcff,
  pen: [0xe8483c, 0xf3c33b, 0x3e8ee0, 0x5cc06a],
};

// the angle round the ring of a point, and a ring point's inward turn
const turnIn = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));
const angleOf = (x, z) => Math.atan2(z, x);

// ── canvases ──

// the floor: rings of deck plates cut radially, seams, rivets, and two
// lit rings (the colour; the glow is a canvas of its own)
function paintDeck(size) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const m = size / 2;
  const k = size / (R * 2 + 4); // pixels a metre
  g.fillStyle = '#8f9cb3';
  g.fillRect(0, 0, size, size);
  // plates, ring by ring
  for (let ring = 0; ring * 2.6 < R + 2; ring++) {
    const r0 = ring * 2.6 * k;
    const r1 = (ring + 1) * 2.6 * k;
    const n = 8 + ring * 5;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const shade = (ring + i) % 2 ? 0 : 10;
      const tint = (i * 37 + ring * 11) % 7;
      g.fillStyle = `rgb(${138 + shade + tint}, ${151 + shade + tint}, ${172 + shade + tint})`;
      g.beginPath();
      g.arc(m, m, r1, a0, a1);
      g.arc(m, m, r0, a1, a0, true);
      g.closePath();
      g.fill();
      // a rivet at each plate's corner
      g.fillStyle = 'rgba(40, 48, 66, 0.55)';
      g.beginPath();
      g.arc(m + Math.cos(a0 + 0.02) * (r0 + 3), m + Math.sin(a0 + 0.02) * (r0 + 3), Math.max(1, k * 0.06), 0, Math.PI * 2);
      g.fill();
    }
  }
  // seams
  g.strokeStyle = 'rgba(32, 40, 58, 0.75)';
  g.lineWidth = Math.max(1, k * 0.05);
  for (let ring = 0; ring * 2.6 < R + 2; ring++) {
    g.beginPath();
    g.arc(m, m, ring * 2.6 * k, 0, Math.PI * 2);
    g.stroke();
    const n = 8 + ring * 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(m + Math.cos(a) * ring * 2.6 * k, m + Math.sin(a) * ring * 2.6 * k);
      g.lineTo(m + Math.cos(a) * (ring + 1) * 2.6 * k, m + Math.sin(a) * (ring + 1) * 2.6 * k);
      g.stroke();
    }
  }
  // the inlaid light rings (drawn pale here; they glow from the glow map)
  for (const r of [7.2, 15.5, 33]) {
    g.strokeStyle = '#d8f8ff';
    g.lineWidth = k * 0.35;
    g.beginPath();
    g.arc(m, m, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  // a walkway band from the portal up to the core, and the core's apron
  g.fillStyle = 'rgba(255, 255, 255, 0.10)';
  g.fillRect(m - 2.2 * k, m + 6 * k, 4.4 * k, 30 * k);
  return c;
}
function paintDeckGlow(size) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const m = size / 2;
  const k = size / (R * 2 + 4);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  for (const r of [7.2, 15.5, 33]) {
    g.strokeStyle = '#fff';
    g.lineWidth = k * 0.3;
    g.beginPath();
    g.arc(m, m, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

// The shop signs and windows, all on one sheet (so the shopfronts bake
// into one draw): a grid of cells, each a sign or a window.
const SIGNS = [
  // special bays
  ['SIMPLE RICK’S', '#f6e7c8', '#7a4a1e', 'wafer'],
  ['COUNCIL OF RICKS', '#e6ecf5', '#1f2b44', 'council'],
  ['HANGAR 7', '#ffd23a', '#20242c', 'stripes'],
  ['PORTAL TERMINAL', '#c8ffd0', '#14402a', 'portal'],
  // the rest
  ['PORTAL FLUID', '#c8ffd0', '#14402a'],
  ['BLIPS AND CHITZ', '#ffe0f4', '#5a1650'],
  ['PLUMBUS', '#ffd6e0', '#7a2a44'],
  ['FLASK & BEAKER', '#e8f4ff', '#1d3a5c'],
  ['MORTY ACCESSORIES', '#fff3c4', '#5c4410'],
  ['INTERDIMENSIONAL CABLE', '#e4dcff', '#2e1f66'],
  ['SZECHUAN SAUCE', '#ffe4c8', '#6a2c10'],
  ['LAB COATS', '#f2f6fa', '#2a3a4c'],
  ['MEGA SEEDS', '#e4ffd8', '#2a5a1c'],
  ['RICK’S GARAGE', '#ffeacc', '#4a3218'],
  ['ANATOMY PARK', '#d8fff4', '#145248'],
  ['SCHMECKLES EXCHANGE', '#fff8d8', '#4c4414'],
];
const SHEET = { cols: 4, rows: 6, w: 2048, h: 1536 };
function paintSigns() {
  const c = makeCanvas(SHEET.w, SHEET.h);
  const g = c.getContext('2d');
  const cw = SHEET.w / SHEET.cols;
  const ch = SHEET.h / SHEET.rows;
  // signs fill the first four rows
  SIGNS.forEach(([text, bg, ink, mark], i) => {
    const x = (i % SHEET.cols) * cw;
    const y = Math.floor(i / SHEET.cols) * ch;
    g.fillStyle = bg;
    g.fillRect(x, y, cw, ch);
    g.strokeStyle = ink;
    g.lineWidth = 10;
    g.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    if (mark === 'stripes') {
      g.save();
      g.beginPath();
      g.rect(x + 14, y + 14, cw - 28, ch - 28);
      g.clip();
      g.fillStyle = '#20242c';
      for (let s = -ch; s < cw; s += 60) {
        g.beginPath();
        g.moveTo(x + s, y + ch);
        g.lineTo(x + s + 30, y + ch);
        g.lineTo(x + s + 30 + ch, y);
        g.lineTo(x + s + ch, y);
        g.fill();
      }
      g.restore();
      g.fillStyle = '#ffd23a';
      g.fillRect(x + cw * 0.18, y + ch * 0.22, cw * 0.64, ch * 0.56);
    }
    g.fillStyle = ink;
    let size = 64;
    g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    while (g.measureText(text).width > cw - (mark && mark !== 'stripes' ? 170 : 60) && size > 24) {
      size -= 2;
      g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tx = x + cw / 2 + (mark && mark !== 'stripes' ? 50 : 0);
    g.fillText(text, tx, y + ch / 2 + 4);
    // a mark at the left: a wafer, the Council's eye, a portal
    const mx = x + 80;
    const my = y + ch / 2;
    if (mark === 'wafer') {
      g.fillStyle = '#d9a35b';
      g.fillRect(mx - 46, my - 34, 92, 68);
      g.strokeStyle = '#8a5a22';
      g.lineWidth = 4;
      for (let k = -34; k <= 34; k += 17) {
        g.beginPath();
        g.moveTo(mx - 46, my + k);
        g.lineTo(mx + 46, my + k);
        g.stroke();
      }
      g.fillStyle = '#fff6e0';
      g.fillRect(mx - 46, my - 6, 92, 12);
    } else if (mark === 'council') {
      g.fillStyle = '#1f2b44';
      g.beginPath();
      g.ellipse(mx, my, 50, 30, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#9fe8ff';
      g.beginPath();
      g.arc(mx, my, 16, 0, Math.PI * 2);
      g.fill();
    } else if (mark === 'portal') {
      const gr = g.createRadialGradient(mx, my, 4, mx, my, 46);
      gr.addColorStop(0, '#eaffd0');
      gr.addColorStop(0.5, '#7ef05a');
      gr.addColorStop(1, '#1d8a2a');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(mx, my, 46, 0, Math.PI * 2);
      g.fill();
    }
  });
  // windows: a lit shop interior, cool or warm, with shelves and shapes
  for (let i = 16; i < SHEET.cols * SHEET.rows; i++) {
    const x = (i % SHEET.cols) * cw;
    const y = Math.floor(i / SHEET.cols) * ch;
    const warm = i % 2;
    const gr = g.createLinearGradient(x, y, x, y + ch);
    gr.addColorStop(0, warm ? '#ffe7b8' : '#cdeeff');
    gr.addColorStop(1, warm ? '#c98a4a' : '#5a7fa8');
    g.fillStyle = gr;
    g.fillRect(x, y, cw, ch);
    g.fillStyle = 'rgba(30, 36, 52, 0.55)';
    for (let s = 0; s < 3; s++) g.fillRect(x + 30, y + 40 + s * 70, cw - 60, 10);
    for (let k = 0; k < 9; k++) {
      g.fillStyle = ['#e8483c', '#f3c33b', '#3e8ee0', '#5cc06a', '#a98ad8'][(k + i) % 5];
      g.fillRect(x + 40 + ((k * 53) % (cw - 100)), y + 14 + Math.floor(k / 3) * 70, 26, 26);
    }
    // glass sheen
    g.fillStyle = 'rgba(255, 255, 255, 0.18)';
    g.beginPath();
    g.moveTo(x + cw * 0.15, y);
    g.lineTo(x + cw * 0.35, y);
    g.lineTo(x + cw * 0.1, y + ch);
    g.lineTo(x - cw * 0.1, y + ch);
    g.fill();
  }
  return c;
}
// a plane showing one cell of the sheet
function cellPlane(w, h, cell) {
  const geo = new THREE.PlaneGeometry(w, h);
  const u0 = (cell % SHEET.cols) / SHEET.cols;
  const v1 = 1 - Math.floor(cell / SHEET.cols) / SHEET.rows;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / SHEET.cols, v1 - (1 - uv.getY(i)) / SHEET.rows);
  return geo;
}

// The holo-ring round the core: three ads by day, Vote Morty on election
// day, and the alert on red.
const HOLO = { w: 2048, h: 256 };
function paintHolo(c, mood) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, HOLO.w, HOLO.h);
  const panels =
    mood === 'red'
      ? [['ALERT', 'RICK C-137 IS WANTED'], ['BY ORDER OF', 'PRESIDENT MORTY'], ['ALERT', 'REPORT ANY RICK C-137']]
      : mood === 'election'
        ? [['VOTE MORTY', 'A CITADEL FOR ALL OF US'], ['ELECTION DAY', 'EVERY RICK. EVERY MORTY.'], ['VOTE MORTY', 'THE RICKS HAVE HAD THEIR TURN']]
        : [['SIMPLE RICK’S', 'THE IMPOSSIBLE FLAVOR OF YOUR OWN COMPLETION'], ['THE CITADEL', 'A CITY OF RICKS, AND THEIR MORTYS'], ['MORTY DAY CARE', 'DROP-OFFS TILL SIX']];
  const col = mood === 'red' ? '255, 70, 80' : mood === 'election' ? '255, 214, 90' : '120, 240, 255';
  const pw = HOLO.w / panels.length;
  panels.forEach(([big, small], i) => {
    const x = i * pw;
    g.fillStyle = `rgba(${col}, 0.13)`;
    g.fillRect(x + 12, 16, pw - 24, HOLO.h - 32);
    g.strokeStyle = `rgba(${col}, 0.9)`;
    g.lineWidth = 5;
    g.strokeRect(x + 12, 16, pw - 24, HOLO.h - 32);
    g.fillStyle = `rgba(${col}, 1)`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 92px "Arial Black", Arial, sans-serif';
    g.fillText(big, x + pw / 2, 100);
    let s = 34;
    g.font = `700 ${s}px Arial, sans-serif`;
    while (g.measureText(small).width > pw - 70 && s > 16) g.font = `700 ${(s -= 2)}px Arial, sans-serif`;
    g.fillText(small, x + pw / 2, 178);
  });
  // scan lines
  g.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = 0; y < HOLO.h; y += 6) g.fillRect(0, y, HOLO.w, 2);
}

// the portal's swirl, the show's green, as the rest of the site has it
const portalMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { t: { value: 0 }, seed: { value: 3 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, seed;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, t, 1.0, seed);
        if (c.a < 0.004) discard;
        gl_FragColor = c;
      }`,
  });

// ── the build ──

export async function buildConcourse(renderer, { models, tier = 'high', cruiser = null }) {
  const group = new THREE.Group();
  group.name = 'concourse';
  const statics = new THREE.Group();
  group.add(statics);
  const hide = []; // what the ink line leaves alone: sky, glass, glows
  const moving = []; // what bake leaves alone
  const lights = []; // where the light pool may go: [x, y, z, colour]
  const aniso = Math.min(tier === 'high' ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
  const tex = (canvas, { srgb = true } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };

  // materials, by role
  const M = {
    panel: toon(C.panel),
    panel2: toon(C.panel2),
    trim: toon(C.trim),
    dark: toon(C.dark),
    floorEdge: toon(0x6d7a92),
    glow: new THREE.MeshBasicMaterial({ color: hot(C.glow, 2.2) }),
    glowSoft: new THREE.MeshBasicMaterial({ color: hot(C.glow, 1.2) }),
    glass: new THREE.MeshBasicMaterial({ color: C.glass, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    rail: new THREE.MeshBasicMaterial({ color: C.glass, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    signs: null,
  };
  const mesh = (geo, mat, parent = statics) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, turn = 0, parent = statics) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat, parent);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    return m;
  };

  // ── the floor ──
  const deckSize = tier === 'low' ? 1024 : 2048;
  const floorMat = toon(0xffffff, { map: tex(paintDeck(deckSize)), emissiveMap: tex(paintDeckGlow(512)), emissive: hot(C.glow, 0.9) });
  const floor = mesh(new THREE.CircleGeometry(R + 2, 96), floorMat, group);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  // the step up to the shopfronts
  const kerb = mesh(new THREE.RingGeometry(R - 0.4, R + 0.1, 96), M.floorEdge);
  kerb.rotation.x = -Math.PI / 2;
  kerb.position.y = 0.02;

  // ── the shopfronts: two floors of bays round the edge ──
  const signsTex = tex(paintSigns());
  M.signs = new THREE.MeshBasicMaterial({ map: signsTex });
  M.windows = new THREE.MeshBasicMaterial({ map: signsTex, color: 0xdddddd });
  // the solid wall behind it all, so nothing shows through a gap
  // (with a gap for the hangar's bay: a cylinder's angle runs from +z, so a
  // ring angle a is pi/2 - a)
  const gap = 0.16;
  const hangarTheta = Math.PI / 2 - angleOf(DOORS.hangar.x, DOORS.hangar.z);
  const back = mesh(new THREE.CylinderGeometry(R + 1.5, R + 1.5, TOP + 1, 72, 1, true, hangarTheta + gap, Math.PI * 2 - gap * 2), M.panel2);
  back.material = toon(0xb9c3d1, { side: THREE.BackSide });
  back.position.y = (TOP + 1) / 2;
  // which bays are which: the special ones by their angle
  const special = { [Math.round(angleOf(DOORS.factory.x, DOORS.factory.z) / (Math.PI / 12))]: 0, [Math.round(angleOf(DOORS.council.x, DOORS.council.z) / (Math.PI / 12))]: 1, [Math.round(angleOf(DOORS.hangar.x, DOORS.hangar.z) / (Math.PI / 12))]: 2, [Math.round(angleOf(DOORS.portal.x, DOORS.portal.z) / (Math.PI / 12))]: 3 };
  let shop = 4;
  for (let i = 0; i < BAYS; i++) {
    const a = (i / BAYS) * Math.PI * 2;
    const key = Math.round(a / (Math.PI / 12)) > 12 ? Math.round(a / (Math.PI / 12)) - 24 : Math.round(a / (Math.PI / 12));
    const sp = special[key];
    const t = turnIn(a);
    const at = (r, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const chord = 2 * R * Math.sin(Math.PI / BAYS);
    // the pilaster at the bay's edge, with its light strip
    const pa = a + Math.PI / BAYS;
    const pt = turnIn(pa);
    box(1.3, TOP, 1.3, M.panel, Math.cos(pa) * (R - 0.3), TOP / 2, Math.sin(pa) * (R - 0.3), pt);
    box(0.18, TOP - 1.2, 0.08, M.glow, Math.cos(pa) * (R - 0.98), TOP / 2, Math.sin(pa) * (R - 0.98), pt);
    // the mezzanine's fascia and floor in front of this bay
    box(chord + 0.1, 0.9, 0.5, M.panel, ...at(R - 3.8, UP - 0.1), t);
    box(chord + 0.1, 0.12, 0.08, M.glow, ...at(R - 4.08, UP - 0.25), t);
    box(chord + 0.1, 0.3, 4, M.panel2, ...at(R - 1.8, UP + 0.2), t);
    // the balcony: glass, and a rail on top
    const glass = box(chord, 1.1, 0.04, M.rail, ...at(R - 3.75, UP + 0.9), t);
    hide.push(glass);
    box(chord + 0.1, 0.1, 0.16, M.glowSoft, ...at(R - 3.75, UP + 1.5), t);
    // the upper shop: a window and a sign
    const upper = mesh(cellPlane(chord - 1.8, 3.6, 16 + ((i * 5) % 8)), M.windows);
    upper.position.set(...at(R - 0.02, UP + 3.2));
    upper.rotation.y = t;
    const upSign = mesh(cellPlane(chord - 2.2, 1.2, 4 + ((i * 7) % 12)), M.signs);
    upSign.position.set(...at(R - 0.25, UP + 5.8));
    upSign.rotation.y = t;
    // the cornice under the dome
    box(chord + 0.2, 0.8, 1.6, M.trim, ...at(R - 0.6, TOP - 0.4), t);
    if (sp != null) continue; // the special bays are built below
    // the shop: a window, a door, a lit sign over it
    const win = mesh(cellPlane(chord - 1.8, 4.2, 16 + (i % 8)), M.windows);
    win.position.set(...at(R - 0.02, 2.4));
    win.rotation.y = t;
    box(chord - 1.4, 0.25, 0.3, M.trim, ...at(R - 0.12, 4.6), t);
    const sign = mesh(cellPlane(chord - 2, 1.4, shop), M.signs);
    sign.position.set(...at(R - 0.3, 5.5));
    sign.rotation.y = t;
    shop = shop >= SIGNS.length - 1 ? 4 : shop + 1;
    if (i % 3 === 0) lights.push([...at(R - 4, 3.5), 0xcfefff]);
  }

  // ── the special bays ──
  // Simple Rick's: a big lit doorway with the wafer sign
  {
    const a = angleOf(DOORS.factory.x, DOORS.factory.z);
    const t = turnIn(a);
    const at = (r, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r];
    box(6.4, 0.6, 1, M.trim, ...at(R - 0.5, 5.1), t);
    const door = mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ color: hot(0xffd9a0, 1.1) }));
    door.position.set(...at(R - 0.05, 2.3));
    door.rotation.y = t;
    for (const side of [-1, 1]) {
      const p = box(0.5, 5.4, 1, M.trim, 0, 2.7, 0, t);
      p.position.set(Math.cos(a) * (R - 0.5) + Math.cos(t) * side * 2.9, 2.7, Math.sin(a) * (R - 0.5) - Math.sin(t) * side * 2.9);
    }
    const s = mesh(cellPlane(8, 2, 0), M.signs);
    s.position.set(...at(R - 0.6, 6.2));
    s.rotation.y = t;
    lights.push([...at(R - 3, 3), 0xffd9a0]);
  }
  // the Council's doors: tall, dark, with its sign and a light either side
  {
    const a = angleOf(DOORS.council.x, DOORS.council.z);
    const t = turnIn(a);
    const at = (r, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const frame = box(7.2, 6.6, 1.2, M.trim, ...at(R - 0.4, 3.3), t);
    frame.name = 'councilFrame';
    box(5.6, 5.8, 0.4, M.dark, ...at(R - 1.0, 2.9), t);
    box(0.08, 5.6, 0.42, M.glow, ...at(R - 1.02, 2.9), t);
    const s = mesh(cellPlane(9, 1.8, 1), M.signs);
    s.position.set(...at(R - 1.1, 7.6));
    s.rotation.y = t;
    lights.push([...at(R - 4, 4), 0xbfdcff]);
  }
  // the portal terminal: an arch and the swirl, a pad on the floor
  const swirl = { mat: portalMat() };
  {
    // a ring standing on a plinth, the swirl in it
    const PR = ARCH.w / 2 - 0.25;
    const arch = mesh(new THREE.TorusGeometry(PR, 0.3, 12, 48), M.panel);
    arch.position.set(ARCH.x, PR + 0.45, ARCH.z);
    box(ARCH.w, 0.5, ARCH.d, M.trim, ARCH.x, 0.25, ARCH.z);
    const ring = mesh(new THREE.TorusGeometry(PR, 0.07, 8, 48), M.glow);
    ring.position.set(ARCH.x, PR + 0.45, ARCH.z - 0.31);
    const disc = mesh(new THREE.CircleGeometry(PR - 0.12, 48), swirl.mat, group);
    disc.position.set(ARCH.x, PR + 0.45, ARCH.z - 0.02);
    hide.push(disc);
    const pad = mesh(new THREE.RingGeometry(1.6, 2.4, 48), M.glowSoft);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.03, 35);
    const s = mesh(cellPlane(8, 1.6, 3), M.signs);
    const a = angleOf(DOORS.portal.x, DOORS.portal.z);
    s.position.set(0, 6.0, R - 0.3);
    s.rotation.y = turnIn(a);
    lights.push([0, 3, 35, 0x9effa0]);
  }
  // the hangar: blast doors in a striped frame, a bay behind with the
  // cruiser on its pad, open at the far end to space
  const hangar = new THREE.Group();
  group.add(hangar);
  const ha = angleOf(DOORS.hangar.x, DOORS.hangar.z);
  const ht = turnIn(ha);
  hangar.position.set(Math.cos(ha) * R, 0, Math.sin(ha) * R);
  hangar.rotation.y = ht + Math.PI; // its own +z points out, away from the core
  const doors = [];
  {
    const w = DOORS.hangar.w;
    const frameMat = toon(0x3a4256);
    const stripes = M.signs;
    for (const s of [-1, 1]) {
      const post = mesh(new THREE.BoxGeometry(1, 7.2, 1.4), frameMat, hangar);
      post.position.set(s * (w / 2 + 0.5), 3.6, 0);
    }
    const lintel = mesh(new THREE.BoxGeometry(w + 2, 1.2, 1.4), frameMat, hangar);
    lintel.position.set(0, 7.2, 0);
    const sign = mesh(cellPlane(w + 1.6, 1, 2), stripes, hangar);
    sign.position.set(0, 7.2, -0.72);
    sign.rotation.y = Math.PI;
    for (const s of [-1, 1]) {
      const d = mesh(new THREE.BoxGeometry(w / 2, 6.6, 0.4), toon(0x8892a6), hangar);
      d.position.set((s * w) / 4, 3.3, 0.1);
      const band = mesh(new THREE.BoxGeometry(w / 2 - 0.2, 0.5, 0.42), toon(0xffc93a), d);
      band.position.set(0, -1.2, 0);
      const lamp = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.44), M.glow, d);
      lamp.position.set(-s * (w / 4 - 0.4), 2.8, 0);
      d.userData.side = s;
      doors.push(d);
      moving.push(d);
    }
    // the bay
    const bay = new THREE.Group();
    hangar.add(bay);
    const bw = 12;
    const bd = 16;
    const floorB = mesh(new THREE.PlaneGeometry(bw, bd), toon(0x4c5468), bay);
    floorB.rotation.x = -Math.PI / 2;
    floorB.position.set(0, 0.01, bd / 2);
    for (const s of [-1, 1]) {
      const wall = mesh(new THREE.BoxGeometry(0.4, 9, bd), toon(0x9aa4b8), bay);
      wall.position.set((s * bw) / 2, 4.5, bd / 2);
      const strip = mesh(new THREE.BoxGeometry(0.1, 0.2, bd), M.glow, bay);
      strip.position.set(s * (bw / 2 - 0.25), 6.5, bd / 2);
    }
    const roof = mesh(new THREE.BoxGeometry(bw, 0.4, bd), toon(0x6a7488), bay);
    roof.position.set(0, 9, bd / 2);
    const padB = mesh(new THREE.RingGeometry(2.4, 3, 40), M.glowSoft, bay);
    padB.rotation.x = -Math.PI / 2;
    padB.position.set(0, 0.03, 6);
    // the far end, open to space through a shimmering field
    const field = mesh(new THREE.PlaneGeometry(bw, 9), new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }), bay);
    field.position.set(0, 4.5, bd);
    hide.push(field);
    lights.push([hangar.position.x + Math.cos(ha) * 6, 5, hangar.position.z + Math.sin(ha) * 6, 0xffd9a0]);
  }
  const cruiserAt = new THREE.Group();
  hangar.add(cruiserAt);
  cruiserAt.position.set(0, 0, 6);
  cruiserAt.rotation.y = Math.PI; // nose to the doors
  const setCruiser = (c) => {
    cruiserAt.clear();
    if (c) cruiserAt.add(c);
  };
  if (cruiser) setCruiser(cruiser);

  // ── the core ──
  {
    const core = mesh(new THREE.CylinderGeometry(CORE.r, CORE.r, 70, 64, 1, true), M.panel);
    core.position.y = 35;
    const plinth = mesh(new THREE.CylinderGeometry(CORE.r + 0.35, CORE.r + 0.6, 0.6, 64), M.trim);
    plinth.position.y = 0.3;
    // grooves, and light rings up it
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      box(0.16, 24, 0.2, i % 3 ? M.panel2 : M.glowSoft, Math.cos(a) * (CORE.r + 0.04), 13, Math.sin(a) * (CORE.r + 0.04), turnIn(a));
    }
    for (const y of [0.7, 3.4, 12.5, 17.5, 26]) {
      const ring = mesh(new THREE.TorusGeometry(CORE.r + 0.12, 0.1, 6, 72), M.glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
    }
    // the bands that carry the holo-ring
    for (const y of [6.6, 11.4]) {
      const band = mesh(new THREE.CylinderGeometry(CORE.r + 0.6, CORE.r + 0.6, 0.5, 64), M.trim);
      band.position.y = y;
    }
    lights.push([0, 4, 8, 0xcff6ff], [8, 4, 0, 0xcff6ff], [-8, 4, 0, 0xcff6ff], [0, 4, -8, 0xcff6ff]);
  }
  const holoCanvas = makeCanvas(HOLO.w, HOLO.h);
  paintHolo(holoCanvas, 'day');
  const holoTex = tex(holoCanvas);
  holoTex.wrapS = THREE.RepeatWrapping;
  holoTex.repeat.set(2, 1);
  const holo = mesh(new THREE.CylinderGeometry(CORE.r + 1.3, CORE.r + 1.3, 4.2, 96, 1, true), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }), group);
  holo.position.y = 9;
  hide.push(holo);

  // ── Morty Day Care ──
  const gate = [];
  {
    const x0 = PEN.x - PEN.w / 2;
    const x1 = PEN.x + PEN.w / 2;
    const z0 = PEN.z - PEN.d / 2;
    const z1 = PEN.z + PEN.d / 2;
    const mats = C.pen.map((c) => toon(c));
    const post = new THREE.CylinderGeometry(0.08, 0.08, 1.15, 8);
    const sides = [
      [x0, z0, x1, z0],
      [x0, z1, x1, z1],
      [x0, z0, x0, z1],
      [x1, z0, x1, PEN.gate.z0],
      [x1, PEN.gate.z1, x1, z1],
    ];
    let k = 0;
    for (const [ax, az, bx, bz] of sides) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 1.4));
      for (let i = 0; i <= n; i++) {
        const p = mesh(post, M.panel);
        p.position.set(ax + ((bx - ax) * i) / n, 0.58, az + ((bz - az) * i) / n);
      }
      for (let i = 0; i < n; i++) {
        const cx = ax + ((bx - ax) * (i + 0.5)) / n;
        const cz = az + ((bz - az) * (i + 0.5)) / n;
        const panel = box(len / n - 0.18, 0.7, 0.08, mats[k++ % mats.length], cx, 0.55, cz, Math.atan2(-(bz - az), bx - ax));
        void panel;
      }
    }
    // the gate's two leaves, hinged at the posts
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(x1, 0, s < 0 ? PEN.gate.z0 : PEN.gate.z1);
      group.add(hinge);
      const leaf = mesh(new THREE.BoxGeometry(0.08, 0.8, 1.9), mats[2], hinge);
      leaf.position.set(0, 0.55, -s * 0.95);
      hinge.userData.side = s;
      gate.push(hinge);
    }
    // the arch over the gate, with its sign
    for (const s of [-1, 1]) box(0.3, 3.4, 0.3, M.panel, x1 + 0.2, 1.7, s * 2.6);
    box(0.3, 0.3, 5.5, M.trim, x1 + 0.2, 3.4, 0);
    const signCanvas = makeCanvas(1024, 256);
    {
      const g = signCanvas.getContext('2d');
      const colors = ['#e8483c', '#f3c33b', '#3e8ee0', '#5cc06a'];
      g.fillStyle = '#fff8e8';
      g.fillRect(0, 0, 1024, 256);
      g.lineWidth = 14;
      g.strokeStyle = '#3e8ee0';
      g.strokeRect(7, 7, 1010, 242);
      g.font = '900 104px "Arial Black", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const text = 'MORTY DAY CARE';
      let x = 512 - g.measureText(text).width / 2;
      g.textAlign = 'left';
      [...text].forEach((ch, i) => {
        g.fillStyle = colors[i % 4];
        g.fillText(ch, x, 134);
        x += g.measureText(ch).width;
      });
    }
    const sign = mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: tex(signCanvas) }));
    sign.position.set(x1 + 0.4, 4.15, 0);
    sign.rotation.y = Math.PI / 2;
    // a soft floor inside
    const mat = mesh(new THREE.PlaneGeometry(PEN.w - 0.4, PEN.d - 0.4), toon(0x7fb6e8));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(PEN.x, 0.015, PEN.z);
    // the slide: a ladder tower, a platform, and the slide down
    const tower = box(SLIDE.w, 2.1, 1.2, toon(0xf3c33b), SLIDE.x, 1.05, SLIDE.z - SLIDE.d / 2 + 0.6);
    void tower;
    const chute = box(SLIDE.w * 0.8, 0.12, SLIDE.d - 0.6, toon(0xe8483c), SLIDE.x, 1.05, SLIDE.z + 0.45);
    chute.rotation.x = 0.55;
    for (const s of [-1, 1]) box(0.08, 0.35, SLIDE.d - 0.6, toon(0xe8483c), SLIDE.x + (s * SLIDE.w * 0.8) / 2, 1.22, SLIDE.z + 0.45).rotation.x = 0.55;
    // the ball pit
    const pit = mesh(new THREE.CylinderGeometry(BALLPIT.r, BALLPIT.r, 0.6, 32, 1, true), toon(0x3e8ee0, { side: THREE.DoubleSide }));
    pit.position.set(BALLPIT.x, 0.3, BALLPIT.z);
    const lip = mesh(new THREE.TorusGeometry(BALLPIT.r, 0.1, 8, 40), toon(0xf3c33b));
    lip.rotation.x = Math.PI / 2;
    lip.position.set(BALLPIT.x, 0.6, BALLPIT.z);
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), toon(0xffffff), 150);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < 150; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt(i / 150) * (BALLPIT.r - 0.15);
      m4.makeTranslation(BALLPIT.x + Math.cos(a) * r, 0.42 + (i % 3) * 0.06, BALLPIT.z + Math.sin(a) * r);
      balls.setMatrixAt(i, m4);
      balls.setColorAt(i, col.set(C.pen[i % 4]));
    }
    group.add(balls);
    // the Day Care Rick's desk and chair
    box(DESKS.daycare.w, 0.1, DESKS.daycare.d, M.panel, DESKS.daycare.x, 0.95, DESKS.daycare.z);
    box(DESKS.daycare.w - 0.1, 0.9, DESKS.daycare.d - 0.3, M.panel2, DESKS.daycare.x, 0.45, DESKS.daycare.z);
    lights.push([PEN.x, 3.5, PEN.z, 0xfff1d0]);
  }
  // Kenney's chair for the Day Care Rick (and his magazine on the desk)
  const chair = await models?.load?.('station-chair');
  if (chair) {
    const c = models.single(chair, 1.15);
    toonify(c);
    c.position.set(DESKS.daycare.x, 0, DESKS.daycare.z - 1.35);
    c.rotation.y = Math.PI;
    group.add(c);
    moving.push(c);
  }

  // ── Candidate Morty's booth ──
  const booth = new THREE.Group();
  booth.position.set(BOOTH.x, 0, BOOTH.z);
  booth.rotation.y = BOOTH.turn;
  group.add(booth);
  const bannerCanvas = makeCanvas(1024, 512);
  const paintBanner = (mood) => {
    const g = bannerCanvas.getContext('2d');
    if (mood === 'day') {
      g.fillStyle = '#7d8798';
      g.fillRect(0, 0, 1024, 512);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < 512; y += 32) g.fillRect(0, y, 1024, 6);
      g.fillStyle = '#e8edf4';
      g.font = '900 80px "Arial Black", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('ELECTION DAY', 512, 200);
      g.font = '700 52px Arial, sans-serif';
      g.fillText('COMING SOON', 512, 320);
      return;
    }
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#1f3a8a';
    g.fillRect(0, 0, 1024, 120);
    g.fillStyle = '#c8262e';
    g.fillRect(0, 392, 1024, 120);
    // Morty's face, the campaign's
    g.fillStyle = '#f5d3a8';
    g.beginPath();
    g.arc(200, 256, 112, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6b3d1c';
    g.beginPath();
    g.arc(200, 236, 118, Math.PI, 0);
    g.fill();
    g.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(200 + s * 40, 260, 30, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(160, 262, 6, 0, Math.PI * 2);
    g.fill();
    g.fillRect(212, 238, 56, 46); // the patch
    g.fillRect(150, 230, 120, 6);
    g.strokeStyle = '#111';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(170, 322);
    g.lineTo(230, 318);
    g.stroke();
    g.fillStyle = '#1f3a8a';
    g.font = '900 120px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('VOTE', 650, 200);
    g.fillStyle = '#c8262e';
    g.fillText('MORTY', 650, 320);
  };
  paintBanner('day');
  const bannerTex = tex(bannerCanvas);
  {
    const podium = mesh(new THREE.BoxGeometry(BOOTH.w, 1.15, BOOTH.d), M.panel, booth);
    podium.position.y = 0.575;
    const front = mesh(new THREE.BoxGeometry(BOOTH.w + 0.1, 0.18, BOOTH.d + 0.1), M.trim, booth);
    front.position.y = 1.2;
    // the backboard, with room for Candidate Morty between it and the podium
    const backboard = mesh(new THREE.BoxGeometry(BOOTH_BACK.w, 3.1, BOOTH_BACK.d), M.trim, booth);
    backboard.position.set(0, 1.55, -BOOTH_BACK.back);
    const banner = mesh(new THREE.PlaneGeometry(BOOTH.w + 0.3, (BOOTH.w + 0.3) / 2), new THREE.MeshBasicMaterial({ map: bannerTex }), booth);
    banner.position.set(0, 2.05, -BOOTH_BACK.back + BOOTH_BACK.d / 2 + 0.01);
    const ballot = mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), toon(0x1f3a8a), booth);
    ballot.position.set(0.9, 1.6, 0.1);
    const slot = mesh(new THREE.BoxGeometry(0.4, 0.02, 0.06), M.dark, booth);
    slot.position.set(0.9, 1.91, 0.1);
  }
  const posters = new THREE.Group();
  group.add(posters);
  for (const [x, z] of [
    [-25.5, -16.6],
    [-16.6, -25.5],
  ]) {
    const stand = new THREE.Group();
    stand.position.set(x, 0, z);
    stand.rotation.y = BOOTH.turn;
    posters.add(stand);
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), M.trim, stand);
    pole.position.y = 1.2;
    const p = mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide }), stand);
    p.position.y = 2.1;
  }
  moving.push(booth, posters);

  // ── cover: kiosks, planters, benches; the customs desk ──
  for (const k of KIOSKS) {
    const body = mesh(new THREE.CylinderGeometry(k.w * 0.62, k.w * 0.68, 3.1, 6), M.panel);
    body.position.set(k.x, 1.55, k.z);
    body.rotation.y = k.turn;
    const cap = mesh(new THREE.CylinderGeometry(k.w * 0.72, k.w * 0.72, 0.25, 6), M.trim);
    cap.position.set(k.x, 3.2, k.z);
    cap.rotation.y = k.turn;
    const capGlow = mesh(new THREE.CylinderGeometry(k.w * 0.73, k.w * 0.73, 0.06, 6), M.glow);
    capGlow.position.set(k.x, 3.05, k.z);
    capGlow.rotation.y = k.turn;
    // a map screen on each of three faces
    for (let f = 0; f < 3; f++) {
      const a = k.turn + (f * Math.PI * 2) / 3 + Math.PI / 6;
      const scr = mesh(cellPlane(1.2, 0.9, 16 + f), M.windows);
      // (the face's distance in, at the screen's height)
      const r = k.w * (0.68 - (0.06 * 1.8) / 3.1) * Math.cos(Math.PI / 6) + 0.03;
      scr.position.set(k.x + Math.sin(a) * r, 1.8, k.z + Math.cos(a) * r);
      scr.rotation.y = a;
    }
  }
  const leafA = toon(0x3fae8a);
  const leafB = toon(0x7a5ad0);
  for (const [x, z] of PLANTERS) {
    const pot = mesh(
      new THREE.LatheGeometry(
        [
          [0.9, 0],
          [PLANTER_R, 0.15],
          [PLANTER_R, 0.85],
          [PLANTER_R - 0.12, 0.95],
          [0.2, 0.95],
        ].map(([a, b]) => new THREE.Vector2(a, b)),
        32,
      ),
      M.panel,
    );
    pot.position.set(x, 0, z);
    const band = mesh(new THREE.TorusGeometry(PLANTER_R + 0.01, 0.05, 6, 40), M.glowSoft);
    band.rotation.x = Math.PI / 2;
    band.position.set(x, 0.62, z);
    // an alien shrub: a trunk and puffs of leaves, tall enough to hide behind
    const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 8), toon(0x6a4a3a));
    trunk.position.set(x, 1.6, z);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4 + x;
      const puff = mesh(new THREE.IcosahedronGeometry(0.75 - i * 0.06, 1), i % 2 ? leafB : leafA);
      puff.position.set(x + Math.cos(a) * 0.45, 1.7 + i * 0.28, z + Math.sin(a) * 0.45);
      puff.scale.set(1, 0.8, 1);
    }
  }
  for (const b of BENCHES) {
    box(b.w, 0.1, b.d, M.panel, b.x, 0.48, b.z, b.turn);
    for (const s of [-1, 1]) {
      const leg = box(0.12, 0.46, b.d - 0.1, M.trim, b.x, 0.23, b.z, b.turn);
      leg.position.x += Math.cos(b.turn) * s * (b.w / 2 - 0.25);
      leg.position.z -= Math.sin(b.turn) * s * (b.w / 2 - 0.25);
    }
  }
  {
    const d = DESKS.customs;
    box(d.w, 1.05, d.d, M.panel, d.x, 0.525, d.z, d.turn);
    box(d.w + 0.1, 0.12, d.d + 0.1, M.trim, d.x, 1.1, d.z, d.turn);
    box(d.w, 0.08, 0.06, M.glow, d.x, 0.9, d.z + d.d / 2 + 0.01, d.turn);
    for (const s of [-1, 1]) {
      const scr = mesh(cellPlane(0.9, 0.6, 17), M.windows);
      scr.position.set(d.x + s * 0.8, 1.45, d.z - 0.2);
      scr.rotation.y = Math.PI;
      scr.rotation.x = -0.2;
    }
    const pole = box(0.12, 4.2, 0.12, M.trim, d.x + 2, 2.1, d.z + 0.3);
    void pole;
    const signCanvas = makeCanvas(512, 128);
    const g = signCanvas.getContext('2d');
    g.fillStyle = '#1f2b44';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#9fe8ff';
    g.font = '900 68px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CUSTOMS', 256, 68);
    const s = mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex(signCanvas), side: THREE.DoubleSide }));
    s.position.set(d.x + 2, 4.1, d.z + 0.3);
  }

  // ── the dome, its ribs, and the transport tubes ──
  const domeGeo = new THREE.SphereGeometry(R + 0.4, 64, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = mesh(domeGeo, M.glass, group);
  dome.scale.set(1, DOME_H / (R + 0.4), 1);
  dome.position.y = TOP;
  hide.push(dome);
  const ribMat = M.panel;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const th = (k / 16) * (Math.PI / 2) * 0.93;
      const r = (R + 0.2) * Math.cos(th);
      pts.push(new THREE.Vector3(Math.cos(a) * r, TOP + DOME_H * Math.sin(th), Math.sin(a) * r));
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.32, 6, false), ribMat);
  }
  for (const th of [0.35, 0.8]) {
    const ring = mesh(new THREE.TorusGeometry((R + 0.2) * Math.cos(th), 0.28, 6, 96), ribMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = TOP + DOME_H * Math.sin(th);
  }
  const tubes = [];
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const podMat = toon(0xf4f7fb, { emissive: hot(0x6ff3ff, 0.15) });
  const podGeo = new THREE.CapsuleGeometry(0.62, 1.5, 6, 12);
  const jointGeo = new THREE.TorusGeometry(1.02, 0.1, 6, 20);
  const routes = [
    [
      [-38, 19, -10],
      [-15, 23, -4],
      [CORE.r + 0.5, 25, 0],
    ],
    [
      [26, 21, -29],
      [10, 27, -14],
      [-12, 26, 12],
      [-26, 22, 30],
    ],
    [
      [37, 18, 14],
      [18, 22, 8],
      [0, 29, -CORE.r - 0.5],
    ],
  ];
  for (const r of routes) {
    const curve = new THREE.CatmullRomCurve3(r.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const tube = mesh(new THREE.TubeGeometry(curve, 64, 1, 12, false), tubeMat, group);
    hide.push(tube);
    const len = curve.getLength();
    for (let s = 0; s <= len; s += 5) {
      const p = curve.getPointAt(s / len);
      const tan = curve.getTangentAt(s / len);
      const j = mesh(jointGeo, M.glowSoft);
      j.position.copy(p);
      j.lookAt(p.clone().add(tan));
    }
    const pods = [0, 0.5].map(() => {
      const p = new THREE.Mesh(podGeo, podMat);
      group.add(p);
      moving.push(p);
      return p;
    });
    tubes.push({ curve, pods, speed: 9 / len });
  }

  // ── outside: space, the Citadel's other spires, a planet ──
  const sky = new THREE.Group();
  sky.name = 'sky';
  group.add(sky);
  hide.push(sky);
  {
    const n = tier === 'low' ? 1200 : 2600;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * 420, Math.abs(u) * 420 - 40, Math.sin(th) * s * 420], i * 3);
      const k = 0.6 + Math.random() * 0.4;
      col.set([k, k * (0.9 + Math.random() * 0.1), k + Math.random() * 0.1], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sky.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false, fog: false, depthWrite: false })));
    // a backdrop: deep blue to violet
    const bg = new THREE.Mesh(
      new THREE.SphereGeometry(450, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec3 vP;
          void main() {
            float h = vP.y;
            vec3 low = vec3(0.07, 0.06, 0.16), mid = vec3(0.03, 0.05, 0.13), top = vec3(0.01, 0.015, 0.05);
            vec3 c = mix(low, mid, smoothstep(-0.1, 0.3, h));
            c = mix(c, top, smoothstep(0.3, 0.9, h));
            float neb = smoothstep(0.55, 1.0, sin(vP.x * 3.1 + vP.z * 2.3) * 0.5 + 0.5) * smoothstep(0.0, 0.5, h);
            c += vec3(0.16, 0.06, 0.22) * neb * 0.5;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    bg.renderOrder = -10;
    sky.add(bg);
    // the planet, low over the edge of the dome
    const planet = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 32), toon(0x5a7ad0, { fog: false }));
    planet.position.set(-220, 40, -330);
    sky.add(planet);
    const ringP = new THREE.Mesh(new THREE.RingGeometry(110, 150, 64), new THREE.MeshBasicMaterial({ color: 0x9ab0e8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false, depthWrite: false }));
    ringP.position.copy(planet.position);
    ringP.rotation.set(1.2, 0.3, 0.2);
    sky.add(ringP);
    // the spires: tall white towers round about, lit in strips
    const spireMat = toon(0xdfe5ee, { fog: false });
    const windowMat = new THREE.MeshBasicMaterial({ color: hot(0x9feeff, 1.4), fog: false });
    const win = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.5, 1), windowMat, 8 * 14);
    const m4 = new THREE.Matrix4();
    let w = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const d = 130 + (i % 3) * 30;
      const h = 70 + ((i * 37) % 60);
      const prof = [
        [0, -60],
        [9, -60],
        [7, h * 0.3],
        [5, h * 0.7],
        [2.5, h],
        [0.3, h + 14],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const sp = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), spireMat);
      sp.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      sky.add(sp);
      for (let k = 0; k < 14; k++) {
        const y = -20 + k * (h / 14);
        const rr = 7 - (k / 14) * 4;
        m4.compose(new THREE.Vector3(sp.position.x - Math.cos(a) * rr, y, sp.position.z - Math.sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(0.4, 1, rr * 0.9));
        win.setMatrixAt(w++, m4);
      }
    }
    sky.add(win);
  }

  // what never moves, merged (and the merged glass kept out of the ink)
  const baked = bake(statics, moving);
  statics.add(baked);
  baked.traverse((o) => {
    if (o.material === M.rail || o.material === M.glass) hide.push(o);
  });

  // ── moods, and what moves ──
  const glowCols = { day: hot(C.glow, 2.2), election: hot(C.glow, 2.2), red: hot(C.red, 2.4) };
  const softCols = { day: hot(C.glow, 1.2), election: hot(C.glow, 1.2), red: hot(C.red, 1.3) };
  let mood = 'day';
  const setMood = (m) => {
    if (m === mood) return;
    mood = m;
    M.glow.color.copy(glowCols[m] ?? glowCols.day);
    M.glowSoft.color.copy(softCols[m] ?? softCols.day);
    floorMat.emissive.copy(m === 'red' ? hot(C.red, 0.8) : hot(C.glow, 0.9));
    paintHolo(holoCanvas, m);
    holoTex.needsUpdate = true;
    paintBanner(m === 'day' ? 'day' : 'vote');
    bannerTex.needsUpdate = true;
    posters.visible = m !== 'day';
  };
  posters.visible = false;

  let gateK = 0;
  let doorK = 0;
  const update = (t, dt, { gateOpen = false, hangarOpen = false, escapeT = null } = {}) => {
    holo.rotation.y = t * 0.06;
    swirl.mat.uniforms.t.value = t;
    gateK += ((gateOpen ? 1 : 0) - gateK) * Math.min(1, dt * 3);
    for (const h of gate) h.rotation.y = -h.userData.side * gateK * 1.6; // out, to the east
    doorK += ((hangarOpen ? 1 : 0) - doorK) * Math.min(1, dt * 1.6);
    for (const d of doors) d.position.x = d.userData.side * (DOORS.hangar.w / 4 + doorK * (DOORS.hangar.w / 2 - 0.2));
    for (const tb of tubes) {
      tb.pods.forEach((p, i) => {
        const u = (t * tb.speed + i * 0.5) % 1;
        p.position.copy(tb.curve.getPointAt(u));
        p.lookAt(tb.curve.getPointAt(Math.min(1, u + 0.01)));
        p.rotateX(Math.PI / 2);
      });
    }
    // the cruiser: up off its pad, round, and out through the far field
    if (escapeT != null) {
      const k = Math.max(0, escapeT - 1.2);
      cruiserAt.position.set(0, Math.min(2.2, k * 1.6) + Math.sin(t * 3) * 0.05, 6 + Math.max(0, k - 1.2) ** 2 * 7);
      cruiserAt.rotation.y = Math.PI + Math.min(Math.PI, Math.max(0, k - 0.4) * 2.6);
      cruiserAt.rotation.z = Math.sin(Math.min(1, k) * Math.PI) * 0.12;
    } else {
      cruiserAt.position.set(0, Math.sin(t * 1.4) * 0.04, 6);
      cruiserAt.rotation.set(0, Math.PI, 0);
    }
  };
  // the escape's camera: in the hangar's doorway, watching the cruiser go
  const escapeCam = () => {
    const at = new THREE.Vector3(0, 3.2, -3.5);
    const look = new THREE.Vector3(0, 1.6, 0).add(cruiserAt.position);
    hangar.localToWorld(at);
    hangar.localToWorld(look);
    return { at, look };
  };

  const dispose = () => {
    group.traverse((o) => {
      if (o.userData?.shared) return;
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose?.();
      }
    });
  };

  return { group, hide, lights, setMood, update, escapeCam, setCruiser, swirl, dispose };
}
