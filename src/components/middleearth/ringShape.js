// The One Ring's shape, on its own so the universe map's Middle-earth can
// wear it on its orbit (universe/planets.js) without the Ring scene's stage:
// a plain band turned on a lathe, a domed outside and a flat, comfort-fit
// inside. ringGeometry(segments) → { geo, band: the outside's run of v }.

import * as THREE from 'three';

// The band's cross-section, as (radius, height) going round it: up the flat
// inside, over the top edge, down the domed outside, under the bottom edge.
// The outside is its own evenly spaced run, so the letters can sit on it.
const BAND = { inner: 1, outer: 1.17, crown: 0.045, half: 0.2, edge: 0.035 };
function profile() {
  const { inner, outer, crown, half, edge } = BAND;
  const pts = [];
  const IN = 10;
  const ROUND = 6;
  const OUT = 24;
  for (let i = 0; i <= IN; i++) {
    const y = -half + edge + ((half - edge) * 2 * i) / IN;
    pts.push([inner - 0.008 * (1 - (y / half) ** 2), y]);
  }
  const arc = (cx, cy, a0, a1) => {
    for (let i = 1; i < ROUND; i++) {
      const a = a0 + ((a1 - a0) * i) / ROUND;
      pts.push([cx + Math.cos(a) * edge, cy + Math.sin(a) * edge]);
    }
  };
  arc(inner + edge, half - edge, Math.PI, Math.PI / 2);
  const start = pts.length;
  for (let i = 0; i <= OUT; i++) {
    const y = half - ((half * 2) * i) / OUT;
    const k = y / half;
    pts.push([outer - edge + edge * Math.sqrt(Math.max(0, 1 - k ** 8)) + crown * (1 - k * k), y]);
  }
  const end = pts.length - 1;
  arc(inner + edge, -half + edge, -Math.PI / 2, -Math.PI);
  pts.push(pts[0]);
  return { pts, start, end };
}

export function ringGeometry(segments = 512) {
  const { pts, start, end } = profile();
  const geo = new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  // The lathe's v runs along the profile by index; the outside is the run
  // from `start` to `end`, so the letters are painted into that band of v.
  const n = pts.length - 1;
  return { geo, band: [start / n, end / n] };
}
