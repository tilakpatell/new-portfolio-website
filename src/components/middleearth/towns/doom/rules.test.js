import { describe, expect, it } from 'vitest';
import { BURSTS, CARRY, EYE, FLIGHT, HANG, MARCH, RECALL, SHIRE, carryStep, newCarry, newFlight, newHang, newMarch, newRecall, newSearch, paceAt, recall, stepCarry, stepFlight, stepHang, stepMarch, stepRecall, stepSearch, telling } from './rules';

const run = (n, fn) => {
  for (let i = 0; i < n; i++) if (fn(i) === false) break;
};

describe('the column', () => {
  it('halts at the camp if you keep your place', () => {
    const m = newMarch();
    run(2000, () => {
      // match the drums
      stepMarch(m, 0.05, (MARCH.pace * paceAt(m.t + 0.05) - MARCH.pace) / MARCH.step - m.off);
      return m.state === 'on';
    });
    expect(m.state).toBe('halt');
    expect(m.lashes).toBe(0);
  });
  it('finds you out if you march at your own pace', () => {
    const m = newMarch();
    const ev = [];
    run(2000, () => {
      ev.push(...stepMarch(m, 0.05, 0).map((e) => e.type));
      return m.state === 'on';
    });
    expect(ev).toContain('drift');
    expect(ev).toContain('lash');
    expect(m.state).toBe('caught');
  });
  it('drums out its changes of pace', () => {
    const m = newMarch();
    const ev = [];
    run(200, () => void ev.push(...stepMarch(m, 0.05, 0.3).map((e) => e.type)));
    expect(ev).toContain('beat');
  });
});

describe('under the Eye', () => {
  it('sweeps its light to and fro across the plain', () => {
    const e = newSearch(-700);
    const zs = [];
    run(400, () => {
      stepSearch(e, 0.05, { x: -700, z: 200 }, false);
      zs.push(e.z);
    });
    expect(Math.min(...zs)).toBeLessThan(EYE.band[0] + 1);
    expect(Math.max(...zs)).toBeGreaterThan(EYE.band[1] - 1);
  });
  it('finds you standing in it, and not hidden in a rock’s shadow', () => {
    const lit = newSearch(-700);
    const hid = newSearch(-700);
    const hero = { x: -700, z: 0 };
    run(400, () => {
      stepSearch(lit, 0.05, hero, false);
      stepSearch(hid, 0.05, hero, true);
    });
    expect(lit.state).toBe('found');
    expect(hid.state).toBe('on');
  });
  it('creeps its line towards you', () => {
    const e = newSearch(-700);
    run(100, () => void stepSearch(e, 0.05, { x: -600, z: 300 }, true));
    expect(e.x).toBeGreaterThan(-700);
    expect(e.x).toBeLessThan(-600);
  });
});

describe('carrying Frodo', () => {
  it('gets up the road, left, right, standing still when it shakes', () => {
    const c = newCarry();
    let foot = 'left';
    run(5000, (i) => {
      stepCarry(c, 0.05);
      if (i % 6 === 0 && c.tremorT === 0) {
        const r = carryStep(c, foot);
        if (r === 'step') foot = foot === 'left' ? 'right' : 'left';
      }
      return c.state === 'on';
    });
    expect(c.state).toBe('top');
    expect(c.s).toBe(CARRY.len);
  });
  it('stumbles on the same foot twice', () => {
    const c = newCarry();
    carryStep(c, 'left');
    const s = c.s;
    expect(carryStep(c, 'left')).toBe('stumble');
    expect(c.s).toBeLessThan(s);
    expect(carryStep(c, 'right')).toBeNull();
  });
  it('slides back if you step while the mountain shakes', () => {
    const c = newCarry();
    c.s = CARRY.tremors[0] + 0.1;
    expect(stepCarry(c, 0.05).map((e) => e.type)).toContain('tremor');
    expect(carryStep(c, 'left')).toBe('slide');
    expect(c.s).toBeLessThan(CARRY.tremors[0]);
  });
});

