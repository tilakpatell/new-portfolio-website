import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { budget } from '../budgets';
import { detailLevel, modelTexCap } from '../detail';
import { WIND } from './foliage';
import { createPool, kitMaterial, loadKit } from './kit';
import { BROWN, MANIFEST, fakeLoad } from './kit.fixture';
import { coverageTexture, fitTexture } from './textures';

// (the real functions, watched: which maps they're handed, and in what order)
vi.mock('./textures', async (importOriginal) => {
  const t = await importOriginal();
  return { ...t, fitTexture: vi.fn(t.fitTexture), coverageTexture: vi.fn(t.coverageTexture) };
});

const UP = new THREE.Vector3(0, 1, 0);
const HIGH = [budget('high').near, budget('high').mid]; // 70, 220

async function kitOf(opts = {}) {
  const load = opts.load ?? fakeLoad();
  const kit = loadKit('naturemega', { load, manifest: MANIFEST, ...opts });
  await kit.manifest;
  return { kit, load };
}

const camAt = (x = 0, z = 0) => {
  const c = new THREE.PerspectiveCamera();
  c.position.set(x, 30, z);
  return c;
};

// `n` items `d` metres from (cx, cz) across the ground, round a circle
const ring = (n, d, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + d * Math.cos(a), y: 0, z: cz + d * Math.sin(a), yaw: a };
  });

const meshesAt = (pool, level) => pool.group.children.filter((m) => m.userData.level === level);
const where = (mesh, i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.document;
});

