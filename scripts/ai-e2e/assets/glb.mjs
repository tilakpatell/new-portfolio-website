// A shipped GLB's numbers, read as the site's loader reads it (meshopt
// decoded, every extension known), for the asset tests:
//
//   inspect(file) → { tris, bytes, textures: [{ mime, w, h }], extensions, scenes, bbox: [x, y, z], meshopt }

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { statSync } from 'node:fs';
import { triangles } from '../../gen3d/budget.mjs';

let io;
async function reader() {
  if (!io) {
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  }
  return io;
}

export async function inspect(file) {
  const doc = await (await reader()).read(file);
  const root = doc.getRoot();
  const extensions = root.listExtensionsUsed().map((e) => e.extensionName);
  const scenes = root.listScenes();
  const { min, max } = getBounds(root.getDefaultScene() ?? scenes[0]);
  return {
    tris: triangles(doc),
    bytes: statSync(file).size,
    textures: root.listTextures().map((t) => {
      const [w, h] = t.getSize() ?? [0, 0];
      return { mime: t.getMimeType(), w, h };
    }),
    extensions,
    scenes: scenes.length,
    bbox: max.map((v, i) => v - min[i]),
    meshopt: extensions.includes('EXT_meshopt_compression') || extensions.includes('KHR_meshopt_compression'),
  };
}
