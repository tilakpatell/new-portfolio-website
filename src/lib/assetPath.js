// The asset base's rule, alone, so the build's scripts can use it without the
// bundled manifest (src/lib/assetBase.js passes it in): a path the manifest
// names goes to `<base>/<hash>/<path>`, anything else (a query, another
// origin, no base) is returned as it came.
//
// remotePath(path, base, manifest) → string

export function remotePath(path, base, manifest) {
  if (!base || typeof path !== 'string' || /^[a-z][a-z0-9+.-]*:|[?#]/i.test(path)) return path;
  const key = path.replace(/^\/+/, '');
  const hit = manifest?.[key];
  return hit ? `${base.replace(/\/+$/, '')}/${hit.hash}/${key}` : path;
}
