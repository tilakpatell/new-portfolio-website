// Minecraft, the work done off the main thread (the page asks for it
// through the runtime's worker pool, runtime/workers.js: a promise per
// key). The worker (../worker.js) is a thin shell round `makeCore`: making a
// chunk (generating it, and meshing its sixteen sections against the real
// terrain of its eight neighbours, which it makes for itself: generation is
// a pure function of the seed, so it never needs the page's copies) and
// re-meshing an edited section from the page's chunk and its neighbours'
// borders. Jobs wait in a queue nearest first; a job the page no longer
// wants (the player has moved on) is cancelled before it runs, and a result
// that arrives for one anyway is dropped by the pool.
//
// Messages, page to worker:
//   { type: 'chunk', key, seed, cx, cz, priority, edits: { [chunkKey]: packed } }
//     (lit, rules/light.js, over the eight round it, then meshed)
//     (the player's edits to the chunk and to any of its eight neighbours,
//     put into copies of the made terrain before meshing)
//   { type: 'mesh', key, cx, cz, sections, priority, chunk: { ids, state, light, lit }, borders }
//   { type: 'cancel', key }
// and back:
//   { type: 'chunk', key, cx, cz, ids, state, light, meshes: [16 × { opaque, cutout, water }] }
//   { type: 'mesh', key, cx, cz, sections, meshes }
// Arrays travel as transferables.

import { applyEdits, key, makeChunk } from './chunk.js';
import { lightRegion } from './light.js';
import { meshSection } from './mesher.js';
import { makeGenerator } from './worldgen.js';

export const chunkKey = (cx, cz) => key(cx, cz);
export const meshKey = (cx, cz, sy) => `${key(cx, cz)}:${sy}`;

export function makeQueue() {
  const jobs = new Map();
  return {
    push(job) {
      jobs.set(job.key, job);
    },
    cancel: (k) => jobs.delete(k),
    next() {
      let best = null;
      for (const j of jobs.values()) if (!best || j.priority < best.priority) best = j;
      if (best) jobs.delete(best.key);
      return best;
    },
    get size() {
      return jobs.size;
    },
  };
}

// The strips of a chunk's neighbours that its sections' faces and corners
// look at: the column of each side chunk touching it (16 × 256) and the
// corner chunks' one column each (256).
const SIDES = {
  nx: (y, t) => [15, y, t],
  px: (y, t) => [0, y, t],
  nz: (y, t) => [t, y, 15],
  pz: (y, t) => [t, y, 0],
};
const CORNERS = { nxnz: [15, 15], pxnz: [0, 15], nxpz: [15, 0], pxpz: [0, 0] };
const at = (x, y, z) => (y * 16 + z) * 16 + x;

export function borders(nb) {
  const out = {};
  for (const [side, cell] of Object.entries(SIDES)) {
    const c = nb[side];
    if (!c) continue;
    const ids = new Uint8Array(16 * 256);
    const light = new Uint8Array(16 * 256);
    for (let y = 0; y < 256; y++)
      for (let t = 0; t < 16; t++) {
        const i = at(...cell(y, t));
        ids[y * 16 + t] = c.ids[i];
        light[y * 16 + t] = c.light[i];
      }
    out[side] = { ids, light, lit: c.lit };
  }
  for (const [corner, [x, z]] of Object.entries(CORNERS)) {
    const c = nb[corner];
    if (!c) continue;
    const ids = new Uint8Array(256);
    const light = new Uint8Array(256);
    for (let y = 0; y < 256; y++) {
      ids[y] = c.ids[at(x, y, z)];
      light[y] = c.light[at(x, y, z)];
    }
    out[corner] = { ids, light, lit: c.lit };
  }
  return out;
}

// borders back into chunks the mesher can read (only the strips are filled)
function fromBorders(b) {
  const nb = {};
  for (const [side, cell] of Object.entries(SIDES)) {
    if (!b[side]) continue;
    const c = makeChunk(0, 0);
    c.lit = b[side].lit;
    for (let y = 0; y < 256; y++)
      for (let t = 0; t < 16; t++) {
        const i = at(...cell(y, t));
        c.ids[i] = b[side].ids[y * 16 + t];
        c.light[i] = b[side].light[y * 16 + t];
      }
    nb[side] = c;
  }
  for (const [corner, [x, z]] of Object.entries(CORNERS)) {
    if (!b[corner]) continue;
    const c = makeChunk(0, 0);
    c.lit = b[corner].lit;
    for (let y = 0; y < 256; y++) {
      c.ids[at(x, y, z)] = b[corner].ids[y];
      c.light[at(x, y, z)] = b[corner].light[y];
    }
    nb[corner] = c;
  }
  return nb;
}

