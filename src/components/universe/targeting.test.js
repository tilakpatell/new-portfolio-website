import { describe, expect, it } from 'vitest';
import { AIM, aimAngles, assist, bearing, dirTo, edgeOf, intercept, nose, onScreen, track } from './targeting';

const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0 }; // nose along −z
const hunter = (id, at, vel = [0, 0, 0]) => ({ id, at, vel, size: 0.3 });
// a lock followed for `seconds`, the same scene each step
const follow = (s, cands, lock, seconds, opts) => {
  for (let t = 0; t < seconds; t += 1 / 60) lock = track(s, cands, lock, 1 / 60, opts);
  return lock;
};

describe('the nose', () => {
  it('points along the heading, tipped by the pitch', () => {
    expect(nose(ship)).toEqual([-0, 0, -1]);
    const [x, y, z] = nose({ heading: Math.PI / 2, pitch: 0.5 });
    expect(x).toBeCloseTo(-Math.cos(0.5), 6);
    expect(y).toBeCloseTo(Math.sin(0.5), 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('measures how far something is off it', () => {
    expect(bearing(ship, [0, 0, -10]).off).toBeCloseTo(0, 6);
    expect(bearing(ship, [10, 0, 0]).off).toBeCloseTo(Math.PI / 2, 6);
    expect(bearing(ship, { x: 0, y: 0, z: 10 }).off).toBeCloseTo(Math.PI, 6);
    expect(bearing(ship, [3, 4, 0]).dist).toBe(5);
    expect(dirTo(ship, [0, 0, -7])).toEqual([0, 0, -1]);
  });
});

describe('the lock', () => {
  it('picks up the hunter nearest the nose, within range, and nothing far off it', () => {
    const near = hunter('a', [1, 0, -20]); // just off the nose
    const wide = hunter('b', [15, 0, -10]); // well off to the side
    const far = hunter('c', [0, 0, -(AIM.range + 10)]);
    expect(track(ship, [wide, near, far], null, 1 / 60)?.id).toBe('a');
    expect(track(ship, [wide], null, 1 / 60)).toBeNull();
    expect(track(ship, [far], null, 1 / 60)).toBeNull();
    expect(track(ship, [], null, 1 / 60)).toBeNull();
  });

  it('holds on while the target swings out past the pick-up cone, and drops it once it is well away', () => {
    const lock = track(ship, [hunter('a', [0, 0, -20])], null, 1 / 60);
    // out past the pick-up cone but inside the hold: kept
    const swung = hunter('a', [20 * Math.sin(0.6), 0, -20 * Math.cos(0.6)]);
    expect(track(ship, [swung], lock, 1 / 60)).toEqual({ id: 'a', out: 0 });
    expect(track(ship, [swung], null, 1 / 60)).toBeNull(); // (it would not be picked up from there)
    // behind: a moment's grace, then gone
    const behind = hunter('a', [0, 0, 20]);
    expect(track(ship, [behind], lock, 1 / 60)?.id).toBe('a');
    expect(follow(ship, [behind], lock, AIM.lose * 0.5)?.id).toBe('a');
    expect(follow(ship, [behind], lock, AIM.lose + 0.2)).toBeNull();
    // back in before the grace runs out: held, the clock reset
    const half = follow(ship, [behind], lock, AIM.lose * 0.5);
    expect(track(ship, [hunter('a', [0, 0, -20])], half, 1 / 60)).toEqual({ id: 'a', out: 0 });
  });

  it('lets go when the target is gone, and picks up another', () => {
    const lock = track(ship, [hunter('a', [0, 0, -20])], null, 1 / 60);
    expect(track(ship, [], lock, 1 / 60)).toBeNull();
    expect(track(ship, [hunter('b', [2, 0, -15])], lock, 1 / 60)?.id).toBe('b');
  });

  it('cycles round the hunters ahead, nearest the nose first', () => {
    const cands = [hunter('a', [0, 0, -20]), hunter('b', [5, 0, -20]), hunter('c', [-9, 0, -20]), hunter('d', [0, 0, 20])];
    let lock = track(ship, cands, null, 1 / 60);
    expect(lock.id).toBe('a');
    lock = track(ship, cands, lock, 1 / 60, { cycle: true });
    expect(lock.id).toBe('b');
    lock = track(ship, cands, lock, 1 / 60, { cycle: true });
    expect(lock.id).toBe('c');
    lock = track(ship, cands, lock, 1 / 60, { cycle: true }); // round again (never the one behind)
    expect(lock.id).toBe('a');
  });
});

describe('the lead', () => {
  it('is the target itself when it sits still', () => {
    const p = intercept(ship, 20, [0, 0, -10], [0, 0, 0]);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(-10, 6);
    expect(p.t).toBeCloseTo(0.5, 6);
  });

  it('is out ahead of a target crossing the nose, where the bolt meets it', () => {
    const vel = [6, 0, 0];
    const p = intercept(ship, 20, [0, 0, -10], vel);
    expect(p.x).toBeGreaterThan(0);
    // the bolt and the target get there together
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(20 * p.t, 6);
    expect(p.x).toBeCloseTo(vel[0] * p.t, 6);
  });

  it('has no answer for a target it can never catch', () => {
    expect(intercept(ship, 20, [0, 0, -10], [0, 0, -30])).toBeNull();
    expect(intercept(ship, 20, [0, 0, -10], [0, 0, -20])).toBeNull(); // (exactly as fast: never closes)
  });

  it('catches a target running away slower than the bolt', () => {
    const p = intercept(ship, 20, [0, 0, -10], [0, 0, -10]);
    expect(p.t).toBeCloseTo(1, 6);
    expect(p.z).toBeCloseTo(-20, 6);
  });
});

describe('the help onto the lead', () => {
  const ahead = [0, 0, -1];
  const off = (a) => [Math.sin(a), 0, -Math.cos(a)];

  it('bends a shot all the way inside the assist cone, and not at all past the edge', () => {
    expect(assist(ahead, off(AIM.assist * 0.5))).toEqual(off(AIM.assist * 0.5));
    expect(assist(ahead, off(AIM.assistEdge + 0.1))).toEqual(ahead);
  });

  it('bends it part of the way in between, and keeps it a unit vector', () => {
    const mid = (AIM.assist + AIM.assistEdge) / 2;
    const d = assist(ahead, off(mid));
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
    const a = Math.atan2(d[0], -d[2]);
    expect(a).toBeGreaterThan(0.1 * mid);
    expect(a).toBeLessThan(0.9 * mid);
  });

  it('turns a direction back into a heading and a pitch', () => {
    expect(aimAngles([0, 0, -1])).toEqual({ heading: -0, pitch: 0 });
    const { heading, pitch } = aimAngles(nose({ heading: 1.2, pitch: -0.3 }));
    expect(heading).toBeCloseTo(1.2, 6);
    expect(pitch).toBeCloseTo(-0.3, 6);
  });
});

describe('the edge of the screen', () => {
  const rect = { x: 0, y: 100, w: 1000, h: 600 };

  it('puts a marker on the border, in from the edge, on the line out to the thing', () => {
    const right = edgeOf(500, 0, rect);
    expect(right).toEqual({ x: 1000 - 28, y: 400, angle: 0 });
    const up = edgeOf(0, -300, rect);
    expect(up.x).toBe(500);
    expect(up.y).toBe(100 + 28);
    expect(up.angle).toBeCloseTo(-Math.PI / 2, 6);
    const corner = edgeOf(300, 300, rect);
    expect(corner.y).toBeCloseTo(400 + 272, 6);
    expect(corner.x).toBeCloseTo(772, 6);
  });

  it('knows what is on the screen', () => {
    expect(onScreen(500, 400, 10, rect)).toBe(true);
    expect(onScreen(500, 400, -1, rect)).toBe(false); // behind the camera
    expect(onScreen(5, 400, 10, rect)).toBe(false); // too near the edge
    expect(onScreen(500, 690, 10, rect)).toBe(false);
  });
});
