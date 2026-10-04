// Makes Portal panic's cast, enemies and set pieces with Meshy (meshy.ai),
// the site owner's account: a concept image for each, then a textured model
// from the image, then (for the ones that walk on two legs) a skeleton with
// walking and running clips. Output is compressed for the web into
// public/games/meshy/ and credited in public/games/credits.json. The output
// is committed, so the site never calls Meshy.
//
//   node --env-file=.env.local scripts/meshy.mjs [--set hq] <step> [name …]
//
// Two sets: Portal panic's cast (the default), and the Avengers HQ games'
// models (--set hq: Smash Run's Hulk, Chitauri, cars, chariot and wall
// pylon, and Thanos for Titan, photoreal, into public/hq/meshy/ with a manifest the games read).
//
// Steps, in order: images (9 credits each), models (30), rig (5), anim (an
// idle clip, 3), fetch (free: download and compress). Each task's id is kept in
// scripts/meshy-tasks.json, so running a step again never pays twice; delete
// a name's entry there to make it again. MESHY_API_KEY comes from .env.local
// (git ignores it); it is never printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// where a set's models, concept images (for looking at, not shipped) and task
// ids go; chosen in main()
let OUT = join(ROOT, 'public', 'games', 'meshy');
let REVIEW = join(ROOT, 'lab', 'meshy');
let TASKS = join(ROOT, 'scripts', 'meshy-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const STYLE = 'Drawn in the 2D cartoon style of the animated TV show Rick and Morty: flat cel colours, clean thick black outlines, simple rounded shapes. Plain white background, no text, no shadow.';
const BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const PROP = 'The whole object, three-quarter front view, centred.';

// rig: a two-legged character to give a skeleton and walk/run clips
// height: metres, for the rig; poly: target faces; tex: texture size in the game
export const ASSETS = {
  // the heroes
  rick: { rig: true, height: 1.8, poly: 14000, tex: 1024, prompt: `Rick Sanchez from Rick and Morty: a tall thin old scientist with spiky pale blue-grey hair, a unibrow, a long white lab coat open over a light blue shirt, brown trousers and brown shoes. ${BODY}` },
  morty: { rig: true, height: 1.5, poly: 14000, tex: 1024, prompt: `Morty Smith from Rick and Morty: a nervous 14-year-old boy with short brown hair and a round head, in a yellow T-shirt, blue jeans and white sneakers. ${BODY}` },
  pickle: { rig: false, poly: 9000, tex: 1024, prompt: `Pickle Rick from Rick and Morty: a green pickle standing upright with Rick's face on it (a unibrow, wide eyes, a big grin). ${PROP}` },
  // the enemies
  meeseeks: { rig: true, height: 1.9, poly: 8000, tex: 512, prompt: `Mr. Meeseeks from Rick and Morty: a tall thin pale blue creature with a big round head, a wide happy open-mouthed smile and long thin arms, wearing nothing. ${BODY}` },
  gromflomite: { rig: true, height: 1.9, poly: 8000, tex: 512, prompt: `A Gromflomite soldier of the Galactic Federation from Rick and Morty: an insect man with a big grey-green fly head and red compound eyes, in a dark grey military uniform with a belt. ${BODY}` },
  cronenberg: { rig: false, poly: 9000, tex: 512, prompt: `A Cronenberg monster from Rick and Morty: a mutated pink fleshy creature, a lumpy body with several mismatched eyes, a wide toothy mouth and stubby tentacle legs. ${PROP}` },
  gazorpian: { rig: true, height: 2.4, poly: 9000, tex: 512, prompt: `A male Gazorpian from Rick and Morty: a hulking orange-brown brute with a huge hunched muscular body, long heavy arms, a small head with a big mouth of teeth and tiny eyes. ${BODY}` },
  cop: { rig: true, height: 1.8, poly: 8000, tex: 512, prompt: `A Cop Rick from the Citadel of Ricks in Rick and Morty: Rick Sanchez with spiky pale blue-grey hair and a unibrow, in a navy blue police uniform with a police cap and a badge. ${BODY}` },
  // the bosses
  snowball: { rig: false, poly: 14000, tex: 1024, prompt: `Snowball from Rick and Morty: a small white fluffy dog standing upright on two legs inside a sleek white and grey mechanical exoskeleton suit, a glowing translucent helmet over its head. ${PROP}` },
  cromulon: { rig: false, poly: 12000, tex: 1024, prompt: `The Cromulon from Rick and Morty: a giant floating disembodied head, bald and pinkish beige, with big round staring eyes and huge lips, no body. ${PROP}` },
  evilmorty: { rig: true, height: 1.5, poly: 14000, tex: 1024, prompt: `Evil Morty from Rick and Morty: Morty Smith with a black eyepatch over his right eye and a cold confident look, short brown hair, a yellow T-shirt, blue jeans and white sneakers. ${BODY}` },
  // set pieces
  cruiser: { rig: false, poly: 12000, tex: 1024, prompt: `Rick's space cruiser from Rick and Morty: a small grey flying car shaped like a flattened saucer with an open cockpit, a clear bubble windscreen, two seats and a green glowing energy core at the back. ${PROP}` },
  garage: { rig: false, poly: 10000, tex: 1024, prompt: `The Smith family's garage from Rick and Morty: a small detached suburban garage with pale grey wooden siding, a big white roll-up door, a grey shingled roof and a side door. ${PROP}` },
};

// The Avengers HQ games' models: photoreal, like the rest of the HQ. Hulk and
// the Chitauri are described rather than named (Meshy turns down named
// characters).
const HQ_STYLE = 'Photorealistic, like a still from a big-budget live-action film: physically accurate materials and natural light. Plain white background, no text.';
const HQ_BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const HQ_PROP = 'The whole object on its own, three-quarter front view, centred.';
// h: how tall (or long, for a car) the game draws it, in metres
export const HQ_ASSETS = {
  hulk: { rig: true, height: 2.6, h: 2.6, poly: 20000, tex: 1024, prompt: `A towering green-skinned giant of a man, about eight and a half feet tall and impossibly muscular: huge shoulders and trapezius rising to his ears, thick arms ending in big fists, a broad deep chest, a short thick neck, a small head with short messy black hair, a heavy brow and an angry scowl. Torn, ragged dark purple trousers cut off below the knee, bare feet, nothing else. ${HQ_BODY}` },
  chitauri: { rig: true, height: 1.95, h: 1.95, poly: 12000, tex: 1024, prompt: `An alien foot soldier of a warlike invading army: grey, wrinkled, leathery skin fused with segmented dark bronze and gunmetal biomechanical armour plates, a narrow armoured head with a jutting jaw and small pale glowing blue eyes, long thin limbs, clawed hands, armoured feet. No weapon. ${HQ_BODY}` },
  taxi: { h: 5.2, poly: 12000, tex: 1024, prompt: `A New York City yellow taxi cab from 2012: a full-size four-door American sedan in taxi yellow with a lit roof sign, dusty and dented after a battle in the street. ${HQ_PROP}` },
  police: { h: 5.2, poly: 12000, tex: 1024, prompt: `A New York police patrol car from 2012: a full-size four-door American sedan, white with blue stripes down the sides and a red and blue lightbar on the roof, dusty and dented. ${HQ_PROP}` },
  sedan: { h: 4.9, poly: 12000, tex: 1024, prompt: `An ordinary dark red four-door American sedan from around 2010, dusty, its windscreen cracked and a door dented. ${HQ_PROP}` },
  suv: { h: 5.1, poly: 12000, tex: 1024, prompt: `A black full-size American SUV from around 2010, dusty, the bonnet dented and a side window shattered. ${HQ_PROP}` },
  chariot: { h: 5.5, poly: 12000, tex: 1024, prompt: `An alien flying war sled: a long narrow armoured hovercraft of segmented dark bronze and gunmetal biomechanical plates, a pointed prow, a small open standing deck with a handrail at the back, two glowing blue jet engines under its tail. No rider. ${HQ_PROP}` },
  // Titan: the warlord himself (the gauntlet stays modelled in code: its sockets are the game's)
  thanos: { rig: true, height: 2.8, h: 2.8, poly: 24000, tex: 2048, prompt: `A towering, massively built alien warlord about nine feet tall, with wrinkled purple-grey skin, a bald head, a heavy brow and a broad chin deeply ridged with vertical grooves, small hard eyes; a dark navy sleeveless armoured tunic with gold shoulder plates, a gold harness crossing his chest and back, and a broad gold belt; bare, heavily muscled purple arms; dark trousers and armoured boots. ${HQ_BODY}` },
  pylon: { h: 4.4, poly: 8000, tex: 512, prompt: `A tall alien biomechanical energy pylon, about four metres high: a tapering column of segmented dark bronze and gunmetal armour plates with fins up its back, clawed feet at its base, and a glowing violet crystal at its top. ${HQ_PROP}` },
};

const SETS = {
  portal: { assets: ASSETS, style: STYLE, out: ['public', 'games', 'meshy'], review: ['lab', 'meshy'], tasks: 'meshy-tasks.json', credits: ['public', 'games', 'credits.json'], prefix: 'meshy/', pbr: false },
  hq: { assets: HQ_ASSETS, style: HQ_STYLE, out: ['public', 'hq', 'meshy'], review: ['lab', 'meshy-hq'], tasks: 'meshy-hq-tasks.json', credits: ['public', 'hq', 'meshy', 'credits.json'], prefix: '', pbr: true, manifest: true },
};
let SET = SETS.portal;

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// wait for a task to finish; returns the task
async function wait(path, id, label) {
  for (let i = 0; ; i++) {
    const t = await api('GET', `${path}/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') throw new Error(`${label}: ${t.status} ${t.task_error?.message ?? ''}`);
    if (i % 6 === 0) console.log(`  ${label}: ${t.status} ${t.progress ?? 0}%`);
    await sleep(5000);
  }
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}

const load = async () => (existsSync(TASKS) ? JSON.parse(await readFile(TASKS, 'utf8')) : {});
const save = (s) => writeFile(TASKS, `${JSON.stringify(s, null, 2)}\n`);

// run one step for several names at a time (Meshy queues only so many tasks)
async function each(names, fn, at = 4) {
  const queue = [...names];
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) await fn(n).catch((e) => console.error(`! ${n}: ${e.message}`));
  };
  await Promise.all(Array.from({ length: at }, worker));
}

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed.
// A clip keeps only its skeleton and animation.
let io = null;
async function squeeze(from, to, { tex = 0, clip = false } = {}) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  const root = doc.getRoot();
  if (clip) {
    for (const node of root.listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const m of root.listMeshes()) m.dispose();
    for (const m of root.listMaterials()) m.dispose();
    for (const t of root.listTextures()) t.dispose();
  }
  await doc.transform(dedup(), prune(), resample(), ...(tex ? [textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] })] : []), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(to, doc);
}

const steps = {
  async images(names, s) {
    await each(names, async (n) => {
      const a = SET.assets[n];
      s[n] ??= {};
      if (!s[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${a.prompt} ${SET.style}`, ...(a.rig ? { pose_mode: 'a-pose' } : {}) });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(12)} ${t.consumed_credits} credits`);
    });
  },
  async models(names, s) {
    await each(names, async (n) => {
      const a = SET.assets[n];
      if (!s[n]?.image) throw new Error('no image yet');
      if (!s[n].model) {
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: SET.pbr,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: a.poly,
          texture_resolution: '2k',
          ...(a.rig ? { pose_mode: 'a-pose' } : {}),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(12)} ${t.consumed_credits} credits`);
    });
  },
  async rig(names, s) {
    await each(
      names.filter((n) => SET.assets[n].rig),
      async (n) => {
        if (!s[n]?.model) throw new Error('no model yet');
        if (!s[n].rig) {
          const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: SET.assets[n].height });
          s[n].rig = result;
          await save(s);
        }
        const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
        console.log(`rig      ${n.padEnd(12)} ${t.consumed_credits} credits`);
      },
    );
  },
  // an idle clip (Meshy's animation library, action 0), on the bare skeleton
  async anim(names, s) {
    await each(
      names.filter((n) => SET.assets[n].rig),
      async (n) => {
        if (!s[n]?.rig) throw new Error('not rigged yet');
        if (!s[n].idle) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: s[n].rig, action_id: 0, post_process: { operation_type: 'extract_armature' } });
          s[n].idle = result;
          await save(s);
        }
        const t = await wait('/v1/animations', s[n].idle, `${n} idle`);
        console.log(`anim     ${n.padEnd(12)} ${t.consumed_credits} credits ${JSON.stringify(Object.keys(t.result ?? {}))}`);
      },
    );
  },
  async fetch(names, s) {
    await mkdir(OUT, { recursive: true });
    const tmp = join(REVIEW, 'raw');
    await mkdir(tmp, { recursive: true });
    const creditsFile = join(ROOT, ...SET.credits);
    const credits = existsSync(creditsFile) ? JSON.parse(await readFile(creditsFile, 'utf8')) : {};
    const manifestFile = join(OUT, 'manifest.json');
    const manifest = SET.manifest && existsSync(manifestFile) ? JSON.parse(await readFile(manifestFile, 'utf8')) : {};
    for (const n of names) {
      const a = SET.assets[n];
      const files = []; // [url, file, texture size, clip only]
      if (a.rig) {
        if (!s[n]?.rig || !s[n]?.idle) throw new Error(`${n}: rig and anim first`);
        const r = (await api('GET', `/v1/rigging/${s[n].rig}`)).result;
        const idle = (await api('GET', `/v1/animations/${s[n].idle}`)).result;
        files.push([r.rigged_character_glb_url, `${n}.glb`, a.tex, false]);
        // the clips on their own: the game plays them on the character
        files.push([r.basic_animations.walking_armature_glb_url, `${n}-walk.glb`, 0, true]);
        files.push([r.basic_animations.running_armature_glb_url, `${n}-run.glb`, 0, true]);
        files.push([idle.animation_glb_url, `${n}-idle.glb`, 0, true]);
      } else {
        if (!s[n]?.model) throw new Error(`${n}: no model yet`);
        const t = await api('GET', `/v1/image-to-3d/${s[n].model}`);
        files.push([t.model_urls.glb, `${n}.glb`, a.tex, false]);
      }
      for (const [url, file, tex, clip] of files) {
        const raw = join(tmp, file);
        await download(url, raw);
        await squeeze(raw, join(OUT, file), { tex, clip });
      }
      if (SET.manifest) manifest[n] = { rig: !!a.rig, h: a.h };
      credits[`${SET.prefix}${n}`] = { source: 'https://www.meshy.ai', id: s[n].model, name: `${n}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(12)} ${files.map((f) => f[1]).join(', ')}`);
    }
    await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    if (SET.manifest) await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    await rm(tmp, { recursive: true, force: true });
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const args = process.argv.slice(2);
  const at = args.indexOf('--set');
  if (at >= 0) {
    SET = SETS[args[at + 1]];
    if (!SET) throw new Error(`--set: ${Object.keys(SETS).join(' | ')}`);
    args.splice(at, 2);
  }
  OUT = join(ROOT, ...SET.out);
  REVIEW = join(ROOT, ...SET.review);
  TASKS = join(ROOT, 'scripts', SET.tasks);
  const [step, ...only] = args;
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(SET.assets);
  for (const n of names) if (!SET.assets[n]) throw new Error(`unknown asset ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
