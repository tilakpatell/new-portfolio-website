// Makes the people of the galaxy's surfaces (src/components/universe) with
// Meshy (meshy.ai), the site owner's account: a concept image, a textured
// model from it and Meshy's humanoid skeleton, for walking about on the
// ground. They have no clips of their own: footScene.js's loadPartyFigure
// gives every figure with `src: { url }` Rick's idle, walk and run, the
// bones' turns and the hips' height (so the skeleton has to be Meshy's, with
// its `Hips`). The slug-like crime lord isn't a person: a model only, not
// rigged, standing still. Everything is compressed for the web into
// public/models/galaxy/crew/. The output is committed, so the site never
// calls Meshy.
//
//   node scripts/meshy-galaxy.mjs <step> [name …]
//
// Steps, in order: images (9 credits each), models (30), rig (5), fetch
// (free). Each task's id is kept in scripts/meshy-galaxy-tasks.json, so
// running a step again never pays twice; delete a name's entry there to
// make it again. MESHY_API_KEY comes from the environment; it is never
// printed. Concept images and thumbnails go to lab/meshy/galaxy (or
// MESHY_REVIEW), for looking at, not shipped.
//
// A person can also come from a Sketchfab model (an asset with a `uid`,
// which has no image or model step): `bake` (free; SKETCHFAB_API_TOKEN) is
// that model downloaded, its transforms baked in so it stands upright on y = 0
// facing +z, its maps JPEGs at 1024, no meshopt (Meshy can't read it), into
// <review>/in/<name>.glb; `rigurl` (5 credits) is that file sent to Meshy's
// rigger as a data: URI `model_url` (no public URL needed, nothing committed),
// whose task id goes where `rig`'s would, for `fetch` to take from there.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, getBounds, meshopt, prune, simplify, textureCompress, transformMesh, unweld, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mul4, unskinned } from './lib/surface-model.mjs';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'galaxy', 'crew');
const REVIEW = process.env.MESHY_REVIEW ?? join(ROOT, 'lab', 'meshy', 'galaxy');
const TASKS = join(ROOT, 'scripts', 'meshy-galaxy-tasks.json');
const CREDITS = join(ROOT, 'src', 'data', 'modelCredits.json');
const API = 'https://api.meshy.ai/openapi';

const LOOK = 'Semi-realistic 3D video-game character, realistic proportions, clean readable shapes.';
// for those the model step turned down as too like a film's own: softer
const SOFT = 'A stylized 3D animated feature film character, soft and appealing, realistic body proportions, clean readable shapes.';
const POSE = 'Full body, front view, standing straight in an A-pose with the arms held a little away from the body, empty hands, feet slightly apart. One figure only. Plain neutral grey background, no text, no shadow.';
const CREATURE = `${LOOK} Full body, three-quarter front view, the whole creature in frame. One figure only. Plain neutral grey background, no text, no shadow.`;

