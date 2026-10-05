import { describe, expect, it } from 'vitest';
import { CLIMB, DUEL, MOTH, STONE, WIND, atWindow, block, blockable, lapOf, leap, newDuel, newGaze, newLeap, newMoth, newStair, push, stepDuel, stepGaze, stepLeap, stepMoth, stepStair } from './rules';

const run = (n, fn) => {
  for (let i = 0; i < n; i++) if (fn(i) === false) break;
};

describe('the palantír', () => {
  it('shows you everything if you look away when the Eye turns', () => {
    for (const seed of [1, 3, 8]) {
      const g = newGaze(seed);
      const stages = [];
      run(4000, () => {
        for (const e of stepGaze(g, 0.05, g.phase === 'still')) if (e.type === 'stage') stages.push(e.stage);
        return g.state === 'on';
      });
      expect(g.state).toBe('seen');
      expect(stages).toEqual(['army']);
    }
  });
  it('finds you if you stare into it', () => {
    const g = newGaze(3);
    const ev = [];
    run(4000, () => {
      ev.push(...stepGaze(g, 0.05, true).map((e) => e.type));
      return g.state === 'on';
    });
    expect(g.state).toBe('found');
    expect(ev).toContain('stir');
    expect(ev).toContain('turn');
    expect(g.seen).toBeLessThan(1);
  });
  it('warns you before it turns', () => {
    const g = newGaze(2);
    const ev = [];
    run(200, () => void ev.push(...stepGaze(g, 0.05, false).map((e) => e.type)));
    expect(ev.indexOf('stir')).toBeLessThan(ev.indexOf('turn'));
    expect(ev).toContain('still');
  });
  it('grows its notice faster the longer you hold your gaze', () => {
    const a = newGaze(4);
    a.phaseT = 1e9;
    run(20, () => void stepGaze(a, 0.05, true));
    const early = a.notice;
    run(60, () => void stepGaze(a, 0.05, true));
    const k1 = early / 1;
    const k2 = (a.notice - early) / 3;
    expect(k2).toBeGreaterThan(k1);
    expect(early).toBeGreaterThan(STONE.notice * 0.9);
  });
});

describe('the duel of the wizards', () => {
  const fight = (policy, seed = 3) => {
    const d = newDuel(seed);
    run(6000, () => {
      for (const e of stepDuel(d, 0.05)) policy(d, e);
      // the opening: push
      if (d.phase === 'open') push(d);
      // late in the tell: block
      if (d.phase === 'tell' && blockable(d) && !d.blocked) policy(d, { type: 'late' });
      return d.state === 'on';
    });
    return d;
  };
  it('is won by blocking his blows and pushing him back', () => {
    for (const seed of [1, 3, 7, 11]) {
      const d = fight((d0, e) => {
        if (e.type === 'late') block(d0);
      }, seed);
      expect(d.state).toBe('won');
      expect(d.pushes).toBe(DUEL.pushes);
      expect(d.will).toBe(DUEL.will);
    }
  });
  it('beats you if you just stand there', () => {
    const d = newDuel(3);
    run(6000, () => {
      stepDuel(d, 0.05);
      return d.state === 'on';
    });
    expect(d.state).toBe('down');
  });
  it('punishes blocking at nothing and pushing too soon', () => {
    const d = newDuel(3);
    expect(block(d)).toBe('early');
    expect(push(d)).toBe(null);
    expect(block(d)).toBe(null);
    const e = newDuel(3);
    expect(push(e)).toBe('miss');
    expect(e.fumble).toBeGreaterThan(0);
  });
  it('turns a blow at the last moment, as it falls', () => {
    const d = newDuel(3);
    run(400, () => {
      const ev = stepDuel(d, 0.05);
      return !ev.some((x) => x.type === 'cast');
    });
    expect(d.phase).toBe('cast');
    expect(block(d)).toBe('blocked');
  });
});

describe('the long stair', () => {
  it('climbs to the top, past each window once', () => {
    const c = newStair();
    const ev = [];
    run(2000, () => {
      ev.push(...stepStair(c, 0.05, 1, 70, [10, 30, 50]));
      return c.state === 'on';
    });
    expect(c.state).toBe('top');
    expect(ev.filter((e) => e.type === 'window').map((e) => e.i)).toEqual([0, 1, 2]);
    expect(c.s).toBe(70);
  });
  it('goes down again, but not below the foot', () => {
    const c = newStair(5);
    run(200, () => void stepStair(c, 0.05, -1, 70));
    expect(c.s).toBe(0);
    expect(atWindow(10.5, [10, 30])).toBe(0);
    expect(atWindow(10 + CLIMB.reach + 0.5, [10, 30])).toBe(-1);
  });
});

describe('the moth', () => {
  it('settles on a hand kept under it', () => {
    for (const seed of [1, 7, 12]) {
      const m = newMoth(seed);
      run(4000, () => {
        stepMoth(m, 0.05, Math.max(-1, Math.min(1, (m.x - m.hand) * 8)));
        return m.state === 'on';
      });
      expect(m.state).toBe('landed');
    }
  });
  it('flutters off from a hand held away from it', () => {
    const m = newMoth(7);
    run(4000, () => {
      stepMoth(m, 0.05, m.x > 0 ? -1 : 1);
      return m.state === 'on';
    });
    expect(m.state).toBe('gone');
    expect(m.t).toBeGreaterThanOrEqual(MOTH.away);
  });
  it('warns you of a gust before it comes', () => {
    const m = newMoth(4);
    m.gustT = 1.5;
    const ev = [];
    run(40, () => void ev.push(...stepMoth(m, 0.05, 0).map((e) => e.type)));
    expect(ev.indexOf('rising')).toBeGreaterThanOrEqual(0);
    expect(ev.indexOf('rising')).toBeLessThan(ev.indexOf('gust'));
  });
});

describe('Gwaihir', () => {
  it('catches you if you jump while he is beneath you', () => {
    const l = newLeap();
    const ev = [];
    let caught = null;
    run(400, () => {
      ev.push(...stepLeap(l, 0.05).map((e) => e.type));
      if (l.under) caught = leap(l);
      return l.state === 'on';
    });
    expect(ev).toEqual(['coming', 'under']);
    expect(caught).toBe('caught');
    expect(l.t).toBeGreaterThanOrEqual(WIND.first);
  });
  it('comes round again if you hold back', () => {
    const l = newLeap();
    expect(leap(l)).toBe('wait');
    const ev = [];
    run(Math.ceil((WIND.first + WIND.lap * 1.5) / 0.05), () => void ev.push(...stepLeap(l, 0.05).map((e) => e.type)));
    expect(ev.filter((e) => e === 'under').length).toBe(2);
    expect(ev).toContain('past');
    expect(l.passes).toBeGreaterThanOrEqual(1);
  });
  it('goes round his lap smoothly, under the edge as you can jump', () => {
    const l = newLeap();
    let last = lapOf(l);
    let jumps = 0;
    run(400, () => {
      stepLeap(l, 0.05);
      const k = lapOf(l);
      let d = k - last;
      if (d < -0.5) d += 1;
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(0.05);
      if (l.under) {
        jumps += 1;
        expect(Math.abs(k - 0.5)).toBeLessThan(0.1);
      }
      last = k;
    });
    expect(jumps).toBeGreaterThan(0);
  });
});
