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
//   createGroundCore({ workers, sink, spec, tier }) → { update(ship, { uploads }),
//     heightUnder(x, z) → metres | NaN, origin(at), setTier(tier), stats() →
//     { leaves, flying, pending, clutter }, dispose() }
//   sink: { add(leaf, answer) → mesh, show(mesh, on), remove(mesh),
//     clutterAdd(rows) → slots, clutterFree(slots), moveTo(at) }

import { MAX_DEPTH, keyOf, leavesFor, sizeAt } from '../../../lib/land/flight/quadtree.js';
import { createLeafStream } from '../../../lib/land/flight/stream.js';
import { heightOn } from '../../../lib/land/flight/sample.js';

export const WORKER = 'flight-terrain';
export const IN_FLIGHT = 6;
export const UPLOADS_PER_FRAME = { low: 1, mid: 2, high: 3, ultra: 3 };
// vertices a leaf's side: finer ground on the strong tiers
export const gridFor = (tier) => (tier === 'high' || tier === 'ultra' ? 65 : 33);

const CELL = sizeAt(MAX_DEPTH);

export function createGroundCore({ workers, sink, spec, tier = 'mid' }) {
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
  let clutter = 0;
  let disposed = false;

  const show = (m, on) => {
    if (m.shown === on) return;
    m.shown = on;
    sink.show(m.mesh, on);
    if (on && m.answer.clutter.length) {
      m.slots = sink.clutterAdd(m.answer.clutter);
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
        if (disposed || tickets.get(key) !== mine) return;
        tickets.delete(key);
        if (answer) pending.push({ gen, leaf, answer });
        else stream.failed(key, gen);
      },
      () => {
        if (tickets.get(key) === mine) tickets.delete(key);
        stream.failed(key, gen);
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

    // the finest leaf shown under (x, z): what the ship sees is what it hits
    heightUnder(x, z) {
      for (let d = MAX_DEPTH; d >= 0; d--) {
        const s = sizeAt(d);
        const m = meshes.get(keyOf(d, Math.floor(x / s), Math.floor(z / s)));
        if (m?.shown) return heightOn(m.leaf, m.answer.heights, m.answer.n, x, z);
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

    stats: () => ({ leaves: meshes.size, flying: stream.flying.size, pending: pending.length, clutter }),

    dispose() {
      disposed = true;
      for (const key of stream.flying.keys()) workers.cancel(WORKER, key);
      for (const key of [...meshes.keys()]) free(key);
      pending.length = 0;
      stream.reset();
      workers.close?.(WORKER);
    },
  };
}
