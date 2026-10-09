// The fake motion model (MOTION_ENGINE=fake): what scripts/motion/runner.mjs
// runs in place of HY-Motion in a contract test. It writes a BVH in
// generate.py's layout in well under a second: a made-up T-pose that lifts
// both arms overhead and brings them down, stepping the hips forward, over
// --seconds at 30 frames a second, so the bake and the retarget run for real.
//
//   node scripts/ai-e2e/fakes/motion.mjs PROMPT OUT.bvh [--seconds 3] [--seed N] [--fail-at generate] [--sleep S]
//
// common.mjs has the knobs (GEN3D_FAKE_LOG, GEN3D_FAKE_FAIL_AT, GEN3D_FAKE_SLEEP).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SMPLH_BODY, bvhText } from '../../motion/bvh-map.mjs';
import { failing, flag, nap, record } from './common.mjs';

const REST = [[0, 0.95, 0], [0.09, 0.86, 0], [-0.09, 0.86, 0], [0, 1.06, -0.01], [0.1, 0.48, 0], [-0.1, 0.48, 0], [0, 1.19, 0], [0.1, 0.08, -0.02], [-0.1, 0.08, -0.02], [0, 1.25, 0.01], [0.11, 0.02, 0.1], [-0.11, 0.02, 0.1], [0, 1.47, -0.01], [0.07, 1.39, 0], [-0.07, 1.39, 0], [0, 1.58, 0.03], [0.17, 1.42, -0.01], [-0.17, 1.42, -0.01], [0.43, 1.4, -0.03], [-0.43, 1.4, -0.03], [0.68, 1.41, -0.02], [-0.68, 1.41, -0.02]];

export function strike(seconds = 3, fps = 30) {
  const n = Math.max(2, Math.round(seconds * fps) + 1);
  const frames = [];
  const root = [];
  for (let f = 0; f < n; f++) {
    const s = Math.sin((Math.PI * f) / (n - 1)); // up and back down
    frames.push(SMPLH_BODY.map((name) => (name === 'L_Shoulder' ? [80 * s, 0, 0] : name === 'R_Shoulder' ? [-80 * s, 0, 0] : [0, 0, 0])));
    root.push([0, 0, (0.4 * f) / (n - 1)]);
  }
  return bvhText({ rest: REST, frames, root, fps });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  record('motion', argv);
  nap(argv);
  if (failing(argv, 'generate')) {
    console.error('fake motion: failing at generate, as asked');
    process.exit(1);
  }
  const [, out] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  writeFileSync(out, strike(Number(flag(argv, 'seconds') ?? 3)));
  console.log(`wrote ${out}`);
}
