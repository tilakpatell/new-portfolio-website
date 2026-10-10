// Where a heavy asset is fetched from. The static site carries every model
// and texture a world needs at a size a phone can take; the high-detail
// versions (the film-made Senate at full detail, the Jedi Temple's full
// mesh, 4K scans) live in the project's Supabase Storage instead, in a
// public bucket, so the site stays small and a strong machine still gets
// them. With no Supabase URL in the build (a fork, CI, a local run) there is
// no host, and everything is the site's own.
//
// Pure: the build's environment is passed in.
//
//   assetHost(env) → the bucket's public base URL, or null
//   sources(path, { host, hq }) → the URLs to try, best first: the host's
//     high-detail file (`hq`, a path in the bucket) where there is a host,
//     then the site's own `path`

export const BUCKET = 'assets';

export function assetHost(env = {}) {
  const url = env.VITE_SUPABASE_URL;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) return null;
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${env.VITE_ASSET_BUCKET || BUCKET}`;
}

export function sources(path, { host = null, hq = null } = {}) {
  const out = [];
  if (host && hq) out.push(`${host}/${hq.replace(/^\//, '')}`);
  out.push(path);
  return out;
}
