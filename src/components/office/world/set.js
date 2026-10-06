// Dunder Mifflin Scranton, the world: the set, built full height to walk
// round in. The bullpen's cream walls and blue-grey carpet, the drop
// ceiling and its fluorescent troffers, windows with vertical blinds on the
// outside walls, the glass fronts of Michael's office and the conference
// room with their blinds half open, every desk dressed as its owner keeps
// it, reception's curved counter, the kitchen hallway, the restrooms, Ryan's
// closet, the annex and its break room, Darryl's office, the supply room,
// the stairwell, and the lobby with the lift and Vance Refrigeration across
// the hall. From the page's office kit (../kit.js, ../props.js), so the two
// offices are dressed alike.
//
// buildSet(kit, props) → { group, seats, chairs, lights, dwightStapler,
// jello, chiliPot, spill(at), bin, update(t, mood) }

import * as THREE from 'three';
import { merge } from '../kit';
import { CEILING, COPIER, COOLER, DOORS, FILES, FIRE_BIN, FRIDGE, LEAVES, P, PANES, roomAt, PLANTS, RECEPTION, ROOMS, SEATS, SHELVES, SOLID, STAIRWELL, U, VENDING, rect } from './layout';
import { BREAK_TABLES, CONFERENCE_TABLE, KITCHEN_COUNTER, KITCHEN_TABLE, STAFF } from '../layout';
import { buildWindows } from './windows';
import { TILE_X, buildFixtures } from './fixtures';
import { makeFurnish } from './furnish';
import * as art from './art';
import { sharpen } from '../../../lib/three/textures';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const texOf = (c, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  sharpen(t);
  return t;
};

