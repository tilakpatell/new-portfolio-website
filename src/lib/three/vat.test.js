import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVatCrowd, fromHalf, loadVat, packSkinMatrix, skinVertex, toHalf, vatDepthMaterial, vatFrame, vatLayout, vatSample, vatShader, vatSkin, vatTexel } from './vat';
import * as fx from './vat.fixture';

const LAMBERT = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };
const STANDARD = { vertexShader: THREE.ShaderChunk.meshphysical_vert, fragmentShader: THREE.ShaderChunk.meshphysical_frag };
const DEPTH = { vertexShader: THREE.ShaderChunk.depth_vert, fragmentShader: THREE.ShaderChunk.depth_frag };

// a material's rewrite run on three's own chunks, as three would run it
const compiled = (material, stub = LAMBERT) => {
  const sh = { uniforms: {}, ...stub };
  material.onBeforeCompile(sh, null);
  return sh;
};

// the fixture's frames packed as a bake packs them
const bake = () => {
  const layout = vatLayout(2, fx.frames.length);
  const data = new Float32Array(layout.texels * 4);
  fx.frames.forEach((bones, f) => bones.forEach((m, j) => packSkinMatrix(m, data, vatTexel(layout, j, f))));
  return { layout, data };
};

const vertex = (k) => [fx.positions[k * 3], fx.positions[k * 3 + 1], fx.positions[k * 3 + 2]];
const four = (a, k) => Array.from(a.slice(k * 4, k * 4 + 4));

describe('the texture’s layout', () => {
  it('is three texels a bone across and a row a frame', () => {
    expect(vatLayout(24, 60)).toEqual({ width: 72, height: 60, texels: 72 * 60 });
  });

  it('puts bone j of frame f at row f, texel j × 3', () => {
    expect(vatTexel(vatLayout(24, 60), 5, 2)).toBe(2 * 72 + 15);
  });

  it('packs a matrix’s top three rows and reads them back', () => {
    const layout = vatLayout(3, 4);
    const data = new Float32Array(layout.texels * 4);
    const m = new Float32Array(16).map(() => Math.random() * 2 - 1);
    m[3] = 0;
    m[7] = 0;
    m[11] = 0;
    m[15] = 1;
    packSkinMatrix(m, data, vatTexel(layout, 2, 3));
    // (row 0 is elements 0, 4, 8, 12 of the column-major array)
    expect(Array.from(data.slice(vatTexel(layout, 2, 3) * 4, vatTexel(layout, 2, 3) * 4 + 4))).toEqual([m[0], m[4], m[8], m[12]]);
    const back = vatSample(data, layout, 2, 3);
    for (let k = 0; k < 16; k++) expect(back[k]).toBeCloseTo(m[k], 6);
    expect([back[3], back[7], back[11], back[15]]).toEqual([0, 0, 0, 1]);
  });
});

describe('which frame an instance shows', () => {
  it('wraps a phase just short of the clip’s length onto its last frame and its first', () => {
    const { f0, f1, t } = vatFrame([10, 5, (0.999 * 5) / 24, 1], 0, 24);
    expect(f0).toBe(14);
    expect(f1).toBe(10);
    expect(t).toBeCloseTo(0.995, 6);
  });

  it('holds a one-frame pose however late, never past its row', () => {
    const { f0, f1, t } = vatFrame([10, 1, 7, 1], 3, 24);
    expect(f0).toBe(10);
    expect(f1).toBe(10);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(1);
    for (const time of [0, 0.01, 0.5, 123.456, 1e5]) {
      const g = vatFrame([10, 1, 0.3, 1.7], time, 24);
      expect([g.f0, g.f1]).toEqual([10, 10]);
    }
  });

  it('wraps a phase of many lengths, and a negative one, inside the clip', () => {
    for (const phase of [5, 50.3, -0.2, -1e-17, 1e4]) {
      for (const time of [0, 0.37, 9.9]) {
        const { f0, f1, t } = vatFrame([10, 5, phase, 1], time, 24);
        expect(f0).toBeGreaterThanOrEqual(10);
        expect(f0).toBeLessThanOrEqual(14);
        expect(f1).toBeGreaterThanOrEqual(10);
        expect(f1).toBeLessThanOrEqual(14);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(1);
      }
    }
  });

  it('runs at speed × fps', () => {
    expect(vatFrame([0, 48, 0, 2], 0.5, 24)).toEqual({ f0: 24, f1: 25, t: 0 });
  });
});

