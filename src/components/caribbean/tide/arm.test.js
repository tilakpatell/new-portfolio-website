import { describe, expect, it } from 'vitest';
import { ARM_JOINTS, createArm } from './arm';

const DT = 1 / 60;
const hold = (arm, seconds, pose) => {
  let out = null;
  for (let i = 0; i < seconds / DT; i++) out = arm.step(DT, pose);
  return out;
};
const tipOf = (out) => out.a[ARM_JOINTS];

describe('a kraken’s arm as a chain', () => {
  it('stands straight with nothing asked of it', () => {
    const arm = createArm({ writhe: 0 });
    const out = hold(arm, 2, { fall: 0, curl: 0, droop: 0, t: 0 });
    expect(out.base).toBeCloseTo(0, 3);
    for (const a of out.a) expect(Math.abs(a)).toBeLessThan(1e-3);
    for (const b of out.b) expect(Math.abs(b)).toBeLessThan(1e-3);
  });

  it('curls its tip over when raised, more than its middle', () => {
    const arm = createArm({ writhe: 0 });
    const out = hold(arm, 3, { fall: 0, curl: 1, droop: 0, t: 0 });
    expect(tipOf(out)).toBeGreaterThan(0.8);
    expect(Math.abs(out.a[ARM_JOINTS >> 1])).toBeLessThan(tipOf(out) * 0.4);
    // each joint's angle is the one below it and a little more: a curve, not a kink
    for (let i = ARM_JOINTS - 3; i < ARM_JOINTS; i++) expect(out.a[i + 1]).toBeGreaterThan(out.a[i]);
  });

  it('comes down from the base first, the tip whipping after it', () => {
    const arm = createArm({ writhe: 0 });
    const slam = { fall: 1.45, curl: 0, droop: 1, t: 0 };
    const from = hold(arm, 3, { fall: -0.22, curl: 1, droop: 0, t: 0 });
    const b0 = from.base;
    const t0 = from.base + tipOf(from);
    const to = hold(createArm({ writhe: 0 }), 4, slam);
    const out = hold(arm, 0.08, slam);
    // each of them, how far on its way it's got: the base further than the tip
    const baseGot = (out.base - b0) / (to.base - b0);
    const tipGot = (out.base + tipOf(out) - t0) / (to.base + tipOf(to) - t0);
    expect(out.base).toBeGreaterThan(0.2);
    expect(baseGot).toBeGreaterThan(tipGot * 1.5);
  });

  it('lies down on the water with its tip in it, and rises again', () => {
    const arm = createArm({ writhe: 0 });
    const down = hold(arm, 3, { fall: 1.45, curl: 0, droop: 1, t: 0 });
    expect(down.base + tipOf(down)).toBeGreaterThan(Math.PI / 2);
    const up = hold(arm, 3, { fall: 0, curl: 0, droop: 0, t: 0 });
    expect(Math.abs(up.base + tipOf(up))).toBeLessThan(0.02);
  });

  it('flinches back when struck, and recovers', () => {
    const arm = createArm({ writhe: 0 });
    hold(arm, 2, { fall: 0, curl: 0, droop: 0, t: 0 });
    arm.flinch(1);
    const hit = hold(arm, 0.1, { fall: 0, curl: 0, droop: 0, t: 0 });
    expect(hit.base + tipOf(hit)).toBeLessThan(-0.05);
    const after = hold(arm, 3, { fall: 0, curl: 0, droop: 0, t: 0 });
    expect(Math.abs(after.base + tipOf(after))).toBeLessThan(0.02);
  });

  it('writhes on its own clock, out of step with another, and never runs away', () => {
    const a = createArm({ seed: 1 });
    const b = createArm({ seed: 2 });
    let differ = false;
    for (let i = 0; i < 1200; i++) {
      const t = i * DT;
      // a hard life: thrown between every pose there is, now and then with a big step
      const pose = { fall: [0, -0.22, 1.45, 0.3][Math.floor(t / 1.3) % 4], curl: (Math.floor(t / 0.7) % 2) * 1.2, droop: Math.floor(t / 2.1) % 2, t };
      const dt = i % 97 === 0 ? 0.1 : DT;
      const oa = a.step(dt, pose);
      const ob = b.step(dt, pose);
      for (const v of [oa.base, ...oa.a, ...oa.b]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(3.2);
      }
      if (Math.abs(oa.b[ARM_JOINTS] - ob.b[ARM_JOINTS]) > 1e-3) differ = true;
    }
    expect(differ).toBe(true);
    // the same seed, the same arm
    const c = createArm({ seed: 1 });
    const d = createArm({ seed: 1 });
    const pose = { fall: 0.5, curl: 0.5, droop: 0, t: 1.7 };
    expect(Array.from(c.step(DT, pose).a)).toEqual(Array.from(d.step(DT, pose).a));
  });
});
