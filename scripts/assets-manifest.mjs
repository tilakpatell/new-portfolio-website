// The asset manifest as the bundle sees it (vite.config.js): with
// VITE_ASSET_BASE set, src/data/assets-manifest.json less the entries whose
// file in public/ has changed since its upload (scripts/assets-upload.mjs's
// freshManifest), so a model edited and not uploaded again is fetched from
// the site, never stale from the bucket; without a base, empty, so a build
// that asks nothing remote carries none of it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST, freshManifest, manifestPath } from './assets-upload.mjs';

export default function assetManifest() {
  let file = null;
  let from = null;
  let publicDir = null;
  let base = '';
  return {
    name: 'asset-manifest',
    enforce: 'pre',
    configResolved(c) {
      file = join(c.root, MANIFEST);
      from = manifestPath(c.root);
      publicDir = c.publicDir;
      base = c.env?.VITE_ASSET_BASE ?? '';
    },
    // (JSON text, which Vite's own JSON plugin then makes a module of)
    load(id) {
      if (id.split('?')[0] !== file) return null;
      return base ? JSON.stringify(freshManifest(JSON.parse(readFileSync(from, 'utf8')), publicDir)) : '{}';
    },
  };
}
