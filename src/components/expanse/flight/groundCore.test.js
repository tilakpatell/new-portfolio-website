import { describe, expect, it } from 'vitest';
import { IN_FLIGHT, UPLOADS_PER_FRAME, createGroundCore, gridFor } from './groundCore';
import { MAX_DEPTH, leafOf, sizeAt } from '../../../lib/land/flight/quadtree';
import { answerFor, fakeSink, fakeWorkers, flush, settle, spec } from './fixtures/ground';
import { CLUTTER_KINDS, SOLID } from '../../../lib/land/flight/leafMesh';

describe('the ground on the page', () => {
  it('keeps the spec’s numbers', () => {
    expect(IN_FLIGHT).toBe(6);
    expect(UPLOADS_PER_FRAME).toEqual({ low: 1, mid: 2, high: 3, ultra: 3 });
    expect(gridFor('mid')).toBe(33);
    expect(gridFor('low')).toBe(33);
    expect(gridFor('high')).toBe(65);
    expect(gridFor('ultra')).toBe(65);
  });

  it('asks for the far ground first and the leaf under the ship last, coarse to fine', () => {
    const workers = fakeWorkers();
    const core = createGroundCore({ workers, sink: fakeSink(), spec, tier: 'mid' });
    for (let i = 0; i < 200 && workers.asked.length < 50; i++) {
      core.update({ x: 0, z: 0 });
      workers.answerAll();
      core.update({ x: 0, z: 0 });
    }
    const ds = workers.asked.map((m) => m.leaf.d);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThanOrEqual(ds[i - 1]);
    expect(workers.asked[0].priority).toBe(workers.asked[0].leaf.d);
    expect(workers.asked.length).toBeGreaterThan(0);
  });

  it('never has more than IN_FLIGHT asked at once', async () => {
    const workers = fakeWorkers();
    const core = createGroundCore({ workers, sink: fakeSink(), spec, tier: 'mid' });
    for (let i = 0; i < 5; i++) core.update({ x: 0, z: 0 });
    expect(workers.jobs.size).toBe(IN_FLIGHT);
  });

  it('makes at most UPLOADS_PER_FRAME meshes a frame', async () => {
    for (const tier of ['low', 'mid', 'high']) {
      const workers = fakeWorkers();
      const sink = fakeSink();
      const core = createGroundCore({ workers, sink, spec, tier });
      core.update({ x: 0, z: 0 });
      workers.answerAll();
      await flush();
      expect(core.stats().pending).toBe(IN_FLIGHT);
      core.update({ x: 0, z: 0 });
      expect(sink.meshes.size).toBe(UPLOADS_PER_FRAME[tier]);
    }
  });

  it('makes no mesh of an answer for ground the ship has left', async () => {
    const workers = fakeWorkers();
    const sink = fakeSink();
    const core = createGroundCore({ workers, sink, spec, tier: 'mid' });
    core.update({ x: 0, z: 0 });
    const first = workers.asked.map((m) => m.key);
    // it flies a long way before anything comes back
    core.update({ x: 400000, z: 400000 });
    expect(workers.cancelled.sort()).toEqual([...first].sort());
    workers.answerAll();
    await flush();
    for (let i = 0; i < 10; i++) core.update({ x: 400000, z: 400000 });
    for (const key of first) expect(sink.meshes.has(key)).toBe(false);
  });

  it('refuses an answer that comes after its leaf was cancelled', async () => {
    const workers = fakeWorkers();
    const sink = fakeSink();
    const core = createGroundCore({ workers, sink, spec, tier: 'ultra' });
    core.update({ x: 0, z: 0 });
    workers.answerAll();
    await flush();
    // answered, waiting to be uploaded, and then not wanted any more
    core.update({ x: 400000, z: 400000 }, { uploads: 0 });
    for (let i = 0; i < 10; i++) core.update({ x: 400000, z: 400000 });
    expect([...sink.meshes.keys()].every((k) => !workers.asked.slice(0, IN_FLIGHT).some((m) => m.key === k))).toBe(true);
  });

  it('reads the height from the finest leaf it shows', async () => {
    const workers = fakeWorkers();
    const sink = fakeSink();
    const core = createGroundCore({ workers, sink, spec, tier: 'ultra' });
    expect(core.heightUnder(10, 10)).toBeNaN();
    await settle(core, workers, { x: 10, z: 10 });
    // the fake ground is 5 m plus the leaf's depth
    expect(core.heightUnder(10, 10)).toBe(5 + MAX_DEPTH);
    const under = leafOf(MAX_DEPTH, 0, 0).key;
    expect(sink.meshes.get(under).visible).toBe(true);
  });

  it('shows every leaf it wants once settled, and their clutter with them', async () => {
    const workers = fakeWorkers();
    const sink = fakeSink();
    const core = createGroundCore({ workers, sink, spec, tier: 'ultra' });
    await settle(core, workers, { x: 10, z: 10 });
    const shown = [...sink.meshes.values()].filter((m) => m.visible);
    expect(shown.length).toBe(sink.meshes.size);
    expect(sink.clutter.size).toBe(shown.filter((m) => m.leaf.d >= 5).length);
    expect(core.stats()).toMatchObject({ leaves: sink.meshes.size, flying: 0, pending: 0, clutter: sink.clutter.size });
  });

  it('swaps a split with its parent still drawn until the children are in', async () => {
    const workers = fakeWorkers();
    const sink = fakeSink();
    const core = createGroundCore({ workers, sink, spec, tier: 'ultra' });
    await settle(core, workers, { x: 10, z: 10 });
    // a few leaves on: the ground under it splits and merges
    const at = { x: 10 + sizeAt(MAX_DEPTH) * 6, z: 10 };
    core.update(at);
    // nothing has come back: what was drawn is drawn still, and nothing new
    const visible = () => [...sink.meshes.values()].filter((m) => m.visible).map((m) => m.leaf);
    const covers = (x, z) => visible().filter((l) => x >= l.x0 && x < l.x0 + l.size && z >= l.z0 && z < l.z0 + l.size).length;
    for (const [x, z] of [[at.x, at.z], [0, 0], [-3000, 2000], [5000, -100]]) expect(covers(x, z)).toBe(1);
    await settle(core, workers, at);
    for (const [x, z] of [[at.x, at.z], [0, 0], [-3000, 2000], [5000, -100]]) expect(covers(x, z)).toBe(1);
  });

  it('follows the origin', () => {
    const sink = fakeSink();
    const core = createGroundCore({ workers: fakeWorkers(), sink, spec, tier: 'mid' });
    core.origin([50000, 0, -50000]);
    expect(sink.root).toEqual([-50000, 50000]);
  });

  it('frees everything and cancels every flight on dispose', async () => {
    const workers = fakeWorkers();
    const sink = fakeSink();
    const core = createGroundCore({ workers, sink, spec, tier: 'ultra' });
    await settle(core, workers, { x: 10, z: 10 });
    core.update({ x: 90000, z: 0 });
    const flying = [...workers.jobs.keys()];
    expect(flying.length).toBeGreaterThan(0);
    core.dispose();
    expect(sink.meshes.size).toBe(0);
    expect(sink.clutter.size).toBe(0);
    for (const k of flying) expect(workers.cancelled).toContain(k);
    expect(workers.closed).toBe(true);
  });

  it('counts a city’s towers as ground: their tops inside their footprints, the street beside', async () => {
    const tower = CLUTTER_KINDS.indexOf('tower');
    const workers = fakeWorkers({
      answer: (m) => {
        const a = answerFor(m);
        // a tower 3 × 100 m tall on the leaf at (0, 0)'s middle, as the worker would place it
        if (m.leaf.d === MAX_DEPTH && m.leaf.ix === 0 && m.leaf.iz === 0) a.clutter = new Float32Array([128, 11, 128, 0, 3, tower]);
        return a;
      },
    });
    const core = createGroundCore({ workers, sink: fakeSink(), spec, tier: 'ultra' });
    await settle(core, workers, { x: 10, z: 10 });
    expect(core.heightUnder(128, 128)).toBe(11 + SOLID.tower.h * 3);
    expect(core.heightUnder(128 + SOLID.tower.r * 3 - 1, 128)).toBe(11 + 300);
    expect(core.heightUnder(128 + SOLID.tower.r * 3 + 1, 128)).toBe(11);
    // from the next leaf over, still
    expect(core.heightUnder(256 + 5, 128)).toBe(11);
  });
});
