// Bakes a skinned figure's clips into a vertex-animation texture (VAT), the
// file src/lib/three/vat.js's crowds read (loadVat, createVatCrowd): a
// thousand riders or citizens drawn as one instanced mesh, each its own
// clip and phase, and no mixer at runtime.
//
//   node scripts/vat-bake.mjs <body.glb> --clips own | <[name=]clip.glb[#Take]>,…
//        [--only Run,WalkSlow] [--fps 24] [--name <base>] [--out <dir>]
//
//   --clips  `own`: the body's own animations (--only keeps those named, in
//            the file's order); or clip GLBs, each one's first clip (or its
//            #Take), named by the file (`ual-drive`) or by `name=`; the two
//            mix (`own,ride=…/ual-drive.glb`)
//   --name   the files' base name (the body's own, else); --out their folder
//            (the body's, else)
//
// Out: `<name>.vat.bin`, the texture's Uint16 half floats little-endian, in
// vatLayout's order (a row a frame, three RGBA texels a bone, frame-major),
// and `<name>.vat.json` { bones, frames, fps, clips: { [name]: [start,
// length] }, names, bin }: `names` the bones in joint order, so a world can
// find, say, RightHand's index and carry a spear on it.
//
// How: three's GLTFLoader.parse in Node (as scripts/ual-bake.mjs does), with
// three's meshopt decoder (the kit's GLBs are compressed) and the body's
// images left out before parsing (nothing here draws, and Node has no image
// decoder for the loader). The skeleton is the first skinned mesh's (the
// GLB skin's joint order); a body whose other skinned meshes stand on other
// bones, or other bind matrices, is told so, since this one texture skins
// only the parts that share the first's. Each clip played alone on three's
// AnimationMixer and sampled at t = k / fps for k in [0, length),
// length = max(1, round(duration × fps)) (a loop: its end is its start
// again, and not stored); clips laid end to end. A bone's matrix in a frame
// is vat.js's
//
//   M_j = rootInverse × boneWorld_j × boneInverse_j × bindMatrix
//
// packed with its packSkinMatrix and halved with its toHalf (rounded to
// even; three's DataUtils truncates). A clip borrowed from a Meshy-skeleton
// file (public/games/meshy/ual-*.glb, act-*.glb) is retargeted as the site
// plays it: the very retarget() the clip library re-exports, imported from
// src/lib/three/retarget.js (which imports only three, so Node can load it):
// its turns kept and the hips' position scaled by the body's hips' height
// over the file's (no other position or scale). A texture over 4096 rows is
// refused.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RICK_HIPS, retarget } from '../src/lib/three/retarget.js';
import { packSkinMatrix, toHalf, vatLayout, vatTexel } from '../src/lib/three/vat.js';

const MAX_ROWS = 4096;

