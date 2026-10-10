// Brings a model from Star Wars Battlefront II (2005) into the galaxy's
// worlds: one of the remaster's (Harrisonfog's Battlefront 2 Remaster, used
// with its author's permission on this non-commercial fan site), or any
// other the owner holds the rights to. It takes the model as the mod tools
// have it (a ZeroEngine .msh with its .tga textures beside it: scripts/lib/
// msh.mjs and tga.mjs read them), or already converted (a .glb or .gltf,
// or an .fbx through scripts/fbx-to-glb.mjs and the dev server), cuts it
// down the way every surface model is (scripts/lib/surface-model.mjs: its
// materials made metal-roughness, simplified to a triangle budget, its maps
// WebPs at a set size, meshopt-compressed) and sets it on the ground
// (upright, facing +z, scaled to its size in metres, standing on y = 0).
// It's written to public/models/galaxy/surface/<kind>.glb; the catalogue
// line goes into src/components/galaxy/surface/catalog/battlefront.js and
// the credit into src/data/modelCredits.json (license 'permission', with
// the permission's wording), which the surface page and the galaxy's panel
// show.
//
//   node scripts/battlefront-import.mjs <model.msh|.glb|.gltf|.fbx> --kind <kind> --as '<what it is>'
//     [--metres 1.83] [--along y|x|z|max] [--yaw 0] [--up y|z|-z|x|-x|-y] [--mirror]
//     [--tris 8000] [--tex 1024] [--maps 512] [--textures <dir>] [--keep-v] [--rig]
//     [--title '…'] [--author 'Harrisonfog'] [--author-url …] [--source …] [--permission '…']
//
//   kind       the catalogue kind (a world's `life`, a battle's `kinds`): an
//              existing kind takes the model over from its Sketchfab or built
//              one (snowtrooper, hothtrooper, clone, battledroid…), a new one
//              is there to use
//   as         for the credits ('the snowtroopers')
//   metres     how big, along `along` ('y': tall, the default; 'x', 'z', 'max')
//   yaw, up    a turn to bring its front round to +z, and which way is up as
//              it comes (.msh files are y-up; a model that comes out lying
//              down wants --up z)
//   mirror     flip it left to right (a .msh whose handedness came out wrong:
//              check on the model sheet, scripts/preview/surface.html)
//   keep-v     leave the UVs' v as they are (.msh v is flipped by default:
//              glTF's image origin is the top left)
//   rig        keep its skeleton (a skinned model, posed later): the mesh is
//              kept as it comes, not merged or baked
//   textures   where its .tga files are, if not beside the .msh
//   title, author, author-url, source, permission: the credit (the remaster's by default)
//
// Look at what came out on the model sheet (scripts/preview/surface.html
// through the dev server), or node scripts/glb-shot.mjs public/models/galaxy/surface/<kind>.glb out.png.

import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, flatten, join, meshopt, metalRough, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join as path, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { bareWhereUntextured, dims, grounded, relit, simplified, triangles, unskinned } from './lib/surface-model.mjs';
import { mshLook, readMsh } from './lib/msh.mjs';
import { decodeTga } from './lib/tga.mjs';
import { parseArgs } from './lib/args.mjs';
import { writeCatalogueLine, writeCredit } from './lib/catalog-write.mjs';

// The sharp that glTF-Transform's ndarray-pixels loads (it brings its own
// version). Loading the project's as well puts two libvips in one process,
// and on Windows every texture then fails ("colourspace: parameter space not
// set"); with one, it doesn't.
const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path(ROOT, 'public', 'models', 'galaxy', 'surface');
const CATALOG = path(ROOT, 'src', 'components', 'galaxy', 'surface', 'catalog', 'battlefront.js');
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');
const REMASTER = {
  title: 'Battlefront 2 Remaster',
  author: 'Harrisonfog',
  authorUrl: 'https://www.moddb.com/members/harrisonfog',
  source: 'https://www.moddb.com/mods/hd-graphics-mod',
  permission: 'From Harrisonfog’s Battlefront 2 Remaster for Star Wars Battlefront II (2005), used with its author’s permission on this non-commercial fan site; Star Wars and everything in it belong to Lucasfilm.',
};
// parts of a .msh a world never shows: shadow volumes, collision, low-detail copies
const SKIP = /^(sv_|shadowvolume|collision|c_|p_)|lowre[sz]/i;

