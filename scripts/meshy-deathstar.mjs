// Makes proper models, with Meshy (meshy.ai, the site owner’s account), for
// the people aboard the Death Star’s interior
// (src/components/deathstar/inside) who are built or dressed in code, or
// borrowed from the wrong film (Obi-Wan, made as the first film’s old Ben
// and rigged from jedi3 by scripts/rig-transfer.mjs, is in):
// the Death Star trooper (today the officer’s model tinted black under a
// helmet built in code; the gunner is the same man), the IT-O interrogation
// droid and the trash compactor’s dianoga (both built in code from spheres,
// cylinders and bones). Each is a concept image and a textured model made
// from it, described by its looks and never by name (Meshy’s image step
// turns names down), in a realistic film-prop look to match the crew models
// round them. The trooper is rigged on Meshy’s humanoid skeleton (the same
// 24 bones and `Hips` as every Meshy figure on the site) so the interior’s
// shared clips play on him; the IT-O and the dianoga are props, not rigged,
// as the interior moves the whole model in code (scene/people.js,
// buildProp). Everything is compressed for the web into
// public/models/deathstar/ (WebP textures, meshopt geometry) and credited in
// public/games/credits.json. The output is committed, so the site never
// calls Meshy.
//
//   node --env-file=.env.local scripts/meshy-deathstar.mjs <step> [name …]
//
// Steps, in order: images (9 credits each), models (30 each), rig (5, the
// trooper only), fetch (free). `all` runs those four in turn (122 credits
// from a fresh start); `cost` (free) prints what is still to spend and the
// live balance; `balance` (free) prints the balance. Before a paid step, what
// it will spend is checked against the live balance: an account short of it
// is told how many credits are needed and how many it has, and nothing is
// started. Each task’s id is kept in scripts/meshy-deathstar-tasks.json
// (made on the first paid run), so a step run again never pays twice; delete
// a name’s entry there to make it again. MESHY_API_KEY comes from the
// environment (.env.local, which git ignores, through --env-file) and is
// never printed. Meshy’s model step has turned down a concept too like the
// films’ own before (scripts/meshy-cockpit.mjs’s Chewbacca), so a run may
// need a fresh concept: another 9 credits, beyond what `cost` sums. Concept
// images and thumbnails go to lab/meshy/deathstar (or
// MESHY_REVIEW), for looking at, not shipped.
//
//   ASSETS[name] → { url, height, poly, tex, rigged, prompt, image?, model?, donor? }
//     url: the URL the interior loads, under public/; height: metres (the rig’s, or the prop’s size);
//     poly: target triangles; tex: texture size on the site; rigged: on Meshy’s humanoid skeleton;
//     image, model: the text-to-image and image-to-3D engines, when not the best (and dearest) ones;
//     donor: a rigged crew model whose skeleton and skin weights scripts/rig-transfer.mjs moves onto
//     this one once it is fetched, in place of Meshy’s rig (old Ben, as jedi3 is an old robed man)
//   PRICE → { images, models, rig }   credits each step costs an asset
//   costOf(names, tasks = {}, steps = every paid step) → credits   pure: what those steps still cost
//     those names, given the tasks file’s ids (a step with a recorded id costs nothing); throws for an
//     unknown name (an own key of ASSETS only)
//   covers(have, need) → bool   whether a balance pays for `need`; fails closed when it isn’t a number
//   squeeze(from, to, asset) → { tris, hips }   a Meshy GLB made ready for the web
//
// Once fetch has run, in the interior:
//   rules/cast.js: NAVY’s model becomes '/models/deathstar/dstrooper.glb' (the trooper and the gunner
//     share it), without its `helmet` and its BLACK `tint` (the model is black already, and the tint
//     would darken it to nothing); CAST.ito.model and CAST.dianoga.model become their URLs, without
//     their `built`
//   scene/people.js: buildIto and buildDianoga leave BUILT, and helmetGeometry and helmetOn go with the
//     last `helmet`. The props then come in through figureFor’s buildProp, which stands a prop on the
//     deck and tips it over when it dies, so the IT-O’s hover (HOVER) and the dianoga’s rise out of the
//     water and its sinking (DEEP) move into buildProp’s pose for those two kinds
//   pack.js: the three URLs in PACK.urls (scripts/pack-check.mjs fails without them)

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'deathstar');
const TASKS = join(ROOT, 'scripts', 'meshy-deathstar-tasks.json');
const CREDITS = join(PUBLIC, 'games', 'credits.json');
const API = 'https://api.meshy.ai/openapi';

