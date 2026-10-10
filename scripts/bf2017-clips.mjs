// The 2017 game's clips, packed for the site: each of the game's clips on
// Walrus_HumanMale (one glTF a clip in the bucket, web/anims/walrus_humanmale/)
// that src/lib/three/walrusClips.js maps to a site name goes, under that
// name, into one of three packs written onto the game's skeleton file
// (public/models/galaxy/bf2017/walrus.glb, scripts/bf2017-skeleton.mjs):
// clips-core.glb, clips-sword.glb, clips-life.glb. The game's clips drive
// the game's people, as the game made them, on the bones it made them for:
// no retarget, no UAL or Meshy clip (the owner's rule). A track naming a
// bone the skeleton lacks is dropped and counted.
// (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 4)
//
//   node scripts/bf2017-clips.mjs --list ['<glob>']   the bucket's walrus clips
//     (web/anims.jsonl, fetched once), to fill walrusClips.js's GAME_CLIPS
//   node scripts/bf2017-clips.mjs [--skeleton <walrus.glb>] [--out public/models/galaxy/bf2017]
//
// The keys as the fetch's (scripts/bf2017-fetch.mjs). Prints each pack's
// clips and bytes; the three together stay under 1.5 MB.

import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CLIPS, SKELETON, planPacks } from '../src/lib/three/walrusClips.js';
import { parseArgs } from './lib/args.mjs';
import { localPath } from './lib/bf2017-paths.mjs';
import { walrusIo } from './bf2017-skeleton.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANIMS = 'web/anims.jsonl';
const WALRUS = 'public/models/galaxy/bf2017/walrus.glb';
const OUT = 'public/models/galaxy/bf2017';

// The walrus clips the bucket's list names, by their path under web/. The
// list's fields are read loosely (any string naming a clip under
// anims/walrus_humanmale/), so a change in its shape loses nothing.
export function walrusPaths(text, skeleton = SKELETON) {
  const re = new RegExp(`anims/${skeleton}/[^"\\\\]+?\\.glb`, 'gi');
  return [...new Set(text.match(re) ?? [])].map((p) => p.replace(/^.*?anims\//i, 'anims/'));
}

// Copy a clip document's first animation onto the skeleton document as
// `name`, its channels bound to the skeleton's nodes by name. Returns the
// tracks kept and dropped (a bone the skeleton lacks).
export function packClip(skel, clip, name) {
  const nodes = new Map(skel.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = skel.getRoot().listBuffers()[0] ?? skel.createBuffer();
  const src = clip.getRoot().listAnimations()[0];
  if (!src) return { kept: 0, dropped: 0 };
  const anim = skel.createAnimation(name);
  const copy = (a) => skel.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer);
  let kept = 0;
  let dropped = 0;
  for (const ch of src.listChannels()) {
    const target = nodes.get(ch.getTargetNode()?.getName());
    if (!target) {
      dropped++;
      continue;
    }
    const s = ch.getSampler();
    const sampler = skel.createAnimationSampler().setInput(copy(s.getInput())).setOutput(copy(s.getOutput())).setInterpolation(s.getInterpolation());
    anim.addSampler(sampler).addChannel(skel.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    kept++;
  }
  if (!kept) anim.dispose();
  return { kept, dropped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = join(ROOT, 'lab', 'assets', 'bf2017');
  const { keys, getObject } = await import('./bf2017-fetch.mjs');
  const env = keys();
  const list = await getObject(env, root, ANIMS);
  if (list.state === 'missing') throw new Error(`${ANIMS}: not in the bucket`);
  const paths = new Set(walrusPaths(await readFile(list.file, 'utf8')));
  if (args.list) {
    const re = typeof args.list === 'string' ? new RegExp(`^${args.list.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i') : null;
    for (const p of [...paths].sort()) {
      const name = p.split('/').pop().replace(/\.glb$/i, '');
      if (!re || re.test(name)) console.log(name);
    }
    return;
  }
  const plan = planPacks(GAME_CLIPS, (p) => paths.has(p));
  if (plan.absent.length) console.log(`not in the bucket: ${plan.absent.join(', ')}`);
  if (plan.missing.length) console.log(`no game clip mapped for: ${plan.missing.join(', ')}`);
  const io = await walrusIo();
  const skeleton = args.skeleton ?? WALRUS;
  if (!existsSync(skeleton)) throw new Error(`${skeleton}: make it first (scripts/bf2017-skeleton.mjs)`);
  let total = 0;
  for (const pack of ['core', 'sword', 'life']) {
    const doc = await io.read(skeleton);
    for (const { site, path } of plan[pack]) {
      const got = await getObject(env, root, `web/${path}`);
      if (got.state === 'missing') {
        console.log(`  ${site}: ${path} missing`);
        continue;
      }
      const r = packClip(doc, await io.read(localPath(root, `web/${path}`)), site);
      console.log(`  ${site} ← ${path}: ${r.kept} tracks${r.dropped ? `, ${r.dropped} on bones the skeleton lacks` : ''}`);
    }
    await doc.transform(prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    const out = join(args.out ?? OUT, `clips-${pack}.glb`);
    await io.write(out, doc);
    const bytes = (await stat(out)).size;
    total += bytes;
    console.log(`${out}: ${doc.getRoot().listAnimations().length} clips, ${(bytes / 1024).toFixed(0)} KB`);
  }
  console.log(`the three packs: ${(total / 1048576).toFixed(2)} MB (cap 1.5)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