// ── a .msh as a glTF document ──
async function textureImage(name, dirs) {
  if (!name) return null;
  const want = basename(name).toLowerCase();
  for (const dir of dirs) {
    if (!dir || !existsSync(dir)) continue;
    const files = await readdir(dir);
    const hit = files.find((f) => f.toLowerCase() === want) ?? files.find((f) => f.toLowerCase() === want.replace(/\.tga$/, '.png'));
    if (!hit) continue;
    const file = path(dir, hit);
    if (/\.tga$/i.test(hit)) {
      const { width, height, data } = decodeTga(await readFile(file));
      const png = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels: 4 } }).png().toBuffer();
      return { png, alpha: data.some((v, i) => i % 4 === 3 && v < 255) };
    }
    return { png: await sharp(await readFile(file)).png().toBuffer(), alpha: false };
  }
  return null;
}

export async function mshToDocument(file, { textures = null, flipV = true, mirror = false, rig = false } = {}) {
  const msh = readMsh(await readFile(file));
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  const dirs = [textures, dirname(file), path(dirname(file), 'textures'), path(dirname(file), '..', 'textures')];
  // the materials, textures found beside the file
  const mats = [];
  for (const m of msh.materials) {
    const mat = doc.createMaterial(m.name).setMetallicFactor(0).setRoughnessFactor(0.85).setBaseColorFactor(m.diffuse);
    const look = mshLook(m.flags);
    const img = await textureImage(m.texture, dirs);
    if (img) {
      const tex = doc.createTexture(m.texture).setImage(img.png).setMimeType('image/png');
      mat.setBaseColorTexture(tex);
      // (its alpha only where the flags make it see-through: elsewhere it's the shine)
      if (img.alpha && look.alpha === 'MASK') mat.setAlphaMode('MASK').setAlphaCutoff(0.5);
      else if (img.alpha && look.alpha === 'BLEND') mat.setAlphaMode('BLEND');
      if (look.glow) mat.setEmissiveTexture(tex).setEmissiveFactor([1, 1, 1]);
    } else if (m.texture) console.log(`  (no ${m.texture} beside it: ${m.name} keeps its colour)`);
    if (look.doubleSided) mat.setDoubleSided(true);
    mats.push(mat);
  }
  // the models, as nodes under their parents: a node for each, as a name
  // can come twice (a skin split into parts, each `override_texture`, the
  // way the remaster's are); a parent is named, and the first of a name is it
  const nodes = msh.models.map((m) => doc.createNode(m.name).setTranslation(m.translation).setRotation(m.rotation).setScale(m.scale));
  const named = new Map();
  msh.models.forEach((m, i) => named.has(m.name) || named.set(m.name, nodes[i]));
  for (const [i, m] of msh.models.entries()) {
    const node = nodes[i];
    const parent = m.parent ? named.get(m.parent) : null;
    if (parent && parent !== node) parent.addChild(node);
    else scene.addChild(node);
    const drawn = !m.hidden && m.type !== 'shadow' && !SKIP.test(m.name) && m.segments.length;
    if (!drawn) continue;
    const mesh = doc.createMesh(m.name);
    for (const seg of m.segments) {
      const pos = new Float32Array(seg.positions);
      const nrm = seg.normals ? new Float32Array(seg.normals) : null;
      if (mirror) {
        for (let i = 0; i < pos.length; i += 3) pos[i] = -pos[i];
        if (nrm) for (let i = 0; i < nrm.length; i += 3) nrm[i] = -nrm[i];
      }
      const idx = new Uint32Array(seg.indices);
      if (mirror) for (let i = 0; i + 2 < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      const prim = doc.createPrimitive().setMaterial(mats[seg.material] ?? mats[0] ?? null);
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer));
      if (nrm && nrm.length === pos.length) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer));
      if (seg.uvs && seg.uvs.length === (pos.length / 3) * 2) {
        const uv = new Float32Array(seg.uvs);
        if (flipV) for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i];
        prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
      }
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer));
      mesh.addPrimitive(prim);
    }
    node.setMesh(mesh);
  }
  if (!rig) for (const [i, m] of msh.models.entries()) if (m.type === 'bone' && !nodes[i].getMesh() && !nodes[i].listChildren().length) nodes[i].dispose();
  return doc;
}