// height: metres (for the rig, and the still one's size); poly: target
// triangles; tex: texture size on the site; still: not rigged. Described by
// how they look, never by name: the image step turns names down, and the
// model step has turned down a concept that looked too much like a film's own
// (scripts/meshy-cockpit.mjs).
// uid: a Sketchfab model to rig instead of generating one (see `bake`); yaw:
// a turn about the vertical for one that comes facing sideways; sheet: its
// materials laid on one sheet before rigging (oneSheet); tex: its maps' size
// on the site; tris: the most triangles it keeps (MOST)
export const ASSETS = {
  luke: {
    uid: '84d5ed9497b5435b9a804f956ff74927',
    // (the prompt is for the Luke Meshy made, before this figure took his place:
    // a pilot in the films' kit, as the first concept, to the letter, was
    // turned down at the model step twice; its tasks are in the tasks file, as
    // `generatedRig`)
    height: 1.72,
    prompt:
      'A young adult starfighter pilot with short wavy light sandy hair and a clean-shaven friendly face, an orange flight jumpsuit with zipped pockets, a white ribbed padded vest, dark grey gloves, black flight boots and a grey belt with a holster on the right hip.',
  },
  leia: {
    uid: 'e5efdd35a5e4462cbc013db44e80d31e',
    height: 1.5,
  },
  han: {
    height: 1.85,
    prompt:
      'A roguish smuggler in his thirties, tousled brown hair, a white long-sleeved collarless shirt, an open black vest, dark navy-blue trousers with a thin red piping stripe down each outer seam, black knee-high boots, a brown gun belt with an empty holster strapped low on the right thigh.',
  },
  jabba: {
    height: 1.8,
    long: 3.9,
    still: true,
    prompt:
      'A huge slug-like alien crime lord, an enormous fat greenish-tan wrinkled glistening body ending in a long tapering tail curled behind, a wide toad-like face with orange slit-pupil eyes and a wide mouth, short stubby arms, resting upright on his belly and tail.',
  },
  mando: {
    soft: true,
    height: 1.85,
    prompt:
      'A lone armoured bounty hunter: polished silver steel armour plates on the chest, shoulders, forearms and shins over a dark grey-brown padded flight suit, a full-face rounded silver helmet with a T-shaped black visor, a brown hide cape hanging behind, a brown belt with ammo pouches.',
  },
  ahsoka: {
    height: 1.85,
    prompt:
      'An alien woman warrior with orange skin and white facial markings, tall blue-and-white striped head-tails: two horn-like montrals rising from the head and two long tails hanging down to the chest. A fitted grey-white tunic and leggings, a pale grey hooded cloak with the hood down, a belt with two short white sword hilts hanging at the hips.',
  },
  oldben: {
    soft: true,
    height: 1.82,
    prompt:
      'An old desert hermit monk with short white hair and a short white beard, layered cream and beige wrapped tunics, a long open brown robe over them, a belt with a silver cylindrical hilt hanging at the hip.',
  },
  greedo: {
    height: 1.73,
    prompt:
      'A green-skinned reptilian alien bounty hunter, large black glossy eyes, a short snout with small tendrils, a row of small spines on top of the bald head, a sleeveless olive vest over a dark tan jumpsuit, boots.',
  },
  gamorrean: {
    height: 1.8,
    prompt:
      'A huge bulky pig-faced green alien guard, a heavy warty green body with a big belly, small tusks and two small horns, a leather and fur loincloth and a leather chest harness, bare green arms, heavy boots.',
  },
  bobafett: {
    height: 1.83,
    prompt:
      'An armoured bounty hunter in a dented olive-green full-face helmet with a T-shaped black visor and a small rangefinder stalk on one side, a grey flight suit, olive-green chest armour, a big dull red armour plate on the right shoulder (and plain olive-green forearm gauntlets), a small jetpack on the back, a ragged brown cape over one shoulder.',
  },
  bith: {
    height: 1.8,
    prompt:
      'A tall thin alien jazz musician with an enormous oversized bulbous bald domed pinkish-tan head, much bigger than a human head, big glossy black eyes, no nose, heavy fleshy folds of wrinkled skin hanging at the cheeks and jaw, long thin fingers, wearing a black high-collared suit.',
  },
  // the worlds' people still built in code, made here from words (as Han
  // was): each described by how they look, never by name
  tusken: { height: 1.9, prompt: 'A desert nomad raider wrapped head to toe in layered sand-coloured cloth wrappings and bandages, a face mask with two round dark metal goggle eyes and a short metal breathing grille over the mouth, two small horn-like tubes on the head wraps, leather bandoliers and pouches across the chest, rough brown cloth robes to the shins, wrapped boots.' },
  lando: { height: 1.78, prompt: 'A suave dashing man in his thirties with dark brown skin and a neat moustache, short black hair, a pale blue high-collared shirt with a gold waist sash, dark navy trousers, a long flowing dark blue cape lined with pale yellow fabric over his shoulders, black boots.' },
  twilek: { height: 1.7, prompt: 'An alien woman with smooth light green skin, no hair, and two long thick tapering head-tails growing from the back of her head and hanging down past her shoulders, a dark brown leather spacer jacket over a sleeveless grey top, dark trousers and boots.' },
  ugnaught: { height: 1.05, prompt: 'A short stocky pig-nosed humanoid alien worker, pinkish wrinkled skin, a big upturned snout, bushy white side whiskers and a white beard, small dark eyes, faded blue denim work overalls with a tool belt, heavy boots.' },
  rebel: { height: 1.78, prompt: 'A rebel soldier in a khaki-tan uniform shirt and trousers, a grey padded vest, a dull grey round helmet with a short brim and ear flaps, a utility belt with pouches and an empty holster, black boots, clean-shaven.' },
  // (jedi and quigon: the first concepts were turned down at the model step
  // as too like the films' own, so softer, as Mando and Old Ben were)
  jedi: { soft: true, height: 1.75, prompt: 'An older knight-monk woman with dark brown skin and close-cropped grey hair, a calm lined face, layered cream tunics under a long open dark brown hooded robe with the hood down, a brown leather belt with pouches and a silver cylindrical hilt hanging at the hip, tall brown boots.' },
  senateguard: { height: 1.85, prompt: 'A ceremonial palace guard in long flowing deep royal-blue robes with a stiff high collar, a smooth glossy blue helmet with a narrow dark visor slit and a tall crest ridge on top, a long blue cape, blue gloves.' },
  lobot: { height: 1.75, prompt: 'A bald man with pale skin, a slim curved silver cybernetic band wrapped round the back of his head from ear to ear with small lights on it, a grey-blue high-collared tunic with a dark belt, grey trousers, black boots.' },
  neimoidian: { height: 1.9, prompt: 'A tall alien trade official with mottled grey-green skin, large red-orange eyes, a flat noseless face with a wide thin mouth, an ornate tall mitre-shaped headdress, long layered maroon and dark brown embroidered robes to the floor.' },
  bibfortuna: { height: 1.8, prompt: 'A pale thin alien majordomo with chalk-white wrinkled skin, small sharp pointed teeth, red-rimmed eyes, two long thick head-tails wrapped round his neck like a scarf, long dark brown and black flowing robes with a medallion on his chest, long clawed fingernails.' },
  aqualish: { height: 1.8, prompt: 'A tough alien thug with a walrus-like face, two downward-curving tusks from the mouth, small round black eyes, leathery brown skin and shaggy dark hair, a long dark green coat over a tunic, belt, boots.' },
  wuher: { height: 1.78, prompt: 'A grumpy heavyset bartender with short dark hair and stubble, a stained off-white collarless shirt with rolled-up sleeves under a brown leather apron, dark trousers, boots.' },
  mustafarian: { height: 2.0, prompt: 'A tall thin alien lava miner in a heavy insulated armoured suit of bronze and dark grey plates, a long-snouted insect-like head with a breathing mask and large dark eyes, thick gloves and heavy boots.' },
  // and the galaxy's who's who that nobody had made
  quigon: { soft: true, height: 1.93, prompt: 'A tall noble knight-monk in his fifties with long brown hair tied back and a short beard, layered tan and cream tunics, a long dark brown hooded robe with the hood down, a wide brown leather belt with a silver cylindrical hilt at the hip, tall boots.' },
  hondo: { height: 1.78, prompt: 'A flamboyant space pirate captain with leathery, deeply wrinkled tan alien skin and a wide grin, flight goggles pushed up on his forehead over a red headscarf, a long brown leather coat over a vest and sash, a belt with many pouches, boots.' },
  ackbar: { height: 1.8, prompt: 'An alien fleet admiral with a large salmon-pink bulbous fish-like head, huge round orange eyes on the sides of the head, small tendrils below the mouth, a white high-collared admiral uniform tunic with a small rank badge, dark trousers, boots.' },
  officer: { height: 1.8, prompt: 'A military officer with short neat hair in a crisp olive-grey high-collared double-breasted tunic with a small coloured rank badge plate on the chest, a matching flat-topped cap with a visor, a black belt, olive-grey jodhpur trousers and tall polished black boots.' },
  dooku: { height: 1.93, prompt: 'A tall elderly aristocratic swordsman with swept-back white hair and a neat short white beard, a dark brown high-collared tunic, a long black cape fastened with a silver chain clasp, dark trousers, tall black boots, a curved silver hilt at the hip.' },
  // The worlds' named people and the films' faces, from Sketchfab (each
  // author's mesh and maps, rigged here onto the crew's skeleton), for the
  // kinds the worlds built in code (crew.js) and for heroes to come:
  // Obi-Wan on Mustafar, Jango on Kamino, Shaak Ti, the Mandalorian, and
  // the rest of the galaxy's who's who. (Anakin, Krennic, Cassian, Chirrut
  // and Mace came out of the rigger broken, their arms-down poses bound to
  // their sides: they stand still instead, galaxy/surface/catalog/library.js.)
  obiwan: { uid: '416a8f0c9c1742ee8fd71274d27bc305', height: 1.82, as: 'Obi-Wan Kenobi', sheet: true, tex: 2048 },
  jango: { uid: '4ce40f867ff84df6bab5a3e060cb5e69', height: 1.83, as: 'Jango Fett' },
  shaak: { uid: '7af69133613e4035939b1bcc42a5d652', height: 1.88, as: 'Shaak Ti' },
  // (the Meshy one, above, was turned down at the model step: this is
  // somebody's model of him instead)
  dindjarin: { uid: '65383411ba6f4a56aac823d5d014df20', height: 1.85, as: 'the Mandalorian' },
  maul: { uid: '102ed10dfcd441029b4586bf4c88ec20', height: 1.75, as: 'Darth Maul' },
  palpatine: { uid: '8f6f188ba2ee4708aa277789c830cbb8', height: 1.73, as: 'Darth Sidious' },
  rex: { uid: '18a73ab03ac84cf49015559c522a2965', height: 1.83, as: 'Captain Rex' },
  bokatan: { uid: 'c1e33e1c34304b879a1c2fdb5ee4c8cd', height: 1.7, as: 'Bo-Katan Kryze' },
  vader: { uid: '62a4273131f949ed9559721f7fb9cf14', height: 2.02, as: 'Darth Vader' },
  fennec: { uid: 'bdf5d6140fde4c6bb8f265680bf8231f', height: 1.7, as: 'Fennec Shand' },
  caradune: { uid: '67940dad3a484fddb4d6d1127d233460', height: 1.78, as: 'Cara Dune' },
  greef: { uid: '6cc95642575445aca67733c4bffa2559', height: 1.85, as: 'Greef Karga' },
  rodian: { uid: 'ba7389be15774e7786b50d9ff839f51f', height: 1.7, as: 'the Rodians' },
  inquisitor: { uid: 'c3af0bd197f348c4a4819a45e78faa53', height: 1.85, as: 'the Inquisitors' },
  tiepilot: { uid: '33a466f49ff3496c8f76d3f4cb845e30', height: 1.8, as: 'the TIE pilots' },
};
const POLY = 16000;
// the most triangles a figure keeps (`tris` to change it)
const MOST = 30000;
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

