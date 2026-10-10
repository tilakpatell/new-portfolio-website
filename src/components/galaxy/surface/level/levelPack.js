// A level pack, read (lane L, "How a level draws"): which cells a visitor
// wants and in which band, which of a cell's draws a tier keeps and at what
// cut, where the pack's files are, and a GLB's textures at the tier's size.
// Pure: no three.js. The bands and the records are src/lib/level's, shared
// with the pack builder (scripts/bf2017-level.mjs).

import { bandsFor, cutFor, wanted } from '../../../../lib/level/bands.js';
import { readInstances } from '../../../../lib/level/instances.js';

export { bandsFor, cutFor, readInstances, wanted };

// the texture sizes by tier, as the pack wrote them (512 low, 1024 mid and
// high, 2048 ultra)
export const TEX = { low: 512, mid: 1024, high: 1024, ultra: 2048 };

export const packUrl = (world, path) => `/models/galaxy/bf2017/levels/${world}/${path}`;

// A key's band in a `wanted` answer: 'near', 'mid', or null (not wanted)
export const bandOf = (w, key) => (w.near.includes(key) ? 'near' : w.mid.includes(key) ? 'mid' : null);

// A list's draws a tier keeps in a band, each with its cut and GLB. The near
// band takes the cut the pack chose (null: dropped to fit the row); mid and
// far take theirs whenever the pack kept the draw at all.
export function drawsFor(pack, draws, band, tier) {
  const out = [];
  for (const d of draws) {
    if (!d.lod?.[tier]) continue;
    const cut = band === 'near' ? d.lod[tier] : cutFor(band, tier);
    out.push({ mesh: d.mesh, offset: d.offset, count: d.count, mirrored: d.mirrored, cut, glb: pack.meshes[d.mesh].glb[cut] });
  }
  return out;
}

export const tierTexture = (uri, tier) => uri.replace(/\.ktx2$/, `.${TEX[tier] ?? TEX.high}.ktx2`);

// The pack's meshes share their textures (one material a game material, one
// KTX2 a map), but a glTF loader keeps its textures per file, which would
// upload the same map once for every mesh that names it. So a GLB is parsed
// without them: this takes its textures out (images, textures, samplers and
// each material's references) and says which material wanted which map in
// which slot, for the scene to bind from one shared cache.
//
//   splitTextures(buffer) → { buffer, slots: [{ material, slot, uri }] }
const SLOTS = [
  ['map', (m) => m.pbrMetallicRoughness?.baseColorTexture, (m) => delete m.pbrMetallicRoughness.baseColorTexture],
  ['metalRough', (m) => m.pbrMetallicRoughness?.metallicRoughnessTexture, (m) => delete m.pbrMetallicRoughness.metallicRoughnessTexture],
  ['normalMap', (m) => m.normalTexture, (m) => delete m.normalTexture],
  ['aoMap', (m) => m.occlusionTexture, (m) => delete m.occlusionTexture],
  ['emissiveMap', (m) => m.emissiveTexture, (m) => delete m.emissiveTexture],
];

function imageUri(json, ref) {
  const t = json.textures?.[ref.index];
  const src = t?.extensions?.KHR_texture_basisu?.source ?? t?.source;
  return src === undefined ? null : (json.images?.[src]?.uri ?? null);
}

export function splitTextures(buffer) {
  const bytes = new Uint8Array(buffer);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = v.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  const slots = [];
  (json.materials ?? []).forEach((m, material) => {
    for (const [slot, get, drop] of SLOTS) {
      const ref = get(m);
      if (!ref) continue;
      const uri = imageUri(json, ref);
      if (uri && !uri.startsWith('data:')) slots.push({ material, slot, uri });
      drop(m);
    }
  });
  delete json.images;
  delete json.textures;
  delete json.samplers;
  const strip = (list) => list?.filter((e) => e !== 'KHR_texture_basisu' && e !== 'EXT_texture_webp' && e !== 'KHR_texture_transform');
  if (json.extensionsUsed) json.extensionsUsed = strip(json.extensionsUsed);
  if (json.extensionsRequired) json.extensionsRequired = strip(json.extensionsRequired);
  let text = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) {
    const t = new Uint8Array(text.length + pad).fill(0x20);
    t.set(text);
    text = t;
  }
  const rest = bytes.subarray(20 + len);
  const out = new Uint8Array(20 + text.length + rest.length);
  out.set(bytes.subarray(0, 20));
  const o = new DataView(out.buffer);
  o.setUint32(8, out.length, true);
  o.setUint32(12, text.length, true);
  out.set(text, 20);
  out.set(rest, 20 + text.length);
  return { buffer: out.buffer, slots };
}
