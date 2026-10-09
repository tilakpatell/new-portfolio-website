import { describe, expect, it } from 'vitest';
import { IN_FLIGHT, UPLOADS_PER_FRAME, WORKER, createGroundCore, gridFor } from './groundCore';
import { MAX_DEPTH, leafOf, sizeAt } from '../../../lib/land/flight/quadtree';

// A pool that holds every job until told to answer it, as runtime/workers.js
// would settle it: the answer, or null when cancelled
function fakeWorkers() {
  const jobs = new Map();
  const asked = [];
  const cancelled = [];
  return {
    asked,
    cancelled,
    jobs,
    request(name, msg) {
      expect(name).toBe(WORKER);
      asked.push(msg);
      return new Promise((resolve) => jobs.set(msg.key, { msg, resolve }));
    },
    cancel(name, key) {
      cancelled.push(key);
      jobs.get(key)?.resolve(null);
      jobs.delete(key);
    },
    closed: false,
    close() {
      this.closed = true;
    },
    // answer every job held (a flat 5 m ground, a row of clutter on the fine ones)
    answerAll() {
      for (const [key, { msg, resolve }] of [...jobs]) {
        jobs.delete(key);
        const n = msg.n;
        resolve({ key, n, step: msg.leaf.size / (n - 1), positions: new Float32Array(3), normals: new Float32Array(3), indices: new Uint32Array(3), heights: new Float32Array(n * n).fill(5 + msg.leaf.d), clutter: msg.leaf.d >= 5 ? new Float32Array([msg.leaf.x0 + 1, 5, msg.leaf.z0 + 1, 0, 1, 0]) : new Float32Array(0) });
      }
    },
  };
}

function fakeSink() {
  const s = {
    meshes: new Map(),
    removed: [],
    clutter: new Set(),
    root: [0, 0],
    add(leaf) {
      const m = { leaf, visible: false };
      s.meshes.set(leaf.key, m);
      return m;
    },
    show(m, on) {
      m.visible = on;
    },
    remove(m) {
      s.meshes.delete(m.leaf.key);
      s.removed.push(m.leaf.key);
    },
    clutterAdd(rows) {
      const slots = [];
      for (let r = 0; r < rows.length; r += 6) {
        const id = Symbol('slot');
        s.clutter.add(id);
        slots.push(id);
      }
      return slots;
    },
    clutterFree(slots) {
      for (const id of slots) s.clutter.delete(id);
    },
    moveTo(at) {
      s.root = [-at[0], -at[2]];
    },
  };
  return s;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const spec = { id: 'test', clutter: [], pois: [] };

// fly the core at (x, z) until nothing more comes, answering every job
async function settle(core, workers, ship, frames = 400) {
  for (let i = 0; i < frames; i++) {
    core.update(ship);
    workers.answerAll();
    await flush();
    const s = core.stats();
    if (!s.flying && !s.pending && i > 2) break;
  }
  core.update(ship);
}

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
});
