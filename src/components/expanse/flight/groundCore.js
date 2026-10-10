// The flight's ground on the page, without three.js: which leaves to ask the
// worker for, which answers become meshes this frame (a capped few, so an
// upload never costs a frame), which are shown, which go, and the height
// under the ship. A `sink` makes and frees the meshes and the clutter
// (./ground.js's, on three.js; a fake in the test), so all of this is tested
// in Node.
//
// The leaves are lib/land/flight/quadtree.js's for the middle of the ship's
// 256 m cell (one Map a cell, not a frame); the bookkeeping is
// lib/land/flight/stream.js's (a parent drawn until its children are in);
// the answers come from the worker pool (rt.workers) under WORKER. An
// answer becomes a mesh only when the streamer still wants it (`done`): one
// for ground the ship has left is dropped with its buffers. A leaf's clutter
// shows and hides with the leaf, so a parent's spires and its children's
// never stand twice.
//
// An answer that isn't whole (a buffer the wrong length, a number not
// finite) is dropped and the leaf asked once more, then given up on; a
// worker that dies (the pool replaces it and settles its job with null) costs
// the leaf a try, and three in a row give it up with one warning. A leaf
// given up on is never asked again until a reset, and the coarser leaf over
// its ground stays drawn (stream.js's rule), so a broken leaf is never a
// hole.
//
//   createGroundCore({ workers, sink, spec, tier, warn }) → { update(ship, { uploads }),
//     heightUnder(x, z) → metres | NaN, origin(at), setTier(tier), stats() →
//     { leaves, flying, pending, clutter, failed }, dispose() }
//   wholeAnswer(answer, n) → whether a worker's answer can become a mesh
//   sink: { add(leaf, answer) → mesh, show(mesh, on), remove(mesh),
//     clutterAdd(rows, leaf) → slots, clutterFree(slots), moveTo(at) }

import { MAX_DEPTH, keyOf, leavesFor, sizeAt } from '../../../lib/land/flight/quadtree.js';
import { createLeafStream } from '../../../lib/land/flight/stream.js';
import { heightOn } from '../../../lib/land/flight/sample.js';
import { CLUTTER_KINDS, SOLID } from '../../../lib/land/flight/leafMesh.js';

// a solid kind's size by its index (a row carries the index)
const SOLID_AT = CLUTTER_KINDS.map((k) => SOLID[k] ?? null);

export const WORKER = 'flight-terrain';
export const IN_FLIGHT = 6;
export const UPLOADS_PER_FRAME = { low: 1, mid: 2, high: 3, ultra: 3 };
// vertices a leaf's side: finer ground on the strong tiers
export const gridFor = (tier) => (tier === 'high' || tier === 'ultra' ? 65 : 33);

const CELL = sizeAt(MAX_DEPTH);
// tries a leaf gets: an answer not whole is asked once more; a dead worker, three times
export const TRIES = { bad: 2, error: 3 };

const finite = (a) => {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false;
  return true;
};
export function wholeAnswer(a, n) {
  if (!a || a.n !== n) return false;
  const verts = n * n + 4 * n - 4;
  const { positions, normals, indices, heights, clutter } = a;
  if (!(positions instanceof Float32Array) || positions.length !== verts * 3) return false;
  if (!(normals instanceof Float32Array) || normals.length !== verts * 3) return false;
  if (!(indices instanceof Uint32Array) || indices.length !== ((n - 1) * (n - 1) + 4 * n - 4) * 6) return false;
  if (!(heights instanceof Float32Array) || heights.length !== n * n) return false;
  if (!(clutter instanceof Float32Array) || clutter.length % 6) return false;
  for (let i = 0; i < indices.length; i++) if (indices[i] >= verts) return false;
  return finite(positions) && finite(normals) && finite(heights) && finite(clutter);
}

