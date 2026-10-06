// A model's colours brought to the films': for each rule, the base-colour
// map of every material whose name matches is scaled, channel by channel in
// linear light, so that its mean comes out the rule's albedo (its stains,
// grain and shading kept, only shifted), blended by `amount`; a material
// with no map has its colour factor set instead. Used by the galaxy's
// surface imports (scripts/sketchfab-surface.mjs, scripts/meshy-galaxy-
// buildings.mjs) with a catalogue entry's `recolor`:
//   [{ material: 'regex source' | '*', to: '#rrggbb' (sRGB albedo), amount: 0…1,
//      band: [lo, hi] (only texels of that saturation: plaster, not paint) }]
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

// the map's pixels as RGBA bytes, and each texel's weight: 1, or (a rule's
// `band`: [lo, hi] of HSV saturation) 1 inside the band, falling to 0 over
// 0.06 outside it, so the plaster moves and a painted door or grey pipes don't
async function source(texture, band) {
  const { data, info } = await sharp(Buffer.from(texture.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const weights = new Float32Array(data.length / 4).fill(1);
  if (band)
    for (let i = 0; i < weights.length; i++) {
      const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
      const max = Math.max(r, g, b);
      const sat = max ? (max - Math.min(r, g, b)) / max : 0;
      weights[i] = Math.max(0, Math.min(1, (sat - (band[0] - 0.06)) / 0.06, (band[1] + 0.06 - sat) / 0.06));
    }
  return { data, info, weights };
}
// the source scaled by k (linear, per channel, each texel by its weight)
function scaled({ data, weights }, k) {
  const out = Buffer.from(data);
  for (let i = 0; i < weights.length; i++)
    for (let c = 0; c < 3; c++) {
      const kk = 1 + weights[i] * (k[c] - 1);
      out[i * 4 + c] = Math.round(toSrgb(Math.min(1, toLin(data[i * 4 + c] / 255) * kk)) * 255);
    }
  return out;
}
// raw RGBA bytes' mean colour, linear
async function meanRaw(buf, info) {
  const { data, info: ii } = await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).removeAlpha().resize(128, 128, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const s = [0, 0, 0];
  for (let i = 0; i < data.length; i += ii.channels) for (let c = 0; c < 3; c++) s[c] += toLin(data[i + c] / 255);
  const n = data.length / ii.channels;
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
    // what the eye sees is the map times the factor: aim that at `to`, k
    // found again a few times over (the brightest texels clip short of it)
    const src = await source(tex, rule.band);
    const first = (await meanRaw(src.data, src.info)).map((v, c) => v * factor[c]);
    const goal = first.map((v, c) => v + (to[c] - v) * amount);
    let k = [1, 1, 1];
    let buf = src.data;
    for (let pass = 0; pass < 6; pass++) {
      const mean = (await meanRaw(buf, src.info)).map((v, c) => v * factor[c]);
      if (mean.every((v, c) => Math.abs(v - goal[c]) <= 0.003)) break;
      k = k.map((v, c) => (v * goal[c]) / Math.max(mean[c], 1e-4));
      buf = scaled(src, k);
    }
    tex.setImage(await sharp(buf, { raw: { width: src.info.width, height: src.info.height, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
    done.push({ material: mat.getName(), from: hexOf(first), to: hexOf(goal) });
  }
  return done;
}
