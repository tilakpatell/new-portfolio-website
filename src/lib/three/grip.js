// Fingers closed round a grip. Meshy's skeleton stops at the wrist: a hand
// is one bone, its fingers sculpted straight out in the pose it was made
// in, so a gun set in the palm sat in an open hand (and Meshy's rigging
// can't add finger bones). Here the fingers are bent round the grip by a
// morph target worked out once from the hand's own vertices, the way a
// bend deformer does it (Barr's bend; Blender's Simple Deform): past the
// knuckles each point is wrapped round a circle whose centre is the grip's
// middle, keeping its length along the finger, so the fingers close on it
// together (four as one, which at the distance anyone sees them reads as a
// grip). The thumb, where it stands out from the fingers, is left as it
// was sculpted (swung on its own it tore away from the palm on some of the
// cast). Morphs are applied before skinning, so the curl holds whatever
// the clip and the arm's reach are doing.
//
// It goes on a geometry of the armed figure's own that shares the model's
// vertex data: the other figures cloned from the same model keep the plain
// one, with no morphs. The curl for a model and a gun is made once and
// shared by every figure of that model holding that gun.
//
// bendFinger(p, n, K): a point (and its normal, or null) in the hand's
//   space, bent in place. K: { along, normal } the bend's frame (the
//   finger's line, and out of the palm), origin (optional) the knuckle's
//   middle, s0 how far along from it the bend starts, yc the finger
//   plate's middle (along `normal`), rho the bend's radius (to that
//   middle), max the most it turns (radians), after which it runs on
//   straight, rMin (optional) the nearest the bend's centre any point comes
//   (a finger's pad pressed flat on the grip rather than into it).
// handShape(points, frame, { knuckle }) → the hand as its vertices have it
//   (in its frame { along, thumb, normal }): s0 the knuckle line along
//   `along` (where the hand thins, or `knuckle` of the way out), lo/hi
//   its extent, the finger line (`fingers`, `palm`, `origin`, tilted from
//   `along` by `tilt` toward the palm), yc and half the finger plate's
//   middle and half its thickness, the thumb's edge (cEdge, band, cMid
//   the fingers' middle across) and `thumb`, the points past it (a Set of
//   indices; empty when no thumb stands out).
// gripMorphs(root, hands, key) → { set({ R, L }), shape: { R, L }, dispose() }
//   or null: `hands` [{ bone, frame, side: 'R' | 'L', radius, knuckle? }]
//   in the bone's space as the figure stands (call it in the pose the
//   frames were measured in), `radius` the grip's, in the same units;
//   `shape[side].centre` is where the grip's middle goes (the bend's
//   centre, across the fingers' middle). `key` names the curl (the gun).

import * as THREE from 'three';

const V = THREE.Vector3;
const MAX = Math.PI + 0.6; // the most a fingertip turns; past it, on straight

const _r = new V();

export function bendFinger(p, n, K) {
  const u = K.along;
  const nn = K.normal;
  const rel = K.origin ? _r.subVectors(p, K.origin) : _r.copy(p);
  const s = rel.dot(u);
  const d = s - (K.s0 ?? 0);
  if (d <= 0) return p;
  const y = rel.dot(nn);
  const max = K.max ?? MAX;
  let phi = d / K.rho;
  let extra = 0;
  if (phi > max) {
    extra = (phi - max) * K.rho;
    phi = max;
  }
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  let r = K.rho - (y - K.yc); // its distance from the bend's centre
  if (K.rMin != null && r < K.rMin) r += (K.rMin - r) * Math.min(1, phi / 0.5); // (pressed onto the grip, from the knuckle on)
  const s2 = (K.s0 ?? 0) + r * sn + extra * c;
  const y2 = K.yc + K.rho - r * c + extra * sn;
  p.addScaledVector(u, s2 - s).addScaledVector(nn, y2 - y);
  if (n) {
    const a = n.dot(u);
    const b = n.dot(nn);
    n.addScaledVector(u, a * c - b * sn - a).addScaledVector(nn, a * sn + b * c - b);
  }
  return p;
}

