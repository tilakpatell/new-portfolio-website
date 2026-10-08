import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SCANS from '../../../../public/cc0/galaxy/index.json';
import { resetDevice } from '../../../lib/device';
import { applyBuilt, clusterSpecs, createPlacer, hasModel, lodDistance, setKitLoader, usesModel, wearModel, withLod } from './placer';

const fakeWorld = () => ({ heightAt: () => 0, solids: { box: vi.fn(), circle: vi.fn() }, floors: [] });
const made = () => ({ object: new THREE.Group(), solids: [{ box: [0, 0, 4, 2] }], floors: [{ x: 3, z: 0, y: 1, hw: 2, hd: 2 }], update: () => {}, signal: () => {} });

describe('a built thing under a model', () => {
  it("keeps a built thing's floors and walls without its meshes", () => {
    const world = fakeWorld();
    const sinks = { updates: [], signals: [], object: false };
    applyBuilt(made(), { yaw: Math.PI / 2, scale: 2 }, [10, 0, 0], world, sinks);
    expect(world.solids.box).toHaveBeenCalledWith(10, 0, 8, 4, Math.PI / 2, expect.anything());
    expect(world.floors[0]).toMatchObject({ x: 10, y: 2, hw: 4, hd: 4 });
    expect(world.floors[0].z).toBeCloseTo(-6);
    // (its moving parts went with its meshes)
    expect(sinks.updates).toHaveLength(0);
    expect(sinks.signals).toHaveLength(0);
  });

  it('keeps the floors of one you can walk through', () => {
    const world = fakeWorld();
    applyBuilt(made(), { solid: false }, [0, 0, 0], world, { updates: [], signals: [], object: false });
    expect(world.solids.box).not.toHaveBeenCalled();
    expect(world.floors).toHaveLength(1);
  });

  it('follows a floor that moves (a platform lowered): its height read live', () => {
    const world = fakeWorld();
    const f = { x: 0, z: 0, y: 1, r: 3, moves: true, tag: 'lift' };
    applyBuilt({ object: new THREE.Group(), floors: [f] }, { scale: 2 }, [0, 10, 0], world, { updates: [], signals: [], object: true });
    expect(world.floors[0].y).toBe(12);
    f.y = -1;
    expect(world.floors[0].y).toBe(8);
    expect(world.floors[0].tag).toBe('lift');
  });

  it('keeps the moving parts of one drawn as built', () => {
    const sinks = { updates: [], signals: [], object: true };
    applyBuilt(made(), {}, [0, 0, 0], fakeWorld(), sinks);
    expect(sinks.updates).toHaveLength(1);
    expect(sinks.signals).toHaveLength(1);
  });
});

describe('far away, the light model', () => {
  it('switches far enough out', () => {
    expect(lodDistance(10)).toBe(60);
    expect(lodDistance(50)).toBe(150);
  });

  it('swaps in place', () => {
    const full = new THREE.Group();
    const low = new THREE.Group();
    full.position.set(3, 0, 0);
    const lod = withLod(full, low, 50);
    expect(lod.levels.map((l) => l.distance)).toEqual([0, 150]);
    expect(lod.levels.every((l) => l.object.position.lengthSq() === 0 && l.object.rotation.y === 0 && l.object.scale.x === 1)).toBe(true);
  });

  it('has one level till the light one comes', () => {
    const lod = withLod(new THREE.Group(), null, 20);
    expect(lod.levels).toHaveLength(1);
  });
});

describe('which things are their model', () => {
  it('draws a styled kind as its model only in the styles it is of', () => {
    // (theed's model is a domed hall: its towers stay built)
    expect(usesModel({ kind: 'theed', opts: { style: 'hall' } })).toBe(true);
    expect(usesModel({ kind: 'theed', opts: { style: 'tower' } })).toBe(false);
    expect(usesModel({ kind: 'theed', opts: { style: 'hall' }, model: false })).toBe(false);
    expect(usesModel({ kind: 'nothingatall' })).toBe(false);
  });
});

describe('a cluster of models', () => {
  it('sets each member where the cluster stands, turned with it', () => {
    const members = clusterSpecs({ kind: 'x', at: [10, 0], yaw: Math.PI / 2, scale: 2 }, [['impcrate', 1, 0, 0.3], ['barrels', 0, -1, 0, 0.5]]);
    expect(members[0]).toMatchObject({ kind: 'impcrate', yaw: Math.PI / 2 + 0.3, scale: 2 });
    expect(members[0].at[0]).toBeCloseTo(10);
    expect(members[0].at[1]).toBeCloseTo(-2);
    expect(members[1]).toMatchObject({ kind: 'barrels', y: 1 });
    expect(members[1].at[0]).toBeCloseTo(8);
  });
});

