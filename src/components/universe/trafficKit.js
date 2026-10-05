// The pieces the traffic models are built from (trafficModels.js and the
// fleets in fleetStarwars.js and fleetRickmorty.js): putting parts
// together, shapes, small canvas textures and materials. See
// trafficModels.js for how a model is put together and what it returns.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const { PI, sin, cos, hypot } = Math;

// ── Putting parts together ──

export function compose(at = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  return new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...s));
}

// One part of a model: a geometry and how it's placed (at, rot, scale, or a
// whole matrix m), its colour, which material it's drawn with (`to`, paint
// unless said), how its texture lies (`uv`: a function of its position, or
// 'keep' for the geometry's own) and a mark, for the lights update() blinks.
export const part = (g, o = {}) => ({ g, ...o });

// Parts that move together (a wing with its engine and its cannon): the
// group's own placing goes on top of each part's.
export function place(list, at, rot, scale) {
  const M = compose(at, rot, scale);
  return list.map((p) => ({ ...p, parent: p.parent ? M.clone().multiply(p.parent) : M }));
}
export const mirror = (list) => place(list, undefined, undefined, [-1, 1, 1]);

// A part stretched from a to b (a strut, a limb, an antenna): a unit-tall
// tube standing on y, turned to run between them.
export function between(g, a, b, o = {}) {
  const A = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(A);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return { g, m: new THREE.Matrix4().compose(A.addScaledVector(d, 0.5), q, new THREE.Vector3(1, len, 1)), ...o };
}
export const rod = (a, b, r1, r2 = r1, o = {}, seg = 8) => between(new THREE.CylinderGeometry(r2, r1, 1, seg, 1), a, b, o);

export const col = (c) => (c instanceof THREE.Color ? c : Array.isArray(c) ? new THREE.Color(...c) : new THREE.Color(c ?? '#ffffff'));
export const KEEP = ['position', 'normal', 'uv'];

// Turn a mirrored part's triangles back the right way out.
export function flip(g) {
  for (const a of Object.values(g.attributes)) {
    const n = a.itemSize;
    for (let i = 0; i < a.count; i += 3) {
      for (let j = 0; j < n; j++) {
        const t = a.array[(i + 1) * n + j];
        a.array[(i + 1) * n + j] = a.array[(i + 2) * n + j];
        a.array[(i + 2) * n + j] = t;
      }
    }
  }
}

// Plating laid on every face from the side it faces most (so panels are the
// same size all over the model, whatever shape the part is).
export function boxUV(g, density) {
  const p = g.attributes.position.array;
  const uv = g.attributes.uv.array;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.length / 3; i += 3) {
    a.fromArray(p, i * 3);
    b.fromArray(p, i * 3 + 3);
    c.fromArray(p, i * 3 + 6);
    const n = b.sub(a).cross(c.sub(a));
    const [x, y, z] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const [u, v] = x >= y && x >= z ? [2, 1] : y >= z ? [0, 2] : [0, 1];
    for (let k = 0; k < 3; k++) {
      uv[(i + k) * 2] = p[(i + k) * 3 + u] * density;
      uv[(i + k) * 2 + 1] = p[(i + k) * 3 + v] * density;
    }
  }
}

