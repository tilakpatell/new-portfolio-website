import { describe, expect, it } from 'vitest';
import { createHouse } from './house';
import { houseGroups } from './houseTuning';

const item = (groups, k) => groups[0].items.find((i) => i.key === k);

describe('the house look, on the tuning panel', () => {
  it('is one group, `look`, with every value the house reads, and exposure only when given', () => {
    const groups = houseGroups(createHouse());
    expect(groups.map((g) => g.name)).toEqual(['look']);
    expect(groups[0].items.map((i) => i.key)).toEqual(['shadow', 'edgeFrom', 'edgeTo', 'mix', 'bounce', 'fogLow', 'fogHigh', 'fogBelow', 'fogMix']);
    const k = { v: 1.4 };
    const withExposure = houseGroups(createHouse(), { exposure: { get: () => k.v, set: (v) => (k.v = v) } });
    const e = item(withExposure, 'exposure');
    expect(e).toMatchObject({ type: 'range', min: 0.4, max: 3 });
    e.set(2);
    expect(k.v).toBe(2);
    expect(e.get()).toBe(2);
  });

  it('reads the uniforms back as they are', () => {
    const house = createHouse({ shadow: 0x5a4a7a, edge: [0.2, 0.9], mix: 0.75, fogLow: 0x102030, fogBelow: 0.6 });
    const groups = houseGroups(house);
    expect(item(groups, 'shadow').get()).toBe('#5a4a7a');
    expect(item(groups, 'edgeFrom').get()).toBeCloseTo(0.2, 6);
    expect(item(groups, 'edgeTo').get()).toBeCloseTo(0.9, 6);
    expect(item(groups, 'mix').get()).toBe(0.75);
    expect(item(groups, 'fogLow').get()).toBe('#102030');
    expect(item(groups, 'fogBelow').get()).toBe(0.6);
    expect(item(groups, 'bounce').get()).toBe(house.uniforms.uLookBounce.value.y);
  });

  it('writes them live', () => {
    const house = createHouse();
    const groups = houseGroups(house);
    const u = house.uniforms;
    item(groups, 'shadow').set('#336699');
    expect(u.uLookShadow.value.getHexString()).toBe('336699');
    item(groups, 'edgeFrom').set(0.3);
    item(groups, 'edgeTo').set(1.1);
    expect([u.uLookEdge.value.x, u.uLookEdge.value.y]).toEqual([0.3, 1.1]);
    item(groups, 'mix').set(0.5);
    expect(u.uLookMix.value).toBe(0.5);
    item(groups, 'bounce').set(0.2);
    expect(u.uLookBounce.value.y).toBe(0.2);
    item(groups, 'fogHigh').set('#abcdef');
    expect(u.uLookFogHigh.value.getHexString()).toBe('abcdef');
    item(groups, 'fogBelow').set(1.2);
    expect(u.uLookFogBelow.value).toBe(1.2);
    item(groups, 'fogMix').set(0.4);
    expect(u.uLookFogMix.value).toBe(0.4);
  });
});