describe('loadKit: models and materials', () => {
  it('shares one material a manifest name across models and family files', async () => {
    const { kit } = await kitOf();
    const [b1, b2, b3] = await Promise.all(['Birch_1', 'Birch_2', 'Birch_3'].map((n) => kit.model(n)));
    for (const m of [b1, b2, b3]) {
      expect(m.parts).toHaveLength(2);
      expect(m.parts[0].material).toBe(kit.material('Bark_Birch'));
      expect(m.parts[1].material).toBe(kit.material('Leaves_Birch'));
      expect(m.parts.map((p) => p.part)).toEqual(['bark', 'leaves']);
    }
    // (Birch_3 is in birch-2.glb: the material is the kit's, not the file's)
    expect(kit.material('Bark_Birch').name).toBe('Bark_Birch');
    expect(kit.material('Bark_Birch')).toBeInstanceOf(THREE.MeshLambertMaterial);
  });

  it('loads each file once, from <base>/<pack>/<file>', async () => {
    const { kit, load } = await kitOf();
    await Promise.all([kit.model('Birch_1'), kit.model('Birch_2'), kit.lod1('Birch_1'), kit.model('Birch_1')]);
    expect(load.calls).toEqual(['/kit/naturemega/birch.glb']);
    const other = await kitOf({ base: '/elsewhere' });
    await other.kit.model('Fern_1');
    expect(other.load.calls).toEqual(['/elsewhere/naturemega/fern.glb']);
  });

  it('gives back the manifest’s numbers with the parts', async () => {
    const { kit } = await kitOf();
    const m = await kit.model('Birch_1');
    const row = MANIFEST.models.Birch_1;
    expect(m).toMatchObject({ radius: row.radius, height: row.height, kind: 'tree', tones: row.tones });
    expect((await kit.model('Fern_1')).tones).toBeNull();
  });

  it('bakes a bending part’s node transform into a geometry of its own, in metres, its local the identity', async () => {
    const { kit, load } = await kitOf();
    const { parts } = await kit.model('Birch_1');
    const file = load.scenes['/kit/naturemega/birch.glb'];
    const top = (g) => (g.computeBoundingBox(), g.boundingBox.max.y);
    const near = (got, want) => expect(Math.abs(got - want) / want).toBeLessThan(0.02);
    for (const [i, p] of parts.entries()) {
      expect(p.local.equals(new THREE.Matrix4())).toBe(true);
      expect(p.geometry.attributes.position.array).toBeInstanceOf(Float32Array);
      // (the tree's top where the manifest has it, not the quantised 1)
      near(top(p.geometry), MANIFEST.models.Birch_1.height);
      // the file's own geometry left as the loader gave it
      const src = file.getObjectByName(`Birch_1_${i + 1}`).geometry;
      expect(p.geometry).not.toBe(src);
      expect(top(src)).toBeCloseTo(1, 6);
      expect(p.geometry.attributes.uv.count).toBe(src.attributes.uv.count);
      expect(p.geometry.userData.part).toBe(src.userData.part);
    }
    // the LOD1 at its own node's; a model of one primitive (its node a Mesh) too
    const lod = await kit.lod1('Birch_1');
    expect(lod[1].local.equals(new THREE.Matrix4())).toBe(true);
    near(top(lod[1].geometry), 6.471 + 6.899);
    const fern = await kit.model('Fern_1');
    expect(fern.parts[0].local.equals(new THREE.Matrix4())).toBe(true);
    near(top(fern.parts[0].geometry), MANIFEST.models.Fern_1.height);
  });

  it('keeps a part that doesn’t bend as it was: the file’s geometry, its node’s transform in its local', async () => {
    const { kit, load } = await kitOf();
    const [rock] = (await kit.model('Rock_1')).parts;
    expect(rock.geometry).toBe(load.scenes['/kit/naturemega/rock.glb'].getObjectByName('Rock_1').geometry);
    const t = new THREE.Vector3();
    const s = new THREE.Vector3();
    rock.local.decompose(t, new THREE.Quaternion(), s);
    expect([t.y, s.x]).toEqual([expect.closeTo(0.45, 6), expect.closeTo(0.6, 6)]);
    expect(new THREE.Vector3(0, 1, 0).applyMatrix4(rock.local).y).toBeCloseTo(MANIFEST.models.Rock_1.height, 3);
  });

  it('bends a crown in metres: the shader’s sums at a crown vertex give the whole bend, where the file’s geometry gave next to none', async () => {
    const { kit, load } = await kitOf();
    const crown = (await kit.model('Birch_1')).parts[1].geometry;
    const src = load.scenes['/kit/naturemega/birch.glb'].getObjectByName('Birch_1_2').geometry;
    // (foliage.js windShader, before the instance matrix: wH = clamp(y / height), wBend = wH² × weight)
    const bend = (g, i) => {
      const h = Math.min(1, Math.max(0, g.attributes.position.getY(i) / WIND.tree.height));
      return h * h * g.attributes._wind.getX(i);
    };
    const y = Array.from({ length: crown.attributes.position.count }, (_, i) => crown.attributes.position.getY(i));
    const top = y.indexOf(Math.max(...y));
    expect(y[top]).toBeCloseTo(MANIFEST.models.Birch_1.height, 2);
    expect(bend(crown, top)).toBeCloseTo(1, 3);
    // (the file's geometry, as the pools drew it before: its node's ×6.9 came after the bend, (1/7)²)
    expect(bend(src, top)).toBeLessThan(0.03);
  });

  it('bakes positions and normals as the loader gives them from the files: normalised shorts and bytes, interleaved', async () => {
    const plain = fakeLoad();
    // (each a view of its own, padded to four bytes a vertex as meshopt's are)
    const packed = (a, Type, max, stride) => {
      const data = new THREE.InterleavedBuffer(new Type(a.count * stride), stride);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) data.array[i * stride + c] = Math.round(a.getComponent(i, c) * max);
      return new THREE.InterleavedBufferAttribute(data, 3, 0, true);
    };
    const quantised = async (url) => {
      const got = await plain(url);
      const g = got.scene.getObjectByName('Birch_1_2')?.geometry;
      if (g) {
        g.setAttribute('position', packed(g.attributes.position, Int16Array, 32767, 4));
        g.setAttribute('normal', packed(g.attributes.normal, Int8Array, 127, 4));
      }
      return got;
    };
    const { kit } = await kitOf({ load: quantised });
    const crown = (await kit.model('Birch_1')).parts[1].geometry;
    expect(crown.attributes.position.isInterleavedBufferAttribute).toBeFalsy();
    expect(crown.attributes.position.array).toBeInstanceOf(Float32Array);
    crown.computeBoundingBox();
    expect(crown.boundingBox.max.y).toBeCloseTo(MANIFEST.models.Birch_1.height, 3);
    expect(new THREE.Vector3().fromBufferAttribute(crown.attributes.normal, 0).toArray()).toEqual([0, 0, 1].map((v) => expect.closeTo(v, 5)));
  });

  it('turns a bending part’s normals with its node', async () => {
    const plain = fakeLoad();
    const turned = async (url) => {
      const got = await plain(url);
      got.scene.getObjectByName('Birch_1').rotation.y = Math.PI / 2;
      return got;
    };
    const { kit } = await kitOf({ load: turned });
    const { parts } = await kit.model('Birch_1');
    const n = new THREE.Vector3().fromBufferAttribute(parts[0].geometry.attributes.normal, 0);
    // ((0, 0, 1) a quarter turn about up)
    expect(n.toArray()).toEqual([1, 0, 0].map((v) => expect.closeTo(v, 5)));
  });

  it('reads a part’s place from the file’s root, wherever a shared scene was put', async () => {
    const plain = fakeLoad();
    const moved = async (url) => {
      const got = await plain(url);
      got.scene.position.set(50, 0, -20);
      got.scene.updateMatrixWorld(true);
      return got;
    };
    const { kit } = await kitOf({ load: moved });
    const { parts } = await kit.model('Birch_1');
    const box = parts[0].geometry.boundingBox ?? (parts[0].geometry.computeBoundingBox(), parts[0].geometry.boundingBox);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0.211, 3);
    expect(new THREE.Vector3().setFromMatrixPosition((await kit.model('Rock_1')).parts[0].local).x).toBeCloseTo(0, 6);
  });

  it('bakes each geometry once a kit, so two pools of a model draw one copy', async () => {
    const { kit } = await kitOf();
    const a = createPool(kit, 'Birch_1', { bands: HIGH, lod1: true });
    const b = createPool(kit, 'Birch_1', { bands: HIGH, lod1: true });
    await Promise.all([a.ready, b.ready]);
    expect(meshesAt(a, 0).map((m) => m.geometry)).toEqual(meshesAt(b, 0).map((m) => m.geometry));
    expect(meshesAt(a, 0)[0].geometry).toBe((await kit.model('Birch_1')).parts[0].geometry);
  });

  it('gives LOD1 parts in the same materials, and no LOD1 for a rig', async () => {
    const { kit } = await kitOf();
    const full = await kit.model('Birch_1');
    const lod = await kit.lod1('Birch_1');
    expect(lod).toHaveLength(2);
    expect(lod[0].material).toBe(full.parts[0].material);
    expect(lod[0].geometry).not.toBe(full.parts[0].geometry);
    expect(lod[0].geometry.attributes.position.count).toBeLessThan(full.parts[0].geometry.attributes.position.count);
    await expect(kit.lod1('Critter')).rejects.toThrow(/LOD1/);
  });

  it('fills a missing wind weight with ones, and keeps one a file has', async () => {
    const { kit, load } = await kitOf();
    const b1 = await kit.model('Birch_1');
    const b2 = await kit.model('Birch_2');
    const filled = b2.parts[1].geometry.attributes._wind;
    expect(filled.count).toBe(b2.parts[1].geometry.attributes.position.count);
    for (let i = 0; i < filled.count; i++) expect(filled.getX(i)).toBe(1);
    expect(b1.parts[1].geometry.attributes._wind.getX(0)).toBeCloseTo(36 / 255, 6);
    // (on the kit's own copy: the file's geometry is never given one)
    expect(load.scenes['/kit/naturemega/birch.glb'].getObjectByName('Birch_2_2').geometry.attributes._wind).toBeUndefined();
    // every geometry a weighted material wears has the weight
    for (const name of ['Birch_1', 'Birch_2', 'Birch_3', 'Fern_1', 'Rock_1']) {
      for (const p of [...(await kit.model(name)).parts, ...(await kit.lod1(name))]) {
        if (p.material.userData.wind) expect(p.geometry.attributes._wind, name).toBeTruthy();
      }
    }
  });

  it('bends bark and leaves together by the weight, a shrub as a shrub, and stone not at all', async () => {
    const time = { value: 3 };
    const { kit } = await kitOf({ wind: { time } });
    await Promise.all(['Birch_1', 'Fern_1', 'Rock_1'].map((n) => kit.model(n)));
    for (const name of ['Bark_Birch', 'Leaves_Birch', 'Leaves']) {
      const m = kit.material(name);
      expect(m.userData.wind, name).toBeTruthy();
      expect(m.userData.wind.uWindTime).toBe(time);
      expect(m.customProgramCacheKey()).toContain('|wind|w:_wind');
    }
    expect(kit.material('Bark_Birch').userData.wind.uWindHeight.value).toBe(WIND.tree.height);
    expect(kit.material('Leaves').userData.wind.uWindHeight.value).toBe(WIND.shrub.height);
    expect(kit.material('Rocks').userData.wind).toBeUndefined();
  });

  it('cuts leaves out at 0.3, two-sided and lit as one crown; bark solid', async () => {
    const { kit } = await kitOf();
    await kit.model('Birch_1');
    const leaf = kit.material('Leaves_Birch');
    expect(leaf.alphaTest).toBe(0.3);
    expect(leaf.side).toBe(THREE.DoubleSide);
    expect(leaf.userData.faceless).toBe(true);
    const bark = kit.material('Bark_Birch');
    expect(bark.alphaTest).toBe(0);
    expect(bark.userData.faceless).toBeUndefined();
    expect(bark.side).toBe(THREE.DoubleSide); // (as the file has it)
  });

  it('takes the maps and the colour from the first file that wears the name', async () => {
    const { kit, load } = await kitOf();
    await kit.model('Birch_1');
    await kit.model('Birch_3');
    const file = load.scenes['/kit/naturemega/birch.glb'];
    const src = file.getObjectByName('Birch_1_1').material;
    const bark = kit.material('Bark_Birch');
    expect(bark.map).toBe(src.map);
    expect(bark.normalMap).toBe(src.normalMap);
    expect(bark.normalScale.toArray()).toEqual([1, -1]);
    // a rig's (a farm animal's) look is its colour: no map at all
    const critter = await kit.model('Critter');
    const coat = critter.parts[0].material;
    expect(coat).toBe(kit.material('Brown'));
    expect(coat.map).toBeNull();
    expect(coat.color.getHex()).toBe(BROWN);
    expect(coat.vertexColors).toBe(false);
  });

  it('builds on the house’s material when given a house', async () => {
    const house = { material: vi.fn((o) => new THREE.MeshLambertMaterial(o)) };
    const { kit } = await kitOf({ house });
    const leaf = kit.material('Leaves_Birch');
    expect(house.material).toHaveBeenCalledWith(expect.objectContaining({ alphaTest: 0.3, side: THREE.DoubleSide }));
    expect(house.material.mock.results.map((r) => r.value)).toContain(leaf);
  });

  it('kitMaterial: a fresh material each call, its wind on the weight', () => {
    const def = MANIFEST.materials.Leaves_Birch;
    const a = kitMaterial(def);
    const b = kitMaterial(def);
    expect(a).not.toBe(b);
    expect(a.customProgramCacheKey()).toContain('|wind|w:_wind');
    expect(kitMaterial(MANIFEST.materials.Rocks).userData.wind).toBeUndefined();
  });

  it('wants the manifest in, and a name it has', async () => {
    const pending = loadKit('naturemega', { load: fakeLoad(), manifest: new Promise(() => {}) });
    expect(() => pending.material('Bark_Birch')).toThrow(/manifest/);
    const { kit } = await kitOf();
    expect(() => kit.material('Marble')).toThrow(/Marble/);
    await expect(kit.model('Oak_9')).rejects.toThrow(/Oak_9/);
  });

  it('fetches the manifest by default, and says which one it couldn’t', async () => {
    const fetch = vi.fn(async (url) => (url.endsWith('/naturemega/index.json') ? { ok: true, json: async () => MANIFEST } : { ok: false, status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const kit = loadKit('naturemega', { load: fakeLoad() });
    expect(await kit.manifest).toEqual(MANIFEST);
    expect(fetch).toHaveBeenCalledWith('/kit/naturemega/index.json');
    await expect(loadKit('nowhere', { load: fakeLoad() }).manifest).rejects.toThrow('/kit/nowhere/index.json');
  });

  it('rejects a model whose file won’t load, naming the file', async () => {
    const manifest = { ...MANIFEST, models: { ...MANIFEST.models, Lost_1: { ...MANIFEST.models.Birch_1, file: 'lost.glb' } } };
    const { kit } = await kitOf({ manifest });
    await expect(kit.model('Lost_1')).rejects.toThrow('/kit/naturemega/lost.glb');
  });

  it('gives a rig’s parts', async () => {
    const { kit } = await kitOf();
    const { parts, kind } = await kit.model('Critter');
    expect(kind).toBe('character');
    expect(parts).toHaveLength(1);
  });

  it('frees only what it built when disposed of: its materials and the geometry it baked', async () => {
    const { kit, load } = await kitOf();
    const b1 = await kit.model('Birch_1');
    const b2 = await kit.model('Birch_2');
    const rock = await kit.model('Rock_1');
    const mine = vi.fn();
    const baked = vi.fn();
    const files = vi.fn();
    for (const p of [...b1.parts, ...b2.parts, ...rock.parts]) p.material.addEventListener('dispose', mine);
    for (const p of [...b1.parts, ...b2.parts]) p.geometry.addEventListener('dispose', baked);
    for (const url of ['/kit/naturemega/birch.glb', '/kit/naturemega/rock.glb']) load.scenes[url].traverse((o) => o.geometry?.addEventListener('dispose', files));
    b1.parts[1].material.map.addEventListener('dispose', files);
    b1.parts[0].material.normalMap.addEventListener('dispose', files);
    kit.dispose();
    expect(mine).toHaveBeenCalledTimes(3); // (the kit's bark, leaves and stone)
    expect(baked).toHaveBeenCalledTimes(4); // (each birch's bark and crown, in metres)
    expect(files).not.toHaveBeenCalled(); // (the page's model cache owns those, the rock's geometry with them)
  });

  it('shares a cached file with another kit of the pack: its maps covered once, its geometry never changed', async () => {
    const plain = fakeLoad();
    const cache = new Map();
    const load = (url) => {
      if (!cache.has(url)) cache.set(url, plain(url));
      return cache.get(url);
    };
    coverageTexture.mockClear();
    const a = (await kitOf({ load })).kit;
    const b = (await kitOf({ load })).kit;
    const pa = (await a.model('Birch_2')).parts;
    const pb = (await b.model('Birch_2')).parts;
    const leaf = a.material('Leaves_Birch').map;
    expect(b.material('Leaves_Birch').map).toBe(leaf);
    expect(b.material('Leaves_Birch')).not.toBe(a.material('Leaves_Birch'));
    expect(coverageTexture.mock.calls.filter(([t]) => t === leaf)).toHaveLength(1);
    expect(leaf.userData.covered).toBe(true);
    // (each kit's crown its own, weight and all: one kit gone takes nothing of the other's)
    expect(pb[1].geometry).not.toBe(pa[1].geometry);
    const freed = vi.fn();
    pb[1].geometry.addEventListener('dispose', freed);
    a.dispose();
    expect(freed).not.toHaveBeenCalled();
    expect(pb[1].geometry.attributes._wind.getX(0)).toBe(1);
    const src = (await cache.get('/kit/naturemega/birch.glb')).scene.getObjectByName('Birch_2_2').geometry;
    expect(src.attributes._wind).toBeUndefined();
    b.dispose();
    expect(freed).toHaveBeenCalledTimes(1);
  });
});

describe('loadKit: the leaf maps’ coverage mips', () => {
  it('fits a leaf map under the device’s ceiling before its coverage mips; bark maps are the loader’s', async () => {
    fitTexture.mockClear();
    coverageTexture.mockClear();
    const { kit } = await kitOf();
    await kit.model('Birch_1');
    const leaf = kit.material('Leaves_Birch').map;
    const fit = fitTexture.mock.calls.findIndex(([t]) => t === leaf);
    const cover = coverageTexture.mock.calls.findIndex(([t]) => t === leaf);
    expect(fitTexture.mock.calls[fit]).toEqual([leaf, modelTexCap()]);
    expect(coverageTexture.mock.calls[cover]).toEqual([leaf, { cut: 0.3 }]);
    expect(fitTexture.mock.invocationCallOrder[fit]).toBeLessThan(coverageTexture.mock.invocationCallOrder[cover]);
    const bark = kit.material('Bark_Birch').map;
    expect(fitTexture.mock.calls.some(([t]) => t === bark)).toBe(false);
    expect(coverageTexture.mock.calls.some(([t]) => t === bark)).toBe(false);
  });

  it('in Node (no canvas) leaves the chip’s mips and says nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { kit } = await kitOf();
    await Promise.all([kit.model('Birch_1'), kit.model('Fern_1')]);
    expect(kit.material('Leaves_Birch').map.generateMipmaps).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('in a browser, paints the coverage mips', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = {
      drawImage() {},
      putImageData() {},
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      // (a leaf in the left half of every row)
      getImageData: (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) data[i * 4 + 3] = i % w < w / 2 ? 255 : 0;
        return { data };
      },
    };
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    const image = { width: 8, height: 8, getContext: () => ctx };
    const { kit } = await kitOf({ load: fakeLoad({ image }) });
    await kit.model('Birch_1');
    const map = kit.material('Leaves_Birch').map;
    expect(map.generateMipmaps).toBe(false);
    expect(map.mipmaps).toHaveLength(4); // 8, 4, 2, 1
    expect(warn).not.toHaveBeenCalled();
  });

  it('in a browser, says once when a canvas won’t give a leaf map’s pixels up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.document = {
      createElement: () => ({
        getContext() {
          throw new Error('tainted');
        },
      }),
    };
    const image = { width: 8, height: 8, getContext() {} };
    const { kit } = await kitOf({ load: fakeLoad({ image }) });
    await Promise.all([kit.model('Birch_1'), kit.model('Fern_1')]);
    expect(kit.material('Leaves_Birch').map.generateMipmaps).toBe(true);
    expect(kit.material('Leaves').map.generateMipmaps).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('createPool', () => {
  let kit;
  beforeEach(async () => {
    ({ kit } = await kitOf());
  });

  async function poolOf(name = 'Birch_1', opts = {}) {
    const pool = createPool(kit, name, { bands: HIGH, lod1: true, wait: 0.5, ...opts });
    await pool.ready;
    return pool;
  }

  function threeRings(pool) {
    pool.set('a', ring(10, 10));
    pool.set('b', ring(10, 100));
    pool.set('c', ring(10, 300));
    pool.update(camAt(0, 0), 0);
  }

  it('draws each item at the level its distance calls for', async () => {
    const pool = await poolOf();
    threeRings(pool);
    expect(pool.stats.total).toBe(30);
    expect(pool.stats.levels).toEqual([10, 10, 10]);
    for (const level of [0, 1, 2]) {
      const meshes = meshesAt(pool, level);
      expect(meshes).toHaveLength(2);
      for (const m of meshes) expect(m.count).toBe(10);
    }
  });

  it('draws the full parts near, the LOD1 parts mid, and the LOD1 again (its own meshes) as the puff till one is given', async () => {
    const pool = await poolOf();
    const full = (await kit.model('Birch_1')).parts;
    const lod = await kit.lod1('Birch_1');
    expect(meshesAt(pool, 0).map((m) => m.geometry)).toEqual(full.map((p) => p.geometry));
    expect(meshesAt(pool, 1).map((m) => m.geometry)).toEqual(lod.map((p) => p.geometry));
    expect(meshesAt(pool, 2).map((m) => m.geometry)).toEqual(lod.map((p) => p.geometry));
    for (const m of meshesAt(pool, 2)) expect(meshesAt(pool, 1)).not.toContain(m);
    expect(meshesAt(pool, 0)[1].material).toBe(kit.material('Leaves_Birch'));
  });

  it('draws the puff at level 2 when given one', async () => {
    const puff = { geometry: new THREE.BufferGeometry(), material: new THREE.MeshLambertMaterial() };
    const pool = await poolOf('Birch_1', { puff });
    threeRings(pool);
    const [m] = meshesAt(pool, 2);
    expect(meshesAt(pool, 2)).toHaveLength(1);
    expect(m.geometry).toBe(puff.geometry);
    expect(m.material).toBe(puff.material);
    expect(m.count).toBe(10);
    // (the puff is in the tree's own frame: no local of its own)
    const p = where(m, 0);
    expect(p.x).toBeCloseTo(300, 3);
    expect(p.y).toBeCloseTo(0, 4);
    expect(p.z).toBeCloseTo(0, 4);
  });

  it('keeps the full model in the LOD1 band where the level has no LOD1 (ultra)', async () => {
    const full = (await kit.model('Birch_1')).parts;
    const pool = await poolOf('Birch_1', { lod1: false });
    expect(meshesAt(pool, 1).map((m) => m.geometry)).toEqual(full.map((p) => p.geometry));
  });

  it('places an instance at the item’s place, turn and size, times the part’s own transform', async () => {
    const pool = await poolOf();
    pool.set('one', [{ x: 5, y: 1, z: -3, yaw: 0.7, scale: 2 }]);
    pool.update(camAt(0, 0), 0);
    const parts = (await kit.model('Birch_1')).parts;
    meshesAt(pool, 0).forEach((mesh, i) => {
      const want = new THREE.Matrix4().compose(new THREE.Vector3(5, 1, -3), new THREE.Quaternion().setFromAxisAngle(UP, 0.7), new THREE.Vector3(2, 2, 2)).multiply(parts[i].local);
      const got = new THREE.Matrix4();
      mesh.getMatrixAt(0, got);
      got.elements.forEach((v, k) => expect(v, `element ${k}`).toBeCloseTo(want.elements[k], 4));
    });
    // scale 1 when an item doesn't say (a birch's size is in its geometry; a
    // rock's, which doesn't bend, still in its part's local)
    pool.set('one', [{ x: 0, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    const m = new THREE.Matrix4();
    meshesAt(pool, 0)[0].getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).x).toBeCloseTo(1, 6);
    const rock = await poolOf('Rock_1');
    rock.set('one', [{ x: 0, y: 0, z: 0, yaw: 0 }]);
    rock.update(camAt(0, 0), 0);
    meshesAt(rock, 0)[0].getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).x).toBeCloseTo(0.6, 6);
  });

  it('frees a key from every level in the same call', async () => {
    const pool = await poolOf();
    threeRings(pool);
    pool.free('b');
    expect(pool.stats.levels).toEqual([10, 0, 10]);
    expect(pool.stats.total).toBe(20);
    for (const m of meshesAt(pool, 1)) {
      expect(m.count).toBe(0);
      expect(m.visible).toBe(false); // (no empty draw)
    }
    // (what's left at the puff level is still the 300 m ring, packed from the front)
    for (const m of meshesAt(pool, 2)) {
      expect(m.count).toBe(10);
      for (let i = 0; i < 10; i++) expect(Math.abs(Math.hypot(where(m, i).x, where(m, i).z) - 300)).toBeLessThan(1);
    }
    // (and a key at the puff level: nothing left drawn there either)
    pool.free('c');
    expect(pool.stats.levels).toEqual([10, 0, 0]);
    for (const m of meshesAt(pool, 2)) expect(m.count).toBe(0);
    for (const m of meshesAt(pool, 0)) {
      expect(m.count).toBe(10);
      for (let i = 0; i < 10; i++) expect(Math.hypot(where(m, i).x, where(m, i).z)).toBeLessThan(11);
    }
  });

  it('takes a key set to nothing out at once, as a free does', async () => {
    const pool = await poolOf();
    threeRings(pool);
    pool.set('b', []);
    expect(pool.stats).toMatchObject({ total: 20, levels: [10, 0, 10] });
    for (const m of meshesAt(pool, 1)) expect(m.count).toBe(0);
  });

  it('replaces a key’s items on set', async () => {
    const pool = await poolOf();
    pool.set('a', ring(10, 10));
    pool.set('a', ring(4, 100));
    pool.update(camAt(0, 0), 0);
    expect(pool.stats).toMatchObject({ total: 4, levels: [0, 4, 0] });
  });

  it('shifts every instance and the camera it sorted from by the same, so no item changes band', async () => {
    const pool = await poolOf();
    threeRings(pool);
    // (an item just inside the full band's edge, where a wrong distance would show)
    pool.set('edge', [{ x: 69, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    const before = [0, 1, 2].map((l) => meshesAt(pool, l).map((m) => Array.from({ length: m.count }, (_, i) => where(m, i))));
    const levels = [...pool.stats.levels];
    pool.shift(-1000, 0);
    // moved at once, before any re-sort
    [0, 1, 2].forEach((l) =>
      meshesAt(pool, l).forEach((m, j) => {
        for (let i = 0; i < m.count; i++) {
          expect(where(m, i).x).toBeCloseTo(before[l][j][i].x - 1000, 2);
          expect(where(m, i).z).toBeCloseTo(before[l][j][i].z, 3);
        }
      }),
    );
    pool.update(camAt(-1000, 0), 0);
    expect(pool.stats.levels).toEqual(levels);
    [0, 1, 2].forEach((l) => meshesAt(pool, l).forEach((m, j) => expect(where(m, 0).x).toBeCloseTo(before[l][j][0].x - 1000, 2)));
    // a floating origin's whole cell
    pool.shift(50000, -50000);
    pool.update(camAt(49000, -50000), 0);
    expect(pool.stats.levels).toEqual(levels);
  });

  it('re-sorts every half second or 20 m of travel, not every frame', async () => {
    const pool = await poolOf();
    pool.set('a', [{ x: 75, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    pool.update(camAt(10, 0), 0.1); // 65 m now: full, once it looks
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    pool.update(camAt(10, 0), 0.4); // half a second
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-5, 0), 0); // 80 m: LOD1, but 15 m of travel isn't enough
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-15, 0), 0); // 25 m from the last sort
    expect(pool.stats.levels).toEqual([0, 1, 0]);
  });

  it('re-bands nothing on a shift: the camera it sorted from moved with the items', async () => {
    const pool = await poolOf();
    pool.set('a', [{ x: 75, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    pool.update(camAt(10, 0), 0.1); // (65 m now, but not looked at yet)
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    const sorts = pool.stats.sorts;
    pool.shift(-1000, 0);
    pool.update(camAt(-990, 0), 0.1);
    expect(pool.stats.sorts).toBe(sorts);
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    expect(where(meshesAt(pool, 1)[0], 0).x).toBeCloseTo(-925, 2);
    // (and the half second comes round as it would have)
    pool.update(camAt(-990, 0), 0.31);
    expect(pool.stats.sorts).toBe(sorts + 1);
    expect(pool.stats.levels).toEqual([1, 0, 0]);
  });

  it('starts each pool’s half second at a random point, so pools made together re-sort on different frames', async () => {
    // (three's ids draw on Math.random too: each pool made under its own value)
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const a = createPool(kit, 'Birch_1', { bands: HIGH });
    random.mockReturnValue(0.7);
    const b = createPool(kit, 'Birch_2', { bands: HIGH });
    const frames = { a: [], b: [] };
    for (let f = 0; f < 12; f++) {
      for (const [k, p] of Object.entries({ a, b })) {
        const before = p.stats.sorts;
        p.update(camAt(0, 0), 0.1);
        if (p.stats.sorts > before) frames[k].push(f);
      }
    }
    // (both at once on the first, as both are new; then a at 0.05 s in, b at 0.35 s, each every half second)
    expect(frames.a).toEqual([0, 5, 10]);
    expect(frames.b).toEqual([0, 3, 8]);
  });

  it('draws the full parts in the LOD1 and puff levels, and says so, when the LOD1 won’t load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plain = fakeLoad();
    const load = async (url) => {
      const got = await plain(url);
      got.scene.remove(got.scene.getObjectByName('Birch_1lod1'));
      return got;
    };
    ({ kit } = await kitOf({ load }));
    const pool = await poolOf();
    const full = (await kit.model('Birch_1')).parts;
    for (const l of [1, 2]) expect(meshesAt(pool, l).map((m) => m.geometry)).toEqual(full.map((p) => p.geometry));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/Birch_1's LOD1 won't load.*full parts stand in/);
    threeRings(pool);
    expect(pool.stats.levels).toEqual([10, 10, 10]);
    for (const m of pool.group.children) expect(m.count).toBe(10);
  });

  it('says once, naming the model, when its full model won’t load, and never that its full parts stand in', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manifest = { ...MANIFEST, models: { ...MANIFEST.models, Lost_1: { ...MANIFEST.models.Birch_1, file: 'lost.glb' } } };
    ({ kit } = await kitOf({ manifest }));
    const pool = createPool(kit, 'Lost_1', { bands: HIGH, lod1: true });
    await expect(pool.ready).rejects.toThrow(/lost\.glb/);
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/Lost_1/);
    expect(warn.mock.calls[0][0]).not.toMatch(/stand in/);
    // (and a pool disposed of before its parts came says nothing)
    const gone = createPool(kit, 'Lost_1', { bands: HIGH, lod1: true });
    gone.dispose();
    await expect(gone.ready).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('holds a band past its edge a little (hysteresis 0.1)', async () => {
    const pool = await poolOf();
    pool.set('a', [{ x: 69, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-3, 0), 1); // 72 m: inside 70 × 1.05
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-5, 0), 1); // 74 m: out
    expect(pool.stats.levels).toEqual([0, 1, 0]);
  });

  it('draws nothing past twice the LOD1 band', async () => {
    const pool = await poolOf();
    pool.set('far', ring(5, 2 * HIGH[1] * 1.1));
    pool.update(camAt(0, 0), 0);
    expect(pool.stats).toMatchObject({ total: 5, levels: [0, 0, 0] });
    for (const m of pool.group.children) expect(m.count).toBe(0);
  });

  it('grows by half again when it overflows, keeping what it drew and sharing the geometry', async () => {
    const pool = await poolOf('Birch_1', { cap: 256 });
    pool.set('a', ring(10, 10));
    pool.update(camAt(0, 0), 0);
    const old = [...pool.group.children];
    const freed = vi.fn();
    for (const m of old) m.addEventListener('dispose', freed);
    const first = where(meshesAt(pool, 0)[0], 0);
    pool.set('b', ring(300, 100));
    expect(pool.group.children).toHaveLength(6);
    for (const m of pool.group.children) {
      expect(m.instanceMatrix.count).toBeGreaterThanOrEqual(384);
      expect(old).not.toContain(m);
    }
    expect(freed).toHaveBeenCalledTimes(6);
    expect(pool.group.children.map((m) => m.geometry)).toEqual(old.map((m) => m.geometry));
    // (still drawing what it drew till the next sort)
    expect(meshesAt(pool, 0)[0].count).toBe(10);
    expect(meshesAt(pool, 0)[0].visible).toBe(true);
    expect(where(meshesAt(pool, 0)[0], 0).distanceTo(first)).toBeLessThan(1e-4);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([10, 300, 0]);
  });

  it('casts shadows from the full level only, and none when told', async () => {
    const pool = await poolOf();
    for (const m of meshesAt(pool, 0)) expect(m.castShadow).toBe(true);
    for (const m of [...meshesAt(pool, 1), ...meshesAt(pool, 2)]) expect(m.castShadow).toBe(false);
    const quiet = await poolOf('Birch_1', { shadows: false });
    for (const m of quiet.group.children) expect(m.castShadow).toBe(false);
  });

  it('writes matrices for the graphics chip to take each sort, and lets the bounds be found again', async () => {
    const pool = await poolOf();
    threeRings(pool);
    for (const m of pool.group.children) {
      expect(m.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
      expect(m.boundingSphere).toBeNull();
    }
    const [m] = meshesAt(pool, 2);
    m.computeBoundingSphere();
    expect(m.boundingSphere.center.length()).toBeLessThan(300);
    expect(m.boundingSphere.radius).toBeGreaterThan(290);
  });

  it('takes items before its parts are in, and draws them when they come', async () => {
    const pool = createPool(kit, 'Birch_1', { bands: HIGH, lod1: true });
    pool.set('a', ring(10, 10));
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([10, 0, 0]);
    await pool.ready;
    for (const m of meshesAt(pool, 0)) expect(m.count).toBe(10);
  });

  it('defaults its bands and its LOD1 to the device level’s row', async () => {
    const row = budget(detailLevel());
    const pool = createPool(kit, 'Birch_1');
    await pool.ready;
    pool.set('a', [
      { x: row.near * 0.9, y: 0, z: 0, yaw: 0 },
      { x: row.near * 1.1, y: 0, z: 0, yaw: 0 },
      { x: row.mid * 1.1, y: 0, z: 0, yaw: 0 },
    ]);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([1, 1, 1]);
    const want = row.lod1 ? await kit.lod1('Birch_1') : (await kit.model('Birch_1')).parts;
    expect(meshesAt(pool, 1).map((m) => m.geometry)).toEqual(want.map((p) => p.geometry));
  });

  it('refuses a rig, a name the kit hasn’t, and a kit whose manifest isn’t in', () => {
    expect(() => createPool(kit, 'Critter')).toThrow(/rig/);
    expect(() => createPool(kit, 'Oak_9')).toThrow(/Oak_9/);
    const pending = loadKit('naturemega', { load: fakeLoad(), manifest: new Promise(() => {}) });
    expect(() => createPool(pending, 'Birch_1')).toThrow(/manifest/);
  });

  it('is taken out and frees only its instance buffers when disposed of', async () => {
    const pool = await poolOf();
    const parent = new THREE.Group();
    parent.add(pool.group);
    const meshes = [...pool.group.children];
    const freed = vi.fn();
    const shared = vi.fn();
    for (const m of meshes) {
      m.addEventListener('dispose', freed);
      m.geometry.addEventListener('dispose', shared);
      m.material.addEventListener('dispose', shared);
    }
    pool.dispose();
    expect(pool.group.parent).toBeNull();
    expect(freed).toHaveBeenCalledTimes(6);
    expect(shared).not.toHaveBeenCalled();
  });
});
