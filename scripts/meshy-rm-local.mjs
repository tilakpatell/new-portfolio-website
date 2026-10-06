// Makes this session's slice of the Rick and Morty multiverse plan
// (docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md) with
// Meshy, the site owner's account: Phase 2's people and props (Task 2.1) and
// Phase 6's vehicles (Task 6.1). Another session makes Phase 1 and is writing
// the plan's `rm` set into scripts/meshy.mjs (Task 0.2) at the same time, so
// this is that set's pipeline for these names alone, kept apart so the two
// never edit the same lines. Everything else is the plan's: the prompts as
// written, concept images on nano-banana-pro (A-pose for anything rigged),
// image-to-3D on `latest` with 2k textures at 30,000 faces (heroes 40,000
// with Meshy's 2k geometry), rigged figures to public/games/meshy/ with idle,
// walk and run clips (and a seated one for `sit`), the rest to
// public/models/c137/rm/, credits in public/games/credits.json, and every
// task id in scripts/meshy-tasks.json, so once these names are in
// meshy.mjs's `rm` set it sees them made and never pays again. Fold them in
// then, and delete this.
//
// scripts/rm-models.json is the ledger both sessions read before paying:
// `claim` marks the names `claimed` (push that before any paid step), a paid
// step marks them `meshy`, `fetch` marks them `done`.
//
//   node --env-file=.env.local scripts/meshy-rm-local.mjs <step> [name … | phase2 | phase6]
//
// Steps, in order: claim (free), images (9 credits), models (30, heroes 35),
// rig (5, rigged only), anim (an idle clip, 3), sit (3), fetch (free:
// download and compress), balance. `reroll <step> <name …>` forgets a step's
// task (and everything made from it), so the next run of that step pays for
// it again. Concept images and model thumbnails go to lab/meshy/rm/.
// MESHY_API_KEY comes from .env.local (git ignores it); it is never printed.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The sharp that glTF-Transform's ndarray-pixels loads (it brings its own
// version). Loading the project's as well puts two libvips in one process,
// and on Windows every texture then fails ("colourspace: parameter space not
// set"); with one, it doesn't.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('ndarray-pixels'))('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'games', 'meshy');
const RM_OUT = join(ROOT, 'public', 'models', 'c137', 'rm');
const REVIEW = join(ROOT, 'lab', 'meshy', 'rm'); // concept images and thumbnails, for judging (not shipped)
const TASKS = join(ROOT, 'scripts', 'meshy-tasks.json');
const LEDGER = join(ROOT, 'scripts', 'rm-models.json');
const API = 'https://api.meshy.ai/openapi';

// as scripts/meshy.mjs has them
const STYLE = 'Drawn in the 2D cartoon style of the animated TV show Rick and Morty: flat cel colours, clean thick black outlines, simple rounded shapes. Plain white background, no text, no shadow.';
const BODY = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body.';
const PROP = 'The whole object, three-quarter front view, centred.';
const CAR = 'The whole vehicle, three-quarter front view, centred, wheels on the ground.';