const pct = (values, f) => {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(f * (sorted.length - 1))))];
};
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function handShape(points, frame, { knuckle = null } = {}) {
  const { along, thumb, normal } = frame;
  const A = points.map((p) => p.dot(along));
  const C = points.map((p) => p.dot(thumb));
  const N = points.map((p) => p.dot(normal));
  const lo = Math.max(0, pct(A, 0.01));
  const hi = pct(A, 0.99);
  const L = Math.max(1e-9, hi - lo);
  // the knuckles: where the hand thins from the palm to the fingers (the
  // biggest drop in its thickness, 0.4…0.75 of the way out), or a palm's
  // usual share of the hand
  let at = knuckle;
  if (at == null) {
    const B = 20;
    const bins = Array.from({ length: B }, () => []);
    A.forEach((a, i) => {
      const b = Math.floor(((a - lo) / L) * B);
      if (b >= 0 && b < B) bins[b].push(N[i]);
    });
    const thick = bins.map((n) => (n.length > 5 ? pct(n, 0.95) - pct(n, 0.05) : NaN));
    const sm = thick.map((t, b) => {
      const w = [thick[b - 1], t, thick[b + 1]].filter(Number.isFinite);
      return w.length ? w.reduce((s, x) => s + x, 0) / w.length : NaN;
    });
    let best = -1;
    let drop = 0.25;
    for (let b = 8; b <= 15; b++) {
      const d = (sm[b - 1] - sm[b + 1]) / sm[b - 1];
      if (d > drop) {
        drop = d;
        best = b;
      }
    }
    at = best >= 0 ? best / B : 0.55;
  }
  const s0 = lo + at * L;
  // the thumb: past the thumb-side edge of the fingers well out from the knuckles
  const far = s0 + 0.4 * (hi - s0);
  const distal = [];
  A.forEach((a, i) => a > far && distal.push(C[i]));
  const cEdge = pct(distal, 0.97);
  const cLo = pct(distal, 0.03);
  const band = 0.04 * L;
  const thumbs = new Set();
  C.forEach((c, i) => c > cEdge && thumbs.add(i));
  if (thumbs.size < Math.max(8, points.length * 0.01)) thumbs.clear();
  // the fingers' line, in the plane along the fingers and out of the palm
  // (they're seldom sculpted straight out along the bone)
  const fa = [];
  const fn = [];
  A.forEach((a, i) => {
    if (a > s0 && !thumbs.has(i)) {
      fa.push(a);
      fn.push(N[i]);
    }
  });
  let tilt = 0;
  let ma = s0;
  let mn = 0;
  if (fa.length > 8) {
    ma = fa.reduce((s, x) => s + x, 0) / fa.length;
    mn = fn.reduce((s, x) => s + x, 0) / fn.length;
    let saa = 0;
    let snn = 0;
    let san = 0;
    for (let k = 0; k < fa.length; k++) {
      saa += (fa[k] - ma) ** 2;
      snn += (fn[k] - mn) ** 2;
      san += (fa[k] - ma) * (fn[k] - mn);
    }
    tilt = Math.max(-0.9, Math.min(0.9, 0.5 * Math.atan2(2 * san, saa - snn)));
  }
  const fingers = new V().addScaledVector(along, Math.cos(tilt)).addScaledVector(normal, Math.sin(tilt));
  const palm = new V().addScaledVector(along, -Math.sin(tilt)).addScaledVector(normal, Math.cos(tilt));
  const origin = new V().addScaledVector(along, s0).addScaledVector(normal, mn + Math.tan(tilt) * (s0 - ma));
  // the finger plate's middle and thickness, across that line
  const h = [];
  points.forEach((p, i) => {
    if (A[i] > s0 && !thumbs.has(i)) h.push(_r.subVectors(p, origin).dot(palm));
  });
  const yc = (pct(h, 0.1) + pct(h, 0.9)) / 2;
  const tF = Math.min(0.3 * L, Math.max(0.1 * L, pct(h, 0.9) - pct(h, 0.1))); // (the palm side's skin then wraps at the grip's radius)
  return { s0, lo, hi, tilt, fingers, palm, origin, yc, half: tF / 2, cEdge, cLo, cMid: (cLo + cEdge) / 2, band, thumb: thumbs };
}

// ── On a figure ──

// what each curl made of its hand (for checking: the preview sheet shows it)
export const checks = [];
const cache = new WeakMap(); // the model's geometry → key → { geo, shape } (or null: no curl)
const sourceOf = new WeakMap(); // a curl's geometry → the model's

