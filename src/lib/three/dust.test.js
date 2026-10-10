import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDust, dustShader } from './dust';

const BASIC = { vertexShader: THREE.ShaderChunk.meshbasic_vert, fragmentShader: THREE.ShaderChunk.meshbasic_frag };

describe('dustShader', () => {
  it('swaps the placing and the cut-out, and says so', () => {
    const out = dustShader(BASIC);
    expect(out.swapped).toBe(true);
    expect(out.vertexShader).not.toContain('#include <project_vertex>');
    expect(out.vertexShader).toContain('aStart');
    expect(out.vertexShader).toContain('aSeed');
    expect(out.vertexShader).toContain('uDustTime');
    expect(out.fragmentShader).not.toContain('#include <map_fragment>');
    expect(out.fragmentShader).toContain('vDustFade');
  });

  it('leaves mvPosition where three’s fog chunk after it can read it', () => {
    const { vertexShader } = dustShader({ vertexShader: THREE.ShaderLib.basic.vertexShader.replace('#include <fog_vertex>', THREE.ShaderChunk.fog_vertex), fragmentShader: THREE.ShaderLib.basic.fragmentShader });
    const at = vertexShader.indexOf('vec4 mvPosition;');
    expect(at).toBeGreaterThan(0);
    // (declared at the shader's own depth, before the block that sets it)
    expect(vertexShader.slice(at).indexOf('{')).toBeGreaterThan(0);
    expect(vertexShader.indexOf('vFogDepth = - mvPosition.z')).toBeGreaterThan(at);
    expect(vertexShader.match(/vec4 mvPosition\b/g)).toHaveLength(1);
  });

  it('leaves a shader it doesn’t know alone', () => {
    const stub = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(dustShader(stub)).toEqual({ ...stub, swapped: false });
  });
});

describe('createDust', () => {
  it('is one instanced draw of `count` cards, none showing', () => {
    const dust = createDust({ count: 16 });
    expect(dust.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(dust.mesh.count).toBe(16);
    expect(dust.mesh.material.transparent).toBe(true);
    expect(dust.mesh.material.depthWrite).toBe(false);
    expect(dust.used).toBe(0);
    dust.dispose();
  });

  it('is drawn only while a puff is in the air', () => {
    const dust = createDust({ count: 4, life: 0.5 });
    expect(dust.mesh.visible).toBe(false);
    dust.burst([0, 0, 0], 2);
    expect(dust.mesh.visible).toBe(true);
    dust.update(0.3);
    expect(dust.mesh.visible).toBe(true);
    dust.update(0.3);
    expect(dust.mesh.visible).toBe(false);
    dust.dispose();
  });

  it('takes slots for a burst and frees them when their life is up', () => {
    const dust = createDust({ count: 16, life: 0.8 });
    dust.burst([1, 2, 3], 3);
    dust.update(0.1);
    dust.burst([0, 0, 0], 3);
    expect(dust.used).toBe(6);
    dust.update(0.8 - 0.1 + 0.01);
    // (the first three are gone; the second three still have a moment)
    expect(dust.used).toBe(3);
    dust.update(0.11);
    expect(dust.used).toBe(0);
    dust.dispose();
  });

  it('puts a burst round where it was, and starts it now', () => {
    const dust = createDust({ count: 8 });
    dust.update(2);
    dust.burst([10, 0, -4], 2);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const starts = dust.mesh.geometry.attributes.aStart;
    let seen = 0;
    for (let i = 0; i < 8; i++) {
      if (starts.getX(i) !== 2) continue;
      seen++;
      dust.mesh.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      expect(p.distanceTo(new THREE.Vector3(10, 0, -4))).toBeLessThanOrEqual(0.3 * Math.sqrt(3) + 1e-9);
    }
    expect(seen).toBe(2);
    dust.dispose();
  });

  it('turns a burst to rise along the up it is given', () => {
    const dust = createDust({ count: 4 });
    dust.burst([0, 0, 0], 1, [1, 0, 0]);
    const m = new THREE.Matrix4();
    dust.mesh.getMatrixAt(0, m);
    const rise = new THREE.Vector3(0, 1, 0).applyMatrix4(m.setPosition(0, 0, 0));
    expect(rise.x).toBeCloseTo(1, 6);
    dust.dispose();
  });

  it('drops what doesn’t fit, and a burst at no place', () => {
    const dust = createDust({ count: 4 });
    dust.burst([0, 0, 0], 10);
    expect(dust.used).toBe(4);
    dust.burst([NaN, 0, 0], 1);
    expect(dust.used).toBe(4);
    dust.dispose();
  });
});
