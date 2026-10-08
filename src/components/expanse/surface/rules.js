// The driver's rules on a planet's surface, pure: where the car starts in
// its first cell, and when it is put back. Bruno Simon's respawn is a place
// picked from his map; ours is where the car last stood dry on its four
// wheels, three seconds back (kept every half second), so R, drowning (four
// seconds under), or being stuck (lib/physics/vehicle's three seconds of
// throttle without getting anywhere) bring it back to somewhere it could
// drive. Upside down it rights itself (vehicle.js's own unflip). Under the
// surface the car is damped as his bodies are in water (1).
//
//   spawnIn(cell) → { x, y, z, yaw, slope } (world metres: the highest dry
//     vertex with a slope under 0.15, else the highest dry one, a metre and
//     a half above it)
//   createDriver() → state
//   stepDriver(state, vehicleState, input: { respawn }, dt, { position:
//     [x, y, z], waterAt(x, z) → { level, kind: 'sea' | 'lake' | 'river' } |
//     null }) → { respawn, to: [x, y, z] | null, drag: 0 | 1, moment: kind |
//     null }
//   screenAngle(bearing) → degrees clockwise from the top of the screen to
//     a world bearing (radians from +x toward +z), for the chase view's
//     fixed look along −x −z (the HUD's compass)

const CELL = 64;
const N = 65;
const GENTLE = 0.15;
const LIFT = 1.5;
export const DROWN = 4; // seconds under before it's brought back
export const RESPAWN_BACK = 3; // seconds back the place it comes back to
const KEEP_EVERY = 0.5;
const KEEP_FOR = 20;
const WET = 0.6; // the water this far below the chassis's middle: its wheels are in it

export function spawnIn(cell) {
  const h = cell.heights;
  const at = (ix, iz) => h[Math.min(N - 1, Math.max(0, iz)) * N + Math.min(N - 1, Math.max(0, ix))];
  let gentle = null;
  let any = null;
  for (let iz = 0; iz < N; iz++)
    for (let ix = 0; ix < N; ix++) {
      const k = iz * N + ix;
      if (!Number.isNaN(cell.water?.[k] ?? NaN)) continue;
      const y = h[k];
      const slope = Math.hypot(at(ix + 1, iz) - at(ix - 1, iz), at(ix, iz + 1) - at(ix, iz - 1)) / 2;
      if (!any || y > any.y) any = { ix, iz, y, slope };
      if (slope < GENTLE && (!gentle || y > gentle.y)) gentle = { ix, iz, y, slope };
    }
  const best = gentle ?? any ?? { ix: 32, iz: 32, y: at(32, 32), slope: 0 };
  return { x: cell.cx * CELL + best.ix, y: best.y + LIFT, z: cell.cz * CELL + best.iz, yaw: 0, slope: best.slope };
}

export function createDriver() {
  return { clock: 0, keptAt: -Infinity, kept: [], under: 0 };
}

export function stepDriver(s, v, input = {}, dt, { position, waterAt }) {
  s.clock += dt;
  const [x, y, z] = position;
  const w = waterAt(x, z);
  const wet = w && w.level > y - WET;
  const under = w && w.level > y;
  s.under = under ? s.under + dt : 0;
  const grounded = v.wheels.every((wh) => wh.contact);
  if (grounded && !wet && s.clock - s.keptAt >= KEEP_EVERY) {
    s.keptAt = s.clock;
    s.kept.push([s.clock, x, y, z]);
    while (s.kept.length && s.clock - s.kept[0][0] > KEEP_FOR) s.kept.shift();
  }
  const respawn = Boolean(input.respawn) || s.under >= DROWN || Boolean(v.stuck);
  let to = null;
  if (respawn) {
    let pick = null;
    for (const k of s.kept) if (s.clock - k[0] >= RESPAWN_BACK) pick = k;
    pick ??= s.kept[0] ?? null;
    to = pick ? [pick[1], pick[2], pick[3]] : null;
    s.under = 0;
    // (what it stood on after the place it goes back to is forgotten)
    if (pick) s.kept = s.kept.filter((k) => k[0] <= pick[0]);
  }
  return { respawn, to, drag: under ? 1 : 0, moment: wet ? w.kind : null };
}

export function screenAngle(bearing) {
  const bx = Math.cos(bearing);
  const bz = Math.sin(bearing);
  // the view's right on the ground is (1, −1)/√2, its up (−1, −1)/√2
  const sx = (bx - bz) / Math.SQRT2;
  const sy = -(bx + bz) / Math.SQRT2;
  return ((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360;
}
