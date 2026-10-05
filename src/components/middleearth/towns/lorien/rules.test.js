import { describe, expect, it } from 'vitest';
import { BOW, GIFTS, LEADS, MIRROR_PULL, RIVER, aimAt, aimOf, allGiven, eyeOn, eyeSoon, giveGift, newBoat, newGifts, newLead, newPull, newRange, riverWide, stepBoat, stepLead, stepPull, stepRange, takeGift } from './rules';
import { LEAD } from './layout';

const run = (n, fn) => {
  for (let i = 0; i < n; i++) if (fn(i) === false) break;
};

describe('Haldir leads', () => {
  it('walks the path to its end while you keep up', () => {
    const l = newLead(LEAD);
    const hero = { x: LEAD[0][0] - 3, z: LEAD[0][1] };
    let there = false;
    run(4000, () => {
      for (const e of stepLead(l, 0.05, hero, LEAD)) if (e.type === 'there') there = true;
      // you, a few steps behind him
      hero.x += (l.x - 3 - hero.x) * 0.2;
      hero.z += (l.z - hero.z) * 0.2;
      return !there;
    });
    expect(there).toBe(true);
    expect(l.x).toBeCloseTo(LEAD.at(-1)[0]);
    expect(l.z).toBeCloseTo(LEAD.at(-1)[1]);
  });
  it('waits for you when you fall behind, and goes on when you catch up', () => {
    const l = newLead(LEAD);
    const hero = { x: LEAD[0][0], z: LEAD[0][1] };
    const ev = [];
    run(400, () => void ev.push(...stepLead(l, 0.05, hero, LEAD)));
    expect(ev.map((e) => e.type)).toContain('wait');
    const at = [l.x, l.z];
    run(100, () => void stepLead(l, 0.05, hero, LEAD));
    expect([l.x, l.z]).toEqual(at);
    hero.x = l.x - 2;
    hero.z = l.z;
    expect(stepLead(l, 0.05, hero, LEAD).map((e) => e.type)).toContain('go');
    expect(Math.hypot(l.x - hero.x, l.z - hero.z)).toBeLessThan(LEADS.wait);
  });
});

describe('the Mirror', () => {
  // hold back only while the Eye is looking (or about to)
  const wise = (p) => eyeOn(p) || eyeSoon(p);
  const through = (policy, seed = 5) => {
    const p = newPull(seed);
    let end = null;
    run(2000, () => {
      for (const e of stepPull(p, 0.05, policy(p))) if (e.type === 'done' || e.type === 'touched') end = e.type;
      return !end;
    });
    return { end, p };
  };
  it('is got through by holding back when the Eye looks', () => {
    for (const seed of [1, 5, 9, 13]) expect(through(wise, seed).end).toBe('done');
  });
  it('forgives a hand that’s a little slow', () => {
    const late = (p) => eyeOn(p) && p.looking < MIRROR_PULL.look - 0.3;
    for (const seed of [1, 2, 3, 7]) expect(through(late, seed).end).toBe('done');
  });
  it('pulls you in if you never hold back', () => {
    const { end, p } = through(() => false);
    expect(end).toBe('touched');
    expect(p.t).toBeLessThan(MIRROR_PULL.length);
  });
  it('tires you out if you hold back all the time', () => {
    for (const seed of [1, 5, 9]) expect(through(() => true, seed).end).toBe('touched');
  });
  it('warns before the Eye looks', () => {
    const p = newPull(3);
    const seen = [];
    run(200, () => void seen.push(...stepPull(p, 0.05, false).map((e) => e.type)));
    expect(seen.indexOf('warn')).toBeGreaterThanOrEqual(0);
    expect(seen.indexOf('warn')).toBeLessThan(seen.indexOf('look'));
  });
});