// Realistic, not the cockpit’s soft animated look: these stand among the
// galaxy’s crew models (the officer, the troopers, Vader), which are real
// film likenesses
const PERSON =
  'A realistic 3D character for a film-quality video game: true-to-life proportions, realistic fabric, leather and glossy moulded plastic, finely detailed, no cartoon styling. Full body, front view, standing straight in an A-pose with the arms held a little away from the body, empty hands, feet slightly apart. One figure only. Plain neutral grey background, no text, no logos, no shadow.';
// (seen from the front, so the eye the interior turns towards its target
// looks along the model’s own front)
const PROP =
  'A realistic 3D film prop for a film-quality video game: true-to-life materials, finely detailed and a little worn, no cartoon styling. The whole thing in frame, seen from the front, centred, its front facing the viewer. One only. Plain neutral grey background, no text, no logos, no shadow, no ground.';

export const PRICE = Object.freeze({ images: 9, models: 30, rig: 5 });
// What the cheaper engines cost a step, for an asset that names one (old Ben
// was made when the account had 21 credits): Meshy's own price list
const ENGINE_PRICE = Object.freeze({ 'nano-banana': 3, 'nano-banana-2': 6, 'nano-banana-pro': 9, 'meshy-6-lite': 15, latest: 30 });
const IMAGE = 'nano-banana-pro';
const MODEL = 'latest';
// what one paid step costs one asset, by the engine it names
const priceOf = (a, step) => (step === 'images' ? ENGINE_PRICE[a.image ?? IMAGE] : step === 'models' ? ENGINE_PRICE[a.model ?? MODEL] : PRICE[step]);
const PAID = Object.keys(PRICE);
// the tasks file’s field that holds each paid step’s id
const FIELD = { images: 'image', models: 'model', rig: 'rig' };

