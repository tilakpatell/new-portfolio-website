// Minecraft's worker: chunks made and meshed off the main thread (the work
// itself is rules/jobs.js's core). One job a turn of the worker's loop, so a
// cancel sent while a queue is waiting gets in between jobs.

import { TEXTURES } from './rules/blocks.js';
import { makeCore } from './rules/jobs.js';

// the texture array's layers are TEXTURES' order (the atlas is built in it)
const core = makeCore({ textures: new Map(TEXTURES.map((t, i) => [t, i])) });
let pumping = false;

function pump() {
  const r = core.step();
  if (r) self.postMessage(r.msg, r.transfer);
  if (core.queued) setTimeout(pump, 0);
  else pumping = false;
}

self.onmessage = (e) => {
  core.handle(e.data);
  if (!pumping && core.queued) {
    pumping = true;
    setTimeout(pump, 0);
  }
};
