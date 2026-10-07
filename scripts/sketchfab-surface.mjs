// Brings the galaxy's surface models into the site: what stands about on the
// worlds you land on (vaporators and banthas on Tatooine, AT-ATs and
// tauntauns on Hoth, Ewok huts and AT-STs on Endor…). Each is downloaded
// with the site owner's Sketchfab token (SKETCHFAB_API_TOKEN, never kept),
// cut down like the galaxy's ships (scripts/sketchfab-galaxy.mjs: its
// materials made metal-roughness, its parts that share a material merged,
// simplified to a triangle budget, its maps WebPs at a set size, the whole
// of it meshopt-compressed), and then set on the ground: turned upright and
// to face +z, scaled to its size in metres, and stood on y = 0 with the
// middle of its footprint at the origin, so a world places it with a
// position and a turn and nothing else. It's written to
// public/models/galaxy/surface/<kind>.glb, and who made it, its licence and
// where it came from go into src/data/modelCredits.json (as
// `surface-<kind>`), which the surface page and the galaxy's panel show.
//
// The models are listed by group, each group in a catalogue of its own
// (src/components/galaxy/surface/catalog/<group>.js, which the surface
// scene reads too), so the groups can be brought in apart:
//
//   SKETCHFAB_API_TOKEN=… NODE_USE_ENV_PROXY=1 node scripts/sketchfab-surface.mjs <group> [kind …]
//
// A catalogue entry: { uid, as, metres, along, yaw, up, tris, tex, maps,
// gain, drop, rig }:
//   uid     the Sketchfab model
//   as      what it is on the surface, for the credits ('the moisture vaporators')
//   metres  how big it is, along `along`: 'y' (how tall: the default), 'x'
//           (how wide), 'z' (how long) or 'max' (its longest side on the ground)
//   yaw     a turn about the vertical, radians, to bring its front round to
//           +z (after `up`)
//   up      'z' for a model made z-up (lying on its back as it comes), '-z'
//           for one lying on its front, 'x' / '-x' for one on its side
//   tris    triangles to keep; tex: its colour and glow maps' size (its other
//           maps half that, or `maps`); gain: its colours brightened; drop:
//           its materials to leave off, by name (a RegExp)
//   rig     true to keep its skeleton and animations (a figure that walks):
//           it isn't merged or baked, only simplified and compressed
//   pick    a RegExp on its parts' names: only those are kept (one piece of
//           a kitbash: a tower out of a whole town), stood up on its own
//
// --ultra (after the group): the ultra level's cut of each kind instead,
// <kind>.ultra.glb beside the plain one, from the same download: up to four
// times its tris and 8192 maps (or its entry's `ultra: { tris, tex }`;
// scripts/ultra/cut.mjs), under 24 MB. A download with fewer triangles than
// that keeps all of them. The credit already covers it; add the entry's
// `ultra` line the run prints.
//
// The downloads stay out of the repo, in /tmp/sketchfab-surface/ (fetched
// once, kept for the next run). Look at what came out on the model sheet
// (scripts/preview/surface.html, through the dev server).

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, flatten, join, meshopt, metalRough, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { bareWhereUntextured, dims, grounded, relit, simplified, triangles, unskinned } from './lib/surface-model.mjs';
import sharp from 'sharp';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join as path } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recolorDoc } from './recolor.mjs';
import { checkUltra, mapsOf, takeUltra, ultraName, ultraSpec } from './ultra/cut.mjs';

const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path(ROOT, 'public', 'models', 'galaxy', 'surface');
const CATALOG = path(ROOT, 'src', 'components', 'galaxy', 'surface', 'catalog');
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');
const CACHE = '/tmp/sketchfab-surface';
const API = 'https://api.sketchfab.com/v3/models';

const token = process.env.SKETCHFAB_API_TOKEN;
const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };

const json = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

