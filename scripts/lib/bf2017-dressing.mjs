// What the game's materials need on the site, by their names, before the
// import writes a vehicle: Frostbite draws its glass with a shader of its
// own and no colour map (M_Glass on the X-34's windscreen, the canopies), so
// the material comes through bare and draws as a white sheet; and it marks
// a vehicle's weak points with covers (m_weakpoints_cover under the MTT)
// that its gameplay shows and the site has no use for.
//
// And some maps are packed three in one, `_ncs` (the TIE fighter's and
// interceptor's wing panels): a normal's x in R, the colour in B, the
// smoothness in A. Read as a colour map they come out red or yellow, so the
// colour is taken from B alone (grey, as the panels are); the normal and the
// smoothness are left, their packing not being sure.
//
// An opaque colour map's alpha is the game's smoothness (`_cs`), which the
// ORM map already carries: kept, it makes WebP and AVIF throw colour away
// (33.7 dB against 48.6 dB on a hero's map: the pipeline design's section
// 6), so it is stripped from every opaque material's colour map.
//
// isGlass(name) / isMarker(name) / isPacked(name) → bool
// ncsColour(rgba, channels) → rgb (the colour of a packed map, B as grey)
// GLASS: the glass's look (a dark tint, mostly see-through, a sharp shine)
// dressed() → a glTF-Transform transform: glass made glass, markers dropped

export const isGlass = (name = '') => /glass|canopy|windscreen|windshield|window/i.test(name);
export const isMarker = (name = '') => /weakpoint|_collision|shadowproxy|occluder/i.test(name);
export const isPacked = (name = '') => /_ncs(\.|$)/i.test(name);
export const GLASS = { colour: [0.06, 0.08, 0.1, 0.32], roughness: 0.06, metalness: 0 };

export function ncsColour(data, channels = 4) {
  const n = data.length / channels;
  const out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) out.fill(data[i * channels + 2], i * 3, i * 3 + 3);
  return out;
}

// (`sharp`: the import's, to read and write the packed map's pixels)
export const dressed = ({ sharp = null } = {}) => async (doc) => {
  if (sharp)
    for (const m of doc.getRoot().listMaterials()) {
      const tex = m.getBaseColorTexture();
      if (!tex || !isPacked(tex.getName()) || !tex.getImage()) continue;
      const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const png = await sharp(ncsColour(data, info.channels), { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
      const colour = doc.createTexture(tex.getName().replace(/_ncs/i, '_c')).setImage(new Uint8Array(png)).setMimeType('image/png');
      m.setBaseColorTexture(colour);
    }
  if (sharp)
    for (const tex of doc.getRoot().listTextures()) {
      const opaque = tex.listParents().filter((p) => p.propertyType === 'Material' && p.getBaseColorTexture() === tex);
      if (!opaque.length || opaque.some((m) => m.getAlphaMode() !== 'OPAQUE') || !tex.getImage()) continue;
      const img = sharp(Buffer.from(tex.getImage()));
      if (!(await img.metadata()).hasAlpha) continue;
      tex.setImage(new Uint8Array(await img.removeAlpha().png().toBuffer())).setMimeType('image/png');
    }
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      const name = m?.getName() ?? '';
      if (isMarker(name)) {
        prim.dispose();
        continue;
      }
      if (m && isGlass(name) && !m.getBaseColorTexture()) m.setBaseColorFactor(GLASS.colour).setAlphaMode('BLEND').setRoughnessFactor(GLASS.roughness).setMetallicFactor(GLASS.metalness).setDoubleSided(true);
    }
  for (const mesh of doc.getRoot().listMeshes()) if (!mesh.listPrimitives().length) mesh.dispose();
};