const NEIGHBOURS = [['nx', -1, 0], ['px', 1, 0], ['nz', 0, -1], ['pz', 0, 1], ['nxnz', -1, -1], ['pxnz', 1, -1], ['nxpz', -1, 1], ['pxpz', 1, 1]];

function meshesOut(list) {
  const transfer = [];
  for (const m of list) for (const pass of ['opaque', 'cutout', 'water']) if (m[pass]) transfer.push(m[pass].data.buffer);
  return transfer;
}

export function makeCore({ textures, cacheSize = 300 }) {
  const queue = makeQueue();
  const gens = new Map();
  // the chunks made lately, so a neighbour is made once, not once per chunk beside it
  const cache = new Map();
  const genFor = (seed) => {
    if (!gens.has(seed)) gens.set(seed, makeGenerator(seed));
    return gens.get(seed);
  };
  function made(seed, cx, cz) {
    const k = `${seed}|${cx},${cz}`;
    let c = cache.get(k);
    if (c) {
      cache.delete(k);
      cache.set(k, c);
      return c;
    }
    c = makeChunk(cx, cz);
    genFor(seed).generate(c);
    c.state = null;
    c.edits = null;
    cache.set(k, c);
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
    return c;
  }

  function work(job) {
    if (job.type === 'chunk') {
      // the made terrain, or a copy of it with the player's edits in
      const edited = (cx, cz) => {
        const base = made(job.seed, cx, cz);
        const packed = job.edits?.[key(cx, cz)];
        if (!packed) return base;
        const c = makeChunk(cx, cz);
        c.ids.set(base.ids);
        applyEdits(c, packed);
        return c;
      };
      const c = edited(job.cx, job.cz);
      const around = {};
      for (const [side, dx, dz] of NEIGHBOURS) around[side] = edited(job.cx + dx, job.cz + dz);
      // lit with its neighbours' margin, then meshed in that light (copies: the cache stays unlit)
      const lit = lightRegion(c, around);
      const centre = { cx: c.cx, cz: c.cz, ids: c.ids, state: c.state, light: lit.centre, lit: true };
      const nb = {};
      for (const side of Object.keys(around)) nb[side] = { ids: around[side].ids, state: around[side].state, light: lit.around[side], lit: true };
      const meshes = [];
      for (let s = 0; s < 16; s++) meshes.push(meshSection(centre, s, nb, { textures }));
      const ids = c.ids.slice();
      const state = c.state ? c.state.slice() : new Uint8Array(ids.length);
      const light = lit.centre;
      return { msg: { type: 'chunk', key: job.key, cx: job.cx, cz: job.cz, ids, state, light, meshes }, transfer: [ids.buffer, state.buffer, light.buffer, ...meshesOut(meshes)] };
    }
    if (job.type === 'mesh') {
      const c = makeChunk(job.cx, job.cz);
      c.ids = job.chunk.ids;
      c.state = job.chunk.state;
      c.light = job.chunk.light;
      c.lit = job.chunk.lit;
      const nb = fromBorders(job.borders ?? {});
      const meshes = job.sections.map((s) => meshSection(c, s, nb, { textures }));
      return { msg: { type: 'mesh', key: job.key, cx: job.cx, cz: job.cz, sections: job.sections, meshes }, transfer: meshesOut(meshes) };
    }
    return null;
  }

  return {
    handle(msg) {
      if (msg.type === 'cancel') queue.cancel(msg.key);
      else queue.push(msg);
    },
    // one job, the nearest
    step() {
      const job = queue.next();
      return job ? work(job) : null;
    },
    run() {
      const out = [];
      for (let r; (r = this.step()); ) out.push(r);
      return out;
    },
    get queued() {
      return queue.size;
    },
  };
}
