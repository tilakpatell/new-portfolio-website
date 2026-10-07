// The fake concept picture (GEN3D_PICTURE=fake): what picture.mjs runs in
// place of stable-diffusion.cpp. A grey box on white at the size the real
// one draws, with one pixel set by the seed, so several candidates differ
// and the judge's pick() has something to choose between.
//
//   node scripts/ai-e2e/fakes/picture.mjs OUT.png [--seed N] [--size 1024] [--fail-at picture]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fail, failing, flag, nap, record } from './common.mjs';
import { png } from './png.mjs';

export function concept(size, seed) {
  const lo = Math.round(size * 0.25);
  const hi = Math.round(size * 0.75);
  const mark = Math.abs(seed) % size;
  return png(size, size, (x, y) => {
    if (y === 0 && x === mark) return [255, 0, 0, 255];
    return x >= lo && x < hi && y >= lo && y < hi ? [128, 128, 128, 255] : [255, 255, 255, 255];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  record('picture', argv);
  nap(argv);
  if (failing(argv, 'picture')) fail('picture');
  writeFileSync(argv[0], concept(Number(flag(argv, 'size') ?? 1024), Number(flag(argv, 'seed') ?? 42)));
}
