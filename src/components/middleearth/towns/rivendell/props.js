// Rivendell, made in code: the kit the fourth walkable town is built from.
// The house of Elrond on its terraces, its open arcades of slender columns
// and pointed arches under upswept, leaf-like roofs; the room where Frodo
// wakes; Bilbo's pavilion; the hall of Narsil with its painting, its statue
// and the shards; the Council's court, its chairs and its plinth; the bridge
// over the gorge, the falls and the cliffs they fall from; beeches and
// birches in their autumn gold, and the leaves they drop; the south gate,
// lanterns, and the Ring.
//
// Built with the Shire's kit (../../shire/props.js) as Bree's is: its
// materials and helpers, and its own for pale carved stone, bronze-green
// roofs, gilding, glass, water and leaves. The same conventions: each
// builder's group stands on y = 0 at its origin, buildings face +z, figures
// and seats face +x, and fixed parts are merged one mesh per material.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../../../../lib/stage3d';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { stoneTextures } from '../../kit';
import { B, ball, blob, boxUV, createShireKit, cyl, cylX, lathe, parts, rng, roundBox, tube } from '../../shire/props';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// ── small helpers ──

// A colour on every vertex, from fn(x, y, z, out, i).
const _kc = new THREE.Color();
function tint(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), _kc, i);
    col[i * 3] = _kc.r;
    col[i * 3 + 1] = _kc.g;
    col[i * 3 + 2] = _kc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Geometries in one, for instancing: positions, normals and colours only.
function oneGeo(list) {
  const out = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  const g = mergeGeometries(out, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// A flat shape's texture coordinates: the box (x0, y0, w, h) to 0..1.
function shapeUV(geo, x0, y0, w, h) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - x0) / w;
    uv[i * 2 + 1] = (p.getY(i) - y0) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// A carved band's texture coordinates: u along x (or z), `rep` metres a
// repeat, v from its foot at y0 to its top at y0 + h.
function bandUV(geo, y0, h, rep, along = 'x') {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (along === 'x' ? p.getX(i) : p.getZ(i)) / rep;
    uv[i * 2 + 1] = (p.getY(i) - y0) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

const shapeOf = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const pathOf = (pts) => new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const ext = (shape, depth, bevel = 0) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 4 });

// ── arches ──

// The curve of a pointed arch springing at (±a, 0) and rising to a point at
// (0, rise): two arcs, each struck from the far side (round, if it is no
// higher than it is wide). `kick` draws the point up into a little ogee
// flame, as the elves like it. From the left foot, over, to the right.
function archCurve(a, rise, n = 8, kick = 0) {
  const pts = [];
  if (rise <= a * 1.02) {
    for (let i = 0; i <= 2 * n; i++) {
      const t = Math.PI * (1 - i / (2 * n));
      pts.push([Math.cos(t) * a, Math.sin(t) * rise]);
    }
    return pts;
  }
  const xc = (rise * rise - a * a) / (2 * a);
  const R = xc + a;
  const t1 = Math.atan2(rise, -xc);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const t = mix(Math.PI, t1, f);
    let x = xc + Math.cos(t) * R;
    let y = Math.sin(t) * R;
    if (kick) {
      const k = smooth(0.5, 1, f);
      x *= 1 - kick * 0.4 * k * k;
      y += kick * a * 0.45 * k * k * k;
    }
    pts.push([x, y]);
  }
  for (let i = n - 1; i >= 0; i--) pts.push([-pts[i][0], pts[i][1]]);
  return pts;
}
const archTop = (a, rise, kick = 0) => (rise <= a * 1.02 ? rise : rise + kick * a * 0.45);

// An arched opening's outline: straight sides `hs` high, then the arch.
function archOpening(a, hs, rise, n = 8, kick = 0) {
  const arch = archCurve(a, rise, n, kick).slice(1, -1).map(([x, y]) => [x, y + hs]);
  if (hs < 1e-4) return [[-a, 0], ...arch, [a, 0]];
  return [[-a, 0], [-a, hs], ...arch, [a, hs], [a, 0]];
}

// The moulding round an arched opening, `f` wide, open at the foot.
function archFrame(a, hs, rise, f, n = 8, kick = 0) {
  const outer = archOpening(a + f, hs, rise + f * 1.15, n, kick);
  const inner = archOpening(a, hs, rise, n, kick).reverse();
  return [...outer, ...inner];
}

// A band of wall with arches cut up into it from below, between columns at
// `xs` (their tops at y = 0); each opening runs from one column's abacus
// (`half` either side of it) to the next's, rising `ratio` times its half
// span, and no higher than `top` less a margin.
function arcadeShape(xs, half, top, { ratio = 1.75, kick = 0.35, n = 9, margin = 0.24 } = {}) {
  const pts = [[xs[0] - half, 0]];
  for (let i = 0; i < xs.length - 1; i++) {
    const l = xs[i] + half;
    const r = xs[i + 1] - half;
    const a = (r - l) / 2;
    const cx = (l + r) / 2;
    const rise = Math.min(a * ratio, top - margin - kick * a * 0.45);
    pts.push([l, 0]);
    for (const [x, y] of archCurve(a, rise, n, kick).slice(1, -1)) pts.push([cx + x, y]);
    pts.push([r, 0]);
  }
  pts.push([xs[xs.length - 1] + half, 0], [xs[xs.length - 1] + half, top], [xs[0] - half, top]);
  return shapeOf(pts);
}
const bayRise = (a, top, { ratio = 1.75, kick = 0.35, margin = 0.24 } = {}) => Math.min(a * ratio, top - margin - kick * a * 0.45);

// A wall `w` wide and `h` high (foot at y = 0, centred on x = 0) with
// arched openings { x, y, a, hs, rise }: y is the sill, and a door (y = 0)
// is cut up from the foot.
function wallShape(w, h, opens = [], kick = 0.35) {
  const doors = opens.filter((o) => o.y <= 0.001).sort((p, q) => p.x - q.x);
  const pts = [[-w / 2, 0]];
  for (const o of doors) for (const [x, y] of archOpening(o.a, o.hs, o.rise, o.n ?? 8, o.kick ?? kick)) pts.push([o.x + x, y]);
  pts.push([w / 2, 0], [w / 2, h], [-w / 2, h]);
  const s = shapeOf(pts);
  for (const o of opens) {
    if (o.y <= 0.001) continue;
    s.holes.push(pathOf(archOpening(o.a, o.hs, o.rise, o.n ?? 8, o.kick ?? kick).map(([x, y]) => [o.x + x, o.y + y])));
  }
  return s;
}

// ── painted textures ──

// Pale elven stone, nearly white so a material's colour warms it: a fine
// limestone grain, soft clouding, here and there a faint vein, and the
// joints of big smooth-dressed blocks, barely there. With its relief.
function elfstoneCanvas(S, seed, { rows = 3, across = 2, joint = 1 } = {}) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const row = Math.floor(v * rows);
    const shift = (row * 0.37) % 1;
    const bu = u * across + shift;
    const col = Math.floor(bu);
    const fu = bu - col;
    const fv = v * rows - row;
    const d = Math.min(Math.min(fu, 1 - fu) / across, Math.min(fv, 1 - fv) / rows);
    const j = (1 - smooth(0.001, 0.005, d)) * joint * 0.7;
    const cloud = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const grain = n(u * 128, v * 128, 128);
    const vein = (1 - smooth(0, 0.025, Math.abs(fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 3 }) - 0.5))) * smooth(0.55, 0.7, n(u * 2 + 3, v * 2, 2));
    const tone = n((col % across) * 3.1 + row * 5.7, 1.3) - 0.5;
    const t = 0.92 + (cloud - 0.5) * 0.12 + (grain - 0.5) * 0.05 - j * 0.12 - vein * 0.06 + tone * 0.035;
    field[py * S + px] = clamp01(0.6 + cloud * 0.2 + grain * 0.12 - j * 0.4);
    out[0] = 255 * Math.min(1, t);
    out[1] = 250 * Math.min(1, t);
    out[2] = 240 * Math.min(1, t * 0.99);
  });
  return { c, field };
}

// A box blur of a height field, in place, wrapping at the edges.
function blurField(f, w, h, r) {
  const tmp = new Float32Array(f.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += f[y * w + ((x + k + w) % w)];
      tmp[y * w + x] = s / (2 * r + 1);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[((y + k + h) % h) * w + x];
      f[y * w + x] = s / (2 * r + 1);
    }
  }
  return f;
}

// White drawing on a black canvas as a height field.
function fieldOf(c) {
  const { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = d[i * 4] / 255;
  return f;
}

// Art Nouveau carving for a frieze, repeating along the band: a vine that
// waves from end to end, a tendril curling off each crest into the hollow,
// and pointed leaves along it. Gives the relief (for a normal map) and a
// pale stone picture shaded darker down in the cuts.
function carvingCanvas(W = 512, H = 128) {
  const draw = makeCanvas(W, H);
  const g = draw.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const waves = 2;
  const yAt = (x) => H / 2 + Math.sin((x / W) * TAU * waves) * H * 0.16;
  const leaf = (x, y, ang, len, wid) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.45, -wid, len, 0);
    g.quadraticCurveTo(len * 0.45, wid, 0, 0);
    g.fill();
    g.restore();
  };
  for (const dx of [-W, 0, W]) {
    g.save();
    g.translate(dx, 0);
    // the stem
    g.lineWidth = 9;
    g.beginPath();
    for (let x = -10; x <= W + 10; x += 4) (x === -10 ? g.moveTo(x, yAt(x)) : g.lineTo(x, yAt(x)));
    g.stroke();
    // the tendrils curl off the crests into the hollows, in spirals
    for (let k = 0; k < waves * 2; k++) {
      const x0 = ((k + 0.5) / (waves * 2)) * W;
      const up = k % 2 === 0 ? 1 : -1;
      const y0 = yAt(x0);
      g.lineWidth = 5;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = t * 4.4;
        const rr = (1 - t * 0.82) * H * 0.2;
        const cx = x0 + W * 0.07;
        const cy = y0 + up * H * 0.2;
        const px = cx - Math.cos(a) * rr;
        const py = cy - up * Math.sin(a + Math.PI / 2) * rr;
        if (i) g.lineTo(px, py);
        else g.moveTo(x0, y0);
      }
      g.stroke();
      g.beginPath();
      g.arc(x0 + W * 0.07, y0 + up * H * 0.2, 4, 0, TAU);
      g.fill();
      // leaves either side of the stem
      for (const [f, side] of [[0.18, -1], [0.32, 1], [0.0, 1]]) {
        const x = x0 + (f - 0.25) * W * 0.5;
        leaf(x, yAt(x), side * -0.75, H * 0.3, H * 0.1);
      }
    }
    g.restore();
  }
  // a fillet at the top and the foot of the band
  g.fillRect(0, 0, W, 8);
  g.fillRect(0, H - 8, W, 8);
  const field = blurField(fieldOf(draw), W, H, 2);
  const c = makeCanvas(W, H);
  const n = makeNoise(31);
  const blurred = blurField(Float32Array.from(field), W, H, 4);
  paintPixels(c, (u, v, out, px, py) => {
    const h = field[py * W + px];
    const cut = clamp01(blurred[py * W + px] * 1.6 - h * 1.2);
    const t = (0.84 + h * 0.14 - cut * 0.3 + (n(u * 64, v * 16, 64) - 0.5) * 0.06) * 255;
    out[0] = t;
    out[1] = t * 0.975;
    out[2] = t * 0.93;
  });
  return { c, field, W, H };
}

// Flowing tracery cut through a panel (white where the stone is, clear
// between), repeating across: a tall ogee arch from one side to the other,
// a leaf hanging in it with its midrib, whiplash tendrils curling in from
// the feet, and a rail top and foot to join it to the rails.
function traceryCanvas(S = 256) {
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const dx of [-S, 0, S]) {
    g.save();
    g.translate(dx, 0);
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(0, S);
    g.bezierCurveTo(0, S * 0.42, S * 0.42, S * 0.36, S / 2, S * 0.06);
    g.bezierCurveTo(S * 0.58, S * 0.36, S, S * 0.42, S, S);
    g.stroke();
    // the leaf, hanging from the arch's point
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(S / 2, S * 0.12);
    g.bezierCurveTo(S * 0.66, S * 0.36, S * 0.64, S * 0.62, S / 2, S * 0.8);
    g.bezierCurveTo(S * 0.36, S * 0.62, S * 0.34, S * 0.36, S / 2, S * 0.12);
    g.stroke();
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(S / 2, S * 0.2);
    g.lineTo(S / 2, S * 0.92);
    g.stroke();
    // tendrils from the arch's feet, curling in under the leaf
    for (const s of [-1, 1]) {
      g.lineWidth = 8;
      g.beginPath();
      const x0 = S / 2 + s * S * 0.47;
      g.moveTo(x0, S * 0.66);
      g.bezierCurveTo(S / 2 + s * S * 0.3, S * 0.95, S / 2 + s * S * 0.1, S * 0.98, S / 2 + s * S * 0.12, S * 0.8);
      g.bezierCurveTo(S / 2 + s * S * 0.13, S * 0.7, S / 2 + s * S * 0.24, S * 0.72, S / 2 + s * S * 0.22, S * 0.8);
      g.stroke();
      g.beginPath();
      g.arc(S / 2 + s * S * 0.2, S * 0.8, 6, 0, TAU);
      g.fill();
      // a small curl up in the spandrel
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(S / 2 + s * S * 0.38, S * 0.2);
      g.bezierCurveTo(S / 2 + s * S * 0.44, S * 0.06, S / 2 + s * S * 0.3, S * 0.04, S / 2 + s * S * 0.3, S * 0.13);
      g.stroke();
    }
    g.restore();
  }
  g.fillRect(0, 0, S, 10);
  g.fillRect(0, S - 10, S, 10);
  return c;
}

// Filigree for the head of an arch (cut to the arch's shape by its
// geometry): a stem up the middle, branches that curl out either side
// and back, a ring with a four-petalled flower in it near the top.
function archFillCanvas(S = 256) {
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(S / 2, S);
  g.lineTo(S / 2, S * 0.05);
  g.stroke();
  for (const s of [-1, 1]) {
    for (const [y0, k] of [[0.92, 1], [0.66, 0.8], [0.42, 0.6]]) {
      g.lineWidth = 7 * k + 2;
      g.beginPath();
      g.moveTo(S / 2, S * y0);
      g.bezierCurveTo(S / 2 + s * S * 0.5 * k, S * (y0 - 0.02), S / 2 + s * S * 0.48 * k, S * (y0 - 0.26 * k), S / 2 + s * S * 0.26 * k, S * (y0 - 0.2 * k));
      g.bezierCurveTo(S / 2 + s * S * 0.16 * k, S * (y0 - 0.15 * k), S / 2 + s * S * 0.22 * k, S * (y0 - 0.08 * k), S / 2 + s * S * 0.3 * k, S * (y0 - 0.1 * k));
      g.stroke();
    }
  }
  g.lineWidth = 8;
  g.beginPath();
  g.arc(S / 2, S * 0.2, S * 0.1, 0, TAU);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(S / 2, S * 0.2);
    g.rotate((i * Math.PI) / 2 + Math.PI / 4);
    g.beginPath();
    g.ellipse(0, -S * 0.045, S * 0.022, S * 0.045, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.lineWidth = 12;
  g.strokeRect(0, 0, S, S);
  return c;
}

// Leaded glass for a tall arched window, mapped over its whole opening:
// pale glass in panes of slightly differing tints, cames of lead between,
// a mullion that parts into two lancets near the top, and a ring in the head.
function glassCanvas(W = 64, H = 128) {
  const c = makeCanvas(W, H);
  const n = makeNoise(9);
  paintPixels(c, (u, v, out) => {
    const k = 0.78 + fbm(n, u * 3, v * 6, { octaves: 3 }) * 0.3 + v * 0.08;
    out[0] = 230 * k;
    out[1] = 226 * k;
    out[2] = 212 * k;
  });
  const g = c.getContext('2d');
  g.strokeStyle = '#1c1a18';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W / 2, H);
  g.lineTo(W / 2, H * 0.42);
  for (const s of [-1, 1]) {
    g.moveTo(W / 2, H * 0.42);
    g.bezierCurveTo(W / 2 + s * W * 0.02, H * 0.3, W / 2 + s * W * 0.4, H * 0.32, W / 2 + s * W * 0.46, H * 0.4);
  }
  for (const y of [0.62, 0.82]) {
    g.moveTo(0, H * y);
    g.lineTo(W, H * y);
  }
  g.stroke();
  g.beginPath();
  g.arc(W / 2, H * 0.2, W * 0.14, 0, TAU);
  g.stroke();
  g.lineWidth = 3;
  g.strokeRect(0, 0, W, H);
  return c;
}

// Leaf-shaped shingles of bronze gone green: courses of overlapping scales,
// each pointed like a leaf's tip with a faint midrib, the course above
// lying over the top of the one below; verdigris in streaks and blooms,
// darker in the steps. Rows run across u; v runs down the slope.
function roofCanvas(S = 256) {
  const n = makeNoise(41);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const rows = 8;
  const cols = 8;
  const len = (fu) => 1.45 - 0.45 * Math.pow(Math.abs(fu * 2 - 1), 1.3);
  const hash = (a, b) => n(a * 7.13 + 0.5, b * 3.71 + 0.5);
  paintPixels(c, (u, v, out, px, py) => {
    const row = Math.floor(v * rows);
    const fv = v * rows - row;
    // the scale of the course above, if its tip reaches down to here
    let r0 = row - 1;
    let sh = (((r0 % 2) + 2) % 2) * 0.5;
    let fu = (u * cols + sh) % 1;
    let loc = fv + 1;
    if (loc >= len(fu)) {
      r0 = row;
      sh = (((r0 % 2) + 2) % 2) * 0.5;
      fu = (u * cols + sh) % 1;
      loc = fv;
    }
    const l = len(fu);
    const h = loc / l;
    const id = hash(Math.floor(u * cols + sh) % cols, ((r0 % rows) + rows) % rows);
    const rib = 1 - smooth(0.0, 0.05, Math.abs(fu - 0.5));
    const edge = smooth(0.0, 0.08, Math.min(fu, 1 - fu));
    const height = 0.25 + h * 0.6 + rib * 0.08 * h;
    field[py * S + px] = height * (0.6 + edge * 0.4);
    const patina = fbm(n, u * 6 + 3, v * 6, { period: 6, octaves: 4 });
    const streak = smooth(0.55, 0.8, n(u * 40, v * 3, 40));
    const shade = 0.62 + h * 0.38 + (id - 0.5) * 0.2 - (1 - edge) * 0.25;
    // bronze-green, lighter verdigris in blooms and streaks
    const vg = clamp01(smooth(0.45, 0.75, patina) * 0.8 + streak * 0.35);
    const r = mix(150, 150, vg);
    const gg = mix(160, 205, vg);
    const b = mix(140, 180, vg);
    out[0] = r * shade;
    out[1] = gg * shade;
    out[2] = b * shade;
  });
  return { c, field };
}