// the download, fetched once
async function download(kind, uid) {
  const file = path(CACHE, `${kind}-${uid}.glb`);
  if (existsSync(file)) return file;
  // (fetched already for another kind: the pieces of one kitbash)
  const had = existsSync(CACHE) && readdirSync(CACHE).find((f) => f.endsWith(`-${uid}.glb`));
  if (had) return path(CACHE, had);
  if (!token) throw new Error('SKETCHFAB_API_TOKEN is not set');
  // (the download API is rate-limited: a 429 is waited out, a minute at a time)
  let glb;
  for (let tries = 0; ; tries++) {
    const r = await fetch(`${API}/${uid}/download`, { headers: { Authorization: `Token ${token}` } });
    if (r.ok) {
      ({ glb } = await r.json());
      break;
    }
    if (r.status !== 429 || tries >= 8) throw new Error(`${API}/${uid}/download: ${r.status}`);
    console.log(`${kind}: rate-limited, waiting a minute`);
    await new Promise((res) => setTimeout(res, 60000));
  }
  if (!glb?.url) throw new Error(`${kind}: no .glb to download`);
  const r = await fetch(glb.url);
  if (!r.ok) throw new Error(`${kind}: download ${r.status}`);
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

// who made it, from the model's public page
async function credit(kind, uid, as) {
  const m = await json(`${API}/${uid}`);
  const license = LICENCES[m.license?.slug];
  if (!license) throw new Error(`${kind}: its licence (${m.license?.label}) isn't one the site can use`);
  return {
    title: m.name,
    author: m.user.displayName || m.user.username,
    authorUrl: m.user.profileUrl,
    license,
    licenseUrl: m.license.url,
    source: m.viewerUrl,
    where: 'galaxy-surface',
    as,
    file: `/models/galaxy/surface/${kind}.glb`,
    also: ['galaxy'],
  };
}

async function bring(io, kind, spec, { ultra = false } = {}) {
  const src = await download(kind, spec.uid);
  const doc = await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const before = triangles(doc);
  // (lines and points: nothing a world shows)
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  // (one piece of a kitbash: the parts it's named by, the rest let go)
  if (spec.pick) for (const node of root.listNodes()) if (node.getMesh() && !spec.pick.test(node.getName())) node.setMesh(null);
  if (spec.rig) await doc.transform(dequantize(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld());
  else await doc.transform(dequantize(), unskinned(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  await doc.transform(simplified(spec.tris));
  await doc.transform(grounded(spec));
  // (a still model: its turn and scale baked into its parts)
  if (!spec.rig) await doc.transform(flatten());
  await doc.transform(dedup(), prune());
  // (its colours to the films', on its maps at the size they'll be)
  if (spec.recolor) {
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'png', slots: /baseColor/, resize: [spec.tex, spec.tex] }));
    for (const r of await recolorDoc(doc, spec.recolor)) console.log(`  recolor ${r.material}: ${r.from} → ${r.to}`);
  }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [spec.tex, spec.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [spec.maps ?? spec.tex / 2, spec.maps ?? spec.tex / 2], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = path(OUT, ultra ? ultraName(kind) : `${kind}.glb`);
  if (ultra) {
    const problems = checkUltra({ tris: spec.tris, after: triangles(doc), bytes: (await io.writeBinary(doc)).byteLength });
    if (problems.length) throw new Error(`${kind} (ultra): ${problems.join('; ')}`);
  }
  await io.write(out, doc);
  const draws = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  const bytes = (await stat(out)).size;
  const [w, h, l] = dims(doc);
  const clips = root.listAnimations().map((a) => a.getName() || '(unnamed)');
  console.log(
    `${kind.padEnd(14)} ${Math.round(before)} → ${Math.round(triangles(doc))} triangles, ${draws} draws, ${root.listTextures().length} maps, ${(bytes / 1024).toFixed(0)} KB;` +
      ` ${w.toFixed(1)} wide × ${h.toFixed(1)} tall × ${l.toFixed(1)} long (m)${clips.length ? `; clips: ${clips.join(', ')}` : ''}`,
  );
  // (the maps as they are in the file: the source's, where it had less than 8192)
  if (ultra) console.log(`${''.padEnd(14)} catalogue: ultra: { tris: ${Math.round(triangles(doc))}, tex: ${await mapsOf(doc)} }`);
}

async function main() {
  const { ultra, args } = takeUltra(process.argv.slice(2));
  const [group, ...only] = args;
  if (!group) throw new Error('which group? (node scripts/sketchfab-surface.mjs <group> [kind …])');
  const { MODELS } = await import(pathToFileURL(path(CATALOG, `${group}.js`)).href);
  for (const k of only) if (!MODELS[k]) throw new Error(`no ${k} in catalog/${group}.js`);
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  // (the credits are written after each model, so a run that stops short
  // keeps what it brought in; SKIP_DONE=1 leaves a model that's already in)
  for (const kind of only.length ? only : Object.keys(MODELS)) {
    const spec = MODELS[kind];
    if (ultra) {
      await bring(io, kind, ultraSpec(spec), { ultra });
      continue;
    }
    if (!(process.env.SKIP_DONE && existsSync(path(OUT, `${kind}.glb`)))) await bring(io, kind, spec);
    credits[`surface-${kind}`] = await credit(kind, spec.uid, spec.as);
    const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
    await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
