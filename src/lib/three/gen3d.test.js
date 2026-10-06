import { describe, expect, it } from 'vitest';
import { gen3dFile, gen3dUrl } from './gen3d';

describe('the cut of a made model a device loads', () => {
  it('gives a desktop the .hq cut, a laptop the plain one, a phone the .lo one', () => {
    expect(gen3dFile('x-wing', 'ultra')).toBe('x-wing.hq.glb');
    expect(gen3dFile('x-wing', 'high')).toBe('x-wing.hq.glb');
    expect(gen3dFile('x-wing', 'mid')).toBe('x-wing.glb');
    expect(gen3dFile('x-wing', 'low')).toBe('x-wing.lo.glb');
  });
  it('builds the url under models/gen3d', () => {
    expect(gen3dUrl('cr90', 'low')).toBe('/models/gen3d/cr90.lo.glb');
  });
});
