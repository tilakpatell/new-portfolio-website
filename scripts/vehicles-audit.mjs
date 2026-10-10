// An audit of every vehicle the site draws from Star Wars Battlefront II
// (2017): the space levels' ships, docks and stations (scripts/bf2017-space.mjs),
// the space layer's fleet files (scripts/bf2017-fleet.mjs) and the surfaces'
// vehicles (surface/catalog/bf2017-vehicles.js, lane V). For each file it
// measures what a look depends on and a picture alone can hide: how much of
// its surface wears no colour map (the Star Destroyer's hull at the game's
// LOD5 is white), which UV set each map is read through, what's glass, what's
// metal, how big its maps are and of what kind, its size and which way it's
// longest; and with --shots it draws each from four sides through
// scripts/glb-shot.mjs (the dev server up: npx vite --port 5188 --strictPort
// --host 127.0.0.1). A published file not in this checkout is fetched from
// the public site-assets bucket by src/data/galaxyAssets.json's hash.
//
//   node scripts/vehicles-audit.mjs [--only <kind>,…] [--group space|fleet|surface] [--shots] [--out lab/vehicle-audit]
//
//   writes <out>/audit.json (a row a file) and <out>/audit.md (the table), and
//   with --shots <out>/shots/<group>-<kind>.png
//
// inspect(doc) → { tris, draws, materials, maps: [{ name, mime, w, h }], area,
//   bare: share of the surface with no colour map, blend, metal, uv1, noUv,
//   size: [x, y, z] metres, longest: 'x' | 'y' | 'z' } (pure, given a read Document)

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { ktx2Info } from './lib/ktx2-levels.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const BUCKET = 'https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets';

// every vehicle: { group, kind, path (under public/), as }
export async function vehicles() {
  const out = [];
  for (const f of (await readdir(join(ROOT, 'src/data/galaxy/space'))).filter((x) => /^(endor|fondor|kamino|naboo)\.json$/.test(x))) {
    const pack = JSON.parse(readFileSync(join(ROOT, 'src/data/galaxy/space', f), 'utf8'));
    for (const [slug, m] of Object.entries(pack.models)) {
      if (m.kind === 'rock' || out.some((v) => v.kind === slug)) continue;
      out.push({ group: 'space', kind: slug, path: m.url.slice(1), as: `${m.as ?? slug} (${m.kind}, ${pack.system})`, size: m.size, from: m.from?.length ?? 0 });
    }
  }
  const { FLEET } = await import('./bf2017-fleet.mjs');
  for (const [file, , , from] of FLEET) out.push({ group: 'fleet', kind: file, path: `models/galaxy/${file}.glb`, as: from.as ?? from.kind ?? from.name });
  const { MODELS } = await import('../src/components/galaxy/surface/catalog/bf2017-vehicles.js');
  for (const [kind, m] of Object.entries(MODELS)) {
    out.push({ group: 'surface', kind, path: `models/galaxy/surface/${kind}.glb`, as: m.as ?? kind, cut: 'plain' });
    if (m.lod) out.push({ group: 'surface', kind: `${kind}.lod1`, path: `models/galaxy/surface/${kind}.lod1.glb`, as: `${m.as ?? kind} (light cut)`, cut: 'lod1' });
  }
  return out;
}

// the file on disk, or fetched from the bucket into <out>/files/
async function local(path, out) {
  const here = join(ROOT, 'public', path);
  if (existsSync(here)) return here;
  const kept = join(out, 'files', path);
  if (existsSync(kept)) return kept;
  const assets = JSON.parse(readFileSync(join(ROOT, 'src/data/galaxyAssets.json'), 'utf8'));
  const e = assets[path];
  if (!e) return null;
  const res = await fetch(`${BUCKET}/${e.hash}/${path}`);
  if (!res.ok) return null;
  await mkdir(dirname(kept), { recursive: true });
  await writeFile(kept, Buffer.from(await res.arrayBuffer()));
  return kept;
}

const triArea = (a, b, c) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
};
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

