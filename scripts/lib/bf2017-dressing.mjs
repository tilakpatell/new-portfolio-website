// What the game's materials need on the site, read from the game itself,
// before the import writes a vehicle. Nothing here restyles a map: the
// colours, normals and smoothness stay the game's (the owner, 2026-10-10:
// trust the game's textures). It only draws what glTF can't say on its own
// the way Frostbite's shader draws it:
//
// - **Glass.** Frostbite draws its glass with a shader of its own and no
//   map at all (M_Glass on the X-34's windscreen, the canopies), so the
//   material comes through bare and draws as a white sheet: it is made
//   see-through.
// - **Weak points.** The covers the game marks them with (m_weakpoints_cover
//   under the MTT) are gameplay's, and dropped.
// - **Decals.** A decal sheet lies on the hull and the game blends it in
//   through the mask in its `_nam` map's alpha (SS_DecalLerpEverything: the
//   colour, normal and smoothness lerped by it). Drawn opaque, as glTF has
//   it, each sheet paints a grey and red patch over the hull (the X-wing's
//   and the LAAT's patchwork). So the decal's colour map takes the mask as
//   its alpha, losslessly, and draws blended; the drop's derived ORM holds
//   that mask in its blue, which is not metal, so the decal is not metal. A
//   normal-only decal (SS_DecalLerpNormal) lerps the hull's normal alone,
//   which glTF can't, and drawn at all it is a white sheet: it is dropped.
// - **Packed maps.** Some maps are three in one, `_ncs` (the TIE fighter's
//   and interceptor's wing panels): a normal's x in R, the colour in B, the
//   smoothness in A, bound by the game as both the colour and the normal. The
//   colour is the game's blue channel, taken out losslessly.
//
// Every map made here is the game's own pixels, written as lossless WebP
// under a name starting `kept:` so the import's lossy pass leaves it alone.
//
// isGlass(name) / isMarker(name) / isPacked(name) → bool
// decalOf(shader) → 'colour' | 'normal' | null
// ncsColour(rgba, channels) → rgb (the colour of a packed map, B as grey)
// withMask(rgba, mask, channels) → rgba (the colour, the mask as its alpha)
// GLASS: the glass's look (a dark tint, mostly see-through, a sharp shine)
// KEPT: the prefix of a map made here, which no lossy pass touches
// dressed({ sharp }) → a glTF-Transform transform

export const isGlass = (name = '') => /glass|canopy|windscreen|windshield|window/i.test(name);
export const isMarker = (name = '') => /weakpoint|_collision|shadowproxy|occluder/i.test(name);
export const isPacked = (name = '') => /_ncs(\.|$)/i.test(name);
export const decalOf = (shader = '') => (/decal/i.test(shader) ? (/lerpnormal/i.test(shader) ? 'normal' : 'colour') : null);
export const GLASS = { colour: [0.06, 0.08, 0.1, 0.32], roughness: 0.06, metalness: 0 };
export const KEPT = 'kept:';

export function ncsColour(data, channels = 4) {
  const n = data.length / channels;
  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) out.fill(data[i * channels + 2], i * 3, i * 3 + 3);
  return out;
}

export function withMask(data, mask, channels = 4, maskChannels = 4, at = 2) {
  const n = data.length / channels;
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = data[i * channels];
    out[i * 4 + 1] = data[i * channels + 1];
    out[i * 4 + 2] = data[i * channels + 2];
    out[i * 4 + 3] = mask[i * maskChannels + at];
  }
  return out;
}

const lossless = (sharp, raw, info, ch) => sharp(raw, { raw: { width: info.width, height: info.height, channels: ch } }).webp({ lossless: true }).toBuffer();

// (`sharp`: the import's, to read and write the maps' pixels)
export const dressed = ({ sharp = null } = {}) => async (doc) => {
  const root = doc.getRoot();
  const made = new Map();
  for (const m of root.listMaterials()) {
    const decal = m.getExtras()?.decal ?? null;
    const tex = m.getBaseColorTexture();
    if (sharp && decal === 'colour' && tex?.getImage() && m.getMetallicRoughnessTexture()?.getImage()) {
      const key = `decal ${tex.getName()}`;
      if (!made.has(key)) {
        const img = sharp(Buffer.from(tex.getImage())).ensureAlpha();
        const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
        const mask = await sharp(Buffer.from(m.getMetallicRoughnessTexture().getImage())).resize(info.width, info.height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
        const webp = await lossless(sharp, withMask(data, mask.data, info.channels, mask.info.channels), info, 4);
        made.set(key, doc.createTexture(`${KEPT}${tex.getName().split('/').pop()}`).setImage(new Uint8Array(webp)).setMimeType('image/webp'));
      }
      m.setBaseColorTexture(made.get(key)).setAlphaMode('BLEND').setMetallicFactor(0);
    } else if (sharp && tex?.getImage() && isPacked(tex.getName())) {
      const key = `ncs ${tex.getName()}`;
      if (!made.has(key)) {
        const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const webp = await lossless(sharp, ncsColour(data, info.channels), info, 3);
        made.set(key, doc.createTexture(`${KEPT}${tex.getName().split('/').pop().replace(/_ncs/i, '_c')}`).setImage(new Uint8Array(webp)).setMimeType('image/webp'));
      }
      m.setBaseColorTexture(made.get(key));
    }
  }
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      const name = m?.getName() ?? '';
      if (isMarker(name) || m?.getExtras()?.decal === 'normal') {
        prim.dispose();
        continue;
      }
      if (m && isGlass(name) && !m.getBaseColorTexture()) m.setBaseColorFactor(GLASS.colour).setAlphaMode('BLEND').setRoughnessFactor(GLASS.roughness).setMetallicFactor(GLASS.metalness).setDoubleSided(true);
    }
  for (const m of root.listMaterials()) if (m.getExtras()?.decal) m.setExtras({});
  for (const mesh of root.listMeshes()) if (!mesh.listPrimitives().length) mesh.dispose();
};
