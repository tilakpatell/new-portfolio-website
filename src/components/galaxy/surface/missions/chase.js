// A chase on a world's surface, as plain numbers (missions/index.js has the
// one on Endor: scout troopers on speeder bikes, racing through the
// redwoods for the bunker, and you after them). Pure, so it's tested; the
// drawing is chaseScene.js and the surface scene runs it.
import { pushOut } from '../walker';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── The route ──

// The way the scouts go: the waypoints sampled every `step` metres, every
// sample pushed `margin` clear of whatever's solid there (a trunk, a rock,
// a hut), then smoothed (the ends kept) and pushed clear again, so a bike on
// it, or a little either side of it, never meets a tree unless it's knocked
// off its line. → { pts, len, at(s) → { x, z, tx, tz }, project(x, z) → s }
export function planRoute(waypoints, solids, { step = 4, margin = 2.6, smooth = 3 } = {}) {
  let pts = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [ax, az] = waypoints[i];
    const [bx, bz] = waypoints[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  pts.push([...waypoints[waypoints.length - 1]]);
  const clear = () => {
    for (const p of pts)
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (const sol of solids.near(p[0], p[1], margin + 8)) {
          const push = pushOut(sol, p[0], p[1], margin);
          if (!push) continue;
          p[0] += push[0];
          p[1] += push[1];
          moved = true;
        }
        if (!moved) break;
      }
  };
  clear();
  for (let k = 0; k < smooth; k++) {
    const was = pts;
    pts = was.map((p, i) => (i === 0 || i === was.length - 1 ? p : [(was[i - 1][0] + p[0] * 2 + was[i + 1][0]) / 4, (was[i - 1][1] + p[1] * 2 + was[i + 1][1]) / 4]));
    clear();
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  // the segment s falls in
  const seg = (s) => {
    let lo = 0;
    let hi = pts.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const at = (s) => {
    const d = clamp(s, 0, len);
    const i = seg(d);
    const l = cum[i + 1] - cum[i] || 1;
    const k = (d - cum[i]) / l;
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, tx: (bx - ax) / l, tz: (bz - az) / l };
  };
  const project = (x, z) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i][0] - x) ** 2 + (pts[i][1] - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // onto the segments either side of the nearest sample
    let s = cum[best];
    bestD = Infinity;
    for (const i of [best - 1, best]) {
      if (i < 0 || i >= pts.length - 1) continue;
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
      const k = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2, 0, 1);
      const d = (ax + (bx - ax) * k - x) ** 2 + (az + (bz - az) * k - z) ** 2;
      if (d < bestD) {
        bestD = d;
        s = cum[i] + k * Math.sqrt(l2);
      }
    }
    return s;
  };
  return { pts, len, at, project };
}

// ── The scouts ──

const COUNT = 3; // seconds before the off
const STEP = 0.05; // the longest step the rules take at once
const SCOUT_R = 0.8; // a scout on its bike, seen from above
const CRASH = 12; // m/s: meet a solid faster than this and you're down
const BUMP = 1.7; // metres apart: you've ridden into it
const STALL = 1.6; // seconds: thrown off, and back on
const SHOT = { near: 4, far: 55, every: 2.4, first: 1.5, stagger: 0.6 };
const BAND = { far: 140, close: 25, slow: 0.85, quick: 1.12 }; // rubber band: how far ahead, and what it does to their speed

// A chase, ready to go: the scouts at their gaps along the route, in their
// lanes (metres to the left of it, negative to the right), the count on.
export function newChase(mission, route) {
  return {
    route,
    phase: 'count',
    clock: 0, // the count
    count: COUNT,
    t: 0, // since the off
    stall: 0,
    scouts: Array.from({ length: mission.scouts }, (_, i) => ({
      id: i,
      s: mission.gaps[i],
      lane: mission.lanes[i],
      off: mission.lanes[i],
      vOff: 0,
      speed: mission.speeds[i],
      hp: mission.hp ?? 3,
      down: false,
      how: null,
      fireIn: SHOT.first + SHOT.stagger * i,
      bumpIn: 0,
    })),
  };
}

// where a scout is and which way it's heading (where it went down, once it has)
export function scoutAt(chase, i) {
  const sc = chase.scouts[i];
  const p = chase.route.at(sc.s);
  const nx = -p.tz;
  const nz = p.tx;
  const v = sc.down ? 0 : sc.speed;
  return { x: p.x + nx * sc.off, z: p.z + nz * sc.off, yaw: Math.atan2(p.tx * v + nx * sc.vOff, p.tz * v + nz * sc.vOff), s: sc.s };
}

const live = (chase) => chase.scouts.filter((s) => !s.down);

function down(chase, sc, how, out) {
  sc.down = true;
  sc.how = how;
  sc.vOff = 0;
  out.push({ type: 'down', id: sc.id, how });
  if (chase.phase === 'run' && !live(chase).length) {
    chase.phase = 'won';
    out.push({ type: 'won' });
  }
}