// Rock for the cliffs, pale so the vertex colours give its hue: a coarse
// grain, faint bedding lines across, and hairline cracks.
function rockCanvas(S = 256, seed = 5) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 2);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 96, v * 96, 96);
    const bed = Math.sin((v * 7 + fbm(n, u * 2, v * 2 + 5, { period: 2, octaves: 2 }) * 0.8) * TAU) * 0.5 + 0.5;
    const k = cells(u * 6, v * 3, 3);
    const crack = 1 - smooth(0, 0.035, k.f2 - k.f1);
    field[py * S + px] = clamp01(0.4 + big * 0.4 + grain * 0.15 - crack * 0.35 + bed * 0.08);
    const t = 0.78 + big * 0.22 + (grain - 0.5) * 0.12 - crack * 0.3 - bed * 0.05;
    out[0] = 240 * t;
    out[1] = 236 * t;
    out[2] = 228 * t;
  });
  return { c, field };
}

// Linen, white and finely woven.
function linenCanvas(S = 128) {
  const n = makeNoise(17);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const weave = (Math.sin(u * S * Math.PI) * Math.sin(v * S * Math.PI)) * 0.5 + 0.5;
    const slub = n(u * 8, v * 64, 8);
    field[py * S + px] = weave * 0.6 + slub * 0.4;
    const t = 0.9 + weave * 0.06 + (slub - 0.5) * 0.08;
    out[0] = 255 * t;
    out[1] = 253 * t;
    out[2] = 248 * t;
  });
  return { c, field };
}

// A late-afternoon sky to see in polished things: pale blue overhead, warm
// gold at the horizon where the sun is going down, brown ground below.
function skyCanvas() {
  const c = makeCanvas(256, 128);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#7f9cc6');
  grd.addColorStop(0.36, '#c8cfd0');
  grd.addColorStop(0.48, '#f4d39c');
  grd.addColorStop(0.5, '#d8a868');
  grd.addColorStop(0.56, '#6e5a40');
  grd.addColorStop(1, '#2a2218');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  const sun = g.createRadialGradient(64, 58, 0, 64, 58, 46);
  sun.addColorStop(0, 'rgba(255,248,220,1)');
  sun.addColorStop(0.2, 'rgba(255,214,140,0.8)');
  sun.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, 256, 128);
  return c;
}

// A soft round puff, a little lumpy (mist, spray, a halo).
function puffCanvas(S = 64, lumpy = true) {
  const n = makeNoise(23);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const lump = lumpy ? 0.75 + fbm(n, u * 4, v * 4, { octaves: 3 }) * 0.5 : 1;
    const a = clamp01(1 - d) ** 1.6 * lump;
    out[0] = out[1] = out[2] = 255;
    out[3] = 255 * clamp01(a);
  });
  return c;
}

// A shaft of sunlight across a room: soft at its sides, bright where it
// comes in at the window and fading as it goes, with a few motes.
function shaftCanvas() {
  const c = makeCanvas(64, 128);
  const n = makeNoise(29);
  paintPixels(c, (u, v, out) => {
    const side = Math.pow(Math.sin(Math.PI * u), 1.2);
    const along = Math.pow(1 - v, 1.3) * smooth(0, 0.04, v);
    const mote = smooth(0.82, 0.9, n(u * 22, v * 40)) * 0.5;
    const a = side * along * (0.85 + mote);
    out[0] = out[1] = out[2] = 255;
    out[3] = 255 * clamp01(a);
  });
  return c;
}

// ── painted pictures ──

// A closed path through points, filled and (if `line`) outlined.
function poly(g, pts, fill, line = null, lw = 2) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (line) {
    g.strokeStyle = line;
    g.lineWidth = lw;
    g.stroke();
  }
}

// A limb from a to b, wa wide at a and wb at b.
function limb(g, [ax, ay], [bx, by], wa, wb, fill, line = null, lw = 2) {
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / l;
  const ny = (bx - ax) / l;
  poly(g, [[ax + nx * wa / 2, ay + ny * wa / 2], [bx + nx * wb / 2, by + ny * wb / 2], [bx - nx * wb / 2, by - ny * wb / 2], [ax - nx * wa / 2, ay - ny * wa / 2]], fill, line, lw);
  g.beginPath();
  g.arc(bx, by, wb / 2, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}

// Age on a painted canvas: hairline crazing, the paint flaked away to the
// plaster in patches, uneven fading.
function ageCanvas(c, { seed = 77, crack = 0.3, flake = 0.66, plaster = [214, 196, 160], fade = 0.12, cell = 48 } = {}) {
  const { width: W, height: H } = c;
  const g = c.getContext('2d');
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const n = makeNoise(seed);
  const cells = makeCells(seed + 1);
  const ar = H / W;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const k = cells(u * cell, v * cell * ar);
      const cr = (1 - smooth(0, 0.045, k.f2 - k.f1)) * crack;
      const fl = smooth(flake, flake + 0.03, fbm(n, u * 5, v * 5 * ar, { octaves: 5 }));
      const fd = 0.86 + fbm(n, u * 3 + 9, v * 3 * ar, { octaves: 3 }) * 0.24;
      const i = (y * W + x) * 4;
      const t = fade + fl * (1 - fade);
      for (let ch = 0; ch < 3; ch++) d[i + ch] = mix(d[i + ch] * fd * (1 - cr), plaster[ch] * (0.92 + fd * 0.08) * (1 - cr * 0.5), t);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// The Council's floor, 16 m across: pale flags laid in rings, and inlaid in
// them in green-grey stone edged with gold, a ten-pointed star about the
// plinth, an amber leaf between each two of its points, a ring of small
// leaves inside the chairs, and gold rings marking the bands.
function courtCanvas(S = 1024, R = 8) {
  const c = makeCanvas(S);
  const n = makeNoise(51);
  const bands = [0.95, 1.7, 2.6, 3.5, 4.5, 4.95, 6.15, 7.05, 8.4];
  paintPixels(c, (u, v, out) => {
    const x = (u - 0.5) * 2 * R;
    const z = (v - 0.5) * 2 * R;
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    let b = 0;
    while (b < bands.length - 1 && r > bands[b]) b++;
    const r0 = b ? bands[b - 1] : 0;
    const r1 = bands[b];
    const count = Math.max(1, Math.round((TAU * (r0 + r1)) / 2 / 1.1));
    const f = (((th / TAU + 1) * count + b * 0.37) % count + count) % count;
    const k = Math.floor(f);
    const fa = f - k;
    const dj = Math.min(r - r0, r1 - r, (Math.min(fa, 1 - fa) * TAU * r) / count);
    const joint = 1 - smooth(0.006, 0.035, dj);
    const tone = n(k * 3.7 + b * 11.1, b * 1.9) - 0.5;
    const cloud = fbm(n, u * 24, v * 24, { octaves: 4 }) - 0.5;
    const t = 0.9 + tone * 0.12 + cloud * 0.1 - joint * 0.3;
    const warm = b === 6 ? 0.96 : 1;
    out[0] = 240 * t;
    out[1] = 226 * t * warm;
    out[2] = 196 * t * warm * warm;
  });
  const g = c.getContext('2d');
  const gold = '#d0a650';
  g.save();
  g.translate(S / 2, S / 2);
  g.scale(S / (2 * R), S / (2 * R));
  g.lineJoin = 'round';
  // the star, its points faceted light and dark
  const P = 10;
  const ro = 4.3;
  const ri = 2.0;
  const at = (i, rr) => [Math.cos((i / (2 * P)) * TAU - TAU / 4) * rr, Math.sin((i / (2 * P)) * TAU - TAU / 4) * rr];
  for (let i = 0; i < 2 * P; i += 2) {
    const tip = at(i, ro);
    poly(g, [[0, 0], at(i - 1, ri), tip], '#4c6656');
    poly(g, [[0, 0], tip, at(i + 1, ri)], '#6a8672');
  }
  g.lineWidth = 0.05;
  g.strokeStyle = gold;
  g.beginPath();
  for (let i = 0; i <= 2 * P; i++) {
    const [x, y] = at(i, i % 2 ? ri : ro);
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.stroke();
  g.lineWidth = 0.025;
  for (let i = 0; i < 2 * P; i += 2) {
    g.beginPath();
    g.moveTo(...at(i, 1.25));
    g.lineTo(...at(i, ro));
    g.stroke();
  }
  // a disc of green marble in the middle, ringed in gold
  g.fillStyle = '#3c5a4c';
  g.beginPath();
  g.arc(0, 0, 1.25, 0, TAU);
  g.fill();
  g.lineWidth = 0.07;
  g.strokeStyle = gold;
  g.stroke();
  g.lineWidth = 0.03;
  g.beginPath();
  g.arc(0, 0, 1.05, 0, TAU);
  g.stroke();
  // amber leaves between the points
  for (let i = 1; i < 2 * P; i += 2) {
    const a = (i / (2 * P)) * TAU - TAU / 4;
    g.save();
    g.rotate(a);
    g.beginPath();
    g.moveTo(2.25, 0);
    g.bezierCurveTo(2.9, -0.42, 3.7, -0.3, 4.25, 0);
    g.bezierCurveTo(3.7, 0.3, 2.9, 0.42, 2.25, 0);
    g.fillStyle = '#b8783e';
    g.fill();
    g.lineWidth = 0.04;
    g.strokeStyle = gold;
    g.stroke();
    g.lineWidth = 0.025;
    g.beginPath();
    g.moveTo(2.3, 0);
    g.lineTo(4.15, 0);
    for (let k = 0; k < 4; k++) {
      const x = 2.7 + k * 0.35;
      g.moveTo(x, 0);
      g.lineTo(x + 0.22, -0.2);
      g.moveTo(x, 0);
      g.lineTo(x + 0.22, 0.2);
    }
    g.stroke();
    g.restore();
  }
  // gold rings, and a ring of small leaves between two of them
  g.strokeStyle = gold;
  for (const [rr, w] of [[4.5, 0.06], [4.95, 0.06], [7.05, 0.05], [7.25, 0.025]]) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    g.stroke();
  }
  const L = 64;
  for (let i = 0; i < L; i++) {
    g.save();
    g.rotate((i / L) * TAU);
    g.translate(4.72, 0);
    g.rotate(Math.PI / 2 + 0.5);
    g.beginPath();
    g.moveTo(-0.2, 0);
    g.quadraticCurveTo(0, -0.12, 0.2, 0);
    g.quadraticCurveTo(0, 0.12, -0.2, 0);
    g.fillStyle = i % 2 ? '#6a8456' : '#b06a34';
    g.fill();
    g.restore();
  }
  g.restore();
  return ageCanvas(c, { seed: 52, crack: 0, flake: 2, fade: 0, cell: 8 });
}

// The painting in the hall of Narsil, in the manner of an old fresco: the
// last of the Last Alliance on the slopes of Orodruin. Sauron in his black
// armour towers against a sky of fire, reaching down; Isildur kneels by
// his fallen father and lifts the broken sword to cut the Ring from his
// hand. Flat colour in dark reds, ochres and gold, dark outlines, a painted
// border, then crazed and flaking with age.
function muralCanvas() {
  const W = 1024;
  const H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const r = rng(1234);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // the sky, fire behind the mountain darkening up into smoke
  let grd = g.createRadialGradient(330, 190, 10, 330, 190, 780);
  for (const [t, col] of [[0, '#f8d070'], [0.07, '#f0a040'], [0.2, '#c8582a'], [0.42, '#7a2416'], [0.72, '#3c120c'], [1, '#1e0806']]) grd.addColorStop(t, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(${18 + r() * 24},${6 + r() * 8},6,${0.1 + r() * 0.2})`;
    g.beginPath();
    g.ellipse(r() * W, r() * 280, 60 + r() * 170, 12 + r() * 26, (r() - 0.5) * 0.4, 0, TAU);
    g.fill();
  }
  // Orodruin
  poly(g, [[0, 410], [140, 330], [250, 210], [290, 166], [312, 160], [346, 161], [370, 170], [430, 236], [540, 330], [660, 405]], '#2e1912');
  poly(g, [[250, 210], [290, 166], [312, 160], [300, 230], [262, 300], [190, 360]], 'rgba(90,40,24,0.55)');
  grd = g.createRadialGradient(328, 158, 0, 328, 158, 110);
  grd.addColorStop(0, 'rgba(255,236,150,0.95)');
  grd.addColorStop(0.22, 'rgba(255,150,46,0.6)');
  grd.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = grd;
  g.fillRect(200, 40, 260, 240);
  // the fire running down its sides
  g.shadowColor = '#ff6a10';
  g.shadowBlur = 10;
  for (let i = 0; i < 7; i++) {
    const x0 = 300 + r() * 56;
    let x = x0;
    let y = 166;
    g.strokeStyle = i % 2 ? '#ffb848' : '#ff8a2a';
    g.lineWidth = 2 + r() * 2.5;
    g.beginPath();
    g.moveTo(x, y);
    const dir = x0 < 328 ? -1 : 1;
    for (let k = 0; k < 9; k++) {
      x += dir * (8 + r() * 16);
      y += 16 + r() * 14;
      g.lineTo(x + (r() - 0.5) * 10, y);
    }
    g.stroke();
  }
  g.shadowBlur = 0;
  // the plume of smoke from the throat, rolling up and away
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(${50 + i * 2},${24 + i},${18 + i},${0.55 - i * 0.02})`;
    g.beginPath();
    g.arc(330 + i * 16 + Math.sin(i * 0.9) * 10, 150 - i * 8.5, 14 + i * 3.2, 0, TAU);
    g.fill();
  }
  // the host of the Alliance on the plain: spears, helms and banners
  for (let x = 14; x < 660; x += 4 + r() * 3) {
    const y = 404 - r() * 10 - (x > 400 ? (x - 400) * 0.02 : 0);
    g.strokeStyle = '#1a0c08';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 3, y - 30 - r() * 26);
    g.stroke();
    g.fillStyle = r() < 0.3 ? '#8a6a34' : '#1c0e0a';
    g.beginPath();
    g.arc(x, y + 2, 3, 0, TAU);
    g.fill();
    if (r() < 0.06) poly(g, [[x + 3, y - 54], [x + 18, y - 48], [x + 3, y - 40]], '#b08a3a');
  }
  // the ground: dark rock with fire in its cracks
  grd = g.createLinearGradient(0, 400, 0, H);
  grd.addColorStop(0, '#3a2016');
  grd.addColorStop(1, '#140a06');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, 418);
  for (let x = 0; x <= W; x += 32) g.lineTo(x, 412 + Math.sin(x * 0.03) * 6 + r() * 8 - (x > 560 ? 10 : 0));
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  g.shadowColor = '#ff6a10';
  g.shadowBlur = 6;
  g.strokeStyle = '#e8762a';
  for (let i = 0; i < 9; i++) {
    let x = r() * W;
    let y = 430 + r() * 70;
    g.lineWidth = 1.2 + r();
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += 10 + r() * 20;
      y += (r() - 0.5) * 12;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.shadowBlur = 0;
  // Elendil, fallen, his sword broken under him
  poly(g, [[470, 474], [560, 464], [600, 470], [598, 484], [520, 488], [472, 488]], '#4e4a46', '#0c0806', 2);
  poly(g, [[540, 470], [600, 462], [612, 470], [596, 478]], '#6e1a12', '#0c0806', 1.5);
  g.fillStyle = '#7a766e';
  g.beginPath();
  g.arc(462, 478, 11, 0, TAU);
  g.fill();
  g.strokeStyle = '#0c0806';
  g.lineWidth = 2;
  g.stroke();
  poly(g, [[452, 470], [440, 458], [458, 466]], '#c8c4b4');
  poly(g, [[470, 470], [482, 456], [474, 470]], '#c8c4b4');
  // Sauron
  const dark = '#18100d';
  const ink = '#070403';
  const rim = '#a84a22';
  const gilt = '#d6a44c';
  limb(g, [655, 282], [628, 372], 42, 32, dark, ink, 3);
  limb(g, [628, 372], [612, 456], 32, 25, dark, ink, 3);
  limb(g, [725, 282], [752, 372], 42, 32, dark, ink, 3);
  limb(g, [752, 372], [770, 456], 32, 25, dark, ink, 3);
  poly(g, [[592, 450], [634, 450], [642, 476], [574, 478]], dark, ink, 3);
  poly(g, [[752, 450], [792, 450], [812, 478], [746, 476]], dark, ink, 3);
  for (const [x, y, s] of [[618, 368, -1], [740, 368, 1]]) poly(g, [[x, y - 12], [x + s * 4 - 22, y + 2], [x, y + 12]], '#2a1a14', ink, 2);
  poly(g, [[640, 238], [740, 238], [772, 334], [746, 346], [722, 330], [700, 350], [680, 330], [656, 348], [634, 332], [608, 338]], '#211613', ink, 3);
  g.strokeStyle = '#3e2a20';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(648 + i * 17, 246);
    g.lineTo(630 + i * 25, 332);
    g.stroke();
  }
  poly(g, [[646, 252], [734, 252], [764, 146], [616, 146]], dark, ink, 3);
  poly(g, [[640, 246], [740, 246], [742, 258], [638, 258]], '#2c1d16', ink, 2);
  g.strokeStyle = '#3a2820';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(690, 150);
  g.lineTo(690, 246);
  g.moveTo(640, 196);
  g.quadraticCurveTo(690, 214, 740, 196);
  g.stroke();
  // his pauldrons, spiked
  const pauldron = (m) => {
    const X = (x) => (m ? 1380 - x : x);
    poly(g, [[592, 176], [584, 140], [604, 110], [642, 102], [664, 122], [660, 160], [630, 180]].map(([x, y]) => [X(x), y]), '#1e1411', ink, 3);
    for (const [bx, by, tx, ty, cx, cy] of [[596, 120, 572, 82, 614, 110], [618, 108, 610, 66, 636, 104], [642, 104, 650, 70, 658, 116]]) poly(g, [[X(bx), by], [X(tx), ty], [X(cx), cy]], '#24160f', ink, 2);
    g.strokeStyle = rim;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(X(588), 150);
    g.quadraticCurveTo(X(596), 116, X(640), 106);
    g.stroke();
  };
  pauldron(false);
  pauldron(true);
  // the helm and its crown of spikes, the slit of fire in it
  for (let k = -3; k <= 3; k++) poly(g, [[690 + k * 8 - 4, 70 + Math.abs(k) * 2], [690 + k * 12, 22 + Math.abs(k) * 8], [690 + k * 8 + 4, 70 + Math.abs(k) * 2]], '#1c120e', ink, 2);
  poly(g, [[668, 132], [662, 94], [670, 66], [690, 58], [710, 66], [718, 94], [712, 132], [700, 140], [680, 140]], dark, ink, 3);
  g.strokeStyle = '#ff7a2a';
  g.shadowColor = '#ff5010';
  g.shadowBlur = 6;
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(674, 98);
  g.lineTo(706, 98);
  g.moveTo(690, 98);
  g.lineTo(690, 124);
  g.stroke();
  g.shadowBlur = 0;
  // the arm raised with the mace
  limb(g, [758, 152], [812, 120], 36, 30, dark, ink, 3);
  limb(g, [812, 120], [842, 78], 30, 26, dark, ink, 3);
  g.strokeStyle = '#120a08';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(836, 88);
  g.lineTo(872, 44);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    poly(g, [[874 + Math.cos(a - 0.3) * 14, 40 + Math.sin(a - 0.3) * 14], [874 + Math.cos(a) * 30, 40 + Math.sin(a) * 30], [874 + Math.cos(a + 0.3) * 14, 40 + Math.sin(a + 0.3) * 14]], '#1c120e', ink, 2);
  }
  g.fillStyle = '#1e1410';
  g.beginPath();
  g.arc(874, 40, 17, 0, TAU);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = 3;
  g.stroke();
  // the arm reaching down, its open hand, the Ring
  limb(g, [622, 156], [566, 208], 36, 30, dark, ink, 3);
  limb(g, [566, 208], [514, 248], 30, 24, dark, ink, 3);
  poly(g, [[524, 236], [530, 254], [506, 264], [498, 248]], '#2a1a14', ink, 2);
  for (const [a, b, w] of [[[500, 252], [476, 262], 7], [[502, 258], [480, 274], 7], [[506, 262], [490, 284], 6.5], [[512, 262], [506, 286], 6], [[512, 250], [518, 232], 6.5]]) limb(g, a, b, w, w * 0.75, '#22160f', ink, 1.5);
  g.strokeStyle = rim;
  g.lineWidth = 2;
  for (const [a, b] of [[[620, 150], [566, 202]], [[566, 202], [514, 242]], [[652, 286], [626, 370]], [[626, 370], [610, 452]], [[618, 150], [646, 250]]]) {
    g.beginPath();
    g.moveTo(a[0] - 14, a[1] - 4);
    g.lineTo(b[0] - 12, b[1] - 3);
    g.stroke();
  }
  g.strokeStyle = gilt;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(616, 146);
  g.lineTo(764, 146);
  g.moveTo(640, 238);
  g.lineTo(740, 238);
  g.stroke();
  // Isildur, kneeling, his red cloak behind him
  const bronze = '#a07c40';
  poly(g, [[404, 360], [390, 362], [356, 418], [322, 478], [392, 480], [404, 420]], '#7a2016', ink, 2);
  limb(g, [394, 424], [378, 466], 20, 16, '#5a4a36', ink, 2);
  limb(g, [378, 466], [340, 472], 15, 12, '#4a3a2a', ink, 2);
  limb(g, [400, 424], [436, 428], 20, 16, '#5a4a36', ink, 2);
  limb(g, [436, 428], [438, 468], 15, 12, '#4a3a2a', ink, 2);
  poly(g, [[430, 464], [452, 468], [452, 476], [428, 476]], '#3a2a1c', ink, 2);
  poly(g, [[384, 428], [414, 428], [424, 370], [396, 362]], bronze, ink, 2);
  g.strokeStyle = '#d8b060';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(400, 372);
  g.lineTo(404, 426);
  g.stroke();
  g.fillStyle = bronze;
  g.beginPath();
  g.arc(412, 350, 12, 0, TAU);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.stroke();
  poly(g, [[404, 340], [400, 326], [420, 338]], '#d8b060', ink, 1);
  limb(g, [394, 380], [380, 412], 11, 9, bronze, ink, 2);
  limb(g, [418, 372], [438, 340], 12, 10, bronze, ink, 2);
  limb(g, [438, 340], [452, 314], 10, 9, bronze, ink, 2);
  // the broken sword, lifted
  g.strokeStyle = '#3a2414';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(446, 322);
  g.lineTo(458, 306);
  g.stroke();
  g.strokeStyle = '#d8b060';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(446, 298);
  g.lineTo(466, 312);
  g.stroke();
  poly(g, [[454, 302], [462, 308], [480, 282], [476, 284], [474, 278], [470, 282]], '#dcdcd4', ink, 1.5);
  for (const [x, y, a] of [[360, 482, 0.2], [388, 488, -0.3], [414, 484, 0.1]]) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    poly(g, [[-12, -2], [12, -3], [10, 3], [-12, 2]], '#c8c8c0', ink, 1);
    g.restore();
  }
  // the Ring's glare, and its rays
  grd = g.createRadialGradient(484, 268, 0, 484, 268, 70);
  grd.addColorStop(0, 'rgba(255,252,220,1)');
  grd.addColorStop(0.12, 'rgba(255,220,120,0.9)');
  grd.addColorStop(0.4, 'rgba(255,150,50,0.32)');
  grd.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grd;
  g.fillRect(400, 190, 170, 160);
  g.strokeStyle = 'rgba(255,224,140,0.55)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + 0.1;
    const l0 = 12;
    const l1 = 40 + (i % 3) * 22;
    g.beginPath();
    g.moveTo(484 + Math.cos(a) * l0, 268 + Math.sin(a) * l0);
    g.lineTo(484 + Math.cos(a) * l1, 268 + Math.sin(a) * l1);
    g.stroke();
  }
  g.strokeStyle = '#ffd860';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(484, 268, 4, 0, TAU);
  g.stroke();
  // the painted border: dark red, gold lines, a running scroll of leaves
  g.fillStyle = '#4a140e';
  for (const [x, y, w, h] of [[0, 0, W, 22], [0, H - 22, W, 22], [0, 0, 22, H], [W - 22, 0, 22, H]]) g.fillRect(x, y, w, h);
  g.strokeStyle = gilt;
  g.lineWidth = 2;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.strokeRect(20, 20, W - 40, H - 40);
  g.lineWidth = 1.6;
  const scroll = (x, y, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(-9, 0);
    g.bezierCurveTo(-4, -8, 4, -8, 5, -1);
    g.bezierCurveTo(5, 3, 0, 3, 0, 0);
    g.stroke();
    g.beginPath();
    g.moveTo(5, 0);
    g.quadraticCurveTo(10, 4, 13, 0);
    g.quadraticCurveTo(10, -1, 5, 0);
    g.stroke();
    g.restore();
  };
  for (let x = 30; x < W - 20; x += 26) {
    scroll(x, 11, 0);
    scroll(x, H - 11, Math.PI);
  }
  for (let y = 34; y < H - 20; y += 26) {
    scroll(11, y, -Math.PI / 2);
    scroll(W - 11, y, Math.PI / 2);
  }
  return ageCanvas(c, { seed: 78, crack: 0.28, flake: 0.7, fade: 0.1, cell: 46 });
}

