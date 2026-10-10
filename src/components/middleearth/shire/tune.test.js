import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHouse } from '../../../lib/three/house';
import { shireTuning } from './tune';
import { MOODS } from './sky';

const fake = () => {
  const house = createHouse();
  const grass = { uniforms: { uGrassHeight: { value: 0.55 }, uGrassWidth: { value: 0.07 }, uGrassRoot: { value: 0.5 } } };
  const wind = { uniforms: { uWindStrength: { value: 0.45 }, uWindDir: { value: new THREE.Vector2(1, 0) } }, set(o) {
    if (o.strength != null) this.uniforms.uWindStrength.value = o.strength;
    if (o.angle != null) this.uniforms.uWindDir.value.set(Math.cos(o.angle), Math.sin(o.angle));
  } };
  const lens = { walk: 38 };
  return { house, grass, wind, lens, moods: structuredClone(MOODS) };
};

describe('tuning the Shire by eye', () => {
  it('takes the house’s look group, with the moods’ shadows in place of the one shade', () => {
    const look = shireTuning(fake())[0].items.map((i) => i.key);
    expect(look).toEqual(expect.arrayContaining(['dayShadow', 'dawnShadow', 'nightShadow', 'edgeFrom', 'edgeTo', 'mix', 'bounce', 'fogLow', 'fogHigh', 'fogBelow', 'exposure']));
    // (what the scene writes every frame isn’t a slider: the one shade, the sky in the fog)
    expect(look).not.toContain('shadow');
    expect(look).not.toContain('fogMix');
  });

  it('binds the look, the grass, the wind and the lens', () => {
    const groups = shireTuning(fake());
    expect(groups.map((g) => g.name)).toEqual(['look', 'grass', 'wind', 'lens']);
  });

  it('reads and writes the live values', () => {
    const f = fake();
    const groups = shireTuning(f);
    const item = (g, k) => groups.find((x) => x.name === g).items.find((i) => i.key === k);
    // (the day's shadow is the mood's: the atmosphere writes it each frame)
    expect(item('look', 'dayShadow').get()).toBe('#9d93c4');
    item('look', 'dayShadow').set('#112233');
    expect(f.moods.day.shadow).toBe(0x112233);
    item('look', 'exposure').set(1.6);
    expect(f.house.exposure).toBe(1.6);
    item('look', 'edgeTo').set(0.7);
    expect(f.house.uniforms.uLookEdge.value.y).toBe(0.7);
    item('grass', 'height').set(0.8);
    expect(f.grass.uniforms.uGrassHeight.value).toBe(0.8);
    item('wind', 'angle').set(Math.PI / 2);
    expect(f.wind.uniforms.uWindDir.value.y).toBeCloseTo(1, 6);
    expect(item('wind', 'angle').get()).toBeCloseTo(Math.PI / 2, 6);
    item('lens', 'walk').set(30);
    expect(f.lens.walk).toBe(30);
  });
});