describe('skinning from the texture', () => {
  it('bends the fixture as its own frame-1 matrices do', () => {
    const { layout, data } = bake();
    const sampled = [0, 1].map((j) => vatSample(data, layout, j, 1));
    for (let k = 0; k < 6; k++) {
      const want = skinVertex(vertex(k), four(fx.joints, k), four(fx.weights, k), fx.frames[1]);
      const got = skinVertex(vertex(k), four(fx.joints, k), four(fx.weights, k), sampled);
      for (let c = 0; c < 3; c++) expect(got[c]).toBeCloseTo(want[c], 5);
    }
  });

  it('agrees with three’s own skinning on the same bones (the bake’s convention)', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(fx.positions, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(fx.joints, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(fx.weights, 4));
    const b0 = new THREE.Bone();
    const b1 = new THREE.Bone();
    b1.position.y = 1;
    b0.add(b1);
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshLambertMaterial());
    mesh.add(b0);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([b0, b1]));
    b0.rotation.z = Math.PI / 6;
    b1.rotation.z = Math.PI / 4;
    mesh.updateMatrixWorld(true);
    mesh.skeleton.update();
    const v = new THREE.Vector3();
    for (let k = 0; k < 6; k++) {
      // (a skinned mesh's vertex position is its skinned one)
      mesh.getVertexPosition(k, v);
      const got = skinVertex(vertex(k), four(fx.joints, k), four(fx.weights, k), fx.frames[1]);
      expect(got[0]).toBeCloseTo(v.x, 5);
      expect(got[1]).toBeCloseTo(v.y, 5);
      expect(got[2]).toBeCloseTo(v.z, 5);
    }
  });
});

describe('half floats', () => {
  it('rounds to the nearest half, a tie to the even one', () => {
    // (three's toHalfFloat truncates; a GPU, and this, round)
    const want = [[0, 0], [-0, 0x8000], [1, 0x3c00], [-2, 0xc000], [0.5, 0x3800], [1 / 3, 0x3555], [0.1, 0x2e66], [65504, 0x7bff], [65519, 0x7bff], [2049, 0x6800], [2051, 0x6802], [2047.9, 0x6800], [1234.5678, 0x64d3], [6.103515625e-5, 0x0400], [1e-5, 0x00a8], [6e-8, 0x0001], [3e-8, 0x0001], [2e-8, 0], [1e-9, 0]];
    for (const [f, h] of want) expect([f, toHalf(f)]).toEqual([f, h]);
    // (and never more than a step from three's)
    for (const f of [7.33, -123.4, 0.001, 42.42]) expect(Math.abs(toHalf(f) - THREE.DataUtils.toHalfFloat(f))).toBeLessThanOrEqual(1);
  });

  it('holds what is out of range to the largest half, as three does, never infinity', () => {
    for (const f of [65520, 70000, 1e9, Infinity]) {
      expect(toHalf(f)).toBe(0x7bff);
      expect(toHalf(-f)).toBe(0xfbff);
    }
    expect(toHalf(NaN) & 0x7c00).toBe(0x7c00);
    expect(toHalf(NaN) & 0x3ff).not.toBe(0);
  });

  it('reads back what it wrote, within half’s precision', () => {
    for (const f of [0, 1, -2.5, 0.1, 7.33, -123.4, 6e-8, 65504]) {
      expect(fromHalf(toHalf(f))).toBeCloseTo(f, 1);
      expect(Math.abs(fromHalf(toHalf(f)) - f)).toBeLessThanOrEqual(Math.abs(f) / 2048 + 6e-8);
      expect(fromHalf(toHalf(f))).toBe(THREE.DataUtils.fromHalfFloat(toHalf(f)));
    }
    expect(fromHalf(0x7c00)).toBe(Infinity);
    expect(Number.isNaN(fromHalf(0x7e00))).toBe(true);
  });
});