// the curled copy of `mesh`'s geometry for `hands`, or null
function build(mesh, src, hands) {
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const si = src.attributes.skinIndex;
  const sw = src.attributes.skinWeight;
  if (!pos || !si || !sw || Object.keys(src.morphAttributes).length) return null;
  mesh.updateWorldMatrix(true, false);
  const count = pos.count;
  const targets = [];
  const shapes = {};
  const g0 = new V();
  const nv = new V();
  for (const h of hands) {
    const bi = mesh.skeleton.bones.indexOf(h.bone);
    if (bi < 0) continue;
    // the geometry's space to the hand's as it stands (as it's skinned there), and back
    h.bone.updateWorldMatrix(true, false);
    const A = new THREE.Matrix4()
      .copy(h.bone.matrixWorld)
      .invert()
      .multiply(mesh.matrixWorld)
      .multiply(mesh.bindMatrixInverse)
      .multiply(h.bone.matrixWorld)
      .multiply(mesh.skeleton.boneInverses[bi])
      .multiply(mesh.bindMatrix);
    const back = A.clone().invert();
    const nA = new THREE.Matrix3().getNormalMatrix(A);
    const nBack = new THREE.Matrix3().getNormalMatrix(back);
    // the vertices on this hand, how much, and where (the hand's space)
    const idx = [];
    const wts = [];
    const pts = [];
    for (let i = 0; i < count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi) w += sw.getComponent(i, k);
      if (w < 0.01) continue;
      idx.push(i);
      wts.push(Math.min(1, w));
      pts.push(new V().fromBufferAttribute(pos, i).applyMatrix4(A));
    }
    const firm = pts.filter((_, j) => wts[j] >= 0.5);
    if (firm.length < 24) continue;
    const { along, thumb } = h.frame;
    const shape = handShape(firm, h.frame, { knuckle: h.knuckle ?? null });
    const rho = h.radius + shape.half;
    const K = { along: shape.fingers, normal: shape.palm, origin: shape.origin, s0: 0, yc: shape.yc, rho, max: h.max ?? MAX, rMin: h.radius * 0.9 };
    const hasThumb = shape.thumb.size > 0;
    const L = shape.hi - shape.lo;
    const centre = shape.origin.clone().addScaledVector(shape.palm, shape.yc + rho).addScaledVector(thumb, shape.cMid);

    const dp = new Float32Array(count * 3);
    const dn = nor ? new Float32Array(count * 3) : null;
    let moved = 0;
    let through = 0;
    let worst = 0;
    for (let j = 0; j < idx.length; j++) {
      const p = pts[j];
      // (the fingers bend from the knuckles, the bend easing in across a
      // band past them so there's no seam where it starts; the thumb, from a
      // little past the fingers' edge, stays)
      const from = smooth((p.dot(along) - shape.s0) / (2 * shape.band));
      if (from <= 0) continue;
      const keep = from * (hasThumb ? 1 - smooth((p.dot(thumb) - shape.cEdge) / shape.band - 0.5) : 1);
      if (keep <= 0) continue;
      const i = idx[j];
      const n0 = nor ? new V().fromBufferAttribute(nor, i) : null;
      const n = n0 ? nv.copy(n0).applyMatrix3(nA).normalize() : null;
      const q = bendFinger(p.clone(), n, K);
      const k = keep * wts[j];
      const dist = q.distanceTo(p);
      if (dist < 1e-9) continue;
      moved++;
      worst = Math.max(worst, dist);
      // (into the grip: nearer its middle than 0.4 of its radius)
      const off = _r.subVectors(q, centre);
      if (Math.hypot(off.dot(shape.fingers), off.dot(shape.palm)) < 0.4 * h.radius) through++;
      const g1 = q.applyMatrix4(back);
      g0.fromBufferAttribute(pos, i);
      dp[i * 3] = (g1.x - g0.x) * k;
      dp[i * 3 + 1] = (g1.y - g0.y) * k;
      dp[i * 3 + 2] = (g1.z - g0.z) * k;
      if (n) {
        n.applyMatrix3(nBack).normalize().multiplyScalar(n0.length() || 1);
        dn[i * 3] = (n.x - n0.x) * k;
        dn[i * 3 + 1] = (n.y - n0.y) * k;
        dn[i * 3 + 2] = (n.z - n0.z) * k;
      }
    }
    // a hand this doesn't make sense of stays open
    const bad = !moved || !(worst <= 0.9 * L) || through > moved * 0.05 || dp.some(Number.isNaN);
    checks.push({ mesh: mesh.name, side: h.side, ok: !bad, moved, worst: +(worst / L).toFixed(2), through: +(through / Math.max(1, moved)).toFixed(3), thumb: shape.thumb.size, firm: firm.length, knuckle: +((shape.s0 - shape.lo) / L).toFixed(2), tilt: +shape.tilt.toFixed(2) });
    if (bad) continue;
    shapes[h.side] = { s0: shape.s0, tilt: shape.tilt, yc: shape.yc, half: shape.half, rho, lo: shape.lo, hi: shape.hi, thumb: hasThumb, centre, moved };
    const name = `grip${h.side}`;
    const tp = new THREE.Float32BufferAttribute(dp, 3);
    tp.name = name;
    const tn = dn ? new THREE.Float32BufferAttribute(dn, 3) : null;
    if (tn) tn.name = name;
    targets.push({ tp, tn });
  }
  if (!targets.length) return null;

  // the model's geometry, its data shared, with the curls added
  const geo = new THREE.BufferGeometry();
  geo.name = src.name;
  geo.setIndex(src.index);
  sync(geo, src);
  for (const g of src.groups) geo.addGroup(g.start, g.count, g.materialIndex);
  geo.setDrawRange(src.drawRange.start, src.drawRange.count);
  if (src.boundingBox) geo.boundingBox = src.boundingBox.clone();
  if (src.boundingSphere) geo.boundingSphere = src.boundingSphere.clone();
  geo.morphTargetsRelative = true;
  geo.morphAttributes.position = targets.map((t) => t.tp);
  if (nor) geo.morphAttributes.normal = targets.map((t) => t.tn);
  sourceOf.set(geo, src);
  // The two share their vertex buffers on the graphics chip: whichever is
  // freed, the other lets go of what it held too (and both send theirs
  // again the next time they're drawn), so neither is left drawing from a
  // buffer that's gone.
  let freeing = false;
  const pair = (a, b) =>
    a.addEventListener('dispose', () => {
      if (freeing) return;
      freeing = true;
      try {
        b.dispose();
      } finally {
        freeing = false;
      }
    });
  pair(geo, src);
  pair(src, geo);
  return { geo, shape: shapes };
}