describe('the gifts', () => {
  it('go to the ones they’re for', () => {
    const g = newGifts();
    expect(takeGift(g, 'bow')).toBe('took');
    expect(giveGift(g, 'gimli')).toBe('wrong');
    expect(g.carrying).toBe('bow');
    expect(giveGift(g, 'legolas')).toBe('right');
    expect(g.carrying).toBe(null);
    expect(takeGift(g, 'bow')).toBe(null);
    takeGift(g, 'daggers');
    expect(giveGift(g, 'pippin')).toBe('right');
    takeGift(g, 'rope');
    // changing your mind puts the rope back
    takeGift(g, 'hairs');
    expect(g.left).toContain('rope');
    expect(giveGift(g, 'gimli')).toBe('right');
    takeGift(g, 'rope');
    expect(allGiven(g)).toBe(false);
    expect(giveGift(g, 'sam')).toBe('right');
    expect(allGiven(g)).toBe(true);
    expect(Object.keys(g.given)).toHaveLength(GIFTS.length);
  });
  it('need something in your hands', () => {
    expect(giveGift(newGifts(), 'sam')).toBe(null);
  });
});

describe('down the Anduin', () => {
  const ride = (policy) => {
    const b = newBoat();
    const ev = [];
    run(4000, () => {
      for (const e of stepBoat(b, 0.05, policy(b))) ev.push(e.type);
      return b.state === 'on';
    });
    return { b, ev };
  };
  // steer away from the next rock ahead, and back to the middle after
  const pilot = (b) => {
    const r = RIVER.rocks.find((x) => x.s > b.s - 1 && x.s - b.s < 14);
    let want = 0;
    if (r) want = r.lat > 0 ? r.lat - 3.2 : r.lat + 3.2;
    return { steer: Math.max(-1, Math.min(1, (want - b.lat) * 1.5)) };
  };
  it('is run by steering round the rocks, past the Argonath to the end', () => {
    const { b, ev } = ride(pilot);
    expect(b.state).toBe('end');
    expect(b.hits).toBeLessThan(RIVER.hits);
    expect(ev).toContain('argonath');
  });
  it('swamps a boat that doesn’t steer', () => {
    const { b, ev } = ride(() => ({ steer: 0 }));
    expect(b.state).toBe('swamped');
    expect(ev.filter((e) => e === 'hit')).toHaveLength(RIVER.hits);
  });
  it('keeps the boat inside the banks', () => {
    const b = newBoat();
    run(400, () => void stepBoat(b, 0.05, { steer: 1 }));
    expect(b.lat).toBeLessThanOrEqual(riverWide(b.s));
  });
  it('has every rock inside the channel', () => {
    for (const r of RIVER.rocks) expect(Math.abs(r.lat)).toBeLessThan(riverWide(r.s) - 1);
  });
});