// Bilbo's map, of the Lonely Mountain and the lands about it, in brown ink
// on old parchment: the Mountain with its spurs and the dragon over it,
// the river running from it, the forest, the Grey Mountains, a compass,
// lines of runes and of writing.
function mapCanvas() {
  const W = 512;
  const H = 384;
  const c = makeCanvas(W, H);
  const n = makeNoise(61);
  paintPixels(c, (u, v, out) => {
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const burn = 1 - smooth(0, 0.07, edge + (n(u * 20, v * 20) - 0.5) * 0.03);
    const stain = smooth(0.55, 0.8, fbm(n, u * 4 + 3, v * 3, { octaves: 4 }));
    const t = 0.94 - burn * 0.45 - stain * 0.12 + (n(u * 120, v * 90) - 0.5) * 0.05;
    out[0] = 236 * t;
    out[1] = 214 * t;
    out[2] = 164 * t;
  });
  const g = c.getContext('2d');
  const r = rng(62);
  const ink = '#5a3a1c';
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 2;
  g.strokeRect(16, 16, W - 32, H - 32);
  g.lineWidth = 1;
  g.strokeRect(22, 22, W - 44, H - 44);
  // the Mountain: its peak and six spurs, hatched
  const [mx, my] = [300, 170];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.4;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(mx, my);
    const ex = mx + Math.cos(a) * 70;
    const ey = my + Math.sin(a) * 52;
    g.quadraticCurveTo(mx + Math.cos(a + 0.3) * 40, my + Math.sin(a + 0.3) * 30, ex, ey);
    g.stroke();
    g.lineWidth = 0.8;
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const px = mix(mx, ex, t);
      const py = mix(my, ey, t);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a + 1.2) * 8, py + Math.sin(a + 1.2) * 8);
      g.stroke();
    }
  }
  // the dragon, in red, over the Mountain
  g.fillStyle = '#a8281c';
  g.beginPath();
  g.moveTo(262, 92);
  g.bezierCurveTo(290, 70, 320, 96, 350, 80);
  g.bezierCurveTo(342, 92, 318, 104, 290, 100);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(300, 88);
  g.lineTo(316, 52);
  g.lineTo(326, 70);
  g.lineTo(336, 50);
  g.lineTo(330, 86);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(350, 80);
  g.lineTo(366, 74);
  g.lineTo(358, 84);
  g.fill();
  // the river, south and away
  g.strokeStyle = ink;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(mx + 10, my + 30);
  for (let i = 1; i < 14; i++) g.lineTo(mx + 10 + Math.sin(i * 0.9) * 14 + i * 6, my + 30 + i * 12);
  g.stroke();
  // the forest: little trees
  for (let i = 0; i < 46; i++) {
    const x = 50 + r() * 150;
    const y = 200 + r() * 130;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y + 6);
    g.lineTo(x, y + 12);
    g.stroke();
    g.beginPath();
    g.arc(x, y + 2, 4, 0, TAU);
    g.stroke();
  }
  // the Grey Mountains along the top
  for (let x = 40; x < 470; x += 14 + r() * 6) {
    g.beginPath();
    g.moveTo(x, 58);
    g.lineTo(x + 7, 42 - r() * 6);
    g.lineTo(x + 14, 58);
    g.stroke();
  }
  // a compass
  g.save();
  g.translate(430, 300);
  for (let k = 0; k < 8; k++) {
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(3, -6);
    g.lineTo(0, k % 2 ? -16 : -28);
    g.lineTo(-3, -6);
    g.closePath();
    if (k % 2) g.stroke();
    else g.fill();
  }
  g.restore();
  // runes, and lines of writing
  const runes = (x, y, len, size = 7) => {
    g.lineWidth = 1.2;
    for (let i = 0; i < len; i++) {
      const px = x + i * size * 1.3;
      g.beginPath();
      g.moveTo(px, y);
      g.lineTo(px, y - size);
      const k = Math.floor(r() * 4);
      if (k === 0) g.lineTo(px + size * 0.6, y - size * 0.6);
      if (k === 1) {
        g.moveTo(px, y - size * 0.5);
        g.lineTo(px + size * 0.6, y - size);
      }
      if (k === 2) {
        g.moveTo(px, y - size * 0.3);
        g.lineTo(px + size * 0.6, y - size * 0.7);
        g.lineTo(px + size * 0.6, y);
      }
      if (k === 3) {
        g.moveTo(px + size * 0.6, y);
        g.lineTo(px + size * 0.6, y - size);
        g.lineTo(px, y - size * 0.5);
      }
      g.stroke();
    }
  };
  runes(40, 352, 22);
  runes(300, 352, 12);
  const writing = (x, y, w) => {
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, y);
    for (let px = x; px < x + w; px += 3) g.lineTo(px, y + Math.sin(px * 1.7) * 1.5 + (r() - 0.5) * 2);
    g.stroke();
  };
  for (let i = 0; i < 4; i++) writing(380, 96 + i * 12, 90 - i * 10);
  for (let i = 0; i < 3; i++) writing(48, 120 + i * 12, 100);
  g.strokeStyle = 'rgba(120,150,190,0.45)';
  runes(230, 260, 8, 9);
  return c;
}

// An open book: two cream pages in a neat hand, a heading on the left
// one, a little drawing of a mountain on the right, the gutter shadowed.
function bookCanvas() {
  const W = 256;
  const H = 160;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, '#d8c8a0');
  grd.addColorStop(0.08, '#f2e8cc');
  grd.addColorStop(0.46, '#ece0c0');
  grd.addColorStop(0.5, '#b8a47c');
  grd.addColorStop(0.54, '#ece0c0');
  grd.addColorStop(0.92, '#f2e8cc');
  grd.addColorStop(1, '#d8c8a0');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const r = rng(71);
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1;
  for (const x0 of [14, 142]) {
    for (let y = 22; y < H - 14; y += 8) {
      if (x0 > 100 && y > 40 && y < 92) continue;
      let x = x0;
      const end = x0 + 98 - (y === 22 && x0 < 100 ? 40 : r() * 10);
      while (x < end) {
        const w = 6 + r() * 16;
        g.beginPath();
        g.moveTo(x, y);
        for (let px = x; px < Math.min(end, x + w); px += 2) g.lineTo(px, y + Math.sin(px * 2.1) * 1.2);
        g.stroke();
        x += w + 3;
      }
    }
  }
  g.lineWidth = 2;
  g.strokeStyle = '#7a2a1a';
  g.beginPath();
  g.moveTo(30, 12);
  g.bezierCurveTo(50, 6, 70, 18, 90, 10);
  g.stroke();
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(160, 88);
  g.lineTo(185, 50);
  g.lineTo(198, 68);
  g.lineTo(210, 56);
  g.lineTo(232, 88);
  g.stroke();
  return c;
}

// A rug: a deep red field, a border of leaves in old gold, a green and
// gold leaf-star in the middle, fringes at the ends.
function rugCanvas() {
  const W = 256;
  const H = 160;
  const c = makeCanvas(W, H);
  const n = makeNoise(81);
  paintPixels(c, (u, v, out) => {
    const k = 0.85 + n(u * 60, v * 40) * 0.2;
    out[0] = 128 * k;
    out[1] = 36 * k;
    out[2] = 26 * k;
  });
  const g = c.getContext('2d');
  g.fillStyle = '#c8a04a';
  g.fillRect(12, 10, W - 24, 6);
  g.fillRect(12, H - 16, W - 24, 6);
  g.fillRect(12, 10, 6, H - 20);
  g.fillRect(W - 18, 10, 6, H - 20);
  g.fillStyle = '#d4b060';
  for (let x = 26; x < W - 26; x += 14) {
    for (const y of [26, H - 26]) {
      g.beginPath();
      g.ellipse(x, y, 5, 2.5, 0.6, 0, TAU);
      g.fill();
    }
  }
  g.save();
  g.translate(W / 2, H / 2);
  for (let k = 0; k < 8; k++) {
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(10, -20, 0, -42);
    g.quadraticCurveTo(-10, -20, 0, 0);
    g.fillStyle = k % 2 ? '#4a6a44' : '#d4b060';
    g.fill();
  }
  g.restore();
  g.strokeStyle = '#e8dcc0';
  g.lineWidth = 1.5;
  for (let y = 12; y < H - 12; y += 4) {
    for (const [x0, x1] of [[0, 8], [W - 8, W]]) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
    }
  }
  return c;
}

