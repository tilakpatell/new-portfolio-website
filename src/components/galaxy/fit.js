// The galaxy's worlds, grown to be bigger than the ships round them: a
// fighter is tiny next to a Star Destroyer, a Star Destroyer is small next
// to the Executor, and the Executor (or the second Death Star) is small next
// to the planet it's over. systems.js's numbers were set for the look of
// each moment from the films, and some of its ships came out longer than
// their planet's wide (the Executor over Hoth, the second Death Star over
// Endor's moon); fitSystem grows the planet (and its moons) till it's at
// least FIT.ratio times as wide as the longest ship or station near it is
// long, and moves everything off the surface out with it, so each thing is
// as far off the surface as it was and fleets keep their formation. The
// ships stay their size (the universe map's scale: an X-wing about 0.26 long,
// a Star Destroyer about 30).
//
// Pure (tested). biggest(sys) → the longest thing its pieces build;
// outward(d, r, k) → where something `d` from the middle of a world of
// radius `r` goes when the world's grown `k` times; fitSystem(sys) → the
// system grown (a copy), or the same one if it's big enough already.

export const FIT = {
  ratio: 1.25, // a world at least this many times as wide as the longest ship near it is long
  superlaser: 64, // the Death Star that drops in to fire at Scarif (world.js builds it this size)
  farthest: 7600, // a gas giant pushed out no further than this (the camera sees to space.js's FAR, from the far edge too)
};

// the longest ship or station a system's pieces build
export function biggest(sys) {
  let most = 0;
  const see = (v) => {
    if (typeof v === 'number' && v > most) most = v;
  };
  for (const p of sys.pieces ?? []) {
    if (p.type === 'fleet') p.ships.forEach((s) => see(s.size));
    else if (p.type === 'battle') Object.values(p.sides).forEach((list) => list.forEach((s) => see(s.size)));
    else if (p.type === 'deathstar') see(p.r * 2);
    else if (p.type === 'superlaser') see(FIT.superlaser);
    else if (p.type === 'chase') (see(p.runner.size), see(p.hunter.size));
    else if (p.type === 'station' || p.type === 'escape' || p.type === 'depart' || p.type === 'liftoff') see(p.size);
  }
  return most;
}

// what's inside the world's old radius grows with it; what's outside is moved
// out by as much as the surface was, so it's as far off it as it was
export const outward = (d, r, k) => (k === 1 ? d : d < r ? d * k : d + r * (k - 1));

// how far a formation must go out along `u` (a unit vector) for every ship in
// it (their places, `pts`) to be at least as far off the grown surface as it
// was off the old one: out by the surface's own move, more for the ships off to
// the side of the way out
export function shiftFor(pts, u, r, k) {
  const grow = r * (k - 1);
  let most = grow;
  for (const q of pts) {
    const d = Math.hypot(q[0], q[1], q[2]);
    const qu = q[0] * u[0] + q[1] * u[1] + q[2] * u[2];
    most = Math.max(most, -qu + Math.sqrt(qu * qu + 2 * d * grow + grow * grow));
  }
  return most;
}
const unit = (p) => {
  const d = Math.hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / d, p[1] / d, p[2] / d];
};

const along = (p, r, k) => {
  const d = Math.hypot(p[0], p[1], p[2]);
  if (d < 1e-9) return [...p];
  const m = outward(d, r, k) / d;
  return [p[0] * m, p[1] * m, p[2] * m];
};

export function fitSystem(sys) {
  const r = sys.body?.r;
  if (!r) return sys;
  const want = biggest(sys) * FIT.ratio;
  if (want <= r) return sys;
  const k = want / r;
  const pt = (p) => along(p, r, k);
  const pieces = sys.pieces.map((p) => {
    switch (p.type) {
      case 'fleet': {
        // the fleet moved out as one (a formation stays one), from its middle
        const c = [0, 1, 2].map((i) => p.ships.reduce((s, o) => s + o.at[i], 0) / p.ships.length);
        const u = unit(c);
        const m = shiftFor(p.ships.map((o) => o.at), u, r, k);
        return { ...p, ships: p.ships.map((s) => ({ ...s, at: [s.at[0] + u[0] * m, s.at[1] + u[1] * m, s.at[2] + u[2] * m] })) };
      }
      case 'battle': {
        // both fleets out together, from the battle's middle
        const u = unit(p.at);
        const pts = Object.values(p.sides).flatMap((list) => list.map((o) => [p.at[0] + o.at[0], p.at[1] + o.at[1], p.at[2] + o.at[2]]));
        const m = shiftFor([p.at, ...pts], u, r, k);
        return { ...p, at: [p.at[0] + u[0] * m, p.at[1] + u[1] * m, p.at[2] + u[2] * m] };
      }
      case 'station':
      case 'deathstar':
      case 'patrol':
        return { ...p, at: pt(p.at) };
      case 'escape':
      case 'depart':
        return { ...p, from: pt(p.from), to: pt(p.to) };
      case 'cannon':
        return { ...p, from: pt(p.from) };
      case 'stream':
        return { ...p, from: pt(p.from), to: pt(p.to) };
      case 'superlaser':
        return { ...p, from: pt(p.from), at: pt(p.at) };
      case 'rocks':
        return p.kind === 'ring' ? { ...p, inner: outward(p.inner, r, k), outer: outward(p.outer, r, k) } : { ...p, at: pt(p.at) };
      case 'shield':
        return { ...p, r: outward(p.r, r, k) };
      case 'chase':
      case 'lanes':
        return { ...p, radius: outward(p.radius, r, k) };
      default:
        return p;
    }
  });
  // a gas giant it orbits: as big in the sky as it was, as far as the camera lets it be
  let parent = sys.parent;
  if (parent) {
    const d = Math.hypot(...parent.at);
    const g = Math.min(k, FIT.farthest / d);
    parent = { ...parent, r: parent.r * g, at: parent.at.map((v) => v * g) };
  }
  return {
    ...sys,
    body: { ...sys.body, r: r * k },
    ...(parent ? { parent } : {}),
    moons: sys.moons.map((m) => ({ ...m, r: m.r * k, orbit: outward(m.orbit, r, k) })),
    pieces,
  };
}
