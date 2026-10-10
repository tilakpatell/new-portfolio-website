// A level pack's meshes, loaded for the scene (lane L): each GLB fetched
// through the asset base, parsed without its textures (levelPack.js's
// splitTextures) and its maps bound from one cache, so a KTX2 the pack
// shares is fetched, transcoded and uploaded once whatever names it, at the
// tier's size (tex/<slug>.<size>.ktx2). A colour or emissive map is sRGB
// whatever its file says: the game stores its colour maps as sRGB (BC7_SRGB,
// textures.jsonl's `format`), but many of the pack's KTX2s are labelled
// linear, and read as linear they came out washed pale (bindSlot).
//
//   createLevelLoader({ world, tier, renderer, fetchBytes, sizes }) → { load(glbPath) → Promise<{ scene } | null>, dispose() }
//   (sizes: level.json's `tex`, each map's size per tier)

import { SRGBColorSpace } from 'three';
import { gltfLoader, ktx2Loader } from '../../../../lib/three/gltf.js';
import { assetUrl, withFallback } from '../../../../lib/assetBase.js';
import { packUrl, splitTextures, tierTexture } from './levelPack.js';

// '../tex/a.ktx2' named by meshes/x.glb → 'tex/a.ktx2' in the pack
const inPack = (glbPath, uri) => {
  const parts = glbPath.split('/').slice(0, -1);
  for (const seg of uri.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
};

// the slots whose texture is a colour, in sRGB (the rest are data: normals, roughness and metal)
export const COLOUR_SLOTS = new Set(['map', 'emissiveMap']);

// a pack texture bound to a material's slot, the colour ones read as sRGB
export function bindSlot(mat, slot, tex) {
  if (COLOUR_SLOTS.has(slot) && tex.colorSpace !== SRGBColorSpace) {
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
  }
  if (slot === 'metalRough') {
    mat.roughnessMap = tex;
    mat.metalnessMap = tex;
  } else mat[slot] = tex;
  mat.needsUpdate = true;
}

export function createLevelLoader({ world, tier, renderer, fetchBytes, sizes = {} }) {
  const textures = new Map(); // pack path → Promise<Texture | null>
  const meshes = new Map(); // glb path → Promise<{ scene } | null>
  let gone = false;

  function texture(path) {
    if (!textures.has(path)) {
      const local = packUrl(world, tierTexture(path, tier, sizes));
      textures.set(
        path,
        ktx2Loader({ renderer })
          .then((k) => withFallback((u) => k.loadAsync(u))(local))
          .catch(() => null),
      );
    }
    return textures.get(path);
  }

  async function bind(gltf, slots, glbPath) {
    await Promise.all(
      slots.map(async ({ material, slot, uri }) => {
        const [mat, tex] = await Promise.all([gltf.parser.getDependency('material', material), texture(inPack(glbPath, uri))]);
        if (!tex || gone) return;
        bindSlot(mat, slot, tex);
      }),
    );
  }

  function load(glbPath) {
    if (!meshes.has(glbPath)) {
      meshes.set(
        glbPath,
        fetchBytes(glbPath)
          .then(async (bytes) => {
            const { buffer, slots } = splitTextures(bytes);
            const gltf = await gltfLoader().parseAsync(buffer, '');
            await bind(gltf, slots, glbPath);
            return gltf;
          })
          .catch((e) => {
            if (import.meta.env?.DEV) console.warn('level mesh failed', glbPath, e);
            return null;
          }),
      );
    }
    return meshes.get(glbPath);
  }

  return {
    load,
    // (the remote name of a pack file, for the evidence)
    url: (path) => assetUrl(packUrl(world, path)),
    async dispose() {
      gone = true;
      for (const t of await Promise.all(textures.values())) t?.dispose();
      for (const g of await Promise.all(meshes.values())) {
        g?.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          for (const m of [o.material].flat()) m.dispose();
        });
      }
      textures.clear();
      meshes.clear();
    },
  };
}
