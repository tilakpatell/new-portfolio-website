// One file from the 2017 drop's private bucket into lab/assets/bf2017/ (git-
// ignored), in the bucket's own layout, for the scripts that want a file by
// its path rather than a model by its manifest name (bf2017-fetch.mjs does
// those): the levels' probes, the role textures. The keys from the
// environment (SUPABASE_URL, BF2017_KEY or SUPA_KEY), never printed; a file
// already on disk is not fetched again.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { localPath, objectUrl } from './bf2017-paths.mjs';

export async function bucketFile(root, bucketPath) {
  const file = localPath(root, bucketPath);
  if (existsSync(file)) return file;
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) throw new Error(`Set SUPABASE_URL and BF2017_KEY (or SUPA_KEY) to fetch ${bucketPath}.`);
  const res = await fetch(objectUrl(base, 'bf2017-assets', bucketPath), { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${bucketPath}: missing from the bucket (${res.status})`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