export async function importModel(file, opts) {
  const kind = opts.kind;
  if (!kind || !/^[a-z0-9]+$/.test(kind)) throw new Error('--kind: letters and digits, the catalogue’s way (snowtrooper, hothtrooper, clone…)');
  if (!opts.as) throw new Error('--as: what it is, for the credit (‘the snowtroopers’)');
  const spec = { metres: Number(opts.metres ?? 1.83), along: opts.along ?? 'y', yaw: Number(opts.yaw ?? 0), up: opts.up ?? 'y', tris: Number(opts.tris ?? 8000), tex: Number(opts.tex ?? 1024), maps: opts.maps ? Number(opts.maps) : undefined, rig: Boolean(opts.rig) };
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const ext = extname(file).toLowerCase();
  let doc;
  if (ext === '.msh') doc = await mshToDocument(file, { textures: opts.textures ? resolve(opts.textures) : null, flipV: !opts.keepV, mirror: Boolean(opts.mirror), rig: spec.rig });
  else if (ext === '.glb' || ext === '.gltf') doc = await io.read(file);
  else if (ext === '.fbx') {
    const { fbxToGlb } = await import('./fbx-to-glb.mjs');
    const tmp = path(tmpdir(), `${kind}-${Date.now()}.glb`);
    await fbxToGlb(file, tmp, {});
    doc = await io.read(tmp);
  } else throw new Error(`${file}: a .msh, .glb, .gltf or .fbx`);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const before = triangles(doc);
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  if (spec.rig) await doc.transform(dequantize(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld());
  else await doc.transform(dequantize(), unskinned(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  await doc.transform(simplified(spec.tris));
  await doc.transform(grounded(spec));
  if (!spec.rig) await doc.transform(flatten());
  await doc.transform(dedup(), prune());
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [spec.tex, spec.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [spec.maps ?? spec.tex / 2, spec.maps ?? spec.tex / 2], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await mkdir(OUT, { recursive: true });
  const out = path(OUT, `${kind}.glb`);
  await io.write(out, doc);
  const draws = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  const bytes = (await stat(out)).size;
  const [w, h, l] = dims(doc);
  console.log(`${kind.padEnd(14)} ${Math.round(before)} → ${Math.round(triangles(doc))} triangles, ${draws} draws, ${root.listTextures().length} maps, ${(bytes / 1024).toFixed(0)} KB; ${w.toFixed(1)} wide × ${h.toFixed(1)} tall × ${l.toFixed(1)} long (m)`);
  // (the model stands grounded in the file: the catalogue line asks for no more turning)
  const entry = { made: 'battlefront', as: opts.as, metres: spec.metres, along: spec.along, yaw: 0, tris: spec.tris, tex: spec.tex };
  if (spec.rig) entry.rig = true;
  await writeCatalogueLine(CATALOG, kind, entry);
  const title = opts.title ?? `${REMASTER.title}: ${basename(file, ext)}`;
  await writeCredit(CREDITS, `surface-${kind}`, { title, author: opts.author ?? REMASTER.author, authorUrl: opts.authorUrl ?? REMASTER.authorUrl, license: 'permission', licenseUrl: opts.source ?? REMASTER.source, source: opts.source ?? REMASTER.source, where: 'galaxy-surface', as: opts.as, file: `/models/galaxy/surface/${kind}.glb`, also: ['galaxy'], permission: opts.permission ?? REMASTER.permission });
  return { out, bytes, tris: Math.round(triangles(doc)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [file] = args._;
  if (!file) {
    console.error('usage: node scripts/battlefront-import.mjs <model.msh|.glb|.gltf|.fbx> --kind <kind> --as \'<what it is>\' [--metres 1.83] [--yaw 0] [--up y] [--mirror] [--tris 8000] [--tex 1024] [--textures <dir>] [--rig]');
    process.exit(1);
  }
  importModel(resolve(file), args).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
