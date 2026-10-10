// A kit from the Star Wars Battlefront II (2017) drop (EA DICE's, used with
// permission on this non-commercial fan project: docs/decisions/2026-10-10-
// battlefront-2017-assets.md): the pieces of one of a level's modular
// systems, fetched by scripts/bf2017-fetch.mjs into lab/assets/bf2017/, in
// one file the world lays the pieces from (scripts/lib/bf2017-kit.mjs has
// how they are kept: one node a piece, by name, at the game's own origin;
// the pieces' parts joined by material, the materials shared). Unlike a
// surface model, a piece is not grounded or turned: its origin is the
// corner its grid is laid from (src/components/galaxy/surface/kitGrid.js).
// Textures as bf2017-import.mjs makes them (WebP, colour at --tex, the
// rest at --maps); a piece whose maps the drop has not got wears none, and
// the world dresses it in its own look.
//
//   node scripts/bf2017-kit.mjs <kit> --pieces '<glob>,…' --as '<what it is>'
//     [--world hoth] [--lod 1] [--tex 1024] [--maps 512] [--root lab/assets/bf2017]
//
//   kit      the kit's name, letters and digits (hothhangar): the file is
//            public/models/galaxy/kits/<kit>.glb, its row in
//            src/components/galaxy/surface/catalog/bf2017-<world>.js's KITS
//   pieces   globs over manifest names ('objects/architecture/hoth/
//            hangarsystem_01/new/hangarlarge*'); sequel-era ones refused
//   lod      which of each piece's cuts (its last where it has fewer)
//
// Fetch first, the pieces' GLBs and their textures at that LOD:
//   node scripts/bf2017-fetch.mjs <name> --lod 1   (a piece at a time; --list finds them)

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, meshopt, metalRough, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { isSequel, readManifest } from './lib/bf2017-manifest.mjs';
import { inBucket, localPath } from './lib/bf2017-paths.mjs';
import { kitIndex, mergeKit } from './lib/bf2017-kit.mjs';
import { writeCatalogueLine, writeCredit } from './lib/catalog-write.mjs';
import { bareWhereUntextured, relit, triangles, unskinned } from './lib/surface-model.mjs';
import { PERMISSION, readLod } from './bf2017-import.mjs';
import { pieceName } from '../src/components/galaxy/surface/kitGrid.js';

const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';

const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

export async function makeKit(kit, opts) {
  if (!/^[a-z0-9]+$/.test(kit ?? '')) throw new Error('the kit’s name: letters and digits (hothhangar)');
  if (typeof opts.pieces !== 'string') throw new Error("--pieces '<glob>,…'");
  if (!opts.as) throw new Error('--as: what it is, for the credit');
  const root = resolve(opts.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  const manifest = readManifest(await readFile(localPath(root, 'web/models.jsonl'), 'utf8'));
  const globs = opts.pieces.split(',').map(globRe);
  const names = [...manifest.keys()].filter((n) => globs.some((g) => g.test(n)));
  const refused = names.filter(isSequel);
  for (const n of refused) console.log(`  refused (sequel-era): ${n}`);
  const wanted = names.filter((n) => !isSequel(n));
  if (!wanted.length) throw new Error(`no pieces under ${opts.pieces}`);
  const lod = Number(opts.lod ?? 1);
  const tex = Number(opts.tex ?? 1024);
  const maps = Number(opts.maps ?? tex / 2);
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const said = { found: new Set(), missing: new Set() };
  const pieces = [];
  for (const name of wanted) {
    const entry = manifest.get(name);
    const cut = entry.lods.find((l) => l.lod === lod) ?? entry.lods[entry.lods.length - 1];
    if (!existsSync(localPath(root, inBucket(cut.file)))) {
      console.log(`  not fetched: ${name} LOD${cut.lod} (node scripts/bf2017-fetch.mjs ${name} --lod ${cut.lod})`);
      continue;
    }
    const doc = await readLod(io, cut.file, { root, derived: entry.derived, unpackDir: resolve(opts.unpacked ?? join(root, 'unpacked')), said });
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
    await doc.transform(dequantize(), unskinned(), metalRough(), relit({}), prune(), bareWhereUntextured(), weld());
    pieces.push({ name: pieceName(name), doc, lod: cut.lod });
  }
  const doc = await mergeKit(pieces);
  const index = kitIndex(doc);
  await doc.transform(
    dedup({ keepUniqueNames: true }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [tex, tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness/, resize: [maps, maps], quality: 80 }),
    prune({ keepLeaves: true }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = resolve(opts.out ?? join(ROOT, 'public', 'models', 'galaxy', 'kits', `${kit}.glb`));
  await mkdir(dirname(out), { recursive: true });
  await io.write(out, doc);
  const bytes = (await stat(out)).size;
  const r = doc.getRoot();
  for (const f of said.found) console.log(`  map ${f}`);
  for (const f of said.missing) console.log(`  missing: ${f}`);
  console.log(`${relative(ROOT, out)}  ${pieces.length} pieces, ${Math.round(triangles(doc))} triangles, ${r.listMaterials().length} materials, ${r.listTextures().length} maps, ${(bytes / 1024).toFixed(1)} KB`);
  const world = opts.world ?? 'hoth';
  const url = `/models/galaxy/kits/${kit}.glb`;
  // (the folder the first glob is in)
  const first = opts.pieces.split(',')[0];
  const prefix = first.slice(0, first.lastIndexOf('/'));
  await writeCatalogueLine(resolve(opts.catalog ?? join(ROOT, 'src', 'components', 'galaxy', 'surface', 'catalog', `bf2017-${world}.js`)), kit, {
    made: 'bf2017',
    as: opts.as,
    url,
    lod,
    tex,
    from: prefix,
    pieces: index,
  });
  await writeCredit(resolve(opts.credits ?? join(ROOT, 'src', 'data', 'modelCredits.json')), `kit-${kit}`, {
    title: `Star Wars Battlefront II (2017): ${prefix}`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    where: 'galaxy-surface',
    as: opts.as,
    file: url,
    also: ['galaxy'],
    permission: PERMISSION,
  });
  return { out, bytes, index };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  makeKit(args._[0], args).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
