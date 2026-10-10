import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { floatGeometry } from './debris';

describe('floatGeometry', () => {
  it('takes a quantised mesh into its node’s place without clamping it to ±1', () => {
    // the game's way: int16 normalised, interleaved, a node's scale of 1.56 undoing it
    const data = new THREE.InterleavedBuffer(new Int16Array([32767, 0, 0, 0, 0, 32767, 0, 0]), 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0, true));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, 0.5), new THREE.Quaternion(), new THREE.Vector3(1.56, 1.56, 1.56));
    const f = floatGeometry(g, m);
    expect(f.attributes.position.array).toBeInstanceOf(Float32Array);
    expect(f.attributes.position.getX(0)).toBeCloseTo(1.56, 2);
    expect(f.attributes.position.getY(1)).toBeCloseTo(1.56, 2);
    expect(f.attributes.position.getZ(1)).toBeCloseTo(0.5, 2);
    // and the original is left as it was
    expect(g.attributes.position.getX(0)).toBeCloseTo(1, 3);
  });
});
