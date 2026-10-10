// The fake Blender (BLENDER pointing here): what bake.mjs runs in place of
// a Cycles bake. It copies the raw model to the baked one, which is what a
// bake does to the pipeline's plumbing (a file in, a file out, a key kept),
// not to its pixels; the triangle count is kept, so a model over budget
// stays over budget for web.mjs to refuse.
//
//   node scripts/ai-e2e/fakes/blender.mjs --background --python bake.py -- RAW.glb OUT.glb [--faces N] [--tex N]

import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fail, failing, nap, record } from './common.mjs';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  record('blender', argv);
  nap(argv);
  if (failing(argv, 'bake')) fail('bake');
  const [raw, out] = argv.slice(argv.indexOf('--') + 1);
  copyFileSync(raw, out);
}
