// The Expanse surface's worker: the runtime's pool (runtime/workers.js)
// hands it a cell to make or a mesh to make again (./job.js), and it hands
// the answer back with every buffer transferred.

import { landJob } from './job.js';

self.onmessage = (e) => {
  const out = landJob(e.data);
  if (out) self.postMessage(out.reply, out.transfer);
};