// The plan's Task 2.1 and 6.1 assets, as written there. hero: 40,000 faces
// and Meshy's 2k geometry; sit: a seated clip too; rig: false for the props,
// creatures and vehicles (everything else is rigged, `height` in metres).
const PHASE2 = {
  spacebeth: { hero: true, sit: true, height: 1.68, prompt: `Space Beth from Rick and Morty: Beth Smith as a space fighter, a woman in her thirties with long blonde hair past her shoulders, the right side of her head shaved with a blue streak in the hair, a scar over her right eye and a ring piercing in her right eyebrow, a long dark brown leather coat over a fitted dark grey-green combat suit with a grey chest plate, a heavy bronze gauntlet with small lights on her right forearm, fingerless gloves, a utility belt, black boots. ${BODY}` },
  rickprime: { hero: true, height: 1.85, prompt: `Rick Prime from Rick and Morty: a version of Rick Sanchez with greyer skin, dull pale blue hair in a plain short spiky cut, a unibrow and narrow cold eyes, a dark purple-grey zip-up sci-fi jacket with a high collar, a grey pad on one shoulder and a red stripe low on the front, over a dark red shirt, dark grey-black trousers and dark shoes. ${BODY}` },
  snuffles: { rig: false, prompt: `Snuffles from Rick and Morty: a small fluffy white dog standing on all fours, small black beady eyes, a little black nose, floppy ears and a blue collar with a round silver tag. ${PROP}` },
  drwong: { sit: true, height: 1.72, prompt: `Dr. Wong from Rick and Morty: a tall slim Chinese-American woman with a fair complexion, black hair in a neat bob, thick grey-rimmed glasses, in a beige wool jacket over a yellow long-sleeved shirt, a white necklace, black trousers, a black belt and black shoes. ${BODY}` },
  nancy: { height: 1.6, prompt: `Nancy from Rick and Morty, Summer's friend: a teenage girl with a long face and a long droopy nose, dark brown hair to her shoulders, square glasses, red lipstick, a white shirt under a thick dark magenta jacket, dark trousers and flat shoes. ${BODY}` },
  tricia: { height: 1.62, prompt: `Tricia Lange from Rick and Morty: a teenage girl with long straight brown hair and a narrow nose, a white crop top, a burgundy skirt, a small cross necklace, white tights with light grey knee socks and black flat shoes. ${BODY}` },
  diane: { height: 1.68, prompt: `Diane Sanchez from Rick and Morty: a slim fair-skinned woman with medium-length light blonde hair, plump cheeks, an upturned nose and pink lips, a few freckles, a light turquoise blouse, white jeans, grey heels, a silver pendant necklace, a violet bangle on her right wrist. ${BODY}` },
  pencilvester: { height: 1.6, prompt: `Pencilvester from Rick and Morty: a living yellow wooden pencil standing upright, the pink eraser with its silver metal band at the top for a head and the sharpened grey-tipped point at the bottom, two thin yellow arms and two thin legs in red sneakers, mismatched round eyes, pink lips and buck teeth. ${BODY}` },
  sleepygary: { height: 1.78, prompt: `Sleepy Gary from Rick and Morty: a sleepy man with short brown hair and a calm smile, in a long blue nightgown with a blue pyjama robe over it, a long droopy blue and white striped nightcap with a white cotton ball at its end, slippers. ${BODY}` },
  hamurai: { height: 1.8, prompt: `Hamurai from Rick and Morty: a samurai in full armour made entirely of meat: plates of pink steamed ham, slabs of steak, sausages and bacon strips for the lacings, a meat helmet with bacon crests, a stern face with narrow eyes, dark trousers, sandals, empty hands. ${BODY}` },
  amishcyborg: { height: 1.78, prompt: `Amish Cyborg from Rick and Morty: an old Amish man with a big black beard and sideburns and no moustache, a black wide-brimmed hat, a white shirt and brown trousers held up by suspenders, black shoes; the left half of his face is grey metal with two round red lights for the eye and a metal grille with green lights over his mouth, his right arm is a robot arm ending in the blade of a shovel, and his left leg is a steel robot leg. ${BODY}` },
  mrbeauregard: { height: 1.85, prompt: `Mr. Beauregard from Rick and Morty: a heavyset butler with swept-back grey-black hair, thick dark brows and heavy-lidded eyes, in a black tailcoat and waistcoat, a white dress shirt and a black bow tie, black trousers, black shoes, white gloves. ${BODY}` },
  cousinnicky: { height: 1.8, prompt: `Cousin Nicky from Rick and Morty: a muscular man from Brooklyn with slicked-back black hair, stubble and a smug half-smile, in a pale blue sleeveless shirt open at the chest showing chest hair, grey trousers with a big gold belt buckle, black shoes. ${BODY}` },
  frankenstein: { height: 2.1, prompt: `Frankenstein's monster as drawn in Rick and Morty: a tall heavy green-skinned monster with a flat-topped square head, black hair, a scar across his forehead, two metal bolts in his neck, heavy-lidded eyes, in a black jacket too small for him, a grey shirt, black trousers and big black boots. ${BODY}` },
  reversegiraffe: { rig: false, prompt: `Reverse Giraffe from Rick and Morty: a giraffe with a very long patterned tan and brown body and a very short neck, a small giraffe head with two little horns, standing on its four legs. ${PROP}` },
  ghostinajar: { rig: false, prompt: `Ghost in a Jar from Rick and Morty: a clear glass jar with a shiny gold screw lid, and inside it a small glowing green translucent ghost with a round domed head, dots for eyes, a simple line mouth, two stubby arms and a wavy lower edge. ${PROP}` },
  photographyraptor: { rig: false, prompt: `Photography Raptor from Rick and Morty: a velociraptor standing on its two hind legs, green scaly skin with darker stripes, a long tail, small clawed arms, a toothy snout, a camera on a strap round its neck and a tan photographer's vest with pockets. ${PROP}` },
  tinkles: { rig: false, prompt: `Tinkles from Rick and Morty: a little white lamb standing on four legs with a rainbow-striped unicorn horn, light pink ears, hooves, tail and a tuft of hair on top of her head, big blue eyes, a lavender tutu over a pink garment, a tiara with a red gem, rainbow knee socks. ${PROP}` },
  babywizard: { rig: false, prompt: `Baby Wizard from Rick and Morty: a chubby baby floating upright in a long pale blue wizard's robe covered in yellow stars, a tall pointed blue wizard's hat, a white beard, holding a small wooden staff. ${PROP}` },
  mrsrefrigerator: { rig: false, prompt: `Mrs. Refrigerator from Rick and Morty: a tall cream-white household refrigerator standing upright with a cartoon face on its door, a pink flowered apron tied round its middle, two short arms and two little legs. ${PROP}` },
};
const PHASE6 = {
  'spacebeth-ship': { rig: false, hero: true, prompt: `Space Beth's spaceship from Rick and Morty: a compact battered single-seat starfighter in dark grey and olive-green with orange and bronze panels, a tinted cockpit canopy, stubby swept wings with guns under them, mismatched welded-on armour plates, twin engines at the back. ${PROP}` }, // (confirm against the sheet)
  'jerry-ship': { rig: false, prompt: `Jerry's car turned into a spaceship by Rick, from Rick and Morty: an ordinary pale green four-door family sedan with grey rocket thrusters bolted to the back, a small fin on the roof and metal plates welded over the wheel arches. ${CAR}` },
  'gotron-ferret': { rig: false, hero: true, prompt: `A Gotron ferret robot from Rick and Morty: a giant mecha shaped like a long sleek ferret, red armour plates with white and gold trim, a ferret's head with glowing yellow eyes, four clawed legs, a long tail, a cockpit canopy on the back of its head. ${PROP}` },
  gotron: { rig: false, hero: true, prompt: `The combined Gotron mecha from Rick and Morty: a towering humanoid super robot assembled from five ferret robots in red, blue, yellow, green and black, each limb a ferret with its head at the end, a chest plate with a glowing emblem, a horned helmet with a visor face, standing straight. ${PROP}` },
  'zigerion-ship': { rig: false, hero: true, prompt: `The Zigerion mothership from Rick and Morty: a huge sleek purple and silver spaceship, a long flat hull widening into a broad flat stern, a raised bridge dome, blue running lights, purple glowing engines. ${PROP}` }, // (confirm against the sheet "Zigerions")
  storytrain: { rig: false, hero: true, prompt: `The Story Train from Rick and Morty: a long dark red and black steam locomotive hauling three passenger carriages, with a big round headlamp, a cowcatcher, a brass bell, green and gold trim, lit windows, no text. ${PROP}` },
};
export const ASSETS = {};
for (const [phase, set] of [
  [2, PHASE2],
  [6, PHASE6],
]) {
  for (const [n, a] of Object.entries(set)) ASSETS[n] = { phase, rig: true, poly: a.hero ? 40000 : 30000, tex: 2048, ...a };
}

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

