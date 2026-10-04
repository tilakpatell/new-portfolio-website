// A simple player for Portal panic: the tests use it to show the backyard can
// be cleared, and the ready screen lets it play while nobody is. It weighs
// everything that can hurt it (enemies close by, bolts on their way, the
// ground about to go up, a beam's sweep), steps away from the sum, circles
// so it isn't cornered, picks up seeds when it's safe, fires at whatever is
// nearest, and portal-dashes when something is about to land.

import { PANIC, dash } from './rules';

const len = (x, y) => Math.hypot(x, y);

export function autopilot(g) {
  const p = g.p;
  const inp = g.input;
  let fx = 0;
  let fy = 0;
  let danger = 0;
  let urgent = null;
  const push = (dx, dy, w) => {
    const d = Math.max(1e-6, len(dx, dy));
    fx += (dx / d) * w;
    fy += (dy / d) * w;
  };
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.max(0.2, len(dx, dy) - e.r - p.r);
    const ranged = e.kind === 'gromflomite' || e.kind === 'cop';
    const w = (ranged ? 0.5 : 2.2) / (d * d + 0.4);
    push(dx, dy, w);
    danger += w;
    if (e.kind === 'gazorpian' && (e.state === 'windup' || e.state === 'charge') && d < 7) {
      // step out of its line, not back along it
      const ax = e.state === 'charge' ? e.vx : e.cx;
      const ay = e.state === 'charge' ? e.vy : e.cy;
      const side = (dx * -ay + dy * ax) >= 0 ? 1 : -1;
      push(-ay * side, ax * side, 4);
      if (d < 3.5) urgent = [-ay * side, ax * side];
    } else if (!ranged && d < 0.9) urgent = urgent ?? [dx, dy];
  }
  const b = g.boss;
  if (b?.alive) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.max(0.2, len(dx, dy) - b.r - p.r);
    const w = 6 / (d * d + 1);
    push(dx, dy, w);
    danger += w;
    // a prop between it and the gun: circle round for a clear shot
    const full = Math.max(1e-6, len(dx, dy));
    const blocked = g.obstacles.some((o) => {
      const t = ((o.x - p.x) * -dx + (o.y - p.y) * -dy) / (full * full);
      if (t <= 0 || t >= 1) return false;
      return len(p.x - dx * t - o.x, p.y - dy * t - o.y) < o.r + 0.3;
    });
    if (blocked) push(-dy, dx, 1.6);
    if (b.state === 'charge' || b.state === 'windup') {
      const ax = b.state === 'charge' ? b.vx : b.cx;
      const ay = b.state === 'charge' ? b.vy : b.cy;
      const side = (dx * -ay + dy * ax) >= 0 ? 1 : -1;
      push(-ay * side, ax * side, 5);
      if (d < 4) urgent = [-ay * side, ax * side];
    }
  }
  // bolts: where each passes closest, and how soon
  for (const o of g.bolts) {
    const rx = o.x - p.x;
    const ry = o.y - p.y;
    const vv = o.vx * o.vx + o.vy * o.vy;
    const t = Math.max(0, -(rx * o.vx + ry * o.vy) / Math.max(vv, 1e-6));
    if (t > 1.2) continue;
    const cx = rx + o.vx * t;
    const cy = ry + o.vy * t;
    const miss = len(cx, cy);
    if (miss < 1.6) {
      // sideways out of its path
      const side = cx * -o.vy + cy * o.vx >= 0 ? -1 : 1;
      push(-o.vy * side, o.vx * side, (1.6 - miss) * (2.5 / (t + 0.25)));
      danger += 1 / (t + 0.3);
      if (t < 0.22 && miss < p.r + o.r + 0.15) urgent = urgent ?? [-o.vy * side, o.vx * side];
    }
  }
  for (const h of g.hazards) {
    if (h.kind === 'zone' && !h.done) {
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const d = len(dx, dy);
      if (d < h.r + 1.4) {
        push(dx || 1, dy, 5 * (h.r + 1.4 - d));
        if (h.fuse - h.t < 0.3 && d < h.r + p.r) urgent = urgent ?? [dx || 1, dy];
      }
    } else if (h.kind === 'beam') {
      const a = h.t < h.warn ? h.a0 : h.a ?? h.a0;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const along = (p.x - h.x) * ux + (p.y - h.y) * uy;
      const offx = p.x - (h.x + ux * along);
      const offy = p.y - (h.y + uy * along);
      const off = len(offx, offy);
      // move away from the side the beam is sweeping from
      const dir = Math.sign(h.a1 - h.a0);
      const nx = -uy * dir;
      const ny = ux * dir;
      if (off < 5) push(nx, ny, 3);
      if (off < h.w && h.t > h.warn - 0.15) urgent = urgent ?? [nx, ny];
    }
  }
  // the edge of the arena and the props
  const r = len(p.x, p.y);
  if (r > PANIC.arena - 4) push(-p.x, -p.y, (r - (PANIC.arena - 4)) * 1.2);
  for (const o of g.obstacles) {
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = len(dx, dy) - o.r - p.r;
    if (d < 1.2) push(dx, dy, (1.2 - d) * 1.5);
  }
  // circle, so it isn't cornered
  if (r > 1) push(-p.y, p.x, 0.35);
  // seeds and sauce when it's quiet enough
  if (danger < 1.5) {
    let best = null;
    let bd = 9;
    for (const q of g.pickups) {
      const d = len(q.x - p.x, q.y - p.y);
      if (d < bd) [best, bd] = [q, d];
    }
    if (best) push(best.x - p.x, best.y - p.y, best.kind === 'sauce' ? 2 : 0.8);
    else if (r > 6) push(-p.x, -p.y, 0.3);
  }
  const l = len(fx, fy);
  inp.mx = l > 0.05 ? fx / Math.max(l, 1) : 0;
  inp.my = l > 0.05 ? fy / Math.max(l, 1) : 0;
  inp.aiming = false;
  inp.fire = true;
  if (urgent && p.dashes > 0 && p.dashT <= 0) {
    const [ux, uy] = urgent;
    const sx = inp.mx;
    const sy = inp.my;
    inp.mx = ux;
    inp.my = uy;
    dash(g);
    inp.mx = sx;
    inp.my = sy;
  }
}
