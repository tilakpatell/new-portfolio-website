// What the Rick and Morty fleet files share (fleetRickmorty.js,
// fleetRickmortyFoes.js, fleetRickmortyFriends.js): glass with someone inside,
// things that bob and turn, gears, rust, a smooth lofted hull and the paint on
// it, a Morty at the controls, and the Federation's livery. See
// trafficModels.js for how a model is put together.

import * as THREE from 'three';
import { part, upright, canvasTexture, grey, panelTexture, standard, glowMaterial } from './trafficKit';

const { PI, sin, cos, abs, atan2 } = Math;

// See-through glass for a dome with someone inside: tinted, glossy, both
// faces drawn (the far side shows through the near). Not too sharp a gloss,
// or the sun's highlight on it blooms. Both faces in one pass: the same tint
// over the same tint looks the same in either order, and two passes would
// work its shader's settings out again twice a frame.
export const bubble = (k, color, opacity = 0.26) =>
  k.own(new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity, roughness: 0.18, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.22, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false }));

// Bobbing: lift every vertex of the parts with a given mark by dy (the
// family in the saucer), sending the positions again only when asked.
export function bobber(geo) {
  const pos = geo.attributes.position;
  const p0 = pos.array.slice();
  return (mark, dy) => {
    for (const [start, n] of geo.userData.marks[mark] ?? []) {
      for (let i = start; i < start + n; i++) pos.array[i * 3 + 1] = p0[i * 3 + 1] + dy;
    }
    pos.needsUpdate = true;
  };
}

// Turning in place: spin every vertex of the parts with a given mark about
// an upright axis through (cx, cz) (the little gears on the gear ship's
// deck, all in one mesh).
export function turner(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const p0 = pos.array.slice();
  const n0 = nor.array.slice();
  return (mark, angle, cx, cz) => {
    const c = cos(angle);
    const s = sin(angle);
    for (const [start, n] of geo.userData.marks[mark] ?? []) {
      for (let i = start; i < start + n; i++) {
        const dx = p0[i * 3] - cx;
        const dz = p0[i * 3 + 2] - cz;
        pos.array[i * 3] = cx + dx * c - dz * s;
        pos.array[i * 3 + 2] = cz + dx * s + dz * c;
        const nx = n0[i * 3];
        const nz = n0[i * 3 + 2];
        nor.array[i * 3] = nx * c - nz * s;
        nor.array[i * 3 + 2] = nx * s + nz * c;
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  };
}

// A small sphere with few facets (eyes, lamps, rivet heads): w round, h down.
export const bead = (r, at, scale = 1, o = {}, w = 6, h = 4) => part(new THREE.SphereGeometry(r, w, h), { at, scale, ...o });

export const polar = (r, a) => [r * cos(a), r * sin(a)];
export const circle = (r, n = 32) => Array.from({ length: n }, (_, i) => polar(r, (i / n) * PI * 2));

// A gear's outline in (x, z): n teeth between the root and tip radii, one
// pointing along +x (turned by `phase`).
export function gearOutline(rRoot, rTip, n, phase = 0) {
  const pts = [];
  const step = (PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = phase + i * step;
    pts.push(polar(rRoot, a - step * 0.28), polar(rTip, a - step * 0.15), polar(rTip, a + step * 0.15), polar(rRoot, a + step * 0.28));
  }
  return pts;
}

// The windows between a gear's spokes: n of them between radii r0 and r1,
// each spoke `spoke` wide.
export function spokeHoles(n, r0, r1, spoke) {
  const holes = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * PI * 2;
    const a1 = ((i + 1) / n) * PI * 2;
    const go = spoke / r1 / 2;
    const gi = spoke / r0 / 2;
    const h = [];
    for (let j = 0; j <= 5; j++) h.push(polar(r1, a0 + go + (a1 - a0 - 2 * go) * (j / 5)));
    for (let j = 2; j >= 0; j--) h.push(polar(r0, a0 + gi + (a1 - a0 - 2 * gi) * (j / 2)));
    holes.push(h);
  }
  return holes;
}

// Plating that's seen better days: panels of slightly different greys with
// dark seams and rivets, and rust (orange-brown blotches gathered along the
// seams, streaks running down from them) and grime over it all. Grey and
// brown, so the paint's colour shows through.
export function rustTexture(rand) {
  return canvasTexture(256, (g, S) => {
    g.fillStyle = grey(214);
    g.fillRect(0, 0, S, S);
    const rows = 4;
    const h = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rand() * 60;
      while (x < S) {
        const w = 70 + rand() * 90;
        g.fillStyle = grey(196 + rand() * 40);
        g.fillRect(x, r * h, w, h);
        g.fillStyle = grey(120);
        g.fillRect(x, r * h, 1.5, h);
        g.fillStyle = grey(110);
        for (let y = r * h + 5; y < (r + 1) * h - 2; y += 9) g.fillRect(x + 4, y, 2, 2);
        x += w;
      }
      g.fillStyle = grey(105);
      g.fillRect(0, r * h, S, 1.5);
    }
    for (let i = 0; i < 28; i++) {
      const x = rand() * S;
      const y = Math.floor(rand() * rows) * h + (rand() - 0.3) * 8;
      const r = 2 + rand() * 8;
      g.fillStyle = `rgba(${120 + rand() * 40},${55 + rand() * 25},${20},${0.18 + rand() * 0.25})`;
      for (const dx of [-S, 0, S]) {
        g.beginPath();
        g.ellipse(x + dx, y, r * 1.4, r, 0, 0, PI * 2);
        g.fill();
      }
      const grad = g.createLinearGradient(0, y, 0, y + 20 + rand() * 30);
      grad.addColorStop(0, 'rgba(110,50,18,0.3)');
      grad.addColorStop(1, 'rgba(110,50,18,0)');
      g.fillStyle = grad;
      g.fillRect(x - 1.5, y, 2 + rand() * 3, 50);
    }
    for (let i = 0; i < 250; i++) {
      g.fillStyle = `rgba(30,25,20,${rand() * 0.12})`;
      g.fillRect(rand() * S, rand() * S, 1 + rand() * 3, 1 + rand() * 3);
    }
  });
}