// The Ring's inscription, in a flowing elvish hand (made up, as near as a
// few strokes can be): stems, bows and marks above, in fire on black, to
// light its emissive glow. Wraps once round the band.
function inscriptionCanvas() {
  const W = 512;
  const H = 64;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ffc060';
  g.fillStyle = '#ffc060';
  g.lineWidth = 2.6;
  g.lineCap = 'round';
  g.shadowColor = '#ff6a10';
  g.shadowBlur = 5;
  const r = rng(66);
  const top = 24;
  const base = 40;
  let x = 6;
  while (x < W - 16) {
    const k = r();
    g.beginPath();
    if (k < 0.3) {
      g.moveTo(x, top - 9);
      g.lineTo(x, base);
    } else if (k < 0.5) {
      g.moveTo(x, top);
      g.lineTo(x, base + 9);
    } else {
      g.moveTo(x, top + 2);
      g.lineTo(x, base);
    }
    g.stroke();
    const bows = 1 + (r() < 0.4 ? 1 : 0);
    for (let b = 0; b < bows; b++) {
      g.beginPath();
      g.arc(x + 4 + b * 7, k < 0.5 ? 33 : 31, 5, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    }
    if (r() < 0.45) {
      g.beginPath();
      if (r() < 0.5) g.arc(x + 4, top - 7, 1.6, 0, TAU);
      else {
        g.moveTo(x + 1, top - 5);
        g.lineTo(x + 7, top - 10);
      }
      g.stroke();
    }
    x += 9 + bows * 7 + (r() < 0.18 ? 8 : 0);
  }
  return c;
}

// A page of notes, scribbled over.
function notesCanvas() {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.fillStyle = '#efe4c8';
  g.fillRect(0, 0, S, S);
  const r = rng(91);
  g.strokeStyle = '#4a3420';
  g.lineWidth = 1;
  for (let y = 14; y < S - 8; y += 7) {
    let x = 10;
    const end = S - 10 - r() * 20;
    while (x < end) {
      const w = 5 + r() * 14;
      g.beginPath();
      g.moveTo(x, y);
      for (let px = x; px < Math.min(end, x + w); px += 2) g.lineTo(px, y + Math.sin(px * 2.3) * 1.1);
      g.stroke();
      x += w + 3;
    }
  }
  return c;
}

// ── elven building parts ──

// A carved leaf `len` long and `wid` wide, pointed at both ends, rising up
// y from its stalk and curling out towards +z (`curl` radians by its tip),
// folded a little along its midrib; a thin solid, so it needs no
// double-sided material.
function leafBlade(len, wid, { curl = 1, seg = 4, fold = 0.25, thick = 0.012 } = {}) {
  const pos = [];
  const idx = [];
  let py = 0;
  let pz = 0;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    if (i) {
      const a0 = curl * ((i - 0.5) / seg) ** 2;
      py += (Math.cos(a0) * len) / seg;
      pz += (Math.sin(a0) * len) / seg;
    }
    const ang = curl * t * t;
    const nx = -Math.sin(ang);
    const nz = Math.cos(ang);
    const half = wid * 0.5 * Math.pow(Math.sin(Math.PI * t), 0.8);
    const f = half * fold;
    pos.push(-half, py, pz, 0, py + nx * f, pz + nz * f, half, py, pz);
    pos.push(-half, py - nx * thick, pz - nz * thick, 0, py + nx * (f - thick), pz + nz * (f - thick), half, py - nx * thick, pz - nz * thick);
    if (i) {
      const a = (i - 1) * 6;
      const b = i * 6;
      idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      idx.push(a + 3, b + 3, a + 4, a + 4, b + 3, b + 4, a + 4, b + 4, a + 5, a + 5, b + 4, b + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A slender column `h` tall standing at (x, y, z), its shaft `r` round: a
// moulded base, a shaft that swells a little, a gilded necking, and a
// capital that opens like a lily, carved leaves curling out round it under
// a thin abacus.
function column(bk, K, { x = 0, y = 0, z = 0, h, r = 0.15, leaves = 6, base = true, mat = null, seg = 10 }) {
  const { mats } = K;
  const m = mat || mats.carve;
  const cap = Math.min(0.7, Math.max(0.36, h * 0.15));
  const hs = h - cap;
  const prof = base
    ? [[r * 1.95, 0], [r * 1.95, 0.12], [r * 1.65, 0.16], [r * 1.62, 0.22], [r * 1.3, 0.3], [r * 1.12, 0.42], [r * 1.02, 0.56], [r * 1.04, hs * 0.4], [r * 0.9, hs]]
    : [[r * 1.04, 0], [r * 1.04, hs * 0.4], [r * 0.9, hs]];
  bk.add(m, lathe(prof, seg), { p: [x, y, z], uv: 1 });
  bk.add(m, lathe([[r * 0.9, hs], [r * 0.98, hs + cap * 0.3], [r * 1.25, hs + cap * 0.62], [r * 1.7, hs + cap * 0.86], [r * 1.95, hs + cap * 0.9]], seg), { p: [x, y, z], uv: 1 });
  bk.add(m, roundBox(r * 4.2, cap * 0.1, r * 4.2, 0.012), { p: [x, y + h - cap * 0.05, z], uv: 1 });
  bk.add(mats.gilt, new THREE.TorusGeometry(r * 0.93, r * 0.11, 4, seg), { p: [x, y + hs, z], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * TAU + 0.3;
    bk.add(m, leafBlade(cap * 0.95, r * 1.45, { curl: 1.5, thick: r * 0.08 }), { p: [x + Math.cos(a) * r * 0.82, y + hs + 0.01, z + Math.sin(a) * r * 0.82], r: [0, Math.PI / 2 - a, 0] });
  }
  return y + h;
}

// An upswept roof, like an upturned leaf: rings from the ridge (s = 0) out
// to the eaves (s = 1), each an oblong with rounded ends `ridge` + s·dx by
// s·dz (or, with `sides`, a polygon s·dx round), at a height that falls
// steeply from the ridge and flattens out towards the eaves, where they
// lift (`lift` all round, `tips` more at the ends or the corners) like the
// curl of a leaf. Its texture runs in courses round the rings and down the
// slope. Returns the roof (its top and the eaves' edge, `t` thick), its
// underside, the eaves' line, and where a point (s, turn) on it is.
function leafRoof({ ridge = 0, dx, dz, rise, t = 0.16, prof = (s) => Math.pow(1 - s, 1.7), lift = 0.35, tips = 0.8, n = 4, sides = 0, rot = 0, rings = 12, around = 56, uvK = 0.55 }) {
  const at = (s, f) => {
    const phi = f * TAU;
    const c = Math.cos(phi);
    const sn = Math.sin(phi);
    let x;
    let z;
    let corner;
    if (sides) {
      const k = TAU / sides;
      const rel = ((((phi - rot) % k) + k) % k) - k / 2;
      const rp = Math.cos(k / 2) / Math.cos(rel);
      x = c * dx * s * rp;
      z = sn * dz * s * rp;
      corner = (rp - Math.cos(k / 2)) / (1 - Math.cos(k / 2));
    } else {
      x = Math.sign(c) * (ridge + s * dx * Math.abs(c) ** (2 / n));
      z = Math.sign(sn) * s * dz * Math.abs(sn) ** (2 / n);
      corner = Math.abs(c) ** 4;
    }
    return [x, rise * prof(s) + lift * s ** 3 + tips * s ** 4 * corner, z];
  };
  const M = around;
  const S = (i) => Math.pow(i / rings, 0.9);
  const eave = [];
  let perim = 0;
  for (let j = 0; j <= M; j++) {
    eave.push(at(1, j / M));
    if (j) perim += Math.hypot(eave[j][0] - eave[j - 1][0], eave[j][2] - eave[j - 1][2]);
  }
  let slant = 0;
  for (let i = 1; i <= rings; i++) {
    const p = at(S(i), 0.25);
    const q = at(S(i - 1), 0.25);
    slant += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  const row = M + 1;
  const sheet = (under) => {
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= rings; i++) {
      for (let j = 0; j <= M; j++) {
        const [x, y, z] = at(S(i), j / M);
        pos.push(x, y - under * t, z);
        uv.push((j / M) * perim * uvK, S(i) * slant * uvK);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * row + j;
        const b = a + row;
        if (under) idx.push(a, b, a + 1, a + 1, b, b + 1);
        else idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    // the top sheet takes the edge at the eaves
    if (!under) {
      const e0 = pos.length / 3;
      for (let j = 0; j <= M; j++) {
        const [x, y, z] = eave[j];
        pos.push(x, y, z, x, y - t, z);
        uv.push((j / M) * perim * uvK, 0, (j / M) * perim * uvK, t * uvK);
        if (j) {
          const a = e0 + (j - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const geo = sheet(0);
  const under = sheet(1);
  // the height of the top at (x, z), from its eaves' middle
  const yAt = (x, z) => {
    let q;
    let corner;
    if (sides) {
      const k = TAU / sides;
      const rel = ((((Math.atan2(z, x) - rot) % k) + k) % k) - k / 2;
      const rp = Math.cos(k / 2) / Math.cos(rel);
      q = Math.hypot(x / dx, z / dz) / rp;
      corner = (rp - Math.cos(k / 2)) / (1 - Math.cos(k / 2));
    } else {
      const ax = Math.max(0, Math.abs(x) - ridge) / dx;
      const az = Math.abs(z) / dz;
      q = Math.pow(ax ** n + az ** n, 1 / n);
      corner = q > 1e-6 ? Math.pow(ax / q, 2 * n) : 0;
    }
    q = Math.min(1, q);
    return rise * prof(q) + lift * q ** 3 + tips * q ** 4 * corner;
  };
  return { geo, under, eave: eave.slice(0, M).map(([x, y, z]) => V3(x, y, z)), at, yAt, t };
}

// A leaf roof put on a building (`p` the middle of its eaves, turned `ry`),
// with its gilding: a rounded gilt rim along the eaves, gilt ribs down the
// hips, a gilt ridge, and a finial on each end of it (or on the point).
function roofOn(bk, K, o, { p = [0, 0, 0], ry = 0, ribs = null, finial = 1.2, rim = 0.045 } = {}) {
  const { mats } = K;
  const roof = leafRoof(o);
  bk.at(p, ry, () => {
    bk.add(mats.roof, roof.geo);
    bk.add(mats.soffit, roof.under);
    bk.add(mats.gilt, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(roof.eave, true), roof.eave.length * 2, rim, 5, true));
    const hips = ribs ?? (o.sides ? Array.from({ length: o.sides }, (_, k) => (o.rot ?? 0) / TAU + k / o.sides) : [0.125, 0.375, 0.625, 0.875]);
    for (const f of hips) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const [x, y, z] = roof.at(Math.pow(i / 8, 0.9) * 0.995, f);
        pts.push(V3(x, y + 0.015, z));
      }
      bk.add(mats.gilt, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, rim * 0.75, 4, false));
    }
    const top = o.rise * (o.prof ? o.prof(0) : 1);
    const ridge = o.ridge ?? 0;
    if (ridge > 0) bk.add(mats.gilt, cylX(rim * 1.5, ridge * 2 + 0.1, 6), { p: [0, top + 0.01, 0] });
    if (!finial) return;
    for (const x of ridge > 0 ? [-ridge, ridge] : [0]) {
      const h = finial;
      bk.add(mats.gilt, lathe([[0.001, h], [0.03 * h, h * 0.72], [0.05 * h, h * 0.42], [0.06 * h, h * 0.3], [0.04 * h, h * 0.2], [0.07 * h, h * 0.08], [0.05 * h, 0]], 6), { p: [x, top - 0.05, 0] });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + 0.4;
        bk.add(mats.gilt, leafBlade(h * 0.42, h * 0.14, { curl: 1.1, thick: 0.01 }), { p: [x + Math.cos(a) * 0.04, top - 0.03, Math.sin(a) * 0.04], r: [0, Math.PI / 2 - a, 0] });
      }
    }
  });
  return roof;
}

// A strip standing on a line of points ([x, y, z]), from y0 to y1 above
// them, its texture repeating every `rep` metres along it (a whole number
// of times): a balustrade's panel of tracery, a curtain.
function ribbon(pts, y0, y1, rep = 1) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  const k = total / Math.max(1, Math.round(total / rep));
  const pos = [];
  const uv = [];
  const idx = [];
  let d = 0;
  pts.forEach((p, i) => {
    if (i) d += Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]);
    pos.push(p[0], p[1] + y0, p[2], p[0], p[1] + y1, p[2]);
    uv.push(d / k, 0, d / k, 1);
    if (i) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Points along a polyline, every `step` metres or closer.
function resample(pts, step = 0.4) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const m = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= m; k++) out.push([mix(a[0], b[0], k / m), mix(a[1], b[1], k / m), mix(a[2], b[2], k / m)]);
  }
  return out;
}

// A balustrade along a line of points ([x, y, z], y its foot): a rounded
// handrail and a foot rail, a panel of flowing tracery between, and a post
// with a gilt leaf finial at each end and every `step` metres.
function balustrade(bk, K, pts, { h = 0.95, step = 2.2, rep = 0.95, rail = 0.05, radial = 5, posts = true, ends = true } = {}) {
  const { mats } = K;
  const line = resample(pts, 0.5);
  const seg = Math.max(2, line.length);
  bk.add(mats.carve, tube(line.map(([x, y, z]) => [x, y + h, z]), rail, rail, { seg, radial }), { uv: 2 });
  bk.add(mats.carve, tube(line.map(([x, y, z]) => [x, y + 0.08, z]), rail * 0.9, rail * 0.9, { seg, radial: 4 }), { uv: 2 });
  bk.add(mats.tracery, ribbon(line, 0.1, h - rail * 0.6, rep));
  if (!posts) return;
  // where the posts go: the ends, and every `step` along (not too near an end)
  let total = 0;
  for (let i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][2] - line[i - 1][2]);
  const at = ends ? [0] : [];
  let d = 0;
  let next = step;
  for (let i = 1; i < line.length - 1; i++) {
    d += Math.hypot(line[i][0] - line[i - 1][0], line[i][2] - line[i - 1][2]);
    if (d >= next && total - d > step * 0.4) {
      at.push(i);
      next = d + step;
    }
  }
  if (ends) at.push(line.length - 1);
  for (const i of at) {
    const [x, y, z] = line[i];
    const q = line[Math.min(i + 1, line.length - 1)];
    const pp = line[Math.max(i - 1, 0)];
    const ry = -Math.atan2(q[2] - pp[2], q[0] - pp[0]);
    const tall = ends && (i === 0 || i === line.length - 1) ? 0.18 : 0;
    bk.add(mats.carve, roundBox(0.15, h + tall, 0.15, 0.02), { p: [x, y + (h + tall) / 2, z], r: [0, ry, 0], uv: 1 });
    bk.add(mats.carve, roundBox(0.22, 0.06, 0.22, 0.015), { p: [x, y + h + tall + 0.03, z], r: [0, ry, 0], uv: 1 });
    bk.add(mats.gilt, leafBlade(0.2, 0.08, { curl: 0.3, seg: 3, thick: 0.008 }), { p: [x, y + h + tall + 0.05, z], r: [0, ry, 0] });
  }
}

// An arched window in a wall whose face is at z = 0 (in the wall's own
// frame, x along it), its sill at y: a moulded frame with a gilt edge
// round it, a sill, and leaded glass set back `depth` into the wall. A door
// is the same with y = 0 and no sill.
function archWindow(bk, K, { x, y = 0, a, hs, rise, depth = 0.25, pane = null, frame = 0.11, gilt = true, kick = 0.35, sill = true, finial = false, n = 7 }) {
  const { mats } = K;
  if (frame) bk.add(mats.carve, ext(shapeOf(archFrame(a, hs, rise, frame, n, kick)), 0.07), { p: [x, y, -0.01], uv: 1 });
  if (gilt) bk.add(mats.gilt, ext(shapeOf(archFrame(a + frame, hs, rise + frame * 1.15, 0.03, n, kick)), 0.085), { p: [x, y, -0.01] });
  if (sill) bk.add(mats.carve, roundBox(2 * a + 0.4, 0.1, 0.24, 0.02), { p: [x, y - 0.05, 0.06], uv: 1 });
  const top = hs + archTop(a, rise, kick);
  if (pane !== false) {
    const pg = new THREE.ShapeGeometry(shapeOf(archOpening(a, hs, rise, n, kick)));
    shapeUV(pg, -a, 0, 2 * a, top);
    bk.add(pane || mats.pane, pg, { p: [x, y, -depth] });
  }
  if (finial) bk.add(mats.gilt, leafBlade(0.42, 0.16, { curl: 0.2, seg: 3, thick: 0.01 }), { p: [x, y + top + frame * 1.2 + 0.02, 0.03] });
  return y + top;
}

// Tracery in the head of an arch (the opening's top, from where it springs
// at y0), cut to its shape: stone, or gilt.
function archFill(bk, mat, { x = 0, y0, a, rise, kick = 0.35, z = 0, n = 7 }) {
  const pts = archCurve(a, rise, n, kick);
  const top = archTop(a, rise, kick);
  const geo = new THREE.ShapeGeometry(shapeOf(pts));
  shapeUV(geo, -a, 0, 2 * a, top);
  bk.add(mat, geo, { p: [x, y0, z] });
}

// An elven lantern, a drop of warm glass in a gilt cage of curving ribs, a
// cap and a point beneath, hanging so its middle is at (x, y, z); `s`
// sizes it (1: 0.5 m tall).
function lanternParts(bk, K, x, y, z, s = 1) {
  const { mats } = K;
  const prof = [[0.001, -0.22], [0.05, -0.17], [0.1, -0.04], [0.105, 0.04], [0.075, 0.13], [0.035, 0.19]].map(([r, h]) => [r * s, h * s]);
  bk.add(mats.glow, lathe(prof, 10), { p: [x, y, z] });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    const pts = prof.map(([r, h]) => [x + Math.cos(a) * (r + 0.008 * s), y + h, z + Math.sin(a) * (r + 0.008 * s)]);
    bk.add(mats.gilt, tube(pts, 0.008 * s, 0.008 * s, { seg: 8, radial: 3 }));
  }
  bk.add(mats.gilt, lathe([[0.03 * s, 0.19 * s], [0.07 * s, 0.21 * s], [0.04 * s, 0.25 * s], [0.012 * s, 0.32 * s]], 8), { p: [x, y, z] });
  bk.add(mats.gilt, lathe([[0.001, -0.36 * s], [0.012 * s, -0.3 * s], [0.03 * s, -0.24 * s], [0.04 * s, -0.215 * s], [0.001, -0.2 * s]], 6), { p: [x, y, z] });
}

// Stretch a geometry's u (a cylinder's band round, to repeat along it).
function scaleU(geo, k) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
  return geo;
}

// A carved frieze band, `len` long and `h` high, along x (or z), standing
// a little proud of a wall.
function friezeGeo(len, h, along = 'x', rep = h * 4) {
  const geo = along === 'x' ? B(len, h, 0.05) : B(0.05, h, len);
  return bandUV(geo, -h / 2, h, rep, along);
}

// ── the house of Elrond ──

// The main hall of Elrond's house, 18 m across and 10 deep, its front to
// +z. Below, an open arcade of slender columns and pointed arches before a
// deep porch, the great door at its back; above, a storey of tall arched
// windows with a taller bay in the middle under a roof of its own, and at
// the east end of the front a round balcony on a carved corbel: Frodo's
// room. Upswept leaf-roofs with long eaves, gilt along their edges; a slim
// round tower at the back west corner under a tall leaf-roof of its own.
function house(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'house';
  const bk = parts();
  const W = 18;
  const D = 10;
  const base = 0.15; // the floor
  const H1 = 5.5; // the upper floor
  const H2 = 9.4; // the eaves
  const HC = 11.0; // the middle bay's eaves
  const PZ = 2; // the face of the porch's back wall
  const T = 0.4; // walls
  const colTop = 3.35;
  const xs = Array.from({ length: 8 }, (_, i) => -8.6 + (i * 17.2) / 7);
  const half = 0.27;
  const band = H1 - colTop;
  const lamps = [];

  // the plinth, the porch's paving
  bk.add(mats.elfstone, B(W + 0.6, base, D + 0.9), { p: [0, base / 2, 0.15], uv: 0.5 });
  bk.add(mats.pave, B(W - 0.4, 0.02, 5.6 - PZ), { p: [0, base + 0.01, (5.6 + PZ) / 2], uv: 0.45 });

  // the arcade: columns, the band of arches over them, mouldings round the
  // arches with a gilt line inside, a carved roundel over each column
  for (const x of xs) column(bk, K, { x, y: base, z: 4.75, h: colTop - base, r: 0.17 });
  bk.add(mats.elfstone, ext(arcadeShape(xs, half, band), 0.5), { p: [0, colTop, 4.5], uv: 0.5 });
  for (let i = 0; i < xs.length - 1; i++) {
    const a = (xs[i + 1] - xs[i] - 2 * half) / 2;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const rise = bayRise(a, band);
    bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.13, 9, 0.35)), 0.06), { p: [cx, colTop, 5.0], uv: 1 });
    bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.035, 9, 0.35)), 0.075), { p: [cx, colTop, 5.0] });
    archFill(bk, mats.stoneFill, { x: cx, y0: colTop + rise * 0.55, a: a * 0.55, rise: rise * 0.45, z: 4.75 });
  }
  for (const x of xs.slice(1, -1)) {
    bk.add(mats.carve, cyl(0.22, 0.22, 0.06, 16), { p: [x, colTop + band * 0.58, 5.02], r: [Math.PI / 2, 0, 0], uv: 1 });
    bk.add(mats.gilt, new THREE.TorusGeometry(0.22, 0.025, 4, 16), { p: [x, colTop + band * 0.58, 5.05] });
    bk.add(mats.gilt, leafBlade(0.3, 0.12, { curl: 0, seg: 3, thick: 0.01 }), { p: [x, colTop + band * 0.58 - 0.15, 5.06] });
  }

  // the porch: its ceiling on beams of warm wood, lanterns hanging
  bk.add(mats.carve, B(W - 0.6, 0.25, 4.5 - PZ), { p: [0, H1 - 0.125, (4.5 + PZ) / 2], uv: 0.5 });
  for (const x of xs.slice(1, -1)) bk.add(mats.elfwood, B(0.16, 0.24, 4.5 - PZ), { p: [x, H1 - 0.37, (4.5 + PZ) / 2], uv: 1 });
  for (const x of [-4.91, 4.91]) {
    bk.add(mats.gilt, cyl(0.012, 0.012, 0.75, 4), { p: [x, H1 - 0.62, 3.4] });
    lanternParts(bk, K, x, H1 - 1.25, 3.4, 1.2);
    lamps.push(V3(x, H1 - 1.25, 3.4));
  }

  // walls: each in its own frame, its face at z = 0, x along it
  const wall = (o, ry, w, h, opens, fn) =>
    bk.at(o, ry, () => {
      bk.add(mats.elfstone, ext(wallShape(w, h, opens), T), { p: [0, 0, -T], uv: 0.5 });
      fn?.();
    });
  const glassAt = (list, o = {}) => list.forEach((w) => archWindow(bk, K, { ...w, ...o }));

  // the porch's back wall and the great door
  const door = { x: 0, y: 0, a: 1.05, hs: 2.5, rise: 1.45 };
  const porchWins = [-6.6, -3.7, 3.7, 6.6].map((x) => ({ x, y: 1.0, a: 0.5, hs: 1.7, rise: 0.8 }));
  wall([0, base, PZ], 0, W, H1 - base, [door, ...porchWins], () => {
    glassAt(porchWins);
    archWindow(bk, K, { ...door, frame: 0.16, pane: false, sill: false, finial: true });
    // two leaves of warm wood, a gilt fan of tracery over them
    const top = door.hs + archTop(door.a, door.rise, 0.35);
    const outline = archOpening(door.a, door.hs, door.rise, 8, 0.35);
    const leafPts = outline.filter(([x]) => x <= 1e-6);
    leafPts.push([0, top], [0, 0]);
    for (const s of [-1, 1]) {
      const pts = s < 0 ? leafPts : leafPts.map(([x, y]) => [-x, y]).reverse();
      bk.add(mats.elfwood, ext(shapeOf(pts), 0.09), { p: [0, 0, -0.3], uv: 0.8 });
      for (const k of [0.32, 0.72]) bk.add(mats.gilt, B(0.03, door.hs - 0.3, 0.02), { p: [s * door.a * k, door.hs / 2, -0.2] });
      bk.add(mats.gilt, new THREE.TorusGeometry(0.07, 0.012, 4, 12), { p: [s * 0.16, 1.25, -0.19] });
    }
    archFill(bk, mats.giltTracery, { y0: door.hs, a: door.a - 0.02, rise: door.rise - 0.02, z: -0.19 });
    bk.add(mats.gilt, B(2 * door.a, 0.05, 0.03), { p: [0, door.hs, -0.19] });
    for (const s of [-1, 1]) {
      bk.add(mats.gilt, tube([[s * 1.6, 2.35, 0], [s * 1.68, 2.6, 0.22], [s * 1.7, 2.85, 0.32]], 0.02, 0.015, { seg: 5, radial: 4 }));
      lanternParts(bk, K, s * 1.7, 2.6, 0.32, 0.9);
      lamps.push(V3(s * 1.7, base + 2.6, PZ + 0.32));
    }
  });

  // the upper storey's front, either side of the middle bay
  const frontL = [-7.0, -4.4].map((x) => ({ x: x + 5.7, y: 0.55, a: 0.48, hs: 1.75, rise: 0.85 }));
  const frontR = [{ x: 3.7 - 5.7, y: 0.55, a: 0.48, hs: 1.75, rise: 0.85 }];
  const balconyDoor = { x: 6.14 - 5.7, y: 0, a: 0.72, hs: 2.15, rise: 1.05 };
  wall([-5.7, H1, 5.0], 0, 6.6, H2 - H1, frontL, () => glassAt(frontL, { finial: true }));
  wall([5.7, H1, 5.0], 0, 6.6, H2 - H1, [...frontR, balconyDoor], () => {
    glassAt(frontR, { finial: true });
    archWindow(bk, K, { ...balconyDoor, pane: mats.inside, depth: T - 0.04, sill: false, finial: true });
    // curtains drawn back either side of the doorway
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([balconyDoor.x + s * (0.42 + k * 0.035), 0.12, -0.12 - Math.sin(k * 1.9) * 0.05]);
      bk.add(mats.curtain, ribbon(pts, 0, 2.9, 0.5));
    }
  });
  // the middle bay, taller, its great window
  const bigWin = { x: 0, y: 0.45, a: 0.85, hs: 2.6, rise: 1.45 };
  wall([0, H1, 5.3], 0, 4.8, HC - H1, [bigWin], () => {
    archWindow(bk, K, { ...bigWin, frame: 0.14, finial: true });
    bk.add(mats.frieze, friezeGeo(4.9, 0.4), { p: [0, HC - H1 - 0.5, 0.02] });
    bk.add(mats.carve, roundBox(5.2, 0.2, 0.36, 0.03), { p: [0, HC - H1 - 0.2, -0.06], uv: 1 });
  });
  for (const s of [-1, 1]) {
    bk.add(mats.elfstone, B(T, HC - H1, 8.3), { p: [s * (2.4 - T / 2), (H1 + HC) / 2, 1.15], uv: 0.5 });
    bk.add(mats.frieze, friezeGeo(8.3, 0.4, 'z'), { p: [s * 2.42, HC - 0.5, 1.15] });
    bk.add(mats.carve, roundBox(0.36, 0.2, 8.6, 0.03), { p: [s * 2.42, HC - 0.2, 1.15], uv: 1 });
  }
  bk.add(mats.elfstone, B(4.8, HC - H1, T), { p: [0, (H1 + HC) / 2, -3 + T / 2], uv: 0.5 });
  bk.add(mats.carve, B(4.7, 0.12, 8.2), { p: [0, HC - 0.06, 1.15], uv: 0.5 });

  // pilasters between the upper windows, each with a leafy capital
  for (const x of [-8.72, -5.7, -2.62, 2.62, 4.82, 8.72]) {
    bk.add(mats.carve, roundBox(0.26, H2 - H1 - 0.85, 0.1, 0.02), { p: [x, (H1 + H2 - 0.85) / 2 + 0.05, 5.04], uv: 1 });
    bk.add(mats.carve, roundBox(0.36, 0.16, 0.14, 0.02), { p: [x, H1 + 0.12, 5.05], uv: 1 });
    for (const s of [-1, 1]) bk.add(mats.gilt, leafBlade(0.32, 0.12, { curl: 0.9, seg: 3, thick: 0.01 }), { p: [x + s * 0.05, H2 - 0.95, 5.08], r: [0, s * 0.5, s * -0.3] });
  }

  // the sides, full height: a tall arch through to the porch, windows
  for (const s of [-1, 1]) {
    const wins = [
      { x: s * 1.0, y: 1.0, a: 0.48, hs: 1.7, rise: 0.8 },
      { x: s * 1.2, y: H1 - base + 0.55, a: 0.48, hs: 1.75, rise: 0.85 },
      { x: -s * 2.4, y: H1 - base + 0.55, a: 0.48, hs: 1.75, rise: 0.85 },
    ];
    const arch = { x: -s * 3.5, y: 0, a: 1.05, hs: 2.0, rise: 1.4 };
    wall([s * 9, base, 0], (s * Math.PI) / 2, D, H2 - base, [arch, ...wins], () => {
      glassAt(wins);
      archWindow(bk, K, { ...arch, pane: false, sill: false, frame: 0.14 });
    });
  }

  // the back, full height
  const back = [
    ...[-4.2, -0.8, 2.6, 6.2].map((x) => ({ x: -x, y: 1.0, a: 0.48, hs: 1.7, rise: 0.8 })),
    ...[-4.6, -1.6, 1.6, 4.6, 7.4].map((x) => ({ x: -x, y: H1 - base + 0.55, a: 0.48, hs: 1.75, rise: 0.85 })),
  ];
  wall([0, base, -5], Math.PI, W, H2 - base, back, () => glassAt(back, { gilt: false }));

  // string course at the upper floor, frieze and cornice at the eaves
  bk.add(mats.carve, roundBox(W + 0.4, 0.22, 0.42, 0.03), { p: [0, H1, 4.92], uv: 1 });
  bk.add(mats.gilt, B(W + 0.42, 0.03, 0.03), { p: [0, H1 - 0.07, 5.14] });
  bk.add(mats.carve, roundBox(W + 0.4, 0.22, 0.42, 0.03), { p: [0, H1, -4.92], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.carve, roundBox(0.42, 0.22, D + 0.4, 0.03), { p: [s * 8.92, H1, 0], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.frieze, friezeGeo(6.6, 0.4), { p: [s * 5.7, H2 - 0.35, 5.03] });
  bk.add(mats.frieze, friezeGeo(W, 0.4), { p: [0, H2 - 0.35, -5.03] });
  for (const s of [-1, 1]) bk.add(mats.frieze, friezeGeo(D, 0.4, 'z'), { p: [s * 9.03, H2 - 0.35, 0] });
  bk.add(mats.carve, roundBox(W + 0.5, 0.2, D + 0.5, 0.04), { p: [0, H2 - 0.07, 0], uv: 1 });
  bk.add(mats.carve, B(W - 0.1, 0.12, D - 0.1), { p: [0, H2 - 0.06, 0], uv: 0.5 });

  // the balcony: a half-round floor on a corbel that springs from a column
  const bx = xs[6];
  const bTop = H1 + 0.12;
  bk.add(mats.carve, lathe([[0.26, colTop], [0.34, colTop + 0.2], [0.5, colTop + 0.7], [0.85, colTop + 1.2], [1.35, bTop - 0.62], [1.8, bTop - 0.42], [1.98, bTop - 0.36]], 18, -Math.PI / 2, Math.PI), { p: [bx, 0, 5.0], uv: 1 });
  bk.add(mats.elfstone, new THREE.CylinderGeometry(2.0, 1.98, 0.36, 24, 1, false, -Math.PI / 2, Math.PI), { p: [bx, bTop - 0.18, 5.0], uv: 0.6 });
  bk.add(mats.gilt, new THREE.TorusGeometry(2.0, 0.025, 4, 24, Math.PI), { p: [bx, bTop - 0.3, 5.0], r: [Math.PI / 2, 0, 0] });
  bk.add(mats.pave, new THREE.CircleGeometry(1.95, 24, Math.PI, Math.PI), { p: [bx, bTop + 0.005, 5.0], r: [-Math.PI / 2, 0, 0] });
  // gilt ribs down the corbel
  const corbel = [[0.3, colTop + 0.1], [0.38, colTop + 0.3], [0.54, colTop + 0.72], [0.88, colTop + 1.2], [1.38, bTop - 0.62], [1.83, bTop - 0.42]];
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) / 5) * Math.PI;
    bk.add(mats.gilt, tube(corbel.map(([r, y]) => [bx + Math.sin(a) * (r + 0.02), y, 5.0 + Math.cos(a) * (r + 0.02)]), 0.03, 0.03, { seg: 10, radial: 4 }));
  }
  const rail = [];
  for (let k = 0; k <= 24; k++) {
    const a = -Math.PI / 2 + (k / 24) * Math.PI;
    rail.push([bx + Math.sin(a) * 1.82, bTop, 5.0 + Math.cos(a) * 1.82]);
  }
  balustrade(bk, K, rail, { h: 1.0, step: 1.15 });

  // the roofs: the long one, the middle bay's across it
  const main = roofOn(bk, K, { ridge: 3.8, dx: 6.4, dz: 6.3, rise: 5.0, prof: (q) => Math.pow(1 - q, 1.4), lift: 0.3, tips: 0.6, n: 5, rings: 12, around: 72 }, { p: [0, H2 + 0.02, 0], finial: 1.4 });
  // curved brackets of warm wood from the cornice up under the eaves
  const bracket = (x, z, nx, nz) => {
    const ex = x + nx * 0.85;
    const ez = z + nz * 0.85;
    const ey = H2 + 0.02 + main.yAt(ex, ez) - main.t - 0.04;
    bk.add(mats.elfwood, tube([[x - nx * 0.1, H2 - 0.32, z - nz * 0.1], [x + nx * 0.12, H2 + 0.02, z + nz * 0.12], [x + nx * 0.5, ey - 0.2, z + nz * 0.5], [ex, ey, ez]], 0.065, 0.045, { seg: 6, radial: 4 }), { uv: 1.5 });
  };
  for (let x = -8.2; x <= 8.3; x += 2.05) {
    if (Math.abs(x) > 2.8) bracket(x, 5.2, 0, 1);
    if (x > -6.4) bracket(x, -5.2, 0, -1);
  }
  for (const s of [-1, 1]) for (let z = -3.6; z <= 4; z += 2.4) if (s > 0 || z > -2.3) bracket(s * 9.2, z, s, 0);
  roofOn(bk, K, { ridge: 2.2, dx: 2.6, dz: 3.3, rise: 4.0, prof: (q) => Math.pow(1 - q, 1.4), lift: 0.25, tips: 0.5, n: 5, rings: 10, around: 56 }, { p: [0, HC + 0.02, 1.15], ry: Math.PI / 2, finial: 1.3 });

  // the tower at the back west corner
  const tx = -8.3;
  const tz = -4.3;
  const rt = 1.75;
  const TT = 14.0;
  bk.add(mats.elfstone, lathe([[rt + 0.2, 0], [rt + 0.2, 0.45], [rt, 0.62], [rt, TT]], 24), { p: [tx, 0, tz], uv: 0.5 });
  for (const y of [H1, H2]) bk.add(mats.carve, lathe([[rt, y - 0.1], [rt + 0.14, y - 0.06], [rt + 0.14, y + 0.08], [rt, y + 0.12]], 24), { p: [tx, 0, tz], uv: 1 });
  bk.add(mats.carve, lathe([[rt, 11.6], [rt + 0.2, 11.9], [rt + 0.5, 12.15], [rt + 0.6, 12.2], [rt + 0.6, 12.38], [rt, 12.38]], 24), { p: [tx, 0, tz], uv: 1 });
  const ring = [];
  for (let k = 0; k <= 28; k++) ring.push([tx + Math.cos((k / 28) * TAU) * (rt + 0.45), 12.38, tz + Math.sin((k / 28) * TAU) * (rt + 0.45)]);
  balustrade(bk, K, ring, { h: 0.85, step: 1.6, ends: false });
  bk.add(mats.frieze, scaleU(new THREE.CylinderGeometry(rt + 0.03, rt + 0.03, 0.4, 24, 1, true), (TAU * rt) / 1.6), { p: [tx, TT - 0.45, tz] });
  bk.add(mats.carve, lathe([[rt, TT - 0.25], [rt + 0.2, TT - 0.15], [rt + 0.25, TT], [rt, TT + 0.05]], 24), { p: [tx, 0, tz], uv: 1 });
  for (const [y, a] of [[1.6, -2.4], [6.3, -2.4], [6.3, Math.PI], [10.1, -2.0], [10.1, 2.8], [10.1, -0.9]]) {
    bk.at([tx + Math.cos(a) * rt, y, tz + Math.sin(a) * rt], Math.PI / 2 - a, () => archWindow(bk, K, { x: 0, y: 0, a: 0.26, hs: 0.95, rise: 0.5, depth: -0.02, gilt: y > 10, frame: 0.08 }));
  }
  roofOn(bk, K, { dx: 2.55, dz: 2.55, rise: 5.6, prof: (s) => Math.pow(1 - s, 1.9), lift: 0.35, tips: 0, n: 2, rings: 14, around: 40 }, { p: [tx, TT + 0.02, tz], ribs: [0, 0.25, 0.5, 0.75], finial: 1.5 });

  bk.build(g);
  return {
    group: g,
    balcony: V3(bx, bTop, 5.9),
    door: V3(0, base, PZ + 0.6),
    lamps,
    footprint: { w: W, d: D },
    porch: { z0: PZ, z1: 5, x0: -9, x1: 9 },
    tower: { x: tx, z: tz, r: rt + 0.2 },
  };
}

