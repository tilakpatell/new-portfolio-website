import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEdorasFolk } from './folk';
import { HOST_FILES, bannerShader, hostPlaces } from './host';
import { toHalf, vatLayout } from '../../../../lib/three/vat';

const LAMBERT = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };
const LAYOUT = { lane: 7, row: 3.6, col: 2.6, wing: 22 };
// a material's rewrite run on three's own chunks, as three would run it
const compiled = (m) => {
  const sh = { uniforms: {}, ...LAMBERT };
  m.onBeforeCompile(sh, null);
  return sh.vertexShader;
};

// stand-ins for the four files: a few bones, a few frames, every matrix the identity
const VATS = {
  [HOST_FILES.horseVat]: { bones: 3, frames: 6, fps: 24, clips: { WalkSlow: [0, 4], Run: [4, 2] }, names: ['root', 'Torso', 'Head'], bin: 'horse.vat.bin' },
  [HOST_FILES.riderVat]: { bones: 3, frames: 4, fps: 24, clips: { ride: [0, 4] }, names: ['Hips', 'RightHand', 'LeftForeArm'], bin: 'rider.vat.bin' },
};
const binOf = ({ bones, frames }) => {
  const { texels } = vatLayout(bones, frames);
  const u = new Uint16Array(texels * 4);
  for (let t = 0; t < texels; t++) u[t * 4 + (t % 3)] = toHalf(1);
  return u.buffer;
};
const vat = async (url) => {
  if (VATS[url]) return VATS[url];
  const meta = Object.values(VATS).find((v) => url.endsWith(v.bin));
  return binOf(meta);
};
const part = (n, bone, color = 0xffffff, withColour = false) => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const count = g.attributes.position.count;
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(count * 4).map((_, i) => (i % 4 ? 0 : bone)), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(count * 4).map((_, i) => (i % 4 ? 0 : 1)), 4));
  if (withColour) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(0.5), 3));
  const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ color }));
  m.name = n;
  return m;
};
const gltf = async (url) => {
  const scene = new THREE.Group();
  if (url === HOST_FILES.horse) scene.add(part('coat', 1), part('mane', 2, 0x111111));
  else if (url === HOST_FILES.rider) scene.add(part('rider', 1, 0xffffff, true));
  return { scene, animations: [] };
};
const LOAD = { gltf, vat };

const made = async (tier, many) => {
  const folk = createEdorasFolk({}, { tier });
  const host = folk.host({ many, layout: LAYOUT, load: LOAD });
  expect(await host.ready).toBe(true);
  return { folk, host };
};
const instanced = (group) => group.children.filter((o) => o.isInstancedMesh);