// A rounded hull, lofted through sections as the kit's loft() is (each
// { z, pts }, all the same length, anticlockwise from the front, in order
// of z), but with each point shared by the faces round it, so it shades
// smooth where loft() shades faceted: the show draws its craft in curves.
// Capped flat at an end unless the end comes to a point.
export function smoothLoft(sections) {
  const n = sections[0].pts.length;
  const pos = [];
  const idx = [];
  for (const s of sections) for (const [x, y] of s.pts) pos.push(x, y, s.z);
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * n + j;
      const b = i * n + ((j + 1) % n);
      idx.push(a, b, b + n, a, b + n, a + n);
    }
  }
  for (const [s, dir] of [
    [sections[0], -1],
    [sections.at(-1), 1],
  ]) {
    const contour = s.pts.map(([x, y]) => new THREE.Vector2(x, y));
    if (abs(THREE.ShapeUtils.area(contour)) < 1e-6) continue;
    const base = pos.length / 3;
    for (const [x, y] of s.pts) pos.push(x, y, s.z);
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const [pa, pb, pc] = [s.pts[a], s.pts[b], s.pts[c]];
      const z = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
      idx.push(base + a, ...(z * dir >= 0 ? [base + b, base + c] : [base + c, base + b]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A section for smoothLoft(): n points round from the bottom, w wide,
// reaching up above y and down below it; an ellipse when p is 2, squarer
// as p grows.
export function oval(w, up, down = up, y = 0, n = 20, p = 2) {
  return Array.from({ length: n }, (_, i) => {
    const a = -PI / 2 + (i / n) * PI * 2;
    const c = cos(a);
    const s = sin(a);
    return [(w / 2) * Math.sign(c) * abs(c) ** (2 / p), y + (s > 0 ? up : down) * Math.sign(s) * abs(s) ** (2 / p)];
  });
}

// For a hull of oval() rings, its rows [z, r] and the ring's proportions to
// r in `shape` ([half its width, up, down, p]): how far round a ring a
// point is, from -PI / 2 underneath to PI / 2 on top, to paint it by; and
// (its rings taken as ellipses) a part set into its skin at z, a way round,
// facing out of it and lifted off it by `lift`: an eye, a lamp.
export const roundOf = ([wr, ur, dr, p = 2], x, y) => atan2(Math.sign(y) * abs(y / (y > 0 ? ur : dr)) ** (p / 2), abs(x / wr) ** (p / 2));
export function onHull(g, rows, [wr, ur, dr], z, a, { lift = 0, scale = 1, ...o } = {}) {
  const P = (zz, aa) => {
    const [, r] = measure(rows, zz);
    const s = sin(aa);
    return new THREE.Vector3(r * wr * cos(aa), r * (s > 0 ? ur : dr) * s, zz);
  };
  const p = P(z, a);
  const n = P(z, a + 0.002).sub(p).cross(P(z + 0.002, a).sub(p)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  return part(g, { m: new THREE.Matrix4().compose(p.addScaledVector(n, lift), q, new THREE.Vector3(...s)), ...o });
}

// A hull's measurements anywhere along it: `rows` [[z, …], …] in order of
// z, every value in between them in proportion.
export function measure(rows, z) {
  let i = 0;
  while (i < rows.length - 2 && z > rows[i + 1][0]) i++;
  const [a, b] = [rows[i], rows[i + 1]];
  const f = (z - a[0]) / (b[0] - a[0]);
  return a.map((v, j) => v + (b[j] - v) * f);
}

// A hull cut up for painting after it's been shaded whole, so it shades as
// smoothly across a seam as anywhere: each of `coats` [test, colour] takes
// the triangles whose middles pass test(x, y, z) that no coat before it
// took, and the rest are `rest`; a part for each colour. (A seam falls
// cleanly where a test changes between two rings, or between two points
// round them.)
export function painted(g, coats, rest) {
  const src = g.index ? g.toNonIndexed() : g;
  const P = src.attributes.position.array;
  const N = src.attributes.normal.array;
  const tris = Array.from({ length: coats.length + 1 }, () => []);
  for (let i = 0; i < P.length; i += 9) {
    const x = (P[i] + P[i + 3] + P[i + 6]) / 3;
    const y = (P[i + 1] + P[i + 4] + P[i + 7]) / 3;
    const z = (P[i + 2] + P[i + 5] + P[i + 8]) / 3;
    const c = coats.findIndex(([test]) => test(x, y, z));
    tris[c < 0 ? coats.length : c].push(i);
  }
  g.dispose();
  return tris.flatMap((list, c) => {
    if (!list.length) return [];
    const geo = new THREE.BufferGeometry();
    for (const [name, from] of [
      ['position', P],
      ['normal', N],
    ]) {
      const a = new Float32Array(list.length * 9);
      list.forEach((i, t) => a.set(from.subarray(i, i + 9), t * 9));
      geo.setAttribute(name, new THREE.BufferAttribute(a, 3));
    }
    return [part(geo, { color: c < coats.length ? coats[c][1] : rest })];
  });
}

// A Morty at the controls: his round head, the brown hair over the top and
// back of it, the big eyes, his yellow shirt's shoulders below. Evil Morty
// wears his patch over his right eye, its strap round his head.
export function mortyPilot([x, y, z], r, patch = false) {
  const L = [];
  L.push(part(upright([[0.0001, -r * 2], [r * 1.3, -r * 1.95], [r * 1.35, -r * 1.4], [r * 1.05, -r * 1.05], [r * 0.45, -r * 0.85]], 12), { at: [x, y, z], scale: [1, 1, 0.8], color: '#f2cf3a' }));
  L.push(bead(r, [x, y, z], [1, 0.95, 0.95], { color: '#f4d2ae' }, 14, 10));
  L.push(part(new THREE.SphereGeometry(r * 1.07, 14, 6, 0, PI * 2, 0, PI * 0.55), { at: [x, y + r * 0.05, z - r * 0.12], rot: [-0.5, 0, 0], color: '#6b3f1d' }));
  for (const sx of [-1, 1]) {
    const eye = [x + sx * r * 0.38, y + r * 0.08, z + r * 0.83];
    if (patch && sx < 0) {
      L.push(bead(r * 0.38, eye, [1, 0.95, 0.45], { color: '#111114' }, 8, 5));
      continue;
    }
    L.push(bead(r * 0.32, eye, [1, 1.1, 0.5], { color: '#ffffff' }, 8, 5));
    L.push(bead(r * 0.1, [eye[0], eye[1], eye[2] + r * 0.15], 1, { color: '#111111' }, 5, 3));
  }
  if (patch) {
    // the strap: from the patch up across his brow and round the back
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.34, 0.91, -0.22).normalize());
    L.push(part(new THREE.TorusGeometry(r * 1.02, r * 0.07, 3, 18), { m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 0.95, 0.95)), color: '#111114' }));
  }
  return L;
}

// The Galactic Federation's livery, as on their patrol fighters
// (trafficModels.js's patrol): white plating, grey and dark parts, the blue
// it's painted with here and there and the blue it's lit with.
export const FED = { white: '#dde1e6', grey: '#8c939c', dark: '#363b43', blue: '#2d5fae' };
export const FED_BLUE = [0.5, 2.1, 5.6];
export const FED_JET = [0.8, 2.6, 6.4];
export function fedMaterials(k, density = 5) {
  const paint = standard(k, { map: k.own(panelTexture(k.rand, { base: 232, spread: 8, seam: 0.72, detail: 0.15, min: 18 })), metalness: 0.2, roughness: 0.4 });
  paint.userData.density = density;
  return {
    paint,
    metal: standard(k, { metalness: 0.8, roughness: 0.35 }),
    glass: standard(k, { color: '#1d4f8f', metalness: 0.85, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
}
