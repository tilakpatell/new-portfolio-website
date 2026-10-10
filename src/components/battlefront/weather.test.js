import { describe, expect, it } from 'vitest';
import { lightingOf, loadRulebook } from '../../lib/battlefront/rulebook.js';
import { readEntry } from '../../lib/three/light/entry.js';
import { validateLook } from '../worlds/looks.js';
import ve from '../../lib/three/light/fixtures/hoth.ve.json';
import { LOOK } from './look.js';
import { entryFor, lightsJsonOf, readLightRow, unflatten } from './weather.js';

const lighting = lightingOf(loadRulebook(), 'hoth');

describe('the game’s weather, for lane R’s light', () => {
  it('folds a record’s flat fields back into vectors', () => {
    expect(unflatten({ 'SunColor.x': 1, 'SunColor.y': 0.5, 'SunColor.z': 0.25, EV: 10, 'Transform.trans.x': 4, _source: 's' })).toEqual({ SunColor: [1, 0.5, 0.25], EV: 10 });
  });

  it('reads Hoth’s day as lane R’s pinned record does: the sun, its exposure and the fog', () => {
    const ours = readEntry(entryFor(lighting, 'sunny'));
    const pinned = readEntry(ve.sunny);
    expect(ours.sun.intensity).toBeCloseTo(pinned.sun.intensity, 3);
    ours.sun.dir.forEach((v, i) => expect(v).toBeCloseTo(pinned.sun.dir[i], 4));
    ours.fog.curve.forEach((v, i) => expect(v).toBeCloseTo(pinned.fog.curve[i], 4));
    expect(ours.exposure).toBeCloseTo(pinned.exposure, 5);
    // the record's own Rayleigh coefficients, not the pinned file's rounding
    expect(ours.sky.rayleigh[0]).toBeCloseTo(5.8e-6, 9);
  });

  it('falls to the level’s default weather for a name it has not got', () => {
    expect(entryFor(lighting, 'nope').name).toBe(lighting.weathers[lighting.default].ve);
  });

  it('turns a sphere into a point and a spot into a cone along its −forward', () => {
    const p = readLightRow({ kind: 'sphere', at: [1, 2, 3], yaw: 0, pitch: 0, colour: [2, 4, 8], intensity: 1000, radius: 30 });
    expect(p).toMatchObject({ kind: 'point', pos: [1, 2, 3], color: [0.25, 0.5, 1], range: 30 });
    expect(p.candela).toBeCloseTo(1000 / (4 * Math.PI), 6);
    const s = readLightRow({ kind: 'spot', at: [0, 0, 0], yaw: 0, pitch: Math.PI / 2, colour: [1, 1, 1], intensity: 1000, radius: 20, inner: 70, outer: 90 });
    expect(s.kind).toBe('spot');
    s.dir.forEach((v, i) => expect(v).toBeCloseTo([0, -1, 0][i], 6));
    expect(s.cone[1]).toBeCloseTo(Math.PI / 2, 6);
    expect(s.cone[0]).toBeCloseTo((70 * Math.PI) / 180, 6);
  });

  it('bins Hoth’s placed lights by the 128 m cell, every one kept', () => {
    const json = lightsJsonOf(lighting.lights);
    const n = Object.values(json.cells).reduce((a, c) => a + c.length, 0);
    expect(n).toBe(lighting.lights.filter((l) => l.intensity > 0).length);
    expect(json.cell).toBe(128);
  });

  it('brings the brightest placed light (Intensity 65500, EV 10) to a sane strength after exposure', () => {
    const p = readEntry(entryFor(lighting, 'sunny'));
    const k = p.gameToSite;
    const lights = lighting.lights.map(readLightRow).filter(Boolean);
    const top = lights.reduce((a, b) => (b.candela > a.candela ? b : a));
    // the light on a surface at half its reach, against the sun's in the same
    // units: the lamp and the sun share one factor (lane S's calibrate.js put
    // Hoth's sun at the classic stack's 0.79), so the share is what holds
    const lux = (top.candela * k) / (top.range / 2) ** 2;
    expect(lux / p.sun.intensity).toBeGreaterThan(0.5 / 9);
    expect(lux / p.sun.intensity).toBeLessThan(4 / 9);
  });

  it('says its look is its own, with the why', () => {
    expect(validateLook(LOOK)).toEqual([]);
    expect(LOOK.art).toBe('own');
  });
});