describe('Legolas’s targets', () => {
  // a plain range: two boards to the north, the far one a little east, and
  // a trunk off to the west
  const world = { from: { x: 0, y: 1, z: 0 }, targets: [{ x: 0, y: 1.5, z: -12, r: 0.55 }, { x: 6, y: 1.6, z: -28, r: 0.55 }], trunks: [{ x: -6, z: -14, r: 1.4 }], ground: () => 0 };
  const still = (r) => Object.assign(r, { wind: { x: 0, z: 0 } });
  // draw for `hold` seconds aimed so, let go, and wait till it's down
  const shoot = (r, { yaw, pitch }, hold = 1) => {
    const ev = stepRange(r, 0.02, { draw: false });
    for (let t = 0; t < hold; t += 0.02) {
      Object.assign(r, { yaw, pitch });
      ev.push(...stepRange(r, 0.02, { draw: true }));
    }
    ev.push(...stepRange(r, 0.02, { draw: false }));
    for (let i = 0; i < 400 && r.state !== 'aim' && r.state !== 'won' && r.state !== 'out'; i++) ev.push(...stepRange(r, 0.02));
    return ev;
  };
  // aimed above a board by as much as a full draw falls on the way
  const allowing = (at) => {
    const d = Math.hypot(at.x - world.from.x, at.z - world.from.z);
    const t = d / BOW.speed[1];
    return { yaw: aimAt(world.from, at).yaw, pitch: Math.atan2(at.y - world.from.y + 0.5 * BOW.g * t * t, d) };
  };

  it('strikes the board aimed at, allowing for the fall', () => {
    const r = still(newRange(world, 3));
    const ev = shoot(r, allowing(world.targets[0]));
    expect(ev.find((e) => e.type === 'hit')).toMatchObject({ i: 0, fresh: true });
    expect(r.struck).toEqual([0]);
    expect(r.arrows).toBe(BOW.arrows - 1);
    expect(r.stuck[0].into).toBe('board');
  });
  it('falls short of a far board aimed straight at', () => {
    const r = still(newRange(world, 3));
    const ev = shoot(r, aimAt(world.from, world.targets[1]));
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    expect(ev.find((e) => e.type === 'miss')?.into).toBe('ground');
  });
  it('drops a slack bow’s arrow at your feet', () => {
    const r = still(newRange(world, 3));
    const ev = shoot(r, allowing(world.targets[0]), 0.1);
    expect(ev.find((e) => e.type === 'loose').draw).toBeLessThan(0.2);
    expect(ev.find((e) => e.type === 'miss')?.into).toBe('ground');
    expect(Math.hypot(r.stuck[0].x, r.stuck[0].z)).toBeLessThan(8);
  });
  it('stops in a trunk in the way', () => {
    const r = still(newRange(world, 3));
    const ev = shoot(r, aimAt(world.from, { x: -6, y: 1.5, z: -14 }));
    expect(ev.find((e) => e.type === 'miss')?.into).toBe('trunk');
  });
  it('is carried by the breeze', () => {
    const calm = still(newRange(world, 3));
    shoot(calm, aimAt(world.from, { x: 0, y: 1, z: -30 }));
    const windy = Object.assign(newRange(world, 3), { wind: { x: BOW.wind, z: 0 } });
    shoot(windy, aimAt(world.from, { x: 0, y: 1, z: -30 }));
    expect(windy.stuck[0].x - calm.stuck[0].x).toBeGreaterThan(0.2);
  });
  it('shakes, held at full draw too long', () => {
    const spread = (r, from, to) => {
      let most = 0;
      for (let t = 0; t < to; t += 0.02) {
        stepRange(r, 0.02, { draw: true });
        if (t >= from) most = Math.max(most, Math.abs(aimOf(r).pitch - r.pitch));
      }
      return most;
    };
    const fresh = spread(newRange(world, 5), 0.7, 1.4);
    const tired = spread(newRange(world, 5), 4, 5);
    expect(tired).toBeGreaterThan(fresh * 3);
  });
  it('needs the bow let go of before the next draw', () => {
    const r = still(newRange(world, 3));
    shoot(r, allowing(world.targets[0]));
    const ev = [];
    for (let i = 0; i < 20; i++) ev.push(...stepRange(r, 0.02, { draw: true }));
    expect(ev.some((e) => e.type === 'draw')).toBe(false);
    stepRange(r, 0.02, { draw: false });
    expect(stepRange(r, 0.02, { draw: true }).map((e) => e.type)).toContain('draw');
  });
  it('is won when every board is struck, and lost when the arrows run out', () => {
    const r = still(newRange(world, 3));
    shoot(r, allowing(world.targets[0]));
    const ev = shoot(still(r), allowing(world.targets[1]));
    expect(ev.map((e) => e.type)).toContain('won');
    expect(r.state).toBe('won');
    expect(r.shot).toBe(2);
    const lost = still(newRange(world, 3));
    const all = [];
    for (let i = 0; i < BOW.arrows; i++) all.push(...shoot(still(lost), { yaw: Math.PI / 2, pitch: -0.3 }));
    expect(lost.state).toBe('out');
    expect(all.filter((e) => e.type === 'loose')).toHaveLength(BOW.arrows);
    expect(stepRange(lost, 0.02, { draw: true })).toEqual([]);
  });
});
