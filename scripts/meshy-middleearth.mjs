// Middle-earth's people as figures on the site's shared skeleton, so they
// walk, talk, sit, fight and fall on the same clips as everyone else
// (docs/superpowers/specs/2026-10-07-living-characters-design.md, W6). The
// world's look stays: big-headed toy figures, as its Overcooked-like towns
// and Rush's kitchen have them, made with Meshy (meshy.ai): a concept image,
// a textured model from it, Meshy's humanoid skeleton, Meshy's own walk and
// run from the rigger (free) and an idle from its animation library. The
// creatures (Shelob, the Balrog, the horses, Gollum, the trolls, the
// Nazgûl's cloth) stay built in code.
//
//   MESHY_API_KEY=<the account's key> node --env-file=.env.local scripts/meshy-middleearth.mjs <step> [name …]
//
// Steps, in order: images (9 credits each), models (30), rig (5), idle (3),
// fetch (free: each figure to public/models/middleearth/cast/<name>.glb and
// its clips beside it as <name>-idle|walk|run.glb, as Portal panic's cast
// keeps theirs), balance. Task ids are kept in
// scripts/meshy-middleearth-tasks.json, so a step run again never pays
// twice; delete a name's entry there to make it again. A task can only be
// read by the account that made it, so run every step with the same key.
// Concept images and model thumbnails go to lab/meshy/middleearth for
// looking at before the next step pays, and aren't shipped. Each is
// described by how it looks, never by name: the image step turns names down.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// (glTF-Transform's own sharp: two libvips in one process break textures on Windows)
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('ndarray-pixels'))('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'middleearth', 'cast');
const REVIEW = join(ROOT, 'lab', 'meshy', 'middleearth');
const TASKS = join(ROOT, 'scripts', 'meshy-middleearth-tasks.json');
const API = 'https://api.meshy.ai/openapi';

// the world's look: its toy figures, made solid
const LOOK =
  'A stylized chibi toy figure for a cozy cartoon co-op adventure video game, like a painted vinyl collectible: an oversized round head about a third of the whole height, a small rounded body, short sturdy arms and legs with simple chunky hands, soft rounded simplified shapes, smooth matte hand-painted colours, a simple cartoon face with small dark eyes; every beard, moustache, hairstyle and hat exactly as described, big and bold. Faithful to the classic fantasy film costume described.';
const POSE = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body, empty hands, feet slightly apart, standing on the ground with no base, stand or plinth. One figure only. Plain neutral grey background, no text, no shadow, no weapon.';

// height: metres as the world stands them (the towns scale them again);
// prompt: how they look, from the films
export const ASSETS = {
  // the hobbits
  frodo: { height: 1.15, prompt: 'A young halfling with a mop of dark brown curly hair and big blue eyes, large bare hairy feet, a white linen shirt with a high collar, a dark green-brown waistcoat with brass buttons, brown corduroy breeches to just below the knee, a grey-green woollen cloak clasped at the throat with a green leaf-shaped brooch.' },
  sam: { height: 1.12, prompt: 'A stout cheerful young halfling gardener with short curly sandy-brown hair and round rosy cheeks, large bare hairy feet, a cream linen shirt with rolled sleeves, a mustard-yellow waistcoat, brown braces, dark brown breeches to below the knee, a grey-green woollen cloak with a green leaf-shaped brooch, a heavy pack strap across his chest.' },
  merry: { height: 1.14, prompt: 'A young halfling with wavy chestnut-brown hair and a cheeky grin, large bare hairy feet, a cream shirt, a dark blue-green waistcoat, a deep blue jacket, brown breeches to below the knee, a grey-green cloak with a green leaf-shaped brooch.' },
  pippin: { height: 1.12, prompt: 'A mischievous young halfling with short tousled light brown curly hair, large bare hairy feet, a cream shirt, a moss-green waistcoat with a mustard scarf, a dark green-brown jacket, brown breeches to below the knee, a grey-green cloak with a green leaf-shaped brooch.' },
  bilbo: { height: 1.12, prompt: 'An elderly halfling gentleman with short silvery-white curly hair, large bare hairy feet, a white shirt with a cravat, a rich red-and-gold patterned brocade waistcoat with brass buttons, a dark burgundy velvet jacket, brown breeches to below the knee.' },
  rosie: { height: 1.08, prompt: 'A young halfling woman barmaid with long wavy auburn hair tied back, large bare feet, a cream blouse with puffed sleeves, a laced brown bodice, a long rust-red skirt to the ankles with a white apron.' },
  hobbit: { height: 1.12, prompt: 'A plump middle-aged halfling villager with short curly greying hair and big sideburns, large bare hairy feet, a cream shirt, a faded green waistcoat, a brown jacket with patched elbows, brown breeches to below the knee.' },
  // the Fellowship and the great
  gandalf: { height: 1.85, prompt: 'A tall old wandering wizard with a very long thick bushy grey beard flowing down over his chest to his belt, long straggly grey hair falling to his shoulders, bushy grey eyebrows, a tall pointed wide-brimmed soft grey hat with a crooked bent tip, long flowing grey robes, a long grey cloak, a silver-grey scarf, a brown leather belt, worn brown boots.' },
  gandalfwhite: { height: 1.85, prompt: 'A tall old wizard with a very long thick flowing white beard down over his chest to his belt and long white hair to his shoulders, bareheaded with no hat, gleaming white robes and a long white cloak, a silver belt, white boots, a calm stern face.' },
  aragorn: { height: 1.88, prompt: 'A rugged ranger in his forties with shoulder-length dark brown hair and stubble, a weathered face, a dark charcoal-green hooded cloak with the hood down, a worn brown leather jerkin over a dark shirt, leather bracers, dark trousers, tall brown boots, a sword belt with an empty scabbard.' },
  legolas: { height: 1.88, prompt: 'A tall graceful wood elf archer with long straight platinum-blond hair with small braids, pointed ears, a calm youthful face, a silver-grey tunic under a fitted green-brown leather jerkin, dark leggings, soft brown boots, a quiver strap across the chest and an empty quiver on the back.' },
  gimli: { height: 1.35, prompt: 'A short broad stocky dwarf warrior with a long thick braided red-brown beard with metal beads, bushy eyebrows, a round iron helmet with cheek guards, a heavy chain mail shirt over brown leather, a broad studded belt, thick leather boots.' },
  boromir: { height: 1.9, prompt: 'A strong proud warrior from a stone city in his forties with a clearly drawn friendly face (brown eyes, eyebrows, nose and mouth all visible), shoulder-length light brown hair and a short reddish-brown beard, a dark red-maroon padded tunic with a fur-trimmed dark cloak, leather bracers, a brown leather belt, tall boots, a large round shield strap across the back.' },
  faramir: { height: 1.85, prompt: 'A thoughtful ranger captain with short reddish-brown hair and a short beard, a dark forest-green hooded cloak, a dark green leather jerkin over a grey tunic, leather bracers, dark trousers, tall boots.' },
  // the elves, the riders and the wizard in the tower
  galadriel: { height: 1.95, prompt: 'A tall serene elf queen with very long wavy golden-blonde hair and pointed ears, a gentle luminous face, a flowing shimmering white-silver gown to the floor with long draped sleeves, a thin silver circlet on her brow.' },
  elrond: { height: 1.92, prompt: 'A tall stately elf lord with long straight dark brown hair and pointed ears, a stern noble face, a thin silver circlet on his brow, long layered deep burgundy and dark red robes embroidered with gold, a long dark red mantle.' },
  arwen: { height: 1.8, prompt: 'A beautiful young elf woman with long dark wavy hair and pointed ears, pale skin, a flowing deep blue-grey velvet gown with long sleeves, a small silver pendant on her chest.' },
  elf: { height: 1.88, prompt: 'A tall elven guard with long straight light brown hair and pointed ears, a calm face, a long green-and-silver tunic with leaf patterns, a grey-green hooded cloak with the hood down, soft boots.' },
  theoden: { height: 1.83, prompt: 'An aged horse-lord king with long grey-blond hair and a grey beard, a golden circlet crown, a richly embroidered green-and-gold tunic, a heavy dark green fur-collared cloak, a leather belt, tall brown boots.' },
  eowyn: { height: 1.72, prompt: 'A proud young shieldmaiden of the horse-lords with long golden-blonde hair, a pale determined face, a simple long white-and-pale-green dress with a dark leather belt, a dark cloak over her shoulders, brown boots.' },
  rohirrim: { height: 1.83, prompt: 'A horse-lord soldier with long blond hair and a beard, a round iron helmet with a horsehair crest and cheek guards, a scale armour coat over a green tunic, a dark green cloak, leather bracers, tall boots.' },
  gondorguard: { height: 1.85, prompt: 'A stone-city citadel guard in black-and-silver plate armour, a tall silver helmet with white sea-bird wings at the sides, a black surcoat with a white tree emblem on the chest, a black cloak, black boots.' },
  saruman: { height: 1.9, prompt: 'A tall stern old wizard with very long straight white hair to his chest and a very long straight forked white beard down to his belt, cold dark eyes, long layered white robes with a pale shimmering sheen, a white mantle, white boots.' },
  butterbur: { height: 1.75, prompt: 'A fat jolly innkeeper with a bald head fringed with brown hair and bushy sideburns, rosy cheeks, a cream shirt with rolled sleeves, a brown waistcoat straining over his belly, a long white apron, brown trousers and boots.' },
  breeman: { height: 1.8, prompt: 'A rough village man in a muddy rainy town, shaggy dark hair and stubble, a brown woollen cloak over a faded tunic, a rope belt, patched trousers, worn boots.' },
  // the foes
  orc: { height: 1.7, prompt: 'A hunched snarling goblin-like orc warrior with greyish-green scarred skin, a bald lumpy head with a few lank black hairs, pointed ears, yellow eyes and jagged teeth, crude rusty black iron armour plates over ragged dark leather, rags, bare clawed feet.' },
  uruk: { height: 1.95, prompt: 'A huge muscular fighting orc with dark brown skin, long black matted hair, a white hand print painted across his face, black spiky iron armour on the shoulders and chest, a dark leather kilt, heavy black boots.' },
  easterling: { height: 1.85, prompt: 'A warrior from the east in ornate overlapping black-and-gold lacquered scale armour, a tall face-covering gold-and-black helmet with a mask, a long dark red tunic beneath, dark boots.' },
  goblin: { height: 1.3, prompt: 'A small wiry cave goblin with pale grey clammy skin, a big bald head with huge pointed ears and large pale eyes, a wide mouth of sharp teeth, scraps of dark rags and a few crude metal plates, bare clawed feet.' },
};
const POLY = 12000;
const MOST = 20000;
const TEX = 1024;

const key = process.env.MESHY_API_KEY;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
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
// ask for a task, waiting out a full queue (a plan only holds so many
// pending tasks; past that Meshy answers 429 until one finishes)
async function ask(path, body) {
  for (;;) {
    try {
      return (await api('POST', path, body)).result;
    } catch (e) {
      if (!/429/.test(e.message)) throw e;
      await sleep(15000);
    }
  }
}
const load = async () => (existsSync(TASKS) ? JSON.parse(await readFile(TASKS, 'utf8')) : {});
const save = (s) => writeFile(TASKS, `${JSON.stringify(s, null, 2)}\n`);

let io = null;
async function getIO() {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  return io;
}

// a rigged figure for the web: its own clips dropped (they ship beside
// it), brought down to a crowd's triangle budget, WebP maps, meshopt
async function squeeze(from, to) {
  const io = await getIO();
  const doc = await io.read(from);
  const root = doc.getRoot();
  for (const anim of root.listAnimations()) anim.dispose();
  await doc.transform(dedup(), prune());
  let before = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) before += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  if (before > MOST) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: MOST / before, error: 0.002 }), prune());
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  return { tris, hips: root.listNodes().some((n) => n.getName() === 'Hips') };
}
// a clip: its skeleton and motion, nothing to draw
async function squeezeClip(from, to) {
  const io = await getIO();
  const doc = await io.read(from);
  const root = doc.getRoot();
  for (const node of root.listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
  }
  for (const m of root.listMeshes()) m.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(dedup(), prune(), resample());
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
}

