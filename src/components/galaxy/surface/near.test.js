import { describe, expect, it } from 'vitest';
import { nearInstances, zoneVisibility } from './near';

describe('the scatter near you', () => {
  it('finds the scatter near you', () => {
    const xs = Float32Array.from([0, 10, 100, -47]);
    const zs = Float32Array.from([0, 0, 0, 0]);
    expect([...nearInstances(xs, zs, 0, 0, 48)]).toEqual([0, 1, 3]);
  });

  it('measures across the ground, both ways', () => {
    const xs = Float32Array.from([30, 30, 0]);
    const zs = Float32Array.from([30, 40, -48.5]);
    expect([...nearInstances(xs, zs, 0, 0, 48)]).toEqual([0]); // (42.4 in, 50 out, 48.5 just out)
  });

  it('stops at a limit, the nearest kept', () => {
    const xs = Float32Array.from([40, 1, 20, 3, 30]);
    const zs = new Float32Array(5);
    expect([...nearInstances(xs, zs, 0, 0, 48, 3)].sort()).toEqual([1, 2, 3]);
  });
});

describe('going in and out', () => {
  it('shows the outdoors or the zones, never both', () => {
    expect(zoneVisibility(true)).toEqual({ outdoors: false, zones: true });
    expect(zoneVisibility(false)).toEqual({ outdoors: true, zones: false });
  });
});
