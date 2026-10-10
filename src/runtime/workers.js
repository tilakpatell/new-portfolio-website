// The page's workers, pooled by name: each name has a factory and a cap, a
// queue of jobs lowest priority first (first come first among equals), and
// up to that many workers, made when there's work and none free. A worker
// holds one job at a time, so a cancel or a nearer job never waits behind a
// long queue inside it. Asking again for a key settles the first ask with
// null; so does cancelling, closing, or the worker failing. The core is
// pure: the factories are passed in (`new Worker(...)` lives with them).
//
// Messages, page to worker:
//   { key, priority?, ... } (the job, as given to request, with its transfer list)
//   { type: 'cancel', key } (the job was cancelled or asked again while held)
// and back:
//   { key, ... } (the answer; the request's promise resolves with it)
//
// createWorkerPool({ make, size }) → { define(name, make, { size }),
//   request(name, msg, transfer), cancel(name, key), close(name), stats(),
//   dispose() }

export const poolSize = (cores) => Math.min(4, Math.max(1, (cores || 2) - 1));

export function createWorkerPool({ make = null, size = 1 } = {}) {
  const defs = new Map(); // name → { make, size }
  const groups = new Map(); // name → { workers: [{ worker, job }], queue: [job] }

  const group = (name) => {
    if (!groups.has(name)) groups.set(name, { workers: [], queue: [] });
    return groups.get(name);
  };
  const factory = (name) => defs.get(name)?.make ?? (make ? () => make(name) : null);
  const cap = (name) => defs.get(name)?.size ?? size;

  // `key`'s job settled null: taken from the queue, or its worker told and freed
  const drop = (g, key) => {
    const qi = g.queue.findIndex((j) => j.msg.key === key);
    if (qi >= 0) {
      g.queue.splice(qi, 1)[0].resolve(null);
      return true;
    }
    const slot = g.workers.find((s) => s.job?.msg.key === key);
    if (!slot) return false;
    const { job } = slot;
    slot.job = null;
    slot.worker.postMessage({ type: 'cancel', key });
    job.resolve(null);
    return true;
  };

  function spawn(name, g) {
    const slot = { worker: factory(name)(), job: null };
    slot.worker.onmessage = (e) => {
      const data = e?.data;
      if (!slot.job || data?.key !== slot.job.msg.key) return;
      const { job } = slot;
      slot.job = null;
      job.resolve(data);
      pump(name);
    };
    slot.worker.onerror = () => {
      const i = g.workers.indexOf(slot);
      if (i < 0) return;
      g.workers.splice(i, 1);
      const { job } = slot;
      slot.job = null;
      slot.worker.terminate();
      job?.resolve(null);
      pump(name);
    };
    g.workers.push(slot);
    return slot;
  }

  function pump(name) {
    const g = groups.get(name);
    if (!g) return;
    while (g.queue.length) {
      let slot = g.workers.find((s) => !s.job);
      if (!slot) {
        if (g.workers.length >= cap(name)) return;
        slot = spawn(name, g);
      }
      const job = g.queue.shift();
      slot.job = job;
      slot.worker.postMessage(job.msg, job.transfer ?? []);
    }
  }

  function close(name) {
    const g = groups.get(name);
    if (!g) return;
    groups.delete(name);
    for (const slot of g.workers) {
      slot.worker.terminate();
      slot.job?.resolve(null);
      slot.job = null;
    }
    for (const job of g.queue) job.resolve(null);
  }

  return {
    define(name, makeWorker, { size: own } = {}) {
      defs.set(name, { make: makeWorker, size: own });
    },
    request(name, msg, transfer) {
      if (!factory(name)) return Promise.reject(new Error(`no worker defined for ${name}`));
      const g = group(name);
      drop(g, msg.key);
      const priority = msg.priority ?? 0;
      const p = new Promise((resolve) => {
        const job = { msg, transfer, priority, resolve };
        const at = g.queue.findIndex((j) => j.priority > priority);
        if (at < 0) g.queue.push(job);
        else g.queue.splice(at, 0, job);
      });
      pump(name);
      return p;
    },
    cancel(name, key) {
      const g = groups.get(name);
      if (g && drop(g, key)) pump(name);
    },
    close,
    stats() {
      const out = {};
      for (const [name, g] of groups)
        out[name] = { workers: g.workers.length, busy: g.workers.filter((s) => s.job).length, queued: g.queue.length };
      return out;
    },
    dispose() {
      for (const name of [...groups.keys()]) close(name);
    },
  };
}
