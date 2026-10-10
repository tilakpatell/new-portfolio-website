import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHouse } from './house';
import { createPuffs, puffFor, puffGeometry, puffShader } from './puffs';
import { createWind } from './wind';

const LAMBERT = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };

// a birch's manifest row (public/kit/naturemega/index.json) and its tones (linear)
const BIRCH = { radius: 4.587, height: 13.293, trunk: 0.208 };
const TONES = [
  [0.4167, 0.0554, 0],
  [0.5303, 0.0706, 0],
];

// a material's rewrite run on three's own Lambert, as three would run it
const compiled = (material) => {
  const sh = { uniforms: {}, ...LAMBERT };
  material.onBeforeCompile(sh, null);
  return sh;
};

describe('puffGeometry', () => {
  it('is his 80 cards in a sphere, lit as the sphere', () => {
    const g = puffGeometry({ seed: 3 });
    expect(g.attributes.position.count).toBe(80 * 6);
    expect(g.attributes.uv.count).toBe(80 * 6);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i += 7) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      expect(v.length()).toBeLessThan(1 + 0.8);
      const nn = new THREE.Vector3().fromBufferAttribute(n, i);
      expect(nn.length()).toBeCloseTo(1, 3);
      // (the normal mostly the sphere's, out from the middle)
      const sphere = v.clone().normalize();
      expect(nn.distanceTo(sphere)).toBeLessThan(0.3);
    }
  });

  it('is the same for a seed', () => {
    expect(Array.from(puffGeometry({ seed: 5 }).attributes.position.array)).toEqual(Array.from(puffGeometry({ seed: 5 }).attributes.position.array));
  });
});

describe('puffShader', () => {
  it('cuts the card out of a blob turned by the wind, two-toned by the light', () => {
    const out = puffShader(LAMBERT);
    expect(out.swapped).toBe(true);
    expect(out.fragmentShader).toContain('windOffset(');
    expect(out.fragmentShader).toContain('2.2');
    expect(out.fragmentShader).toContain('smoothstep(0.0, 1.0, dot(');
    expect(out.fragmentShader).toContain('discard');
  });

  it('with a trunk: the flagged fragments skip the cut-out and take the bark; without the wind the cut-out holds still', () => {
    const out = puffShader(LAMBERT, { trunk: true });
    expect(out.swapped).toBe(true);
    expect(out.vertexShader).toContain('attribute float puffTrunk;');
    expect(out.vertexShader).toContain('vPuffTrunk = puffTrunk;');
    expect(out.fragmentShader).toContain('if (vPuffTrunk < 0.5)');
    expect(out.fragmentShader).toContain('vPuffTrunk > 0.5 ? uPuffBark :');
    expect(out.fragmentShader).toContain('windOffset(');
    const still = puffShader(LAMBERT, { trunk: true, wind: false });
    expect(still.fragmentShader).not.toContain('windOffset(');
    expect(still.fragmentShader).not.toContain('uWindNoise');
    expect(still.fragmentShader).toContain('discard');
    // (his, as the Expanse draws it, unchanged)
    expect(puffShader(LAMBERT, {})).toEqual(puffShader(LAMBERT));
    expect(puffShader(LAMBERT).vertexShader).not.toContain('puffTrunk');
  });
});

