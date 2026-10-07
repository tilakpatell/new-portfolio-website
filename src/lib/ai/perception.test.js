import { describe, expect, it } from 'vitest';
import { belief, createSenses, forget, sense, share, target } from './perception';

const DT = 1 / 60;
const me = () => ({ pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 1 }, beliefs: {} });
const you = (z, over = {}) => ({ id: 'you', at: { x: 0, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, ...over });
const run = (s, m, world, seconds, opts) => {
  for (let t = 0; t < seconds; t += DT) sense(s, m, typeof world === 'function' ? world(t) : world, DT, opts);
};

describe('sight', () => {
  it('a target in the cone is detected in the timer’s time', () => {
    const s = createSenses({ sight: { range: 30, cone: 0.5, far: 2 } });
    const m = me();
    run(s, m, { targets: [you(15)] }, 0.4);
    expect(belief(m, 'you').confidence).toBeLessThan(0.6);
    run(s, m, { targets: [you(15)] }, 0.7);
    expect(belief(m, 'you').confidence).toBe(1);
    expect(belief(m, 'you').visible).toBe(true);
  });

  it('a target behind, or out of range, is not seen; smell finds one behind', () => {
    const s = createSenses({ sight: { range: 30, cone: 0.5 }, smell: { range: 3 } });
    const m = me();
    run(s, m, { targets: [you(-10)] }, 1);
    expect(belief(m, 'you')).toBeNull();
    run(s, m, { targets: [you(40)] }, 1);
    expect(belief(m, 'you')).toBeNull();
    run(s, m, { targets: [you(-2)] }, 1);
    expect(belief(m, 'you')).not.toBeNull();
  });

  it('a blocked line of sight is not seen; without seesThrough everything in the cone is seen', () => {
    const s = createSenses();
    const m = me();
    run(s, m, { targets: [you(10)] }, 1, { seesThrough: () => false });
    expect(belief(m, 'you')).toBeNull();
    run(s, m, { targets: [you(10)] }, 1);
    expect(belief(m, 'you').confidence).toBe(1);
  });

  it('lost, the belief holds the truth for intuition seconds, then coasts and fades', () => {
    const s = createSenses({ sight: { range: 30, cone: 0.5, far: 1 }, memory: 4, intuition: 2.5 });
    const m = me();
    run(s, m, { targets: [you(10)] }, 2);
    // off behind, moving on at 2 a second along x
    const gone = (t) => ({ targets: [{ id: 'you', at: { x: 2 * t, y: 0, z: -10 }, vel: { x: 2, y: 0, z: 0 } }] });
    run(s, m, gone, 1);
    expect(belief(m, 'you').visible).toBe(false);
    expect(belief(m, 'you').at.x).toBeCloseTo(2, 0);
    expect(belief(m, 'you').confidence).toBe(1);
    run(s, m, (t) => gone(t + 1), 3);
    const b = belief(m, 'you');
    // coasting from where it was at 2.5 s: 5 + 2 × 1.5
    expect(b.at.x).toBeGreaterThan(7);
    expect(b.at.x).toBeLessThan(8.5);
    expect(b.confidence).toBeLessThan(1);
    expect(b.confidence).toBeGreaterThan(0);
    run(s, m, (t) => gone(t + 4), 6);
    expect(belief(m, 'you')).toBeNull();
  });

  it('a long frame fades a belief no further than gone, and a zero frame changes nothing', () => {
    const s = createSenses({ memory: 3 });
    const m = me();
    run(s, m, { targets: [you(5)] }, 1);
    const before = JSON.stringify(m.beliefs);
    sense(s, m, { targets: [you(5)] }, 0);
    expect(JSON.stringify(m.beliefs)).toBe(before);
    sense(s, m, { targets: [] }, 50);
    expect(belief(m, 'you')).toBeNull();
    expect(Number.isNaN(m.now)).toBe(false);
  });

  it('a target never sensed has no belief, and forget drops one', () => {
    const m = me();
    expect(belief(m, 'nobody')).toBeNull();
    expect(target(m)).toBeNull();
    run(createSenses(), m, { targets: [you(5)] }, 1);
    forget(m, 'you');
    expect(belief(m, 'you')).toBeNull();
  });
});

describe('hearing, sharing, choosing', () => {
  it('a shot heard raises a belief without sight to 0.8 at the shot', () => {
    const s = createSenses({ hearing: { range: 20 } });
    const m = me();
    sense(s, m, { targets: [you(-15)], stims: [{ type: 'shot', at: { x: 3, y: 0, z: -15 }, radius: 30, from: 'you', loudness: 1 }] }, DT);
    const b = belief(m, 'you');
    expect(b.confidence).toBeCloseTo(0.8);
    expect(b.at).toEqual({ x: 3, y: 0, z: -15 });
    expect(b.visible).toBe(false);
    // out of earshot: nothing
    const far = me();
    sense(s, far, { targets: [you(-15)], stims: [{ type: 'shot', at: { x: 0, y: 0, z: -60 }, radius: 10, from: 'you', loudness: 1 }] }, DT);
    expect(belief(far, 'you')).toBeNull();
  });

  it('share hands a belief over at lower confidence, never lowering a better one', () => {
    const s = createSenses();
    const a = me();
    const b = me();
    run(s, a, { targets: [you(5)] }, 1);
    expect(share(a, b, 'you').confidence).toBeCloseTo(0.6);
    expect(share(a, b, 'you', { fade: 0.3 }).confidence).toBeCloseTo(0.6);
    expect(share(b, a, 'you').confidence).toBe(1);
    expect(share(a, b, 'nobody')).toBeNull();
  });

  it('target picks the surest hostile', () => {
    const s = createSenses({ sight: { range: 50, cone: -1, far: 10 } });
    const m = me();
    run(s, m, { targets: [{ id: 'near', at: { x: 0, y: 0, z: 5 }, hostile: true }, { id: 'far', at: { x: 0, y: 0, z: 40 }, hostile: true }, { id: 'friend', at: { x: 1, y: 0, z: 1 }, hostile: false }] }, 1);
    expect(target(m).id).toBe('near');
    expect(target(m, { hostile: false }).id).toBe('friend');
  });
});
