import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CLUTTER_KINDS } from '../../../lib/land/flight/leafMesh';
import { clutterKitOf } from '../../../lib/land/flight/landmarkTables';
import { createKitClutter } from './kitClutter';

const ROCK = CLUTTER_KINDS.indexOf('rock');
const TREE = CLUTTER_KINDS.indexOf('trunk');
const DEBRIS = CLUTTER_KINDS.indexOf('debris');
const row = (x, kind, scale = 1) => [x, 5, 0, 0.5, scale, kind];
const rows = (...r) => new Float32Array(r.flat());

// a kit whose manifest is in at once, and pools that keep what they're set
function fakes({ fail = false } = {}) {
  const made = [];
  const load = vi.fn((pack) => ({ pack, manifest: Promise.resolve({}), dispose: vi.fn() }));
  const makePool = vi.fn((kit, name) => {
    const keys = new Map();
    const p = {
      name,
      keys,
      group: new THREE.Group(),
      ready: fail ? Promise.reject(new Error('gone')) : Promise.resolve(),
      set: vi.fn((k, items) => keys.set(k, items)),
      free: vi.fn((k) => keys.delete(k)),
      update: vi.fn(),
      dispose: vi.fn(),
    };
    p.ready.catch(() => {});
    made.push(p);
    return p;
  });
  return { load, makePool, made };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const forest = { id: 'e:1,0:0:0', type: 'forest' };

describe('createKitClutter', () => {
  it('sends a leaf’s rows to the kit’s pools once they’re in, the rest to the code-built ones', async () => {
    const f = fakes();
    const root = new THREE.Group();
    const kc = createKitClutter(root, { spec: forest, tier: 'mid', load: f.load, makePool: f.makePool });
    const leaf = rows(row(1, ROCK), row(2, TREE, 1.2), row(3, DEBRIS));
    // (nothing in yet: all of it to the code-built shapes)
    expect(kc.add(leaf)).toEqual({ key: null, rest: leaf, kitted: 0 });
    await flush();
    const got = kc.add(leaf);
    expect(got.kitted).toBe(2);
    expect(Array.from(got.rest)).toEqual(row(3, DEBRIS));
    const spire = f.made.find((p) => p.name === clutterKitOf(forest).trunk.name);
    const [item] = spire.keys.get(got.key);
    expect(item).toEqual({ x: 2, y: 5, z: 0, yaw: 0.5, scale: expect.closeTo(1.2 * clutterKitOf(forest).trunk.size, 5) });
    expect(root.children).toContain(spire.group);
    // and back when the leaf goes
    kc.free(got.key);
    for (const p of f.made) expect(p.keys.has(got.key)).toBe(false);
  });

  it('loads each pack once', async () => {
    const f = fakes();
    createKitClutter(new THREE.Group(), { spec: forest, tier: 'mid', load: f.load, makePool: f.makePool });
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(f.load.mock.calls[0][0]).toBe('naturemega');
  });

  it('keeps the code-built shapes on low, and for a kind the planet has no model for', async () => {
    const f = fakes();
    const kc = createKitClutter(new THREE.Group(), { spec: forest, tier: 'low', load: f.load, makePool: f.makePool });
    await flush();
    expect(f.load).not.toHaveBeenCalled();
    const leaf = rows(row(1, ROCK));
    expect(kc.add(leaf).rest).toBe(leaf);
    const gas = createKitClutter(new THREE.Group(), { spec: { id: 'bespin', type: 'gas' }, tier: 'mid', load: f.load, makePool: f.makePool });
    expect(gas.add(leaf).kitted).toBe(0);
  });

  it('keeps the code-built shapes where a model won’t load, and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = fakes({ fail: true });
    const kc = createKitClutter(new THREE.Group(), { spec: forest, tier: 'mid', load: f.load, makePool: f.makePool });
    await flush();
    expect(kc.add(rows(row(1, ROCK), row(2, TREE))).kitted).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('sorts its pools by where the ship is, and frees them all', async () => {
    const f = fakes();
    const root = new THREE.Group();
    const kc = createKitClutter(root, { spec: forest, tier: 'mid', load: f.load, makePool: f.makePool });
    await flush();
    kc.update({ x: 100, y: 50, z: -30 });
    for (const p of f.made) expect(p.update.mock.calls[0][0].position).toMatchObject({ x: 100, z: -30 });
    kc.dispose();
    for (const p of f.made) expect(p.dispose).toHaveBeenCalled();
    expect(f.load.mock.results[0].value.dispose).toHaveBeenCalled();
  });
});

describe('the ground with kit clutter', () => {
  it('sends a leaf’s rows to the kit and takes them back when it drops', async () => {
    const { createGround } = await import('./ground');
    const { fakeWorkers } = await import('./fixtures/ground');
    const { createOrigin } = await import('../../../runtime/origin');
    const { planetSpecOf } = await import('../../../lib/land/flight/planetSpec');
    const { LOOK } = await import('./look');
    const workers = fakeWorkers();
    const request = workers.request.bind(workers);
    workers.request = (name, msg) => {
      const p = request(name, msg);
      setTimeout(() => workers.answerAll(), 0);
      return p;
    };
    workers.define = () => {};
    const f = fakes();
    const spec = { ...planetSpecOf('endor'), id: 'g' };
    const scene = new THREE.Scene();
    const ground = createGround(scene, { rt: { workers, origin: createOrigin() }, spec, tier: 'ultra', palette: LOOK.palette ?? [], kits: (root, o) => createKitClutter(root, { ...o, load: f.load, makePool: f.makePool }) });
    await flush();
    const fly = async (x, z) => {
      for (let i = 0; i < 300; i++) {
        ground.update({ x, z });
        await flush();
        const s = ground.stats();
        if (!s.flying && !s.pending && i > 2) break;
      }
    };
    await fly(10, 10);
    const held = () => f.made.reduce((n, p) => n + [...p.keys.values()].reduce((m, items) => m + items.length, 0), 0);
    expect(held()).toBeGreaterThan(0);
    expect(f.made.every((p) => p.update.mock.calls.length > 0)).toBe(true);
    const first = new Set(f.made.flatMap((p) => [...p.keys.keys()]));
    await fly(300000, 300000);
    // (far off: the first place's leaves are gone, and every kit item they held with them)
    const still = f.made.flatMap((p) => [...p.keys.keys()]).filter((k) => first.has(k));
    expect(still).toEqual([]);
    expect(held()).toBeGreaterThan(0);
    ground.dispose();
    for (const p of f.made) expect(p.dispose).toHaveBeenCalled();
  });
});
