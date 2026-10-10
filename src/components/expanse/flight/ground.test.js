import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TRIES, createGroundCore, wholeAnswer } from './groundCore';
import { createGround, heroOf } from './ground';
import flight from './module';
import { answerFor, fakeSink, fakeWorkers, flush, settle, spec } from './fixtures/ground';
import { MAX_DEPTH, keyOf, sizeAt } from '../../../lib/land/flight/quadtree';
import { planetSpecOf } from './planets';
import { createOrigin } from '../../../runtime/origin';
import { createEvents } from '../../../runtime/runtime';
import { STRIP } from './look';

// the leaf under (x, z) at the finest depth, and its parent
const under = (x, z, d = MAX_DEPTH) => keyOf(d, Math.floor(x / sizeAt(d)), Math.floor(z / sizeAt(d)));

describe('an answer the ground takes', () => {
  const msg = { key: 'k', leaf: { size: 256, d: 6, x0: 0, z0: 0 }, n: 9 };
  it('is whole: every buffer its length, every number finite', () => {
    expect(wholeAnswer(answerFor(msg), 9)).toBe(true);
    expect(wholeAnswer(answerFor(msg), 33)).toBe(false);
    expect(wholeAnswer({ ...answerFor(msg), heights: new Float32Array(3) }, 9)).toBe(false);
    const nan = answerFor(msg);
    nan.positions[4] = NaN;
    expect(wholeAnswer(nan, 9)).toBe(false);
    const inf = answerFor(msg);
    inf.clutter = new Float32Array([1, Infinity, 1, 0, 1, 0]);
    expect(wholeAnswer(inf, 9)).toBe(false);
    const far = answerFor(msg);
    far.indices[0] = 1e6;
    expect(wholeAnswer(far, 9)).toBe(false);
    expect(wholeAnswer(null, 9)).toBe(false);
  });
});

describe('the ground when a leaf goes wrong', () => {
  it('drops an answer not whole, asks once more, then gives the leaf up until a reset', async () => {
    const bad = under(10, 10);
    const workers = fakeWorkers({ answer: (m) => (m.key === bad ? { ...answerFor(m), heights: new Float32Array([NaN]) } : answerFor(m)) });
    const warned = [];
    const core = createGroundCore({ workers, sink: fakeSink(), spec, tier: 'ultra', warn: (t) => warned.push(t) });
    await settle(core, workers, { x: 10, z: 10 });
    expect(workers.asked.filter((m) => m.key === bad)).toHaveLength(TRIES.bad);
    expect(core.stats().failed).toBe(1);
    expect(warned).toHaveLength(1);
    // (and not again, however long it flies there)
    for (let i = 0; i < 20; i++) core.update({ x: 10, z: 10 });
    expect(workers.asked.filter((m) => m.key === bad)).toHaveLength(TRIES.bad);
  });

  it('asks again when its worker dies; three in a row warn once and leave the coarser ground under it', async () => {
    const workers = fakeWorkers();
    const sink = fakeSink();
    const warned = [];
    const core = createGroundCore({ workers, sink, spec, tier: 'ultra', warn: (t) => warned.push(t) });
    // the ground in at one place, then a few leaves on: the ground there splits
    await settle(core, workers, { x: 10, z: 10 });
    const at = { x: 10 + sizeAt(MAX_DEPTH) * 7, z: 10 };
    const doomed = under(at.x, at.z);
    // its worker dies on it every time (the pool settles the job null and makes another)
    const answerAll = workers.answerAll.bind(workers);
    workers.answerAll = () => {
      const job = workers.jobs.get(doomed);
      if (job) {
        workers.jobs.delete(doomed);
        job.resolve(null);
      }
      answerAll();
    };
    await settle(core, workers, at);
    expect(workers.asked.filter((m) => m.key === doomed)).toHaveLength(TRIES.error);
    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatch(doomed);
    // no hole: one drawn leaf covers the ship's ground, and it is coarser than the one given up on
    const shown = [...sink.meshes.values()].filter((m) => m.visible).map((m) => m.leaf);
    const over = shown.filter((l) => at.x >= l.x0 && at.x < l.x0 + l.size && at.z >= l.z0 && at.z < l.z0 + l.size);
    expect(over).toHaveLength(1);
    expect(over[0].d).toBeLessThan(MAX_DEPTH);
    expect(Number.isFinite(core.heightUnder(at.x, at.z))).toBe(true);
  });
});

// a runtime with the fake pool answering by itself, a turn later
function fakeRt() {
  const renderer = { toneMapping: 0, toneMappingExposure: 1, shadowMap: { enabled: true }, render() {} };
  const workers = fakeWorkers();
  const request = workers.request.bind(workers);
  workers.request = (name, msg) => {
    const p = request(name, msg);
    setTimeout(() => workers.answerAll(), 0);
    return p;
  };
  workers.define = () => {};
  return { gfx: { renderer }, quality: { tier: 'ultra' }, input: { bind() {}, unbind() {} }, workers, origin: createOrigin(), events: createEvents() };
}

