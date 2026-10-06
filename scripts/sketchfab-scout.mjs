// Looks on Sketchfab for a model of something a world needs, before it's
// brought in with scripts/sketchfab-surface.mjs: a search, with what the
// site can't use left out (not downloadable, a licence outside the CC-BY
// family and CC0, or a page that says it was ripped from a game), printed
// a line a model (uid, triangles, licence, who made it, its name) and laid
// out as a contact sheet of their thumbnails, numbered as printed, to look
// over before downloading anything.
//
//   NODE_USE_ENV_PROXY=1 OUT=/tmp/scout node scripts/sketchfab-scout.mjs "jabba palace" [count]
//
// The search needs no token; the sheet goes to $OUT/<query>.jpg.

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLUGS = new Set(['by', 'by-sa', 'by-nc', 'by-nc-sa', 'cc0']);
// search results name the licence by label, a model's own page by slug
const LABELS = { 'CC Attribution': 'by', 'CC Attribution-ShareAlike': 'by-sa', 'CC Attribution-NonCommercial': 'by-nc', 'CC Attribution-NonCommercial-ShareAlike': 'by-nc-sa', 'CC0 Public Domain': 'cc0' };
const RIPPED = /\b(rip|ripped|gamerip|extracted|game ?asset from)\b/i;

export const slugOf = (license) => license?.slug ?? LABELS[license?.label] ?? null;

export function usable(m) {
  if (!m?.isDownloadable || !SLUGS.has(slugOf(m.license))) return false;
  const words = [m.name, m.description, ...(m.tags ?? []).map((t) => t.name ?? t)].join(' ');
  return !RIPPED.test(words);
}

async function search(q, count) {
  const url = `https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24&q=${encodeURIComponent(q)}`;
  const found = [];
  let next = url;
  while (next && found.length < count) {
    const r = await fetch(next);
    if (!r.ok) throw new Error(`search: ${r.status}`);
    const page = await r.json();
    found.push(...page.results.filter(usable));
    next = page.next;
  }
  return found.slice(0, count);
}

async function sheet(models, file) {
  const W = 256;
  const H = 144;
  const cols = 6;
  const rows = Math.ceil(models.length / cols);
  const tiles = await Promise.all(
    models.map(async (m, i) => {
      const img = [...(m.thumbnails?.images ?? [])].sort((a, b) => Math.abs(a.width - 256) - Math.abs(b.width - 256))[0];
      let buf = await sharp({ create: { width: W, height: H, channels: 3, background: '#222' } }).png().toBuffer();
      if (img) {
        const r = await fetch(img.url).catch(() => null);
        if (r?.ok) buf = await sharp(Buffer.from(await r.arrayBuffer())).resize(W, H, { fit: 'cover' }).png().toBuffer();
      }
      const label = Buffer.from(`<svg width="${W}" height="${H}"><rect width="34" height="22" fill="#000a"/><text x="5" y="16" font-size="15" fill="#fff" font-family="sans-serif">${i}</text></svg>`);
      return { input: await sharp(buf).composite([{ input: label }]).png().toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * H };
    }),
  );
  await sharp({ create: { width: cols * W, height: Math.max(rows, 1) * H, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 80 }).toFile(file);
}

// (the path, not file:// + argv: on Windows the URL is file:///C:/…)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [q, n = '18'] = process.argv.slice(2);
  if (!q) throw new Error('usage: sketchfab-scout.mjs "<query>" [count]');
  const out = process.env.OUT ?? '.';
  await mkdir(out, { recursive: true });
  const models = await search(q, Number(n));
  models.forEach((m, i) => console.log(`${String(i).padStart(2)} ${m.uid} ${String(m.faceCount).padStart(8)} ${slugOf(m.license).padEnd(8)} ${(m.user?.username ?? '').slice(0, 18).padEnd(18)} ${m.name}`));
  const file = join(out, `${q.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`);
  await sheet(models, file);
  console.log(file);
}
