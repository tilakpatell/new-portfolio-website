// leoxx300's B1 battle droid (Sketchfab, CC BY 4.0; the assets repo's
// sketchfab-star-wars release) as the troops' battle droid, rigged by
// geometry: its own 53 joints are unnamed (Bone.001_01…), so no role finder
// or retarget can use them. It is baked at rest out of that skeleton,
// brought down to web size, then given the Battlefront droid's skeleton
// and skin weights (scripts/rig-transfer.mjs: the same build, standing),
// so every clip the crew play plays on it.
//
//   node scripts/assets-fetch.mjs starwars b1
//   node scripts/b1-import.mjs [--tris 12000] [--tex 1024] [--yaw -90]
//     → lab/b1/b1-rest.glb, b1-web.glb, b1-rigged.glb (judged before it
//       goes anywhere: scripts/glb-shot.mjs, scripts/clip-shot.mjs)
//
//   creditFor(model) → its src/data/modelCredits.json entry (pure)

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const creditFor = (m) => ({
  title: m.title,
  author: m.author,
  authorUrl: m.authorUrl,
  license: m.license,
  licenseUrl: m.licenseUrl,
  source: m.source,
  where: 'galaxy-surface',
  as: 'the battle droids',
  file: '/models/galaxy/troops/battledroid.glb',
  also: ['galaxy'],
});

async function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
  const [{ NodeIO }, { ALL_EXTENSIONS }, { prune }, { MeshoptDecoder, MeshoptEncoder }, { relit, unskinned }, { PACKS }, { rigFrom }] = await Promise.all([
    import('@gltf-transform/core'),
    import('@gltf-transform/extensions'),
    import('@gltf-transform/functions'),
    import('meshoptimizer'),
    import('./lib/surface-model.mjs'),
    import('./assets-fetch.mjs'),
    import('./rig-transfer.mjs'),
  ]);
  const raw = join(ROOT, 'lab', 'assets', 'starwars', PACKS.starwars.models.b1.file);
  const dir = join(ROOT, 'lab', 'b1');
  mkdirSync(dir, { recursive: true });
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  // (at rest, out of its skeleton: the transfer takes an unrigged mesh)
  const doc = await io.read(raw);
  // (and lit for daylight as the surface's models are: metal at most half)
  await doc.transform(unskinned(), relit({ gain: 1 }), prune());
  // (it comes facing +x: turned to face +z, as the donor does)
  const yaw = (opt('--yaw', -90) * Math.PI) / 180;
  const turn = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const wrap = doc.createNode('b1-facing').setRotation(turn);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrap.addChild(child);
  }
  scene.addChild(wrap);
  const rest = join(dir, 'b1-rest.glb');
  await io.write(rest, doc);
  const web = join(dir, 'b1-web.glb');
  const shrink = spawnSync('node', [join(ROOT, 'scripts', 'sketchfab-import.mjs'), rest, web, '--size', '1.91', '--tex', String(opt('--tex', 1024)), '--tris', String(opt('--tris', 12000))], { stdio: 'inherit' });
  if (shrink.status !== 0) throw new Error('sketchfab-import failed');
  const out = join(dir, 'b1-rigged.glb');
  const r = await rigFrom(join(ROOT, 'public', 'models', 'galaxy', 'troops', 'battledroid.glb'), web, out, { tex: opt('--tex', 1024) });
  console.log(`rigged ${out}: ${r.tris} triangles on ${r.joints} joints (bind spread ${r.spread.toExponential(1)}), arms ${JSON.stringify(r.arms)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