// ── furnishings ──

// A cloth over a w × d top (its middle at the origin, the top at y = 0),
// hanging `hang` down over the sides listed ([-x, +x, -z, +z]), in soft
// folds that deepen towards the hem.
function drapeGeo(w, d, hang, { sides = [1, 1, 1, 1], folds = 9, depth = 0.025, nx = 24, nz = 14, seed = 1 } = {}) {
  const n = makeNoise(seed);
  const x0 = -w / 2 - (sides[0] ? hang : 0);
  const x1 = w / 2 + (sides[1] ? hang : 0);
  const z0 = -d / 2 - (sides[2] ? hang : 0);
  const z1 = d / 2 + (sides[3] ? hang : 0);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const v = j / nz;
      const x = mix(x0, x1, u);
      const z = mix(z0, z1, v);
      const ex = Math.max(0, Math.abs(x) - w / 2);
      const ez = Math.max(0, Math.abs(z) - d / 2);
      const e = Math.hypot(ex, ez);
      const k = Math.min(1, e / hang);
      // over the edge it hangs, standing a little out, rippled into folds
      const along = ex > ez ? z : x;
      const ripple = Math.sin(along * folds * 2 + n(along * 3, 1) * 3) * depth * k;
      const ox = ex > 0 ? Math.sign(x) * (w / 2 + e * 0.12 + (ex >= ez ? ripple : 0)) : x;
      const oz = ez > 0 ? Math.sign(z) * (d / 2 + e * 0.12 + (ez > ex ? ripple : 0)) : z;
      const y = e > 0 ? -e * 0.98 : (n(x * 6, z * 6) - 0.5) * 0.008;
      pos.push(ox, y, oz);
      uv.push(u * (x1 - x0), v * (z1 - z0));
      if (i && j) {
        const a = (j - 1) * (nx + 1) + i - 1;
        const b = a + nx + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A high-backed elven chair facing +x (its back to -x, its seat's middle
// over the origin): curved legs, a cushioned seat, arms that end in
// scrolls, and a tall back shaped like a pointed arch, gilt tracery in its
// head and gilt leaves on its posts.
function chairParts(bk, K, { back = 2.0, seatH = 0.5, w = 0.64, d = 0.56, cushion = null } = {}) {
  const { mats } = K;
  const wood = mats.elfwood;
  const hx = d / 2;
  const hz = w / 2;
  bk.add(wood, roundBox(d, 0.07, w, 0.02), { p: [0, seatH - 0.035, 0], uv: 1 });
  bk.add(cushion || mats.velvet, roundBox(d - 0.06, 0.07, w - 0.1, 0.03), { p: [0.01, seatH + 0.03, 0], uv: 1 });
  const ay = seatH + 0.26;
  for (const s of [-1, 1]) {
    bk.add(wood, tube([[hx - 0.05, seatH - 0.05, s * (hz - 0.05)], [hx, seatH * 0.45, s * (hz - 0.03)], [hx + 0.05, 0.02, s * hz]], 0.03, 0.022, { seg: 5, radial: 5 }), { uv: 2 });
    bk.add(wood, tube([[-hx + 0.02, 0, s * hz], [-hx + 0.04, seatH, s * (hz - 0.02)], [-hx + 0.01, mix(seatH, back, 0.6), s * (hz - 0.03)], [-hx - 0.02, back - 0.04, s * (hz - 0.05)]], 0.034, 0.026, { seg: 8, radial: 5 }), { uv: 2 });
    bk.add(mats.gilt, leafBlade(0.2, 0.08, { curl: 0.6, seg: 3, thick: 0.008 }), { p: [-hx - 0.02, back - 0.05, s * (hz - 0.05)], r: [0, -Math.PI / 2, 0] });
    bk.add(wood, tube([[-hx, ay + 0.02, s * (hz - 0.01)], [0, ay + 0.04, s * (hz + 0.03)], [hx, ay, s * (hz + 0.02)], [hx + 0.07, ay - 0.06, s * hz], [hx + 0.03, ay - 0.11, s * hz], [hx - 0.01, ay - 0.06, s * hz]], 0.026, 0.018, { seg: 10, radial: 4 }), { uv: 2 });
    bk.add(wood, tube([[hx - 0.03, seatH, s * (hz - 0.02)], [hx - 0.01, ay - 0.09, s * hz]], 0.018, 0.018, { seg: 2, radial: 4 }));
  }
  // the back: a pointed arch of wood with a carved rim, gilt tracery in its head
  const a = hz - 0.06;
  const rise = a * 1.7;
  const hs = Math.max(0.2, back - seatH - 0.14 - archTop(a, rise, 0.4) - 0.04);
  bk.at([-hx + 0.0, seatH + 0.1, 0], Math.PI / 2, () => {
    bk.add(wood, ext(shapeOf(archOpening(a, hs, rise, 8, 0.4)), 0.035), { p: [0, 0, -0.035], uv: 1.5 });
    bk.add(wood, ext(shapeOf(archFrame(a - 0.05, hs, rise - 0.06, 0.05, 8, 0.4)), 0.025), { p: [0, 0, 0], uv: 1.5 });
    archFill(bk, mats.giltTracery, { y0: hs, a: a - 0.06, rise: rise - 0.08, kick: 0.4, z: 0.012 });
    bk.add(mats.gilt, B(2 * a - 0.12, 0.02, 0.02), { p: [0, hs, 0.012] });
    bk.add(mats.gilt, leafBlade(0.22, 0.09, { curl: 0.3, seg: 3, thick: 0.008 }), { p: [0, hs + archTop(a, rise, 0.4) - 0.02, -0.018] });
  });
}

// ── the room where Frodo wakes ──

// Frodo's room in the house of Elrond, a set apart from the town (as
// Bree's common room is): 6 m by 5, its floor at y = 0, pale walls under a
// ceiling of curved ribs, tall arched windows down the +x side full of
// sun with shafts of it falling across the floor; a carved bed with white
// linen and pillows, its head to -z; a chair beside it for Gandalf; a
// little table with a jug; a rug; a chest; the door in the -x wall, its
// leaf hung so it can swing.
function bedroom(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'bedroom';
  const bk = parts();
  const W = 6;
  const D = 5;
  const H = 4.4;
  const T = 0.25;
  bk.add(mats.pave, B(W + 2 * T, 0.1, D + 2 * T), { p: [0, -0.05, 0], uv: 0.6 });
  bk.add(mats.carve, B(W + 2 * T, 0.15, D + 2 * T), { p: [0, H + 0.075, 0], uv: 0.5 });
  for (let x = -2.4; x <= 2.41; x += 1.2) bk.add(mats.elfwood, tube([[x, H - 0.55, -D / 2], [x, H - 0.12, -D / 4], [x, H - 0.05, 0], [x, H - 0.12, D / 4], [x, H - 0.55, D / 2]], 0.07, 0.07, { seg: 12, radial: 5 }), { uv: 1.5 });
  bk.add(mats.elfwood, tube([[-W / 2, H - 0.06, 0], [W / 2, H - 0.06, 0]], 0.08, 0.08, { seg: 2, radial: 5 }), { uv: 1.5 });
  // the walls, their faces to the room
  const wins = [-1.5, 0, 1.5].map((z) => ({ x: z, y: 0.75, a: 0.5, hs: 2.1, rise: 1.0 }));
  const door = { x: -1.2, y: 0, a: 0.6, hs: 2.2, rise: 0.85 };
  bk.add(mats.elfstone, B(W + 2 * T, H, T), { p: [0, H / 2, -D / 2 - T / 2], uv: 0.5 });
  bk.add(mats.elfstone, B(W + 2 * T, H, T), { p: [0, H / 2, D / 2 + T / 2], uv: 0.5 });
  bk.at([W / 2, 0, 0], -Math.PI / 2, () => {
    bk.add(mats.elfstone, ext(wallShape(D, H, wins), T), { p: [0, 0, -T], uv: 0.5 });
    wins.forEach((w) => archWindow(bk, K, { ...w, pane: mats.sunpane, depth: T * 0.6 }));
    for (const z of [-0.75, 0.75]) bk.add(mats.carve, roundBox(0.2, H - 0.9, 0.08, 0.02), { p: [z, (H - 0.9) / 2 + 0.05, 0.03], uv: 1 });
    for (const w of wins) {
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 6; k++) pts.push([w.x + s * (0.62 + k * 0.03), 0.02, 0.08 + Math.sin(k * 2.1) * 0.035]);
        bk.add(mats.curtain, ribbon(pts, 0, 3.7, 0.4));
      }
      bk.add(mats.gilt, cylX(0.015, 1.5, 6), { p: [w.x, 3.75, 0.08], r: [0, 0, 0] });
    }
  });
  bk.at([-W / 2, 0, 0], Math.PI / 2, () => {
    bk.add(mats.elfstone, ext(wallShape(D, H, [door]), T), { p: [0, 0, -T], uv: 0.5 });
    archWindow(bk, K, { ...door, pane: false, sill: false, frame: 0.12, finial: true });
  });
  // a carved frieze round the top of the walls
  for (const s of [-1, 1]) {
    bk.add(mats.frieze, friezeGeo(W, 0.36), { p: [0, H - 0.4, s * (D / 2 - 0.02)] });
    bk.add(mats.frieze, friezeGeo(D, 0.36, 'z'), { p: [s * (W / 2 - 0.02), H - 0.4, 0] });
  }

  // the bed, its head to the back wall
  const bx = 0.7;
  const bz = -1.25;
  const top = 0.62;
  bk.at([bx, 0, -2.42], 0, () => {
    bk.add(mats.elfwood, ext(shapeOf(archOpening(0.86, 1.0, 0.7, 8, 0.4)), 0.07), { p: [0, 0.25, -0.04], uv: 1.2 });
    bk.add(mats.elfwood, ext(shapeOf(archFrame(0.7, 0.95, 0.56, 0.06, 8, 0.4)), 0.03), { p: [0, 0.3, 0.03], uv: 1.2 });
    archFill(bk, mats.giltTracery, { y0: 1.25, a: 0.68, rise: 0.54, kick: 0.4, z: 0.045 });
    bk.add(mats.gilt, B(1.36, 0.025, 0.02), { p: [0, 1.25, 0.05] });
    bk.add(mats.gilt, leafBlade(0.3, 0.12, { curl: 0.3, seg: 3, thick: 0.01 }), { p: [0, 0.25 + 1.0 + archTop(0.86, 0.7, 0.4), 0] });
  });
  for (const [sx, sz, h] of [[-1, -1, 1.55], [1, -1, 1.55], [-1, 1, 0.95], [1, 1, 0.95]]) {
    const x = bx + sx * 0.86;
    const z = bz + sz * 1.17;
    bk.add(mats.elfwood, lathe([[0.06, 0], [0.06, 0.08], [0.045, 0.14], [0.042, h - 0.12], [0.06, h - 0.06], [0.03, h]], 8), { p: [x, 0, z], uv: 1.5 });
    bk.add(mats.gilt, leafBlade(0.16, 0.07, { curl: 0.2, seg: 3, thick: 0.008 }), { p: [x, h - 0.01, z] });
  }
  bk.at([bx, 0, bz + 1.18], 0, () => {
    bk.add(mats.elfwood, ext(shapeOf(archOpening(0.82, 0.45, 0.32, 8, 0.4)), 0.05), { p: [0, 0.2, -0.025], uv: 1.2 });
    bk.add(mats.gilt, ext(shapeOf(archFrame(0.7, 0.4, 0.24, 0.025, 8, 0.4)), 0.012), { p: [0, 0.25, 0.025] });
  });
  for (const s of [-1, 1]) bk.add(mats.elfwood, roundBox(0.07, 0.2, 2.3, 0.02), { p: [bx + s * 0.84, 0.36, bz], uv: 1.2 });
  bk.add(mats.linen, roundBox(1.62, 0.24, 2.26, 0.08), { p: [bx, top - 0.12, bz], uv: 1.5 });
  bk.add(mats.coverlet, drapeGeo(1.66, 1.6, 0.3, { sides: [1, 1, 0, 1], folds: 7, seed: 3 }), { p: [bx, top + 0.025, bz + 0.35] });
  bk.add(mats.linen, roundBox(1.7, 0.035, 0.22, 0.015), { p: [bx, top + 0.04, bz - 0.38], r: [0.05, 0, 0], uv: 1.5 });
  for (const s of [-1, 1]) {
    const pill = new THREE.SphereGeometry(0.3, 14, 8);
    bk.add(mats.linen, pill, { p: [bx + s * 0.36, top + 0.08, bz - 0.85], s: [1.15, 0.36, 0.72], r: [-0.25, s * 0.08, 0], uv: 1.5 });
  }

  // Gandalf's chair beside the bed, facing it; a table with a jug at the
  // bed's head; a chest at its foot; a rug
  bk.at([2.15, 0, -1.0], Math.PI, () => chairParts(bk, K, { back: 1.55, seatH: 0.48, w: 0.6, d: 0.52 }));
  const tx = -0.65;
  const tz = -1.95;
  bk.add(mats.elfwood, lathe([[0.001, 0.68], [0.3, 0.68], [0.32, 0.65], [0.3, 0.62], [0.05, 0.6], [0.04, 0.4], [0.06, 0.2], [0.04, 0.08], [0.001, 0.06]], 14), { p: [tx, 0, tz], uv: 1.5 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.5;
    bk.add(mats.elfwood, tube([[tx, 0.12, tz], [tx + Math.cos(a) * 0.16, 0.06, tz + Math.sin(a) * 0.16], [tx + Math.cos(a) * 0.24, 0.0, tz + Math.sin(a) * 0.24]], 0.025, 0.018, { seg: 4, radial: 4 }));
  }
  bk.add(mats.glaze, lathe([[0.001, 0], [0.07, 0.005], [0.085, 0.06], [0.08, 0.14], [0.05, 0.2], [0.045, 0.24], [0.06, 0.27], [0.055, 0.28], [0.035, 0.24]], 12), { p: [tx + 0.06, 0.68, tz + 0.02], uv: 3 });
  bk.add(mats.glaze, tube([[tx + 0.06 - 0.05, 0.25, tz + 0.02], [tx + 0.06 - 0.13, 0.22, tz + 0.02], [tx + 0.06 - 0.1, 0.1, tz + 0.02], [tx + 0.06 - 0.07, 0.07, tz + 0.02]].map(([x, y, z]) => [x, y + 0.68, z]), 0.012, 0.012, { seg: 6, radial: 4 }));
  bk.add(mats.glaze, lathe([[0.001, 0], [0.035, 0.002], [0.045, 0.07], [0.04, 0.075]], 10), { p: [tx - 0.14, 0.68, tz + 0.1] });
  bk.add(mats.gilt, lathe([[0.001, 0], [0.04, 0.01], [0.05, 0.08], [0.03, 0.14], [0.035, 0.17]], 10), { p: [tx - 0.08, 0.68, tz - 0.14] });
  for (let k = 0; k < 4; k++) bk.add(mats.leafGold, leafBlade(0.14, 0.06, { curl: 0.8, seg: 3, thick: 0.004 }), { p: [tx - 0.08, 0.84, tz - 0.14], r: [0, k * 1.6, 0.3] });
  bk.add(mats.elfwood, roundBox(1.1, 0.5, 0.48, 0.03), { p: [bx, 0.25, 0.32], uv: 1.2 });
  bk.add(mats.elfwood, roundBox(1.14, 0.06, 0.52, 0.025), { p: [bx, 0.52, 0.32], uv: 1.2 });
  for (const s of [-1, 1]) bk.add(mats.gilt, B(0.04, 0.52, 0.5), { p: [bx + s * 0.4, 0.27, 0.32] });
  bk.add(mats.rug, new THREE.PlaneGeometry(2.6, 1.6), { p: [-1.0, 0.012, 0.9], r: [-Math.PI / 2, 0, 0] });
  bk.build(g);

  // the door's leaf, hung on its hinge to swing
  const doorLeaf = new THREE.Group();
  doorLeaf.name = 'doorLeaf';
  const lk = parts();
  const outline = archOpening(door.a - 0.02, door.hs, door.rise - 0.02, 8, 0.35).map(([x, y]) => [x + door.a, y]);
  lk.add(mats.elfwood, ext(shapeOf(outline), 0.07), { p: [0, 0, -0.035], uv: 1.2 });
  for (const k of [0.35, 0.85]) lk.add(mats.gilt, B(0.03, door.hs - 0.3, 0.02), { p: [door.a * 2 * k, door.hs / 2, 0.04] });
  lk.add(mats.gilt, new THREE.TorusGeometry(0.06, 0.01, 4, 12), { p: [door.a * 2 - 0.15, 1.1, 0.05] });
  lk.build(doorLeaf);
  doorLeaf.position.set(-W / 2 - T / 2, 0, -door.x - door.a);
  doorLeaf.rotation.y = -Math.PI / 2;
  doorLeaf.userData.shut = -Math.PI / 2;
  g.add(doorLeaf);

  // shafts of sun through the windows, and where they fall on the floor
  const sk = parts();
  const dir = [-1, -0.68, 0.24];
  const y0 = 0.8;
  const y1 = 3.7;
  for (const w of wins) {
    const z0 = w.x - 0.48;
    const z1 = w.x + 0.48;
    const reach = y1 / -dir[1];
    const P = (y, z, t) => [W / 2 + dir[0] * t, y + dir[1] * t, z + dir[2] * t];
    const quad = (a, b, c, d) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geo.setIndex([0, 1, 2, 1, 3, 2]);
      geo.computeVertexNormals();
      sk.add(mats.shaft, geo);
    };
    quad(P(y0, z0, 0), P(y1, z0, 0), P(y0, z0, reach), P(y1, z0, reach));
    quad(P(y0, z1, 0), P(y1, z1, 0), P(y0, z1, reach), P(y1, z1, reach));
    quad(P(y1, z0, 0), P(y1, z1, 0), P(y1, z0, reach), P(y1, z1, reach));
    quad(P(y0, z0, 0), P(y0, z1, 0), P(y0, z0, reach), P(y0, z1, reach));
    // the patch of sun on the floor
    const f = (y, z) => P(y, z, y / -dir[1]).map((v, i) => (i === 1 ? 0.01 : v));
    quad(f(y0, z0), f(y0, z1), f(y1, z0), f(y1, z1));
  }
  const shafts = sk.build(g, { shadow: false, receive: false });
  for (const m of shafts) m.renderOrder = 2;

  return {
    group: g,
    bed: V3(bx, top + 0.06, bz + 0.1),
    chair: V3(2.15, 0.48, -1.0),
    door: V3(-W / 2 + 0.5, 0, -door.x),
    sun: V3(W / 2 - 0.5, 2.6, 0),
    doorLeaf,
    windows: wins.map((w) => V3(W / 2, w.y + 1.5, w.x)),
  };
}

// ── Bilbo's room ──

// A candle on a little gilt dish, its flame at the top (y + 0.2 · s).
function candleParts(bk, K, x, y, z, s = 1) {
  const { mats } = K;
  bk.add(mats.gilt, lathe([[0.001, 0], [0.05 * s, 0.004], [0.055 * s, 0.015], [0.02 * s, 0.02]], 10), { p: [x, y, z] });
  bk.add(mats.wax, cyl(0.016 * s, 0.018 * s, 0.17 * s, 8), { p: [x, y + 0.1 * s, z] });
  bk.add(mats.flame, lathe([[0.001, 0], [0.011 * s, 0.012 * s], [0.012 * s, 0.025 * s], [0.001, 0.06 * s]], 6), { p: [x, y + 0.19 * s, z] });
  return V3(x, y + 0.21 * s, z);
}

// Bilbo's room: an open pavilion of eight slender columns, 6 m across, its
// front (to +z) open, under an ogee dome of bronze-green leaf with a gilt
// finial; a low balustrade round the other seven sides; a carved screen at
// the back with his map hung on it. Inside, his writing desk with the book
// open on it, ink and quill, candles, papers and scrolls, his chair, a rug.
function pavilion(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'pavilion';
  const bk = parts();
  const R = 3.0;
  const y0 = 0.35;
  const colH = 3.0;
  const bandH = 0.9;
  const side = 2 * R * Math.sin(Math.PI / 8);
  const ap = R * Math.cos(Math.PI / 8);
  const corner = (k) => [R * Math.cos(Math.PI / 8 + (k * Math.PI) / 4), R * Math.sin(Math.PI / 8 + (k * Math.PI) / 4)];
  // the platform, a step to the front
  bk.add(mats.elfstone, new THREE.CylinderGeometry(R + 0.4, R + 0.5, y0, 8, 1, false, Math.PI / 8), { p: [0, y0 / 2, 0], uv: 0.6 });
  bk.add(mats.carve, new THREE.CylinderGeometry(R + 0.43, R + 0.43, 0.06, 8, 1, false, Math.PI / 8), { p: [0, y0 - 0.03, 0], uv: 1 });
  bk.add(mats.pave, new THREE.CircleGeometry(R + 0.36, 8, Math.PI / 8), { p: [0, y0 + 0.003, 0], r: [-Math.PI / 2, 0, 0], uv: 0.5 });
  bk.add(mats.elfstone, B(2.3, y0 / 2, 0.55), { p: [0, y0 / 4, (R + 0.45) * Math.cos(Math.PI / 8) + 0.27], uv: 0.6 });
  for (let k = 0; k < 8; k++) {
    const [x, z] = corner(k);
    column(bk, K, { x, y: y0, z, h: colH, r: 0.13 });
  }
  // the arches between the columns, the cornice over them
  for (let k = 0; k < 8; k++) {
    const pm = (k * Math.PI) / 4;
    bk.at([Math.cos(pm) * (ap - 0.11), y0 + colH, Math.sin(pm) * (ap - 0.11)], Math.PI / 2 - pm, () => {
      bk.add(mats.elfstone, ext(arcadeShape([-side / 2, side / 2], 0.24, bandH, { ratio: 1.5 }), 0.22), { p: [0, 0, -0.11], uv: 0.6 });
      const a = side / 2 - 0.24;
      const rise = bayRise(a, bandH, { ratio: 1.5 });
      bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.09, 8, 0.35)), 0.04), { p: [0, 0, 0.11], uv: 1 });
      bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.025, 8, 0.35)), 0.05), { p: [0, 0, 0.11] });
      archFill(bk, mats.stoneFill, { y0: rise * 0.4, a: a * 0.62, rise: rise * 0.58 });
    });
  }
  const cy = y0 + colH + bandH;
  bk.add(mats.carve, new THREE.CylinderGeometry(R + 0.3, R + 0.18, 0.22, 8, 1, false, Math.PI / 8), { p: [0, cy + 0.11, 0], uv: 1 });
  bk.add(mats.gilt, new THREE.CylinderGeometry(R + 0.31, R + 0.31, 0.03, 8, 1, true, Math.PI / 8), { p: [0, cy + 0.17, 0] });
  bk.add(mats.carve, new THREE.CircleGeometry(R + 0.1, 8, Math.PI / 8), { p: [0, cy - 0.01, 0], r: [Math.PI / 2, 0, 0], uv: 0.5 });
  roofOn(bk, K, { sides: 8, rot: Math.PI / 8, dx: 3.75, dz: 3.75, rise: 3.1, prof: (q) => Math.pow(Math.max(0, 1 - Math.pow(q, 0.85)), 0.62), lift: 0.3, tips: 0.4, rings: 14, around: 64 }, { p: [0, cy + 0.2, 0], finial: 1.3 });
  // a low balustrade round all but the front
  for (let k = 0; k < 8; k++) {
    if (k === 1) continue; // the side between corners 1 and 2 faces +z
    const a = corner(k);
    const b = corner(k + 1);
    const P = (t) => [mix(a[0], b[0], t), y0, mix(a[1], b[1], t)];
    balustrade(bk, K, [P(0.08), P(0.92)], { h: 0.85, posts: false });
  }

  // the screen at the back, and the map hung on it
  const bz = -ap + 0.12;
  bk.add(mats.elfwood, B(side + 0.2, 0.08, 0.08), { p: [0, y0 + 2.75, bz], uv: 1.5 });
  bk.add(mats.elfwood, B(side + 0.1, 0.06, 0.06), { p: [0, y0 + 1.0, bz], uv: 1.5 });
  for (const s of [-1, 1]) bk.add(mats.gilt, ball(0.045, 8, 6), { p: [s * (side / 2 + 0.1), y0 + 2.75, bz] });
  const mapGeo = new THREE.PlaneGeometry(1.5, 1.12, 8, 4);
  const mp = mapGeo.attributes.position;
  for (let k = 0; k < mp.count; k++) mp.setZ(k, Math.sin(mp.getX(k) * 4) * 0.012 + (mp.getY(k) < -0.4 ? (mp.getY(k) + 0.4) * -0.15 : 0));
  mapGeo.computeVertexNormals();
  bk.add(mats.map, mapGeo, { p: [0, y0 + 2.12, bz + 0.07] });
  bk.add(mats.elfwood, cylX(0.022, 1.62, 8), { p: [0, y0 + 2.69, bz + 0.07] });
  bk.add(mats.rope, tube([[-0.55, y0 + 2.69, bz + 0.07], [0, y0 + 2.8, bz + 0.03], [0.55, y0 + 2.69, bz + 0.07]], 0.006, 0.006, { seg: 6, radial: 3 }));

  // the desk, its back to +x, Bilbo's chair at its -x side
  const dx = 0.3;
  const dz = -1.0;
  const dy = y0 + 0.74;
  bk.add(mats.elfwood, roundBox(0.78, 0.05, 1.35, 0.015), { p: [dx, dy - 0.025, dz], uv: 1.5 });
  bk.add(mats.elfwood, roundBox(0.7, 0.12, 1.25, 0.015), { p: [dx, dy - 0.1, dz], uv: 1.5 });
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) bk.add(mats.elfwood, tube([[dx + sx * 0.33, dy - 0.12, dz + sz * 0.6], [dx + sx * 0.36, y0 + 0.35, dz + sz * 0.6], [dx + sx * 0.4, y0, dz + sz * 0.62]], 0.03, 0.022, { seg: 5, radial: 5 }), { uv: 2 });
  // a gallery along its far edge: a shelf on carved ends, pigeonholes
  bk.add(mats.elfwood, roundBox(0.2, 0.32, 1.3, 0.012), { p: [dx + 0.29, dy + 0.16, dz], uv: 1.5 });
  bk.add(mats.elfwood, roundBox(0.24, 0.03, 1.36, 0.01), { p: [dx + 0.29, dy + 0.33, dz], uv: 1.5 });
  for (let k = 0; k < 5; k++) bk.add(mats.inside, B(0.02, 0.12, 0.2), { p: [dx + 0.18, dy + 0.14, dz - 0.5 + k * 0.25] });
  // the book open in front of him, the Red Book's covers under its pages
  bk.add(mats.redLeather, roundBox(0.34, 0.02, 0.48, 0.008), { p: [dx - 0.1, dy + 0.01, dz], uv: 3 });
  const pages = new THREE.PlaneGeometry(0.46, 0.32, 12, 1);
  const pp = pages.attributes.position;
  for (let k = 0; k < pp.count; k++) {
    const u = pp.getX(k) / 0.23;
    pp.setZ(k, 0.028 * Math.pow(Math.abs(u), 0.6) * (1 - Math.abs(u) * 0.35));
  }
  pages.computeVertexNormals();
  bk.add(mats.book, pages, { p: [dx - 0.1, dy + 0.022, dz], r: [-Math.PI / 2, 0, -Math.PI / 2] });
  // ink and a quill, papers, scrolls, candles
  bk.add(mats.inkpot, lathe([[0.001, 0], [0.035, 0.002], [0.04, 0.03], [0.02, 0.05], [0.018, 0.06]], 8), { p: [dx + 0.08, dy, dz + 0.36] });
  bk.add(mats.quill, leafBlade(0.3, 0.035, { curl: 0.25, seg: 4, thick: 0.002 }), { p: [dx + 0.08, dy + 0.05, dz + 0.36], r: [0.35, 0.6, -0.45] });
  const r = rng(12);
  for (let k = 0; k < 6; k++) {
    const onDesk = k < 3;
    const px = onDesk ? dx + 0.02 + (r() - 0.5) * 0.3 : -0.4 + r() * 1.8;
    const pz = onDesk ? dz + (k - 1) * 0.42 + (r() - 0.5) * 0.08 : -2.0 + r() * 1.6;
    const py = onDesk ? dy + 0.003 + k * 0.001 : y0 + 0.004;
    bk.add(mats.notes, B(0.21, 0.002, 0.29), { p: [px, py, pz], r: [0, (r() - 0.5) * 1.2, 0] });
  }
  const scroll = (x, y, z, ry, rz = 0, len = 0.32) => {
    bk.add(mats.parchment, cylX(0.028, len, 10), { p: [x, y, z], r: [0, ry, rz] });
    for (const s of [-1, 1]) bk.add(mats.elfwood, cylX(0.012, 0.05, 6), { p: [x + Math.cos(ry) * s * (len / 2 + 0.02), y + Math.sin(rz) * s * (len / 2 + 0.02), z - Math.sin(ry) * s * (len / 2 + 0.02)], r: [0, ry, rz] });
  };
  scroll(dx + 0.18, dy + 0.03, dz - 0.45, 0.3);
  scroll(dx + 0.14, dy + 0.03, dz + 0.5, -0.4);
  scroll(dx + 0.14, dy + 0.085, dz + 0.48, -0.25);
  // a basket of scrolls on the floor
  const kx = -1.3;
  const kz = -1.8;
  bk.add(mats.wicker, lathe([[0.001, 0], [0.2, 0.01], [0.24, 0.15], [0.26, 0.32], [0.27, 0.34], [0.25, 0.34], [0.23, 0.17], [0.19, 0.03], [0.001, 0.03]], 12), { p: [kx, y0, kz], uv: 4 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    bk.add(mats.parchment, cyl(0.03, 0.03, 0.5, 8), { p: [kx + Math.cos(a) * 0.1, y0 + 0.28, kz + Math.sin(a) * 0.1], r: [Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18] });
  }
  const flames = [candleParts(bk, K, dx + 0.29, dy + 0.345, dz - 0.5), candleParts(bk, K, dx + 0.29, dy + 0.345, dz + 0.2, 0.9)];
  // a tall candlestick
  const sx = 1.25;
  const sz = -1.85;
  bk.add(mats.gilt, lathe([[0.16, 0], [0.16, 0.03], [0.06, 0.08], [0.025, 0.2], [0.02, 1.2], [0.04, 1.24], [0.07, 1.27], [0.02, 1.28]], 10), { p: [sx, y0, sz] });
  flames.push(candleParts(bk, K, sx, y0 + 1.27, sz, 1.4));
  // his chair, and a rug under it all
  bk.at([-0.45, y0, dz], 0, () => chairParts(bk, K, { back: 1.3, seatH: 0.5, w: 0.56, d: 0.48 }));
  bk.add(mats.rug, new THREE.PlaneGeometry(2.6, 1.7), { p: [0, y0 + 0.008, -0.9], r: [-Math.PI / 2, 0, Math.PI / 2] });
  bk.build(g);
  return { group: g, desk: V3(dx - 0.1, dy, dz), seat: V3(-0.45, y0 + 0.5, dz), floor: y0, flames };
}