export const ASSETS = {
  // the first station’s own trooper and gunner, as the first film shows them
  dstrooper: {
    url: '/models/deathstar/dstrooper.glb',
    height: 1.8,
    poly: 20000,
    tex: 1024,
    rigged: true,
    prompt:
      'A man in a plain black military uniform: a black high-collared tunic and matching black trousers, a wide black belt with a small plain silver buckle plate, black knee-high boots and black gloves. On his head a glossy black dome helmet covering the top, sides and back of the head, its rim flaring out wide at the back and sides, with a dark visor band across the eyes and the lower face showing beneath it. No insignia.',
  },
  // Obi-Wan as the first film has him: an old hermit in a homespun tunic
  // and a long brown cloak, white-haired and white-bearded. Made on the
  // cheaper engines (the account was down to 21 credits) and rigged from
  // jedi3, the crew's old robed man, so he plays every shared clip.
  obiwan: {
    url: '/models/deathstar/obiwan.glb',
    height: 1.78,
    poly: 20000,
    tex: 2048,
    rigged: false,
    donor: '/models/galaxy/crew/jedi3.glb',
    image: 'nano-banana',
    model: 'meshy-6-lite',
    prompt:
      'An elderly hermit in his late sixties with a kind, weathered, deeply lined face, bright pale eyes, short swept-back white hair and a short neat white beard and moustache. He wears a layered off-white wrapped cross-over tunic of rough homespun cloth with a wide cream sash at the waist, loose off-white trousers tucked into worn brown leather knee boots, a narrow brown leather belt with two small pouches, and over it all a long coarse heavy dark brown cloak, worn open, its hood down and draped back on his shoulders, its long wide sleeves ending at the wrists so the hands are bare.',
  },
  // (as tall as CAST.ito.tall: buildProp sizes a prop by that either way)
  ito: {
    url: '/models/deathstar/ito.glb',
    height: 0.3,
    poly: 6000,
    tex: 1024,
    rigged: false,
    prompt:
      'A floating spherical interrogation robot: a glossy black metal sphere about 30 cm across with fine panel lines and a thin silver ring round its middle, a single round red glowing sensor eye on its front, three thin antennae sticking up from the top, and small jointed silver instrument arms folded beneath it, one of them ending in a hypodermic syringe with a long thin needle. It hovers with nothing beneath it.',
  },
  // How far it rises out of the compactor’s water, as CAST.dianoga.tall. No
  // water in the model: the compactor’s own is drawn round it, and a
  // modelled surface would hide it or float above it.
  dianoga: {
    url: '/models/deathstar/dianoga.glb',
    height: 1.4,
    poly: 12000,
    tex: 1024,
    rigged: false,
    prompt:
      'A swamp creature rising out of murky water: a single large round pale eye with a dark slit pupil on a long thick fleshy grey-green eyestalk, the rounded top of a rubbery mottled grey-green body, and four thick suckered tentacles curling up round it, wet and slimy. Only the part above the water, shown with no water at all, the body cut off level at the bottom.',
  },
};

// (an own key only: 'constructor' or '__proto__' would otherwise pass for an asset, be paid for and
// never be recorded, so paid for again on every run)
const known = (name) => Object.hasOwn(ASSETS, name);

// the paid steps a name still needs, of `steps`
function owing(name, tasks, steps) {
  if (!known(name)) throw new Error(`unknown asset ${name} (${Object.keys(ASSETS).join(', ')})`);
  const a = ASSETS[name];
  return steps.filter((step) => (step !== 'rig' || a.rigged) && !tasks?.[name]?.[FIELD[step]]);
}

export function costOf(names, tasks = {}, steps = PAID) {
  let credits = 0;
  for (const n of names) for (const step of owing(n, tasks, steps)) credits += priceOf(ASSETS[n], step);
  return credits;
}

// ── Meshy ──

// Set only once the balance has been seen to cover what is about to be
// spent, so no path through the steps can reach a paid endpoint unchecked
let cleared = false;