// The parts, placed, coloured and merged into one geometry.
export function bake(list, density = 4) {
  const geos = [];
  const marks = {};
  let count = 0;
  for (const p of list) {
    const local = p.m ?? compose(p.at, p.rot, p.scale);
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
    const n = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.applyMatrix4(local);
    if (typeof p.uv === 'function') {
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      for (let i = 0; i < n; i++) uv.setXY(i, ...p.uv(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    if (p.parent) g.applyMatrix4(p.parent);
    if (local.determinant() * (p.parent ? p.parent.determinant() : 1) < 0) flip(g);
    if (!p.uv) boxUV(g, density);
    const c = col(p.color);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (p.mark) (marks[p.mark] ??= []).push([count, n]);
    count += n;
    geos.push(g);
  }
  for (const p of list) p.g.dispose();
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  merged.userData.marks = marks;
  return merged;
}

// One mesh per material, of the parts drawn with it.
export function meshes(k, list, mats) {
  const out = {};
  for (const [name, mat] of Object.entries(mats)) {
    const mine = list.filter((p) => (p.to ?? 'paint') === name);
    if (!mine.length) continue;
    out[name] = new THREE.Mesh(k.own(bake(mine, mat.userData.density ?? 4)), mat);
    out[name].name = name;
  }
  return out;
}

// Lights that blink: scale the colour of every part with a given mark (and
// only send the colours again when a light has changed).
export function blinker(geo) {
  const c = geo.attributes.color;
  const base = c.array.slice();
  const now = {};
  return (mark, kk) => {
    if (now[mark] === kk) return;
    now[mark] = kk;
    for (const [start, n] of geo.userData.marks[mark] ?? []) {
      for (let i = start * 3; i < (start + n) * 3; i++) c.array[i] = base[i] * kk;
    }
    c.needsUpdate = true;
  };
}

// Wings that flap: each vertex turns about its side's hinge (a line along z
// at ±hx, hy), further the further out it is, so the wing bends as it beats.
export function flapper(mesh, hx, hy, bend = 0) {
  const pos = mesh.geometry.attributes.position;
  const nor = mesh.geometry.attributes.normal;
  const p0 = pos.array.slice();
  const n0 = nor.array.slice();
  mesh.frustumCulled = false;
  return (angle) => {
    for (let i = 0; i < pos.count; i++) {
      const x = p0[i * 3];
      const side = x >= 0 ? 1 : -1;
      const dx = x - side * hx;
      const dy = p0[i * 3 + 1] - hy;
      const a = side * angle * (1 + bend * Math.abs(dx));
      const c = cos(a);
      const s = sin(a);
      pos.array[i * 3] = side * hx + dx * c - dy * s;
      pos.array[i * 3 + 1] = hy + dx * s + dy * c;
      const nx = n0[i * 3];
      const ny = n0[i * 3 + 1];
      nor.array[i * 3] = nx * c - ny * s;
      nor.array[i * 3 + 1] = nx * s + ny * c;
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  };
}

// ── Shapes ──

// A hull lofted through cross-sections along z: each { z, pts: [[x, y], …] },
// all with the same number of points, anticlockwise seen from the front,
// in order of z. Flat-shaded, and capped at both ends.
export function loft(sections, { caps = true } = {}) {
  const pos = [];
  const at = (s, i) => [s.pts[i][0], s.pts[i][1], s.z];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let i = 0; i < sections.length - 1; i++) {
    const A = sections[i];
    const B = sections[i + 1];
    const n = A.pts.length;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      tri(at(A, j), at(A, j2), at(B, j2));
      tri(at(A, j), at(B, j2), at(B, j));
    }
  }
  if (caps) {
    for (const [s, dir] of [
      [sections[0], -1],
      [sections.at(-1), 1],
    ]) {
      const contour = s.pts.map(([x, y]) => new THREE.Vector2(x, y));
      if (Math.abs(THREE.ShapeUtils.area(contour)) < 1e-9) continue;
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
        const [pa, pb, pc] = [at(s, a), at(s, b), at(s, c)];
        const z = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
        if (z * dir >= 0) tri(pa, pb, pc);
        else tri(pa, pc, pb);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Cross-sections for loft(), all eight points, starting low on the right:
// a w × h box with its corners cut by c, and a trapezoid (wb wide at the
// bottom, wt at the top), both centred at height y.
export function box8(w, h, c = 0, y = 0) {
  const x = w / 2;
  const t = h / 2;
  return [[x, y - t + c], [x, y + t - c], [x - c, y + t], [-x + c, y + t], [-x, y + t - c], [-x, y - t + c], [-x + c, y - t], [x - c, y - t]];
}
export function trap8(wb, wt, h, c = 0, y = 0) {
  const b = wb / 2;
  const u = wt / 2;
  const t = h / 2;
  const f = (c / h) * (u - b);
  return [[b + f, y - t + c], [u - f, y + t - c], [u - c, y + t], [-u + c, y + t], [-u + f, y + t - c], [-b - f, y - t + c], [-b + c, y - t], [b - c, y - t]];
}
// a flattened hexagon, pointed at the sides
export const hex6 = (w, h, y = 0, top = 0.3) => [[w / 2, y], [w * top, y + h / 2], [-w * top, y + h / 2], [-w / 2, y], [-w * top, y - h / 2], [w * top, y - h / 2]];
export const scaled = (pts, sx, sy = sx, cy = 0) => pts.map(([x, y]) => [x * sx, cy + (y - cy) * sy]);

// A plate cut to an outline [[u, v], …] (with holes), t thick, its edges
// bevelled by b, centred on its thickness. plateXZ lays the outline out as
// (x, z), thick in y (a wing); plateZY stands it up as (z, y), thick in x
// (a fin, a TIE's panel).
export function plate(outline, t, b = 0, holes = []) {
  const v2 = (pts) => pts.map(([u, v]) => new THREE.Vector2(u, v));
  const shape = new THREE.Shape(v2(outline));
  for (const h of holes) shape.holes.push(new THREE.Path(v2(h)));
  const depth = Math.max(t - 2 * b, 0.0005);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1, curveSegments: 6 });
  return g.translate(0, 0, -depth / 2);
}
export const plateXZ = (outline, t, b, holes) => plate(outline, t, b, holes).rotateX(PI / 2);
export const plateZY = (outline, t, b, holes) => plate(outline, t, b, holes).rotateY(-PI / 2);

// Turned about z, nose forward: a profile [[r, z], …] from the back to the front.
export const turned = (profile, seg = 16) => new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-4), z)), seg).rotateX(PI / 2);
// Turned about y (domes, heads, bodies standing up): [[r, y], …] bottom to top.
export const upright = (profile, seg = 16) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
export const ball = (r, at, scale = 1, o = {}, seg = 12) => part(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), { at, scale, ...o });

