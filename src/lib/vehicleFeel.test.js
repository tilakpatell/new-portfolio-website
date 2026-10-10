import { describe, expect, it } from 'vitest';
import { FEEL, createVehicleFeel, feelGroups } from './vehicleFeel';

const DT = 1 / 60;
// steps the feel for `secs` seconds with the same input, the last output back
const run = (feel, secs, input = {}) => {
  let out = null;
  for (let i = 0; i < Math.round(secs / DT); i++) out = feel.step(input, DT);
  return out;
};

describe('FEEL', () => {
  it('is the plan’s table', () => {
    expect(FEEL).toMatchObject({ pitchMax: 0.05, rollMax: 0.11, squashStiffness: 120, squashDamping: 8, squashPerLanding: 0.05, squashPerHit: 0.15, squashMax: 0.3, ease: 12 });
    expect(FEEL.pitchPer).toBeCloseTo(0.05 / 9.81, 9);
    expect(FEEL.rollPer).toBeCloseTo(0.11 / 9.81, 9);
    expect(FEEL.antenna).toEqual({ speedStrength: 10, damping: 0.035, pullBackStrength: 0.02, max: 0.6 });
  });
});

describe('createVehicleFeel', () => {
  it('is still at rest', () => {
    const out = run(createVehicleFeel(), 2);
    for (const v of [out.squash, out.roll, out.pitch, ...out.antenna]) expect(Math.abs(v)).toBeLessThan(1e-6);
  });

  it('pitches back under acceleration, and forward under braking', () => {
    expect(run(createVehicleFeel(), 1, { forwardAccel: 9.81 }).pitch).toBeCloseTo(-0.05, 3);
    expect(run(createVehicleFeel(), 1, { forwardAccel: -100 }).pitch).toBeCloseTo(0.05, 3);
  });

  it('rolls against the lateral acceleration, to its limit', () => {
    expect(run(createVehicleFeel(), 1, { lateralAccel: -9.81 }).roll).toBeCloseTo(0.11, 3);
    expect(run(createVehicleFeel(), 1, { lateralAccel: 50 }).roll).toBeCloseTo(-0.11, 3);
  });

  it('levels out in the air', () => {
    const feel = createVehicleFeel();
    run(feel, 1, { forwardAccel: 9.81, lateralAccel: 9.81 });
    const out = run(feel, 1, { forwardAccel: 9.81, lateralAccel: 9.81, airborne: true });
    expect(Math.abs(out.pitch)).toBeLessThan(1e-3);
    expect(Math.abs(out.roll)).toBeLessThan(1e-3);
  });

  it('squashes on landing and rings down within a second', () => {
    const feel = createVehicleFeel();
    let peak = feel.step({ landed: 4 }, DT).squash;
    for (let i = 0; i < 5; i++) peak = Math.max(peak, feel.step({}, DT).squash);
    expect(peak).toBeGreaterThan(0.1);
    // (a spring: it overshoots, stretching past rest, before it settles)
    let stretch = 0;
    for (let i = 0; i < 30; i++) stretch = Math.min(stretch, feel.step({}, DT).squash);
    expect(stretch).toBeLessThan(-0.01);
    run(feel, 1);
    expect(Math.abs(feel.step({}, DT).squash)).toBeLessThan(0.01);
  });

  it('squashes by a hit’s gain at once, never past its limit', () => {
    expect(createVehicleFeel().step({ hit: 1 }, DT).squash).toBeCloseTo(0.15, 2);
    expect(createVehicleFeel().step({ landed: 40 }, DT).squash).toBeLessThanOrEqual(0.3);
  });

  it('whips the antenna: it lags a start and overshoots a stop', () => {
    const feel = createVehicleFeel();
    expect(feel.step({}, DT).antenna).toEqual([0, 0]);
    const going = run(feel, 0.3, { forwardAccel: 5 });
    expect(going.antenna[0]).toBeGreaterThan(0.1);
    expect(Math.abs(going.antenna[0])).toBeLessThanOrEqual(0.6);
    let crossed = false;
    for (let i = 0; i < 120; i++) if (feel.step({}, DT).antenna[0] < 0) crossed = true;
    expect(crossed).toBe(true);
    expect(run(feel, 1, { lateralAccel: 3 }).antenna[1]).toBeGreaterThan(0.1);
  });

  it('steps at its own fixed rate, so a long frame and short ones agree', () => {
    const a = createVehicleFeel();
    const b = createVehicleFeel();
    for (let i = 0; i < 4; i++) a.step({ forwardAccel: 5 }, DT / 2);
    for (let i = 0; i < 2; i++) b.step({ forwardAccel: 5 }, DT);
    expect(a.step({}, 0).antenna[0]).toBeCloseTo(b.step({}, 0).antenna[0], 9);
  });

  it('takes nothing from a bad number', () => {
    const out = run(createVehicleFeel(), 0.5, { forwardAccel: NaN, lateralAccel: Infinity, landed: NaN, hit: -Infinity });
    for (const v of [out.squash, out.roll, out.pitch, ...out.antenna]) expect(v).toBe(0);
  });

  it('resets, and takes new numbers', () => {
    const feel = createVehicleFeel();
    run(feel, 0.5, { forwardAccel: 9.81, hit: 1 });
    feel.reset();
    const out = feel.step({}, 0);
    for (const v of [out.squash, out.roll, out.pitch, ...out.antenna]) expect(v).toBe(0);
    feel.set({ rollMax: 0.2, antenna: { max: 0.3 } });
    expect(feel.values().rollMax).toBe(0.2);
    expect(feel.values().antenna).toEqual({ ...FEEL.antenna, max: 0.3 });
    expect(run(feel, 1, { lateralAccel: -50 }).roll).toBeCloseTo(0.2, 3);
    expect(FEEL.rollMax).toBe(0.11);
  });
});

describe('feelGroups', () => {
  it('is one group with every number, read and written live', () => {
    const feel = createVehicleFeel();
    const [group, ...rest] = feelGroups(feel);
    expect(rest).toHaveLength(0);
    expect(group.name).toBe('car feel');
    expect(group.items.map((it) => it.key)).toEqual(['pitchPer', 'pitchMax', 'rollPer', 'rollMax', 'ease', 'squashStiffness', 'squashDamping', 'squashPerLanding', 'squashPerHit', 'squashMax', 'antennaSpeedStrength', 'antennaDamping', 'antennaPullBackStrength', 'antennaMax']);
    for (const it of group.items) {
      expect(it.type).toBe('range');
      expect(it.min).toBeLessThanOrEqual(it.get());
      expect(it.max).toBeGreaterThanOrEqual(it.get());
    }
    const max = group.items.find((it) => it.key === 'rollMax');
    max.set(0.2);
    expect(feel.values().rollMax).toBe(0.2);
    expect(max.get()).toBe(0.2);
    const pull = group.items.find((it) => it.key === 'antennaPullBackStrength');
    pull.set(0.05);
    expect(feel.values().antenna.pullBackStrength).toBe(0.05);
    expect(pull.get()).toBe(0.05);
  });
});
