// Brings a model from the Star Wars Battlefront II (2017) drop into the
// galaxy's worlds (EA DICE's, used with permission on this non-commercial fan
// project: docs/decisions/2026-10-10-battlefront-2017-assets.md). It reads a
// model fetched by scripts/bf2017-fetch.mjs into lab/assets/bf2017/ by its
// manifest name and writes the site's files: the plain cut, and the light
// (`.lod1`) and ultra cuts where the model has them, each picked from the
// drop's own LOD chain rather than simplified (DICE already cut it at up to
// six levels: scripts/lib/bf2017-manifest.mjs). Its textures, which the
// GLBs name outside the file as KTX2, are found on disk as PNG (raw, or
// rebuilt from DICE's packing by the manifest's recipe) or unpacked from the
// KTX2, then made WebP at the site's sizes; the model is grounded (upright,
// facing +z, standing on y = 0, in metres) by scripts/lib/surface-model.mjs
// and meshopt-compressed, the way every surface model is. The catalogue row
// goes into src/components/galaxy/surface/catalog/bf2017.js and the credit
// into src/data/modelCredits.json; with --crew the file goes to
// galaxy/crew/ and the CREW row is printed instead.
//
//   node scripts/bf2017-import.mjs <manifest name> --kind <kind> --as '<what it is>'
//     [--root lab/assets/bf2017] [--metres <m> | --asis] [--along y|x|z|max] [--yaw <rad>] [--up y|z|-z|x|-x|-y]
//     [--rig] [--crew] [--hero] [--ultra] [--cuts lod1=<n>,plain=<n>,ultra=<n>] [--tex 1024] [--maps 512]
//     [--parts '<glob>,…'] [--grip <node>] [--out public/models/galaxy]
//
//   name       the model's `name` in the manifest (bf2017-fetch.mjs --list finds it)
//   kind       the catalogue kind: one already in another group is taken over
//   as         for the credit ('Luke’s lightsaber hilt')
//   metres     how big along `along` (y: tall); --asis (the default) keeps
//              the manifest's own height, which is right for everything sampled
//   rig        keep the skin and the whole 2017 rig as DICE made it (fingers,
//              face, cloth physics, weapon sockets, about 250 joints a
//              person), for a person or a beast to be posed and to take the
//              game's own clips; without it the model is a statue. Nothing
//              is pruned or renamed: the site learns the game's skeleton
//   crew       a person for crewList.js's CREW (galaxy/crew/<kind>.glb)
//   hero       the 4 MB file cap instead of 2.5 MB
//   ultra      an .ultra.glb from LOD0, at 2048 colour and 1024 maps
//   cuts       which LODs, by number, instead of the triangle budgets
//              (light ≤ 2,500; plain ≤ 12,000, or 8,000 with --rig)
//   tex, maps  the colour and other maps' size (the light cut takes half)
//   parts      globs over the model's folder for the parts that go with it,
//              or full manifest names from any folder (a hero's head and hair)
//              ('*_cape_mesh,*_hands_mesh'), each at the same LOD, one file
//   grip       the node the site holds it by (by default Wep_Root, the
//              game's weapon socket, on a rig in the right hand; a rig
//              without one falls back to IK_Joint_RightHand): a `grip` node
//              is put there, under it on a rig so DICE's own names all stay;
//              without either, at the model's own origin, which is DICE's hold
//
// It refuses the sequel era (the site shows none of it). Look at what came
// out with node scripts/glb-shot.mjs <file> out.png three, through the dev
// server (npx vite --port 5188 --strictPort --host 127.0.0.1).

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, flatten, join, mergeDocuments, meshopt, metalRough, prune, textureCompress, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join as path, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { isSequel, cutsFor, partsOf, readManifest } from './lib/bf2017-manifest.mjs';
import { glbJson, imagePath, inBucket, localPath } from './lib/bf2017-paths.mjs';
import { resolveImage } from './lib/bf2017-textures.mjs';
import { writeCatalogueLine, writeCredit } from './lib/catalog-write.mjs';
import { shareSkins } from './lib/rig-parts.mjs';
import { bareWhereUntextured, dims, grounded, relit, simplified, triangles, unskinned } from './lib/surface-model.mjs';

