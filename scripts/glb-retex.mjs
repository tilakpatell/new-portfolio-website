// A model's maps made smaller, nothing else touched: the colour (and
// emissive) maps to --tex, every other map to --maps, as WebP, the mesh,
// skin, nodes and materials as they were. For a cut whose geometry is right
// and whose textures are too big for its tier (the 2017 heroes at the
// game's full 2048 maps: their plain cut from their .ultra one).
//
//   node scripts/glb-retex.mjs <in.glb> <out.glb> [--tex 1024] [--maps 512] [--quality 82] [--maps-quality 80]

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';

// (the sharp glTF-Transform's ndarray-pixels loads: see battlefront-import.mjs)
const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');

export async function retex(input, output, { tex = 1024, maps = 512, quality = 82, mapsQuality = 80 } = {}) {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(input);
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [tex, tex], quality }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [maps, maps], quality: mapsQuality }),
  );
  await io.write(output, doc);
  return (await stat(output)).size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = parseArgs(process.argv.slice(2));
  const [input, output] = a._;
  if (!input || !output) {
    console.error('usage: node scripts/glb-retex.mjs <in.glb> <out.glb> [--tex 1024] [--maps 512] [--quality 82] [--maps-quality 80]');
    process.exit(1);
  }
  const bytes = await retex(input, output, { tex: Number(a.tex ?? 1024), maps: Number(a.maps ?? 512), quality: Number(a.quality ?? 82), mapsQuality: Number(a.mapsQuality ?? 80) });
  console.log(`${output}: ${(bytes / 1048576).toFixed(2)} MB`);
}
