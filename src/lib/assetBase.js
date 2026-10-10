// Where a heavy asset is fetched from. scripts/assets-upload.mjs puts the
// big models and textures in a Supabase Storage bucket by content hash and
// writes src/data/assets-manifest.json; with VITE_ASSET_BASE set at build,
// a path the manifest names is asked of the bucket (its CDN, a year's cache),
// anything else of the site as before. The build keeps only the entries whose
// file on disk still has that hash (scripts/assets-manifest.mjs), so the bytes
// are the same either way and nothing drawn changes. The first remote failure
// (the bucket down, or blocked by a network or an extension) sends that load
// and every later one to the local file for the rest of the visit, so a
// visitor who can't reach the bucket sees the site as it was.
//
// assetUrl(path, { base, manifest }) → the URL to fetch
// withFallback(load, { base, manifest }) → (path) => load(remote), else load(path) once
// markDown(), isDown(), forgetDown() (a new visit; tests)

import MANIFEST from '../data/assets-manifest.json';
import { remotePath } from './assetPath';

let down = false;

export const markDown = () => {
  if (!down && import.meta.env?.DEV) console.warn('asset base unreachable: local files for this visit');
  down = true;
};
export const isDown = () => down;
export const forgetDown = () => {
  down = false;
};

export function assetUrl(path, { base = import.meta.env?.VITE_ASSET_BASE, manifest = MANIFEST } = {}) {
  return down ? path : remotePath(path, base, manifest);
}

export function withFallback(load, opts) {
  return (path) => {
    const url = assetUrl(path, opts);
    if (url === path) return load(path);
    return Promise.resolve()
      .then(() => load(url))
      .catch(() => {
        markDown();
        return load(path);
      });
  };
}
