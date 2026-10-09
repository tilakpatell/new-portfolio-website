import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { builderUrls, cellsOf, crownsOf, kindUrls, modelUrls, partsOf, viewUrls, within } from './furnish';
import { LANDINGS } from './landings';
import { biomeAt, viewOf } from './biomes';

describe('within', () => {
  it("is what the promise gives, when it's in time", async () => {
    await expect(within(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it('gives up waiting after so long, and resolves all the same', async () => {
    const never = new Promise(() => {});
    const t0 = Date.now();
    await expect(within(never, 30)).resolves.toBeUndefined();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25);
  });

  it("never rejects: a promise that fails is waited for as one that's in", async () => {
    await expect(within(Promise.reject(new Error('no scans')), 50)).resolves.toBeUndefined();
  });
});

describe('modelUrls', () => {
  it("is every model a landing may stand about, its biomes' too, each once", () => {
    const landing = {
      models: { rv: { url: '/models/rv.glb' }, car: { url: '/models/car.glb' } },
      biomes: [{ id: 'city', models: { car: { url: '/models/car.glb' }, sign: { url: '/models/sign.glb' } } }, { id: 'sands' }],
    };
    expect(modelUrls(landing)).toEqual(['/models/rv.glb', '/models/car.glb', '/models/sign.glb']);
  });

  it('is none for a landing with no models', () => {
    expect(modelUrls({ things: [] })).toEqual([]);
    expect(modelUrls(null)).toEqual([]);
  });
});

describe('the models a view stands about', () => {
  // (a landing as it is on each of its biomes, and on its own)
  const on = (l, b) => viewOf(l, biomeAt({ ...l, biomes: [b] }, [0, 0, 0]));
  const viewsOf = (l) => [['own', l], ...(l.biomes ?? []).map((b) => [b.id, on(l, b)])];
  const biome = (id, b) => on(LANDINGS[id], LANDINGS[id].biomes.find((x) => x.id === b));
  const file = (u) => u.split('/').pop();

  it("is the models its things' and its scatter's kinds name, each once", () => {
    const view = {
      models: { rv: { url: '/models/rv.glb' }, car: { url: '/models/car.glb' }, sign: { url: '/models/sign.glb' } },
      things: [{ kind: 'rv' }, { kind: 'figure' }, { kind: 'car' }],
      scatter: [{ kind: 'car' }, { kind: 'pebble' }],
    };
    expect(kindUrls(view)).toEqual(['/models/rv.glb', '/models/car.glb']);
    expect(kindUrls({ things: [] })).toEqual([]);
    expect(kindUrls(null)).toEqual([]);
  });

  it("has every model a kind of it names, and nothing that isn't the landing's, for every view of every landing", () => {
    for (const [id, l] of Object.entries(LANDINGS)) {
      const all = modelUrls(l);
      for (const [name, v] of viewsOf(l)) {
        const urls = viewUrls(l, v);
        for (const t of [...(v.things ?? []), ...(v.scatter ?? [])]) if (v.models?.[t.kind]) expect(urls, `${id}/${name} ${t.kind}`).toContain(v.models[t.kind].url);
        for (const u of urls) expect(all, `${id}/${name}`).toContain(u);
        expect(new Set(urls).size, `${id}/${name}`).toBe(urls.length);
      }
    }
  });

  it("is the Shire's own on Middle-earth (no Mordor rocks), and Mordor's only rocks", () => {
    const me = LANDINGS.middleearth;
    expect(viewUrls(me).map(file).sort()).toEqual(['flowers.glb', 'grass.glb', 'mushrooms.glb', 'trees.glb']);
    expect(viewUrls(me)).not.toContain('/models/quaternius/nature/rocks.glb');
    expect(viewUrls(me, biome('middleearth', 'mordor')).map(file)).toEqual(['rocks.glb']);
    // (the fallback biome is the landing's own)
    expect(viewUrls(me, biome('middleearth', 'shire')).sort()).toEqual(viewUrls(me).sort());
  });

  it('keeps what a builder asks for by name in every view: the Pearl on the reef, the gaddi in the music room', () => {
    expect(builderUrls(LANDINGS.middleearth)).toEqual([]);
    expect(builderUrls(LANDINGS.caribbean).map(file)).toEqual(['pearl.glb']);
    expect(viewUrls(LANDINGS.caribbean, biome('caribbean', 'reef')).map(file)).toContain('pearl.glb');
    expect(viewUrls(LANDINGS.music).map(file)).toContain('gaddi.glb');
    // (kit.specs' names, as each planet's builders ask for them)
    const BY_NAME = { caribbean: ['ship'], marvel: ['gauntlet'], travel: ['plane'], gaming: ['piranha'], music: ['gaddi', 'harmonium', 'tabla', 'sitar', 'tanpura', 'lamp'] };
    for (const [id, names] of Object.entries(BY_NAME)) {
      for (const [b, v] of viewsOf(LANDINGS[id])) for (const name of names) expect(viewUrls(LANDINGS[id], v), `${id}/${b} ${name}`).toContain(v.models[name].url);
    }
  });

  it("fetches less than every biome's models together where the views differ", () => {
    for (const id of ['breakingbad', 'caribbean']) expect(viewUrls(LANDINGS[id]).length, id).toBeLessThan(modelUrls(LANDINGS[id]).length);
  });
});

describe('cellsOf', () => {
  // (spots as scatterSpots lays them: metres from the landing's middle)
  const ring = (n, d) => Array.from({ length: n }, (_, i) => ({ x: Math.sin(((i + 0.5) / n) * Math.PI * 2) * d, z: Math.cos(((i + 0.5) / n) * Math.PI * 2) * d, s: 1, yaw: 0 }));
  const angle = (p) => (Math.atan2(p.x, p.z) + Math.PI * 2) % (Math.PI * 2);

  it('puts every spot in one cell, each once, in the order they were laid', () => {
    const spots = [...ring(40, 60), ...ring(13, 8), ...ring(29, 100)];
    const cells = cellsOf(spots, { sectors: 8, inner: 20 });
    const all = cells.flat();
    expect([...all].sort((a, b) => a - b)).toEqual(spots.map((_, i) => i));
    for (const c of cells) expect(c).toEqual([...c].sort((a, b) => a - b));
  });

  it('keeps the spots near the middle together, and splits the rest by the way they lie from it', () => {
    const spots = [...ring(16, 5), ...ring(64, 70)];
    const cells = cellsOf(spots, { sectors: 8, inner: 20 });
    const middle = cells.find((c) => c.includes(0));
    expect(middle).toEqual(Array.from({ length: 16 }, (_, i) => i));
    const out = cells.filter((c) => c !== middle);
    expect(out).toHaveLength(8);
    for (const c of out) {
      const k = Math.floor(angle(spots[c[0]]) / (Math.PI / 4));
      for (const i of c) expect(Math.floor(angle(spots[i]) / (Math.PI / 4))).toBe(k);
    }
  });

  it('leaves out a cell with nothing in it', () => {
    const spots = [{ x: 50, z: 1, s: 1, yaw: 0 }, { x: 51, z: 2, s: 1, yaw: 0 }];
    expect(cellsOf(spots, { sectors: 8, inner: 20 })).toEqual([[0, 1]]);
  });

  it('is one cell of them all with a single sector (what can be knocked about goes anywhere)', () => {
    const spots = [...ring(9, 5), ...ring(9, 70)];
    expect(cellsOf(spots, { sectors: 1 })).toEqual([spots.map((_, i) => i)]);
    expect(cellsOf([], { sectors: 8 })).toEqual([]);
  });

  it("doesn't move them", () => {
    const spots = ring(12, 40);
    const before = JSON.stringify(spots);
    cellsOf(spots, { sectors: 8, inner: 20 });
    expect(JSON.stringify(spots)).toBe(before);
  });
});

describe('crownsOf', () => {
  // (a tree's parts as a scatter takes them: its bark, and its leaves scaled up 2 and lifted)
  const leaves = new THREE.MeshStandardMaterial({ name: 'Leaves_NormalTree' });
  const tree = (leafMaterial = leaves) => [
    { geometry: new THREE.BoxGeometry(0.4, 4, 0.4).translate(0, 2, 0), material: new THREE.MeshStandardMaterial({ name: 'Bark_NormalTree' }), local: null },
    { geometry: new THREE.BoxGeometry(2, 1, 1.5), material: leafMaterial, local: new THREE.Matrix4().compose(new THREE.Vector3(0, 5, 0), new THREE.Quaternion(), new THREE.Vector3(2, 2, 2)) },
  ];

  it('is the leaves’ reach round and how high they start and end, not the bark’s', () => {
    const c = crownsOf(tree());
    expect(c.r).toBeCloseTo(2, 9);
    expect(c.lo).toBeCloseTo(4, 9);
    expect(c.hi).toBeCloseTo(6, 9);
    // (a tinted copy keeps the name, and is a crown too)
    expect(crownsOf(tree(Object.assign(leaves.clone(), { name: 'Leaves_NormalTree.001' }))).hi).toBeCloseTo(6, 9);
  });

  it('is none for a thing with no leafy crown, and one too low to shed (a hedge) falls short', () => {
    expect(crownsOf([tree()[0]])).toBeNull();
    expect(crownsOf(tree(new THREE.MeshStandardMaterial({ name: 'Leaves_Pine' })))).toBeNull();
    const hedge = [{ geometry: new THREE.BoxGeometry(1.6, 1.1, 1.6).translate(0, 0.55, 0), material: leaves, local: null }];
    expect(crownsOf(hedge).hi).toBeLessThan(2.5);
  });
});

describe('partsOf', () => {
  it('instances what a model draws, never its physical nodes or their colliders', () => {
    const mat = new THREE.MeshBasicMaterial();
    const model = new THREE.Group();
    const look = new THREE.Mesh(new THREE.BoxGeometry(), mat);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(), mat);
    crate.name = 'crate_physical_dynamic';
    const hull = new THREE.Mesh(new THREE.BoxGeometry(), mat);
    hull.name = 'hull';
    crate.add(hull);
    model.add(look, crate);
    const parts = partsOf(model);
    expect(parts).toHaveLength(1);
    expect(parts[0].geometry).toBe(look.geometry);
  });
});