// (the sharp glTF-Transform's ndarray-pixels loads: see battlefront-import.mjs)
const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
export const PERMISSION = 'From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.';
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';
const MISSING = '__missing';
const SLOTS = ['BaseColor', 'Normal', 'Occlusion', 'MetallicRoughness', 'Emissive'];

// ── one LOD's GLB as a document, its textures found on disk ──

// The GLB's JSON is rewritten before it is read: each image points at the
// PNG found for it (or, when none is there, a placeholder whose texture is
// taken off the material after), and the textures' KHR_texture_basisu
// source becomes their plain source, so glTF-Transform never goes looking
// for a KTX2 itself.
async function readLod(io, file, { root, derived, unpackDir, said }) {
  const glb = await readFile(localPath(root, inBucket(file)));
  // (the GLB read by hand: glTF-Transform's own reader will not open one whose
  // images are outside it; chunk 0 is the JSON, chunk 1 the binary buffer)
  const json = glbJson(glb);
  const at0 = 20 + glb.readUInt32LE(12);
  const resources = { '@glb.bin': new Uint8Array(glb.buffer, glb.byteOffset + at0 + 8, glb.readUInt32LE(at0)) };
  for (const [i, img] of (json.images ?? []).entries()) {
    const at = imagePath(img.uri, inBucket(file));
    if (!at) continue;
    const found = await resolveImage(at, { root, derived, unpackDir });
    const uri = `image${i}.png`;
    if (found) {
      resources[uri] = new Uint8Array(found.png);
      said.found.add(`${at.split('/').pop()} ← ${found.from}`);
    } else {
      resources[uri] = new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 3, background: '#808080' } }).png().toBuffer());
      img.name = MISSING;
      said.missing.add(at);
    }
    img.uri = uri;
    img.mimeType = 'image/png';
  }
  for (const tex of json.textures ?? []) {
    const basisu = tex.extensions?.KHR_texture_basisu;
    if (!basisu) continue;
    tex.source ??= basisu.source;
    delete tex.extensions.KHR_texture_basisu;
  }
  for (const key of ['extensionsUsed', 'extensionsRequired']) if (json[key]) json[key] = json[key].filter((e) => e !== 'KHR_texture_basisu');
  const doc = await io.readJSON({ json, resources });
  // a map not there yet: the material goes without it rather than wear grey
  for (const m of doc.getRoot().listMaterials()) {
    for (const slot of SLOTS) if (m[`get${slot}Texture`]()?.getName() === MISSING) m[`set${slot}Texture`](null);
    // (Frostbite's shader preset and source maps: nothing the site reads)
    m.setExtras({});
  }
  for (const t of doc.getRoot().listTextures()) if (t.getName() === MISSING) t.dispose();
  return doc;
}

// A model and its parts, each at the same LOD (or a part's nearest), as one
// document with one scene; parts on the body's skeleton share its skin.
async function readCut(io, entry, parts, lod, opts) {
  const doc = await readLod(io, lod.file, { ...opts, derived: entry.derived });
  for (const part of parts) {
    const pl = part.lods.find((l) => l.lod === lod.lod) ?? part.lods[part.lods.length - 1];
    mergeDocuments(doc, await readLod(io, pl.file, { ...opts, derived: part.derived }));
  }
  const [scene, ...more] = doc.getRoot().listScenes();
  for (const s of more) {
    for (const child of s.listChildren()) scene.addChild(child);
    s.dispose();
  }
  doc.getRoot().setDefaultScene(scene);
  if (parts.length) {
    await doc.transform(unpartition());
    if (opts.rig) shareSkins(doc, { log: (l) => console.log(`  ${l} (LOD${lod.lod})`) });
  }
  return doc;
}

const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);

// ── one cut, through the pipeline, to a file ──

