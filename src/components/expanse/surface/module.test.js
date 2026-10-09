import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import expanse, { KEYS, RADIUS } from './module';
import { landJob } from './job';
import { kept } from './scene';
import { WORLD_MB } from '../../worlds/worlds';
import { validateModule, validateWorld } from '../../../runtime/module';
import { createOrigin } from '../../../runtime/origin';
import { budget } from '../../../lib/budgets';
import { createPhysics } from '../../../lib/physics/world';

const flush = () => new Promise((r) => setTimeout(r, 0));

// The nature kit's own manifest (Node fetches none of the site's files), and
// a loader that makes each family file as the import writes it: a node a
// model and one for its LOD1, a mesh a part in a material the manifest has
// (no maps: Node has no pictures). Handed to the module as `kit`.
const MANIFEST = JSON.parse(readFileSync(new URL('../../../../public/kit/naturemega/index.json', import.meta.url), 'utf8'));
const MATERIAL = { bark: 'Bark_NormalTree', leaves: 'Leaves', main: 'Rocks' };
function kitLoad(url) {
  const file = url.split('/').pop();
  const scene = new THREE.Group();
  const mats = {};
  const material = (name) => (mats[name] ??= Object.assign(new THREE.MeshStandardMaterial(), { name }));
  for (const [name, row] of Object.entries(MANIFEST.models)) {
    if (row.file !== file) continue;
    for (const n of [name, `${name}.lod1`]) {
      const node = new THREE.Group();
      node.name = n.replace(/\./g, '');
      node.userData.name = n;
      for (const part of row.parts) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 1, 0], 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
        g.userData.part = part;
        node.add(new THREE.Mesh(g, material(MATERIAL[part])));
      }
      scene.add(node);
    }
  }
  return Promise.resolve({ scene, animations: [], gltf: {} });
}
const KIT = { kit: { load: kitLoad, manifest: MANIFEST } };
const COVER = new Set(['plant', 'flower', 'grass', 'mushroom', 'pebble', 'path']);

// what the pools should hold for these cells: each one's named props the
// level's share of the budget keeps, counted by name
function drawnBy(cells, tier) {
  const share = budget(tier).props;
  const by = new Map();
  for (const cell of cells) cell.props.forEach((p, i) => p.name && kept(cell.cx, cell.cz, i, share) && by.set(p.name, (by.get(p.name) ?? 0) + 1));
  return by;
}
const sum = (by) => [...by.values()].reduce((a, b) => a + b, 0);
const held = (scene) => new Map([...scene.pools].filter(([, p]) => p.stats.total).map(([name, p]) => [name, p.stats.total]));
const builtCells = (world) => [...world.stream.cells().values()].map((b) => b.cell);

const fakeRenderer = () => ({
  toneMapping: THREE.NoToneMapping,
  toneMappingExposure: 1,
  shadowMap: { enabled: false, type: THREE.PCFShadowMap },
  render: vi.fn(),
  setRenderTarget: vi.fn(),
  getRenderTarget: () => null,
  getClearColor: (c) => c,
  getClearAlpha: () => 1,
  setClearColor: () => {},
  clear: () => {},
  getDrawingBufferSize: (v) => v.set(640, 360),
});
const fakeRt = ({ tier = 'mid' } = {}) => {
  const emitted = [];
  const defined = [];
  return {
    emitted,
    defined,
    gfx: { renderer: fakeRenderer() },
    quality: { tier },
    input: { bind: vi.fn() },
    events: { emit: (type, data) => emitted.push({ type, ...data }) },
    origin: createOrigin(),
    workers: {
      define: (name, make) => defined.push([name, make]),
      request: (name, msg) => Promise.resolve(landJob(msg)?.reply ?? null),
      cancel: () => {},
    },
  };
};
const snap = ({ keys = [], pressed = [], stick = { x: 0, y: 0 } } = {}) => {
  const held = new Set(keys);
  return { keys: held, pressed: new Set(pressed), pad: null, stick, action: (name) => (KEYS[name] ?? []).some((c) => held.has(c)) };
};
async function run(world, seconds, input = snap()) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    world.step(1 / 60, input, t * 1000);
    world.draw({});
    await flush();
  }
}