let io = null;
async function getIO() {
  if (!io) {
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    await MeshoptSimplifier.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  }
  return io;
}

// For the web: no clips (the figure borrows Rick's), stood on y = 0 at the
// middle, the still one scaled to its height, textures to WebP at TEX
// pixels, geometry meshopt-compressed. Returns the triangles and size.
async function squeeze(from, to, a) {
  const io = await getIO();
  const doc = await io.read(from);
  const root = doc.getRoot();
  for (const anim of root.listAnimations()) anim.dispose();
  // a skinned figure stands as the rig left it, `height` tall on y = 0 (its
  // bounds here would be the unskinned mesh's); the still one is sized and
  // stood here, by its height
  let size = null;
  if (a.still) {
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    const b = getBounds(scene);
    const k = a.height / (b.max[1] - b.min[1]);
    size = b.max.map((v, i) => (v - b.min[i]) * k);
    const holder = doc.createNode('crew').setScale([k, k, k]).setTranslation([-((b.min[0] + b.max[0]) / 2) * k, -b.min[1] * k, -((b.min[2] + b.max[2]) / 2) * k]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      holder.addChild(child);
    }
    scene.addChild(holder);
  }
  await doc.transform(dedup(), prune());
  // (a figure from somebody's high-poly sculpt is brought down to a crowd's
  // budget: the simplifier only rewrites the indices, so the skin holds)
  let before = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) before += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const most = a.tris ?? MOST;
  if (before > most) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: most / before, error: 0.002 }), prune());
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [a.tex ?? TEX, a.tex ?? TEX] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await mkdir(dirname(to), { recursive: true });
  await io.write(to, doc);
  const bones = root.listNodes().filter((n) => n.getName() === 'Hips').length;
  return { tris, size, bones };
}

