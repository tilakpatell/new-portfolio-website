// Marks on the bases' walls and floors, as flat shapes rather than
// pictures, so they stay sharp up close and cost no texture: the Rebel
// Alliance's starbird, the Empire's crest, the Republic's, and a blaster's
// or an engine's scorch. Each lies flat at z = 0 and faces +z. A builder
// puts one 3 cm proud of a wall as a kit part:
//   part(insignia('rebel', 2.4), { at, rot, color: '#b8452e', to: 'paint' })
// Pure: geometry, no canvas.

import * as THREE from 'three';
import { rng } from './noise';

const TAU = Math.PI * 2;

// a ring (an annulus) round the middle
function ring(outer, inner) {
  const s = new THREE.Shape().absarc(0, 0, outer, 0, TAU, false);
  s.holes.push(new THREE.Path().absarc(0, 0, inner, 0, TAU, true));
  return s;
}

const poly = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));

// a spoke from `r0` to `r1` along angle `a`, `w0` wide at its foot, `w1` at its tip
function spoke(a, r0, r1, w0, w1) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at = (r, w) => [c * r - s * w, s * r + c * w];
  return poly([at(r0, -w0 / 2), at(r1, -w1 / 2), at(r1, w1 / 2), at(r0, w0 / 2)]);
}

// The shapes of each, a unit across (made to size after)
const SHAPES = {
  // the starbird: a broken ring, the spire through the middle of it, and
  // the two wings swept up from its foot
  rebel() {
    const shapes = [ring(0.5, 0.43), poly([[0, -0.56], [0.065, -0.22], [0.05, 0.3], [0, 0.72], [-0.05, 0.3], [-0.065, -0.22]])];
    for (const sx of [-1, 1]) {
      const w = new THREE.Shape();
      w.moveTo(sx * 0.03, -0.5);
      w.quadraticCurveTo(sx * 0.56, -0.38, sx * 0.44, 0.44);
      w.quadraticCurveTo(sx * 0.2, 0.02, sx * 0.03, -0.3);
      w.closePath();
      shapes.push(w);
    }
    return shapes;
  },
  // the Empire's: a ring, a hub, and six spokes between them
  imperial() {
    const shapes = [ring(0.5, 0.41), ring(0.19, 0.1)];
    for (let i = 0; i < 6; i++) shapes.push(spoke((i / 6) * TAU + Math.PI / 6, 0.17, 0.43, 0.07, 0.16));
    return shapes;
  },
  // the Republic's: a ring, a solid hub, eight spokes
  republic() {
    const shapes = [ring(0.5, 0.42), new THREE.Shape().absarc(0, 0, 0.16, 0, TAU, false)];
    for (let i = 0; i < 8; i++) shapes.push(spoke((i / 8) * TAU, 0.14, 0.44, 0.05, 0.11));
    return shapes;
  },
};

// the shapes as one flat geometry, centred, its larger side `size`
function made(shapes, size) {
  const g = new THREE.ShapeGeometry(shapes, 10);
  g.computeBoundingBox();
  const b = g.boundingBox;
  const c = b.getCenter(new THREE.Vector3());
  const s = b.getSize(new THREE.Vector3());
  g.translate(-c.x, -c.y, 0);
  g.scale(size / Math.max(s.x, s.y), size / Math.max(s.x, s.y), 1);
  return g;
}

export function insignia(kind, size = 1) {
  const shapes = SHAPES[kind];
  if (!shapes) throw new Error(`no insignia called ${kind}`);
  return made(shapes(), size);
}

// a scorch: a ragged blot, `r` at its widest (stack a pale wide one under a
// dark small one for a burnt edge)
export function scorch(r = 1, seed = 1) {
  const rand = rng(seed);
  const n = 22;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const d = r * (0.55 + 0.45 * rand());
    pts.push([Math.cos(a) * d, Math.sin(a) * d]);
  }
  return new THREE.ShapeGeometry(poly(pts));
}
