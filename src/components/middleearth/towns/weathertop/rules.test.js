import { describe, expect, it } from 'vitest';
import { GAPS, PATCHES, PLANTS } from './layout';
import { ATHELAS, BRAND, FIRE, MARK, MARK_CELLS, MARK_LINES, OBSTACLES, READINGS, RIDE, glowOf, newBrand, newFire, newHunt, newMark, newRide, pick, pickable, readMark, revealed, scrape, stamp, stampable, stepBrand, stepFire, stepHunt, stepRide, thrust } from './rules';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DT = 1 / 30;

describe('putting the fire out', () => {
  it('is seen if it’s left burning', () => {
    const f = newFire(PATCHES);
    const ev = [];
    for (let t = 0; t < FIRE.time + 1 && f.state === 'on'; t += 0.1) ev.push(...stepFire(f, 0.1));
    expect(f.state).toBe('seen');
    expect(ev.some((e) => e.type === 'seen')).toBe(true);
  });

  it('goes out, patch by patch, for a hobbit who runs about stamping', () => {
    const f = newFire(PATCHES);
    let x = PATCHES[0].x + 2;
    let z = PATCHES[0].z + 2;
    while (f.state === 'on') {
      stepFire(f, DT);
      const i = f.heat.map((h, j) => [h, j]).filter(([h]) => h > 0).sort((a, b) => Math.hypot(PATCHES[a[1]].x - x, PATCHES[a[1]].z - z) - Math.hypot(PATCHES[b[1]].x - x, PATCHES[b[1]].z - z))[0][1];
      const d = Math.hypot(PATCHES[i].x - x, PATCHES[i].z - z);
      if (d > 0.5) {
        x += ((PATCHES[i].x - x) / d) * Math.min(d, 3.4 * DT);
        z += ((PATCHES[i].z - z) / d) * Math.min(d, 3.4 * DT);
      }
      const at = stampable(f, PATCHES, x, z);
      if (at >= 0) stamp(f, at);
    }
    expect(f.state).toBe('won');
    expect(f.t).toBeLessThan(FIRE.time);
    expect(f.heat.every((h) => h === 0)).toBe(true);
  });

  it('takes a few stamps to put one out, and not faster than a foot can', () => {
    const f = newFire(PATCHES);
    expect(stamp(f, 0)).toBe('hit');
    expect(stamp(f, 0)).toBeNull(); // still cooling
    f.cool = 0;
    expect(stamp(f, 0)).toBe('hit');
    f.cool = 0;
    expect(stamp(f, 0)).toBe('hit');
    f.cool = 0;
    expect(stamp(f, 0)).toBe('out');
    f.cool = 0;
    expect(stamp(f, 0)).toBeNull(); // nothing to stamp
  });

  it('sets an out patch going again if a hot one is left beside it', () => {
    const f = newFire(PATCHES);
    f.heat[1] = 0;
    f.heat[0] = 1;
    expect(f.next[1]).toContain(0);
    const ev = [];
    for (let t = 0; t < 4; t += 0.1) ev.push(...stepFire(f, 0.1));
    expect(ev.some((e) => e.type === 'caught' && e.i === 1)).toBe(true);
    expect(f.heat[1]).toBeGreaterThan(0);
  });

  it('only lets you stamp on a patch you’re standing by', () => {
    const f = newFire(PATCHES);
    expect(stampable(f, PATCHES, PATCHES[2].x + 0.3, PATCHES[2].z)).toBe(2);
    expect(stampable(f, PATCHES, PATCHES[2].x + 5, PATCHES[2].z + 5)).toBe(-1);
  });
});

// a player who swings the brand to the nearest one coming on, and thrusts
// when one's in reach; `slow` is how long they take to notice
function holdOut({ slow = 0.3, thrusts = true, swing = true } = {}) {
  const b = newBrand(GAPS, GAPS[4]);
  let target = null;
  let think = 0;
  const ev = [];
  while (b.state === 'on' && b.t < 90) {
    think -= DT;
    if (think <= 0) {
      think = slow;
      target = b.wraiths.filter((w) => w.mode === 'creep' || w.mode === 'held').sort((p, q) => p.r - q.r)[0] ?? null;
    }
    ev.push(...stepBrand(b, DT, swing && target ? { to: target.a } : {}));
    if (thrusts && b.wraiths.some((w) => (w.mode === 'creep' || w.mode === 'held') && w.r < BRAND.thrust && Math.abs(wrap(w.a - b.aim)) < BRAND.thrustArc)) thrust(b);
  }
  return { b, ev };
}