// the named ones that are made from a prompt, or from a Sketchfab model
// Meshy's rigger keeps one material and bakes the others onto it its own
// way, which can come out wrong (a face painted from the coat's map): a
// figure marked `sheet` has its materials laid on one sheet first, each
// colour map in a square of its own and its parts' UVs moved into that
// square (a flat material is a square of its colour).
async function oneSheet(doc, cell = TEX) {
  const root = doc.getRoot();
  await doc.transform(unweld());
  const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
  const mats = [...new Set(prims.map((p) => p.getMaterial()).filter(Boolean))];
  if (mats.length < 2) return;
  const cols = Math.ceil(Math.sqrt(mats.length));
  const rows = Math.ceil(mats.length / cols);
  const tiles = [];
  // (a map a few texels wide is a palette its UVs pick colours from, which
  // doesn't survive being stretched to a square: it's flat, its average)
  const flat = new Set();
  for (const [i, m] of mats.entries()) {
    const tex = m.getBaseColorTexture();
    const [r, g, b] = m.getBaseColorFactor();
    let img = tex ? sharp(Buffer.from(tex.getImage())) : null;
    if (tex && Math.max(...tex.getSize()) < 64) {
      // (averaged from the pixels as they show on white: stats() reads the
      // map before the flatten, so a see-through palette would come out black)
      const { data, info } = await img.flatten({ background: '#ffffff' }).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
      const [cr, cg, cb] = [0, 1, 2].map((c) => {
        let sum = 0;
        for (let k = c; k < data.length; k += info.channels) sum += data[k];
        return Math.round(sum / (data.length / info.channels));
      });
      img = sharp({ create: { width: cell, height: cell, channels: 3, background: { r: cr, g: cg, b: cb } } });
      flat.add(m);
    } else img = img ? img.resize(cell, cell, { fit: 'fill' }) : sharp({ create: { width: cell, height: cell, channels: 3, background: '#ffffff' } });
    // (a grey map made colour first: linear wants a band a factor; what
    // was see-through, a lace cape's holes, is white)
    const rgb = await img.flatten({ background: '#ffffff' }).toColourspace('srgb').png().toBuffer();
    tiles.push({ input: await sharp(rgb).linear([r, g, b], [0, 0, 0]).png().toBuffer(), left: (i % cols) * cell, top: Math.floor(i / cols) * cell });
  }
  const image = await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#808080' } }).composite(tiles).png().toBuffer();
  const material = doc.createMaterial('sheet').setBaseColorTexture(doc.createTexture('sheet').setImage(image).setMimeType('image/png')).setMetallicFactor(0).setRoughnessFactor(0.8);
  // (a texel in from each square's edge, so a mip level doesn't mix squares)
  const pad = 2 / cell;
  for (const prim of prims) {
    const i = mats.indexOf(prim.getMaterial());
    if (i < 0) continue;
    const uv = mats[i].getBaseColorTexture() && !flat.has(mats[i]) ? prim.getAttribute('TEXCOORD_0') : null;
    const count = prim.getAttribute('POSITION').getCount();
    const out = new Float32Array(count * 2);
    // (a triangle laid out a whole map over, at 1…2 say, a mirrored half,
    // is brought back to 0…1, each triangle on its own: the parts are
    // unwelded first; what's left past the edge is clamped)
    const tri = [[], [], []];
    // (a flat part's UVs spread over its square by where its corners are:
    // the rigger drops a part whose corners all share one UV)
    const pos = prim.getAttribute('POSITION');
    const lo = pos.getMin([]);
    const hi = pos.getMax([]);
    const spread = (k) => {
      const p = pos.getElement(k, []);
      return [0.1 + (0.8 * (p[0] - lo[0])) / (hi[0] - lo[0] || 1), 0.1 + (0.8 * (p[1] - lo[1])) / (hi[1] - lo[1] || 1)];
    };
    for (let k = 0; k < count; k += 3) {
      for (let c = 0; c < 3; c++) tri[c] = uv ? uv.getElement(k + c, []) : spread(k + c);
      const shift = [0, 1].map((j) => Math.floor(Math.min(tri[0][j], tri[1][j], tri[2][j]) + 1e-4));
      for (let c = 0; c < 3; c++) {
        const [u, v] = tri[c].map((x, j) => pad + Math.min(1, Math.max(0, x - shift[j])) * (1 - 2 * pad));
        out[(k + c) * 2] = ((i % cols) + u) / cols;
        out[(k + c) * 2 + 1] = (Math.floor(i / cols) + v) / rows;
      }
    }
    prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(out).setBuffer(root.listBuffers()[0]));
    prim.setMaterial(material);
  }
  await doc.transform(weld());
}