const json = async (file) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {});
const put = (file, v) => writeFile(file, `${JSON.stringify(v, null, 2)}\n`);
// (several tasks finish at once: each save writes what's in memory, which
// has them all)
let tasks = null;
const save = () => put(TASKS, tasks);
async function mark(names, status) {
  const ledger = await json(LEDGER);
  for (const n of names) if (ledger[n]?.status !== 'done' || status === 'done') ledger[n] = { status, by: 'local' };
  await put(LEDGER, ledger);
}

// run one step for several names at a time (Meshy queues only so many tasks)
async function each(names, fn, at = 4) {
  const queue = [...names];
  const failed = [];
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) {
      await fn(n).catch((e) => {
        failed.push(n);
        console.error(`! ${n}: ${e.message}`);
      });
    }
  };
  await Promise.all(Array.from({ length: at }, worker));
  if (failed.length) console.error(`failed: ${failed.join(' ')}`);
}

// For the web: textures to WebP at `tex` pixels, geometry meshopt-compressed;
// a clip keeps only its skeleton and animation.
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

// what each step leaves, in order: rerolling one forgets it and those after
const CHAIN = ['image', 'model', 'rig', 'idle', 'sit'];
const LEAVES = { images: 'image', models: 'model', rig: 'rig', anim: 'idle', sit: 'sit' };

