// What every fake shares: its knobs (GEN3D_FAKE_*), a log of how it was
// called (so a test can ask which pictures the engine saw, or how often the
// bake ran), and failing on cue (so a test can kill a run at a step and
// watch the next one resume there).
//
//   GEN3D_FAKE_LOG      a file each fake appends a line of JSON to: { tool, argv }
//   GEN3D_FAKE_FAIL_AT  generate | bake | picture: that fake exits 1
//   GEN3D_FAKE_SLEEP    seconds each fake waits first (for the timeout paths)
//   GEN3D_FAKE_TRIS     triangles the engine makes (else a 12-triangle box)

import { appendFileSync } from 'node:fs';

export function record(tool, argv) {
  if (process.env.GEN3D_FAKE_LOG) appendFileSync(process.env.GEN3D_FAKE_LOG, `${JSON.stringify({ tool, argv })}\n`);
}

// A fake's own flag, else its knob in the environment.
export const flag = (argv, name, env) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : env ? process.env[env] : undefined;
};

export function nap(argv) {
  const s = Number(flag(argv, 'sleep', 'GEN3D_FAKE_SLEEP') ?? 0);
  // a blocking wait: the fake is a whole process standing in for a slow engine
  if (s > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);
}

export const failing = (argv, step) => flag(argv, 'fail-at', 'GEN3D_FAKE_FAIL_AT') === step;

export function fail(step) {
  console.error(`fake ${step === 'generate' ? 'engine' : step}: failing at ${step}, as asked`);
  process.exit(1);
}
