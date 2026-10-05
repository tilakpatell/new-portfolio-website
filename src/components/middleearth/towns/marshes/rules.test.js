import { describe, expect, it } from 'vitest';
import { CREEP, FELL, ROPE, newCreep, newDescent, newFell, newLure, pounce, stepCreep, stepDescent, stepFell, stepLure } from './rules';

const run = (n, fn) => {
  for (let i = 0; i < n; i++) if (fn(i) === false) break;
};

describe('down the cliff on the rope', () => {
  // swing to the side away from the next outcrop below
  const climber = (d) => {
    const o = ROPE.outcrops.find((x) => x.y > d.y);
    const want = o ? -o.side * 1.6 : 0;
    return { lower: !o || Math.abs(d.lat - want) < 0.8 || o.y - d.y > 2.5, steer: Math.max(-1, Math.min(1, (want - d.lat) * 2)) };
  };
  it('gets you down if you swing clear of the outcrops', () => {
    const d = newDescent();
    const ev = [];
    run(4000, () => {
      ev.push(...stepDescent(d, 0.05, climber(d)).map((e) => e.type));
      return d.state === 'on';
    });
    expect(d.state).toBe('down');
    expect(d.knocks).toBeLessThan(ROPE.knocks);
  });
  it('knocks you off if you just let the rope out', () => {
    const d = newDescent();
    run(4000, () => {
      stepDescent(d, 0.05, { lower: true });
      return d.state === 'on';
    });
    expect(d.state).toBe('fell');
  });
  it('only goes down while you let the rope out', () => {
    const d = newDescent();
    run(40, () => void stepDescent(d, 0.05, { lower: false }));
    expect(d.y).toBe(0);
  });
});

describe('catching Sméagol', () => {
  it('works if you keep still and grab when he reaches', () => {
    const c = newCreep(3);
    let r = null;
    run(4000, () => {
      for (const e of stepCreep(c, 0.05, false)) if (e.type === 'reach') r = pounce(c);
      return !r && c.state === 'on';
    });
    expect(r).toBe('caught');
  });
  it('spooks him if you move while he looks', () => {
    const c = newCreep(3);
    const seen = [];
    run(400, () => {
      const looking = c.phase === 'look';
      seen.push(...stepCreep(c, 0.05, looking).map((e) => e.type));
      return !seen.includes('spooked');
    });
    expect(seen).toContain('spooked');
    expect(c.d).toBeGreaterThan(CREEP.reach + 2);
  });
  it('lets him get away if you grab too soon, and get to Sam if too late', () => {
    const a = newCreep(3);
    stepCreep(a, 0.05, false);
    expect(pounce(a)).toBe('early');
    const b = newCreep(3);
    run(4000, () => {
      stepCreep(b, 0.05, false);
      return b.state === 'on';
    });
    expect(b.state).toBe('late');
  });
});

describe('the lights in the marsh', () => {
  const lights = [[10, 0]];
  it('draw you in if you linger', () => {
    const l = newLure();
    const h = { x: 9, z: 0, speed: 0 };
    let drawn = false;
    run(200, () => {
      drawn = stepLure(l, 0.05, h, lights).some((e) => e.type === 'drawn');
      return !drawn;
    });
    expect(drawn).toBe(true);
  });
  it('let you by if you walk on past', () => {
    const l = newLure();
    const h = { x: 6, z: 0, speed: 1.6 };
    run(200, () => {
      h.x += h.speed * 0.05;
      stepLure(l, 0.05, h, lights);
    });
    expect(l.state).toBe('on');
    expect(l.k).toBeLessThan(1);
  });
});

describe('the Nazgûl overhead', () => {
  it('passes you by if you get down after the shriek and stay down', () => {
    const f = newFell();
    let down = false;
    const ev = [];
    run(1000, () => {
      for (const e of stepFell(f, 0.05, down)) {
        ev.push(e.type);
        if (e.type === 'shriek') down = true;
        if (e.type === 'gone') down = false;
      }
    });
    expect(f.state).toBe('on');
    expect(ev.filter((e) => e === 'gone')).toHaveLength(FELL.at.length);
  });
  it('sees you if you stay up', () => {
    const f = newFell();
    run(1000, () => {
      stepFell(f, 0.05, false);
      return f.state === 'on';
    });
    expect(f.state).toBe('spotted');
  });
});