const steps = {
  async images(names, s) {
    // (all asked for, then waited on)
    for (const n of names) {
      s[n] ??= {};
      if (!s[n].image) {
        s[n].image = await ask('/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${ASSETS[n].prompt} ${LOOK} ${POSE}`, pose_mode: 'a-pose' });
        await save(s);
      }
    }
    for (const n of names) {
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(13)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    for (const n of names) {
      if (!s[n]?.image) throw new Error(`${n}: no image yet`);
      if (!s[n].model) {
        s[n].model = await ask('/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: POLY,
          texture_resolution: '2k',
          pose_mode: 'a-pose',
          target_formats: ['glb'],
          enable_thumbnail: true,
        });
        await save(s);
      }
    }
    const failed = [];
    for (const n of names) {
      try {
        const t = await wait('/v1/image-to-3d', s[n].model, `${n} model`);
        for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) if (url) await download(url, join(REVIEW, `${n}-${side}.png`));
        console.log(`model    ${n.padEnd(13)} ${t.consumed_credits} credits`);
      } catch (e) {
        console.log(`model    ${n.padEnd(13)} ${e.message}`);
        failed.push(n);
      }
    }
    if (failed.length) console.log(`failed   ${failed.join(', ')}`);
  },
  async rig(names, s) {
    for (const n of names) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      if (!s[n].rig) {
        s[n].rig = await ask('/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
        await save(s);
      }
    }
    for (const n of names) {
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(13)} ${t.consumed_credits} credits`);
    }
  },
  // an idle from Meshy's animation library (action 0), on the figure's own skeleton
  async idle(names, s) {
    for (const n of names) {
      if (!s[n]?.rig) throw new Error(`${n}: not rigged yet`);
      if (!s[n].idle) {
        s[n].idle = await ask('/v1/animations', { rig_task_id: s[n].rig, action_id: 0, post_process: { operation_type: 'extract_armature' } });
        await save(s);
      }
    }
    for (const n of names) {
      const t = await wait('/v1/animations', s[n].idle, `${n} idle`);
      console.log(`idle     ${n.padEnd(13)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    const raw = join(REVIEW, 'raw');
    for (const n of names) {
      if (!s[n]?.rig) {
        console.error(`! ${n}: not rigged yet`);
        continue;
      }
      const r = (await api('GET', `/v1/rigging/${s[n].rig}`)).result;
      const file = join(raw, `${n}.glb`);
      if (!existsSync(file)) await download(r.rigged_character_glb_url, file);
      const got = await squeeze(file, join(OUT, `${n}.glb`));
      if (!got.hips) throw new Error(`${n}: no Hips bone`);
      const clips = [
        ['walk', r.basic_animations?.walking_armature_glb_url],
        ['run', r.basic_animations?.running_armature_glb_url],
        ['idle', s[n].idle ? (await api('GET', `/v1/animations/${s[n].idle}`)).result?.animation_glb_url ?? null : null],
      ];
      for (const [c, url] of clips) {
        if (!url) continue;
        const f = join(raw, `${n}-${c}.glb`);
        if (!existsSync(f)) await download(url, f);
        await squeezeClip(f, join(OUT, `${n}-${c}.glb`));
      }
      console.log(`fetch    ${n.padEnd(13)} ${((await stat(join(OUT, `${n}.glb`))).size / 1e6).toFixed(2)} MB, ${got.tris} triangles, clips ${clips.filter(([, u]) => u).map(([c]) => c).join(' ')}`);
    }
  },
  async balance() {},
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in the environment.');
  const [step, ...only] = process.argv.slice(2);
  if (!steps[step]) throw new Error(`step: ${Object.keys(steps).join(' | ')}`);
  const names = only.length ? only : Object.keys(ASSETS);
  for (const n of names) if (!ASSETS[n]) throw new Error(`unknown figure ${n}`);
  const s = await load();
  await steps[step](names, s);
  const { balance } = await api('GET', '/v1/balance');
  console.log(`balance  ${balance} credits left`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
