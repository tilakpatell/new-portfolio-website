// The blasters aboard, built in code from their props’ real parts: the
// E-11 is a Sterling submachine gun (the round receiver, the barrel shroud
// drilled with cooling holes, the magazine out to the left, the stock
// folded under the barrel with its butt plate below the muzzle) under a
// tank periscope for a scope and a counter on its side; the DL-44 is Han’s
// broom-handled Mauser with a long scope and a flared flash hider; the
// DH-17 is the Tantive’s troopers’ Sterling pistol; the A280 a long rifle
// with a full stock. Each gun is one mesh in one shared material (its
// finishes are vertex colours: blued steel, black grips, grey fittings,
// the holes nearly black), so a squad’s guns cost a draw each and nothing
// more to make: a kind is built once and every gun of it shares that.
//
//   GUN_PARTS[kind] → [part]   the names of the parts a gun is built from (‘scope’, ‘stock’, ‘shroud’…)
//   buildGun(kind) → Group | null   a WEAPONS kind (combat.js); null for one with no gun drawn
//     its grip at the origin, its barrel along −z, y up, in metres; a child Object3D named
//     'muzzle' marks the front of the barrel, where a shot’s flare goes
//   disposeGuns()   frees the shared geometry and material (built again if asked for after)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// the finishes, as colours (sRGB, as the props were painted)
const TONES = {
  steel: 0x1c1e22, // blued steel, the bodies
  black: 0x0b0b0c, // grips, magazines, the scope’s tube
  grey: 0x4a4f56, // fittings: caps, rings, the counter
  light: 0x7d838b, // the scope’s lens rings, worn edges
  hole: 0x020202, // the cooling holes and the bore
};

