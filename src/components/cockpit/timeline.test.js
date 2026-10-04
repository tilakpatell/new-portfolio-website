import { describe, expect, it } from 'vitest';
import { PLANS, flashAt, phaseAt, plan, skipTo, throttleAt } from './timeline';
import { VEHICLES, firstVehicle, parseVehicle, stepVehicle, vehicleById } from './vehicles';

describe('launch timeline', () => {
  it('has a plan for every vehicle, in order', () => {
    for (const v of VEHICLES) {
      const p = PLANS[v.id];
      expect(p).toBeTruthy();
      expect(0).toBeLessThan(p.spool);
      expect(p.spool).toBeLessThan(p.peak);
      expect(p.peak).toBeLessThan(p.end);
    }
    expect(plan('nope')).toBe(PLANS.falcon);
  });

  it('walks through the phases', () => {
    const p = PLANS.falcon;
    expect(phaseAt(p, 0).name).toBe('spool');
    expect(phaseAt(p, p.spool).name).toBe('go');
    expect(phaseAt(p, p.peak).name).toBe('out');
    expect(phaseAt(p, p.end).name).toBe('done');
    expect(phaseAt(p, (p.spool + p.peak) / 2).k).toBeCloseTo(0.5);
  });

  it('flashes at the peak and nowhere near the start', () => {
    for (const p of Object.values(PLANS)) {
      expect(flashAt(p, 0)).toBe(0);
      expect(flashAt(p, p.spool)).toBe(0);
      expect(flashAt(p, p.peak)).toBe(1);
      expect(flashAt(p, p.end)).toBe(0);
      expect(flashAt(p, (p.peak + p.end) / 2)).toBeGreaterThan(0);
    }
  });

  it('only ever speeds up until the peak', () => {
    for (const p of Object.values(PLANS)) {
      let last = -1;
      for (let t = 0; t <= p.peak; t += 25) {
        const v = throttleAt(p, t);
        expect(v).toBeGreaterThanOrEqual(last);
        last = v;
      }
      expect(throttleAt(p, p.peak)).toBe(1);
    }
  });

  it('skips on to just before the flash, never back', () => {
    const p = PLANS.rv;
    expect(skipTo(p, 0)).toBe(p.peak - 350);
    expect(skipTo(p, p.peak - 100)).toBe(p.peak - 100);
    expect(skipTo(p, p.end + 5)).toBe(p.end + 5);
  });
});

describe('vehicles', () => {
  it('knows its own', () => {
    expect(vehicleById('rv').short).toBe('RV');
    expect(parseVehicle('falcon')).toBe('falcon');
    expect(parseVehicle('tardis')).toBe(null);
    expect(parseVehicle(undefined)).toBe(null);
  });

  it('opens in the Falcon first, then somewhere new each time', () => {
    expect(firstVehicle(null)).toBe('falcon');
    for (const last of VEHICLES.map((v) => v.id)) {
      for (const r of [0, 0.4, 0.99]) {
        const next = firstVehicle(last, () => r);
        expect(next).not.toBe(last);
        expect(parseVehicle(next)).toBe(next);
      }
    }
  });

  it('steps round the picker both ways', () => {
    expect(stepVehicle('falcon', 1)).toBe(VEHICLES[1].id);
    expect(stepVehicle('falcon', -1)).toBe(VEHICLES[VEHICLES.length - 1].id);
    expect(stepVehicle(VEHICLES[VEHICLES.length - 1].id, 1)).toBe('falcon');
  });
});