describe('the Expanse surface module', () => {
  it('is a whole glsl module of the size the gate says', () => {
    const m = validateModule(expanse);
    expect(m).toMatchObject({ id: 'expanse-surface', shading: 'glsl' });
    expect(m.mb).toBe(WORLD_MB['/universe/expanse']);
    expect(RADIUS).toEqual({ ultra: 7, high: 6, mid: 4, low: 3 });
  });

  it('streams the land round the car, stands it on four wheels and drives it', async () => {
    const rt = fakeRt();
    const world = validateWorld(await expanse.create(rt, { seed: 7, type: 'temperate', ...KIT }));
    await world.ready;
    expect(rt.defined.map((d) => d[0])).toEqual(['land']);
    expect(rt.input.bind).toHaveBeenCalledWith(KEYS);
    // (in the visitor's worlds, as a planet)
    const row = await world.registered;
    expect(row).toMatchObject({ id: 'planet:7', kind: 'planet', seed: '7' });
    world.resize(640, 360);
    await run(world, 3);
    const stats = world.stream.stats();
    expect(stats.built).toBeGreaterThan(9);
    expect(stats.solid).toBe(9);
    // standing, on its four wheels
    expect(world.vehicle.state.wheels.every((w) => w.contact)).toBe(true);
    expect(world.vehicle.state.speed).toBeLessThan(0.3);
    const before = world.anchor();
    await run(world, 2, snap({ keys: ['KeyW'] }));
    const after = world.anchor();
    expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(3);
    // the HUD hears of it
    const hud = rt.emitted.filter((e) => e.type === 'hud').at(-1);
    expect(hud.speed).toBeGreaterThan(5);
    expect(hud.seed).toBe('7');
    expect(rt.gfx.renderer.render).toHaveBeenCalled();
    world.dispose();
    expect(world.scene.cells()).toBe(0);
  }, 30000);

  it('moves everything by a floating-origin shift, and nothing jumps', async () => {
    const rt = fakeRt({ tier: 'low' });
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    await run(world, 1);
    const at = world.anchor();
    const local = world.vehicle.chassis.position();
    // (the origin moves when the car strays a cell of 50 km from it: here, by hand)
    rt.origin.check([at[0] + 60000, 0, at[2]]);
    expect(rt.origin.at[0]).toBe(50000);
    expect(world.vehicle.chassis.position()[0]).toBeCloseTo(local[0] - 50000, 1);
    expect(world.scene.land.position.x).toBe(-50000);
    const after = world.anchor();
    expect(after[0]).toBeCloseTo(at[0], 1);
    await run(world, 0.5);
    expect(world.vehicle.state.wheels.some((w) => w.contact)).toBe(true);
    world.dispose();
  }, 30000);

  it('brings the car back on R', async () => {
    const rt = fakeRt({ tier: 'low' });
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    await run(world, 1);
    world.step(1 / 60, snap({ pressed: ['KeyR'] }), 0);
    expect(rt.emitted.some((e) => e.type === 'respawn')).toBe(true);
    world.dispose();
  }, 30000);

  it('lowers its quality step by step', async () => {
    const rt = fakeRt({ tier: 'high' });
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    expect(world.scene.water.blur).toBe(true);
    world.lowerQuality(1);
    expect(world.scene.water.uniforms.uBlur.value).toBe(0);
    world.lowerQuality(2);
    expect(world.scene.sun.castShadow).toBe(false);
    world.dispose();
    // the renderer as it was
    expect(rt.gfx.renderer.toneMapping).toBe(THREE.NoToneMapping);
  }, 30000);
});