const fail = (msg) => {
  console.error(`vat-bake: ${msg}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const opt = (k, d = null) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const FLAGS = ['--clips', '--only', '--fps', '--name', '--out'];
const BODY = args.find((a, i) => !a.startsWith('--') && !FLAGS.includes(args[i - 1]));
if (!BODY || !opt('--clips')) fail('usage: node scripts/vat-bake.mjs <body.glb> --clips own|<[name=]clip.glb[#Take]>,… [--only A,B] [--fps 24] [--name base] [--out dir]');
const FPS = Number(opt('--fps', 24));
if (!(FPS > 0)) fail(`--fps ${opt('--fps')} is not a rate`);
const NAME = opt('--name') ?? basename(BODY).replace(/\.glb$/i, '');
const OUT = opt('--out') ?? dirname(resolve(BODY));
const ONLY = opt('--only')?.split(',').filter(Boolean) ?? null;

// A GLB with its images, textures and samplers taken out, and every
// material's reference to one: what the bake needs is bones and clips.
function withoutImages(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) return buf;
  const jsonLength = dv.getUint32(12, true);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
  if (!json.images?.length) return buf;
  for (const k of ['images', 'textures', 'samplers']) delete json[k];
  const strip = (o) => {
    for (const [k, v] of Object.entries(o ?? {})) if (v && typeof v === 'object') /Texture$/.test(k) ? delete o[k] : strip(v);
  };
  for (const m of json.materials ?? []) strip(m);
  const texture = (e) => /^(KHR|EXT)_texture_/.test(e);
  if (json.extensionsUsed) json.extensionsUsed = json.extensionsUsed.filter((e) => !texture(e));
  if (json.extensionsRequired) json.extensionsRequired = json.extensionsRequired.filter((e) => !texture(e));
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const rest = buf.subarray(20 + jsonLength);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, text, rest]);
}

async function loadGlb(file) {
  const buf = withoutImages(await readFile(file));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((ok, no) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', ok, no));
}

const hipsOf = (scene) => scene.getObjectByName('Hips')?.position.y ?? null;

const body = await loadGlb(BODY);
const scene = body.scene;
scene.updateMatrixWorld(true);
const skinned = [];
scene.traverse((o) => o.isSkinnedMesh && skinned.push(o));
if (!skinned.length) fail(`${BODY} has no skinned mesh`);
const mesh = skinned[0];
const { bones, boneInverses } = mesh.skeleton;
for (const other of skinned.slice(1)) {
  const same = other.skeleton.bones.length === bones.length && other.skeleton.bones.every((b, j) => b === bones[j]) && other.bindMatrix.equals(mesh.bindMatrix);
  if (!same) console.warn(`vat-bake: ${other.name || 'a skinned mesh'} stands on another skin or bind than ${mesh.name || 'the first'}; the texture skins the first's`);
}
const bodyHips = hipsOf(scene);

// the clips, in the order asked: [name, clip]
const clips = [];
for (const item of opt('--clips').split(',').filter(Boolean)) {
  if (item === 'own') {
    const own = ONLY ? body.animations.filter((c) => ONLY.includes(c.name)) : body.animations;
    for (const n of ONLY ?? []) if (!own.some((c) => c.name === n)) fail(`${BODY} has no clip ${n} (it has ${body.animations.map((c) => c.name).join(', ')})`);
    for (const c of own) clips.push([c.name, c]);
    continue;
  }
  const eq = item.indexOf('=');
  const [path, take] = (eq < 0 ? item : item.slice(eq + 1)).split('#');
  const name = eq < 0 ? basename(path).replace(/\.glb$/i, '') : item.slice(0, eq);
  const g = await loadGlb(path);
  const c = take ? g.animations.find((a) => a.name === take) : g.animations[0];
  if (!c) fail(`${path} has no clip${take ? ` ${take}` : ''}`);
  const from = hipsOf(g.scene) ?? RICK_HIPS;
  clips.push([name, retarget(c, bodyHips ?? from, from)]);
}
if (!clips.length) fail('no clips to bake');
if (new Set(clips.map(([n]) => n)).size !== clips.length) fail(`two clips share a name: ${clips.map(([n]) => n).join(', ')}`);

const lengths = clips.map(([, c]) => Math.max(1, Math.round(c.duration * FPS)));
const frames = lengths.reduce((a, b) => a + b, 0);
if (frames > MAX_ROWS) fail(`${frames} frames is taller than the ${MAX_ROWS} rows a texture may be (fewer clips, or a lower --fps)`);

const layout = vatLayout(bones.length, frames);
const floats = new Float32Array(layout.texels * 4);
const mixer = new THREE.AnimationMixer(scene);
const rootInverse = new THREE.Matrix4();
const m = new THREE.Matrix4();
const index = {};
let start = 0;
clips.forEach(([name, clip], ci) => {
  const length = lengths[ci];
  mixer.stopAllAction();
  mixer.clipAction(clip).play();
  for (let k = 0; k < length; k++) {
    mixer.setTime(k / FPS);
    scene.updateMatrixWorld(true);
    rootInverse.copy(scene.matrixWorld).invert();
    bones.forEach((bone, j) => {
      m.multiplyMatrices(rootInverse, bone.matrixWorld).multiply(boneInverses[j]).multiply(mesh.bindMatrix);
      packSkinMatrix(m.elements, floats, vatTexel(layout, j, start + k));
    });
  }
  mixer.uncacheClip(clip);
  index[name] = [start, length];
  start += length;
});

const bin = Buffer.alloc(floats.length * 2);
for (let i = 0; i < floats.length; i++) bin.writeUInt16LE(toHalf(floats[i]), i * 2);
const meta = { bones: bones.length, frames, fps: FPS, clips: index, names: bones.map((b) => b.name), bin: `${NAME}.vat.bin` };
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, meta.bin), bin);
await writeFile(join(OUT, `${NAME}.vat.json`), `${JSON.stringify(meta)}\n`);
console.log(`${meta.bin}: ${bin.length} bytes (${bones.length} bones × ${frames} frames at ${FPS} fps; ${clips.map(([n], i) => `${n} ${lengths[i]}`).join(', ')})`);
console.log(`${NAME}.vat.json → ${OUT}`);