describe('the ground in three.js', () => {
  it('frees a dropped leaf’s geometry and its clutter slots', async () => {
    const rt = fakeRt();
    const scene = new THREE.Scene();
    const ground = createGround(scene, { rt, spec: { ...planetSpecOf('hoth'), id: 'g' }, tier: 'ultra', palette: STRIP });
    const fly = async (x, z) => {
      for (let i = 0; i < 300; i++) {
        ground.update({ x, z });
        await flush();
        const s = ground.stats();
        if (!s.flying && !s.pending && i > 2) break;
      }
      ground.update({ x, z });
    };
    await fly(10, 10);
    const before = ground.stats();
    expect(before.geometries).toBe(before.leaves);
    expect(before.clutter).toBeGreaterThan(0);
    // far off: every leaf of the first place goes, and its clutter with it
    await fly(300000, 300000);
    const after = ground.stats();
    expect(after.geometries).toBe(after.leaves);
    const drawn = (name) => {
      const m = scene.getObjectByName(name);
      const zero = new THREE.Matrix4();
      let n = 0;
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, zero);
        if (zero.elements[0] !== 0) n++;
      }
      return n;
    };
    expect(drawn('flight-rock') + drawn('flight-spire') + drawn('flight-debris')).toBe(after.clutter);
    ground.dispose();
    expect(ground.stats().geometries).toBe(0);
    expect(ground.stats().clutter).toBe(0);
  });
});

describe('the ship after a crash', () => {
  const ready = async (world, ship) => {
    for (let i = 0; i < 400 && !Number.isFinite(world.groundUnder?.() ?? NaN); i++) {
      world.step(1 / 60, { axis: () => 0, stick: { x: 0, y: 0 } });
      world.ship = ship;
      await flush();
    }
  };

  it('comes back 200 m over the ground drawn, never under it', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('hoth') });
    const still = { x: 10, z: 10, y: 400, pitch: 0, roll: 0, speed: 40 };
    await ready(world, still);
    const h = world.groundUnder();
    expect(Number.isFinite(h)).toBe(true);
    world.ship = { y: h - 50 };
    world.step(1 / 60, { axis: () => 0, stick: { x: 0, y: 0 } });
    expect(world.ship.y).toBeGreaterThan(h + 150);
    world.dispose();
  });

  it('waits where the ground isn’t in yet, and then goes up over it', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('hoth') });
    world.ship = { x: 10, z: 10, y: -500, pitch: 0, roll: 0, speed: 40 };
    world.respawn();
    world.step(1 / 60, { axis: () => 0, stick: { x: 0, y: 0 } });
    // nothing drawn under it yet: held where it was
    expect(world.ship).toMatchObject({ x: 10, z: 10, y: -500 });
    for (let i = 0; i < 400 && world.ship.y === -500; i++) {
      world.step(1 / 60, { axis: () => 0, stick: { x: 0, y: 0 } });
      await flush();
    }
    expect(world.ship.y).toBe(world.groundUnder() + 200);
    world.dispose();
  });

  it('never crashes on a soft world: Bespin’s deck is cloud', async () => {
    const rt = fakeRt();
    const world = await flight.create(rt, { spec: planetSpecOf('bespin') });
    for (let i = 0; i < 400 && !Number.isFinite(world.groundUnder()); i++) {
      world.step(1 / 60, { axis: () => 0, stick: { x: 0, y: 0 } });
      world.ship = { x: 10, z: 10, y: 400 };
      await flush();
    }
    const h = world.groundUnder();
    world.ship = { y: h - 30 };
    world.step(1 / 60, { axis: () => 0, stick: { x: 0, y: 0 } });
    expect(world.ship.y).toBeLessThan(h);
    world.dispose();
  });
});

describe('the clutter’s kinds', () => {
  it('has a pool only for the kinds the planet names, a shape for each', () => {
    const rt = fakeRt();
    for (const [id, kinds] of [['kashyyyk', ['trunk', 'rock', 'debris']], ['geonosis', ['hive', 'rock', 'debris']], ['cybertron', ['crystal', 'debris', 'spire']], ['dot-matrix', ['block', 'spire']], ['kamino', []]]) {
      const scene = new THREE.Scene();
      const ground = createGround(scene, { rt, spec: planetSpecOf(id), tier: 'mid', palette: STRIP });
      const pools = [];
      scene.traverse((o) => o.isInstancedMesh && pools.push(o.name.replace('flight-', '')));
      expect(pools.sort(), id).toEqual([...kinds].sort());
      scene.traverse((o) => o.isInstancedMesh && expect(o.geometry.attributes.position.count).toBeGreaterThan(0));
      ground.dispose();
    }
  });

  it('makes the film-made tower one geometry, 100 m tall, standing on its middle', () => {
    const root = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(10, 40, 10), new THREE.MeshStandardMaterial());
    a.position.set(50, 20, -30);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10), a.material);
    b.position.set(50, 45, -30);
    root.add(a, b);
    root.scale.setScalar(3);
    const made = heroOf(root);
    made.geometry.computeBoundingBox();
    const box = made.geometry.boundingBox;
    expect(box.max.y - box.min.y).toBeCloseTo(100, 4);
    expect(box.min.y).toBeCloseTo(0, 4);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 4);
    expect(made.material).toBe(a.material);
    expect(heroOf(new THREE.Group())).toBeNull();
  });

  it('draws a pool only as far as its highest slot in use', async () => {
    const rt = fakeRt();
    const scene = new THREE.Scene();
    const ground = createGround(scene, { rt, spec: { ...planetSpecOf('hoth'), id: 'h' }, tier: 'ultra', palette: STRIP });
    const rock = () => scene.getObjectByName('flight-rock');
    expect(rock().count).toBe(0);
    for (let i = 0; i < 300; i++) {
      ground.update({ x: 10, z: 10 });
      await flush();
      if (ground.stats().clutter && !ground.stats().flying && !ground.stats().pending) break;
    }
    const placed = ground.stats().clutter;
    expect(placed).toBeGreaterThan(0);
    expect(rock().count).toBeGreaterThan(0);
    expect(rock().count).toBeLessThan(rock().instanceMatrix.count);
    ground.dispose();
  });
});