describe('the Expanse surface module, drawn through the kit', () => {
  it('draws the built cells’ flora through the kit’s pools, a pool a model, the budget’s share of it; a dropped cell’s goes with it', async () => {
    const rt = fakeRt(); // (mid: a share of 0.75)
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    await run(world, 2);
    const { scene } = world;
    const want = drawnBy(builtCells(world), 'mid');
    const named = builtCells(world).reduce((n, c) => n + c.props.filter((p) => p.name).length, 0);
    // (the share leaves about a quarter out, by a hash of the prop, not makeCell)
    expect(sum(want)).toBeGreaterThan(0.65 * named);
    expect(sum(want)).toBeLessThan(0.85 * named);
    expect(held(scene)).toEqual(want);
    // (each pool a model's, under the land, in world metres; no crate in one)
    for (const [name, p] of scene.pools) {
      expect(p.group.parent).toBe(scene.land);
      expect(MANIFEST.models[name]).toBeTruthy();
    }
    const kinds = new Set([...scene.pools.keys()].map((n) => MANIFEST.models[n].kind));
    expect([...kinds].sort()).toEqual(['bush', 'flower', 'grass', 'mushroom', 'path', 'pebble', 'plant', 'rock', 'tree']);

    // three cells east: the cells west of the new ring go, and their flora with them
    const before = new Map([...world.stream.cells()].map(([k, b]) => [k, b.cell]));
    const total = sum(held(scene));
    const [x, , z] = world.anchor();
    world.stream.update(x + 3 * 64, z);
    const after = world.stream.cells();
    const gone = [...before].filter(([k]) => !after.has(k)).map(([, c]) => c);
    const come = [...after].filter(([k]) => !before.has(k)).map(([, b]) => b.cell);
    expect(gone.length).toBeGreaterThan(0);
    expect(sum(drawnBy(gone, 'mid'))).toBeGreaterThan(0);
    expect(sum(held(scene))).toBe(total - sum(drawnBy(gone, 'mid')) + sum(drawnBy(come, 'mid')));
    expect(held(scene)).toEqual(drawnBy(builtCells(world), 'mid'));
    world.dispose();
  }, 30000);

  it('keeps the pools in world metres under the land: an origin shift moves the land, not their items, and re-bands nothing', async () => {
    const rt = fakeRt({ tier: 'low' });
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    // (no leaves on low: none made, none added)
    expect(world.scene.leaves.mesh).toBeNull();
    expect(world.scene.scene.children).not.toContain(null);
    await run(world, 1.5);
    expect(world.stream.stats()).toMatchObject({ waiting: 0, flying: 0 });
    const { scene } = world;
    const live = [...scene.pools].filter(([, p]) => p.stats.levels.some(Boolean));
    expect(live.length).toBeGreaterThan(0);
    // every instance drawn stands on its prop's world place (the fake's parts have no move of their own)
    const props = builtCells(world).flatMap((c) => c.props);
    const translations = (p) => p.group.children.filter((m) => m.visible).flatMap((m) => Array.from({ length: m.count }, (_, i) => Array.from(m.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15))));
    for (const [name, p] of live)
      for (const [tx, ty, tz] of translations(p)) expect(props.some((q) => q.name === name && Math.abs(q.x - tx) < 1e-3 && Math.abs(q.y - ty) < 1e-3 && Math.abs(q.z - tz) < 1e-3)).toBe(true);
    const look = () => live.map(([, p]) => ({ sorts: p.stats.sorts, levels: [...p.stats.levels], at: translations(p) }));
    const was = look();

    const at = world.anchor();
    rt.origin.check([at[0] + 60000, 0, at[2]]);
    expect(scene.land.position.x).toBe(-50000);
    // (the items as they were, in world metres, and nothing sorted again)
    expect(look()).toEqual(was);
    // a frame on, the camera's world place is where it was: every item keeps its band
    await run(world, 1 / 60);
    expect(live.map(([, p]) => p.stats.levels)).toEqual(was.map((w) => w.levels));
    world.dispose();
  }, 30000);

  it('gives a kit tree a trunk and a kit rock a ball sized from the manifest, and bushes, the cover and what the budget leaves out no body', async () => {
    const rt = fakeRt(); // (mid: a share of 0.75)
    const added = [];
    const watched = async (o) => {
      const p = await createPhysics(o);
      const add = p.add;
      p.add = (desc) => (added.push(desc), add.call(p, desc));
      return p;
    };
    const world = await expanse.create(rt, { seed: 7, ...KIT, createPhysics: watched });
    await run(world, 1);
    const solid = [...world.stream.cells().values()].filter((b) => b.solid).map((b) => b.cell);
    expect(solid).toHaveLength(9);
    const share = budget('mid').props;
    const at = (p) => added.filter((d) => Math.abs(d.position[0] - p.x) < 1e-6 && Math.abs(d.position[2] - p.z) < 1e-6);
    const seen = { tree: 0, rock: 0, crate: 0, none: 0, left: 0 };
    for (const cell of solid)
      cell.props.forEach((p, i) => {
        const row = MANIFEST.models[p.name];
        const bodies = at(p);
        if (p.kind === 'crate') {
          seen.crate++;
          expect(bodies.length).toBeGreaterThan(0);
        } else if (!['tree', 'rock'].includes(p.kind)) {
          seen.none++;
          expect(bodies).toHaveLength(0);
        } else if (!kept(cell.cx, cell.cz, i, share)) {
          seen.left++;
          expect(bodies).toHaveLength(0);
        } else {
          seen[p.kind]++;
          expect(bodies.length).toBeGreaterThan(0);
          for (const d of bodies) {
            const [c] = d.colliders;
            expect(d.colliders).toHaveLength(1);
            if (p.kind === 'tree') {
              // (his fixed cylinder, its radius the model's trunk and its height the model's, at the prop's size, standing on the ground)
              expect(c.shape).toBe('cylinder');
              expect(c.args[0]).toBeCloseTo((row.height * p.scale) / 2, 6);
              expect(c.args[1]).toBeCloseTo(row.trunk * p.scale, 6);
              expect(d.position[1]).toBeCloseTo(p.y + (row.height * p.scale) / 2, 6);
            } else {
              expect(c.shape).toBe('ball');
              expect(c.args[0]).toBeCloseTo(0.6 * row.radius * p.scale, 6);
            }
          }
        }
      });
    for (const k of Object.keys(seen)) expect(seen[k], k).toBeGreaterThan(0);
    world.dispose();
  }, 30000);

  it('falls the budget’s leaves, and thins every pool’s bands by a quarter at the third step down, once', async () => {
    const rt = fakeRt({ tier: 'high' });
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    const b = budget('high');
    expect(world.scene.leaves.state.count).toBe(b.leaves);
    await run(world, 0.5);
    const pools = [...world.scene.pools];
    expect(pools.length).toBeGreaterThan(0);
    // (trees, bushes and rocks the level's bands; the cover four tenths of them)
    const bands = (name, k = 1) => (COVER.has(MANIFEST.models[name].kind) ? [0.4 * b.near * k, 0.4 * b.mid * k] : [b.near * k, b.mid * k]);
    const close = (k) => {
      for (const [name, p] of pools) {
        const [near, mid] = bands(name, k);
        expect(p.bands[0]).toBeCloseTo(near, 9);
        expect(p.bands[1]).toBeCloseTo(mid, 9);
      }
    };
    close(1);
    world.lowerQuality(1);
    world.lowerQuality(2);
    close(1);
    world.lowerQuality(3);
    close(0.75);
    world.lowerQuality(4);
    close(0.75);
    world.dispose();
  }, 30000);

  it('casts shadows from its trees, bushes and rocks up close, and none from the cover', async () => {
    const rt = fakeRt({ tier: 'high' });
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    await run(world, 0.5);
    const seen = { cover: 0, species: 0 };
    for (const [name, p] of world.scene.pools) {
      await p.ready;
      const cover = COVER.has(MANIFEST.models[name].kind);
      seen[cover ? 'cover' : 'species']++;
      const full = p.group.children.filter((m) => m.userData.level === 0);
      expect(full.length).toBeGreaterThan(0);
      for (const m of full) expect(m.castShadow, name).toBe(!cover);
      for (const m of p.group.children.filter((m) => m.userData.level > 0)) expect(m.castShadow, name).toBe(false);
    }
    expect(seen.cover).toBeGreaterThan(0);
    expect(seen.species).toBeGreaterThan(0);
    world.dispose();
  }, 30000);

  it('frees its pools, then the kit, when disposed of', async () => {
    const rt = fakeRt({ tier: 'low' });
    const world = await expanse.create(rt, { seed: 7, ...KIT });
    await run(world, 0.5);
    const { pools, kit } = world.scene;
    const names = [...pools.keys()];
    expect(names.length).toBeGreaterThan(0);
    const groups = [...pools.values()].map((p) => p.group);
    const order = [];
    for (const [name, p] of pools) {
      const d = p.dispose;
      p.dispose = () => (order.push(name), d());
    }
    const kd = kit.dispose;
    kit.dispose = () => (order.push('kit'), kd());
    world.dispose();
    expect(order).toEqual([...names, 'kit']);
    for (const g of groups) expect(g.parent).toBeNull();
    // (the kit gone: it makes no puff now)
    expect(kit.puff(names[0])).toBeNull();
  }, 30000);
});
