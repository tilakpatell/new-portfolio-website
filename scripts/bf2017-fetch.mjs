// Fetches models from the Star Wars Battlefront II (2017) drop (the private
// bf2017-assets bucket on the owner's Supabase) into lab/assets/bf2017/,
// which git ignores: nothing fetched is committed as it comes; it goes
// through scripts/bf2017-import.mjs first. A model is asked for by its
// manifest name; the fetch takes its LOD files, the textures its GLBs name
// (read from each GLB's image URIs, since they point outside the file), any
// parts beside it and its collision mesh, and keeps the bucket's layout on
// disk so the GLBs' relative URIs still resolve.
//
//   node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
//   node --env-file=.env.local scripts/bf2017-fetch.mjs <name> [--lod all|<n>[,<n>…]] [--parts '<glob>,…'] [--no-textures] [--collision]
//   node --env-file=.env.local scripts/bf2017-fetch.mjs --list '<glob over name>'
//
//   manifest     web/models.jsonl (about 25 MB), which every other command reads
//   name         a model's `name` in the manifest (characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh)
//   lod          which LODs (all by default)
//   parts        globs over the model's folder for the parts that go with it ('*_cape_mesh,*_hands_mesh'),
//                or full manifest names (a hero's head under characters/heads/)
//   no-textures  the GLBs only
//   collision    its collision GLB as well
//   list         the names under a glob, with their LOD triangles
//
// The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY, the same key under the
// name the cloud sessions hold it by) from the environment, never printed.
// A texture none of whose sources the bucket holds yet is `missing`, not an
// error: the upload is still running, and the import says what it lacks.

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { partsOf, readManifest } from './lib/bf2017-manifest.mjs';
import { imageUris, inBucket, localPath, objectUrl, textureSources } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const MANIFEST = 'web/models.jsonl';
const WAITS = [1000, 2000, 4000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function keys() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) {
    console.error('Set SUPABASE_URL and BF2017_KEY in .env.local and run with node --env-file=.env.local.');
    process.exit(2);
  }
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

// One request, retried on a network fault or a server error; a 4xx is an
// answer (Supabase says 400 for an object it hasn't got), not a fault.
async function ask(url, init) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500) return res;
      if (i >= WAITS.length) return res;
    } catch (e) {
      if (i >= WAITS.length) throw e;
    }
    await sleep(WAITS[i]);
  }
}

// One object to disk: `kept` when the file there is the size the bucket says,
// `missing` when the bucket hasn't it.
export async function getObject(env, root, bucketPath) {
  const url = objectUrl(env.base, BUCKET, bucketPath);
  const file = localPath(root, bucketPath);
  if (existsSync(file)) {
    const head = await ask(url, { method: 'HEAD', headers: env.headers });
    const size = (await stat(file)).size;
    if (head.ok && Number(head.headers.get('content-length')) === size) return { file, bytes: size, state: 'kept' };
    if (!head.ok) return { file, bytes: 0, state: 'missing' };
  }
  const res = await ask(url, { headers: env.headers });
  if (!res.ok) return { file, bytes: 0, state: 'missing' };
  const body = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
  return { file, bytes: body.length, state: 'fetched' };
}

const say = (r) => console.log(`${relative(ROOT, r.file).padEnd(110)} ${String(r.bytes).padStart(10)}  ${r.state}`);

async function loadManifest(root) {
  const file = localPath(root, MANIFEST);
  if (!existsSync(file)) {
    console.error(`No manifest at ${relative(ROOT, file)}: run node --env-file=.env.local scripts/bf2017-fetch.mjs manifest first.`);
    process.exit(2);
  }
  return readManifest(await readFile(file, 'utf8'));
}

// A texture by its sources, best first: the first the bucket holds.
async function getTexture(env, root, bucketPath) {
  let last = null;
  for (const src of textureSources(bucketPath)) {
    last = await getObject(env, root, src);
    if (last.state !== 'missing') return last;
  }
  return { file: localPath(root, bucketPath), bytes: 0, state: 'missing' };
}

export async function fetchModel(env, root, manifest, name, { lod = 'all', parts = null, textures = true, collision = false } = {}) {
  const entry = manifest.get(name);
  if (!entry) throw new Error(`${name}: not in the manifest (try --list)`);
  const want = lod === 'all' ? null : new Set(String(lod).split(',').map(Number));
  const entries = [entry, ...(parts ? partsOf(manifest, name, parts.split(',')) : [])];
  const results = [];
  const seen = new Set();
  for (const e of entries) {
    for (const l of e.lods) {
      if (want && !want.has(l.lod)) continue;
      const r = await getObject(env, root, inBucket(l.file));
      say(r);
      results.push(r);
      if (!textures || r.state === 'missing') continue;
      for (const uri of imageUris(await readFile(r.file), inBucket(l.file))) {
        if (seen.has(uri)) continue;
        seen.add(uri);
        const t = await getTexture(env, root, uri);
        say(t);
        results.push(t);
      }
    }
    if (collision && e.collision?.file) {
      const r = await getObject(env, root, inBucket(e.collision.file));
      say(r);
      results.push(r);
    }
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = join(ROOT, 'lab', 'assets', 'bf2017');
  const [what] = args._;
  if (args.list) {
    const manifest = await loadManifest(root);
    const re = new RegExp(`^${String(args.list).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    for (const [name, e] of manifest) if (re.test(name)) console.log(`${name}  ${e.lods.map((l) => l.triangles).join(' · ')}`);
  } else if (what === 'manifest') {
    say(await getObject(keys(), root, MANIFEST));
  } else if (what) {
    const env = keys();
    const manifest = await loadManifest(root);
    // (`--no-textures` reads as noTextures)
    await fetchModel(env, root, manifest, what, { lod: args.lod ?? 'all', parts: typeof args.parts === 'string' ? args.parts : null, textures: !args.noTextures, collision: Boolean(args.collision) }).catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
  } else {
    console.error("usage: node --env-file=.env.local scripts/bf2017-fetch.mjs manifest | <name> [--lod all|0,2] [--parts '<glob>,…'] [--no-textures] [--collision] | --list '<glob>'");
    process.exit(1);
  }
}
