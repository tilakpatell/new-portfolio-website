// Quaternius's CC0 Stylized Nature MegaKit as the galaxy's ground cover and
// far trees: ferns, clover, mushrooms, pebbles and grass under the forest
// worlds' trees, giant pines and dead trees as far silhouettes. One model
// from the kit's glTF folder (lab/assets/<pack>/glTF/, fetched by
// scripts/assets-fetch.mjs naturemega, or --repo naturemega) is cut down as
// the surface's Sketchfab models are (scripts/sketchfab-surface.mjs:
// metal-roughness, welded, joined, simplified, stood on y = 0 facing +z at
// its size in metres, WebP maps, meshopt) to
// public/models/galaxy/surface/<kind>.glb, and its catalogue row printed
// (catalog/quaternius.js). CC0: listed in public/cc0/README.md, no credit
// owed (scripts/credits.mjs names Quaternius all the same). --foliage
// makes its normals as lib/three/foliage.js makes the built plants':
// 'lift' (up, a lawn's) or 'crown' (out from its middle, a tree's), so no
// loader has to.
//
//   node scripts/quaternius-import.mjs <pack> <Model> --kind <kind> --metres <m>
//     [--along y|x|z|max] [--tex 512] [--tris 4000] [--foliage lift|crown] [--lod <tris>] [--from <file>]
//   --lod: a <kind>.lod1.glb beside it at that many triangles and half the map size, for far off (the row's lod: true)
//   node scripts/quaternius-import.mjs all      (the seven in QUATERNIUS)
//
//   specFor(args) → { pack, model, kind, metres, along, tex, tris, foliage, src } (pure)

import { fileURLToPath } from 'node:url';

// the galaxy's: kind → its arguments
export const QUATERNIUS = {
  qfern: ['naturemega', 'Fern_1', '--kind', 'qfern', '--metres', '1.6', '--along', 'max', '--foliage', 'lift'],
  qclover: ['naturemega', 'Clover_1', '--kind', 'qclover', '--metres', '0.25', '--foliage', 'lift'],
  qmushroom: ['naturemega', 'Mushroom_RedCap', '--kind', 'qmushroom', '--metres', '0.25'],
  qpebble: ['naturemega', 'Pebble_Round_1', '--kind', 'qpebble', '--metres', '0.3', '--along', 'max'],
  qgrass: ['naturemega', 'Grass_Common_Tall', '--kind', 'qgrass', '--metres', '0.6', '--foliage', 'lift'],
  qpine: ['naturemega', 'GiantPine_1', '--kind', 'qpine', '--metres', '42', '--foliage', 'crown', '--tris', '1500', '--lod', '400'],
  qdeadtree: ['naturemega', 'DeadTree_1', '--kind', 'qdeadtree', '--metres', '14', '--foliage', 'crown'],
};

export function specFor(args) {
  const [pack, model] = args;
  const opt = (k) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : null);
  const kind = opt('kind');
  if (!kind) throw new Error('--kind <kind> wanted');
  if (!/^q[a-z0-9]+$/.test(kind)) throw new Error(`kind "${kind}": a q, then lower-case letters and digits`);
  const metres = Number(opt('metres'));
  if (!(metres > 0)) throw new Error('--metres <m> wanted');
  return {
    pack,
    model,
    kind,
    metres,
    along: opt('along') ?? 'y',
    tex: Number(opt('tex') ?? 512),
    tris: Number(opt('tris') ?? 4000),
    foliage: opt('foliage'),
    lod: opt('lod') ? Number(opt('lod')) : null,
    src: opt('from') ?? `lab/assets/${pack}/glTF/${model}.gltf`,
  };
}

async function bring(spec, { lod = false } = {}) {
  // (the far copy's maps half the size too: past 60 m nobody reads them)
  const tex = lod ? spec.tex / 2 : spec.tex;
  const [{ NodeIO, Logger }, { ALL_EXTENSIONS }, f, { MeshoptDecoder, MeshoptEncoder }, sharp, sm, { stat }] = await Promise.all([
    import('@gltf-transform/core'),
    import('@gltf-transform/extensions'),
    import('@gltf-transform/functions'),
    import('meshoptimizer'),
    import('sharp').then((m) => m.default),
    import('./lib/surface-model.mjs'),
    import('node:fs/promises'),
  ]);
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(spec.src);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const before = sm.triangles(doc);
  await doc.transform(f.dequantize(), f.dedup(), f.metalRough(), f.prune(), sm.bareWhereUntextured(), f.weld(), f.flatten(), f.join({ keepNamed: false }), f.weld());
  await doc.transform(sm.simplified(lod ? spec.lod : spec.tris));
  await doc.transform(sm.grounded({ metres: spec.metres, along: spec.along, yaw: 0, up: 'y' }));
  await doc.transform(f.flatten());
  if (spec.foliage) await doc.transform(sm.lifted({ how: spec.foliage }));
  await doc.transform(f.dedup(), f.prune());
  await doc.transform(
    f.textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [tex, tex], quality: 82 }),
    f.textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness/, resize: [tex / 2, tex / 2], quality: 80 }),
    f.meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = `public/models/galaxy/surface/${spec.kind}${lod ? '.lod1' : ''}.glb`;
  await io.write(out, doc);
  const kb = (await stat(out)).size / 1024;
  const [w, h, l] = sm.dims(doc);
  console.log(`${spec.kind}: ${spec.model}, ${before} → ${sm.triangles(doc)} triangles, ${w.toFixed(2)} × ${h.toFixed(2)} × ${l.toFixed(2)} m, ${kb.toFixed(0)} KB → ${out}`);
  if (lod) return;
  console.log(`  ${spec.kind}: { made: 'quaternius', as: '…', metres: ${spec.metres}, along: '${spec.along}', tris: ${spec.tris}, tex: ${spec.tex}${spec.lod ? ', lod: true' : ''} },`);
  if (spec.lod) await bring(spec, { lod: true });
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'all') for (const a of Object.values(QUATERNIUS)) await bring(specFor(a));
  else await bring(specFor(args));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