// whatever the model's geometry has gained since (a dress's zones, an
// outline's normals), the curl's has too
function sync(geo, src) {
  for (const k in src.attributes) if (geo.attributes[k] !== src.attributes[k]) geo.setAttribute(k, src.attributes[k]);
  if (geo.index !== src.index) geo.setIndex(src.index);
}

export function gripMorphs(root, hands, key) {
  hands = hands.filter((h) => h?.bone && h.frame && h.radius > 0);
  if (!hands.length) return null;
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton && hands.some((h) => o.skeleton.bones.includes(h.bone))) meshes.push(o);
  });
  const changed = [];
  const shape = {};
  for (const mesh of meshes) {
    const src = sourceOf.get(mesh.geometry) ?? mesh.geometry;
    if (!cache.has(src)) cache.set(src, new Map());
    const mine = cache.get(src);
    let made = mine.get(key);
    if (made === undefined) {
      made = build(mesh, src, hands);
      mine.set(key, made);
    }
    if (!made) continue;
    sync(made.geo, src);
    for (const [side, s] of Object.entries(made.shape)) shape[side] ??= s;
    changed.push({ mesh, src, geo: made.geo, influences: mesh.morphTargetInfluences, dictionary: mesh.morphTargetDictionary });
    mesh.geometry = made.geo;
    mesh.updateMorphTargets();
  }
  if (!changed.length) return null;
  return {
    shape,
    set(w) {
      for (const c of changed) {
        const { mesh } = c;
        if (mesh.geometry !== c.geo) continue;
        sync(c.geo, c.src);
        const d = mesh.morphTargetDictionary;
        const f = mesh.morphTargetInfluences;
        if (w.R !== undefined && d.gripR !== undefined) f[d.gripR] = w.R;
        if (w.L !== undefined && d.gripL !== undefined) f[d.gripL] = w.L;
      }
    },
    // the figure's plain geometry back (the curl stays made, for the next)
    dispose() {
      for (const c of changed) {
        if (c.mesh.geometry !== c.geo) continue;
        c.mesh.geometry = c.src;
        c.mesh.morphTargetInfluences = c.influences;
        c.mesh.morphTargetDictionary = c.dictionary;
      }
      changed.length = 0;
    },
  };
}

// put back the plain geometry on any of `root`'s meshes still wearing a
// curl (before measuring the hands again: what's measured is as drawn)
export function ungrip(root) {
  root.traverse((o) => {
    const src = o.isMesh ? sourceOf.get(o.geometry) : null;
    if (!src) return;
    o.geometry = src;
    o.morphTargetInfluences = undefined;
    o.morphTargetDictionary = undefined;
  });
}
