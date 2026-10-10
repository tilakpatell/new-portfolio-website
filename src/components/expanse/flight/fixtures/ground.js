// Fakes for the ground's tests: a worker pool that holds every job until told
// to answer, a mesh sink that only counts, and a flight to settle the ground.
import { WORKER } from '../groundCore';

// an answer shaped as leafMesh.js's: a flat ground 5 m up plus the leaf's
// depth, a row of clutter on the fine leaves
export function answerFor({ key, leaf, n }) {
  const verts = n * n + 4 * n - 4;
  return {
    key,
    n,
    step: leaf.size / (n - 1),
    positions: new Float32Array(verts * 3),
    normals: new Float32Array(verts * 3),
    indices: new Uint32Array(((n - 1) * (n - 1) + 4 * n - 4) * 6),
    heights: new Float32Array(n * n).fill(5 + leaf.d),
    clutter: leaf.d >= 5 ? new Float32Array([leaf.x0 + 1, 5, leaf.z0 + 1, 0, 1, 0]) : new Float32Array(0),
  };
}

// A pool that holds every job until told to answer it, as runtime/workers.js
// would settle it: the answer, or null when cancelled
export function fakeWorkers({ answer = answerFor } = {}) {
  const jobs = new Map();
  const asked = [];
  const cancelled = [];
  return {
    asked,
    cancelled,
    jobs,
    request(name, msg) {
      if (name !== WORKER) throw new Error(`asked ${name}`);
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
    // answer every job held (answerFor's, unless the pool was given its own)
    answerAll() {
      for (const [key, { msg, resolve }] of [...jobs]) {
        jobs.delete(key);
        resolve(answer(msg));
      }
    },
  };
}

export function fakeSink() {
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

export const flush = () => new Promise((r) => setTimeout(r, 0));
export const spec = { id: 'test', clutter: [], pois: [] };

// fly the core at (x, z) until nothing more comes, answering every job
export async function settle(core, workers, ship, frames = 400) {
  for (let i = 0; i < frames; i++) {
    core.update(ship);
    workers.answerAll();
    await flush();
    const s = core.stats();
    if (!s.flying && !s.pending && i > 2) break;
  }
  core.update(ship);
}

