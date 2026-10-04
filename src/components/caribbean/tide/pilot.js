// The autopilot: a hand on the helm for the title screen, and the crew that
// plays whole voyages in the tests. It reads the same game the player does
// and writes g.input, nothing else.

import { ARM, TIDE, bearing, course, fitted, marks, wrap } from './rules';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function autopilot(g) {
  const p = g.p;
  const inp = g.input;
  inp.port = false;
  inp.star = false;
  inp.steer = 0;
  if (g.status !== 'sail' || p.sunk || g.over) return;

  // what to go for: an arm that's up, then the nearest thing afloat
  let mark = null;
  let best = Infinity;
  for (const m of marks(g)) {
    const d = Math.hypot(m.x - p.x, m.y - p.y) - (m.arm ? 60 : 0) - (m.kraken ? 40 : 0);
    if (d < best) [best, mark] = [d, m];
  }
  let loot = null;
  let near = Infinity;
  for (const c of g.pickups) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < near && (c.quest || d < 140)) [near, loot] = [d, c];
  }

  const range = fitted(g).range;
  let want = Math.atan2(-p.y, -p.x); // nothing to do: back toward the middle
  let canvas = 2;
  if (loot && (!mark || best > 130 || (loot.quest && p.hp > p.max * 0.45))) want = Math.atan2(loot.y - p.y, loot.x - p.x);
  else if (mark) {
    const to = Math.atan2(mark.y - p.y, mark.x - p.x);
    const d = Math.hypot(mark.x - p.x, mark.y - p.y);
    if (d > range * 0.72) want = to + 0.25;
    else {
      // lay her alongside: the beam that needs the smaller turn
      const off = wrap(to - p.a);
      want = to - Math.sign(off || 1) * (Math.PI / 2 + (d < 58 ? 0.4 : -0.1));
      if (d < 75 && !g.kraken) canvas = 1;
    }
  }

  // out of the way of what's about to land
  let vx = Math.cos(course(g, p, want));
  let vy = Math.sin(course(g, p, want));
  for (const z of g.zones) {
    if (z.kind === 'bubble') {
      const dx = p.x - z.x;
      const dy = p.y - z.y;
      const d = Math.hypot(dx, dy) || 1;
      const w = clamp(1 - (d - z.r) / 40, 0, 1);
      vx += (dx / d) * w * 3;
      vy += (dy / d) * w * 3;
    } else if (z.kind === 'mortar') {
      // step off the line through the mark it's falling on
      const dx = p.x - z.x;
      const dy = p.y - z.y;
      const d = Math.hypot(dx, dy) || 1;
      const w = clamp(1 - (d - z.r) / 60, 0, 1);
      vx += (dx / d) * w * 4;
      vy += (dy / d) * w * 4;
    } else if (z.kind === 'slam') {
      const dx = p.x - z.x;
      const dy = p.y - z.y;
      const along = dx * Math.cos(z.dir) + dy * Math.sin(z.dir);
      const side = -dx * Math.sin(z.dir) + dy * Math.cos(z.dir);
      if (along > -10 && along < ARM.reach + 20 && Math.abs(side) < 30) {
        const s = Math.sign(side || 1);
        vx += -Math.sin(z.dir) * s * 4;
        vy += Math.cos(z.dir) * s * 4;
        canvas = 2;
      }
    }
  }
  inp.steer = clamp(wrap(Math.atan2(vy, vx) - p.a) * 2.5, -1, 1);
  inp.sail = canvas;

  const b = bearing(g);
  if (b.port && p.reload[0] <= 0) inp.port = true;
  if (b.star && p.reload[1] <= 0) inp.star = true;
}

export { TIDE };
