// The warehouse, downstairs from the office: a big concrete shed under
// high-bay lamps, painted floor lines, blue steel pallet racks loaded with
// Dunder Mifflin paper, bales of it shrink-wrapped on pallets, a yellow
// forklift, the loading dock's roll-up doors (one up, the lot outside), and
// the basketball hoop on the end wall where Michael's office team lost to
// the warehouse. Drawn at its own place east of the office (./layout.js's
// WAREHOUSE); you get here by the stairwell.
//
// buildWarehouse(kit) → { group, lights, ball, hoop, dispose }

import * as THREE from 'three';
import { merge } from '../kit';
import { BALES, FORKLIFT, HOOP, RACKS, WAREHOUSE, WH_PROPS, WH_STAIRS } from './layout';
import { sharpen } from '../../../lib/three/textures';

const H = 6.2; // to the roof's trusses

function floorTex() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#9b9890';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const g = 120 + Math.random() * 60;
    x.fillStyle = `rgba(${g},${g - 3},${g - 8},${Math.random() * 0.22})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // stains and tyre marks
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(40,38,34,${0.04 + Math.random() * 0.06})`;
    x.beginPath();
    x.ellipse(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60, 8 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = 'rgba(60,58,54,0.35)';
  x.lineWidth = 2;
  x.strokeRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  sharpen(t);
  return t;
}
function signTex(lines, bg, fg, w = 512, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach(([text, size], i) => {
    x.font = `bold ${size}px Arial, Helvetica, sans-serif`;
    x.fillText(text, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15);
  });
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// the safety record, as on the set's warehouse wall: a green sign, the
// safety cross in its ring, and the count of days in a white slot (zero)
function safetyTex() {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = '#1e6b3a';
  x.fillRect(0, 0, 384, 320);
  x.strokeStyle = '#f2f2ec';
  x.lineWidth = 5;
  x.strokeRect(8, 8, 368, 304);
  x.beginPath();
  x.arc(64, 70, 40, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = '#f2f2ec';
  x.fillRect(56, 42, 16, 56);
  x.fillRect(36, 62, 56, 16);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 30px Arial, Helvetica, sans-serif';
  x.fillText('THIS', 238, 46);
  x.fillText('DEPARTMENT', 238, 80);
  x.font = 'bold 24px Arial, Helvetica, sans-serif';
  x.fillText('HAS WORKED', 192, 128);
  x.fillRect(132, 148, 120, 66);
  x.fillStyle = '#b3122a';
  x.font = 'bold 60px Arial, Helvetica, sans-serif';
  x.fillText('0', 192, 183);
  x.fillStyle = '#f2f2ec';
  x.font = 'bold 22px Arial, Helvetica, sans-serif';
  x.fillText('DAYS WITHOUT A', 192, 244);
  x.fillText('LOST TIME ACCIDENT', 192, 276);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function buildWarehouse(kit) {
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
  const W = WAREHOUSE;
  const cx = W.x + W.w / 2;
  const cz = W.z + W.d / 2;

  // ── the floor, its painted lines, the walls and the roof ──
  const ft = keep(floorTex());
  ft.repeat.set(W.w / 4, W.d / 4);
  const floor = mesh(new THREE.PlaneGeometry(W.w, W.d).rotateX(-Math.PI / 2), mat({ map: ft, roughness: 0.85 }), cx, 0, cz);
  floor.castShadow = false;
  const yellow = mat({ color: 0xe8c22a, roughness: 0.6 });
  {
    const lines = [];
    // the aisle down the middle, and the dock's apron
    for (const z of [cz - 1.6, cz + 1.6]) lines.push(new THREE.BoxGeometry(W.w - 2, 0.004, 0.1).translate(cx, 0.003, z));
    lines.push(new THREE.BoxGeometry(0.1, 0.004, W.d - 2).translate(W.x + W.w - 4, 0.003, cz));
    // hatched no-parking by the stairs
    for (let i = 0; i < 6; i++) lines.push(new THREE.BoxGeometry(0.08, 0.004, 1.6).rotateY(0.7).translate(WH_STAIRS.x + 0.6 + i * 0.35, 0.003, WH_STAIRS.z + 1.6));
    const m = mesh(keep(merge(lines)), yellow);
    m.castShadow = false;
  }
  const block = mat({ color: 0xc9c4b6, roughness: 0.9 });
  const walls = [];
  const wall = (x0, z0, x1, z1, y0 = 0, y1 = H) => {
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.2;
    const g = new THREE.BoxGeometry(len, y1 - y0, 0.2);
    if (Math.abs(x1 - x0) < 1e-6) g.rotateY(Math.PI / 2);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    walls.push(g);
  };
  const x0 = W.x;
  const x1 = W.x + W.w;
  const z0 = W.z;
  const z1 = W.z + W.d;
  wall(x0, z0, x1, z0);
  wall(x0, z1, x1, z1);
  wall(x0, z0, x0, z1);
  // the dock wall, with two door openings in it (one shut, one up)
  const doors = [cz - 3.5, cz + 3.5];
  const dw = 3.2;
  wall(x1, z0, x1, doors[0] - dw / 2);
  wall(x1, doors[0] + dw / 2, x1, doors[1] - dw / 2);
  wall(x1, doors[1] + dw / 2, x1, z1);
  for (const d of doors) wall(x1, d - dw / 2, x1, d + dw / 2, 3.6, H);
  mesh(keep(merge(walls)), block);
  // a painted band round the walls at shoulder height, Dunder Mifflin blue
  {
    const band = [];
    const b = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(len, 0.5, 0.02);
      if (Math.abs(bx - ax) < 1e-6) g.rotateY(Math.PI / 2);
      g.translate((ax + bx) / 2, 1.0, (az + bz) / 2);
      band.push(g);
    };
    b(x0 + 0.2, z0 + 0.11, x1 - 0.2, z0 + 0.11);
    b(x0 + 0.2, z1 - 0.11, x1 - 0.2, z1 - 0.11);
    b(x0 + 0.11, z0 + 0.2, x0 + 0.11, z1 - 0.2);
    const m = mesh(keep(merge(band)), mat({ color: 0x1f4e8c, roughness: 0.7 }));
    m.castShadow = false;
  }
  // the roof: corrugated, with trusses under it
  const roof = mesh(new THREE.PlaneGeometry(W.w, W.d).rotateX(Math.PI / 2), mat({ color: 0x8e9196, roughness: 0.6, metalness: 0.4 }), cx, H, cz);
  roof.castShadow = false;
  {
    const t = [];
    for (let i = 1; i < 6; i++) {
      const x = x0 + (i * W.w) / 6;
      t.push(new THREE.BoxGeometry(0.16, 0.3, W.d).translate(x, H - 0.4, cz));
      t.push(new THREE.BoxGeometry(0.08, 0.08, W.d).translate(x, H - 1.1, cz));
      for (let k = 0; k < 8; k++) t.push(new THREE.BoxGeometry(0.05, 0.85, 0.05).rotateX(k % 2 ? 0.6 : -0.6).translate(x, H - 0.75, z0 + 1 + k * ((W.d - 2) / 7)));
    }
    const m = mesh(keep(merge(t)), mat({ color: 0x5a5f66, roughness: 0.5, metalness: 0.6 }));
    m.castShadow = false;
  }
  // high-bay lamps
  const lights = [];
  {
    const shade = [];
    const glows = [];
    for (let i = 0; i < 4; i++)
      for (let k = 0; k < 3; k++) {
        const x = x0 + ((i + 0.5) * W.w) / 4;
        const z = z0 + ((k + 0.5) * W.d) / 3;
        shade.push(new THREE.CylinderGeometry(0.22, 0.45, 0.4, 16, 1, true).translate(x, H - 1.6, z));
        shade.push(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6).translate(x, H - 0.75, z));
        glows.push(new THREE.CircleGeometry(0.42, 16).rotateX(Math.PI / 2).translate(x, H - 1.78, z));
        lights.push([x, H - 2.0, z]);
      }
    const s = mesh(keep(merge(shade)), mat({ color: 0x6f757c, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide }));
    s.castShadow = false;
    const g = mesh(keep(merge(glows)), mat({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 2.6 }));
    g.castShadow = false;
  }

  // ── the dock: roll-up doors, one up to the lot outside, dock bumpers ──
  {
    const rollup = mat({ color: 0xb8bab6, roughness: 0.55, metalness: 0.5 });
    // the shut one, its slats
    const slats = [];
    for (let i = 0; i < 12; i++) slats.push(new THREE.BoxGeometry(0.06, 0.28, dw).translate(x1 - 0.05, 0.16 + i * 0.29, doors[0]));
    mesh(keep(merge(slats)), rollup);
    // the open one: rolled up under its header, the lot out beyond
    mesh(new THREE.CylinderGeometry(0.3, 0.3, dw, 16).rotateX(Math.PI / 2), rollup, x1 - 0.25, 3.85, doors[1]);
    // the leveller and its bumpers, both doors
    const black = mat({ color: 0x18191b, roughness: 0.8 });
    for (const d of doors) {
      mesh(new THREE.BoxGeometry(1.6, 0.04, dw - 0.4), mat({ color: 0x55585c, roughness: 0.5, metalness: 0.6 }), x1 - 0.9, 0.02, d).castShadow = false;
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.14, 0.5, 0.3), black, x1 - 0.1, 0.9, d + s * (dw / 2 - 0.2));
    }
    // daylight in through the open door
    const sun = new THREE.SpotLight(0xfff2dc, 40, 22, 0.7, 0.6, 1.2);
    sun.position.set(x1 + 2, 3, doors[1]);
    sun.target.position.set(x1 - 6, 0, doors[1]);
    group.add(sun, sun.target);
  }

  // ── the racks: blue uprights, orange beams, paper on every level ──
  const boxes = [];
  const slots = []; // where a pallet stands: [x, y, z, turn]
  {
    const blue = [];
    const orange = [];
    const decks = [];
    for (const r of RACKS) {
      const along = r.w > r.d;
      const len = along ? r.w : r.d;
      const bays = Math.max(1, Math.round(len / 2.7));
      for (let i = 0; i <= bays; i++) {
        const off = -len / 2 + (i * len) / bays;
        for (const s of [-1, 1]) {
          const ux = along ? r.x + off : r.x + s * (r.w / 2 - 0.04);
          const uz = along ? r.z + s * (r.d / 2 - 0.04) : r.z + off;
          blue.push(new THREE.BoxGeometry(0.08, 4.2, 0.08).translate(ux, 2.1, uz));
        }
      }
      for (const y of [0.15, 1.5, 2.85]) {
        for (const s of [-1, 1]) {
          const g = new THREE.BoxGeometry(along ? len : 0.08, 0.12, along ? 0.08 : len);
          g.translate(along ? r.x : r.x + s * (r.w / 2 - 0.04), y + 0.06, along ? r.z + s * (r.d / 2 - 0.04) : r.z);
          orange.push(g);
        }
        decks.push(new THREE.BoxGeometry(r.w - 0.1, 0.03, r.d - 0.1).translate(r.x, y + 0.13, r.z));
        // pallets of paper, a few gaps: a wooden pallet, cases stacked on it
        for (let i = 0; i < bays * 2; i++) {
          if ((i * 5 + Math.round(y * 3)) % 7 === 3) continue;
          const o = -len / 2 + 0.7 + i * ((len - 1.4) / Math.max(1, bays * 2 - 1));
          slots.push([along ? r.x + o : r.x, y + 0.145, along ? r.z : r.z + o, along ? 0 : Math.PI / 2]);
          const high = 2 + ((i * 3 + Math.round(y)) % 2); // two cases high, or three
          for (let k = 0; k < 2; k++)
            for (let l = 0; l < high; l++) boxes.push([along ? r.x + o + (k - 0.5) * 0.46 : r.x + (k - 0.5) * 0.32 * 2, y + 0.285 + l * 0.27, along ? r.z + (k - 0.5) * 0.32 : r.z + o + (l % 2 ? 0.05 : 0), along ? 0 : Math.PI / 2]);
        }
      }
    }
    mesh(keep(merge(blue)), mat({ color: 0x1f5fa8, roughness: 0.45, metalness: 0.5 }));
    mesh(keep(merge(orange)), mat({ color: 0xe0661f, roughness: 0.45, metalness: 0.4 }));
    mesh(keep(merge(decks)), mat({ color: 0x8a8d90, roughness: 0.6, metalness: 0.5 })).castShadow = false;
  }
  // bales of paper, shrink-wrapped on pallets, out on the floor
  {
    const wrap = mat({ color: 0xf1efe8, roughness: 0.35, metalness: 0, transparent: false });
    const pallet = mat({ color: 0x9a7448, roughness: 0.85 });
    for (const b of BALES) {
      mesh(new THREE.BoxGeometry(b.w, 0.14, b.d), pallet, b.x, 0.07, b.z);
      mesh(new THREE.BoxGeometry(b.w - 0.04, 0.9, b.d - 0.04), wrap, b.x, 0.6, b.z);
      for (let l = 0; l < 2; l++) boxes.push([b.x - 0.25, 1.05 + l * 0.27, b.z, 0], [b.x + 0.25, 1.05 + l * 0.27, b.z, 0]);
    }
  }
  {
    const proto = kit.paperBox();
    const inst = new THREE.InstancedMesh(proto.geometry, proto.material, boxes.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const v = new THREE.Vector3();
    boxes.forEach(([x, y, z, r], i) => inst.setMatrixAt(i, m4.compose(v.set(x, y + 0.135, z), q.setFromAxisAngle(up, r), one)));
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }

  // ── pallets: a deck of boards on three runners, under every load and
  // stacked empty by the dock (one instanced draw) ──
  const palletGeo = (() => {
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(new THREE.BoxGeometry(1.0, 0.022, 0.13).translate(0, 0.129, -0.36 + i * 0.18));
    for (let i = 0; i < 3; i++) parts.push(new THREE.BoxGeometry(1.0, 0.022, 0.13).translate(0, 0.011, -0.36 + i * 0.36));
    for (const x of [-0.44, 0, 0.44]) parts.push(new THREE.BoxGeometry(0.1, 0.096, 0.85).translate(x, 0.07, 0));
    return keep(merge(parts));
  })();
  {
    const stack = WH_PROPS.pallets;
    for (let i = 0; i < 7; i++) slots.push([stack.x + Math.sin(i * 2.1) * 0.03, -0.0 + i * 0.141, stack.z + Math.cos(i * 1.3) * 0.03, stack.turn + (i % 2) * 0.04 - Math.PI / 2]);
    const inst = new THREE.InstancedMesh(palletGeo, mat({ color: 0xa47d52, roughness: 0.9 }), slots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const v = new THREE.Vector3();
    slots.forEach(([x, y, z, r], i) => inst.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromAxisAngle(up, r), one)));
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }
  // ── the floor's odds and ends (layout's WH_PROPS) ──
  {
    const P = WH_PROPS;
    const yellow = mat({ color: 0xf2c21a, roughness: 0.5 });
    const black = mat({ color: 0x1b1c1e, roughness: 0.6 });
    const steel = mat({ color: 0x7d8186, roughness: 0.4, metalness: 0.7 });
    // bollards at the dock doors, yellow with a black band
    for (const [x, z] of P.bollards) {
      mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.05, 16), yellow, x, 0.525, z);
      mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.08, 16), black, x, 0.85, z).castShadow = false;
      mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), yellow, x, 1.05, z);
    }
    // traffic cones
    const orange = mat({ color: 0xf26a1b, roughness: 0.55 });
    const white = mat({ color: 0xf2f2ee, roughness: 0.5 });
    for (const [x, z] of P.cones) {
      mesh(new THREE.BoxGeometry(0.36, 0.03, 0.36), orange, x, 0.015, z);
      mesh(new THREE.CylinderGeometry(0.025, 0.13, 0.62, 18), orange, x, 0.34, z);
      mesh(new THREE.CylinderGeometry(0.07, 0.093, 0.09, 18), white, x, 0.4, z).castShadow = false;
    }
    // the pallet jack: forks, its wheels and the handle up
    {
      const j = new THREE.Group();
      j.position.set(P.jack.x, 0, P.jack.z);
      j.rotation.y = P.jack.turn;
      group.add(j);
      const red = mat({ color: 0xb8222a, roughness: 0.45, metalness: 0.3 });
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(1.15, 0.06, 0.16), red, -0.1, 0.05, s * 0.2, j);
      mesh(new THREE.BoxGeometry(0.3, 0.32, 0.56), red, 0.55, 0.2, 0, j);
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), steel, 0.55, 0.55, 0, j);
      const handle = mesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), black, 0.7, 0.95, 0, j);
      handle.rotation.z = -0.18;
      mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), black, 0.8, 1.45, 0, j).rotation.y = Math.PI / 2;
      for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14).rotateX(Math.PI / 2), black, 0.55, 0.09, s * 0.16, j);
    }
    // the workbench: a top on legs, a pegboard of tools, a radio and a coffee can of screws
    {
      const b = P.bench;
      const wood = mat({ color: 0x8a6a46, roughness: 0.8 });
      mesh(new THREE.BoxGeometry(b.w, 0.05, b.d), wood, b.x, 0.92, b.z);
      mesh(new THREE.BoxGeometry(b.w - 0.1, 0.03, b.d - 0.1), wood, b.x, 0.25, b.z).castShadow = false;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.06, 0.92, 0.06), steel, b.x + sx * (b.w / 2 - 0.06), 0.46, b.z + sz * (b.d / 2 - 0.06));
      mesh(new THREE.BoxGeometry(b.w, 0.8, 0.02), mat({ color: 0xc9b48a, roughness: 0.9 }), b.x, 1.48, z0 + 0.13).castShadow = false; // the pegboard, under the accident sign
      const tools = [
        [-1.0, 1.75, 0.04, 0.45, steel],
        [-0.8, 1.7, 0.18, 0.05, mat({ color: 0xb8222a, roughness: 0.4 })],
        [-0.55, 1.8, 0.05, 0.32, black],
        [-0.3, 1.6, 0.22, 0.04, steel],
        [0.0, 1.78, 0.03, 0.4, mat({ color: 0xd9b01a, roughness: 0.5 })],
        [0.3, 1.65, 0.3, 0.3, black],
        [0.75, 1.75, 0.06, 0.35, steel],
      ];
      for (const [dx, y, w, h, m] of tools) mesh(new THREE.BoxGeometry(w, h, 0.03), m, b.x + dx, y - 0.2, z0 + 0.16).castShadow = false;
      mesh(new THREE.BoxGeometry(0.34, 0.2, 0.12), black, b.x + 0.7, 1.05, b.z); // the radio
      mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 14), steel, b.x - 0.8, 1.01, b.z + 0.1);
      mesh(new THREE.BoxGeometry(0.5, 0.18, 0.25), mat({ color: 0xb8222a, roughness: 0.4, metalness: 0.3 }), b.x - 0.2, 1.04, b.z - 0.05); // the toolbox
    }
    // a trash barrel by the stairs
    {
      const blue = mat({ color: 0x2c5a8a, roughness: 0.6, metalness: 0.2 });
      mesh(new THREE.CylinderGeometry(P.barrel.r, P.barrel.r * 0.95, 0.9, 20), blue, P.barrel.x, 0.45, P.barrel.z);
      for (const y of [0.3, 0.6]) mesh(new THREE.TorusGeometry(P.barrel.r + 0.005, 0.012, 6, 24).rotateX(Math.PI / 2), blue, P.barrel.x, y, P.barrel.z).castShadow = false;
    }
    // the time clock and its card rack, by the stairs
    {
      const wx = x0 + 0.13;
      mesh(new THREE.BoxGeometry(0.12, 0.3, 0.25), mat({ color: 0xd8d6cf, roughness: 0.5 }), wx, 1.45, -6.4);
      mesh(new THREE.BoxGeometry(0.01, 0.1, 0.16), mat({ color: 0x1b1c1e, roughness: 0.3 }), wx + 0.065, 1.52, -6.4).castShadow = false;
      mesh(new THREE.BoxGeometry(0.05, 0.6, 0.4), mat({ color: 0x55585c, roughness: 0.4, metalness: 0.6 }), wx, 1.4, -5.8);
      for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.01, 0.16, 0.08), white, wx + 0.035, 1.6 - Math.floor(i / 3) * 0.2, -5.93 + (i % 3) * 0.13).castShadow = false;
    }
  }

  // ── the forklift: yellow, its mast up front, forks down ──
  {
    const f = new THREE.Group();
    f.position.set(FORKLIFT.x, 0, FORKLIFT.z);
    f.rotation.y = FORKLIFT.turn;
    group.add(f);
    const yel = mat({ color: 0xf2b417, roughness: 0.45, metalness: 0.2 });
    const dark = mat({ color: 0x1b1c1e, roughness: 0.6 });
    const steel = mat({ color: 0x55585c, roughness: 0.4, metalness: 0.7 });
    mesh(new THREE.BoxGeometry(1.15, 0.7, 2.0), yel, 0, 0.6, 0, f);
    mesh(new THREE.BoxGeometry(1.1, 0.5, 0.6), dark, 0, 0.75, -0.85, f); // the counterweight
    mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), dark, 0, 1.15, -0.1, f); // the seat
    for (const s of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), steel, s * 0.5, 1.6, -0.55, f);
      mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), steel, s * 0.5, 1.6, 0.45, f);
      mesh(new THREE.BoxGeometry(0.1, 2.4, 0.12), steel, s * 0.32, 1.2, 1.08, f); // the mast
      mesh(new THREE.BoxGeometry(0.12, 0.05, 1.1), steel, s * 0.25, 0.08, 1.65, f); // the forks
      for (const z of [-0.6, 0.6]) mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 18).rotateZ(Math.PI / 2), dark, s * 0.6, 0.28, z, f);
    }
    mesh(new THREE.BoxGeometry(1.1, 0.06, 1.1), steel, 0, 2.25, -0.05, f); // the overhead guard
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16).rotateX(-1.1), dark, 0, 1.45, 0.25, f); // the wheel
    mesh(new THREE.SphereGeometry(0.07, 10, 8), mat({ color: 0xff8a2a, emissive: 0xff7a1a, emissiveIntensity: 1.2 }), 0, 2.33, -0.4, f).castShadow = false;
  }

  // ── signs: the safety record (the green one on the set's warehouse wall),
  // the warehouse's own name, the stairs ──
  const sign = (tex, w, h, x, y, z, face) => {
    const m = mesh(new THREE.PlaneGeometry(w, h), mat({ map: keep(tex), roughness: 0.6 }), x, y, z);
    m.rotation.y = face;
    m.castShadow = false;
    return m;
  };
  sign(safetyTex(), 1.1, 0.92, x0 + 4, 2.4, z0 + 0.12, 0);
  sign(signTex([['DUNDER MIFFLIN', 60], ['WAREHOUSE · SCRANTON', 30]], '#1f4e8c', '#ffffff', 768, 220), 4.2, 1.2, cx, 3.9, z0 + 0.12, 0);
  sign(signTex([['SAFETY FIRST', 52], ['Forklift crossing', 30]], '#f2c230', '#1b1b1b', 512, 200), 1.3, 0.5, x1 - 4.2, 2.6, z1 - 0.12, Math.PI);
  sign(signTex([['UP TO THE OFFICE', 40], ['Suite 200', 28]], '#2b2e33', '#f4f2ec', 512, 180), 1.2, 0.42, WH_STAIRS.x - 1.2, 2.4, z0 + 0.12, 0);

  // ── the stairs up, in the corner ──
  {
    const st = mat({ color: 0x8c8c86, roughness: 0.85 });
    // twelve steps up to the north wall, each a block from the floor
    for (let i = 0; i < 12; i++) {
      const h = (i + 1) * 0.18;
      mesh(new THREE.BoxGeometry(1.4, h, 0.14), st, WH_STAIRS.x, h / 2, WH_STAIRS.z - 0.1 - i * 0.14);
    }
    const rail = mat({ color: 0xe8c22a, roughness: 0.5, metalness: 0.3 });
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.05, 0.05, 2.0).rotateX(0.83), rail, WH_STAIRS.x + s * 0.75, 1.9, WH_STAIRS.z - 0.9);
  }

  // ── the hoop: a backboard on the end wall, and the ball ──
  {
    const board = mesh(new THREE.BoxGeometry(0.04, 1.05, 1.8), mat({ color: 0xf6f6f2, roughness: 0.4 }), HOOP.x - 0.5, 3.35, HOOP.z);
    board.castShadow = false;
    const frame = mesh(new THREE.BoxGeometry(0.02, 0.45, 0.6), mat({ color: 0xc8202e, roughness: 0.5 }), HOOP.x - 0.47, 3.2, HOOP.z);
    frame.castShadow = false;
    mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), mat({ color: 0x55585c, metalness: 0.7, roughness: 0.4 }), HOOP.x - 0.26, 3.05, HOOP.z);
    const rim = mesh(new THREE.TorusGeometry(0.23, 0.012, 8, 28).rotateX(Math.PI / 2), mat({ color: 0xe0581f, roughness: 0.4, metalness: 0.5 }), HOOP.x, HOOP.y, HOOP.z);
    rim.castShadow = false;
    const net = mesh(new THREE.CylinderGeometry(0.23, 0.15, 0.42, 14, 3, true), mat({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 }), HOOP.x, HOOP.y - 0.21, HOOP.z);
    net.castShadow = false;
    // the free-throw line, in tape
    mesh(new THREE.BoxGeometry(0.06, 0.004, 1.8), mat({ color: 0xffffff, roughness: 0.6 }), HOOP.x - HOOP.line, 0.004, HOOP.z).castShadow = false;
  }
  const ballTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#d4682a';
    x.fillRect(0, 0, 128, 64);
    x.strokeStyle = '#2a1408';
    x.lineWidth = 2.5;
    for (const y of [32]) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(128, y);
      x.stroke();
    }
    for (const xx of [32, 96]) {
      x.beginPath();
      x.moveTo(xx, 0);
      x.lineTo(xx, 64);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ball = mesh(new THREE.SphereGeometry(0.12, 20, 14), mat({ map: keep(ballTex), roughness: 0.75 }), HOOP.x - HOOP.line - 0.6, 0.12, HOOP.z + 0.8);

  return {
    group,
    lights,
    ball,
    dispose() {
      for (const o of own) o.dispose?.();
    },
  };
}