// A part: [name, shape, size, place, tone, turn?], in metres. Shapes:
// 'box' [w, h, d]; 'rod' [r, length] along z; 'cone' [front r, back r,
// length] along z; 'bore' [r] a disc facing −z; 'holes' [r, length, rows,
// round, hole r] rows of holes round a rod of radius r. `turn` is an Euler
// [x, y, z] made before the part is placed.
const GUNS = {
  e11: {
    muzzle: [0, 0.05, -0.394],
    parts: [
      ['receiver', 'rod', [0.021, 0.27], [0, 0.05, -0.045], 'steel'],
      ['receiver', 'rod', [0.023, 0.016], [0, 0.05, 0.098], 'grey'],
      ['shroud', 'rod', [0.0235, 0.2], [0, 0.05, -0.28], 'steel'],
      ['holes', 'holes', [0.0235, 0.16, 6, 8, 0.0052], [0, 0.05, -0.28], 'hole'],
      ['muzzle', 'rod', [0.026, 0.014], [0, 0.05, -0.387], 'grey'],
      ['muzzle', 'bore', [0.012], [0, 0.05, -0.3942], 'hole'],
      ['sight', 'box', [0.006, 0.02, 0.012], [0, 0.083, -0.37], 'steel'],
      // the periscope on its mount, its lens rings bright at either end
      ['scope', 'rod', [0.0115, 0.155], [-0.004, 0.1, -0.06], 'black'],
      ['scope', 'rod', [0.0135, 0.014], [-0.004, 0.1, -0.138], 'light'],
      ['scope', 'rod', [0.0135, 0.014], [-0.004, 0.1, 0.018], 'grey'],
      ['scope', 'box', [0.012, 0.024, 0.05], [-0.004, 0.079, -0.06], 'steel'],
      ['rail', 'box', [0.004, 0.008, 0.13], [0.022, 0.05, -0.06], 'grey'],
      ['counter', 'box', [0.022, 0.03, 0.036], [0.028, 0.062, 0.04], 'grey'],
      ['magazine', 'box', [0.16, 0.024, 0.036], [-0.1, 0.05, -0.11], 'black'],
      ['magazine', 'rod', [0.02, 0.03], [-0.026, 0.05, -0.11], 'steel', [0, Math.PI / 2, 0]],
      ['grip', 'box', [0.028, 0.095, 0.038], [0, -0.012, 0.028], 'black', [-0.25, 0, 0]],
      ['trigger', 'box', [0.006, 0.005, 0.056], [0, 0.006, -0.032], 'steel'],
      ['trigger', 'box', [0.006, 0.03, 0.005], [0, 0.02, -0.06], 'steel'],
      ['trigger', 'box', [0.004, 0.018, 0.004], [0, 0.02, -0.028], 'grey'],
      // the stock folded forward under the barrel: two thin arms from the hinge, the butt plate hanging below the shroud
      ['stock', 'rod', [0.0042, 0.3], [0.017, 0.022, -0.05], 'steel'],
      ['stock', 'rod', [0.0042, 0.3], [-0.017, 0.022, -0.05], 'steel'],
      ['stock', 'box', [0.042, 0.012, 0.014], [0, 0.024, 0.1], 'grey'],
      ['stock', 'box', [0.056, 0.05, 0.008], [0, 0.006, -0.205], 'steel'],
    ],
  },
  dl44: {
    muzzle: [0, 0.055, -0.305],
    parts: [
      ['frame', 'box', [0.032, 0.05, 0.17], [0, 0.05, -0.055], 'steel'],
      ['frame', 'box', [0.034, 0.012, 0.06], [0, 0.079, -0.02], 'grey'],
      ['barrel', 'rod', [0.011, 0.11], [0, 0.055, -0.195], 'steel'],
      ['flash hider', 'cone', [0.021, 0.012, 0.055], [0, 0.055, -0.2775], 'steel'],
      ['flash hider', 'bore', [0.009], [0, 0.055, -0.3045], 'hole'],
      ['scope', 'rod', [0.0115, 0.13], [0, 0.105, -0.065], 'black'],
      ['scope', 'rod', [0.0135, 0.012], [0, 0.105, -0.132], 'light'],
      ['scope', 'rod', [0.0135, 0.012], [0, 0.105, 0.002], 'grey'],
      ['scope', 'box', [0.01, 0.024, 0.07], [0, 0.084, -0.065], 'steel'],
      ['magazine', 'box', [0.028, 0.055, 0.045], [0, 0.0, -0.085], 'black'],
      ['grip', 'box', [0.03, 0.095, 0.034], [0, -0.022, 0.03], 'black', [-0.35, 0, 0]],
      ['hammer', 'box', [0.012, 0.02, 0.015], [0, 0.083, 0.036], 'grey'],
      ['trigger', 'box', [0.006, 0.005, 0.04], [0, 0.002, -0.035], 'steel'],
      ['trigger', 'box', [0.004, 0.016, 0.004], [0, 0.016, -0.03], 'grey'],
    ],
  },
  dh17: {
    muzzle: [0, 0.05, -0.242],
    parts: [
      ['receiver', 'rod', [0.019, 0.2], [0, 0.05, -0.06], 'steel'],
      ['receiver', 'rod', [0.021, 0.014], [0, 0.05, 0.047], 'grey'],
      ['shroud', 'rod', [0.0205, 0.06], [0, 0.05, -0.13], 'steel'],
      ['holes', 'holes', [0.0205, 0.045, 3, 8, 0.0045], [0, 0.05, -0.13], 'hole'],
      ['barrel', 'rod', [0.012, 0.07], [0, 0.05, -0.195], 'steel'],
      ['muzzle', 'rod', [0.015, 0.012], [0, 0.05, -0.236], 'grey'],
      ['muzzle', 'bore', [0.007], [0, 0.05, -0.2415], 'hole'],
      ['sight', 'box', [0.005, 0.016, 0.01], [0, 0.074, -0.22], 'steel'],
      ['sight', 'box', [0.014, 0.014, 0.012], [0, 0.073, 0.03], 'steel'],
      ['magazine', 'box', [0.11, 0.022, 0.032], [-0.075, 0.05, -0.08], 'black'],
      ['grip', 'box', [0.028, 0.09, 0.036], [0, -0.012, 0.022], 'black', [-0.25, 0, 0]],
      ['trigger', 'box', [0.006, 0.005, 0.05], [0, 0.006, -0.03], 'steel'],
      ['trigger', 'box', [0.004, 0.018, 0.004], [0, 0.02, -0.026], 'grey'],
    ],
  },
  a280: {
    muzzle: [0, 0.05, -0.67],
    parts: [
      ['receiver', 'box', [0.05, 0.07, 0.3], [0, 0.05, -0.08], 'steel'],
      ['handguard', 'rod', [0.024, 0.22], [0, 0.048, -0.34], 'steel'],
      ['holes', 'holes', [0.024, 0.18, 7, 6, 0.0055], [0, 0.048, -0.34], 'hole'],
      ['barrel', 'rod', [0.011, 0.18], [0, 0.05, -0.54], 'steel'],
      ['muzzle', 'rod', [0.017, 0.04], [0, 0.05, -0.65], 'grey'],
      ['muzzle', 'bore', [0.008], [0, 0.05, -0.6695], 'hole'],
      ['scope', 'rod', [0.016, 0.2], [0, 0.118, -0.08], 'black'],
      ['scope', 'rod', [0.0185, 0.016], [0, 0.118, -0.178], 'light'],
      ['scope', 'rod', [0.0185, 0.016], [0, 0.118, 0.018], 'grey'],
      ['scope', 'box', [0.014, 0.03, 0.12], [0, 0.092, -0.08], 'steel'],
      ['magazine', 'box', [0.03, 0.12, 0.06], [0, -0.035, -0.13], 'black', [0.15, 0, 0]],
      ['grip', 'box', [0.03, 0.095, 0.038], [0, -0.03, 0.03], 'black', [-0.3, 0, 0]],
      ['trigger', 'box', [0.006, 0.005, 0.05], [0, 0.0, -0.03], 'steel'],
      ['cell', 'box', [0.018, 0.04, 0.09], [0.033, 0.05, -0.06], 'grey'],
      // the stock out to the shoulder, its butt pad square
      ['stock', 'box', [0.04, 0.085, 0.27], [0, 0.012, 0.2], 'black', [0.06, 0, 0]],
      ['stock', 'box', [0.046, 0.11, 0.02], [0, 0.0, 0.335], 'grey'],
    ],
  },
};