// who made a Sketchfab figure, from its public page, for
// src/data/modelCredits.json (as `crew-<name>`)
const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };
async function credit(n, a) {
  const r = await fetch(`https://api.sketchfab.com/v3/models/${a.uid}`);
  if (!r.ok) throw new Error(`${n}: sketchfab ${r.status}`);
  const m = await r.json();
  const license = LICENCES[m.license?.slug];
  if (!license) throw new Error(`${n}: its licence (${m.license?.label}) isn't one the site can use`);
  return {
    title: m.name,
    author: m.user.displayName || m.user.username,
    authorUrl: m.user.profileUrl,
    license,
    licenseUrl: m.license.url,
    source: m.viewerUrl,
    where: 'galaxy-surface',
    as: `${a.as ?? n}, walking on the worlds`,
    file: `/models/galaxy/crew/${n}.glb`,
    also: ['galaxy'],
    note: "The author's mesh and textures, rigged on a humanoid skeleton with Meshy (meshy.ai) so it can walk.",
  };
}

const made = (names) => names.filter((n) => !ASSETS[n].uid);
const fromSketchfab = (names) => names.filter((n) => ASSETS[n].uid);

const steps = {
  async images(names, s) {
    for (const n of made(names)) {
      s[n] ??= {};
      if (!s[n].image) {
        const a = ASSETS[n];
        const { result } = await api('POST', '/v1/text-to-image', { ai_model: 'nano-banana-pro', prompt: `${a.prompt} ${a.still ? CREATURE : `${a.soft ? SOFT : LOOK} ${POSE}`}`, ...(a.still ? {} : { pose_mode: 'a-pose' }) });
        s[n].image = result;
        await save(s);
      }
      const t = await wait('/v1/text-to-image', s[n].image, `${n} image`);
      await download(t.image_urls[0], join(REVIEW, `${n}.png`));
      console.log(`image    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async models(names, s) {
    // all asked for first, then waited on (they take minutes each)
    names = made(names);
    for (const n of names) {
      if (!s[n]?.image) throw new Error(`${n}: no image yet`);
      if (!s[n].model) {
        const a = ASSETS[n];
        const { result } = await api('POST', '/v1/image-to-3d', {
          input_task_id: s[n].image,
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: false,
          should_remesh: true,
          topology: 'triangle',
          target_polycount: POLY,
          texture_resolution: '2k',
          ...(a.still ? {} : { pose_mode: 'a-pose' }),
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
        // (turned down, most likely: delete its entry and remake the image)
        console.log(`model    ${n.padEnd(10)} ${e.message}`);
        failed.push(n);
        continue;
      }
      for (const [side, url] of Object.entries(t.thumbnail_urls ?? { front: t.thumbnail_url })) await download(url, join(REVIEW, `${n}-${side}.png`));
      console.log(`model    ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
    if (failed.length) console.log(`failed   ${failed.join(', ')}`);
  },
  async rig(names, s) {
    for (const n of made(names).filter((n) => !ASSETS[n].still)) {
      if (!s[n]?.model) throw new Error(`${n}: no model yet`);
      if (!s[n].rig) {
        const { result } = await api('POST', '/v1/rigging', { input_task_id: s[n].model, height_meters: ASSETS[n].height });
        s[n].rig = result;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rig      ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  // a Sketchfab model made ready for Meshy's rigger: upright, +z, on y = 0
  async bake(names) {
    for (const n of fromSketchfab(names)) {
      const token = process.env.SKETCHFAB_API_TOKEN;
      if (!token) throw new Error('Set SKETCHFAB_API_TOKEN in the environment.');
      const raw = join(REVIEW, 'in', `${n}-sketchfab.glb`);
      if (!existsSync(raw)) {
        // (the download API is rate-limited: a 429 is waited out, a minute at a time)
        for (let tries = 0; ; tries++) {
          const info = await fetch(`https://api.sketchfab.com/v3/models/${ASSETS[n].uid}/download`, { headers: { Authorization: `Token ${token}` } });
          if (info.ok) {
            await download((await info.json()).glb.url, raw);
            break;
          }
          if (info.status !== 429 || tries >= 8) throw new Error(`${n}: sketchfab download ${info.status}`);
          console.log(`${n}: rate-limited, waiting a minute`);
          await sleep(60000);
        }
      }
      const io = await getIO();
      const doc = await io.read(raw);
      // (a figure that came rigged is baked as its bones hold it, the way the
      // galaxy's ships are; lines and points go)
      for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
      // (Sketchfab's own -90 degree turn about x, and any others, into the vertices)
      await doc.transform(unskinned(), flatten());
      for (const node of doc.getRoot().listNodes()) {
        const mesh = node.getMesh();
        if (!mesh) continue;
        // (turned by `yaw` about the vertical, for one that comes facing sideways)
        const y = ASSETS[n].yaw ?? 0;
        const turn = [Math.cos(y), 0, -Math.sin(y), 0, 0, 1, 0, 0, Math.sin(y), 0, Math.cos(y), 0, 0, 0, 0, 1];
        transformMesh(mesh, y ? mul4(turn, node.getWorldMatrix()) : node.getWorldMatrix());
        node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      }
      if (ASSETS[n].sheet) await oneSheet(doc);
      // (only the first UV set: the rigger can read a second one instead)
      for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) for (const name of prim.listSemantics()) if (/^TEXCOORD_[1-9]/.test(name)) prim.setAttribute(name, null);
      await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [2 * TEX, 2 * TEX], quality: 92 }));
      const b = getBounds(doc.getRoot().listScenes()[0]);
      const out = join(REVIEW, 'in', `${n}.glb`);
      await mkdir(dirname(out), { recursive: true });
      await io.write(out, doc);
      console.log(`bake     ${n.padEnd(10)} ${((await stat(out)).size / 1e6).toFixed(2)} MB, ${(b.max[1] - b.min[1]).toFixed(3)} m tall, x ${b.min[0].toFixed(2)}…${b.max[0].toFixed(2)}, z ${b.min[2].toFixed(2)}…${b.max[2].toFixed(2)}`);
    }
  },
  async rigurl(names, s) {
    for (const n of fromSketchfab(names)) {
      s[n] ??= {};
      if (!s[n].rig) {
        const file = join(REVIEW, 'in', `${n}.glb`);
        if (!existsSync(file)) throw new Error(`${n}: bake it first`);
        const { balance } = await api('GET', '/v1/balance');
        if (balance < 5) throw new Error(`${n}: only ${balance} credits`);
        const model_url = `data:application/octet-stream;base64,${(await readFile(file)).toString('base64')}`;
        const { result } = await api('POST', '/v1/rigging', { model_url, height_meters: ASSETS[n].height });
        s[n].rig = result;
        s[n].source = `sketchfab:${ASSETS[n].uid}`;
        await save(s);
      }
      const t = await wait('/v1/rigging', s[n].rig, `${n} rig`);
      console.log(`rigurl   ${n.padEnd(10)} ${t.consumed_credits} credits`);
    }
  },
  async fetch(names, s) {
    const tmp = join(REVIEW, 'raw');
    const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
    for (const n of names) {
      const a = ASSETS[n];
      let url;
      if (a.still) {
        if (!s[n]?.model) throw new Error(`${n}: no model yet`);
        url = (await api('GET', `/v1/image-to-3d/${s[n].model}`)).model_urls.glb;
      } else {
        if (!s[n]?.rig) throw new Error(`${n}: not rigged yet`);
        url = (await api('GET', `/v1/rigging/${s[n].rig}`)).result.rigged_character_glb_url;
      }
      const raw = join(tmp, `${n}.glb`);
      const out = join(OUT, `${n}.glb`);
      await download(url, raw);
      const { tris, size, bones } = await squeeze(raw, out, a);
      if (!a.still && !bones) throw new Error(`${n}: no Hips bone`);
      if (a.uid) credits[`crew-${n}`] = await credit(n, a);
      const mb = (await stat(out)).size / 1e6;
      console.log(`fetch    ${n.padEnd(10)} ${mb.toFixed(2)} MB, ${tris} triangles, ${size ? `${size.map((v) => v.toFixed(2)).join(' × ')} m` : `${a.height} m, rigged`}`);
    }
    await rm(tmp, { recursive: true, force: true });
    const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
    await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
  },
};

async function main() {
  if (!key) throw new Error('Set MESHY_API_KEY in the environment.');
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