// ── the hall of Narsil ──

// A robed figure in pale stone on a low plinth, facing +z, holding out a
// tray across both forearms with a cloth of dark red velvet over it.
// Returns where the cloth's top is.
function statueParts(bk, K, { x = 0, y = 0, z = 0, tray = 1.7 } = {}) {
  const { mats } = K;
  const m = mats.marble;
  const ph = 0.3;
  bk.add(m, lathe([[0.62, 0], [0.62, 0.06], [0.55, 0.1], [0.52, ph - 0.06], [0.58, ph - 0.03], [0.6, ph]], 16), { p: [x, y, z], uv: 1 });
  bk.add(m, new THREE.CircleGeometry(0.6, 16), { p: [x, y + ph, z], r: [-Math.PI / 2, 0, 0], uv: 1 });
  const b = y + ph;
  // the robe, falling in folds deeper towards its hem
  const robe = lathe([[0.4, 0], [0.38, 0.12], [0.33, 0.45], [0.26, 0.85], [0.2, 1.15], [0.18, 1.3], [0.2, 1.45], [0.22, 1.6], [0.23, 1.7], [0.18, 1.78], [0.07, 1.84]], 28);
  const rp = robe.attributes.position;
  for (let k = 0; k < rp.count; k++) {
    const px = rp.getX(k);
    const pz = rp.getZ(k);
    const py = rp.getY(k);
    const a = Math.atan2(pz, px);
    const fold = 1 + Math.sin(a * 9 + Math.sin(a * 3) * 0.6) * 0.06 * Math.max(0, 1 - py / 1.25);
    rp.setXYZ(k, px * fold, py, pz * fold * 0.78 + (py < 0.2 ? 0.04 * (1 - py / 0.2) : 0));
  }
  robe.computeVertexNormals();
  bk.add(m, robe, { p: [x, b, z], uv: 1.5 });
  // head, veiled
  bk.add(m, new THREE.SphereGeometry(0.115, 12, 10), { p: [x, b + 1.97, z + 0.01], s: [0.9, 1.12, 1] });
  bk.add(m, lathe([[0.001, 2.13], [0.08, 2.11], [0.13, 2.04], [0.14, 1.95], [0.16, 1.86], [0.22, 1.78], [0.24, 1.72]], 14, Math.PI * 0.62, Math.PI * 1.76), { p: [x, b, z - 0.01], s: [1, 1, 0.85] });
  // arms: upper arms down the sides, forearms forward under the tray, wide sleeves
  const ty = b + 1.08;
  const tz = z + 0.42;
  for (const s of [-1, 1]) {
    bk.add(m, tube([[x + s * 0.21, b + 1.68, z], [x + s * 0.25, b + 1.4, z + 0.02], [x + s * 0.24, b + 1.12, z + 0.08]], 0.065, 0.06, { seg: 5, radial: 7 }), { uv: 1.5 });
    bk.add(m, tube([[x + s * 0.24, b + 1.12, z + 0.08], [x + s * 0.24, ty - 0.08, z + 0.3], [x + s * 0.24, ty - 0.05, tz + 0.12]], 0.055, 0.045, { seg: 5, radial: 7 }), { uv: 1.5 });
    bk.add(m, lathe([[0.07, 0], [0.1, 0.12], [0.13, 0.24], [0.11, 0.28]], 10), { p: [x + s * 0.24, b + 1.13, z + 0.1], r: [-1.25, 0, 0], s: [1, 1, 0.8], uv: 1.5 });
  }
  // the tray and the cloth over it
  bk.add(m, roundBox(tray, 0.04, 0.56, 0.015), { p: [x, ty, tz], uv: 1 });
  bk.add(mats.velvet, drapeGeo(tray + 0.04, 0.6, 0.26, { folds: 6, depth: 0.03, nx: 30, nz: 10, seed: 5 }), { p: [x, ty + 0.025, tz] });
  return V3(x, ty + 0.03, tz);
}

