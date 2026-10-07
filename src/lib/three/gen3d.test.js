import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ULTRA_CUTS, gen3dFile, gen3dUrl } from './gen3d';

const DIR = new URL('../../../public/models/gen3d/', import.meta.url);

describe('the cut of a made model a device loads', () => {
  it('gives a desktop the .hq cut, a laptop the plain one, a phone the .lo one', () => {
    expect(gen3dFile('x-wing', 'high')).toBe('x-wing.hq.glb');
    expect(gen3dFile('x-wing', 'mid')).toBe('x-wing.glb');
    expect(gen3dFile('x-wing', 'low')).toBe('x-wing.lo.glb');
  });
  it('gives ultra the .ultra cut where the model has one, and the .hq one where not', () => {
    expect(gen3dFile('no-such-model', 'ultra')).toBe('no-such-model.hq.glb');
    expect(gen3dFile('theed', 'ultra', new Set(['theed']))).toBe('theed.ultra.glb');
    expect(gen3dFile('theed', 'high', new Set(['theed']))).toBe('theed.hq.glb');
  });
  it('knows every ultra cut there is, and only those', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.ultra.glb')).map((f) => f.slice(0, -10));
    expect([...ULTRA_CUTS].sort()).toEqual(files.sort());
    for (const name of ULTRA_CUTS) expect(existsSync(new URL(`${name}.hq.glb`, DIR)), `${name}.hq.glb`).toBe(true);
  });
  it('builds the url under models/gen3d', () => {
    expect(gen3dUrl('cr90', 'low')).toBe('/models/gen3d/cr90.lo.glb');
  });
});
