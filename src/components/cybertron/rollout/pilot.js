// A simple driver for Roll out: the tests use it to show a stage can be
// cleared on every level, and the ready screen lets it drive while nobody is
// playing. It reads the road the way a player would: the next roadblock or
// broken bridge decides the form, then it picks the safest lane.

import { ROLL, bodyOf, jump, nextWall, transform } from './rules';

const { lanes: LANES } = ROLL;

function laneDanger(g, x, horizon) {
  let d = 0;
  const near = (dz) => 1 + 40 / (Math.max(0, dz) + 2);
  const body = bodyOf(g);
  const closing = Math.max(8, g.speed);
  for (const c of g.cars) {
    if (c.z - g.z > horizon) break;
    if (!c.alive || c.hit || c.z + c.l / 2 < g.z - body.hl - 0.5) continue;
    const cx = c.toX ?? c.x;
    if (Math.min(Math.abs(c.x - x), Math.abs(cx - x)) < c.w / 2 + body.hw + 0.45) d += near(c.z - c.l / 2 - g.z) * 3;
  }
  for (const o of g.debris) {
    if (o.z - g.z > horizon) break;
    if (!o.alive || o.z < g.z - 1) continue;
    if (Math.abs(o.x - x) < o.w / 2 + body.hw + 0.4) d += near(o.z - g.z) * (g.boosting ? 0.3 : 3);
  }
  for (const e of g.enemies) {
    if (!e.alive) continue;
    if (e.kind === 'vehicon') {
      if (e.state === 'pass') {
        if (Math.abs(e.z - g.z) < 9 && (Math.abs(e.x - x) < 2.2 || (e.swerve && !e.swerve.done && Math.abs(g.x - x) < 2.4))) d += 60;
      } else if (e.z > g.z - 1 && e.z - g.z < horizon && Math.abs(e.x - x) < 1.8) d += near(e.z - g.z) * (g.mode === 'robot' ? 1.5 : 4);
    }
  }
  for (const m of g.bombs) {
    if (m.done) continue;
    const left = Math.max(0, m.fuse - m.t);
    const arrive = (m.z - g.z) / closing;
    if (Math.abs(m.x - x) < m.r + body.hw + 0.5 && Math.abs(arrive - left) < 0.55 + ROLL.bomb.blast) d += 80;
  }
  for (const b of g.bolts) {
    if (b.z < g.z - 1) continue;
    const t = (b.z - g.z) / Math.max(1, g.speed - b.vz);
    if (t > 1.6) continue;
    if (Math.abs(b.x + b.vx * t - x) < b.r + body.hw + 0.6) d += 50 / (t + 0.3);
  }
  if (g.warn && Math.abs(g.warn.x - x) < g.warn.w + body.hw + 0.8) d += 300;
  // cubes and shards are worth a small detour, more so when running low
  for (const c of g.cubes) {
    if (c.z - g.z > 40) break;
    if (!c.taken && c.z > g.z && Math.abs(c.x - x) < 0.8 && c.y < 1.5) d -= g.energon < 40 ? 1.2 : 0.4;
  }
  for (const s of g.sparks) if (!s.taken && s.z > g.z && s.z - g.z < 50 && Math.abs(s.x - x) < 0.8) d -= 3;
  return d;
}

export function autopilot(g) {
  const input = { steer: 0, boost: false };
  g.input = input;
  if (g.status !== 'running' || g.bridge > 0) return;
  const body = bodyOf(g);
  const wall = nextWall(g, 140);
  const boss = g.boss && g.boss.alive ? g.boss : null;

  // ── the form ──
  let want = 'vehicle';
  const standing = g.enemies.some((e) => e.alive && e.kind === 'vehicon' && e.state !== 'pass' && e.z > g.z + 4 && e.z - g.z < 60);
  if (boss) {
    const jumper = !ROLL.bosses[boss.kind].flyer;
    if (g.mode === 'robot') want = g.energon > (jumper ? 6 : 12) ? 'robot' : 'vehicle';
    else want = g.energon > 45 || (jumper && ['beam', 'wave'].includes(boss.attack?.type) && g.energon > ROLL.energon.toStand) ? 'robot' : 'vehicle';
    if (jumper && g.waves.length && g.energon > ROLL.energon.toStand) want = 'robot';
  } else if (standing && g.energon > 22) want = 'robot';
  if (wall) {
    if (wall.kind === 'barricade' && wall.dist < 75) want = 'robot';
    if (wall.kind === 'gap' && wall.dist < 95) want = 'vehicle';
    // don't stand up just before a broken bridge, or sit down before a roadblock
    if (wall.kind === 'gap' && wall.dist < 160 && want === 'robot' && !boss) want = 'vehicle';
  }
  if (want !== g.mode && g.morphT < 0 && g.grounded) transform(g);

  // ── jumps: roadblocks and floor beams ──
  if (g.mode === 'robot' && g.morph > 0.6 && g.grounded) {
    const b = g.barricades.find((x) => !x.broken && x.z > g.z);
    if (b) {
      const t = (b.z - b.l / 2 - body.hl - g.z) / Math.max(1, g.speed);
      if (t > 0.17 && t < 0.4) jump(g);
    }
    for (const w of g.waves) {
      const t = (w.z - g.z - ROLL.wave.d / 2 - body.hl) / Math.max(1, g.speed - w.vz);
      if (!w.passed && t > 0.14 && t < 0.42) jump(g);
    }
    for (const o of g.debris) {
      if (o.z - g.z > 12) break;
      if (o.alive && o.z > g.z && Math.abs(o.x - g.x) < o.w / 2 + body.hw) {
        const t = (o.z - o.l / 2 - body.hl - g.z) / Math.max(1, g.speed);
        if (t > 0.12 && t < 0.3) jump(g);
      }
    }
    // boxed in behind a car: over the top
    for (const c of g.cars) {
      if (c.z - g.z > 14) break;
      if (!c.alive || c.hit || c.z < g.z || Math.abs(c.x - g.x) > c.w / 2 + body.hw) continue;
      const t = (c.z - c.l / 2 - body.hl - g.z) / Math.max(1, g.speed - c.speed);
      if (t > 0.19 && t < 0.24) jump(g);
    }
  }

  // ── the lane ──
  const horizon = Math.max(34, g.speed * 1.9);
  let best = null;
  for (const lx of LANES) {
    // getting there means crossing the lanes between
    let d = laneDanger(g, lx, horizon) + Math.abs(lx - g.x) * 0.25;
    const steps = Math.round(Math.abs(lx - g.x) / 3);
    for (let i = 1; i < steps; i++) {
      const mid = g.x + Math.sign(lx - g.x) * 3 * i;
      d += Math.max(0, laneDanger(g, mid, 10)) * 0.6;
    }
    if (boss && ROLL.bosses[boss.kind].flyer && g.mode === 'robot') d += Math.abs(lx - boss.x) * 0.15;
    if (!best || d < best.d) best = { x: lx, d };
  }
  // hold the lane unless another is clearly better
  const here = LANES.reduce((a, l) => (Math.abs(l - g.tx) < Math.abs(a - g.tx) ? l : a), LANES[0]);
  const hereD = laneDanger(g, here, horizon);
  const target = best.d < hereD - 0.8 ? best.x : here;
  g.tx = target;

  // ── boost on a clear road with energon to spare ──
  if (g.mode === 'vehicle' && g.morph < 0.05 && !boss && g.energon > 55 && laneDanger(g, target, 50) < 3 && !(wall && wall.kind === 'barricade' && wall.dist < 110)) input.boost = true;
}