async function makeCut(io, entry, parts, lod, spec, out) {
  const doc = await readCut(io, entry, parts, lod, spec);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const budget = lod.triangles + parts.reduce((n, p) => n + (p.lods.find((l) => l.lod === lod.lod) ?? p.lods[p.lods.length - 1]).triangles, 0);
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  // where it is held, in the model's own frame, before anything moves
  const socket = spec.grip.map((g) => root.listNodes().find((n) => n.getName() === g)).find(Boolean);
  const hold = socket ? socket.getWorldTranslation() : [0, 0, 0];
  if (spec.rig) await doc.transform(dequantize(), dedup(), metalRough(), relit({}), prune(), bareWhereUntextured(), weld());
  else await doc.transform(dequantize(), unskinned(), dedup(), metalRough(), relit({}), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  // (the cut is the file, so this is only for parts that overshoot it)
  if (triangles(doc) > budget * 1.1) {
    console.log(`  ${Math.round(triangles(doc))} triangles against the cut's ${budget}: simplified`);
    await doc.transform(simplified(budget));
  }
  await doc.transform(grounded(spec));
  const ground = root.listNodes().find((n) => n.getName() === 'ground');
  const gripAt = apply(ground.getMatrix(), hold);
  if (!spec.rig) await doc.transform(flatten());
  await doc.transform(dedup(), prune());
  // (on a rig, a child of the socket, so it moves with the hand and the
  // socket keeps its name for the game's clips)
  const held = spec.rig && socket && root.listNodes().includes(socket) ? socket : null;
  if (held) held.addChild(doc.createNode('grip'));
  else root.getDefaultScene().addChild(doc.createNode('grip').setTranslation(gripAt));
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [spec.tex, spec.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [spec.maps, spec.maps], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await mkdir(dirname(out), { recursive: true });
  await io.write(out, doc);
  const bytes = (await stat(out)).size;
  const [w, h, l] = dims(doc);
  return { out, bytes, tris: Math.round(triangles(doc)), draws: root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0), maps: root.listTextures().length, size: [w, h, l], socket: socket?.getName() ?? null, joints: root.listSkins().reduce((n, s) => n + s.listJoints().length, 0) };
}

// ── the arguments ──

function cutsOf(entry, opts, rig) {
  const cuts = cutsFor(entry, { plainMax: rig ? 8000 : 12000, ultra: Boolean(opts.ultra) });
  if (typeof opts.cuts === 'string')
    for (const part of opts.cuts.split(',')) {
      const [name, n] = part.split('=');
      if (!['lod1', 'plain', 'ultra'].includes(name)) throw new Error(`--cuts: ${name}? (lod1, plain, ultra)`);
      const lod = entry.lods.find((l) => l.lod === Number(n));
      if (!lod) throw new Error(`--cuts: ${entry.name} has no LOD ${n} (it has ${entry.lods.map((l) => l.lod).join(', ')})`);
      cuts[name] = lod;
    }
  return cuts;
}

export async function importModel(name, opts) {
  const kind = opts.kind;
  if (!kind || !/^[a-z0-9]+$/.test(kind)) throw new Error('--kind: letters and digits, the catalogue’s way (hiltluke, vader…)');
  if (!opts.as) throw new Error('--as: what it is, for the credit (‘Luke’s lightsaber hilt’)');
  const root = resolve(opts.root ?? path(ROOT, 'lab', 'assets', 'bf2017'));
  const manifestFile = localPath(root, 'web/models.jsonl');
  if (!existsSync(manifestFile)) throw new Error(`no manifest at ${manifestFile}: node --env-file=.env.local scripts/bf2017-fetch.mjs manifest`);
  const manifest = readManifest(await readFile(manifestFile, 'utf8'));
  const entry = manifest.get(name);
  if (!entry) throw new Error(`${name}: not in the manifest (node scripts/bf2017-fetch.mjs --list '<glob>')`);
  const rig = Boolean(opts.rig);
  const parts = typeof opts.parts === 'string' ? partsOf(manifest, name, opts.parts.split(',')).filter((p) => !isSequel(p.name)) : [];
  const metres = opts.metres !== undefined && opts.metres !== true ? Number(opts.metres) : Number((entry.max[1] - entry.min[1]).toFixed(3));
  const tex = Number(opts.tex ?? 1024);
  const maps = Number(opts.maps ?? tex / 2);
  const spec = {
    root,
    unpackDir: resolve(opts.unpacked ?? path(root, 'unpacked')),
    metres,
    along: opts.along ?? 'y',
    yaw: Number(opts.yaw ?? 0),
    up: opts.up ?? 'y',
    rig,
    grip: typeof opts.grip === 'string' ? [opts.grip] : rig ? ['Wep_Root', 'IK_Joint_RightHand'] : ['Wep_Root'],
    said: { found: new Set(), missing: new Set() },
  };
  const cuts = cutsOf(entry, opts, rig);
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const outRoot = resolve(opts.out ?? path(ROOT, 'public', 'models', 'galaxy'));
  const dir = path(outRoot, opts.crew ? 'crew' : 'surface');
  const made = [];
  const plain = await makeCut(io, entry, parts, cuts.plain, { ...spec, tex, maps }, path(dir, `${kind}.glb`));
  made.push(['plain', cuts.plain, plain]);
  let lod = false;
  if (cuts.lod1) {
    const light = await makeCut(io, entry, parts, cuts.lod1, { ...spec, tex: tex / 2, maps: maps / 2 }, path(dir, `${kind}.lod1.glb`));
    if (light.bytes < 0.7 * plain.bytes) {
      made.push(['lod1', cuts.lod1, light]);
      lod = true;
    } else {
      await unlink(light.out);
      console.log(`  no .lod1: LOD${cuts.lod1.lod} came to ${light.bytes} bytes, not under 0.7 × the plain file's ${plain.bytes}`);
    }
  } else console.log('  no .lod1: the chain has no cut light enough below the plain one');
  let ultra = null;
  if (cuts.ultra) {
    const u = await makeCut(io, entry, parts, cuts.ultra, { ...spec, tex: 2048, maps: 1024 }, path(dir, `${kind}.ultra.glb`));
    made.push(['ultra', cuts.ultra, u]);
    ultra = { tris: u.tris, tex: 2048 };
  }
  for (const f of spec.said.found) console.log(`  map ${f}`);
  for (const f of spec.said.missing) console.log(`  missing: ${f}`);
  if (!plain.socket) console.log(`  (no ${spec.grip.join(' or ')} in the file: grip made at the model's own origin)`);
  else console.log(`  grip at ${plain.socket}`);
  if (rig) console.log(`  rig kept whole: ${plain.joints} joints`);
  for (const [cut, l, r] of made) {
    const [w, h, d] = r.size;
    console.log(`${relative(ROOT, r.out).padEnd(48)} ${cut.padEnd(5)} LOD${l.lod}  ${r.tris} triangles, ${r.draws} draws, ${r.maps} maps, ${(r.bytes / 1024).toFixed(1)} KB; ${w.toFixed(2)} wide × ${h.toFixed(2)} tall × ${d.toFixed(2)} long (m)`);
  }
  const file = `/models/galaxy/${opts.crew ? 'crew' : 'surface'}/${kind}.glb`;
  if (opts.crew) console.log(`the CREW row (src/components/galaxy/crewList.js):\n  ${kind}: { name: '${kind}', tall: ${metres} },`);
  else {
    const row = { made: 'bf2017', as: opts.as, metres, along: spec.along, yaw: 0, tris: cuts.plain.triangles, tex };
    if (rig) row.rig = true;
    if (opts.hero) row.hero = true;
    if (lod) row.lod = true;
    if (ultra) row.ultra = ultra;
    row.from = name;
    await writeCatalogueLine(resolve(opts.catalog ?? path(ROOT, 'src', 'components', 'galaxy', 'surface', 'catalog', 'bf2017.js')), kind, row);
  }
  await writeCredit(resolve(opts.credits ?? path(ROOT, 'src', 'data', 'modelCredits.json')), `surface-${kind}`, {
    title: `Star Wars Battlefront II (2017): ${name}`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    where: 'galaxy-surface',
    as: opts.as,
    file,
    also: ['galaxy'],
    permission: PERMISSION,
  });
  console.log(`next: node scripts/glb-shot.mjs ${relative(ROOT, plain.out)} /tmp/${kind}.png three   (with npx vite --port 5188 --strictPort --host 127.0.0.1 running)`);
  return made;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [name] = args._;
  if (!name) {
    console.error("usage: node scripts/bf2017-import.mjs <manifest name> --kind <kind> --as '<what it is>' [--asis | --metres <m>] [--rig] [--crew] [--hero] [--ultra] [--tex 1024] [--maps 512] [--parts '<glob>,…']");
    process.exit(1);
  }
  if (isSequel(name)) {
    console.error(`${name} is sequel-era; the site shows none of it (autopilot rules)`);
    process.exit(2);
  }
  importModel(name, args).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
