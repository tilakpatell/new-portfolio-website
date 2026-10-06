// Pieces the courses are made of, on top of the shape kit: rooms with
// doorways, walls between two points, smooth bumps and cliffs for terrain,
// and the noise that keeps a lawn from looking flat. Units are the game's.

export const TAU = Math.PI * 2;
export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const lerp = (a, b, t) => a + (b - a) * t;

// a cheap, smooth, repeatable wobble in about -1…1
export function wobble(x, z, scale = 1) {
  const a = Math.sin(x * 0.0011 * scale + 1.3) * Math.cos(z * 0.0009 * scale - 0.7);
  const b = Math.sin((x + z) * 0.0023 * scale + 2.1) * 0.5;
  const c = Math.cos((x - z * 0.7) * 0.0041 * scale) * 0.25;
  return (a + b + c) / 1.75;
}

// a round hill: h high at its middle, gone by radius r, cosine-shaped
export function bump(x, z, cx, cz, r, h) {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= r) return 0;
  return h * (0.5 + 0.5 * Math.cos((Math.PI * d) / r));
}

// how far outside a rectangle a point is (0 inside)
export function outside(x, z, x0, z0, x1, z1) {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dz = Math.max(z0 - z, 0, z - z1);
  return Math.hypot(dx, dz);
}

// The world's edge: the ground climbs to a cliff `h` high over `ramp`
// past the rectangle Mario plays in, so there's nowhere to go.
export function rim(x, z, [x0, z0, x1, z1], h = 1800, ramp = 500) {
  return h * smooth(outside(x, z, x0, z0, x1, z1) / ramp);
}

// A wall from (x0, z0) to (x1, z1) along one axis, `t` thick on the side
// away from the room (side: +1 or −1 along the normal), from y0 to y1, with
// gaps: [{ from, to, y0, y1 }] along it (from/to in the wall's own run).
export function wall(k, { x0, z0, x1, z1, y0, y1, t = 100, side = 1, mat, gaps = [] }) {
  const alongX = z0 === z1;
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
  const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const fixed = alongX ? z0 : x0;
  const mid = fixed + (side * t) / 2;
  // cut the run at every gap edge, and fill each piece except the gaps' holes
  const cuts = [a0, a1, ...gaps.flatMap((g) => [g.from, g.to])].filter((v) => v >= a0 && v <= a1).sort((a, b) => a - b);
  const runs = [...new Set(cuts)];
  for (let i = 0; i < runs.length - 1; i++) {
    const s = runs[i], e = runs[i + 1];
    if (e - s < 1) continue;
    const c = (s + e) / 2;
    const gap = gaps.find((g) => c > g.from && c < g.to);
    const spans = gap ? [[y0, gap.y0], [gap.y1, y1]] : [[y0, y1]];
    for (const [lo, hi] of spans) {
      if (hi - lo < 1) continue;
      if (alongX) k.box({ x: c, y: lo, z: mid, w: e - s, h: hi - lo, d: t, mat });
      else k.box({ x: mid, y: lo, z: c, w: t, h: hi - lo, d: e - s, mat });
    }
  }
}

// A room: floor, ceiling and the walls round [x0, x1] × [z0, z1] from y up
// h, each wall outside the room's box. `skip` leaves walls out where a
// neighbour's wall already stands, and nothing of this room reaches into it
// (so no two faces lie on each other); `gaps` cuts doorways: { n | s | e | w:
// [gap…] }. Materials: floor, ceil, walls.
export function room(k, { x0, x1, z0, z1, y = 0, h, floor, ceil, walls, skip = [], gaps = {}, t = 100 }) {
  const ext = (key) => (skip.includes(key) ? 0 : t);
  const fx0 = x0 - ext('w'), fx1 = x1 + ext('e'), fz0 = z0 - ext('n'), fz1 = z1 + ext('s');
  k.box({ x: (fx0 + fx1) / 2, y: y - t, z: (fz0 + fz1) / 2, w: fx1 - fx0, h: t, d: fz1 - fz0, mat: floor, side: walls });
  k.box({ x: (fx0 + fx1) / 2, y: y + h, z: (fz0 + fz1) / 2, w: fx1 - fx0, h: t, d: fz1 - fz0, mat: ceil ?? walls, side: walls });
  const runs = {
    n: { x0: fx0, z0, x1: fx1, z1: z0, side: -1 },
    s: { x0: fx0, z0: z1, x1: fx1, z1, side: 1 },
    w: { x0, z0, x1: x0, z1, side: -1 },
    e: { x0: x1, z0, x1, z1, side: 1 },
  };
  for (const [key, wl] of Object.entries(runs)) {
    if (skip.includes(key)) continue;
    wall(k, { ...wl, y0: y, y1: y + h, t, mat: walls, gaps: gaps[key] ?? [] });
  }
}

// actors given no y stand on the terrain's height there
export const settle = (height, list) => list.map((a) => (a.y == null ? { ...a, y: height(a.x, a.z) } : a));