const steps = {
  async claim(names) {
    await mark(names, 'claimed');
    console.log(`claim    ${names.length} names in scripts/rm-models.json: commit and push it before paying`);
  },
  async images(names) {
    await mark(names, 'meshy');
    await each(names, async (n) => {
      const a = ASSETS[n];
      tasks[n] ??= {};
      if (!tasks[n].image) {
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${a.prompt} ${STYLE}`, ...(a.rig ? { pose_mode: 'a-pose' } : {}) });
        tasks[n].image = result;
        await save();
      }
      const t = await wait('/v1/text-to-image', tasks[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(18)} ${t.consumed_credits} credits`);
    });
  },
  async models(names) {
    await each(names, async (n) => {
      const a = ASSETS[n];
      if (!tasks[n]?.image) throw new Error('no image yet');
      if (!tasks[n].model) {
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: tasks[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: a.poly,
          texture_resolution: '2k',
          ...(a.hero ? { geometry_resolution: '2k' } : {}),
          ...(a.rig ? { pose_mode: 'a-pose' } : {}),
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        tasks[n].model = result;
        await save();
      }
      const t = await wait('/v1/image-to-3d', tasks[n].model, `${n} model`);
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(18)} ${t.consumed_credits} credits`);
    });
  },
  async rig(names) {
    await each(
      names.filter((n) => ASSETS[n].rig),
      async (n) => {
        if (!tasks[n]?.model) throw new Error('no model yet');
        if (!tasks[n].rig) {
          const { result } = await api('POST', '/v1/rigging', { input_task_id: tasks[n].model, height_meters: ASSETS[n].height });
          tasks[n].rig = result;
          await save();
        }
        const t = await wait('/v1/rigging', tasks[n].rig, `${n} rig`);
        console.log(`rig      ${n.padEnd(18)} ${t.consumed_credits} credits`);
      },
    );
  },
  // an idle clip (Meshy's animation library, action 0), on the bare skeleton
  async anim(names) {
    await each(
      names.filter((n) => ASSETS[n].rig),
      async (n) => {
        if (!tasks[n]?.rig) throw new Error('not rigged yet');
        if (!tasks[n].idle) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: tasks[n].rig, action_id: 0, post_process: { operation_type: 'extract_armature' } });
          tasks[n].idle = result;
          await save();
        }
        const t = await wait('/v1/animations', tasks[n].idle, `${n} idle`);
        console.log(`anim     ${n.padEnd(18)} ${t.consumed_credits} credits`);
      },
    );
  },
  // sitting: Chair_Sit_Idle_M from Meshy's animation library
  async sit(names) {
    await each(
      names.filter((n) => ASSETS[n].rig && ASSETS[n].sit),
      async (n) => {
        if (!tasks[n]?.rig) throw new Error('not rigged yet');
        if (!tasks[n].sit) {
          const { result } = await api('POST', '/v1/animations', { rig_task_id: tasks[n].rig, action_id: 33, post_process: { operation_type: 'extract_armature' } });
          tasks[n].sit = result;
          await save();
        }
        const t = await wait('/v1/animations', tasks[n].sit, `${n} sit`);
        console.log(`sit      ${n.padEnd(18)} ${t.consumed_credits} credits`);
      },
    );
  },
  async fetch(names) {
    // as Meshy made them, kept by task (so compressing again needs no download)
    const tmp = join(ROOT, 'node_modules', '.cache', 'meshy');
    await mkdir(tmp, { recursive: true });
    const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
    const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
    const done = [];
    for (const n of names) {
      const a = ASSETS[n];
      const s = tasks[n] ?? {};
      const files = []; // [url, file, texture size, clip only]
      if (a.rig) {
        if (!s.rig || !s.idle || (a.sit && !s.sit)) {
          console.error(`! ${n}: rig, anim${a.sit ? ' and sit' : ''} first`);
          continue;
        }
        const r = (await api('GET', `/v1/rigging/${s.rig}`)).result;
        const idle = (await api('GET', `/v1/animations/${s.idle}`)).result;
        files.push([r.rigged_character_glb_url, `${n}.glb`, a.tex, false]);
        // the clips on their own: the cast plays them on the figure
        files.push([r.basic_animations.walking_armature_glb_url, `${n}-walk.glb`, 0, true]);
        files.push([r.basic_animations.running_armature_glb_url, `${n}-run.glb`, 0, true]);
        files.push([idle.animation_glb_url, `${n}-idle.glb`, 0, true]);
        if (s.sit) files.push([(await api('GET', `/v1/animations/${s.sit}`)).result.animation_glb_url, `${n}-sit.glb`, 0, true]);
      } else {
        if (!s.model) {
          console.error(`! ${n}: no model yet`);
          continue;
        }
        const t = await api('GET', `/v1/image-to-3d/${s.model}`);
        files.push([t.model_urls.glb, `${n}.glb`, a.tex, false]);
      }
      const out = a.rig ? OUT : RM_OUT;
      await mkdir(out, { recursive: true });
      for (const [url, file, tex, clip] of files) {
        const raw = join(tmp, `${s.rig ?? s.model}-${file}`);
        if (!existsSync(raw)) await download(url, raw);
        await squeeze(raw, join(out, file), { tex, clip });
      }
      credits[`meshy/${a.rig ? '' : 'rm/'}${n}`] = { source: 'https://www.meshy.ai', id: s.model, name: `${n}, generated for this site with Meshy AI`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' };
      done.push(n);
      console.log(`fetch    ${n.padEnd(18)} ${files.map((f) => f[1]).join(', ')}`);
    }
    await put(creditsFile, credits);
    if (done.length) await mark(done, 'done');
  },
  async balance() {},
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in .env.local and run with node --env-file=.env.local.');
  const [step, ...rest] = process.argv.slice(2);
  const forget = step === 'reroll' ? rest.shift() : null;
  if (!steps[step] && !forget) throw new Error(`step: ${Object.keys(steps).join(' | ')} | reroll <step> <name …>`);
  // a phase's name stands for its assets
  const names = (rest.length ? rest : Object.keys(ASSETS)).flatMap((n) => (/^phase\d$/.test(n) ? Object.keys(ASSETS).filter((k) => ASSETS[k].phase === Number(n.slice(5))) : [n]));
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown asset ${n}`);
  tasks = await json(TASKS);
  if (forget) {
    const from = CHAIN.indexOf(LEAVES[forget]);
    if (from < 0 || !rest.length) throw new Error(`reroll <${Object.keys(LEAVES).join(' | ')}> <name …>`);
    for (const n of names) for (const k of CHAIN.slice(from)) if (tasks[n]) delete tasks[n][k];
    await save();
    console.log(`reroll   ${forget} forgotten for ${names.join(' ')}`);
    return;
  }
  await steps[step](names);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