// The hall of Narsil: a long open gallery, 16 m along x and 5 deep, open to
// +z through a row of slender columns and pointed arches, a leaf-roof over
// it. On the solid back wall, in a carved and gilt frame, the painting of
// Isildur and Sauron (6 m × 3 m); before it a stone statue holding out the
// shards of Narsil on a cloth.
function colonnade(K, { withShards = true } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'colonnade';
  const bk = parts();
  const L = 16;
  const D = 5;
  const y0 = 0.15;
  const colTop = 3.75;
  const HT = 5.55;
  const T = 0.4;
  const fz = D / 2 - 0.3;
  bk.add(mats.elfstone, B(L + 0.6, y0, D + 0.9), { p: [0, y0 / 2, 0.2], uv: 0.5 });
  bk.add(mats.pave, B(L - 0.6, 0.02, D - 0.45), { p: [0, y0 + 0.01, 0.12], uv: 0.45 });
  bk.add(mats.elfstone, B(L, HT - y0, T), { p: [0, (HT + y0) / 2, -D / 2 + T / 2], uv: 0.5 });
  for (const s of [-1, 1]) {
    const opening = { x: 0, y: 0, a: 0.9, hs: 2.4, rise: 1.2 };
    bk.at([s * L / 2, y0, 0], (s * Math.PI) / 2, () => {
      bk.add(mats.elfstone, ext(wallShape(D, HT - y0, [opening]), T), { p: [0, 0, -T], uv: 0.5 });
      archWindow(bk, K, { ...opening, pane: false, sill: false, frame: 0.13 });
    });
  }
  // the columns and the arcade over them
  const xs = [-L / 2 + 0.2];
  for (let k = 1; k < 7; k++) xs.push(-L / 2 + (k * L) / 7);
  xs.push(L / 2 - 0.2);
  for (const x of xs.slice(1, -1)) column(bk, K, { x, y: y0, z: fz, h: colTop - y0, r: 0.16 });
  const band = HT - colTop;
  bk.add(mats.elfstone, ext(arcadeShape(xs, 0.26, band), 0.46), { p: [0, colTop, fz - 0.23], uv: 0.5 });
  for (let i = 0; i < xs.length - 1; i++) {
    const a = (xs[i + 1] - xs[i] - 0.52) / 2;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const rise = bayRise(a, band);
    bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.12, 9, 0.35)), 0.05), { p: [cx, colTop, fz + 0.23], uv: 1 });
    bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.03, 9, 0.35)), 0.065), { p: [cx, colTop, fz + 0.23] });
    archFill(bk, mats.stoneFill, { x: cx, y0: colTop + rise * 0.5, a: a * 0.56, rise: rise * 0.5, z: fz });
  }
  // the ceiling on beams, frieze, cornice, the roof
  bk.add(mats.carve, B(L - 0.2, 0.2, D - 0.3), { p: [0, HT - 0.1, -0.02], uv: 0.5 });
  for (const x of xs.slice(1, -1)) bk.add(mats.elfwood, B(0.15, 0.22, D - 0.9), { p: [x, HT - 0.31, -0.25], uv: 1 });
  bk.add(mats.frieze, friezeGeo(L, 0.36), { p: [0, HT - 0.32, fz + 0.25] });
  bk.add(mats.frieze, friezeGeo(L, 0.36), { p: [0, HT - 0.32, -D / 2 - 0.025] });
  bk.add(mats.carve, roundBox(L + 0.5, 0.2, D + 0.4, 0.04), { p: [0, HT + 0.0, -0.05], uv: 1 });
  roofOn(bk, K, { ridge: 5.0, dx: 3.6, dz: 3.4, rise: 3.0, prof: (q) => Math.pow(1 - q, 1.4), lift: 0.25, tips: 0.5, n: 5, rings: 10, around: 64 }, { p: [0, HT + 0.1, -0.05], finial: 1.2 });

  // the painting in its frame, a carved crest over it
  const mw = 6;
  const mh = 3;
  const my = 2.75;
  const mz = -D / 2 + T;
  bk.add(mats.mural, new THREE.PlaneGeometry(mw, mh), { p: [0, my, mz + 0.012] });
  for (const s of [-1, 1]) {
    bk.add(mats.carve, roundBox(mw + 0.56, 0.26, 0.12, 0.03), { p: [0, my + s * (mh / 2 + 0.13), mz + 0.05], uv: 1 });
    bk.add(mats.carve, roundBox(0.26, mh + 0.04, 0.12, 0.03), { p: [s * (mw / 2 + 0.13), my, mz + 0.05], uv: 1 });
    bk.add(mats.gilt, B(mw + 0.04, 0.035, 0.03), { p: [0, my + s * (mh / 2 + 0.02), mz + 0.1] });
    bk.add(mats.gilt, B(0.035, mh + 0.04, 0.03), { p: [s * (mw / 2 + 0.02), my, mz + 0.1] });
    bk.add(mats.gilt, leafBlade(0.36, 0.14, { curl: 0.4, seg: 3, thick: 0.01 }), { p: [s * (mw / 2 + 0.13), my + mh / 2 + 0.26, mz + 0.06] });
  }
  const crest = { a: 1.4, rise: 0.75 };
  bk.add(mats.carve, ext(shapeOf(archFrame(crest.a, 0, crest.rise, 0.12, 9, 0.5)), 0.1), { p: [0, my + mh / 2 + 0.26, mz], uv: 1 });
  archFill(bk, mats.giltTracery, { y0: my + mh / 2 + 0.26, a: crest.a, rise: crest.rise, kick: 0.5, z: mz + 0.04 });
  bk.add(mats.gilt, leafBlade(0.5, 0.18, { curl: 0.2, seg: 3, thick: 0.01 }), { p: [0, my + mh / 2 + 0.26 + archTop(crest.a, crest.rise, 0.5) + 0.12, mz + 0.06] });
  bk.add(mats.carve, roundBox(mw + 0.8, 0.12, 0.3, 0.03), { p: [0, my - mh / 2 - 0.32, mz + 0.12], uv: 1 });

  // the statue, the shards on its cloth; candle stands either side
  const at = statueParts(bk, K, { x: 0, y: y0, z: -1.2 });
  const flames = [];
  for (const s of [-1, 1]) {
    const x = s * 1.7;
    const z = -1.0;
    bk.add(mats.gilt, lathe([[0.2, 0], [0.2, 0.04], [0.07, 0.1], [0.03, 0.3], [0.025, 1.55], [0.05, 1.6], [0.13, 1.66], [0.14, 1.7], [0.05, 1.7]], 10), { p: [x, y0, z] });
    for (let k = 0; k < 3; k++) flames.push(candleParts(bk, K, x + Math.cos((k / 3) * TAU) * 0.08, y0 + 1.7, z + Math.sin((k / 3) * TAU) * 0.08, 0.9));
  }
  const lamps = [];
  for (const x of [-4.6, 4.6]) {
    bk.add(mats.gilt, cyl(0.012, 0.012, 0.8, 4), { p: [x, HT - 0.62, 0.2] });
    lanternParts(bk, K, x, HT - 1.3, 0.2, 1.1);
    lamps.push(V3(x, HT - 1.3, 0.2));
  }
  bk.build(g);
  let set = null;
  if (withShards) {
    set = shards(K);
    set.group.position.copy(at);
    g.add(set.group);
  }
  return { group: g, mural: { center: V3(0, my, mz + 0.012), w: mw, h: mh }, shardsAt: at, shards: set, lamps, flames, footprint: { w: L, d: D } };
}

