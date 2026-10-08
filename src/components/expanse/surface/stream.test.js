import { describe, expect, it, vi } from 'vitest';
import { WORKER, createStream } from './stream';
import { landJob } from './job';

const flush = () => new Promise((r) => setTimeout(r, 0));

// a pool that answers at once from the real job (memoised: the cells are the same each test)
const memo = new Map();
function fakePool() {
  const asked = [];
  const cancelled = [];
  let hold = false;
  const held = [];
  return {
    asked,
    cancelled,
    hold(on) {
      hold = on;
    },
    release() {
      for (const r of held.splice(0)) r();
    },
    request(name, msg) {
      expect(name).toBe(WORKER);
      asked.push(msg);
      const id = `${msg.type}:${msg.seed}:${msg.kind}:${msg.cx},${msg.cz}:${msg.step}`;
      if (!memo.has(id) || msg.type === 'remesh') memo.set(id, landJob(msg).reply);
      const answer = { ...memo.get(id), key: msg.key };
      if (hold) return new Promise((r) => held.push(() => r(answer)));
      return Promise.resolve(answer);
    },
    cancel(name, key) {
      cancelled.push(key);
    },
  };
}
function fakeSink() {
  const s = { built: new Map(), solids: new Set(), calls: [] };
  return Object.assign(s, {
    build: (key, cell, mesh, step) => {
      s.built.set(key, step);
      s.calls.push(['build', key]);
    },
    remesh: (key, mesh, step) => {
      s.built.set(key, step);
      s.calls.push(['remesh', key, step]);
    },
    unbuild: (key) => {
      s.built.delete(key);
      s.calls.push(['unbuild', key]);
    },
    solid: (key) => {
      s.solids.add(key);
      s.calls.push(['solid', key]);
    },
    unsolid: (key) => {
      s.solids.delete(key);
      s.calls.push(['unsolid', key]);
    },
  });
}
async function settle(stream, x, z, n = 80) {
  for (let i = 0; i < n; i++) {
    stream.update(x, z, null);
    await flush();
  }
}
const ring = (cx, cz, r) => {
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) out.push(`${cx + dx},${cz + dz}`);
  return out.sort();
};

describe('createStream', () => {
  it('builds every cell the grid wants round the car, two a frame at most', async () => {
    const pool = fakePool();
    const sink = fakeSink();
    const stream = createStream({ workers: pool, seed: 7, kind: 'temperate', radius: 4, sink });
    stream.update(40, -20, null);
    await flush();
    stream.update(40, -20, null);
    expect(sink.calls.filter((c) => c[0] === 'build').length).toBeLessThanOrEqual(2);
    await settle(stream, 40, -20);
    expect([...sink.built.keys()].sort()).toEqual(ring(0, -1, 4));
    // (step 1 within two cells of the car, 2 beyond)
    expect(sink.built.get('0,-1')).toBe(1);
    expect(sink.built.get('2,1')).toBe(1);
    expect(sink.built.get('3,-1')).toBe(2);
    expect(stream.stats().built).toBe(81);
    stream.dispose();
  });

  it('makes the nine cells round the car solid, and only those', async () => {
    const pool = fakePool();
    const sink = fakeSink();
    const stream = createStream({ workers: pool, seed: 7, kind: 'temperate', radius: 2, sink });
    await settle(stream, 40, -20, 40);
    expect([...sink.solids].sort()).toEqual(ring(0, -1, 1));
    // moving a cell east: three cells leave the ring and three come into it
    sink.calls.length = 0;
    stream.update(40 + 64, -20, null);
    await flush();
    stream.update(40 + 64, -20, null);
    expect(sink.calls.filter((c) => c[0] === 'unsolid').map((c) => c[1]).sort()).toEqual(['-1,-2', '-1,-1', '-1,0'].sort());
    await settle(stream, 40 + 64, -20, 40);
    expect([...sink.solids].sort()).toEqual(ring(1, -1, 1));
    stream.dispose();
  });

  it('meshes a cell again, once, as it comes into the fine ring', async () => {
    const pool = fakePool();
    const sink = fakeSink();
    const stream = createStream({ workers: pool, seed: 7, kind: 'temperate', radius: 4, sink });
    await settle(stream, 40, -20);
    expect(sink.built.get('3,-1')).toBe(2);
    sink.calls.length = 0;
    await settle(stream, 40 + 64, -20, 20);
    const again = sink.calls.filter((c) => c[0] === 'remesh' && c[1] === '3,-1');
    expect(again).toEqual([['remesh', '3,-1', 1]]);
    expect(pool.asked.filter((m) => m.type === 'remesh' && m.cx === 3 && m.cz === -1)).toHaveLength(1);
    stream.dispose();
  });

  it('builds nothing that answers after it is gone', async () => {
    const pool = fakePool();
    pool.hold(true);
    const sink = fakeSink();
    const stream = createStream({ workers: pool, seed: 7, kind: 'temperate', radius: 2, sink });
    stream.update(0, 0, null);
    stream.dispose();
    pool.release();
    await flush();
    stream.update(0, 0, null);
    expect(sink.built.size).toBe(0);
  });

  it('drops a cell answered for an older seed', async () => {
    const pool = fakePool();
    pool.hold(true);
    const sink = fakeSink();
    const stream = createStream({ workers: pool, seed: 7, kind: 'temperate', radius: 1, sink });
    stream.update(0, 0, null);
    const first = pool.asked.length;
    stream.reseed(8, 'temperate');
    pool.release();
    await flush();
    stream.update(0, 0, null);
    await flush();
    stream.update(0, 0, null);
    expect(sink.built.size).toBe(0);
    pool.hold(false);
    pool.release();
    await settle(stream, 0, 0, 20);
    expect(sink.built.size).toBe(9);
    expect(pool.asked.slice(first).every((m) => m.seed === 8)).toBe(true);
    stream.dispose();
  });

  it('keeps each built cell for the world to read', async () => {
    const pool = fakePool();
    const sink = fakeSink();
    const stream = createStream({ workers: pool, seed: 7, kind: 'temperate', radius: 1, sink });
    await settle(stream, 0, 0, 20);
    const c = stream.cell(0, 0);
    expect(c.heights).toHaveLength(65 * 65);
    expect(stream.cell(50, 50)).toBeNull();
    stream.dispose();
  });
});

describe('landJob', () => {
  it('makes a cell and its mesh, everything transferable', () => {
    const { reply, transfer } = landJob({ type: 'cell', key: '0,0', seed: 7, kind: 'temperate', cx: 0, cz: 0, step: 2 });
    expect(reply.key).toBe('0,0');
    expect(reply.heights).toHaveLength(65 * 65);
    expect(reply.mesh.indices.length).toBe(32 * 32 * 6 + 4 * 32 * 6);
    expect(transfer).toContain(reply.heights.buffer);
    expect(transfer).toContain(reply.mesh.positions.buffer);
    const again = landJob({ type: 'remesh', key: 'x', heights: reply.heights, step: 1 });
    expect(again.reply.mesh.indices.length).toBe(64 * 64 * 6 + 4 * 64 * 6);
    expect(landJob({ type: 'cancel', key: 'x' })).toBeNull();
  });
});
void vi;
