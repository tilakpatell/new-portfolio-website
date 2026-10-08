// A planet's land streamed in round the car, on the runtime's chunk
// services (Minecraft's stream.js is the pattern): a chunk grid of 64 m
// cells (runtime/chunkGrid.js) says which to ask for, nearest first and
// ahead of the car, six in flight; the worker pool (runtime/workers.js) has
// ./worker.js make each (lib/land's makeCell and its mesh); at most two a
// frame are built, so a frame never takes many at once. A cell within two
// of the car's is meshed at 1 m, further out at 2 m; one crossing that ring
// is meshed again in the worker from the heights kept here. The cells
// within the physics radius (one round the car's) are made solid, and let
// go of as the car leaves them, every update, without the cell reloading.
// A late answer, for a cell let go of meanwhile or for an older seed (the
// grid's generation), is dropped. No three.js: the world builds what this
// says through `sink`.
//
//   createStream({ workers, seed, kind, radius, physicsRadius = 1, sink,
//     inFlight = 6, perFrame = 2 }) → { update(x, z, heading), reseed(seed,
//     kind), cell(cx, cz) → the cell or null, cells() → Map, stats(),
//     dispose() }
//   sink: { build(key, cell, mesh, step), remesh(key, mesh, step),
//     unbuild(key), solid(key, cell), unsolid(key) }

import { createChunkGrid } from '../../../runtime/chunkGrid.js';

export const WORKER = 'land';
export const CELL = 64;
const FINE = 2; // cells from the car's meshed at 1 m

const parse = (k) => k.split(',').map(Number);

export function createStream({ workers, seed, kind = 'temperate', radius = 4, physicsRadius = 1, sink, inFlight = 6, perFrame = 2 }) {
  const grid = createChunkGrid({ size: CELL, radius, inFlight, hysteresis: 1 });
  const built = new Map(); // key → { cx, cz, cell, step, solid, remeshing }
  const waiting = []; // answers accepted, not yet built: [key, msg]
  let gone = false;
  let asked = 0;
  let car = [0, 0];

  const cheb = (cx, cz) => Math.max(Math.abs(cx - car[0]), Math.abs(cz - car[1]));
  const stepFor = (cx, cz) => (cheb(cx, cz) <= FINE ? 1 : 2);

  function letGo(key) {
    const b = built.get(key);
    if (b) {
      if (b.solid) sink.unsolid(key);
      sink.unbuild(key);
      if (b.remeshing) workers.cancel(WORKER, b.remeshing);
      built.delete(key);
    }
    const w = waiting.findIndex((x) => x[0] === key);
    if (w >= 0) waiting.splice(w, 1);
  }

  function ask(key, gen) {
    const [cx, cz] = parse(key);
    grid.began(key, gen);
    const msg = { type: 'cell', key, seed, kind, cx, cz, step: stepFor(cx, cz), priority: cheb(cx, cz) };
    workers.request(WORKER, msg).then(
      (reply) => {
        if (gone) return;
        if (!reply) return grid.failed(key, gen);
        if (!grid.done(key, gen)) return;
        waiting.push([key, reply]);
      },
      () => !gone && grid.failed(key, gen),
    );
  }

  function remesh(key, b, step) {
    const id = `${key}:m${++asked}`;
    b.remeshing = id;
    b.want = step;
    workers.request(WORKER, { type: 'remesh', key: id, cx: b.cx, cz: b.cz, heights: b.cell.heights.slice(), step, priority: -1 }).then((reply) => {
      if (gone || built.get(key) !== b || b.remeshing !== id) return;
      b.remeshing = null;
      if (!reply) return;
      b.step = step;
      sink.remesh(key, reply.mesh, step);
    });
  }

  return {
    update(x, z, heading = null) {
      if (gone) return;
      car = grid.cellOf(x, z);
      const { ask: want, drop, cancel } = grid.update({ x, z, heading });
      for (const k of cancel) workers.cancel(WORKER, k);
      for (const k of drop) letGo(k);
      for (const k of want) ask(k, grid.gen);
      // (two a frame at most, nearest the car first)
      waiting.sort((a, b) => cheb(...parse(a[0])) - cheb(...parse(b[0])));
      for (let n = 0; n < perFrame && waiting.length; n++) {
        const [key, reply] = waiting.shift();
        if (!grid.loaded.has(key)) continue;
        const cell = { cx: reply.cx, cz: reply.cz, heights: reply.heights, water: reply.water, mask: reply.mask, props: reply.props };
        const b = { cx: reply.cx, cz: reply.cz, cell, step: reply.step, solid: false, remeshing: null, want: reply.step };
        built.set(key, b);
        sink.build(key, cell, reply.mesh, reply.step);
      }
      // the physics ring and the fine ring, round where the car is now
      for (const [key, b] of built) {
        const near = cheb(b.cx, b.cz) <= physicsRadius;
        if (near && !b.solid) {
          b.solid = true;
          sink.solid(key, b.cell);
        } else if (!near && b.solid) {
          b.solid = false;
          sink.unsolid(key);
        }
        const step = stepFor(b.cx, b.cz);
        if (step !== b.want) {
          if (b.remeshing) workers.cancel(WORKER, b.remeshing);
          remesh(key, b, step);
        }
      }
    },
    // a new world: everything let go of, and answers for the old dropped
    reseed(nextSeed, nextKind = kind) {
      seed = nextSeed;
      kind = nextKind;
      const { drop, cancel } = grid.reset();
      for (const k of cancel) workers.cancel(WORKER, k);
      for (const k of [...drop, ...built.keys()]) letGo(k);
      waiting.length = 0;
    },
    cell(cx, cz) {
      return built.get(`${cx},${cz}`)?.cell ?? null;
    },
    cells: () => built,
    stats: () => ({ built: built.size, waiting: waiting.length, flying: grid.flying.size, solid: [...built.values()].filter((b) => b.solid).length }),
    dispose() {
      if (gone) return;
      gone = true;
      for (const k of grid.flying.keys()) workers.cancel(WORKER, k);
      for (const k of [...built.keys()]) letGo(k);
      waiting.length = 0;
    },
  };
}
