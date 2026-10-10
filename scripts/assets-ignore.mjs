// .gitignore's block of published files, in step with the manifest: one line
// a path src/data/galaxyAssets.json names, between
// `# galaxy assets (published; scripts/assets-publish.mjs)` and
// `# end galaxy assets`, and nothing outside the markers touched. The publish
// runs it last; run it alone after editing the manifest by hand (don't).
//
//   node scripts/assets-ignore.mjs

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST, ignoreBlock, readManifest } from './lib/asset-manifest.mjs';

export function ignoreFile(root) {
  const file = join(root, '.gitignore');
  const before = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const after = ignoreBlock(before, Object.keys(readManifest(join(root, MANIFEST))));
  if (after !== before) writeFileSync(file, after);
  return after !== before;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  console.log(ignoreFile(root) ? 'rewrote .gitignore’s galaxy assets block' : '.gitignore already in step');
}
