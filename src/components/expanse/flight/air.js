// The ships in a planet's air: each flies its cell's route (lib/land/flight/
// routes.js), its place along it set by the visit's clock, so a cell let go
// of and loaded again finds its traffic where it would have been. Banked by
// the turn. Pure: no three.js.
//
//   prepareRoute(route) → route with `cum` (the distance to each point) for pointAt
//   pointAt(route, u, out) → out: { x, y, z, yaw, pitch, roll } at u (0…1 of the loop)
//   airBrain(actor) → { step(ctx, dt) → intent } (follow the route)
//   placeAir(actor, t, dt) moves a ship on its route to the clock's t

const BANK = 0.9; // radians of roll at the tightest turn a route has

export function prepareRoute(route) {
  if (route.cum) return route;
  const pts = route.points;
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  route.cum = cum;
  route.length = cum[cum.length - 1];
  return route;
}

// where u (0…1) of the way round the loop is, and which way it faces there
export function pointAt(route, u, out = {}) {
  prepareRoute(route);
  const { points, cum, length } = route;
  const d = (((u % 1) + 1) % 1) * length;
  let i = 0;
  while (i < points.length - 1 && cum[i + 1] < d) i++;
  const a = points[i];
  const b = points[(i + 1) % points.length];
  const c = points[(i + 2) % points.length];
  const seg = cum[i + 1] - cum[i] || 1;
  const k = (d - cum[i]) / seg;
  out.x = a[0] + (b[0] - a[0]) * k;
  out.y = a[1] + (b[1] - a[1]) * k;
  out.z = a[2] + (b[2] - a[2]) * k;
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  // (the flight's yaw: 0 is nose down −z, flightRules.js's)
  out.yaw = Math.atan2(-dx, -dz);
  out.pitch = Math.atan2(b[1] - a[1], Math.hypot(dx, dz) || 1);
  // bank into the coming turn, more the nearer the corner
  const turn = Math.atan2(-(c[0] - b[0]), -(c[2] - b[2])) - out.yaw;
  out.roll = Math.atan2(Math.sin(turn), Math.cos(turn)) * BANK * k;
  return out;
}

export function placeAir(actor, t) {
  const r = actor.route;
  const u = actor.t0 + (t * actor.speed) / (r.length || 1);
  actor.u = u;
  pointAt(r, u, actor.b);
}

// a ship's brain: its route (a scramble is air.js's to add)
export function airBrain() {
  return { step: () => ({ mode: 'route' }) };
}
