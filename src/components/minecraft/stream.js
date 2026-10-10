// Minecraft, the chunks streamed in round the player, on the runtime's chunk
// services: its grid (runtime/chunkGrid.js) says which to ask for, nearest
// first and eight in flight at most, and which to let go of, more than two
// past the render distance; its worker pool (runtime/workers.js) has
// ./worker.js make and mesh them, with the player's edits in them
// (rules/jobs.js's protocol). What an edit changed is lit and meshed again
// first. A late answer, for a chunk let go of meanwhile or for an older
// world (a new seed: the grid's generation moved on), is dropped, never
// drawn. No three.js: the scene's chunks come in as { setMesh, drop }.
//
// createStream({ workers, chunks }) → { begin(g), load(), remesh(),
//   wanted() → keys, stats(), dispose() }

import { createChunkGrid } from '../../runtime/chunkGrid.js';
import { makeChunk, packEdits } from './rules/chunk.js';
import { addChunk, dropChunk } from './rules/game.js';
import { chunkKey } from './rules/jobs.js';

export const WORKER = 'minecraft';
const IN_FLIGHT = 8;
const KEEP = 2; // chunks past the render distance before one is let go of

const cell = (k) => k.split(',').map(Number);

export function createStream({ workers, chunks }) {
  const grid = createChunkGrid({ size: 16, radius: 10, inFlight: IN_FLIGHT, hysteresis: KEEP });
  const tickets = new Map(); // chunk key → this ask's number (a null answer for an older ask is not this one's)
  const remeshing = new Map(); // chunk key → sections asked to be meshed again
  let g = null;
  let gone = false;
  let asked = 0;

  // the player's edits to a chunk and its eight neighbours, for the worker to put in
  function editsAround(cx, cz) {
    const out = {};
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const k = chunkKey(cx + dx, cz + dz);
        const c = g.world.chunks.get(k);
        if (c?.edits.size) out[k] = packEdits(c);
        else if (g.edits[k]) out[k] = g.edits[k];
      }
    return out;
  }

  function cancel(k) {
    tickets.delete(k);
    workers.cancel(WORKER, k);
  }

  function load() {
    if (gone || !g) return;
    const p = g.player;
    const { ask, drop, cancel: stale } = grid.update({ x: p.x, z: p.z, radius: g.renderDistance });
    for (const k of stale) cancel(k);
    const game = g;
    const gen = grid.gen;
    const [pcx, pcz] = grid.cellOf(p.x, p.z);
    for (const k of ask) {
      const [cx, cz] = cell(k);
      const ticket = ++asked;
      tickets.set(k, ticket);
      grid.began(k, gen);
      const priority = (cx - pcx) ** 2 + (cz - pcz) ** 2;
      workers.request(WORKER, { type: 'chunk', key: k, seed: game.seed, cx, cz, priority, edits: editsAround(cx, cz) }).then((msg) => {
        if (gone) return;
        if (tickets.get(k) === ticket) tickets.delete(k);
        if (!msg) {
          grid.failed(k, gen);
          return;
        }
        if (g !== game || !grid.done(k, gen)) return;
        const c = makeChunk(cx, cz);
        c.ids = msg.ids;
        c.state = msg.state;
        c.light = msg.light;
        c.lit = true;
        c.generated = true;
        addChunk(g, c);
        for (let s = 0; s < 16; s++) chunks.setMesh(cx, cz, s, msg.meshes[s]);
        // the next one at once, not at the next frame (a slow or hidden page still fills in)
        load();
      });
    }
    for (const k of drop) {
      const [cx, cz] = cell(k);
      dropChunk(g, k);
      chunks.drop(cx, cz);
      if (remeshing.has(k)) {
        workers.cancel(WORKER, remeshing.get(k));
        remeshing.delete(k);
      }
    }
  }

  // What an edit changed, lit and meshed again first in the worker's queue: its
  // chunk and the eight round it, since light reaches 14 blocks. Each ask has its
  // own number, so an older answer still on its way can't land as the newer one.
  function remesh() {
    if (gone || !g) return;
    const want = new Set();
    for (const c of g.world.chunks.values()) {
      if (!c.dirty.size) continue;
      c.dirty.clear();
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (g.world.chunks.has(chunkKey(c.cx + dx, c.cz + dz))) want.add(chunkKey(c.cx + dx, c.cz + dz));
    }
    const game = g;
    for (const k of want) {
      const c = g.world.chunks.get(k);
      if (remeshing.has(k)) workers.cancel(WORKER, remeshing.get(k));
      const ask = `${k}:m${++asked}`;
      remeshing.set(k, ask);
      workers.request(WORKER, { type: 'chunk', key: ask, seed: game.seed, cx: c.cx, cz: c.cz, priority: -1, edits: editsAround(c.cx, c.cz) }).then((msg) => {
        if (gone || !msg || g !== game || g.world.chunks.get(k) !== c || remeshing.get(k) !== ask) return;
        remeshing.delete(k);
        c.light = msg.light;
        for (let s = 0; s < 16; s++) chunks.setMesh(c.cx, c.cz, s, msg.meshes[s]);
      });
    }
  }

  return {
    // a world (a new one, or the save's): everything asked for the last one is let go of
    begin(game) {
      const { cancel: flying } = grid.reset();
      for (const k of flying) cancel(k);
      for (const ask of remeshing.values()) workers.cancel(WORKER, ask);
      remeshing.clear();
      if (g) for (const c of g.world.chunks.values()) chunks.drop(c.cx, c.cz);
      g = game;
    },
    load,
    remesh,
    // the chunks the player's place wants, nearest first
    wanted: () => (g ? grid.cells(g.player.x, g.player.z, { radius: g.renderDistance }) : []),
    stats: () => ({ flying: grid.flying.size, remeshing: remeshing.size }),
    dispose() {
      gone = true;
      workers.close(WORKER);
    },
  };
}