export async function inspect(doc) {
  const root = doc.getRoot();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const acc = { area: 0, bare: 0, blend: 0, metal: 0, uv1: 0, noUv: 0, tris: 0, draws: 0 };
  const byMat = new Map();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const at = (i) => apply(m, pos.getElement(idx ? idx.getScalar(i) : i, []));
      let area = 0;
      for (let i = 0; i + 2 < n; i += 3) {
        const [a, b, c] = [at(i), at(i + 1), at(i + 2)];
        for (const p of [a, b, c]) for (let k = 0; k < 3; k++) (lo[k] = Math.min(lo[k], p[k])), (hi[k] = Math.max(hi[k], p[k]));
        area += triArea(a, b, c);
      }
      const mat = prim.getMaterial();
      const base = mat?.getBaseColorTexture();
      const uv = mat?.getBaseColorTextureInfo()?.getTexCoord() ?? 0;
      acc.area += area;
      acc.tris += n / 3;
      acc.draws++;
      if (!base) acc.bare += area;
      if (base && !prim.getAttribute(`TEXCOORD_${uv}`)) acc.noUv += area;
      if (base && uv === 1) acc.uv1 += area;
      if (mat?.getAlphaMode() === 'BLEND') acc.blend += area;
      if ((mat?.getMetallicFactor() ?? 0) >= 0.9 && mat?.getMetallicRoughnessTexture()) acc.metal += area;
      const key = mat?.getName() ?? '(none)';
      const row = byMat.get(key) ?? { name: key, area: 0, tris: 0, map: base ? base.getName().split('/').pop() : null, color: mat?.getBaseColorFactor().map((x) => +x.toFixed(2)) ?? null };
      row.area += area;
      row.tris += n / 3;
      byMat.set(key, row);
    }
  }
  const maps = [];
  for (const t of root.listTextures()) {
    const img = t.getImage();
    let w = 0;
    let h = 0;
    if (t.getMimeType() === 'image/ktx2') ({ width: w, height: h } = ktx2Info(img));
    else if (img) ({ width: w, height: h } = await sharp(Buffer.from(img)).metadata());
    maps.push({ name: t.getName().split('/').pop(), mime: t.getMimeType().split('/')[1], w, h });
  }
  const size = lo[0] === Infinity ? [0, 0, 0] : hi.map((v, k) => +(v - lo[k]).toFixed(2));
  const share = (x) => (acc.area ? +(x / acc.area).toFixed(3) : 0);
  // the materials that cover most, biggest first
  const top = [...byMat.values()].sort((a, b) => b.area - a.area).slice(0, 8).map((r) => ({ ...r, share: share(r.area), area: undefined, tris: Math.round(r.tris) }));
  return { tris: Math.round(acc.tris), draws: acc.draws, materials: root.listMaterials().length, maps, bare: share(acc.bare), blend: share(acc.blend), metal: share(acc.metal), uv1: share(acc.uv1), noUv: share(acc.noUv), size, longest: 'xyz'[size.indexOf(Math.max(...size))], top };
}

async function io() {
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.SILENT)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const out = join(ROOT, args.out ?? 'lab/vehicle-audit');
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  const list = (await vehicles()).filter((v) => (!only || only.has(v.kind)) && (!args.group || v.group === args.group));
  const reader = await io();
  const rows = [];
  let browser = null;
  let shoot = null;
  if (args.shots) {
    ({ shoot } = await import('./glb-shot.mjs'));
    browser = await shoot.launch();
    await mkdir(join(out, 'shots'), { recursive: true });
  }
  for (const v of list) {
    const file = await local(v.path, out);
    if (!file) {
      rows.push({ ...v, missing: true });
      console.log(`${v.group}/${v.kind}: missing`);
      continue;
    }
    const row = { ...v, file: relative(ROOT, file), bytes: readFileSync(file).length, ...(await inspect(await reader.read(file))) };
    if (shoot) {
      try {
        const shots = await shoot(file, ['three', 'side', 'top', 'close'], { browser, w: 480, h: 360 });
        const png = join(out, 'shots', `${v.group}-${v.kind}.png`);
        await sharp({ create: { width: 480 * shots.length, height: 360, channels: 3, background: '#111' } })
          .composite(shots.map((input, i) => ({ input, left: i * 480, top: 0 })))
          .png()
          .toFile(png);
        row.shot = relative(ROOT, png);
        row.shotErrors = (shoot.last?.errors ?? []).filter((e) => !/404 \(Not Found\)/.test(e)).slice(0, 3);
      } catch (e) {
        row.shotErrors = [String(e.message ?? e).slice(0, 200)];
      }
    }
    rows.push(row);
    console.log(`${v.group}/${v.kind}: ${row.tris} tris, ${row.draws} draws, bare ${row.bare}, ${row.maps.length} maps, ${(row.bytes / 1e6).toFixed(2)} MB${row.shot ? `, ${row.shot}` : ''}`);
  }
  if (browser) await browser.close();
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'audit.json'), `${JSON.stringify(rows, null, 1)}\n`);
  const md = ['| group | kind | MB | tris | draws | maps (max px) | bare | blend | metal | uv1 | size m | longest |', '| --- | --- | --: | --: | --: | --- | --: | --: | --: | --: | --- | --- |'];
  for (const r of rows) md.push(r.missing ? `| ${r.group} | ${r.kind} | missing |||||||||| ` : `| ${r.group} | ${r.kind} | ${(r.bytes / 1e6).toFixed(2)} | ${r.tris} | ${r.draws} | ${r.maps.length} (${Math.max(0, ...r.maps.map((m) => m.w))}) | ${r.bare} | ${r.blend} | ${r.metal} | ${r.uv1} | ${r.size.map((x) => Math.round(x)).join('×')} | ${r.longest} |`);
  await writeFile(join(out, 'audit.md'), `${md.join('\n')}\n`);
  console.log(`${rows.length} files; ${join(relative(ROOT, out), 'audit.md')}`);
}