// The shards of Narsil as they lay in Rivendell, flat on their cloth: the
// hilt (a grip bound in leather and wire, the cross-guard's arms swept
// towards the blade, a long pommel) with a stump of broken blade, then
// five more pieces of the blade in a row, each broken jagged at both ends.
// Along +x from the pommel, about 1.4 m end to end if put together, the
// flat of the blade up, y = 0 the cloth. Each piece is its own mesh,
// centred on itself, so it can be lifted and moved.
function shards(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'shards';
  const r = rng(41);
  const blade = 1.12; // from the guard to the tip
  const halfW = (d) => mix(0.029, 0.017, d / blade) * (d > blade - 0.12 ? Math.max(0.08, (blade - d) / 0.12) : 1);
  // a piece of blade from d0 to d1 along it, jagged where it broke
  const piece = (d0, d1, jag0, jag1) => {
    const pts = [];
    const steps = 4;
    for (let k = 0; k <= steps; k++) {
      const d = mix(d0, d1, k / steps);
      pts.push([d, -halfW(d)]);
    }
    const end = (d, flip) => {
      const out = [];
      const m = 5;
      for (let k = 1; k < m; k++) {
        const t = k / m;
        out.push([d + (r() - 0.5) * 0.022 * (k % 2 ? 1 : -0.6), mix(-halfW(d), halfW(d), t)]);
      }
      return flip ? out.reverse() : out;
    };
    if (jag1) pts.push(...end(d1, false));
    for (let k = steps; k >= 0; k--) {
      const d = mix(d0, d1, k / steps);
      pts.push([d, halfW(d)]);
    }
    if (jag0) pts.push(...end(d0, true));
    const mid = (d0 + d1) / 2;
    const geo = new THREE.ExtrudeGeometry(shapeOf(pts.map(([x, y]) => [x - mid, y])), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.005, bevelSegments: 1, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.0065 - 0.002, 0);
    // the fuller down the middle
    const fuller = B(d1 - d0 - 0.03, 0.001, 0.009).translate(0, 0.0115, 0);
    const bk = parts();
    bk.add(mats.blade, geo);
    bk.add(mats.fuller, fuller);
    const holder = new THREE.Group();
    bk.build(holder, { shadow: true });
    return { holder, mid };
  };
  const pieces = [];
  // the hilt: pommel, grip, guard, and the stump of blade, all one piece,
  // centred on its own middle
  const gx = 0.27; // the guard, from the pommel's end
  const ay = 0.019; // the hilt's axis above the cloth
  const hc = (gx + 0.19) / 2;
  const hiltPiece = new THREE.Group();
  hiltPiece.name = 'hilt';
  const hk = parts();
  hk.at([-hc, 0, 0], 0, () => {
    hk.add(mats.hiltSteel, lathe([[0.001, 0], [0.012, 0.006], [0.022, 0.02], [0.026, 0.04], [0.02, 0.06], [0.013, 0.07], [0.016, 0.075], [0.012, 0.08]], 10), { p: [0, ay, 0], r: [0, 0, -Math.PI / 2] });
    hk.add(mats.leather, lathe([[0.014, 0], [0.016, 0.02], [0.017, 0.09], [0.016, 0.16], [0.014, 0.175]], 10), { p: [0.078, ay, 0], r: [0, 0, -Math.PI / 2], uv: 8 });
    const wire = [];
    for (let k = 0; k <= 48; k++) {
      const t = k / 48;
      const a = t * TAU * 9;
      wire.push([0.085 + t * 0.16, ay + Math.cos(a) * 0.0175, Math.sin(a) * 0.0175]);
    }
    hk.add(mats.gilt, tube(wire, 0.0018, 0.0018, { seg: 96, radial: 3 }));
    hk.add(mats.hiltSteel, tube([[gx + 0.03, ay, -0.13], [gx + 0.004, ay, -0.08], [gx - 0.006, ay, 0], [gx + 0.004, ay, 0.08], [gx + 0.03, ay, 0.13]], 0.009, 0.009, { seg: 12, radial: 6 }));
    for (const s of [-1, 1]) hk.add(mats.hiltSteel, ball(0.012, 8, 6), { p: [gx + 0.03, ay, s * 0.13] });
    hk.add(mats.hiltSteel, roundBox(0.035, 0.03, 0.05, 0.008), { p: [gx, ay, 0] });
    hk.add(mats.gilt, B(0.012, 0.032, 0.02), { p: [gx, ay, 0] });
  });
  hk.build(hiltPiece);
  const stump = piece(0, 0.17, false, true);
  stump.holder.position.set(gx + 0.015 + stump.mid - hc, ay - 0.0065, 0);
  hiltPiece.add(stump.holder);
  hiltPiece.position.set(hc, 0, 0);
  g.add(hiltPiece);
  pieces.push(hiltPiece);
  // five more, laid after it with small gaps and a little askew
  const cuts = [0.17, 0.37, 0.56, 0.75, 0.93, blade];
  let x = gx + 0.015 + 0.17 + 0.045;
  for (let k = 0; k < 5; k++) {
    const p = piece(cuts[k], cuts[k + 1], true, k < 4);
    const len = cuts[k + 1] - cuts[k];
    p.holder.position.set(x + len / 2, 0, (r() - 0.5) * 0.02);
    p.holder.rotation.y = (r() - 0.5) * 0.08;
    p.holder.name = 'shard' + (k + 1);
    g.add(p.holder);
    pieces.push(p.holder);
    x += len + 0.04;
  }
  // centre the whole row on the origin
  const mid = x / 2;
  for (const p of pieces) p.position.x -= mid;
  return { group: g, pieces, length: x };
}

// ── the kit ──

export function createRivendellKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const stone = elfstoneCanvas(S, 3, { rows: 2, across: 1 });
  const fine = elfstoneCanvas(S, 8, { rows: 1, across: 1, joint: 0 });
  const carving = carvingCanvas();
  const roof = roofCanvas(S);
  const rock = rockCanvas(S, 5);
  const linen = linenCanvas(128);
  // a sky for polished metal and glass to show
  const sky = new THREE.CanvasTexture(skyCanvas());
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.colorSpace = THREE.SRGBColorSpace;
  const tex = {
    stone: T(stone.c),
    stoneN: T(normalFromField(stone.field, S, S, 2), { srgb: false }),
    fine: T(fine.c),
    fineN: T(normalFromField(fine.field, S, S, 1.5), { srgb: false }),
    carving: T(carving.c),
    carvingN: T(normalFromField(carving.field, carving.W, carving.H, 6), { srgb: false }),
    roof: T(roof.c),
    roofN: T(normalFromField(roof.field, S, S, 3), { srgb: false }),
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    linen: T(linen.c, { repeat: [2, 2] }),
    linenN: T(normalFromField(linen.field, 128, 128, 1.5), { srgb: false, repeat: [2, 2] }),
    tracery: T(traceryCanvas()),
    archFill: T(archFillCanvas(), { wrap: false }),
    glass: T(glassCanvas(), { wrap: false }),
    court: T(courtCanvas(), { wrap: false }),
    mural: T(muralCanvas(), { wrap: false }),
    map: T(mapCanvas(), { wrap: false }),
    book: T(bookCanvas(), { wrap: false }),
    rug: T(rugCanvas(), { wrap: false }),
    notes: T(notesCanvas(), { wrap: false }),
    inscription: T(inscriptionCanvas()),
    puff: T(puffCanvas(), { wrap: false }),
    shaft: T(shaftCanvas(), { wrap: false }),
    sky,
  };
  const pave = stoneTextures(renderer, { seed: 44, courses: 4, dark: [170, 156, 134], light: [246, 238, 220], joint: 0.3, relief: 2 });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const traced = { alphaTest: 0.5, side: THREE.DoubleSide };
  Object.assign(mats, {
    // pale warm stone: walls, carved work, a carved frieze, paving
    elfstone: M({ map: tex.stone, normalMap: tex.stoneN, color: 0xf0e4cc, roughness: 0.82 }),
    carve: M({ map: tex.fine, normalMap: tex.fineN, color: 0xfaf0dc, roughness: 0.72 }),
    frieze: M({ map: tex.carving, normalMap: tex.carvingN, normalScale: new THREE.Vector2(1.5, 1.5), color: 0xf2e2c4, roughness: 0.78 }),
    pave: M({ map: pave.map, normalMap: pave.normalMap, color: 0xf2e6cc, roughness: 0.78 }),
    court: M({ map: tex.court, roughness: 0.66 }),
    // bronze-green leaf roofs, gilding, warm wood
    roof: M({ map: tex.roof, normalMap: tex.roofN, color: 0x6e927c, metalness: 0.45, roughness: 0.48, envMap: sky, envMapIntensity: 0.8 }),
    gilt: M({ color: 0xe6b85a, metalness: 0.9, roughness: 0.3, envMap: sky }),
    elfwood: M({ map: K.tex.planks, normalMap: K.tex.planksN, color: 0x7e5434, roughness: 0.6 }),
    soffit: M({ map: K.tex.planks, normalMap: K.tex.planksN, color: 0xa87a52, roughness: 0.75 }),
    // tracery cut through panels and the heads of arches
    tracery: M({ map: tex.tracery, color: 0xf2e4c8, roughness: 0.75, ...traced }),
    stoneFill: M({ map: tex.archFill, color: 0xf2e4c8, roughness: 0.75, ...traced }),
    giltTracery: M({ map: tex.archFill, color: 0xe6b85a, metalness: 0.85, roughness: 0.32, envMap: sky, ...traced }),
    // glass, dark by day, warm at night; the bedroom's full of sun
    pane: M({ map: tex.glass, color: 0x56656e, roughness: 0.1, metalness: 0.3, envMap: sky, emissive: hot(0xffb060, 2.4), emissiveMap: tex.glass, emissiveIntensity: 0 }),
    sunpane: new THREE.MeshBasicMaterial({ map: tex.glass, color: hot(0xfff0d0, 1.9) }),
    shaft: new THREE.MeshBasicMaterial({ map: tex.shaft, color: hot(0xffd49a, 1), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    glow: M({ color: 0xffe6b0, emissive: hot(0xffb04a, 2.8), emissiveIntensity: 0.25, roughness: 0.3 }),
    linen: M({ map: tex.linen, normalMap: tex.linenN, color: 0xfbf8f0, roughness: 0.92 }),
    curtain: M({ map: tex.linen, color: 0xfdf8ee, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }),
    coverlet: M({ map: tex.linen, normalMap: tex.linenN, color: 0xf0e2c0, roughness: 0.9, side: THREE.DoubleSide }),
    velvet: M({ map: tex.linen, color: 0x6e1c1a, roughness: 0.88, side: THREE.DoubleSide }),
    moss: M({ map: tex.linen, color: 0x3e5a3a, roughness: 0.9 }),
    glaze: M({ color: 0xe9e2d2, roughness: 0.28 }),
    leafGold: M({ color: 0xe0a030, roughness: 0.7, side: THREE.DoubleSide }),
    rug: M({ map: tex.rug, roughness: 0.95 }),
    // Bilbo's things
    map: M({ map: tex.map, roughness: 0.9, side: THREE.DoubleSide }),
    book: M({ map: tex.book, roughness: 0.85, side: THREE.DoubleSide }),
    notes: M({ map: tex.notes, roughness: 0.85 }),
    parchment: M({ color: 0xe8d8b0, roughness: 0.85 }),
    redLeather: M({ color: 0x7a1e16, roughness: 0.6 }),
    inkpot: M({ color: 0x1a1a24, roughness: 0.15, metalness: 0.2, envMap: sky }),
    quill: M({ color: 0xf4efe4, roughness: 0.8, side: THREE.DoubleSide }),
    wicker: M({ map: K.tex.thatch, color: 0xc89a5a, roughness: 0.9 }),
    wax: M({ color: 0xf6eedc, roughness: 0.5, emissive: C(0xffb060), emissiveIntensity: 0.15 }),
    flame: new THREE.MeshBasicMaterial({ color: hot(0xffb048, 3) }),
    // the hall of Narsil: the painting, the statue, the shards
    mural: M({ map: tex.mural, roughness: 0.92 }),
    marble: M({ map: tex.fine, normalMap: tex.fineN, color: 0xeae6de, roughness: 0.55 }),
    blade: M({ color: 0xdfe3e8, metalness: 0.9, roughness: 0.18, envMap: sky }),
    fuller: M({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3, envMap: sky }),
    hiltSteel: M({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.28, envMap: sky }),
    leather: M({ map: K.tex.planks, color: 0x3a2214, roughness: 0.75 }),
  });
  K.tex = { ...K.tex, ...tex };
  const shireNight = kit.setNight;
  // dusk and night: windows and lanterns glow
  const setNight = (k) => {
    shireNight(k);
    const t = clamp01(k);
    mats.pane.emissiveIntensity = t;
    mats.glow.emissiveIntensity = mix(0.25, 1, t);
  };
  return {
    ...kit,
    mats,
    K,
    setNight,
    house: () => house(K),
    bedroom: () => bedroom(K),
    pavilion: () => pavilion(K),
    colonnade: (o) => colonnade(K, o),
    shards: () => shards(K),
  };
}
