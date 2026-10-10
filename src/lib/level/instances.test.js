import { describe, expect, it } from 'vitest';
import { INSTANCE_BYTES, cellKey, cellOf, isMirrored, readInstances, writeInstances } from './instances';

// three known transforms: none, a quarter turn about y, and a mirrored one
const S = Math.SQRT1_2;
const known = {
  count: 3,
  position: new Float32Array([1, 2, 3, -130, 0.5, 260, 0, 0, -1]),
  quaternion: new Float32Array([0, 0, 0, 1, 0, S, 0, S, 0, 0, -S, S]),
  scale: new Float32Array([1, 1, 1, 2, 2, 2, -1, 1, 1]),
};

describe('the instance records', () => {
  it('are 32 bytes: position, a packed quaternion, scale', () => {
    expect(INSTANCE_BYTES).toBe(32);
    expect(writeInstances(known).byteLength).toBe(96);
  });

  it('round-trip: positions and scales exact, quaternions to 1/32767, signs kept', () => {
    const back = readInstances(writeInstances(known));
    expect(back.count).toBe(3);
    expect(Array.from(back.position)).toEqual(Array.from(known.position));
    expect(Array.from(back.scale)).toEqual(Array.from(known.scale));
    for (let i = 0; i < 12; i++) expect(back.quaternion[i]).toBeCloseTo(known.quaternion[i], 4);
    // (the third: a negative z, which a sign slip would turn the other way)
    expect(back.quaternion[10]).toBeLessThan(0);
  });

  it('reads a range of a bin: the second instance alone', () => {
    const one = readInstances(writeInstances(known), 1, 1);
    expect(one.count).toBe(1);
    expect(Array.from(one.position)).toEqual([-130, 0.5, 260]);
  });

  it('packs xyzw as Int16 over 32767', () => {
    const v = new DataView(writeInstances(known));
    expect(v.getInt16(32 + 12 + 2, true)).toBe(Math.round(S * 32767));
    expect(v.getInt16(32 + 12 + 6, true)).toBe(Math.round(S * 32767));
  });

  it('knows a mirrored instance by its scale’s sign', () => {
    expect(isMirrored(known.scale, 0)).toBe(false);
    expect(isMirrored(known.scale, 2)).toBe(true);
    expect(isMirrored(new Float32Array([-1, -1, 1]), 0)).toBe(false);
  });

  it('names a cell by where a point falls, 128 m a side', () => {
    expect(cellOf(0, 0)).toEqual([0, 0]);
    expect(cellOf(-0.1, 127.9)).toEqual([-1, 0]);
    expect(cellOf(-130, 260)).toEqual([-2, 2]);
    expect(cellKey(-2, 2)).toBe('-2,2');
  });
});
