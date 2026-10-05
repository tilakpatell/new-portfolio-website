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
//
// The downloads stay out of the repo, in /tmp/sketchfab-surface/ (fetched
// once, kept for the next run). Look at what came out on the model sheet
// (scripts/preview/surface.html, through the dev server).

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, dequantize, flatten, join, meshopt, metalRough, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join as path } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  if (!token) throw new Error('SKETCHFAB_API_TOKEN is not set');
  const { glb } = await json(`${API}/${uid}/download`, { Authorization: `Token ${token}` });
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

const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// (4×4 matrices, column-major, as glTF keeps them)
const mul4 = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function invert4(m) {
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const inv3 = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const o = [inv3[0], inv3[1], inv3[2], 0, inv3[3], inv3[4], inv3[5], 0, inv3[6], inv3[7], inv3[8], 0, 0, 0, 0, 1];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * t[0] + o[4 + r] * t[1] + o[8 + r] * t[2]);
  return o;
}

// A model that never moves, held in a skeleton anyway: each skinned part
// baked as its bones hold it, back into its own node's frame, a plain mesh
// after (as scripts/sketchfab-galaxy.mjs does); its animations go too.
const unskinned = () => (doc) => {
  const root = doc.getRoot();
  // (the animations' samplers too: their keyframes would stay in the file)
  for (const a of root.listAnimations()) {
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  for (const node of root.listNodes()) {
    const skin = node.getSkin();
    if (!skin || !node.getMesh()) continue;
    const ibm = skin.getInverseBindMatrices();
    const back = invert4(node.getWorldMatrix());
    const bones = skin.listJoints().map((joint, i) => mul4(back, mul4(joint.getWorldMatrix(), ibm ? ibm.getElement(i, []) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])));
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      if (!joints || !weights) continue;
      const p = [];
      const n = [];
      const j = [];
      const w = [];
      const P = new Float32Array(pos.getCount() * 3);
      const N = nor ? new Float32Array(nor.getCount() * 3) : null;
      for (let v = 0; v < pos.getCount(); v++) {
        pos.getElement(v, p);
        if (nor) nor.getElement(v, n);
        joints.getElement(v, j);
        weights.getElement(v, w);
        const out = [0, 0, 0];
        const outN = [0, 0, 0];
        for (let k = 0; k < 4; k++) {
          if (!w[k]) continue;
          const m = bones[j[k]];
          for (let r = 0; r < 3; r++) {
            out[r] += w[k] * (m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
            if (nor) outN[r] += w[k] * (m[r] * n[0] + m[4 + r] * n[1] + m[8 + r] * n[2]);
          }
        }
        P.set(out, v * 3);
        if (nor) {
          const l = Math.hypot(...outN) || 1;
          N.set(outN.map((x) => x / l), v * 3);
        }
      }
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(pos.getBuffer()));
      if (nor) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(nor.getBuffer()));
      for (const name of prim.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(name)) prim.setAttribute(name, null);
    }
    node.setSkin(null);
  }
};

// Its materials made for daylight on a world: nothing more than half metal
// (a fully metal hull, with nothing round it to reflect, comes out black),
// its colours brightened by `gain`, and anything in `drop` left off.
const relit = ({ gain = 1, drop = null }) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (drop?.test(prim.getMaterial()?.getName() ?? '')) prim.dispose();
  for (const m of doc.getRoot().listMaterials()) {
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.5));
    const [r, g, b, a] = m.getBaseColorFactor();
    m.setBaseColorFactor([...[r, g, b].map((c) => Math.min(1, c * gain)), a]);
  }
};

// Parts with no maps don't need their UVs or tangents (so the simplifier can
// fold across what were seams).
const bareWhereUntextured = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      const mapped = m && [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].some(Boolean);
      for (const name of prim.listSemantics()) if (name === 'TANGENT' || (!mapped && name.startsWith('TEXCOORD_'))) prim.setAttribute(name, null);
    }
};

// The simplifier, each mesh its share of the budget, a step rougher each time
// it stops short (as scripts/sketchfab-galaxy.mjs does it).
const simplified = (tris) => (doc) => {
  const buffer = doc.getRoot().listBuffers()[0];
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getIndices());
  const all = prims.reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  if (all <= tris * 1.1) return;
  for (const prim of prims) {
    const positions = new Float32Array(prim.getAttribute('POSITION').getArray());
    let indices = new Uint32Array(prim.getIndices().getArray());
    const target = Math.max(3, Math.floor((indices.length * tris) / all / 3) * 3);
    const steps = [
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.01, ['Prune'])[0],
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.03, ['Prune', 'Permissive'])[0],
      (ix) => MeshoptSimplifier.simplifySloppy(ix, positions, 3, null, target, 0.02)[0],
    ];
    for (const step of steps) if (indices.length > target * 1.15) indices = step(indices);
    if (!indices.length) {
      prim.dispose();
      continue;
    }
    prim.setIndices(doc.createAccessor().setArray(indices).setBuffer(buffer));
    compactPrimitive(prim);
  }
};

