import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bakeKey, getBake, putBake } from './bakeCache';

const caster = (x, seg = 1) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, seg, seg, seg));
  m.position.set(x, 0, 0);
  const g = new THREE.Group();
  g.add(m);
  return g;
};
const base = () => ({ world: 'w', place: 'p', sun: new THREE.Vector3(0.3, 0.8, 0.2), tier: 'mid', casters: [caster(0)] });

describe('bakeKey', () => {
  it('is the same for the same inputs', () => {
    expect(bakeKey(base())).toBe(bakeKey(base()));
  });
  it('changes when a caster moves, changes or the setting differs', () => {
    const k = bakeKey(base());
    expect(bakeKey({ ...base(), casters: [caster(2)] })).not.toBe(k);
    expect(bakeKey({ ...base(), casters: [caster(0, 3)] })).not.toBe(k);
    expect(bakeKey({ ...base(), tier: 'high' })).not.toBe(k);
    expect(bakeKey({ ...base(), world: 'x' })).not.toBe(k);
    expect(bakeKey({ ...base(), place: 'q' })).not.toBe(k);
    expect(bakeKey({ ...base(), sun: new THREE.Vector3(0.3, 0.8, 0.5) })).not.toBe(k);
  });
  it('ignores moves below a decimetre and sun jitter below 0.01', () => {
    const k = bakeKey(base());
    expect(bakeKey({ ...base(), casters: [caster(0.02)] })).toBe(k);
    expect(bakeKey({ ...base(), sun: new THREE.Vector3(0.301, 0.8, 0.2) })).toBe(k);
  });
  it('is null without a world', () => {
    expect(bakeKey({ ...base(), world: undefined })).toBeNull();
  });
});

describe('getBake / putBake without IndexedDB', () => {
  it('resolve null / false', async () => {
    expect(await getBake('k')).toBeNull();
    expect(await putBake('k', { width: 1, height: 1, data: new Uint8Array(4) })).toBe(false);
  });
});