describe('a model that wears a core scan', () => {
  it('lays the role’s scan over each lit material once, at the scan’s size', async () => {
    const o = new THREE.Group();
    const lit = new THREE.MeshStandardMaterial();
    o.add(new THREE.Mesh(new THREE.BufferGeometry(), lit), new THREE.Mesh(new THREE.BufferGeometry(), lit), new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
    const calls = [];
    const scan = { map: {} };
    const n = await wearModel(o, 'stone', { wear: (m, s, opts) => calls.push({ m, s, opts }), load: () => Promise.resolve(scan) });
    expect(n).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].m).toBe(lit);
    expect(calls[0].s).toBe(scan);
    expect(calls[0].opts.metres).toBe(SCANS.stone.metres);
  });

  it('wears nothing for a role with no scan', async () => {
    const o = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
    expect(await wearModel(o, 'nonsense', { wear: () => {}, load: () => Promise.resolve(null) })).toBe(0);
  });
});

describe('a kit model, by name', () => {
  // (a kit of one plant of two parts and one tree, each with a LOD1 of one
  // part, standing in for lib/three/kit's loadKit)
  const part = (name, y = 0.5) => ({ geometry: new THREE.BoxGeometry(1, 1, 1), material: new THREE.MeshLambertMaterial({ name }), local: new THREE.Matrix4().makeTranslation(0, y, 0), part: 'main' });
  const ROWS = { Fern_1: { file: 'fern.glb', radius: 1.9, height: 0.8, trunk: 0.4, kind: 'plant' }, Birch_1: { file: 'birch.glb', radius: 30, height: 13, trunk: 0.25, kind: 'tree' } };
  const fakeKit = () => {
    const full = { Fern_1: [part('Leaves'), part('Fronds', 1)], Birch_1: [part('Bark'), part('Leaves_Birch', 6)] };
    const low = { Fern_1: [part('Leaves')], Birch_1: [part('Bark')] };
    return {
      manifest: Promise.resolve({ models: ROWS }),
      info: (name) => ROWS[name] ?? null,
      model: vi.fn((name) => (full[name] ? Promise.resolve({ parts: full[name], radius: ROWS[name].radius, height: ROWS[name].height, kind: ROWS[name].kind, tones: null }) : Promise.reject(new Error('none')))),
      lod1: vi.fn((name) => (low[name] ? Promise.resolve(low[name]) : Promise.reject(new Error('none')))),
      full,
      low,
      dispose: vi.fn(),
    };
  };
  const galaxyKit = () => ({ wind: { value: 0 }, mats: { rock: new THREE.MeshLambertMaterial() }, geometry: () => new THREE.BoxGeometry() });
  const setup = () => {
    const kit = fakeKit();
    const loader = vi.fn(() => kit);
    setKitLoader(loader);
    const world = fakeWorld();
    const house = { material: () => new THREE.MeshLambertMaterial() };
    const galaxy = galaxyKit();
    const placer = createPlacer({ parent: new THREE.Group(), kit: galaxy, world, house });
    return { kit, loader, world, placer, galaxy, house };
  };
  const items = (n) => Array.from({ length: n }, (_, i) => ({ at: [i * 4, 0], yaw: i, scale: 1 + i / 2 }));
  const instanced = (placer) => placer.group.children.filter((o) => o.isInstancedMesh);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  afterEach(() => {
    setKitLoader(null);
    vi.unstubAllGlobals();
    resetDevice();
  });

  it('scatters a kit model: one instanced mesh a part, every item in each', async () => {
    const { kit, loader, placer, galaxy, house } = setup();
    await placer.scatter('fern', items(3), { model: 'kit:naturemega/Fern_1' });
    await placer.ready;
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader.mock.calls[0][0]).toBe('naturemega');
    // (its leaves in the galaxy's wind, by the galaxy's clock, in the house's look)
    expect(loader.mock.calls[0][1].wind.time).toBe(galaxy.wind);
    expect(loader.mock.calls[0][1].house).toBe(house);
    expect(kit.model).toHaveBeenCalledWith('Fern_1');
    const meshes = instanced(placer).filter((m) => kit.full.Fern_1.some((p) => p.geometry === m.geometry && p.material === m.material));
    expect(meshes).toHaveLength(2);
    for (const m of meshes) expect(m.count).toBe(3);
    // (each part where the model has it: the second item's second part a metre
    // up its own frame, at its scale)
    const at = new THREE.Matrix4();
    meshes[1].getMatrixAt(1, at);
    expect(new THREE.Vector3().setFromMatrixPosition(at).toArray()).toEqual([4, 1.5, 0].map((v) => expect.closeTo(v, 5)));
  });

  it('loads a pack once a placer, however many rows name it, and lets it go with the placer', async () => {
    const { kit, loader, placer } = setup();
    placer.scatter('fern', items(2), { model: 'kit:naturemega/Fern_1' });
    placer.scatter('birch', items(2), { model: 'kit:naturemega/Birch_1' });
    await placer.ready;
    expect(loader).toHaveBeenCalledTimes(1);
    placer.dispose();
    expect(kit.dispose).toHaveBeenCalledTimes(1);
  });

  it('stands a plant on its box and a tree on its trunk', async () => {
    const { world, placer } = setup();
    placer.scatter('fern', items(1), { model: 'kit:naturemega/Fern_1' });
    placer.scatter('birch', items(2), { model: 'kit:naturemega/Birch_1' });
    await placer.ready;
    const radii = world.solids.circle.mock.calls.map((c) => c[2]);
    // (the fern's box is a metre square: 0.35 of it; the birch's trunk at each item's scale)
    expect(radii).toEqual([0.35, 0.25, 0.25 * 1.5].map((v) => expect.closeTo(v, 5)));
  });

  it('draws its LOD1 far off where the level has one, shadowless, split at the model’s distance', async () => {
    vi.stubGlobal('window', { location: { search: '?quality=high', hash: '' }, localStorage: { getItem: () => null } });
    resetDevice();
    const { kit, placer } = setup();
    placer.scatter('birch', items(3), { model: 'kit:naturemega/Birch_1' });
    await placer.ready;
    await tick();
    expect(kit.lod1).toHaveBeenCalledWith('Birch_1');
    const low = instanced(placer).filter((m) => m.geometry === kit.low.Birch_1[0].geometry);
    expect(low).toHaveLength(1);
    expect(low[0].castShadow).toBe(false);
    // (you at the first item: the others, 4 and 8 m off, are inside the
    // birch's 90 m, so the full model draws all three and its LOD1 none)
    placer.update(0, 0, { x: 0, z: 0 });
    expect(low[0].count).toBe(0);
    expect(lodDistance(ROWS.Birch_1.radius)).toBe(90);
    placer.update(0, 0, { x: 300, z: 0 });
    expect(low[0].count).toBe(3);
  });

  it('puts one kit model as its parts under one group', async () => {
    const { kit, world, placer } = setup();
    const o = await placer.put({ kind: 'birch', model: 'kit:naturemega/Birch_1', at: [5, 2], yaw: 1, scale: 2 });
    expect(o.isGroup).toBe(true);
    expect(o.parent).toBe(placer.group);
    expect(o.position.toArray()).toEqual([5, 0, 2]);
    expect(o.scale.x).toBe(2);
    expect(o.children.map((c) => [c.geometry, c.material])).toEqual(kit.full.Birch_1.map((p) => [p.geometry, p.material]));
    expect(o.children[1].position.y).toBeCloseTo(6);
    // (a tree: solid at its trunk, at its scale)
    expect(world.solids.circle).toHaveBeenCalledWith(5, 2, 0.5);
  });

  it('knows a kit model is a model, and a kind with none still isn’t', () => {
    expect(usesModel({ kind: 'fern', model: 'kit:naturemega/Fern_1' })).toBe(true);
    expect(hasModel('nothing')).toBe(false);
    expect(hasModel('kit:naturemega/Fern_1')).toBe(false);
  });

  it('scatters its kind’s build where the kit model won’t load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { placer } = setup();
    await placer.scatter('rock', items(3), { model: 'kit:naturemega/Nothing_1' });
    const meshes = instanced(placer);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].count).toBe(3);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('scatters a kind with no kit model as it always has', async () => {
    const { loader, world, placer } = setup();
    await placer.scatter('rock', items(3), { model: true });
    expect(loader).not.toHaveBeenCalled();
    const meshes = instanced(placer);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].count).toBe(3);
    expect(world.solids.circle).toHaveBeenCalledTimes(3);
    expect(world.solids.circle.mock.calls[0][2]).toBeCloseTo(0.42);
  });
});