describe('the host of Rohan', () => {
  it('is two baked crowds and the banners, as many as the tier allows of a thousand', async () => {
    for (const [tier, many] of [['high', 1], ['mid', 0.6], ['low', 0.35]]) {
      const { host } = await made(tier, many);
      const n = Math.min(1000, Math.round(1000 * many));
      expect(host.count).toBe(n);
      const meshes = instanced(host.group);
      expect(meshes).toHaveLength(3);
      const crowds = meshes.filter((m) => m.material.userData.vat);
      expect(crowds.map((m) => m.name).sort()).toEqual(['host-horses', 'host-riders']);
      for (const m of crowds) expect(m.count).toBe(n);
      const flags = meshes.find((m) => !m.material.userData.vat);
      expect(flags.count).toBe(Math.floor((n - 4) / 7) + 1);
      host.dispose();
    }
  });

  it('draws no hand rig: no shader of the host or the banners reads aRig', async () => {
    const { folk, host } = await made('high', 1);
    const mats = [...instanced(host.group).map((m) => m.material), folk.mats.banner, folk.mats.flag];
    for (const m of mats) expect(compiled(m)).not.toContain('aRig');
    for (const m of instanced(host.group).filter((x) => x.material.userData.vat)) expect(compiled(m.material)).toContain('vatBone(');
  });

  it('seats each Rider on his horse: the same matrices, the same frames, and his spear and shield with him', async () => {
    const { host } = await made('high', 1);
    const [horses, riders] = ['host-horses', 'host-riders'].map((n) => host.group.getObjectByName(n));
    expect(Array.from(riders.instanceMatrix.array)).toEqual(Array.from(horses.instanceMatrix.array));
    // (the Rider's texture laid against the Horse's frames)
    expect(riders.material.userData.vat.uVatSize.value.y).toBe(VATS[HOST_FILES.horseVat].frames);
    // (his body's 24 corners, and the spear's and shield's on his bones)
    const rider = riders.geometry.attributes;
    expect(rider.position.count).toBeGreaterThan(24);
    const bones = new Set(Array.from({ length: rider.position.count }, (_, i) => rider.skinIndex.getX(i)));
    expect([...bones].sort()).toEqual([1, 2]);
    // (the coat's shade on each horse)
    expect(horses.instanceColor).toBeTruthy();
  });

  it('breaks into the Run as it rides, horse and Rider on the one clip, and walks again', async () => {
    const { folk, host } = await made('mid', 0.6);
    const [horses, riders] = ['host-horses', 'host-riders'].map((n) => host.group.getObjectByName(n));
    const starts = () => Array.from({ length: host.count }, (_, i) => horses.geometry.attributes.aAnim.array[i * 4]);
    expect(new Set(starts())).toEqual(new Set([0]));
    host.ride(1);
    folk.tick(1);
    folk.tick(1.05);
    expect(new Set(starts())).toEqual(new Set([4]));
    expect(Array.from(riders.geometry.attributes.aAnim.array)).toEqual(Array.from(horses.geometry.attributes.aAnim.array));
    // (each one clip's length a stride: the clock counts strides)
    expect(horses.geometry.attributes.aAnim.array[3]).toBeCloseTo(2 / 24, 6);
    const t = horses.material.userData.vat.uVatTime.value;
    folk.tick(1.1);
    expect(horses.material.userData.vat.uVatTime.value).toBeGreaterThan(t);
    host.ride(0);
    folk.tick(1.15);
    expect(new Set(starts())).toEqual(new Set([0]));
  });

  it('stays empty when a file does not come', async () => {
    const folk = createEdorasFolk({}, { tier: 'high' });
    const host = folk.host({ many: 1, layout: LAYOUT, load: { gltf: async () => null, vat } });
    expect(await host.ready).toBe(false);
    expect(host.group.children).toHaveLength(0);
    folk.tick(0);
    folk.tick(0.1);
  });

  it('stands in two wings either side of the road', () => {
    const p = hostPlaces(88, LAYOUT);
    expect(p).toHaveLength(88);
    expect(p.filter((q) => q.z < 0)).toHaveLength(44);
    for (const q of p) expect(Math.abs(q.z)).toBeGreaterThan(LAYOUT.lane - 1);
  });
});

describe('the banners’ rewrite', () => {
  it('waves the cloth by aCloth, and bobs only when asked', () => {
    const wave = bannerShader(LAMBERT);
    expect(wave.swapped).toEqual({ cloth: true, bob: false });
    expect(wave.vertexShader).toContain('attribute float aCloth;');
    expect(wave.vertexShader).not.toContain('aRig');
    expect(wave.vertexShader).not.toContain('uTime * 1.4');
    const bob = bannerShader(LAMBERT, { bob: true });
    expect(bob.swapped).toEqual({ cloth: true, bob: true });
    expect(bob.vertexShader).toContain('uTime * 1.4');
    expect(bob.fragmentShader).toBe(LAMBERT.fragmentShader);
  });

  it('leaves a shader without the chunks alone', () => {
    const odd = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(bannerShader(odd)).toEqual({ ...odd, swapped: { cloth: false, bob: false } });
  });
});