// (quaternions, [x, y, z, w])
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const about = (axis, angle) => {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
};
const UP = {
  y: [0, 0, 0, 1],
  z: about([1, 0, 0], -Math.PI / 2), // its +z (up as made) to +y
  '-z': about([1, 0, 0], Math.PI / 2),
  x: about([0, 0, 1], Math.PI / 2), // its +x to +y
  '-x': about([0, 0, 1], -Math.PI / 2),
  '-y': about([1, 0, 0], Math.PI), // upside down
};

// Where the model is, as drawn: each part's corners through its node, or
// for a skinned part (whose node glTF ignores) through its bones as they
// hold it at rest.
function bounds(doc, scene) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const add = (x) => {
    for (let r = 0; r < 3; r++) {
      min[r] = Math.min(min[r], x[r]);
      max[r] = Math.max(max[r], x[r]);
    }
  };
  const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const skin = node.getSkin();
    const ibm = skin?.getInverseBindMatrices();
    const bones = skin?.listJoints().map((joint, i) => mul4(joint.getWorldMatrix(), ibm ? ibm.getElement(i, []) : id));
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      const p = [];
      const j = [];
      const w = [];
      // (every vertex of a small part, every few of a big one)
      const step = Math.max(1, Math.floor(pos.getCount() / 20000));
      for (let v = 0; v < pos.getCount(); v += step) {
        pos.getElement(v, p);
        if (!bones || !joints || !weights) {
          add(apply(world, p));
          continue;
        }
        joints.getElement(v, j);
        weights.getElement(v, w);
        const out = [0, 0, 0];
        for (let k = 0; k < 4; k++) if (w[k]) apply(bones[j[k]], p).forEach((c, r) => (out[r] += w[k] * c));
        add(out);
      }
    }
  });
  return { min, max };
}

// On the ground: everything in the scene under one node that turns it
// upright and round to face +z, scales it to `metres` along `along`, and
// stands it on y = 0 with the middle of its footprint at the origin.
const grounded = ({ metres, along = 'y', yaw = 0, up = 'y' }) => (doc) => {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  if (!UP[up]) throw new Error(`up: '${up}'? (y, z, -z, x, -x, -y)`);
  const ground = doc.createNode('ground');
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    ground.addChild(child);
  }
  scene.addChild(ground);
  ground.setRotation(qmul(about([0, 1, 0], yaw), UP[up]));
  const { min, max } = bounds(doc, scene);
  const size = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
  const measured = along === 'max' ? Math.max(size.x, size.z) : size[along];
  if (!(measured > 0)) throw new Error(`along: '${along}'? (y, x, z or max)`);
  const k = metres / measured;
  ground.setScale([k, k, k]);
  ground.setTranslation([(-k * (min[0] + max[0])) / 2, -k * min[1], (-k * (min[2] + max[2])) / 2]);
};

const dims = (doc) => {
  const root = doc.getRoot();
  const { min, max } = bounds(doc, root.getDefaultScene() ?? root.listScenes()[0]);
  return [0, 1, 2].map((i) => max[i] - min[i]);
};

async function bring(io, kind, spec) {
  const src = await download(kind, spec.uid);
  const doc = await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const before = triangles(doc);
  // (lines and points: nothing a world shows)
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  if (spec.rig) await doc.transform(dequantize(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld());
  else await doc.transform(dequantize(), unskinned(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  await doc.transform(simplified(spec.tris));
  await doc.transform(grounded(spec));
  // (a still model: its turn and scale baked into its parts)
  if (!spec.rig) await doc.transform(flatten());
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [spec.tex, spec.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [spec.maps ?? spec.tex / 2, spec.maps ?? spec.tex / 2], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = path(OUT, `${kind}.glb`);
  await io.write(out, doc);
  const draws = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  const bytes = (await stat(out)).size;
  const [w, h, l] = dims(doc);
  const clips = root.listAnimations().map((a) => a.getName() || '(unnamed)');
  console.log(
    `${kind.padEnd(14)} ${Math.round(before)} → ${Math.round(triangles(doc))} triangles, ${draws} draws, ${root.listTextures().length} maps, ${(bytes / 1024).toFixed(0)} KB;` +
      ` ${w.toFixed(1)} wide × ${h.toFixed(1)} tall × ${l.toFixed(1)} long (m)${clips.length ? `; clips: ${clips.join(', ')}` : ''}`,
  );
}

async function main() {
  const [group, ...only] = process.argv.slice(2);
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
  for (const kind of only.length ? only : Object.keys(MODELS)) {
    const spec = MODELS[kind];
    await bring(io, kind, spec);
    credits[`surface-${kind}`] = await credit(kind, spec.uid, spec.as);
  }
  const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
