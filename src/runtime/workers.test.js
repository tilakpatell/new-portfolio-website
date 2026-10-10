import { describe, expect, it } from 'vitest';
import { createWorkerPool, poolSize } from './workers';

const tick = async (n = 3) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

// workers that record what they're sent; the test answers for them
const fakes = () => {
  const made = [];
  const make = () => {
    const w = {
      posted: [],
      transfers: [],
      terminated: false,
      onmessage: null,
      onerror: null,
      postMessage(msg, transfer) {
        w.posted.push(msg);
        w.transfers.push(transfer);
      },
      terminate() {
        w.terminated = true;
      },
    };
    made.push(w);
    return w;
  };
  return { made, make };
};

const reply = (w, data) => w.onmessage({ data });

describe('createWorkerPool', () => {
  it('sends queued jobs lowest priority first, FIFO among equals', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool();
    pool.define('mc', make, { size: 1 });
    const first = pool.request('mc', { key: 'a', priority: 0 });
    pool.request('mc', { key: 'p5', priority: 5 });
    pool.request('mc', { key: 'p1', priority: 1 });
    pool.request('mc', { key: 'p3', priority: 3 });
    pool.request('mc', { key: 'p3b', priority: 3 });
    expect(made).toHaveLength(1);
    const w = made[0];
    expect(w.posted.map((m) => m.key)).toEqual(['a']);
    expect(pool.stats()).toEqual({ mc: { workers: 1, busy: 1, queued: 4 } });
    reply(w, { key: 'a', n: 1 });
    expect(await first).toEqual({ key: 'a', n: 1 });
    for (const k of ['p1', 'p3', 'p3b']) reply(w, { key: k });
    expect(w.posted.map((m) => m.key)).toEqual(['a', 'p1', 'p3', 'p3b', 'p5']);
  });

  it('a job cancelled before it is sent resolves null and is never posted', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make, size: 1 });
    pool.request('mc', { key: 'a' });
    const b = pool.request('mc', { key: 'b' });
    pool.cancel('mc', 'b');
    expect(await b).toBe(null);
    reply(made[0], { key: 'a' });
    expect(made[0].posted.map((m) => m.key)).toEqual(['a']);
    expect(pool.stats().mc.queued).toBe(0);
    pool.cancel('mc', 'nothing');
    pool.cancel('other', 'nothing');
  });

  it('cancelling a held job tells the worker, frees its slot and ignores the late answer', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make, size: 1 });
    const a = pool.request('mc', { key: 'a' });
    const b = pool.request('mc', { key: 'b' });
    pool.cancel('mc', 'a');
    expect(await a).toBe(null);
    const w = made[0];
    expect(w.posted).toEqual([{ key: 'a' }, { type: 'cancel', key: 'a' }, { key: 'b' }]);
    reply(w, { key: 'a', late: true });
    expect(pool.stats().mc.busy).toBe(1);
    reply(w, { key: 'b', ok: true });
    expect(await b).toEqual({ key: 'b', ok: true });
    expect(pool.stats().mc).toEqual({ workers: 1, busy: 0, queued: 0 });
  });

  it('shares work across workers up to the size cap, made lazily', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make, size: 2 });
    expect(made).toHaveLength(0);
    const a = pool.request('mc', { key: 'a' });
    const b = pool.request('mc', { key: 'b' });
    pool.request('mc', { key: 'c' });
    expect(made).toHaveLength(2);
    expect(made[0].posted.map((m) => m.key)).toEqual(['a']);
    expect(made[1].posted.map((m) => m.key)).toEqual(['b']);
    expect(pool.stats().mc).toEqual({ workers: 2, busy: 2, queued: 1 });
    reply(made[1], { key: 'b' });
    expect(await b).toEqual({ key: 'b' });
    expect(made[1].posted.map((m) => m.key)).toEqual(['b', 'c']);
    // an answer from the wrong worker doesn't settle the job
    reply(made[1], { key: 'a' });
    let settled = false;
    a.then(() => (settled = true));
    await tick();
    expect(settled).toBe(false);
    reply(made[0], { key: 'a' });
    expect(await a).toEqual({ key: 'a' });
  });

  it('asking again for the same key settles the first with null', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make, size: 1 });
    const a1 = pool.request('mc', { key: 'a', v: 1 });
    const q1 = pool.request('mc', { key: 'q', v: 1 });
    const q2 = pool.request('mc', { key: 'q', v: 2 });
    expect(await q1).toBe(null);
    expect(pool.stats().mc.queued).toBe(1);
    const a2 = pool.request('mc', { key: 'a', v: 2 });
    expect(await a1).toBe(null);
    const w = made[0];
    expect(w.posted).toEqual([{ key: 'a', v: 1 }, { type: 'cancel', key: 'a' }, { key: 'q', v: 2 }]);
    reply(w, { key: 'q', v: 2 });
    expect(await q2).toEqual({ key: 'q', v: 2 });
    reply(w, { key: 'a', v: 2 });
    expect(await a2).toEqual({ key: 'a', v: 2 });
  });

  it('passes the transfer list through to postMessage', () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make });
    const buf = new ArrayBuffer(8);
    pool.request('mc', { key: 'a' }, [buf]);
    pool.request('other', { key: 'b' });
    expect(made[0].transfers[0]).toEqual([buf]);
    expect(made[0].transfers[0][0]).toBe(buf);
    expect(made[1].transfers[0]).toEqual([]);
  });

  it('a worker error resolves its job null, drops it, and the next request makes a fresh one', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make, size: 1 });
    const a = pool.request('mc', { key: 'a' });
    made[0].onerror(new Error('boom'));
    expect(await a).toBe(null);
    expect(made[0].terminated).toBe(true);
    expect(pool.stats().mc).toEqual({ workers: 0, busy: 0, queued: 0 });
    const b = pool.request('mc', { key: 'b' });
    expect(made).toHaveLength(2);
    reply(made[1], { key: 'b' });
    expect(await b).toEqual({ key: 'b' });
  });

  it('a worker error with jobs queued makes a fresh worker for them', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make, size: 1 });
    pool.request('mc', { key: 'a' });
    pool.request('mc', { key: 'b' });
    made[0].onerror(new Error('boom'));
    expect(made).toHaveLength(2);
    expect(made[1].posted.map((m) => m.key)).toEqual(['b']);
  });

  it('close and dispose terminate workers and resolve what was pending with null', async () => {
    const { made, make } = fakes();
    const pool = createWorkerPool({ make, size: 1 });
    const a = pool.request('mc', { key: 'a' });
    const b = pool.request('mc', { key: 'b' });
    const c = pool.request('other', { key: 'c' });
    pool.close('mc');
    expect(await a).toBe(null);
    expect(await b).toBe(null);
    expect(made[0].terminated).toBe(true);
    expect(made[1].terminated).toBe(false);
    expect(pool.stats().mc).toBeUndefined();
    pool.request('mc', { key: 'd' });
    expect(made).toHaveLength(3);
    pool.dispose();
    expect(await c).toBe(null);
    expect(made[1].terminated).toBe(true);
    expect(made[2].terminated).toBe(true);
    expect(pool.stats()).toEqual({});
  });

  it('redefining a name changes the factory for workers made afterwards', () => {
    const one = fakes();
    const two = fakes();
    const pool = createWorkerPool({ size: 2 });
    pool.define('mc', one.make);
    pool.request('mc', { key: 'a' });
    pool.define('mc', two.make);
    pool.request('mc', { key: 'b' });
    expect(one.made).toHaveLength(1);
    expect(two.made).toHaveLength(1);
  });

  it('the pool-level factory is given the name', () => {
    const names = [];
    const { make } = fakes();
    const pool = createWorkerPool({ make: (name) => (names.push(name), make()) });
    pool.request('sky', { key: 'a' });
    expect(names).toEqual(['sky']);
  });

  it('a request for a name nobody defined rejects naming it', async () => {
    const pool = createWorkerPool();
    await expect(pool.request('nowhere', { key: 'a' })).rejects.toThrow(/nowhere/);
  });
});

describe('poolSize', () => {
  it('leaves a core for the page, one to four workers', () => {
    expect(poolSize(8)).toBe(4);
    expect(poolSize(2)).toBe(1);
    expect(poolSize(undefined)).toBe(1);
    expect(poolSize(4)).toBe(3);
  });
});
