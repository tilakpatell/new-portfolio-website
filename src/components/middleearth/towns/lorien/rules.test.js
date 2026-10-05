import { describe, expect, it } from 'vitest';
import { GIFTS, LEADS, MIRROR_PULL, RIVER, allGiven, eyeOn, eyeSoon, giveGift, newBoat, newGifts, newLead, newPull, riverWide, stepBoat, stepLead, stepPull, takeGift } from './rules';
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