export function createGroundCore({ workers, sink, spec, tier = 'mid', warn = (...a) => console.warn(...a) }) {
  const stream = createLeafStream({ inFlight: IN_FLIGHT, keep: 2 });
  const n = gridFor(tier);
  let uploads = UPLOADS_PER_FRAME[tier] ?? 2;
  let leafTier = tier;
  let cellKey = null;
  let leaves = new Map();
  const pending = []; // answers in, not yet meshes: { gen, leaf, answer }
  const meshes = new Map(); // key → { leaf, mesh, answer, shown, slots }
  const tickets = new Map(); // key → the ask its answer must match
  let ticket = 0;
  const fails = new Map(); // key → tries failed in a row
  let clutter = 0;
  let disposed = false;

  const show = (m, on) => {
    if (m.shown === on) return;
    m.shown = on;
    sink.show(m.mesh, on);
    if (on && m.answer.clutter.length) {
      m.slots = sink.clutterAdd(m.answer.clutter, m.leaf);
      clutter += m.slots.length;
    } else if (!on && m.slots) {
      sink.clutterFree(m.slots);
      clutter -= m.slots.length;
      m.slots = null;
    }
  };
  const free = (key) => {
    const m = meshes.get(key);
    if (!m) return;
    show(m, false);
    sink.remove(m.mesh);
    meshes.delete(key);
  };

  // a try failed: asked again at the next update, or given up on
  const failure = (key, gen, kind) => {
    const n = (fails.get(key) ?? 0) + 1;
    fails.set(key, n);
    stream.failed(key, gen);
    if (n < TRIES[kind]) return;
    stream.block(key);
    warn(`[flight] the ground at ${key} failed ${n} times (${kind === 'bad' ? 'an answer not whole' : 'its worker died'}); the coarser ground stays under it`);
  };

  const ask = (key) => {
    const leaf = leaves.get(key);
    const gen = stream.gen;
    const mine = ++ticket;
    tickets.set(key, mine);
    stream.began(key, gen);
    // (priority is the depth: the pool takes the lowest first, so coarse
    // ground, which covers the most, comes first, as the streamer asks)
    workers.request(WORKER, { key, priority: leaf.d, spec, leaf, n, tier: leafTier }).then(
      (answer) => {
        // (not ours any more: cancelled, or asked again since)
        if (disposed || tickets.get(key) !== mine) return;
        tickets.delete(key);
        // (null while still ours: the worker died, and the pool made another)
        if (!answer) failure(key, gen, 'error');
        else if (!wholeAnswer(answer, n)) failure(key, gen, 'bad');
        else {
          fails.delete(key);
          pending.push({ gen, leaf, answer });
        }
      },
      () => {
        if (tickets.get(key) !== mine) return;
        tickets.delete(key);
        failure(key, gen, 'error');
      },
    );
  };

  return {
    update(ship, opts = {}) {
      if (disposed) return;
      // the answers in, a few a frame, those still wanted
      let room = opts.uploads ?? uploads;
      while (room > 0 && pending.length) {
        const { gen, leaf, answer } = pending.shift();
        if (!stream.done(leaf.key, gen)) continue;
        meshes.set(leaf.key, { leaf, mesh: sink.add(leaf, answer), answer, shown: false, slots: null });
        room--;
      }
      const cx = Math.floor(ship.x / CELL), cz = Math.floor(ship.z / CELL);
      const k = `${cx},${cz}`;
      if (k !== cellKey) {
        cellKey = k;
        leaves = leavesFor((cx + 0.5) * CELL, (cz + 0.5) * CELL);
      }
      const { ask: asks, drop, cancel } = stream.update(leaves);
      for (const key of cancel) {
        tickets.delete(key);
        workers.cancel(WORKER, key);
      }
      for (const key of drop) free(key);
      for (const key of asks) ask(key);
      for (const [key, m] of meshes) show(m, stream.shows(key));
    },

    // the finest leaf shown under (x, z): what the ship sees is what it
    // hits, a city's towers among it (their tops, inside their footprints,
    // on that leaf and the eight round it)
    heightUnder(x, z) {
      for (let d = MAX_DEPTH; d >= 0; d--) {
        const s = sizeAt(d);
        const ix = Math.floor(x / s), iz = Math.floor(z / s);
        const m = meshes.get(keyOf(d, ix, iz));
        if (!m?.shown) continue;
        let h = heightOn(m.leaf, m.answer.heights, m.answer.n, x, z);
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const k = meshes.get(keyOf(d, ix + dx, iz + dz));
            const rows = k?.shown ? k.answer.clutter : null;
            if (!rows) continue;
            for (let r = 0; r < rows.length; r += 6) {
              const solid = SOLID_AT[rows[r + 5]];
              if (!solid) continue;
              const sc = rows[r + 4];
              if (Math.abs(x - rows[r]) < solid.r * sc && Math.abs(z - rows[r + 2]) < solid.r * sc) h = Math.max(h, rows[r + 1] + solid.h * sc);
            }
          }
        return h;
      }
      return NaN;
    },

    origin(at) {
      sink.moveTo(at);
    },

    // a lower tier when the frames run late: fewer uploads a frame, thinner
    // clutter on the leaves asked from now on (the grid stays: a change
    // there would mean asking for everything again)
    setTier(t) {
      leafTier = t;
      uploads = UPLOADS_PER_FRAME[t] ?? uploads;
    },

    stats: () => ({ leaves: meshes.size, flying: stream.flying.size, pending: pending.length, clutter, failed: stream.blocked.size }),

    dispose() {
      disposed = true;
      for (const key of stream.flying.keys()) workers.cancel(WORKER, key);
      for (const key of [...meshes.keys()]) free(key);
      pending.length = 0;
      fails.clear();
      stream.reset();
      workers.close?.(WORKER);
    },
  };
}
