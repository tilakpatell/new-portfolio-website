// Makes the fleet war's flagships for the universe map's two wars that have
// none on Sketchfab (docs/superpowers/plans/2026-10-06-fleet-war.md, PRs D
// and E) with Meshy (meshy.ai), the site owner's account: the Council of
// Ricks' dreadnought and the Galactic Federation's battleship (Rick and
// Morty's war), Gus's superlab barge and Don Eladio's flying hacienda
// (Breaking Bad's). A concept image each, a textured model from it, and the
// model compressed for the web into public/models/universe/war/<kind>.glb,
// where galaxy/models.js loads it for universe/wars.js's capitals. The output
// is committed, so the site never calls Meshy.
//
//   node --env-file=$HOME/.tilakverse.env scripts/meshy-war.mjs <step> [kind …]
//
// Steps, in order: images (9 credits each), models (30), fetch (free). Each
// task's id is kept in scripts/meshy-war-tasks.json, so running a step again
// never pays twice; delete a kind's entry there to make it again.
// MESHY_API_KEY comes from the env file; it is never printed. Concept images
// and thumbnails go to lab/meshy/war (or MESHY_REVIEW), for looking at, not
// shipped.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// (the sharp glTF-Transform's ndarray-pixels loads: two libvips in one
// process fail on Windows, as scripts/meshy-rm-local.mjs found)
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('ndarray-pixels'))('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'universe', 'war');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'war');
const TASKS = join(ROOT, 'scripts', 'meshy-war-tasks.json');
const API = 'https://api.meshy.ai/openapi';

const SHIP =
  'A single huge starship, three-quarter view from above and in front, the whole ship in frame and centred, its nose pointing to the lower left, crisp hard-surface detail, stylised 3D render, plain light grey background, no text, no logos, no people, no shadow.';

// What the show looks like: Rick and Morty's two are drawn from its own frames
// (`ref`, a still from the Rick and Morty wiki, kept in lab/meshy/war/ref/
// and never shipped: `refUrl` says where it came from), lifted out of the
// picture by Meshy's image-to-image as a ship alone on grey; a first try
// from words alone came out as designs of its own, not the show's.
const SHOW = 'Clean cel-shaded cartoon look like the TV show, bold dark outlines softened into a 3D render.';

// kind: universe/wars.js's; poly: triangles Meshy makes; tex: its colour map
// on the site (the other maps half that); as: what it is, for the credits
export const ASSETS = {
  councildread: {
    poly: 60000,
    tex: 2048,
    as: 'the Council of Ricks’ dreadnought',
    ref: 'S3E1_Prison___Citadel.png',
    refUrl: 'https://rickandmorty.fandom.com/wiki/File:S3E1_Prison_%26_Citadel.png',
    // (the Council has no warship of its own in the show: this one is built
    // in the Citadel's own look, from the Citadel in the picture)
    prompt: `Using the design of the Citadel of Ricks in this picture (its teal and cyan glass discs and domes, dark steel spires and red neon rings), design a long warship for the Council of Ricks: a long tapering dark-steel hull with a teal glass dome bridge near the front, two round teal glass shield domes on its back toward the stern, red neon trim lines, a tall thin spire amidships, and big teal-glowing engines at the stern. ${SHOW}`,
  },
  fedbattleship: {
    poly: 60000,
    tex: 2048,
    as: 'the Galactic Federation’s battleship',
    ref: 'GF_Ship.jpg',
    refUrl: 'https://rickandmorty.fandom.com/wiki/File:GF_Ship.jpg',
    prompt: `Lift the big Galactic Federation ship in the middle of this picture out of it, exactly as it is drawn: the same egg-shaped dark green and black armoured hull, the rows of green glowing lights along its top, the round red lights on its flanks, the two big rounded engine pods on its sides with green glowing thrusters, and its spiked insect-like prow underneath. Show it alone, flying, as a huge capital starship. ${SHOW}`,
  },
  superlab: {
    poly: 60000,
    tex: 2048,
    as: 'Gus Fring’s superlab barge',
    prompt:
      'An industrial flying barge spaceship that is a chemistry-lab-and-laundry factory: a long boxy brushed-steel hull with roof vents, chimneys and steam stacks, stainless-steel chemical tanks and round industrial laundry dryer drums on its deck, yellow and red stripe trim along the sides, two small round domes on the roof, glowing orange thrusters at the stern and underneath, gritty realistic sci-fi.',
  },
  hacienda: {
    poly: 60000,
    tex: 2048,
    as: 'Don Eladio’s flying hacienda',
    prompt:
      'A flying fortress spaceship built as a lavish Mexican hacienda mansion on a floating rock base: terracotta walls, red clay tile roofs with gold trim, arched colonnades, a central courtyard with a turquoise swimming pool and palm trees, cannon turrets on the corners, a big block of glowing orange thrusters under the rocky base at the back.',
  },
};

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

// For the web: welded, its colour and glow maps WebP at `tex` (the rest half
// that), meshopt-compressed
let io = null;
async function squeeze(from, to, tex) {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  const doc = await io.read(from);
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [tex, tex], quality: 84 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness/, resize: [tex / 2, tex / 2], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
}

const steps = {
  async images(names, s) {
    for (const n of names) {
      s[n] ??= {};
      const path = ASSETS[n].ref ? '/v1/image-to-image' : '/v1/text-to-image';
      if (!s[n].image) {
        const prompt = `${ASSETS[n].prompt} ${SHIP}`;
        const ref = ASSETS[n].ref && `data:image/${ASSETS[n].ref.endsWith('.png') ? 'png' : 'jpeg'};base64,${(await readFile(join(REVIEW, 'ref', ASSETS[n].ref))).toString('base64')}`;
        const { result } = await api('POST', path, ref ? { ai_model: 'nano-banana-pro', prompt, reference_image_urls: [ref] } : { ai_model: 'nano-banana-pro', prompt });
        s[n].image = result;
        await save(s);
      }
      const t = await wait(path, s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(14)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async models(names, s) {
    for (const n of names) {
      if (!s[n]?.image) throw new Error(`${n}: no image yet`);
      if (!s[n].model) {
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: true,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: ASSETS[n].poly,
          texture_resolution: '2k',
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
      const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) if (url) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(14)} ${t.consumed_credits ?? '?'} credits`);
    }
  },
  async fetch(names, s) {
    const tmp = join(REVIEW, 'raw');
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
    for (const n of names) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      const t = await api('GET', `/v1/image-to-3d/${s[n].model}`);
      const raw = join(tmp, `${n}.glb`);
      await download(t.model_urls.glb, raw);
      const out = join(OUT, `${n}.glb`);
      await squeeze(raw, out, ASSETS[n].tex);
      credits[`war/${n}`] = { source: 'https://www.meshy.ai', id: s[n].model, name: `${ASSETS[n].as}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(14)} ${((await stat(out)).size / 1024).toFixed(0)} KB`);
    }
    await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
    await rm(tmp, { recursive: true, force: true });
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY and run with node --env-file=$HOME/.tilakverse.env.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(ASSETS);
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown asset ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