// ── painted textures ──────────────────────────────────────────────────────
// the drop ceiling: 2×4 ft tiles in a white grid, a little speckled
function ceilingTex() {
  const c = canvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#eceae3';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(120,118,110,${Math.random() * 0.18})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  x.fillStyle = '#d9d7d0';
  x.fillRect(0, 0, 256, 5);
  x.fillRect(0, 128, 256, 5);
  x.fillRect(0, 0, 5, 256);
  const t = texOf(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// the company's name, on the wall in the lobby and behind reception
function logoTex(dark = false) {
  const c = canvas(1024, 300);
  const x = c.getContext('2d');
  x.fillStyle = dark ? '#2b2e33' : '#f4f2ec';
  x.fillRect(0, 0, 1024, 300);
  // the two words side by side, measured so they never run into each other
  x.font = 'bold 128px Arial, Helvetica, sans-serif';
  x.textBaseline = 'alphabetic';
  const gap = 34;
  const a = x.measureText('DUNDER').width;
  const b = x.measureText('MIFFLIN').width;
  const k = Math.min(1, 940 / (a + gap + b));
  x.save();
  x.translate(512, 0);
  x.scale(k, 1);
  const left = -(a + gap + b) / 2;
  x.fillStyle = dark ? '#f4f2ec' : '#121212';
  x.fillText('DUNDER', left, 168);
  x.fillStyle = '#2a5ea8';
  x.fillText('MIFFLIN', left + a + gap, 168);
  x.restore();
  x.fillStyle = dark ? '#d8d6cf' : '#3a3a3a';
  x.textAlign = 'center';
  x.font = 'italic 40px Georgia, serif';
  x.fillText('Paper Company, Inc.', 512, 236);
  return texOf(c);
}
function plateTex(lines, { bg = '#2a2c30', fg = '#e9e6dc', w = 512, h = 160, size = 52, font = 'Arial, sans-serif' } = {}) {
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach((l, i) => {
    x.font = `${i ? '' : 'bold '}${i ? size * 0.55 : size}px ${font}`;
    x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 0.95);
  });
  return texOf(c);
}
// Pam's watercolour of the building: the low white office block, its lot and a tree
function paintingTex() {
  const c = canvas(512, 360);
  const x = c.getContext('2d');
  x.fillStyle = '#f3efe4';
  x.fillRect(0, 0, 512, 360);
  const wash = (col, a, f) => {
    x.globalAlpha = a;
    x.fillStyle = col;
    f();
    x.globalAlpha = 1;
  };
  wash('#9cc0dc', 0.55, () => x.fillRect(24, 20, 464, 170));
  wash('#d8d2c2', 0.9, () => x.fillRect(70, 120, 360, 120));
  wash('#5c6f86', 0.65, () => {
    for (let i = 0; i < 6; i++) x.fillRect(90 + i * 56, 150, 40, 26);
    for (let i = 0; i < 6; i++) x.fillRect(90 + i * 56, 196, 40, 26);
  });
  wash('#6f8f4f', 0.7, () => {
    x.beginPath();
    x.ellipse(440, 170, 42, 64, 0, 0, Math.PI * 2);
    x.fill();
  });
  wash('#8a8a86', 0.55, () => x.fillRect(24, 240, 464, 90));
  wash('#3a3a3a', 0.8, () => {
    x.font = 'bold 18px Arial';
    x.fillText('SCRANTON BUSINESS PARK', 150, 112);
  });
  x.strokeStyle = '#5a3b22';
  x.lineWidth = 22;
  x.strokeRect(0, 0, 512, 360);
  return texOf(c);
}
function whiteboardTex() {
  const c = canvas(512, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#fbfbf8';
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#1d3f9a';
  x.font = 'bold 30px "Comic Sans MS", "Marker Felt", cursive';
  x.fillText('TODAY:', 26, 46);
  x.font = '26px "Comic Sans MS", "Marker Felt", cursive';
  ['1. Morale', '2. Fun', '3. Morale (again)', '4. Toby (NO)'].forEach((l, i) => x.fillText(l, 40, 92 + i * 38));
  x.fillStyle = '#c0282e';
  x.font = 'bold 26px "Comic Sans MS", cursive';
  x.fillText('Party Planning Cmte → 4pm', 250, 230);
  x.strokeStyle = '#9aa0a8';
  x.lineWidth = 10;
  x.strokeRect(0, 0, 512, 256);
  return texOf(c);
}
function vendingTex(drinks) {
  const c = canvas(256, 512);
  const x = c.getContext('2d');
  x.fillStyle = drinks ? '#b3222b' : '#1e2329';
  x.fillRect(0, 0, 256, 512);
  x.fillStyle = '#0d1a22';
  x.fillRect(16, 24, 168, 400);
  const cols = drinks ? ['#c8102e', '#1d5bb8', '#f2c230', '#2e9b4b', '#ffffff'] : ['#e8b23a', '#c0392b', '#7d4a2a', '#f4e04d', '#3a6fb8', '#e67e22'];
  for (let r = 0; r < 6; r++)
    for (let k = 0; k < 4; k++) {
      x.fillStyle = cols[(r * 4 + k) % cols.length];
      x.fillRect(24 + k * 40, 36 + r * 64, drinks ? 26 : 32, drinks ? 46 : 36);
      x.fillStyle = '#9aa3aa';
      x.fillRect(22 + k * 40, 88 + r * 64, 36, 3);
    }
  x.fillStyle = '#c9ced3';
  x.fillRect(196, 60, 46, 120);
  x.fillStyle = '#20262c';
  for (let i = 0; i < 9; i++) x.fillRect(204 + (i % 3) * 12, 72 + Math.floor(i / 3) * 16, 8, 10);
  x.fillStyle = '#111';
  x.fillRect(30, 440, 150, 50);
  if (drinks) {
    x.fillStyle = '#fff';
    x.font = 'bold italic 40px Arial';
    x.fillText('Ice Cold', 36, 500);
  }
  return texOf(c);
}
function boardTex() {
  const c = canvas(512, 320);
  const x = c.getContext('2d');
  x.fillStyle = '#b78b5a';
  x.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 1600; i++) {
    x.fillStyle = `rgba(90,60,30,${Math.random() * 0.25})`;
    x.fillRect(Math.random() * 512, Math.random() * 320, 2, 2);
  }
  const notes = [
    ['#fffbe6', 'PARTY PLANNING', 'COMMITTEE', 'Meeting Thurs'],
    ['#e6f1ff', 'FUN RUN', 'Michael Scott’s', 'Rabies Awareness'],
    ['#ffeef0', 'LOST:', 'Cat figurine', 'see Angela'],
    ['#efffe6', 'Pretzel Day', 'is coming', '— Stanley'],
    ['#ffffff', 'SAFETY FIRST', 'Fire drill', 'procedures'],
  ];
  notes.forEach(([bg, a, b, d], i) => {
    const nx = 18 + (i % 3) * 165 + (i > 2 ? 80 : 0);
    const ny = 18 + Math.floor(i / 3) * 150;
    x.save();
    x.translate(nx + 70, ny + 60);
    x.rotate((i % 2 ? 1 : -1) * 0.04);
    x.fillStyle = bg;
    x.fillRect(-70, -60, 140, 120);
    x.fillStyle = '#c0282e';
    x.beginPath();
    x.arc(0, -52, 5, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#1b1b1b';
    x.textAlign = 'center';
    x.font = 'bold 15px Arial';
    x.fillText(a, 0, -20);
    x.font = '14px Arial';
    x.fillText(b, 0, 4);
    x.fillText(d, 0, 26);
    x.restore();
  });
  return texOf(c);
}

export async function buildSet(kit, props, { tier = 'high' } = {}) {
  const group = new THREE.Group();
  const own = [];
  const keep = (x) => {
    own.push(x);
    return x;
  };
  const add = (o, parent = group) => {
    parent.add(o);
    return o;
  };
  const mat = (o) => keep(new THREE.MeshStandardMaterial(o));
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = group) => {
    const o = new THREE.Mesh(keep(geo), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    return add(o, parent);
  };
  const W = (px, py) => P(px, py);
  const big = tier !== 'low';

  // ── floors ──
  const floorRect = (r, material, y = 0) => {
    const m = rect(r);
    const geo = new THREE.PlaneGeometry(m.w, m.d);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * m.w, uv.getY(i) * m.d);
    geo.rotateX(-Math.PI / 2);
    const o = mesh(geo, material, m.cx, y, m.cz);
    o.castShadow = false;
    return o;
  };
  const surf = (name, extra) => {
    const m = kit.surface(name, 1, 1, 1, extra);
    for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) m[k].repeat.set(1 / 1.1, 1 / 1.1);
    return m;
  };
  const carpet = surf('carpet', { color: 0xaeb8c8 });
  const tiles = surf('tiles', { color: 0xe6e1d4 });
  const lobbyTiles = surf('tiles', { color: 0xcfc8b8 });
  for (const id of ['bullpen', 'michael', 'conference', 'annex', 'breakroom', 'darryl', 'supplies']) floorRect(ROOMS[id], carpet, id === 'bullpen' ? 0 : 0.002);
  for (const id of ['hallway', 'men', 'women']) floorRect(ROOMS[id], tiles, 0.004);
  floorRect(ROOMS.closet, carpet, 0.006);
  floorRect(ROOMS.lobby, lobbyTiles, 0.002);
  // the stairwell's landing: concrete, round the opening the stairs go down
  {
    const conc = mat({ color: 0x9a9a94, roughness: 0.9 });
    const room = rect(ROOMS.stairs);
    const f = STAIRWELL.flight;
    const ox0 = f.x - f.w / 2;
    const ox1 = f.x + f.w / 2;
    const oz0 = f.z - f.d / 2;
    const oz1 = f.z + f.d / 2;
    const slab = (x0, z0, x1, z1) => {
      if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      geo.rotateX(-Math.PI / 2);
      mesh(geo, conc, (x0 + x1) / 2, 0.002, (z0 + z1) / 2).castShadow = false;
    };
    slab(room.x, oz1, room.x + room.w, room.z + room.d); // the landing, by the door
    slab(room.x, room.z, room.x + room.w, oz0); // behind the opening
    slab(room.x, oz0, ox0, oz1);
    slab(ox1, oz0, room.x + room.w, oz1);
  }
  // the strip by the west wall the plan leaves (by accounting)
  floorRect({ x: 142, y: 238, w: 19, h: 138 }, carpet, 0.001);

  // ── the drop ceiling ──
  // (one texture, one grid: the tiles are laid by the UVs in metres from
  // the building's origin, so the grid runs on unbroken from room to room,
  // and where a room's ceiling lies over the bullpen's the two are the same)
  const ceilMat = mat({ map: keep(ceilingTex()), roughness: 0.95 });
  for (const id of ['bullpen', 'michael', 'conference', 'hallway', 'men', 'women', 'annex', 'darryl', 'supplies', 'lobby', 'stairs']) {
    const m = rect(ROOMS[id]);
    const y = CEILING;
    const geo = new THREE.PlaneGeometry(m.w, m.d);
    geo.rotateX(Math.PI / 2);
    geo.translate(m.cx, y, m.cz);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / TILE_X, pos.getZ(i) / TILE_X);
    const o = mesh(geo, ceilMat);
    o.castShadow = false;
  }
  // the fluorescent troffers, in the tile grid (./fixtures.js), and the
  // diffusers, grilles, sprinklers and smoke detectors round them
  const fixtures = buildFixtures({ T: 0.12 });
  add(fixtures.group);
  const lights = [];
  const troffers = fixtures.plan.troffers;
  // one tube in the annex is on its way out
  const flickerAt = troffers.findIndex(([x, z]) => roomAt(x, z) === 'annex' && z > 0);
  let flicker = null;
  {
    const frameGeo = keep(new THREE.BoxGeometry(1.2, 0.04, 0.6));
    const glowGeo = keep(new THREE.PlaneGeometry(1.12, 0.52).rotateX(Math.PI / 2));
    const frames = new THREE.InstancedMesh(frameGeo, kit.M.metal, troffers.length);
    const glows = new THREE.InstancedMesh(glowGeo, mat({ color: 0xffffff, emissive: 0xf2f6ff, emissiveIntensity: 2.4, roughness: 1 }), troffers.length);
    const m4 = new THREE.Matrix4();
    troffers.forEach(([x, z], i) => {
      m4.makeTranslation(x, CEILING - 0.02, z);
      frames.setMatrixAt(i, m4);
      // (the annex's tired tube is drawn on its own, below, so it can flicker)
      if (i === flickerAt) m4.makeScale(0, 0, 0);
      else m4.makeTranslation(x, CEILING - 0.045, z);
      glows.setMatrixAt(i, m4);
    });
    add(frames);
    add(glows);
    for (const [x, z] of troffers) lights.push([x, CEILING - 0.2, z]);
    if (flickerAt >= 0) {
      const [x, z] = troffers[flickerAt];
      flicker = { index: flickerAt, material: mat({ color: 0xffffff, emissive: 0xf2f6ff, emissiveIntensity: 2.4, roughness: 1 }) };
      flicker.mesh = mesh(glowGeo, flicker.material, x, CEILING - 0.045, z);
      flicker.mesh.castShadow = flicker.mesh.receiveShadow = false;
    }
  }

  // ── walls: the cream drywall, full height, a dark skirting at their feet ──
  const T = 0.12;
  const wallGeos = [];
  const skirts = [];
  const run = ([x0, z0, x1, z1], y0 = 0, y1 = CEILING, list = wallGeos, thick = T) => {
    const len = Math.hypot(x1 - x0, z1 - z0) + thick;
    const g = new THREE.BoxGeometry(len, y1 - y0, thick);
    if (Math.abs(x1 - x0) < 1e-6) g.rotateY(Math.PI / 2);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    list.push(g);
  };
  for (const r of SOLID) {
    run(r);
    run(r, 0, 0.1, skirts, T + 0.02);
  }
  // under and over the glass fronts: a knee wall and a soffit
  for (const r of PANES) {
    run(r, 0, 0.86);
    run(r, 2.1, CEILING);
    run(r, 0, 0.1, skirts, T + 0.02);
  }
  // over every doorway
  for (const d of DOORS) {
    const half = d.w / 2;
    const r = d.along === 'x' ? [d.x - half, d.z, d.x + half, d.z] : [d.x, d.z - half, d.x, d.z + half];
    run(r, 2.12, CEILING);
  }
  const wallMat = kit.surface('wall', 1, 1, 1.5, { color: 0xe4d9c2 });
  wallMat.map = null;
  const wallMesh = mesh(keep(merge(wallGeos)), wallMat);
  wallMesh.castShadow = true;
  mesh(keep(merge(skirts)), mat({ color: 0x3b3a38, roughness: 0.7 }));
  // door frames: brushed steel round each doorway
  {
    const parts = [];
    for (const d of DOORS) {
      const half = d.w / 2;
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.05, 2.12, T + 0.04);
        if (d.along === 'x') g.translate(d.x + s * half, 1.06, d.z);
        else {
          g.rotateY(Math.PI / 2);
          g.translate(d.x, 1.06, d.z + s * half);
        }
        parts.push(g);
      }
      const top = new THREE.BoxGeometry(d.w + 0.1, 0.05, T + 0.04);
      if (d.along === 'z') top.rotateY(Math.PI / 2);
      top.translate(d.x, 2.12, d.z);
      parts.push(top);
    }
    mesh(keep(merge(parts)), kit.M.metal).castShadow = false;
  }

  // ── the doors, standing open (layout's LEAVES): oak veneer with a lever
  // handle each side, the supply room's and the stairwell's grey steel with
  // a kick plate and the stairwell's a narrow wired-glass window ──
  {
    const oak = kit.surface('wood', 1, 2.1, 1.1, { color: 0x9a8f80 });
    const steel = mat({ color: 0x8b9096, roughness: 0.45, metalness: 0.35 });
    const plate = mat({ color: 0xb9bcbf, roughness: 0.3, metalness: 0.9 });
    const wired = mat({ color: 0x1b2026, roughness: 0.08, metalness: 0.2 });
    for (const l of LEAVES) {
      const leaf = mesh(new THREE.BoxGeometry(l.w, 2.08, l.d), l.kind === 'steel' ? steel : oak, l.x, 1.04, l.z);
      leaf.receiveShadow = true;
      // along the leaf, from the hinge, and out of each face
      const along = l.flat ? [-l.away, 0] : [0, l.swing];
      const out = l.flat ? [0, l.swing] : [1, 0];
      const hingeEnd = l.flat ? { x: l.hinge.x, z: l.z } : { x: l.x, z: l.hinge.z + l.swing * 0.06 };
      const p = (a, o, y) => [hingeEnd.x + along[0] * a + out[0] * o, y, hingeEnd.z + along[1] * a + out[1] * o];
      const sides = l.flat ? [-1] : [-1, 1]; // (flat against the wall, only one face shows)
      for (const sd of sides) {
        const o = sd * (0.024 + 0.022);
        const lever = mesh(new THREE.BoxGeometry(l.flat ? 0.12 : 0.02, 0.02, l.flat ? 0.02 : 0.12), kit.M.chrome, ...p(l.width - 0.13, o, 1.0));
        lever.castShadow = false;
        mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), kit.M.chrome, ...p(l.width - 0.07, sd * 0.03, 1.0)).rotation.set(l.flat ? Math.PI / 2 : 0, 0, l.flat ? 0 : Math.PI / 2);
        if (l.kind === 'steel') mesh(new THREE.BoxGeometry(l.flat ? l.width - 0.06 : 0.004, 0.25, l.flat ? 0.004 : l.width - 0.06), plate, ...p(l.width / 2, sd * 0.026, 0.14)).castShadow = false;
        if (l.kind === 'steel' && l.flat === false && l.width > 0.6 && sd) mesh(new THREE.BoxGeometry(0.004, 0.6, 0.12), wired, ...p(l.width - 0.22, sd * 0.026, 1.55)).castShadow = false;
      }
    }
  }

  // ── the glass fronts, and their blinds ──
  const glassMat = mat({ color: 0xd5e6f0, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, depthWrite: false });
  for (const [x0, z0, x1, z1] of PANES) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const vertical = Math.abs(x1 - x0) < 1e-6;
    const g = mesh(new THREE.PlaneGeometry(len, 1.24), glassMat, (x0 + x1) / 2, 1.48, (z0 + z1) / 2);
    g.rotation.y = vertical ? Math.PI / 2 : 0;
    g.castShadow = false;
    g.renderOrder = 3;
    const sill = mesh(new THREE.BoxGeometry(len, 0.03, 0.16), kit.M.metal, g.position.x, 0.87, g.position.z);
    sill.rotation.y = g.rotation.y;
  }

  // ── windows in the outside walls, a view of the lot through each, and
  // the blinds in them and in the glass fronts (./windows.js) ──
  // [px0, py0, px1, py1, which way the room is: +1 (south/east of the wall) or -1]
  const WINDOWS = [
    [215, 12, 314, 12, 1],
    [334, 12, 420, 12, 1],
    [430, 12, 505, 12, 1],
    [748, 12, 798, 12, 1],
    [815, 12, 915, 12, 1],
    [926, 160, 926, 250, -1],
    [926, 270, 926, 360, -1],
    [161, 252, 161, 300, 1],
    [161, 312, 161, 372, 1],
    [302, 376, 400, 376, -1],
  ];
  const windows = buildWindows({ windows: WINDOWS.map(([ax, ay, bx, by, room]) => ({ a: W(ax, ay), b: W(bx, by), room })), panes: PANES, T });
  add(windows.group);

  // ── a wall-mounted picture or sign: a plane on a wall face ──
  // (px, py on the wall line; `face`: the way it looks, in radians, 0 = +z)
  const onWall = (tex, w, h, px, py, y, face, extra = {}) => {
    const a = W(px, py);
    const m = mesh(new THREE.PlaneGeometry(w, h), mat({ map: tex, roughness: 0.6, ...extra }), a.x + Math.sin(face) * (T / 2 + 0.012), y, a.z + Math.cos(face) * (T / 2 + 0.012));
    m.rotation.y = face;
    m.castShadow = false;
    return m;
  };
  const E = Math.PI / 2;
  const Wst = -Math.PI / 2;
  const N = Math.PI;
  // the company's name: in the lobby by the suite's door, and behind reception
  onWall(keep(logoTex(true)), 2.0, 0.58, 142, 22, 1.85, Wst);
  onWall(keep(logoTex()), 1.9, 0.55, 142, 175, 1.75, E);
  // Vance Refrigeration, across the hall
  {
    const a = W(14, 50);
    const door = mesh(new THREE.BoxGeometry(0.06, 2.1, 0.95), mat({ color: 0x8a6b4a, roughness: 0.6 }), a.x + 0.07, 1.05, a.z);
    door.castShadow = false;
    onWall(keep(plateTex(['VANCE', 'Refrigeration'], { bg: '#1c3f74', fg: '#ffffff', w: 512, h: 200, size: 70 })), 0.9, 0.35, 14, 50, 2.3, E);
    const knob = mesh(new THREE.SphereGeometry(0.03, 10, 8), kit.M.chrome, a.x + 0.12, 1.0, a.z + 0.36);
    knob.castShadow = false;
  }
  // the lift: brushed doors, its call buttons and the floor above them
  {
    const a = W(70, 89);
    const b = W(118, 89);
    const doorMat = mat({ color: 0xb8bcc0, roughness: 0.28, metalness: 0.85 });
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry((b.x - a.x) / 2 - 0.01, 2.1, 0.04), doorMat, (a.x + b.x) / 2 + (s * (b.x - a.x)) / 4, 1.05, a.z - 0.08);
    mesh(new THREE.BoxGeometry(b.x - a.x + 0.16, 2.24, 0.03), kit.M.metal, (a.x + b.x) / 2, 1.12, a.z - 0.065);
    const btn = mesh(new THREE.BoxGeometry(0.1, 0.22, 0.02), kit.M.metal, b.x + 0.25, 1.15, a.z - 0.075);
    btn.castShadow = false;
    for (const dy of [-0.05, 0.05]) mesh(new THREE.CircleGeometry(0.022, 14), mat({ color: 0xfff2c4, emissive: 0xffd27a, emissiveIntensity: 0.8 }), b.x + 0.25, 1.15 + dy, a.z - 0.088).rotation.y = Math.PI;
    onWall(keep(plateTex(['2'], { bg: '#1a1a1a', fg: '#ff6a3a', w: 128, h: 128, size: 90 })), 0.16, 0.16, 94, 89, 2.35, N, { emissive: 0xff6a3a, emissiveIntensity: 0.3 });
  }
  // the suite's door: glass, held open, the name on it
  {
    const a = W(142, 40);
    const glass = mesh(new THREE.BoxGeometry(0.9, 2.1, 0.03), glassMat, a.x - 0.44, 1.05, a.z - 0.02);
    glass.rotation.y = 0;
    glass.castShadow = false;
    const handle = mesh(new THREE.BoxGeometry(0.03, 0.4, 0.05), kit.M.chrome, a.x - 0.82, 1.05, a.z - 0.02);
    handle.castShadow = false;
  }

  // framed pictures: a frame standing off the wall, the picture in it
  const framed = (c, w, h, px, py, y, face, frame = 0x111111) => {
    const a = W(px, py);
    const out = (d) => [a.x + Math.sin(face) * (T / 2 + d), y, a.z + Math.cos(face) * (T / 2 + d)];
    const f = mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.022), mat({ color: frame, roughness: 0.4, metalness: frame === 0xb8933f ? 0.8 : 0.1 }), ...out(0.011));
    f.rotation.y = face;
    f.castShadow = false;
    const t = keep(texOf(c));
    const pic = mesh(new THREE.PlaneGeometry(w, h), mat({ map: t, roughness: 0.25 }), ...out(0.0235));
    pic.rotation.y = face;
    pic.castShadow = false;
  };
  // the motivational posters: the annex, by the break room, and accounting's back wall
  framed(art.teamwork(), 0.56, 0.7, 739, 262, 1.55, E);
  framed(art.success(), 0.56, 0.7, 838, 141, 1.55, 0);
  framed(art.persistence(), 0.56, 0.7, 205, 376, 1.6, N);
  // Michael's certificates, over his credenza
  framed(art.certificate('Certificate of Achievement', ['Michael Gary Scott', 'Regional Manager of the Year', 'Northeastern Pennsylvania']), 0.5, 0.39, 206, 70, 1.62, E, 0xb8933f);
  framed(art.certificate('World’s Best Boss', ['Awarded to Michael Scott', 'by Michael Scott', '(it counts)']), 0.44, 0.34, 206, 104, 1.66, E, 0x3a2416);
  // the building's directory, by the lift, and the kitchen's sign
  framed(art.directory(), 0.5, 0.65, 40, 12, 1.5, 0, 0x8a8d90);
  framed(art.kitchenSign(), 0.34, 0.25, 640, 175, 1.5, 0, 0xf4f2ea);

  // Pam's watercolour, behind reception
  onWall(keep(paintingTex()), 0.86, 0.6, 142, 212, 1.55, E);
  // the bulletin board by the kitchen hallway
  onWall(keep(boardTex()), 1.3, 0.82, 514, 262, 1.45, Wst);
  // the conference room's whiteboard and its TV
  onWall(keep(whiteboardTex()), 1.9, 0.95, 324, 70, 1.4, E);
  {
    const a = W(514, 70);
    const tv = mesh(new THREE.BoxGeometry(0.08, 0.62, 1.05), kit.M.plasticDark, a.x - 0.11, 1.55, a.z);
    tv.castShadow = false;
    const scr = mesh(new THREE.PlaneGeometry(0.98, 0.56), mat({ color: 0x0b0e14, roughness: 0.15, metalness: 0.2 }), a.x - 0.155, 1.55, a.z);
    scr.rotation.y = Wst;
  }
  // restroom signs, Ryan's nameplate, the stairwell's exit sign
  const SIGNS = [
    [['MEN'], 542, 252, 1.62, N],
    [['WOMEN'], 712, 252, 1.62, N],
    [['Ryan Howard', 'Business Development'], 601, 252, 1.62, N],
    [['STAIRS'], 723, 175, 1.62, 0],
    [['CONFERENCE ROOM'], 360, 127, 2.0, 0],
    [['Michael Scott', 'Regional Manager'], 290, 127, 2.0, 0],
    [['ANNEX'], 739, 190, 2.32, Wst],
    [['Darryl Philbin', 'Warehouse Foreman'], 470, 288, 2.0, N],
    [['SUPPLIES'], 240, 384, 1.62, N],
    [['KITCHEN'], 514, 190, 2.32, Wst],
  ];
  for (const [lines, px, py, y, face] of SIGNS) onWall(keep(plateTex(lines, { w: 512, h: lines.length > 1 ? 160 : 110, size: 50 })), lines.length > 1 ? 0.5 : 0.42, lines.length > 1 ? 0.16 : 0.11, px, py, y, face);
  const exitTex = keep(plateTex(['EXIT'], { bg: '#0e3d1c', fg: '#6dff8f', w: 256, h: 96, size: 70 }));
  for (const [px, py, face] of [
    [703, 175, 0],
    [514, 214, Wst],
    [142, 55, E],
  ])
    onWall(exitTex, 0.34, 0.13, px, py, 2.3, face, { emissive: 0x3dff6a, emissiveMap: exitTex, emissiveIntensity: 0.9 });
  // a clock in Michael's office and one in the bullpen
  for (const [px, py, face] of [
    [250, 12, 0],
    [514, 150, Wst],
  ]) {
    const c = kit.model('clock');
    const a = W(px, py);
    const holder = new THREE.Group();
    holder.rotation.y = face;
    holder.position.set(a.x + Math.sin(face) * 0.08, 2.15, a.z + Math.cos(face) * 0.08);
    c.rotation.x = -Math.PI / 2;
    holder.add(c);
    add(holder);
  }

  // ── desks, as the page's 3D office dresses them ──
  const seats = new Map(); // who → { group, chair }
  for (const s of SEATS) {
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.turn;
    add(g);
    const d = kit.desk({ w: Math.round(s.width * 100) / 100, d: Math.round(s.depth * 100) / 100, pedestals: s.exec ? 'both' : s.i % 2 ? 'left' : 'right', exec: s.exec });
    g.add(d);
    const top = 0.76;
    const front = s.depth / 2;
    const mon = kit.monitor(s.who === 'kevin' ? 5 : s.who === 'dwight' ? 6 : s.who === 'michael' ? 7 : s.i);
    mon.position.set(0, top, -front + 0.2);
    g.add(mon);
    const blot = kit.blotter();
    blot.position.set(0, top, front - 0.2);
    g.add(blot);
    const kb = kit.keyboard();
    kb.position.set(-0.04, top + 0.004, front - 0.15);
    g.add(kb);
    const ph = kit.phone();
    ph.position.set(s.width / 2 - 0.2, top, -front + 0.25);
    ph.rotation.y = -0.4;
    g.add(ph);
    const cup = kit.pencilCup();
    cup.position.set(-s.width / 2 + 0.14, top, -front + 0.14);
    g.add(cup);
    if (s.i % 3 === 0) {
      const pads = kit.model('notepads');
      pads.position.set(s.width / 2 - 0.3, top, front - 0.18);
      pads.scale.multiplyScalar(0.6);
      g.add(pads);
    }
    if (s.i % 4 === 1 && big) {
      const lamp = kit.deskLamp();
      lamp.position.set(-s.width / 2 + 0.16, top, -front + 0.32);
      g.add(lamp);
    }
    if (s.who === 'michael' || s.who === 'ryan' || s.who === 'dwight') {
      const plate = kit.nameplate(s.who === 'michael' ? 'MICHAEL SCOTT' : s.who === 'dwight' ? 'DWIGHT K. SCHRUTE' : 'Ryan Howard', s.who === 'michael' ? 'REGIONAL MANAGER' : s.who === 'dwight' ? 'ASST. TO THE REGIONAL MGR' : 'Temp');
      plate.position.set(0.25, top, front - 0.06);
      g.add(plate);
    }
    const who = STAFF.find((x) => x.id === s.who);
    if (who && who.id !== 'jim' && who.id !== 'dwight') {
      const item = props.item(who.item);
      if (item) {
        if (who.item === 'banjo') item.position.set(s.width / 2 + 0.1, 0, 0);
        else item.position.set(s.width / 2 - 0.42, top, 0.02);
        g.add(item);
      }
    }
    // Jim's desk: a paper ball or two, the bin beside it
    if (s.who === 'jim') {
      for (let k = 0; k < 3; k++) {
        const b = kit.paperBall(k);
        b.position.set(-0.2 + k * 0.13, top + 0.04, 0.05 - k * 0.04);
        g.add(b);
      }
      const bin = kit.bin();
      bin.position.set(s.width / 2 + 0.35, 0, 0.2);
      g.add(bin);
    }
    const ch = kit.chair();
    ch.position.set(0.1, 0, front + 0.34);
    ch.rotation.y = Math.PI + ((s.i % 5) - 2) * 0.08;
    g.add(ch);
    seats.set(s.who ?? `desk${s.i}`, { group: g, chair: ch, top, front, width: s.width, depth: s.depth, i: s.i, who: s.who, exec: s.exec, pedestals: s.exec ? 'both' : s.i % 2 ? 'left' : 'right' });
  }

  // Dwight's desk: his stapler (for the Jell-O), his beets
  const dwight = seats.get('dwight');
  const stapler = kit.stapler();
  stapler.position.set(-dwight.width / 2 + 0.35, dwight.top, 0.05);
  dwight.group.add(stapler);
  const beets = kit.beet();
  beets.position.set(dwight.width / 2 - 0.35, dwight.top, 0.0);
  dwight.group.add(beets);
  const jelloOnDesk = kit.jello();
  jelloOnDesk.position.copy(stapler.position);
  jelloOnDesk.visible = false;
  dwight.group.add(jelloOnDesk);
  // Michael's mug
  {
    const m = seats.get('michael');
    const mug = kit.mug();
    mug.position.set(-m.width / 2 + 0.4, m.top, 0.1);
    m.group.add(mug);
  }

  // what's on and under every desk (./furnish.js)
  const furnish = makeFurnish();
  furnish.dressDesks(seats);

  // ── reception: the curved counter, Erin's chair, the phone and Pam's jelly beans ──
  {
    const counter = kit.reception();
    counter.position.set(RECEPTION.x, 0, RECEPTION.z);
    counter.rotation.y = Math.PI * 0.82;
    add(counter);
    const ch = kit.chair();
    ch.position.set(RECEPTION.chair.x, 0, RECEPTION.chair.z);
    ch.rotation.y = RECEPTION.face;
    add(ch);
    seats.set('erin', { group, chair: ch, top: 1.07 });
    const mon = kit.monitor(1);
    mon.position.set(RECEPTION.x - 0.22, 0.76, RECEPTION.z - 0.12);
    mon.rotation.y = RECEPTION.face + Math.PI;
    add(mon);
    const desk = mesh(new THREE.BoxGeometry(1.3, 0.04, 0.6), kit.M.plasticLight, RECEPTION.x - 0.25, 0.74, RECEPTION.z - 0.05);
    desk.rotation.y = RECEPTION.face;
    const ph = kit.phone();
    ph.position.set(RECEPTION.x + 0.35, 1.07, RECEPTION.z - 0.55);
    add(ph);
    const jar = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.2, 20), mat({ color: 0xe8f4ff, transparent: true, opacity: 0.45, roughness: 0.05 }), RECEPTION.x - 0.1, 1.17, RECEPTION.z - 0.85);
    jar.castShadow = false;
    const beans = mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.14, 16), mat({ color: 0xe0503a, roughness: 0.4 }), RECEPTION.x - 0.1, 1.14, RECEPTION.z - 0.85);
    beans.castShadow = false;
    const p = kit.model('plant');
    p.position.set(RECEPTION.x + 0.8, 0, RECEPTION.z + 0.6);
    p.scale.multiplyScalar(0.8);
    add(p);
  }

  // ── Michael's office: the credenza with his Dundies, two chairs for visitors ──
  {
    const a = W(208, 64);
    const cred = mesh(new THREE.BoxGeometry(0.45, 0.78, 44 * U), mat({ color: 0x5e2f20, roughness: 0.55 }), a.x + 0.22, 0.39, a.z + (44 * U) / 2);
    cred.receiveShadow = true;
    const gold = mat({ color: 0xd8b04a, roughness: 0.25, metalness: 0.9 });
    for (let k = 0; k < 4; k++) {
      const z = a.z + 0.25 + k * 0.32;
      mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), mat({ color: 0x151515, roughness: 0.5 }), a.x + 0.2, 0.8, z);
      const fig = mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.16, 8), gold, a.x + 0.2, 0.9, z);
      fig.castShadow = false;
      mesh(new THREE.SphereGeometry(0.022, 10, 8), gold, a.x + 0.2, 0.995, z).castShadow = false;
    }
    for (const [px, py] of [
      [256, 92],
      [290, 92],
    ]) {
      const c = kit.chair();
      const at = W(px, py);
      c.position.set(at.x, 0, at.z);
      c.rotation.y = Math.PI;
      add(c);
    }
    const plant = kit.model('plant');
    const pa = W(318, 20);
    plant.position.set(pa.x, 0, pa.z);
    plant.scale.multiplyScalar(0.75);
    add(plant);
  }

  // ── the conference room: its long table, ten chairs, a bin by the window ──
  {
    const t = CONFERENCE_TABLE;
    const c = W(t.x + t.w / 2, t.y + t.h / 2);
    const len = t.w * U;
    const dep = t.h * U;
    const top = mesh(new THREE.BoxGeometry(len, 0.045, dep), kit.surface('wood', len, dep, 1.2, { color: 0x8a5a3a }), c.x, 0.74, c.z);
    top.receiveShadow = true;
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.1, 0.72, dep * 0.55), kit.M.plasticDark, c.x + sx * (len / 2 - 0.5), 0.36, c.z);
    for (let k = 0; k < 5; k++)
      for (const sz of [-1, 1]) {
        const ch = kit.chair();
        ch.position.set(c.x - len / 2 + 0.45 + k * ((len - 0.9) / 4), 0, c.z + sz * (dep / 2 + 0.36));
        ch.rotation.y = sz > 0 ? Math.PI : 0;
        add(ch);
      }
  }
  // the bins: Dwight's fire's, in the conference room, and one by the copier
  const fireBin = kit.bin();
  fireBin.position.set(FIRE_BIN.x, 0, FIRE_BIN.z);
  add(fireBin);

  // ── the copier, the water cooler, the filing cabinets, the plants ──
  {
    const copier = furnish.copier(COPIER.w, COPIER.d);
    copier.position.set(COPIER.x, 0, COPIER.z);
    add(copier);
    const cooler = furnish.waterCooler();
    cooler.position.set(COOLER.x, 0, COOLER.z);
    cooler.rotation.y = Math.PI / 2; // facing into the room, away from the wall
    add(cooler);
    const fileMat = mat({ color: 0xc7c4bb, roughness: 0.45, metalness: 0.3 });
    for (const f of FILES) {
      mesh(new THREE.BoxGeometry(f.w, 1.3, f.d), fileMat, f.x, 0.65, f.z);
      // a few paper boxes stacked on top
      const b = kit.paperBox();
      b.position.set(f.x, 1.3 + 0.135, f.z);
      b.rotation.y = f.w > f.d ? 0 : Math.PI / 2;
      add(b);
    }
    PLANTS.forEach((p, k) => {
      const m = kit.model('plant');
      m.position.set(p.x, 0, p.z);
      m.scale.multiplyScalar(0.7 + (k % 3) * 0.12);
      m.rotation.y = k;
      add(m);
    });
  }

  // ── the kitchen hallway: the counter, sink and microwave, the fridge, a round table ──
  {
    const k = KITCHEN_COUNTER;
    const a = W(k.x, k.y);
    const cw = k.w * U;
    const cd = k.h * U;
    mesh(new THREE.BoxGeometry(cw, 0.88, cd), mat({ color: 0xe7e2d6, roughness: 0.6 }), a.x + cw / 2, 0.44, a.z + cd / 2);
    mesh(new THREE.BoxGeometry(cw + 0.04, 0.04, cd + 0.03), mat({ color: 0x8c8478, roughness: 0.35 }), a.x + cw / 2, 0.9, a.z + cd / 2);
    // the cupboards over it
    mesh(new THREE.BoxGeometry(cw, 0.7, 0.34), mat({ color: 0xe7e2d6, roughness: 0.6 }), a.x + cw / 2, 1.85, a.z + 0.17);
    // the doors and handles on both, the microwave, the coffee maker
    const fronts = furnish.cupboards(cw);
    fronts.position.set(a.x + cw / 2, 0, a.z + cd);
    add(fronts);
    const micro = furnish.microwave();
    micro.position.set(a.x + cw - 0.36, 0.92, a.z + cd / 2 - 0.01);
    add(micro);
    const coffee = furnish.coffeeMaker();
    coffee.position.set(a.x + 0.28, 0.92, a.z + cd / 2 - 0.02);
    add(coffee);
    // the sink, set into the top, and its tap
    mesh(new THREE.BoxGeometry(0.5, 0.02, 0.3), mat({ color: 0x8e9196, roughness: 0.25, metalness: 0.9 }), a.x + cw / 2, 0.915, a.z + cd / 2 + 0.01).castShadow = false;
    {
      const tap = mat({ color: 0xd8dadc, roughness: 0.15, metalness: 1 });
      mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.24, 12), tap, a.x + cw / 2, 1.04, a.z + 0.06);
      const spout = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 10), tap, a.x + cw / 2, 1.15, a.z + 0.13);
      spout.rotation.x = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.02, 0.02, 0.07), tap, a.x + cw / 2 + 0.05, 0.97, a.z + 0.07);
    }
    // a roll of paper towels, and the fridge
    const roll = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.26, 18), mat({ color: 0xf6f5f0, roughness: 0.95 }), a.x + 0.62, 1.05, a.z + 0.08);
    roll.rotation.z = Math.PI / 2;
    const fridge = furnish.fridge(FRIDGE.w, FRIDGE.d);
    fridge.position.set(FRIDGE.x, 0, FRIDGE.z);
    add(fridge);
    // the kitchen's round table and chairs
    const kt = W(KITCHEN_TABLE.x, KITCHEN_TABLE.y);
    const r = KITCHEN_TABLE.r * U;
    mesh(new THREE.CylinderGeometry(r, r, 0.03, 32), kit.M.white, kt.x, 0.74, kt.z);
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 10), kit.M.plasticDark, kt.x, 0.36, kt.z);
    for (let i = 0; i < 3; i++) {
      const ch = kit.chair();
      const ang = (i / 3) * Math.PI * 2 + 0.4;
      ch.position.set(kt.x + Math.sin(ang) * (r + 0.4), 0, kt.z + Math.cos(ang) * (r + 0.4));
      ch.rotation.y = ang + Math.PI;
      add(ch);
    }
  }

  // ── the break room: two vending machines, three tables ──
  {
    VENDING.forEach((v, k) => {
      const t = keep(vendingTex(k === 1));
      const body = mesh(new THREE.BoxGeometry(v.w, 1.85, v.d), mat({ color: k ? 0xb3222b : 0x1e2329, roughness: 0.45 }), v.x, 0.925, v.z);
      body.castShadow = true;
      const front = mesh(new THREE.PlaneGeometry(v.d * 0.96, 1.8), mat({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.3 }), v.x + v.w / 2 + 0.005, 0.925, v.z);
      front.rotation.y = E;
      front.castShadow = false;
    });
    for (const [px, py] of BREAK_TABLES) {
      const c = W(px, py);
      mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.03, 28), kit.M.white, c.x, 0.74, c.z);
      mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 10), kit.M.plasticDark, c.x, 0.36, c.z);
      for (let i = 0; i < 2; i++) {
        const ch = kit.chair();
        const ang = i * Math.PI + 0.6;
        ch.position.set(c.x + Math.sin(ang) * 0.82, 0, c.z + Math.cos(ang) * 0.82);
        ch.rotation.y = ang + Math.PI;
        add(ch);
      }
    }
  }

  // ── the supply room: steel shelves stacked with boxes of paper ──
  {
    const steel = mat({ color: 0x8a8f96, roughness: 0.5, metalness: 0.6 });
    const boxes = [];
    for (const s of SHELVES) {
      for (const y of [0.05, 0.75, 1.45, 2.05]) mesh(new THREE.BoxGeometry(s.w, 0.03, s.d), steel, s.x, y, s.z).castShadow = false;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.03, 2.1, 0.03), steel, s.x + sx * (s.w / 2 - 0.02), 1.05, s.z + sz * (s.d / 2 - 0.02)).castShadow = false;
      const along = s.w > s.d;
      const n = Math.floor((along ? s.w : s.d) / 0.46);
      for (const y of [0.065, 0.765, 1.465])
        for (let i = 0; i < n; i++) {
          if ((i * 7 + y * 10) % 5 < 1) continue;
          const off = -((along ? s.w : s.d) / 2) + 0.24 + i * 0.46;
          boxes.push([along ? s.x + off : s.x, y, along ? s.z : s.z + off, along ? 0 : Math.PI / 2]);
        }
    }
    const proto = kit.paperBox();
    const inst = new THREE.InstancedMesh(proto.geometry, proto.material, boxes.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    boxes.forEach(([x, y, z, r], i) => inst.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y + 0.135, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), one)));
    inst.castShadow = true;
    inst.receiveShadow = true;
    add(inst);
  }

  // ── the stairwell: down two flights from the landing, round a half
  // landing at the far end, into a concrete shaft; steel rails, yellow
  // nosings, a light on the ceiling, the floor's number on the wall ──
  {
    const f = STAIRWELL.flight;
    const ox0 = f.x - f.w / 2;
    const ox1 = f.x + f.w / 2;
    const oz0 = f.z - f.d / 2;
    const oz1 = f.z + f.d / 2;
    const half = f.d / 2; // each flight's width
    const RISE = 0.17;
    const TREAD = 0.29;
    const n = Math.floor((f.w - 0.7) / TREAD); // steps in a flight
    const conc = mat({ color: 0x8f8f8a, roughness: 0.88 });
    const nosing = mat({ color: 0xe0b52a, roughness: 0.6 });
    const block = mat({ color: 0xb9b5aa, roughness: 0.95 });
    const steps = [];
    const noses = [];
    // the first flight: in from the landing at the near (east) end, down westward along the south half
    for (let i = 0; i < n; i++) {
      const x = ox1 - TREAD * (i + 0.5);
      const top = -RISE * (i + 1);
      steps.push(new THREE.BoxGeometry(TREAD, 0.6, half - 0.04).translate(x, top - 0.3, oz1 - half / 2));
      noses.push(new THREE.BoxGeometry(0.05, 0.012, half - 0.06).translate(x + TREAD / 2 - 0.03, top + 0.006, oz1 - half / 2));
    }
    // the half landing at the far end, and the second flight back eastward along the north half
    const mid = -RISE * (n + 1);
    const landW = ox1 - TREAD * n - ox0;
    steps.push(new THREE.BoxGeometry(landW, 0.3, f.d - 0.04).translate(ox0 + landW / 2, mid - 0.15, f.z));
    for (let i = 0; i < n; i++) {
      const x = ox0 + landW + TREAD * (i + 0.5);
      const top = mid - RISE * (i + 1);
      steps.push(new THREE.BoxGeometry(TREAD, 0.6, half - 0.04).translate(x, top - 0.3, oz0 + half / 2));
      noses.push(new THREE.BoxGeometry(0.05, 0.012, half - 0.06).translate(x - TREAD / 2 + 0.03, top + 0.006, oz0 + half / 2));
    }
    mesh(keep(merge(steps)), conc);
    mesh(keep(merge(noses)), nosing).castShadow = false;
    // the shaft's walls, down from the landing's edge, and a dark floor far below
    const shaft = [];
    const deep = mid * 2 - 0.6;
    shaft.push(new THREE.BoxGeometry(f.w, -deep, 0.1).translate(f.x, deep / 2, oz0 - 0.05));
    shaft.push(new THREE.BoxGeometry(f.w, -deep, 0.1).translate(f.x, deep / 2, oz1 + 0.05));
    shaft.push(new THREE.BoxGeometry(0.1, -deep, f.d).translate(ox0 - 0.05, deep / 2, f.z));
    shaft.push(new THREE.BoxGeometry(0.1, -deep, f.d).translate(ox1 + 0.05, deep / 2, f.z));
    mesh(keep(merge(shaft)), block).castShadow = false;
    mesh(new THREE.BoxGeometry(f.w, 0.02, f.d), mat({ color: 0x2a2a28, roughness: 1 }), f.x, deep, f.z).castShadow = false;
    // the wall between the flights below the landing: a low block wall
    mesh(new THREE.BoxGeometry(f.w - landW, -mid + 0.1, 0.08), block, (ox0 + landW + ox1) / 2, mid / 2 - 0.05, f.z).castShadow = false;
    // rails: round the opening but for the way in, and down the open side of each flight
    const rail = mat({ color: 0x3a3d42, roughness: 0.4, metalness: 0.7 });
    const bars = [];
    const guard = (x0, z0, x1, z1, y0 = 0, y1 = 0) => {
      const len = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
      const g = new THREE.CylinderGeometry(0.022, 0.022, len, 8);
      g.rotateZ(Math.PI / 2);
      const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir));
      g.translate((x0 + x1) / 2, 0.98 + (y0 + y1) / 2, (z0 + z1) / 2);
      bars.push(g);
      const posts = Math.max(1, Math.round(len / 0.9));
      for (let i = 0; i <= posts; i++) {
        const k = i / posts;
        bars.push(new THREE.BoxGeometry(0.025, 0.98, 0.025).translate(x0 + (x1 - x0) * k, 0.49 + y0 + (y1 - y0) * k, z0 + (z1 - z0) * k));
      }
    };
    guard(ox0, oz0 - 0.02, ox1, oz0 - 0.02); // behind the opening
    guard(ox0 - 0.02, oz0, ox0 - 0.02, oz1); // the far end
    guard(ox0, oz1 + 0.02, ox1, oz1 + 0.02); // along the landing
    guard(ox1 + 0.02, oz0, ox1 + 0.02, f.z); // the near end, over the second flight
    guard(ox1 - 0.05, f.z, ox0 + landW, f.z, -RISE, mid); // down the first flight, on its open side
    mesh(keep(merge(bars)), rail).castShadow = false;
    // a wrap-round light on the stairwell's high ceiling, and the floor's number
    const light = mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), mat({ color: 0xffffff, emissive: 0xf2f6ff, emissiveIntensity: 2.4, roughness: 1 }), f.x + 1.4, CEILING - 0.04, oz1 + 1.4);
    light.castShadow = false;
    lights.push([f.x + 1.4, CEILING - 0.2, oz1 + 1.4]);
    const num = keep(plateTex(['2'], { bg: '#e4d9c2', fg: '#1f4e8c', w: 256, h: 256, size: 200, font: 'Arial Black, Arial, sans-serif' }));
    onWall(num, 0.55, 0.55, 600, 175, 1.95, N);
    // the emergency light over the door: a box and two lamp heads
    const em = mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), mat({ color: 0xeeede6, roughness: 0.5 }), P(703, 175).x, 2.55, P(703, 175).z - T / 2 - 0.04);
    em.castShadow = false;
    for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.045, 12, 8), mat({ color: 0xfff6dc, emissive: 0xfff2d0, emissiveIntensity: 0.6, roughness: 0.3 }), em.position.x + sx * 0.12, 2.5, em.position.z - 0.05).castShadow = false;
  }

  // ── the props the jobs move about ──
  // the Jell-O, carried, and the chili pot
  const carried = new THREE.Group();
  add(carried);
  const jelloCarry = kit.jello();
  jelloCarry.visible = false;
  carried.add(jelloCarry);
  const pot = new THREE.Group();
  {
    const steel = mat({ color: 0xb9bcc0, roughness: 0.3, metalness: 0.85 });
    mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.24, 24, 1, true), steel, 0, 0.12, 0, pot).material.side = THREE.DoubleSide;
    mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 24), steel, 0, 0.005, 0, pot);
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 24), mat({ color: 0x7a2614, roughness: 0.6 }), 0, 0.2, 0, pot);
    for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI), steel, s * 0.19, 0.2, 0, pot).rotation.set(0, s * (Math.PI / 2), 0);
  }
  const chiliStart = P(94, 70);
  pot.position.set(chiliStart.x, 0, chiliStart.z);
  add(pot);
  // chili on the carpet, wherever it went over
  const spills = [];
  const spill = (at) => {
    const s = props.chiliSpill();
    s.position.set(at.x, 0.008, at.z);
    s.rotation.y = Math.random() * Math.PI * 2;
    add(s);
    spills.push(s);
  };
  // the fire: a glow in the bin
  const fireGlow = new THREE.PointLight(0xff7a2a, 0, 6, 1.6);
  fireGlow.position.set(FIRE_BIN.x, 0.7, FIRE_BIN.z);
  add(fireGlow);

  return {
    group,
    seats,
    lights,
    jelloOnDesk,
    stapler,
    jelloCarry,
    carried,
    pot,
    potHome: chiliStart,
    spill,
    clearSpills() {
      for (const s of spills) s.removeFromParent();
      spills.length = 0;
    },
    fireGlow,
    windows,
    flicker,
    dispose() {
      windows.dispose();
      fixtures.dispose();
      furnish.dispose();
      for (const o of own) o.dispose?.();
    },
  };
}