export const GUN_PARTS = Object.freeze(Object.fromEntries(Object.entries(GUNS).map(([k, g]) => [k, Object.freeze([...new Set(g.parts.map((p) => p[0]))])])));

const SIDES = 14; // round a rod: enough that a barrel held near the eye isn’t faceted

function holesGeo([r, length, rows, round, hole]) {
  const discs = [];
  for (let i = 0; i < rows; i++) {
    const z = rows > 1 ? -length / 2 + (length * i) / (rows - 1) : 0;
    for (let k = 0; k < round; k++) {
      // every other row turned half a hole, as the drilling was
      const a = ((k + (i % 2) * 0.5) / round) * Math.PI * 2;
      // a disc faces +z; turned to face out from the rod, a whisker proud of it
      discs.push(new THREE.CircleGeometry(hole, 8).rotateY(Math.PI / 2).rotateZ(a).translate(Math.cos(a) * (r + 0.0006), Math.sin(a) * (r + 0.0006), z));
    }
  }
  const merged = mergeGeometries(discs);
  for (const d of discs) d.dispose();
  return merged;
}

function partGeo(shape, size) {
  if (shape === 'box') return new THREE.BoxGeometry(...size);
  if (shape === 'rod') return new THREE.CylinderGeometry(size[0], size[0], size[1], SIDES).rotateX(Math.PI / 2);
  // (a cylinder’s top is +y, and turned onto z it is the back)
  if (shape === 'cone') return new THREE.CylinderGeometry(size[1], size[0], size[2], SIDES).rotateX(Math.PI / 2);
  if (shape === 'bore') return new THREE.CircleGeometry(size[0], SIDES).rotateY(Math.PI);
  return holesGeo(size);
}

const _turn = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _colour = new THREE.Color();

function gunGeo(spec) {
  const geos = spec.parts.map(([, shape, size, [x, y, z], tone, turn]) => {
    const g = partGeo(shape, size);
    if (turn) g.applyMatrix4(_turn.makeRotationFromEuler(_euler.set(...turn)));
    g.translate(x, y, z);
    _colour.setHex(TONES[tone]);
    const n = g.attributes.position.count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colours.set([_colour.r, _colour.g, _colour.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return g;
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}

const built = new Map(); // kind → geometry, for the page’s life (or until disposeGuns)
let finish = null;

export function buildGun(kind) {
  const spec = GUNS[kind];
  if (!spec) return null;
  if (!built.has(kind)) built.set(kind, gunGeo(spec));
  // blued steel: the colours are the finishes, the sheen the same on all
  finish ??= new THREE.MeshStandardMaterial({ name: 'ds-gun', vertexColors: true, roughness: 0.42, metalness: 0.55, envMapIntensity: 0.7 });
  const group = new THREE.Group();
  group.name = `blaster-${kind}`;
  const mesh = new THREE.Mesh(built.get(kind), finish);
  mesh.name = `blaster-${kind}-body`;
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(...spec.muzzle);
  group.add(mesh, muzzle);
  return group;
}

export function disposeGuns() {
  for (const g of built.values()) g.dispose();
  built.clear();
  finish?.dispose();
  finish = null;
}