async function api(method, path, body) {
  if (method !== 'GET' && !cleared) throw new Error(`${method} ${path}: refused, the balance wasn’t checked first`);
  const headers = { Authorization: `Bearer ${process.env.MESHY_API_KEY}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// (Meshy’s files come from signed links: no key goes with them)
async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}

const balance = async () => (await api('GET', '/v1/balance')).balance;

// Whether a balance pays for `need`. It fails closed: a balance that isn’t a
// finite number (an error body sent with a 200, a changed reply) pays for nothing.
export const covers = (have, need) => typeof have === 'number' && Number.isFinite(have) && have >= need;

// The balance must cover all that `steps` will spend before any of it is
// asked for, so a short account stops a run before it has paid for half of
// it (three concepts and no models)
async function afford(label, steps, names, s) {
  const need = costOf(names, s, steps);
  if (!need) return;
  const have = await balance();
  if (!covers(have, need)) throw new Error(`${label}: needs ${need} credits, the account has ${have}. Nothing was started; top the account up at meshy.ai and run it again.`);
  cleared = true;
}

const load = async () => (existsSync(TASKS) ? JSON.parse(await readFile(TASKS, 'utf8')) : {});
const save = (s) => writeFile(TASKS, `${JSON.stringify(s, null, 2)}\n`);

// ── for the web ──

// The compression’s libraries, loaded the first time a model is squeezed:
// the cost sum and its tests need none of them
let kit = null;
async function tools() {
  if (!kit) {
    const [{ NodeIO }, { ALL_EXTENSIONS }, f, { MeshoptDecoder, MeshoptEncoder }] = await Promise.all([import('@gltf-transform/core'), import('@gltf-transform/extensions'), import('@gltf-transform/functions'), import('meshoptimizer')]);
    // (glTF-Transform’s own sharp: two libvips in one process break textures on Windows)
    const require = createRequire(import.meta.url);
    const sharp = createRequire(require.resolve('ndarray-pixels'))('sharp');
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
    kit = { io, f, MeshoptEncoder, sharp };
  }
  return kit;
}

const triangles = (root) => root.listMeshes().reduce((sum, m) => sum + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);

// Textures to WebP at the asset’s `tex`, geometry meshopt-compressed. A
// prop is sized to its height and stood on y = 0 at the middle; a rigged
// figure stands as the rig left it (its bounds here would be the unskinned
// mesh’s).
export async function squeeze(from, to, a) {
  const { io, f, MeshoptEncoder, sharp } = await tools();
  const doc = await io.read(from);
  const root = doc.getRoot();
  // (the rigger can hand back a walk of its own: the interior plays its shared clips instead)
  for (const anim of root.listAnimations()) anim.dispose();
  if (!a.rigged) {
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    const b = f.getBounds(scene);
    const k = a.height / (b.max[1] - b.min[1]);
    const holder = doc.createNode('prop').setScale([k, k, k]).setTranslation([-((b.min[0] + b.max[0]) / 2) * k, -b.min[1] * k, -((b.min[2] + b.max[2]) / 2) * k]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      holder.addChild(child);
    }
    scene.addChild(holder);
  }
  await doc.transform(f.dedup(), f.prune(), f.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [a.tex, a.tex] }), f.meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  return { tris: triangles(root), hips: root.listNodes().some((n) => n.getName() === 'Hips') };
}

// A figure Meshy made but didn't rig, rigged on its donor's skeleton
async function rigged(from, to, a) {
  const { rigFrom } = await import('./rig-transfer.mjs');
  const r = await rigFrom(join(PUBLIC, a.donor), from, to, { tex: a.tex });
  return { tris: r.tris, hips: true };
}

// ── the steps ──

const steps = {
  // all asked for first, then waited on (each takes a minute or two)
  async images(names, s) {
    for (const n of names) {
      s[n] ??= {};
      if (!s[n].image) {
        const a = ASSETS[n];
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: a.image ?? IMAGE, prompt: `${a.prompt} ${a.rigged || a.donor ? PERSON : PROP}`, ...(a.rigged || a.donor ? { pose_mode: 'a-pose' } : {}) });
        s[n].image = result;
        await save(s);
      }
    }
    for (const n of names) {
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    // (every concept there before any model is paid for)
    for (const n of names) if (!s[n]?.image) throw new Error(`${n}: no image yet (run images first)`);
    for (const n of names) {
      if (!s[n].model) {
        const a = ASSETS[n];
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: a.model ?? MODEL,
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: a.poly,
          texture_resolution: '2k',
          ...(a.rigged || a.donor ? { pose_mode: 'a-pose' } : {}),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        s[n].model = result;
        await save(s);
      }
    }
    const failed = [];
    for (const n of names) {
      let t;
      try {
        t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
      } catch (e) {
        console.log(`model    ${n.padEnd(10)} ${e.message}`);
        failed.push(n);
        continue;
      }
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
    // (turned down, most likely: stopping here keeps `all` from rigging a model that isn’t there)
    if (failed.length) throw new Error(`models: ${failed.join(', ')} failed; delete the name’s "model" (and "image", for a new concept) in scripts/meshy-deathstar-tasks.json and run again`);
  },
  async rig(names, s) {
    for (const n of names.filter((n) => ASSETS[n].rigged)) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet (run models first)`);
      if (!s[n].rig) {
        const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
        s[n].rig = result;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    const tmp = join(REVIEW, 'raw');
    const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
    for (const n of names) {
      const a = ASSETS[n];
      let url;
      if (a.rigged) {
        if (!s[n]?.rig) throw new Error(`${n}: not rigged yet (run rig first)`);
        url = (await api('GET', `/v1/rigging/${s[n].rig}`)).result.rigged_character_glb_url;
      } else {
        if (!s[n]?.model) throw new Error(`${n}: no model yet (run models first)`);
        url = (await api('GET', `/v1/image-to-3d/${s[n].model}`)).model_urls.glb;
      }
      const raw = join(tmp, `${n}.glb`);
      const out = join(PUBLIC, a.url);
      await download(url, raw);
      // (a figure with a donor keeps Meshy's file as it came, for scripts/rig-transfer.mjs to rig)
      if (a.donor) await writeFile(join(REVIEW, `${n}-raw.glb`), await readFile(raw));
      const { tris, hips } = a.donor ? await rigged(raw, out, a) : await squeeze(raw, out, a);
      // (without Meshy’s `Hips` the interior would take him for a prop and play him no clips)
      if (a.rigged && !hips) throw new Error(`${n}: no Hips bone`);
      credits[`deathstar/${n}`] = { source: 'https://www.meshy.ai', id: s[n].model, name: `${n}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      console.log(`fetch    ${n.padEnd(10)} ${a.url}, ${((await stat(out)).size / 1e6).toFixed(2)} MB, ${tris} triangles${a.rigged ? ', rigged' : ''}`);
    }
    await writeFile(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
    await rm(tmp, { recursive: true, force: true });
  },
};

// what the free steps print instead of making anything
async function cost(names, s) {
  for (const n of names) {
    const left = owing(n, s, PAID);
    const sum = costOf([n], s);
    console.log(`cost     ${n.padEnd(10)} ${sum} credits${left.length ? `: ${left.map((step) => `${step} ${priceOf(ASSETS[n], step)}`).join(', ')}` : ', all made'}`);
  }
  const need = costOf(names, s);
  const have = await balance();
  console.log(`cost     ${'total'.padEnd(10)} ${need} credits still to spend`);
  console.log(`balance  ${have} credits${have < need ? `, ${need - have} short` : ''}`);
}

const PLANS = { images: ['images'], models: ['models'], rig: ['rig'], fetch: ['fetch'], all: ['images', 'models', 'rig', 'fetch'] };
const USAGE = `node --env-file=.env.local scripts/meshy-deathstar.mjs <${[...Object.keys(PLANS), 'cost', 'balance'].join(' | ')}> [${Object.keys(ASSETS).join(' | ')} …]`;

async function main() {
  const [step, ...only] = process.argv.slice(2);
  if (!PLANS[step] && step !== 'cost' && step !== 'balance') throw new Error(`usage: ${USAGE}`);
  const names = only.length ? [...new Set(only)] : Object.keys(ASSETS);
  for (const n of names) if (!known(n)) throw new Error(`unknown asset ${n} (${Object.keys(ASSETS).join(', ')})`);
  if (!process.env.MESHY_API_KEY) throw new Error('MESHY_API_KEY is not set: put it in .env.local and run with node --env-file=.env.local.');
  const s = await load();
  if (step === 'cost') return cost(names, s);
  if (step === 'balance') return console.log(`balance  ${await balance()} credits`);
  const plan = PLANS[step];
  await afford(step, plan.filter((p) => PAID.includes(p)), names, s);
  for (const p of plan) await steps[p](names, s);
  console.log(`balance  ${await balance()} credits left`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    // (no message carries the key, but one quoting a request back must not either)
    const key = process.env.MESHY_API_KEY;
    console.error(key ? String(e.message).replaceAll(key, '[MESHY_API_KEY]') : e.message);
    process.exit(1);
  });
}