// A convex outline moved in by d all round.
export function inset(poly, d) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) area += poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1];
  const s = area > 0 ? 1 : -1;
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const L = hypot(dx, dy) || 1;
    return { p: [p[0] - (s * dy * d) / L, p[1] + (s * dx * d) / L], d: [dx, dy] };
  });
  return lines.map((l, i) => {
    const m = lines[(i + n - 1) % n];
    const cross = m.d[0] * l.d[1] - m.d[1] * l.d[0];
    if (Math.abs(cross) < 1e-9) return l.p;
    const t = ((l.p[0] - m.p[0]) * l.d[1] - (l.p[1] - m.p[1]) * l.d[0]) / cross;
    return [m.p[0] + m.d[0] * t, m.p[1] + m.d[1] * t];
  });
}

// ── Textures ──

export function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
export const grey = (v) => {
  const c = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c},${c},${c})`;
};

// Hull plating: a square split and split again into panels, each its own
// shade with a dark seam along two edges (so it tiles), and now and then a
// hatch, a vent or a row of rivets. Grey, so the paint's colour shows through.
export function panelTexture(rand, { min = 14, base = 226, spread = 12, seam = 0.6, detail = 0.3 } = {}) {
  return canvasTexture(256, (g, S) => {
    const leaf = (x, y, w, h) => {
      g.fillStyle = grey(base + (rand() - 0.5) * 2 * spread);
      g.fillRect(x, y, w, h);
      if (rand() < detail && w > 9 && h > 9) {
        const r = rand();
        if (r < 0.4) {
          g.fillStyle = grey(base * 0.74);
          g.fillRect(x + 3, y + 3, w - 6, h - 6);
          g.fillStyle = grey(base * 0.95);
          g.fillRect(x + 4, y + 4, w - 8, h - 8);
        } else if (r < 0.7) {
          g.fillStyle = grey(base * 0.62);
          for (let i = y + 3; i < y + h - 3; i += 3) g.fillRect(x + 3, i, w - 6, 1);
        } else {
          g.fillStyle = grey(base * 0.7);
          for (let i = x + 3; i < x + w - 2; i += 4) g.fillRect(i, y + 2, 1, 1);
        }
      }
      g.fillStyle = grey(base * seam);
      g.fillRect(x, y, w, 1);
      g.fillRect(x, y, 1, h);
    };
    const split = (x, y, w, h, depth) => {
      const canW = w >= min * 2;
      const canH = h >= min * 2;
      if ((!canW && !canH) || (depth > 2 && rand() < 0.2)) return leaf(x, y, w, h);
      if (canW && (!canH || (w > h ? rand() < 0.75 : rand() < 0.25))) {
        const c = Math.round(min + rand() * (w - 2 * min));
        split(x, y, c, h, depth + 1);
        split(x + c, y, w - c, h, depth + 1);
      } else {
        const c = Math.round(min + rand() * (h - 2 * min));
        split(x, y, w, c, depth + 1);
        split(x, y + c, w, h - c, depth + 1);
      }
    };
    split(0, 0, S, S, 0);
  });
}

// A TIE's solar panel: dark cells in rings round the hub, a faint grid
// between them and deep grooves out to each corner. `outline` and `hub` are
// in the panel's own (z, y); `uv` maps them to the texture as the panel's
// uv function does.
export function solarTexture(rand, outline, hub, uv) {
  return canvasTexture(256, (g, S) => {
    const P = (z, y) => {
      const [u, v] = uv(0, y, z);
      return [u * S, (1 - v) * S];
    };
    const ring = (f) => outline.map(([z, y]) => P(hub[0] + (z - hub[0]) * f, hub[1] + (y - hub[1]) * f));
    g.fillStyle = '#121418';
    g.fillRect(0, 0, S, S);
    const N = 9;
    for (let i = 0; i < N; i++) {
      const a = ring((i + 1) / N);
      const b = ring(i / N);
      for (let s = 0; s < outline.length; s++) {
        const s2 = (s + 1) % outline.length;
        const v = 24 + rand() * 12;
        g.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
        g.beginPath();
        g.moveTo(...a[s]);
        g.lineTo(...a[s2]);
        g.lineTo(...b[s2]);
        g.lineTo(...b[s]);
        g.closePath();
        g.fill();
      }
    }
    g.strokeStyle = '#4a525c';
    g.lineWidth = 1.2;
    for (let i = 1; i <= N; i++) {
      g.beginPath();
      ring(i / N).forEach((p, j) => (j ? g.lineTo(...p) : g.moveTo(...p)));
      g.closePath();
      g.stroke();
    }
    g.strokeStyle = '#050607';
    g.lineWidth = 5;
    for (const [z, y] of outline) {
      g.beginPath();
      g.moveTo(...P(...hub));
      g.lineTo(...P(z, y));
      g.stroke();
    }
  });
}

// ── Materials ──

export const standard = (k, o) => k.own(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }));
export const glowMaterial = (k) => k.own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
export const flicker = (t, seed = 0) => 1 + 0.07 * sin(t * 37 + seed) + 0.05 * sin(t * 23.7 + seed * 2.3);
export const pulse = (t, period, phase = 0, width = 0.08) => ((((t / period + phase) % 1) + 1) % 1 < width ? 1 : 0);
