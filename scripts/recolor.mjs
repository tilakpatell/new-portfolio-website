// A model's colours brought to the films': for each rule, the base-colour
// map of every material whose name matches is scaled, channel by channel in
// linear light, so that its mean comes out the rule's albedo (its stains,
// grain and shading kept, only shifted), blended by `amount`; a material
// with no map has its colour factor set instead. Used by the galaxy's
// surface imports (scripts/sketchfab-surface.mjs, scripts/meshy-galaxy-
// buildings.mjs) with a catalogue entry's `recolor`:
//   [{ material: 'regex source' | '*', to: '#rrggbb' (sRGB albedo), amount: 0…1 }]
// A map shared with a material no rule matches is copied first, so only the
// matched ones change. Deterministic: run on the same source, the same out.
//
//   recolorDoc(doc, rules) → [{ material, from: '#…', to: '#…' }] (what it did)

import sharp from 'sharp';

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hexOf = (lin) => `#${lin.map((v) => Math.round(Math.max(0, Math.min(1, toSrgb(v))) * 255).toString(16).padStart(2, '0')).join('')}`;
export const linOf = (hex) => [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));

const matches = (rule, name) => rule.material === '*' || new RegExp(rule.material, 'i').test(name ?? '');

// the map's pixels scaled by k (linear, per channel), back as PNG
async function scaled(texture, k) {
  const img = sharp(Buffer.from(texture.getImage()));
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const lut = [0, 1, 2].map((c) => Uint8ClampedArray.from({ length: 256 }, (_, v) => Math.round(toSrgb(Math.min(1, toLin(v / 255) * k[c])) * 255)));
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = lut[c][data[i + c]];
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// a map's mean colour, linear
async function meanOf(texture) {
  const { data, info } = await sharp(Buffer.from(texture.getImage())).removeAlpha().resize(128, 128, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const s = [0, 0, 0];
  for (let i = 0; i < data.length; i += info.channels) for (let c = 0; c < 3; c++) s[c] += toLin(data[i + c] / 255);
  const n = data.length / info.channels;
  return s.map((v) => v / n);
}

export async function recolorDoc(doc, rules = []) {
  const done = [];
  if (!rules?.length) return done;
  const root = doc.getRoot();
  for (const mat of root.listMaterials()) {
    const rule = rules.find((r) => matches(r, mat.getName()));
    if (!rule) continue;
    const to = linOf(rule.to);
    const amount = rule.amount ?? 1;
    const factor = mat.getBaseColorFactor();
    let tex = mat.getBaseColorTexture();
    if (!tex) {
      // (no map: the colour factor is the colour)
      const from = factor.slice(0, 3);
      mat.setBaseColorFactor([...from.map((v, c) => v + (to[c] - v) * amount), factor[3]]);
      done.push({ material: mat.getName(), from: hexOf(from), to: rule.to });
      continue;
    }
    // (a map another material keeps as it is: a copy of its own to change)
    const users = root.listMaterials().filter((m) => m.getBaseColorTexture() === tex);
    if (users.some((m) => m !== mat && !rules.some((r) => matches(r, m.getName())))) {
      const copy = doc.createTexture(`${tex.getName()}-recolored`).setImage(tex.getImage()).setMimeType(tex.getMimeType());
      mat.setBaseColorTexture(copy);
      tex = copy;
    } else if (users.indexOf(mat) > 0) continue; // (a shared map changed once, for the first of its materials)
    // what the eye sees is the map times the factor: aim that at `to` (again,
    // a time or two, where the brightest texels clipped short of it)
    const first = (await meanOf(tex)).map((v, c) => v * factor[c]);
    const goal = first.map((v, c) => v + (to[c] - v) * amount);
    for (let pass = 0; pass < 3; pass++) {
      const mean = (await meanOf(tex)).map((v, c) => v * factor[c]);
      if (mean.every((v, c) => Math.abs(v - goal[c]) <= 0.01 + goal[c] * 0.03)) break;
      tex.setImage(await scaled(tex, mean.map((v, c) => goal[c] / Math.max(v, 1e-4)))).setMimeType('image/png');
    }
    done.push({ material: mat.getName(), from: hexOf(first), to: hexOf(goal) });
  }
  return done;
}