describe('puffFor', () => {
  it('is one geometry the size of the tree: a crown of cards on a trunk, ≈ the manifest’s height up and its radius across', () => {
    const { geometry } = puffFor(TONES, BIRCH);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const p = geometry.attributes.position;
    let reach = 0;
    for (let i = 0; i < p.count; i++) reach = Math.max(reach, Math.hypot(p.getX(i), p.getZ(i)));
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(Math.abs(box.max.y - BIRCH.height) / BIRCH.height).toBeLessThan(0.15);
    expect(Math.abs(reach - BIRCH.radius) / BIRCH.radius).toBeLessThan(0.15);
    for (const name of ['position', 'normal', 'uv', 'puffTrunk']) expect(geometry.attributes[name]?.count, name).toBe(p.count);
  });

  it('flags the trunk’s vertices, and only those: a six-sided cylinder of the manifest’s trunk up to the crown', () => {
    const { geometry } = puffFor(TONES, BIRCH);
    const p = geometry.attributes.position;
    const flag = geometry.attributes.puffTrunk;
    let trunk = 0;
    let top = 0;
    for (let i = 0; i < p.count; i++) {
      const f = flag.getX(i);
      expect([0, 1]).toContain(f);
      if (f !== 1) continue;
      trunk += 1;
      top = Math.max(top, p.getY(i));
      expect(Math.hypot(p.getX(i), p.getZ(i))).toBeCloseTo(BIRCH.trunk, 4);
      expect(p.getY(i)).toBeGreaterThanOrEqual(-1e-6);
    }
    expect(trunk).toBe(6 * 2 * 3); // (six sides, two triangles each, open at the ends)
    expect(p.count - trunk).toBe(80 * 6); // (his 80 cards)
    // (the trunk reaches into the crown, not out of its top)
    expect(top).toBeGreaterThan(BIRCH.height * 0.4);
    expect(top).toBeLessThan(BIRCH.height * 0.85);
  });

  it('keeps a bush’s crown off the ground and its trunk inside it', () => {
    const bush = { radius: 1.372, height: 1.347, trunk: 0.85 };
    const { geometry } = puffFor(TONES, bush);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(geometry.boundingBox.max.y).toBeCloseTo(bush.height, 3);
    const p = geometry.attributes.position;
    let thick = 0;
    for (let i = 0; i < p.count; i++) if (geometry.attributes.puffTrunk.getX(i) === 1) thick = Math.max(thick, Math.hypot(p.getX(i), p.getZ(i)));
    expect(thick).toBeLessThan(bush.trunk);
  });

  it('without a trunk radius: no NaN anywhere, and no trunk drawn (the crown alone, as a trunk of 0)', () => {
    const { geometry } = puffFor(TONES, { radius: BIRCH.radius, height: BIRCH.height });
    for (const name of ['position', 'normal', 'uv', 'puffTrunk'])
      for (const v of geometry.attributes[name].array) expect(Number.isFinite(v), name).toBe(true);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    expect(Number.isFinite(geometry.boundingSphere.radius)).toBe(true);
    expect(geometry.boundingBox.max.y).toBeCloseTo(BIRCH.height, 3);
    expect(geometry.attributes.position.count).toBe(80 * 6);
    expect(geometry.attributes.puffTrunk.array.every((f) => f === 0)).toBe(true);
    const none = puffFor(TONES, { radius: BIRCH.radius, height: BIRCH.height, trunk: 0 }).geometry;
    expect(Array.from(none.attributes.position.array)).toEqual(Array.from(geometry.attributes.position.array));
  });

  it('rewrites a Lambert: the trunk’s branch, the tones as linear colours, the bark, his cut-out turned by the wind', () => {
    const wind = createWind();
    const { material } = puffFor(TONES, { ...BIRCH, wind });
    expect(material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(material.map).toBeTruthy(); // (so three gives the shader its UVs)
    expect(material.side).toBe(THREE.DoubleSide);
    const sh = compiled(material);
    expect(sh.vertexShader).toContain('attribute float puffTrunk;');
    expect(sh.fragmentShader).toContain('if (vPuffTrunk < 0.5)');
    expect(sh.fragmentShader).toContain('uPuffBark');
    expect(sh.fragmentShader).toContain('windOffset(');
    expect(sh.uniforms.uPuffA.value.toArray()).toEqual(TONES[0].map((v) => expect.closeTo(v, 6)));
    expect(sh.uniforms.uPuffB.value.toArray()).toEqual(TONES[1].map((v) => expect.closeTo(v, 6)));
    expect(sh.uniforms.uPuffBark.value.toArray()).toEqual([0.16, 0.11, 0.07].map((v) => expect.closeTo(v, 6)));
    expect(sh.uniforms.uWindNoise).toBe(wind.uniforms.uWindNoise);
    expect(sh.uniforms.uPuffBlob.value).toBeInstanceOf(THREE.DataTexture);
    // (a program of its own: his crowns' is 'puff')
    expect(material.customProgramCacheKey()).not.toBe('puff');
    expect(material.customProgramCacheKey()).toContain('puff');
    // and still without a wind
    const still = puffFor(TONES, BIRCH).material;
    const out = compiled(still);
    expect(out.fragmentShader).not.toContain('windOffset(');
    expect(out.uniforms.uWindNoise).toBeUndefined();
    expect(still.customProgramCacheKey()).not.toBe(material.customProgramCacheKey());
    wind.dispose();
  });

  it('shares the white map and the blob across every puff', () => {
    const a = puffFor(TONES, BIRCH);
    const b = puffFor([TONES[1], TONES[0]], { ...BIRCH, seed: 4 });
    expect(b.material.map).toBe(a.material.map);
    expect(compiled(b.material).uniforms.uPuffBlob.value).toBe(compiled(a.material).uniforms.uPuffBlob.value);
    expect(b.material).not.toBe(a.material);
    expect(b.geometry).not.toBe(a.geometry);
  });

  it('wears the house’s look when given a house, the puff after it', () => {
    const house = createHouse();
    const { material } = puffFor(TONES, { ...BIRCH, house });
    expect(material.userData.house).toBe(house.uniforms);
    expect(material.customProgramCacheKey()).toMatch(/\|house.*puff/);
    const sh = compiled(material);
    expect(sh.fragmentShader).toContain('uLookShadow');
    expect(sh.fragmentShader).toContain('if (vPuffTrunk < 0.5)');
    expect(sh.uniforms.uLookShadow).toBe(house.uniforms.uLookShadow);
    expect(sh.uniforms.uPuffA).toBeTruthy();
  });
});

describe('createPuffs', () => {
  it('takes and frees slots, and reuses a freed one', () => {
    const wind = createWind();
    const puffs = createPuffs({ species: { a: 0xb4b536, b: 0xd8cf3b, bark: 0x6b4a32 }, count: 4, wind, facing: [1, 1, 1] });
    expect(puffs.crowns).toBeInstanceOf(THREE.InstancedMesh);
    expect(puffs.trunks.count).toBe(4);
    const a = puffs.take();
    const b = puffs.take();
    expect(a).not.toBe(b);
    puffs.set(a, 10, 2, -3, 1, 0.5);
    const m = new THREE.Matrix4();
    puffs.trunks.getMatrixAt(a, m);
    const at = new THREE.Vector3().setFromMatrixPosition(m);
    expect(at.x).toBeCloseTo(10);
    expect(at.z).toBeCloseTo(-3);
    expect(at.y).toBeCloseTo(2);
    puffs.crowns.getMatrixAt(a, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).y).toBeGreaterThan(5);
    puffs.free(a);
    puffs.trunks.getMatrixAt(a, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).length()).toBe(0);
    expect(puffs.take()).toBe(a);
    puffs.take();
    puffs.take();
    expect(puffs.take()).toBe(-1);
    puffs.dispose();
    wind.dispose();
  });
});