describe('the brand on the summit', () => {
  it('is lost if you stand still', () => {
    const { b, ev } = holdOut({ swing: false, thrusts: false });
    expect(['stabbed', 'ring']).toContain(b.state);
    expect(ev.at(-1).type).toBe(b.state);
    expect(b.t).toBeLessThan(BRAND.hold);
  });

  it('is held, till Strider comes, by swinging the fire to each and driving them back', () => {
    for (const slow of [0.2, 0.5]) {
      const { b, ev } = holdOut({ slow });
      expect(b.state, `slow ${slow}`).toBe('won');
      expect(ev.at(-1).type).toBe('strider');
      expect(ev.some((e) => e.type === 'held')).toBe(true);
    }
  });

  it('holds one off in its light, and lets one come on out of it', () => {
    const b = newBrand([0, Math.PI], 0);
    b.wraiths.forEach((w) => {
      w.mode = 'creep';
      w.r = BRAND.fear;
    });
    for (let i = 0; i < 30; i++) stepBrand(b, DT, { turn: 0 });
    const [lit, dark] = b.wraiths;
    expect(lit.mode).toBe('held');
    expect(lit.r).toBeGreaterThanOrEqual(BRAND.fear);
    expect(dark.mode).toBe('creep');
    expect(dark.r).toBeLessThan(BRAND.fear - 0.5);
  });

  it('swings no faster than an arm can', () => {
    const b = newBrand(GAPS, 0);
    stepBrand(b, 0.1, { to: Math.PI / 2 });
    expect(b.aim).toBeCloseTo(BRAND.turn * 0.1, 5);
    stepBrand(b, 0.1, { turn: -1 });
    expect(b.aim).toBeCloseTo(0, 5);
  });

  it('drives back the ones in reach before it with a thrust, then has to wait', () => {
    const b = newBrand([0, 0.3, Math.PI], 0);
    b.wraiths.forEach((w) => {
      w.mode = 'creep';
      w.r = 2.5;
    });
    expect(thrust(b)).toEqual([0, 1]);
    expect(thrust(b)).toBeNull();
    stepBrand(b, 0.5, {});
    expect(b.wraiths[0].r).toBeGreaterThan(2.5);
    expect(b.wraiths[2].mode).toBe('creep');
  });

  it('lets the Ring win if they’re kept close too long', () => {
    const b = newBrand([0, 2, 4], 0);
    b.wraiths.forEach((w) => {
      w.mode = 'held';
      w.r = BRAND.catch + 0.3;
    });
    // pinned there, just out of reach, every step
    let ev = [];
    for (let i = 0; i < 600 && b.state === 'on'; i++) {
      b.wraiths.forEach((w) => {
        w.r = BRAND.catch + 0.3;
        w.mode = 'back';
        w.back = 1;
      });
      ev = stepBrand(b, DT, {});
    }
    expect(b.state).toBe('ring');
    expect(ev.at(-1).type).toBe('ring');
  });
});

describe('the kingsfoil', () => {
  it('glows for a lantern near it, and the weeds never do', () => {
    const a = PLANTS.find((p) => p.athelas);
    const w = PLANTS.find((p) => !p.athelas);
    expect(glowOf(a, a.x + 1, a.z)).toBe(1);
    expect(glowOf(a, a.x + 4, a.z)).toBeGreaterThan(0);
    expect(glowOf(a, a.x + 20, a.z)).toBe(0);
    expect(glowOf(w, w.x, w.z)).toBe(0);
  });

  it('wants three, and a weed is only a weed', () => {
    expect(PLANTS.filter((p) => p.athelas)).toHaveLength(ATHELAS.need);
    const h = newHunt();
    const weed = PLANTS.find((p) => !p.athelas);
    expect(pickable(h, PLANTS, weed.x + 0.5, weed.z)).toBe(weed);
    expect(pick(h, weed)).toBe('weed');
    const found = PLANTS.filter((p) => p.athelas).map((p) => pick(h, pickable(h, PLANTS, p.x, p.z)));
    expect(found).toEqual(['found', 'found', 'won']);
    expect(h.state).toBe('won');
    expect(pick(h, weed)).toBeNull();
  });

  it('can’t pick the same one twice', () => {
    const h = newHunt();
    const a = PLANTS.find((p) => p.athelas);
    expect(pick(h, a)).toBe('found');
    expect(pick(h, a)).toBeNull();
    expect(pickable(h, PLANTS, a.x, a.z)).toBeNull();
  });

  it('runs out if Frodo grows too cold', () => {
    const h = newHunt();
    let ev = [];
    for (let t = 0; t <= ATHELAS.cold + 1 && h.state === 'on'; t += 1) ev = stepHunt(h, 1);
    expect(h.state).toBe('cold');
    expect(ev).toEqual([{ type: 'cold' }]);
  });
});

// a rider who steers for the gap ahead, and spurs on if `spur`
function ride({ steer = true, spur = true } = {}) {
  const r = newRide();
  const ev = [];
  while (r.state === 'on' && r.t < 200) {
    let to = 0;
    const ahead = OBSTACLES.find((o) => o.s > r.s && o.s < r.s + 30);
    if (steer && ahead) {
      if (ahead.kind === 'tree') to = ahead.lat0 < -RIDE.lane ? (ahead.lat1 + RIDE.lane) / 2 + 0.4 : (ahead.lat0 - RIDE.lane) / 2 - 0.4;
      else to = ahead.lat > 0 ? ahead.lat - ahead.r - 1.6 : ahead.lat + ahead.r + 1.6;
    }
    ev.push(...stepRide(r, DT, { steer: Math.max(-1, Math.min(1, (to - r.lat) * 1.5)), spur }));
  }
  return { r, ev };
}