describe('the shader', () => {
  it('skins a Lambert from the texture, normals too', () => {
    const out = vatShader(LAMBERT, { bones: 24, frames: 60 });
    expect(out.swapped).toEqual({ vat: true });
    expect(out.vertexShader).toContain('vatBone(');
    expect(out.vertexShader).toContain('attribute vec4 aAnim;');
    expect(out.vertexShader).toContain('uniform sampler2D uVat;');
    expect(out.vertexShader).toContain('uniform vec2 uVatSize;');
    expect(out.vertexShader).not.toContain('#include <skinning_vertex>');
    expect(out.vertexShader).not.toContain('#include <skinbase_vertex>');
    expect(out.vertexShader).not.toContain('#include <skinnormal_vertex>');
    expect(out.vertexShader).toContain('objectNormal = mat3(vatSkinMatrix) * objectNormal;');
    expect(out.vertexShader).toContain('transformed = (vatSkinMatrix * vec4(transformed, 1.0)).xyz;');
    // (the instance matrix is project_vertex's, after the skin)
    expect(out.vertexShader.indexOf('vatSkinMatrix * vec4(transformed')).toBeLessThan(out.vertexShader.indexOf('#include <project_vertex>'));
    expect(out.fragmentShader).toBe(LAMBERT.fragmentShader);
  });

  it('wraps its frame with the same mod as vatFrame', () => {
    const vs = vatShader(LAMBERT).vertexShader;
    expect(vs).toContain('mod((uVatTime * aAnim.w + aAnim.z) * uVatFps, aAnim.y)');
    expect(vs).toContain('mod(vatF0 - aAnim.x + 1.0, aAnim.y)');
  });

  it('skins a Standard and a depth pass the same way', () => {
    for (const stub of [STANDARD, DEPTH]) {
      const out = vatShader(stub);
      expect(out.swapped.vat).toBe(true);
      expect(out.vertexShader).toContain('vatBone(');
      expect(out.vertexShader).not.toMatch(/#include <skin(base|normal|ning)_vertex>/);
    }
  });

  it('leaves a shader with no skinning includes alone', () => {
    const stub = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(vatShader(stub)).toEqual({ ...stub, swapped: { vat: false } });
  });
});

const texture = () => new THREE.DataTexture(new Uint16Array(2 * 3 * 4 * 4), 6, 4, THREE.RGBAFormat, THREE.HalfFloatType);

describe('a material skinned from a texture', () => {
  it('runs any earlier hook first, then its own, and keys its program |vat', () => {
    const m = new THREE.MeshLambertMaterial();
    const order = [];
    m.onBeforeCompile = (sh) => {
      order.push('house');
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n// house');
    };
    m.customProgramCacheKey = () => 'house';
    const tex = texture();
    vatSkin(m, { texture: tex, bones: 2, frames: 4, fps: 24, time: 1.5 });
    const sh = compiled(m);
    expect(order).toEqual(['house']);
    expect(sh.vertexShader).toContain('// house');
    expect(sh.vertexShader).toContain('vatBone(');
    expect(sh.uniforms.uVat.value).toBe(tex);
    expect(sh.uniforms.uVatTime.value).toBe(1.5);
    expect(sh.uniforms.uVatFps.value).toBe(24);
    expect(sh.uniforms.uVatSize.value.toArray()).toEqual([6, 4]);
    expect(m.customProgramCacheKey()).toBe('house|vat');
  });

  it('keys a fresh material |vat after three’s own key', () => {
    const m = vatSkin(new THREE.MeshStandardMaterial(), { texture: texture(), bones: 2, frames: 4, fps: 24 });
    expect(m.customProgramCacheKey()).toMatch(/\|vat$/);
    expect(compiled(m, STANDARD).vertexShader).toContain('vatBone(');
  });

  it('gives its shadow a depth twin that shares its clock', () => {
    const m = vatSkin(new THREE.MeshLambertMaterial(), { texture: texture(), bones: 2, frames: 4, fps: 24 });
    const d = vatDepthMaterial(m.userData.vat);
    expect(d).toBeInstanceOf(THREE.MeshDepthMaterial);
    expect(d.depthPacking).toBe(THREE.RGBADepthPacking);
    const sh = compiled(d, DEPTH);
    expect(sh.vertexShader).toContain('vatBone(');
    m.userData.vat.uVatTime.value = 9;
    expect(sh.uniforms.uVatTime.value).toBe(9);
  });
});

const VAT = { texture: texture(), bones: 2, frames: 4, fps: 24, clips: { walk: [1, 3], hold: [0, 1] } };
const crowdOf = (count = 4) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(fx.positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(fx.joints, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(fx.weights, 4));
  return { geometry, crowd: createVatCrowd({ geometry, material: new THREE.MeshLambertMaterial(), vat: VAT, count }) };
};

describe('a crowd', () => {
  it('is one instanced mesh with an animation row an instance, its own copy of the geometry', () => {
    const { geometry, crowd } = crowdOf(4);
    expect(crowd.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(crowd.count).toBe(4);
    expect(crowd.mesh.count).toBe(4);
    const a = crowd.mesh.geometry.getAttribute('aAnim');
    expect(a).toBeInstanceOf(THREE.InstancedBufferAttribute);
    expect(a.array).toHaveLength(16);
    expect(geometry.getAttribute('aAnim')).toBeUndefined();
    expect(crowd.mesh.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
  });

  it('places an instance and starts its clip from the texture’s clip table', () => {
    const { crowd } = crowdOf(4);
    const a = crowd.mesh.geometry.getAttribute('aAnim');
    const v0 = a.version;
    const m0 = crowd.mesh.instanceMatrix.version;
    crowd.set(2, { x: 3, y: 1, z: -2, yaw: Math.PI / 2, scale: 2 }, { clip: 'walk', phase: 0.25, speed: 1.5 });
    expect(four(a.array, 2)).toEqual([1, 3, 0.25, 1.5]);
    expect(a.version).toBe(v0 + 1);
    expect(crowd.mesh.instanceMatrix.version).toBe(m0 + 1);
    const m = new THREE.Matrix4();
    crowd.mesh.getMatrixAt(2, m);
    const p = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
    expect(p.x).toBeCloseTo(3, 6);
    expect(p.y).toBeCloseTo(1, 6);
    expect(p.z).toBeCloseTo(-4, 6);
  });

  it('switches a clip without touching the matrices, keeping phase and speed unless told', () => {
    const { crowd } = crowdOf(4);
    crowd.set(1, { x: 0, y: 0, z: 0, yaw: 0 }, { clip: 'walk', phase: 0.5, speed: 2 });
    const a = crowd.mesh.geometry.getAttribute('aAnim');
    const m0 = crowd.mesh.instanceMatrix.version;
    crowd.setClip(1, { clip: 'hold' });
    expect(four(a.array, 1)).toEqual([0, 1, 0.5, 2]);
    crowd.setClip(1, { clip: 'walk', speed: 1 });
    expect(four(a.array, 1)).toEqual([1, 3, 0.5, 1]);
    expect(crowd.mesh.instanceMatrix.version).toBe(m0);
  });

  it('refuses a clip the texture does not have', () => {
    const { crowd } = crowdOf(2);
    expect(() => crowd.set(0, { x: 0, y: 0, z: 0, yaw: 0 }, { clip: 'fly' })).toThrow(/fly/);
  });

  it('frees an instance by scaling its matrix to nothing', () => {
    const { crowd } = crowdOf(4);
    crowd.set(2, { x: 3, y: 1, z: -2, yaw: 0 }, { clip: 'walk' });
    const a = crowd.mesh.geometry.getAttribute('aAnim');
    const v0 = a.version;
    crowd.free(2);
    const m = new THREE.Matrix4();
    crowd.mesh.getMatrixAt(2, m);
    // (every axis to nought: whatever it was, it draws nothing)
    expect([m.elements[0], m.elements[5], m.elements[10]]).toEqual([0, 0, 0]);
    expect(new THREE.Vector3(1, 1, 1).applyMatrix4(m).toArray()).toEqual([0, 0, 0]);
    expect(a.version).toBe(v0);
  });

  it('advances its one clock', () => {
    const { crowd } = crowdOf(2);
    const u = crowd.mesh.material.userData.vat;
    crowd.update(0.5);
    crowd.update(0.25);
    expect(u.uVatTime.value).toBeCloseTo(0.75, 9);
    expect(crowd.mesh.customDepthMaterial.userData.vat).toBe(u);
  });

  it('disposes what it made', () => {
    const { geometry, crowd } = crowdOf(2);
    let gone = 0;
    crowd.mesh.geometry.addEventListener('dispose', () => gone++);
    crowd.mesh.customDepthMaterial.addEventListener('dispose', () => gone++);
    geometry.addEventListener('dispose', () => gone += 10);
    crowd.dispose();
    expect(gone).toBe(2);
  });
});

describe('loading a baked texture', () => {
  it('reads the json and its bin into a half-float texture', async () => {
    const half = new Uint16Array(vatLayout(2, 4).texels * 4).map((_, k) => toHalf(k / 8));
    const asked = [];
    const load = async (url) => {
      asked.push(url);
      return url.endsWith('.json') ? { bones: 2, frames: 4, fps: 24, clips: { walk: [1, 3] }, bin: 'horse.vat.bin' } : half.buffer;
    };
    const vat = await loadVat('/kit/farm/horse.vat.json', { load });
    expect(asked).toEqual(['/kit/farm/horse.vat.json', '/kit/farm/horse.vat.bin']);
    expect(vat.bones).toBe(2);
    expect(vat.frames).toBe(4);
    expect(vat.fps).toBe(24);
    expect(vat.clips).toEqual({ walk: [1, 3] });
    const t = vat.texture;
    expect(t).toBeInstanceOf(THREE.DataTexture);
    expect([t.image.width, t.image.height]).toEqual([6, 4]);
    expect(t.type).toBe(THREE.HalfFloatType);
    expect(t.format).toBe(THREE.RGBAFormat);
    expect([t.minFilter, t.magFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
    expect(t.generateMipmaps).toBe(false);
    expect(t.version).toBeGreaterThan(0);
    expect(t.image.data).toBeInstanceOf(Uint16Array);
    expect(t.image.data[5]).toBe(toHalf(5 / 8));
  });

  it('refuses a bin the wrong size for its layout', async () => {
    const load = async (url) => (url.endsWith('.json') ? { bones: 2, frames: 4, fps: 24, clips: {}, bin: 'x.vat.bin' } : new ArrayBuffer(10));
    await expect(loadVat('x.vat.json', { load })).rejects.toThrow(/x\.vat\.bin/);
  });
});