describe('Frodo over the fire', () => {
  it('is caught if your hand is down to him while he reaches', () => {
    const g = newHang(3);
    run(2000, () => {
      stepHang(g, 0.05, g.phase === 'reach' || g.phaseT < 1);
      return g.state === 'on';
    });
    expect(g.state).toBe('caught');
  });
  it('falls if you never reach', () => {
    const g = newHang(3);
    run(4000, () => {
      stepHang(g, 0.05, false);
      return g.state === 'on';
    });
    expect(g.state).toBe('lost');
    expect(g.t).toBeCloseTo(1 / HANG.grip, 0);
  });
  it('isn’t caught while he’s looking down at the fire', () => {
    const g = newHang(3);
    g.arm = 1;
    const ev = stepHang(g, 0.05, true);
    expect(ev.map((e) => e.type)).not.toContain('caught');
    expect(g.phase).toBe('look');
  });
});

describe('the eagles', () => {
  it('get out of the eruption if you steer round the fire', () => {
    const f = newFlight();
    run(4000, () => {
      const b = BURSTS.find((x) => x.s > f.s);
      const want = b && b.s - f.s < 25 ? (b.lat > 0 ? b.lat - 4 : b.lat + 4) : f.lat;
      stepFlight(f, 0.05, Math.max(-1, Math.min(1, (want - f.lat) * 2)));
      return f.state === 'on';
    });
    expect(f.state).toBe('clear');
    expect(f.hits).toBeLessThan(FLIGHT.hits);
  });
  it('come down if you fly into it', () => {
    const f = newFlight();
    run(4000, () => {
      const b = BURSTS.find((x) => x.s > f.s);
      stepFlight(f, 0.05, b ? Math.max(-1, Math.min(1, (b.lat - f.lat) * 3)) : 0);
      return f.state === 'on';
    });
    expect(f.state).toBe('down');
  });
});

describe('do you remember the Shire?', () => {
  // let Sam tell this round, and say what he told
  const listen = (r) => {
    const told = [];
    for (let i = 0; i < 400 && r.phase !== 'ask' && r.state === 'on'; i++) for (const e of stepRecall(r, 0.05)) if (e.type === 'tell') told.push(e.id);
    return told;
  };
  it('picks six different things of the Shire to tell', () => {
    for (let seed = 1; seed < 30; seed++) {
      const r = newRecall(seed);
      expect(new Set(r.order).size).toBe(RECALL.length);
      for (const id of r.order) expect(SHIRE.some((m) => m.id === id)).toBe(true);
    }
  });
  it('has Sam tell two to begin with, one at a time, then waits for Frodo', () => {
    const r = newRecall(4);
    expect(recall(r, r.order[0])).toBeNull();
    stepRecall(r, RECALL.wait + 0.1);
    expect(telling(r)).toBe(r.order[0]);
    stepRecall(r, RECALL.show);
    expect(telling(r)).toBeNull();
    const told = [r.order[0], ...listen(r)];
    expect(told).toEqual(r.order.slice(0, RECALL.first));
    expect(r.phase).toBe('ask');
  });
  it('goes one longer each time they’re said back right, up to all six', () => {
    const r = newRecall(6);
    const results = [];
    for (let round = RECALL.first; round <= RECALL.length; round++) {
      expect(listen(r)).toEqual(r.order.slice(0, round));
      for (let i = 0; i < round; i++) results.push(recall(r, r.order[i]));
      for (let i = 0; i < 100 && r.phase === 'next'; i++) stepRecall(r, 0.05);
    }
    expect(results.filter((x) => x === 'round')).toHaveLength(RECALL.length - RECALL.first);
    expect(results.at(-1)).toBe('remembered');
    expect(r.state).toBe('remembered');
    expect(r.slips).toBe(0);
  });
  it('tells the same again after one said wrong', () => {
    const r = newRecall(8);
    listen(r);
    const wrong = SHIRE.find((m) => m.id !== r.order[0]).id;
    expect(recall(r, wrong)).toBe('wrong');
    expect(recall(r, r.order[0])).toBeNull();
    for (let i = 0; i < 100 && r.phase === 'wrong'; i++) stepRecall(r, 0.05);
    expect(listen(r)).toEqual(r.order.slice(0, RECALL.first));
    expect(r.round).toBe(RECALL.first);
    expect(r.slips).toBe(1);
  });
});