describe('the ride to the ford', () => {
  it('always leaves a way past every tree and stone', () => {
    for (const o of OBSTACLES) {
      const lats = [];
      for (let l = -RIDE.lane; l <= RIDE.lane; l += 0.1) {
        const blocked = o.kind === 'tree' ? l > o.lat0 - RIDE.body && l < o.lat1 + RIDE.body : Math.abs(l - o.lat) < o.r + RIDE.body;
        if (!blocked) lats.push(l);
      }
      expect(lats.length, o.id).toBeGreaterThan(15);
    }
    expect(OBSTACLES[0].s).toBeGreaterThan(50);
    expect(OBSTACLES.length).toBeGreaterThan(8);
  });

  it('gets you caught if you just sit there', () => {
    const { r, ev } = ride({ steer: false, spur: false });
    expect(r.state).toBe('caught');
    expect(ev.some((e) => e.type === 'hit')).toBe(true);
  });

  it('needs the spurs as well as steering', () => {
    expect(ride({ steer: true, spur: false }).r.state).toBe('caught');
    const { r, ev } = ride();
    expect(r.state).toBe('ford');
    expect(r.hits).toBe(0);
    expect(ev.at(-1).type).toBe('ford');
  });

  it('slows you when you hit something, and the spurs need a rest', () => {
    const r = newRide();
    expect(stepRide(r, DT, { spur: true }).map((e) => e.type)).toContain('spur');
    expect(stepRide(r, DT, { spur: true }).map((e) => e.type)).not.toContain('spur');
    const first = OBSTACLES[0];
    const blocked = first.kind === 'tree' ? (first.lat0 + first.lat1) / 2 : first.lat;
    const r2 = { ...newRide(), s: first.s - 1, lat: Math.max(-RIDE.lane, Math.min(RIDE.lane, blocked)) };
    const ev = stepRide(r2, 0.2, {});
    expect(ev.map((e) => e.type)).toContain('hit');
    expect(r2.slowT).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) stepRide(r2, 0.05, {});
    expect(r2.v).toBeLessThan(RIDE.base);
  });

  it('winds, but never turns back on itself', async () => {
    const { roadTurn } = await import('./rules');
    for (let s = 0; s <= RIDE.length; s += 5) expect(Math.abs(roadTurn(s))).toBeLessThan(0.6);
  });
});

describe('on the side: Gandalf’s mark', () => {
  // drag along a line across the stone, a little at a time
  const along = (m, [u0, v0, u1, v1], amount = 0.5) => {
    for (let k = 0; k <= 1; k += 0.02) scrape(m, u0 + (u1 - u0) * k, v0 + (v1 - v0) * k, amount);
  };

  it('has the G-rune and three strokes under the lichen', () => {
    expect(MARK_LINES).toHaveLength(5);
    expect(MARK_CELLS.length).toBeGreaterThan(40);
    expect(MARK_CELLS.length).toBeLessThan(MARK.cols * MARK.rows * 0.4);
    expect(READINGS.filter((r) => r.ok)).toHaveLength(1);
    expect(READINGS.find((r) => r.ok).text).toMatch(/three strokes/);
  });

  it('shows nothing till it’s scraped, and nothing for scraping the bare corners', () => {
    const m = newMark();
    expect(revealed(m)).toBe(0);
    along(m, [0.02, 0.03, 0.98, 0.03]);
    along(m, [0.02, 0.97, 0.98, 0.97]);
    expect(revealed(m)).toBeLessThan(0.2);
    expect(m.state).toBe('scrub');
    expect(readMark(m, 1)).toBe(null);
  });

  it('comes up stroke by stroke as you scrape along them, then wants reading', () => {
    const m = newMark();
    MARK_LINES.slice(0, 2).forEach((l) => along(m, l));
    const half = revealed(m);
    expect(half).toBeGreaterThan(0.2);
    expect(half).toBeLessThan(MARK.need);
    MARK_LINES.slice(2).forEach((l) => along(m, l));
    expect(revealed(m)).toBeGreaterThanOrEqual(MARK.need);
    expect(m.state).toBe('read');
  });

  it('comes up for a hobbit who scrubs the whole stone, back and forth', () => {
    const m = newMark();
    for (let v = 0.05; v < 1; v += 0.08) along(m, [0.02, v, 0.98, v], 0.35);
    expect(m.state).toBe('read');
  });

  it('wants the right reading, and lets you count again', () => {
    const m = newMark();
    MARK_LINES.forEach((l) => along(m, l));
    const wrong = READINGS.findIndex((r) => !r.ok);
    expect(readMark(m, wrong)).toBe(false);
    expect(m.state).toBe('read');
    expect(readMark(m, READINGS.findIndex((r) => r.ok))).toBe(true);
    expect(m.state).toBe('done');
    expect(m.tries).toBe(2);
  });
});
