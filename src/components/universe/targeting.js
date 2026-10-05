// Targeting, for the ship on the universe map: which hunter the guns are
// locked on, where to shoot to hit it, how much a shot is helped onto it,
// and where a thing off the edge of the screen is pointed to from. Pure (no
// three.js), so it's tested in Node; scene.js reads the ship, the hunters
// and the camera and draws the brackets (UniverseMap.jsx's HUD).
//
// A lock picks itself up: the hunter nearest the nose, within AIM.cone and
// AIM.range, and holds while it stays within the wider AIM.hold (a dogfight
// swings about), dropping once it's been outside that for AIM.lose seconds
// or is gone. T cycles to the next one round the nose. The lead point is
// where a bolt fired now meets the target, allowing for its speed and the
// bolt's; the pip sits there, and a shot within AIM.assist of it bends onto
// it (so the guns feel like a fighter's, not a pea shooter), with the help
// fading to nothing by AIM.assistEdge.
//
// Points are { x, y, z } (the ship, a Vector3) or [x, y, z] (the map's
// places), in the map's own space.

export const AIM = {
  range: 42, // map units: nothing further out can be locked
  cone: 0.38, // radians off the nose to pick a target up (about 22°)
  hold: 0.8, // radians: a lock holds out to here (about 46°)
  lose: 1.2, // seconds outside the hold cone (or out of range) before it drops
  assist: 0.14, // radians: inside this, a shot bends fully onto the lead point (about 8°)
  assistEdge: 0.36, // radians: beyond this, no help at all
  bolt: 18, // a bolt's own speed, over the ship's (scene.js adds the ship's)
  life: 1.1, // seconds a bolt flies
};

const X = (p) => (Array.isArray(p) ? p[0] : p.x);
const Y = (p) => (Array.isArray(p) ? p[1] : p.y);
const Z = (p) => (Array.isArray(p) ? p[2] : p.z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const angleBetween = (a, b) => Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));

// the way the ship's nose points: along its heading (0 is −z, growing
// turning left), tipped by its pitch
export function nose(s) {
  const p = s.pitch || 0;
  const level = Math.cos(p);
  return [-Math.sin(s.heading) * level, Math.sin(p), -Math.cos(s.heading) * level];
}

// the direction from the ship to a point, as a unit vector
export const dirTo = (s, p) => unit([X(p) - s.x, Y(p) - s.y, Z(p) - s.z]);

// how far a point is from the ship, and how far off its nose (radians)
export function bearing(s, p) {
  const d = [X(p) - s.x, Y(p) - s.y, Z(p) - s.z];
  const dist = len(d);
  if (dist < 1e-6) return { dist, off: 0 };
  return { dist, off: angleBetween(nose(s), [d[0] / dist, d[1] / dist, d[2] / dist]) };
}

// The lock, one step on: `lock` is { id, out } (out: seconds its target has
// been outside the hold cone) or null; `candidates` are { id, at, vel,
// size } (hunters.targets). Returns the new lock, or null. With `cycle`,
// moves on to the next candidate round the nose (nearest the nose first).
export function track(s, candidates, lock, dt, { cycle = false } = {}) {
  const seen = [];
  for (const c of candidates) {
    const b = bearing(s, c.at);
    if (b.dist > AIM.range * 1.3) continue;
    seen.push({ c, ...b });
  }
  seen.sort((a, b) => a.off - b.off);
  const held = (e) => e.off < AIM.hold && e.dist <= AIM.range * 1.3;
  const current = lock ? seen.find((e) => e.c.id === lock.id) : null;
  if (cycle && seen.length) {
    const ring = seen.filter(held);
    if (ring.length) {
      const i = current ? ring.findIndex((e) => e.c.id === lock.id) : -1;
      const next = ring[(i + 1) % ring.length];
      return { id: next.c.id, out: 0 };
    }
  }
  if (current) {
    if (held(current)) return { id: lock.id, out: 0 };
    // slipping away: a moment's grace before it lets go
    const out = lock.out + dt;
    if (out < AIM.lose) return { id: lock.id, out };
  }
  // a fresh one: nearest the nose, and nearer counts for a little
  let best = null;
  let score = Infinity;
  for (const e of seen) {
    if (e.off > AIM.cone || e.dist > AIM.range) continue;
    const k = e.off / AIM.cone + 0.35 * (e.dist / AIM.range);
    if (k < score) {
      score = k;
      best = e;
    }
  }
  return best ? { id: best.c.id, out: 0 } : null;
}

// Where a bolt fired now from `from` at `speed` meets a target at `at`
// moving at `vel`: { x, y, z, t } (t: seconds till it gets there), or null
// when it never would (the target's too fast, or the maths has no answer).
export function intercept(from, speed, at, vel) {
  const dx = X(at) - X(from);
  const dy = Y(at) - Y(from);
  const dz = Z(at) - Z(from);
  const vx = X(vel);
  const vy = Y(vel);
  const vz = Z(vel);
  // |d + v t| = speed t
  const a = vx * vx + vy * vy + vz * vz - speed * speed;
  const b = 2 * (dx * vx + dy * vy + dz * vz);
  const c = dx * dx + dy * dy + dz * dz;
  let t;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-9) return null;
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const r = Math.sqrt(disc);
    const t1 = (-b - r) / (2 * a);
    const t2 = (-b + r) / (2 * a);
    t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  }
  if (!(t > 0) || !Number.isFinite(t)) return null;
  return { x: X(at) + vx * t, y: Y(at) + vy * t, z: Z(at) + vz * t, t };
}

// A shot's direction, helped onto `want` (the way to the lead point): all
// the way inside AIM.assist, not at all past AIM.assistEdge, fading between.
export function assist(dir, want) {
  const a = angleBetween(dir, want);
  if (a <= AIM.assist) return [...want];
  if (a >= AIM.assistEdge) return [...dir];
  const k = 1 - (a - AIM.assist) / (AIM.assistEdge - AIM.assist);
  return unit([dir[0] + (want[0] - dir[0]) * k, dir[1] + (want[1] - dir[1]) * k, dir[2] + (want[2] - dir[2]) * k]);
}

// a direction as the ship's own angles: the heading that points along it
// and the pitch up it (for turning a bolt to face the way it flies)
export function aimAngles(dir) {
  const d = unit(dir);
  return { heading: Math.atan2(-d[0], -d[2]), pitch: Math.asin(clamp(d[1], -1, 1)) };
}

// Where a marker for something off the screen goes: on the edge of the open
// part of the canvas (`rect`: { x, y, w, h }), `pad` px in, on the line from
// its middle out toward the thing (dx, dy: the way to it on screen, any
// length), and the angle the arrow turns to point that way (radians, 0 is
// right, growing clockwise as CSS does).
export function edgeOf(dx, dy, rect, pad = 28) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const hw = Math.max(1, rect.w / 2 - pad);
  const hh = Math.max(1, rect.h / 2 - pad);
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return { x: cx, y: cy - hh, angle: -Math.PI / 2 };
  const ux = dx / l;
  const uy = dy / l;
  const k = Math.min(hw / Math.max(1e-6, Math.abs(ux)), hh / Math.max(1e-6, Math.abs(uy)));
  return { x: cx + ux * k, y: cy + uy * k, angle: Math.atan2(uy, ux) };
}

// is a projected point (screen px, and its depth in front of the camera)
// where a bracket can sit: in front, and inside the open area with a margin
export function onScreen(x, y, z, rect, margin = 24) {
  return z > 0.3 && x >= rect.x + margin && x <= rect.x + rect.w - margin && y >= rect.y + margin && y <= rect.y + rect.h - margin;
}