function step(chase, h, { you, solids }, out) {
  const route = chase.route;
  if (chase.phase === 'count') {
    chase.clock += h;
    if (chase.clock >= COUNT) {
      chase.phase = 'run';
      chase.count = 0;
      out.push({ type: 'go' });
    } else {
      const n = COUNT - Math.floor(chase.clock);
      if (n !== chase.count) {
        chase.count = n;
        out.push({ type: 'count', n });
      }
    }
    return;
  }
  if (chase.phase !== 'run') return;
  chase.t += h;
  const youS = you ? route.project(you.x, you.z) : 0;
  for (const sc of chase.scouts) {
    if (sc.down) continue;
    const ahead = sc.s - youS;
    const k = ahead > BAND.far ? BAND.slow : ahead < BAND.close ? BAND.quick : 1;
    sc.s += sc.speed * k * h;
    // knocked off its line, it springs back to its lane
    sc.vOff += (-(sc.off - sc.lane) * 6 - sc.vOff * 4) * h;
    sc.off += sc.vOff * h;
    sc.fireIn -= h;
    sc.bumpIn -= h;
    if (sc.s >= route.len) {
      sc.s = route.len;
      chase.phase = 'lost';
      out.push({ type: 'escaped', id: sc.id }, { type: 'lost' });
      return;
    }
    const p = scoutAt(chase, sc.id);
    // into a tree (or a rock, a hut) at speed: down
    if (solids)
      for (const sol of solids.near(p.x, p.z, SCOUT_R + 4))
        if (pushOut(sol, p.x, p.z, SCOUT_R) && sc.speed * k > CRASH) {
          down(chase, sc, 'tree', out);
          break;
        }
    if (sc.down) continue;
    if (!you) continue;
    // ridden into: shoved off its line, and you off yours
    const dx = p.x - you.x;
    const dz = p.z - you.z;
    if (Math.hypot(dx, dz) < BUMP && sc.bumpIn <= 0) {
      const at = route.at(sc.s);
      const nx = -at.tz;
      const nz = at.tx;
      const side = dx * nx + dz * nz >= 0 ? 1 : -1;
      const rel = Math.abs((you.vx ?? 0) * nx + (you.vz ?? 0) * nz - sc.vOff);
      sc.vOff += side * Math.max(9, rel * 1.5);
      const back = -side * Math.max(3, rel * 0.6);
      sc.bumpIn = 0.4;
      out.push({ type: 'bump', id: sc.id, push: [nx * back, nz * back] });
    }
    // you on its tail: it fires back over its shoulder
    if (ahead >= SHOT.near && ahead <= SHOT.far && sc.fireIn <= 0) {
      sc.fireIn = SHOT.every;
      out.push({ type: 'shoot', id: sc.id });
    }
  }
}

// The chase moved on by dt (split into short steps, so a long frame can't
// carry a scout through a tree or past the bunker unseen). → events
export function stepChase(chase, dt, opts = {}) {
  const out = [];
  chase.stall = Math.max(0, chase.stall - dt);
  const n = Math.max(1, Math.ceil(dt / STEP - 1e-9));
  for (let i = 0; i < n; i++) step(chase, dt / n, opts, out);
  return out;
}

// One of your bolts lands on a scout: knocked about, and down at the last of its hp.
export function hitScout(chase, id) {
  const out = [];
  const sc = chase.scouts[id];
  if (!sc || sc.down || chase.phase !== 'run') return out;
  sc.hp -= 1;
  sc.vOff += sc.hp % 2 ? 4 : -4;
  if (sc.hp <= 0) down(chase, sc, 'shot', out);
  return out;
}

// You've hit a tree (or run out of health): thrown off, and back on in a moment.
export function knockYou(chase) {
  chase.stall = STALL;
}

// What the page shows: how it stands, the count, the clock, how many are
// left, and how far along the route the leading scout is (0…1).
export function chaseView(chase) {
  const left = live(chase);
  const lead = left.reduce((m, s) => Math.max(m, s.s), 0) / (chase.route.len || 1);
  return { phase: chase.phase, count: chase.count, t: chase.t, left: left.length, total: chase.scouts.length, lead };
}

// ── Aiming and scoring ──

// A bike's cannon, a little forgiving: the shot turned onto whichever
// target is nearest its line, if one's within the cone and in range.
export function aimAssist(from, dir, targets, { cone = 0.12, range = 90 } = {}) {
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  let best = null;
  let bestA = cone;
  for (const t of targets) {
    const v = [t.x - from[0], t.y - from[1], t.z - from[2]];
    const l = Math.hypot(v[0], v[1], v[2]);
    if (l < 1e-6 || l > range) continue;
    const a = Math.acos(clamp((v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / (l * dl), -1, 1));
    if (a <= bestA) {
      bestA = a;
      best = [v[0] / l, v[1] / l, v[2] / l];
    }
  }
  return best;
}

// stars for a chase won in t seconds (the mission's two marks: three under the first)
export const starsFor = (mission, t) => (t <= mission.stars[0] ? 3 : t <= mission.stars[1] ? 2 : 1);
