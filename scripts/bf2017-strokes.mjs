// A hero's stroke table from Star Wars Battlefront II (2017)'s own clips
// (scripts/lib/bf2017-strokes.mjs measures; this fetches, reads and writes):
// src/data/bf2017/strokes/<hero>.json, which the site's combat rules turn
// into the hero's stance (src/components/galaxy/surface/stanceFromTable.js).
//
//   node --env-file=.env.local scripts/bf2017-strokes.mjs <hero> [--list]   (behind a proxy: NODE_USE_ENV_PROXY=1)
//   node scripts/bf2017-strokes.mjs <hero> --pack public/models/galaxy/bf2017/clips-<hero>.glb [--skeleton …/walrus.glb]
//
//   hero      luke, vader, obiwan, anakin, maul, dooku, yoda, grievous, palpatine
//   list      the hero's clips the bucket's manifest (web/anims.jsonl) lists, and nothing else
//   pack      measure a clip pack scripts/bf2017-clips.mjs made (the game's clips under the
//             site's names, the game's name in each one's extras, on the skeleton file), in
//             place of the bucket: for a session without the keys
//
// From the bucket it reads the manifest (fetched once into lab/assets/bf2017/,
// which git ignores), takes every A_<Hero>_* clip on the humanoid skeleton
// and the hero's idle, fetches each, and measures it on the skeleton the clip
// file carries. The keys: SUPABASE_URL and BF2017_KEY (or SUPA_KEY) from the
// environment, never printed. It prints the table's strikes, one a line.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { isSequel, readManifest } from './lib/bf2017-manifest.mjs';
import { inBucket, objectUrl } from './lib/bf2017-paths.mjs';
import { classify, clipOf, measure, rigOf, tableFor } from './lib/bf2017-strokes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const LAB = join(ROOT, 'lab', 'assets', 'bf2017');
const OUT = join(ROOT, 'src', 'data', 'bf2017', 'strokes');
// the hero as the site names it → as the game's clips do
export const PREFIX = {
  luke: 'Luke',
  vader: 'Vader',
  obiwan: 'ObiWan',
  anakin: 'Anakin',
  maul: 'Maul',
  dooku: 'Dooku',
  yoda: 'Yoda',
  grievous: 'Grievous',
  palpatine: 'Palpatine',
};
// the skeletons a hero's clips are measured on: the humanoid's, the
// cinematics' (the same rig at the same rest; it holds Luke's swing blocks
// and all six of his blocked reactions), and a hero's own where the game
// gives it one (Yoda's, Grievous's)
const SKELETONS = ['Walrus_HumanMale', 'Walrus_NIS_S0800_Skeleton'];
const OWN = { yoda: 'Yoda_01_Ske', grievous: 'GeneralGrievous_01_Ske' };
// (what a table keeps of a measure: the tip's path is for checking, not the site)
const KINDS = new Set(['strike', 'return', 'block', 'blocked', 'stagger', 'dodge', 'dash', 'jump', 'defeat', 'locomotion']);

async function io() {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
}

function keys() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) {
    console.error('Set SUPABASE_URL and BF2017_KEY (or SUPA_KEY) in the environment, or measure a pack with --pack.');
    process.exit(2);
  }
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

async function fetchTo(env, bucketPath) {
  const file = join(LAB, bucketPath);
  if (existsSync(file)) return file;
  const res = await fetch(objectUrl(env.base, BUCKET, bucketPath), {
    headers: env.headers,
  });
  if (!res.ok) return null;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// the hero's clips the manifest lists: its combat set, and its idle
export function heroClips(manifest, hero) {
  const p = PREFIX[hero];
  const re = new RegExp(`^(A_${p}_|L_${p}_Stand_Idle_01$)`);
  return [...manifest.values()].filter((e) => re.test(e.name) && !e.additive && !isSequel(e.name) && [...SKELETONS, OWN[hero]].includes((e.skeleton ?? '').split('/').pop()) && KINDS.has(classify(e.name).kind));
}

async function fromBucket(hero, { list }) {
  const env = keys();
  const mf = await fetchTo(env, 'web/anims.jsonl');
  if (!mf) throw new Error('web/anims.jsonl: not in the bucket');
  const entries = heroClips(readManifest(await readFile(mf, 'utf8')), hero);
  if (list) {
    for (const e of entries) console.log(`${e.name.padEnd(52)} ${classify(e.name).kind}`);
    return null;
  }
  const rw = await io();
  const clips = [];
  for (const e of entries) {
    const file = await fetchTo(env, inBucket(e.file));
    if (!file) {
      console.log(`missing: ${e.name}`);
      continue;
    }
    const doc = await rw.read(file);
    const anim = doc.getRoot().listAnimations()[0];
    if (!anim) continue;
    try {
      clips.push({ name: e.name, ...measured(clipOf(anim), rigOf(doc)) });
    } catch (err) {
      // (a skeleton without the game's weapon socket: nothing to time a blade by)
      console.log(`skipped: ${e.name} (${err.message})`);
    }
  }
  return clips;
}

async function fromPack(pack, skeleton) {
  const rw = await io();
  const rig = rigOf(await rw.read(skeleton));
  const doc = await rw.read(pack);
  const clips = [];
  for (const anim of doc.getRoot().listAnimations()) {
    const game = /: (.+)$/.exec(anim.getExtras()?.source ?? '')?.[1];
    if (!game || !KINDS.has(classify(game).kind)) continue;
    clips.push({
      name: game,
      site: anim.getName(),
      ...measured(clipOf(anim), rig),
    });
  }
  return clips;
}

// (the tip's path is for checking a window by hand, not for the site)
function measured(clip, rig) {
  const m = measure(clip, rig);
  delete m.tipPath;
  return m;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [hero] = args._;
  if (!PREFIX[hero]) {
    console.error(`usage: node scripts/bf2017-strokes.mjs <hero> [--list] [--pack <glb>] (heroes: ${Object.keys(PREFIX).join(', ')})`);
    process.exit(1);
  }
  const skeleton = resolve(String(args.skeleton ?? join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'walrus.glb')));
  const clips = args.pack ? await fromPack(resolve(String(args.pack)), skeleton) : await fromBucket(hero, { list: Boolean(args.list) });
  if (clips) {
    const table = tableFor(PREFIX[hero], clips);
    const file = join(OUT, `${hero}.json`);
    await mkdir(OUT, { recursive: true });
    await writeFile(file, `${JSON.stringify(table)}\n`);
    for (const s of table.strikes)
      console.log(
        `${s.name.padEnd(36)} ${String(s.duration).padStart(6)} s  contact ${JSON.stringify(s.contact).padEnd(15)} ${String(s.dir).padEnd(6)} back ${s.return ?? '(none)'} ${s.returnDuration ?? ''}`,
      );
    console.log(`blocks ${JSON.stringify(table.blocks)}\ndash ${table.dash?.name ?? '(none)'}  jump ${table.jump?.name ?? '(none)'}  defeat ${table.defeat}`);
    console.log(`${relative(ROOT, file)}: ${clips.length} clips measured`);
  }
}
