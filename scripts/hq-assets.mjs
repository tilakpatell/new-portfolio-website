// Makes the assets for the Avengers HQ games: every entry in
// scripts/data/hq-assets.json is downloaded from Poly Haven or ambientCG (both
// CC0, free to use with no credit required) and made small enough for the
// web, into public/hq/. It also writes src/components/avengers/hq/catalog.js,
// which the games read: each sky's sun, each model's size.
//
//   textures  →  public/hq/tex/<name>/{color.webp, normal.jpg, arm.jpg}
//                (arm: ambient occlusion in red, roughness in green, metal in blue)
//   skies     →  public/hq/sky/<name>/{env.hdr, sky.jpg}
//                env.hdr is a small HDR for lighting with the sun taken out (the
//                games light with a real sun instead, which casts shadows);
//                sky.jpg is the picture you see.
//   models    →  public/hq/models/<name>.glb (meshopt-compressed, WebP textures,
//                simplified where the original is too dense for a browser)
//
// Downloads are cached in scripts/.cache/hq/, so a second run only processes.
//
// Run:   node scripts/hq-assets.mjs            (everything)
//        node scripts/hq-assets.mjs grass sky:dusk model:barrel   (only these)
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt, reorder, quantize, flatten, join } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = new URL('..', import.meta.url);
const OUT = new URL('public/hq/', ROOT);
const CACHE = new URL('scripts/.cache/hq/', ROOT);
const CATALOG = new URL('src/components/avengers/hq/catalog.js', ROOT);
const UA = 'tilakpatell.com asset script (https://tilakpatell.com)';

const manifest = JSON.parse(await readFile(new URL('scripts/data/hq-assets.json', ROOT), 'utf8'));
const only = process.argv.slice(2);
const wanted = (kind, name) => !only.length || only.includes(name) || only.includes(`${kind}:${name}`) || only.includes(kind);

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function fetchTo(url, file) {
  if (existsSync(file)) return file;
  await mkdir(new URL('.', `file://${file}`), { recursive: true }).catch(() => {});
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(file, buf);
      return file;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

const json = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const cachePath = (...parts) => new URL(parts.join('/'), CACHE).pathname;
const outPath = (...parts) => new URL(parts.join('/'), OUT).pathname;
const ensureDir = (p) => mkdir(p, { recursive: true });

// The nearest Poly Haven resolution at or above `size` pixels.
const phRes = (files, size) => {
  const order = ['1k', '2k', '4k', '8k'];
  const want = size <= 1024 ? '1k' : size <= 2048 ? '2k' : '4k';
  return order.slice(order.indexOf(want)).find((r) => files[r]) ?? order.find((r) => files[r]);
};

const credits = [];
const catalog = { textures: {}, skies: {}, models: {} };
try {
  const prev = await import(`${CATALOG.href}?t=${Date.now()}`);
  Object.assign(catalog.textures, prev.TEXTURES ?? {});
  Object.assign(catalog.skies, prev.SKIES ?? {});
  Object.assign(catalog.models, prev.MODELS ?? {});
} catch {
  /* first run */
}

// ── Textures ──────────────────────────────────────────────────────────────

async function polyhavenMaps(id, size) {
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  const info = await json(`https://api.polyhaven.com/info/${id}`);
  const pick = (key) => {
    const set = files[key];
    if (!set) return null;
    const r = phRes(set, size);
    return set[r]?.jpg?.url ?? set[r]?.png?.url;
  };
  const dir = cachePath('tex', id);
  await ensureDir(dir);
  const get = async (key, name) => {
    const url = pick(key);
    return url ? fetchTo(url, `${dir}/${name}${url.slice(url.lastIndexOf('.'))}`) : null;
  };
  return {
    color: await get('Diffuse', 'color'),
    normal: await get('nor_gl', 'normal'),
    arm: await get('arm', 'arm'),
    ao: await get('AO', 'ao'),
    rough: await get('Rough', 'rough'),
    metal: await get('Metal', 'metal'),
    credit: { source: 'Poly Haven', url: `https://polyhaven.com/a/${id}`, authors: Object.keys(info.authors ?? {}).join(', ') },
  };
}

async function ambientcgMaps(id, size) {
  const res = size <= 1024 ? '1K' : size <= 2048 ? '2K' : '4K';
  const dir = cachePath('tex', id);
  await ensureDir(dir);
  const zip = await fetchTo(`https://ambientcg.com/get?file=${id}_${res}-JPG.zip`, `${dir}/${id}_${res}.zip`);
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  const names = await readdir(dir);
  const find = (suffix) => {
    const f = names.find((n) => n.endsWith(`_${suffix}.jpg`) || n.endsWith(`_${suffix}.png`));
    return f ? `${dir}/${f}` : null;
  };
  return {
    color: find('Color'),
    normal: find('NormalGL'),
    arm: null,
    ao: find('AmbientOcclusion'),
    rough: find('Roughness'),
    metal: find('Metalness'),
    opacity: find('Opacity'),
    credit: { source: 'ambientCG', url: `https://ambientcg.com/a/${id}`, authors: 'ambientCG' },
  };
}

async function texture(name, spec) {
  const size = spec.size ?? 1024;
  const [source, id] = spec.src.split(':');
  const maps = source === 'polyhaven' ? await polyhavenMaps(id, size) : await ambientcgMaps(id, size);
  const dir = outPath('tex', name);
  await ensureDir(dir);
  const sizes = {};
  // Each set at full size, and at half (no smaller than 256) for phones.
  const small = Math.max(256, size / 2);
  const save = async (img, file) => {
    await img.toFile(`${dir}/${file}`);
    sizes[file] = (await stat(`${dir}/${file}`)).size;
  };
  for (const [px, suffix] of [
    [size, ''],
    [small, `-${small}`],
  ]) {
    const fit = (file) => sharp(file).resize(px, px, { fit: 'fill', kernel: 'lanczos3' });

    // colour, with opacity in alpha when there is one
    let color = fit(maps.color);
    if (spec.tint) color = color.modulate(spec.tint);
    if (maps.opacity && spec.alpha) color = color.joinChannel(await fit(maps.opacity).greyscale().raw().toBuffer(), { raw: { width: px, height: px, channels: 1 } });
    await save(color.webp({ quality: spec.quality ?? 82, alphaQuality: 90, effort: 6 }), `color${suffix}.webp`);

    // normals and the packed map keep full chroma: subsampling would bend normals
    await save(fit(maps.normal).jpeg({ quality: 84, chromaSubsampling: '4:4:4', mozjpeg: true }), `normal${suffix}.jpg`);

    let arm;
    if (maps.arm) arm = fit(maps.arm);
    else {
      const ch = async (file, fallback) => (file ? fit(file).greyscale().raw().toBuffer() : Buffer.alloc(px * px, fallback));
      const [a, r, m] = await Promise.all([ch(maps.ao, 255), ch(maps.rough, spec.roughness ?? 180), ch(maps.metal, spec.metal ?? 0)]);
      const buf = Buffer.alloc(px * px * 3);
      for (let i = 0; i < px * px; i++) {
        buf[i * 3] = a[i];
        buf[i * 3 + 1] = r[i];
        buf[i * 3 + 2] = m[i];
      }
      arm = sharp(buf, { raw: { width: px, height: px, channels: 3 } });
    }
    await save(arm.jpeg({ quality: 82, chromaSubsampling: '4:4:4', mozjpeg: true }), `arm${suffix}.jpg`);
  }
  const total = (suffix) => sizes[`color${suffix}.webp`] + sizes[`normal${suffix}.jpg`] + sizes[`arm${suffix}.jpg`];

  catalog.textures[name] = { size, small, alpha: !!(maps.opacity && spec.alpha), bytes: total(''), smallBytes: total(`-${small}`), ...(spec.scale ? { scale: spec.scale } : {}) };
  credits.push({ kind: 'Texture', name, src: spec.src, ...maps.credit });
  console.log(`texture ${name.padEnd(18)} ${spec.src.padEnd(34)} ${kb(total(''))} · ${kb(total(`-${small}`))}`);
}

// ── Skies (Radiance HDR in and out) ──────────────────────────────────────

function readHDR(buf) {
  let pos = 0;
  const line = () => {
    let s = '';
    while (buf[pos] !== 0x0a) s += String.fromCharCode(buf[pos++]);
    pos++;
    return s;
  };
  while (line() !== '') {
    /* the header, up to a blank line */
  }
  const [, hs, , ws] = line().trim().split(/\s+/);
  const w = Number(ws);
  const h = Number(hs);
  const out = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (buf[pos] === 2 && buf[pos + 1] === 2 && ((buf[pos + 2] << 8) | buf[pos + 3]) === w) {
      pos += 4;
      for (let c = 0; c < 4; c++) {
        for (let x = 0; x < w; ) {
          let n = buf[pos++];
          if (n > 128) {
            n -= 128;
            const v = buf[pos++];
            while (n--) scan[(x++) * 4 + c] = v;
          } else while (n--) scan[(x++) * 4 + c] = buf[pos++];
        }
      }
    } else {
      for (let x = 0; x < w * 4; x++) scan[x] = buf[pos++];
    }
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? 2 ** (e - 136) : 0;
      const i = (y * w + x) * 3;
      out[i] = scan[x * 4] * f;
      out[i + 1] = scan[x * 4 + 1] * f;
      out[i + 2] = scan[x * 4 + 2] * f;
    }
  }
  return { w, h, data: out };
}

function writeHDR({ w, h, data }) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'ascii');
  const chunks = [head];
  const rgbe = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const m = Math.max(data[i], data[i + 1], data[i + 2]);
      if (m < 1e-32) rgbe.fill(0, x * 4, x * 4 + 4);
      else {
        const e = Math.ceil(Math.log2(m) + 1e-9);
        const f = 256 / 2 ** e;
        rgbe[x * 4] = Math.min(255, Math.floor(data[i] * f));
        rgbe[x * 4 + 1] = Math.min(255, Math.floor(data[i + 1] * f));
        rgbe[x * 4 + 2] = Math.min(255, Math.floor(data[i + 2] * f));
        rgbe[x * 4 + 3] = e + 128;
      }
    }
    // new-style run-length encoding, one channel at a time
    const row = [2, 2, w >> 8, w & 255];
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < w) {
        let run = 1;
        while (x + run < w && run < 127 && rgbe[(x + run) * 4 + c] === rgbe[x * 4 + c]) run++;
        if (run >= 3) {
          row.push(128 + run, rgbe[x * 4 + c]);
          x += run;
        } else {
          const start = x;
          let n = 0;
          while (x < w && n < 128) {
            let r = 1;
            while (x + r < w && r < 3 && rgbe[(x + r) * 4 + c] === rgbe[x * 4 + c]) r++;
            if (r >= 3) break;
            x++;
            n++;
          }
          row.push(n, ...Array.from({ length: n }, (_, k) => rgbe[(start + k) * 4 + c]));
        }
      }
    }
    chunks.push(Buffer.from(row));
  }
  return Buffer.concat(chunks);
}

function downsample({ w, h, data }, tw) {
  const k = w / tw;
  const th = Math.round(h / k);
  const out = new Float32Array(tw * th * 3);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = Math.floor(y * k); yy < Math.floor((y + 1) * k); yy++)
        for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) {
          const i = (yy * w + xx) * 3;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      const o = (y * tw + x) * 3;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
    }
  return { w: tw, h: th, data: out };
}

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

// The direction a pixel of an equirectangular map looks along, in three.js's
// convention (u = atan2(z, x) / 2π + 0.5, v up), the top row first.
const dirOf = (x, y, w, h) => {
  const u = (x + 0.5) / w;
  const v = 1 - (y + 0.5) / h;
  const theta = (u - 0.5) * 2 * Math.PI;
  const lat = (v - 0.5) * Math.PI;
  return [Math.cos(theta) * Math.cos(lat), Math.sin(lat), Math.sin(theta) * Math.cos(lat)];
};

async function sky(name, spec) {
  const id = spec.src;
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  const info = await json(`https://api.polyhaven.com/info/${id}`);
  const dir = cachePath('sky', id);
  await ensureDir(dir);
  const res = files.hdri['2k'] ? '2k' : '1k';
  const hdrFile = await fetchTo(files.hdri[res].hdr.url, `${dir}/${id}_${res}.hdr`);
  const full = readHDR(await readFile(hdrFile));

  // Find the sun: the brightest spot, if it stands well above the sky. A sun
  // low behind cloud (most of these skies are dusk) gives a direction and a
  // colour for the key light but stays in the map; a hard disc is taken out
  // of the lighting map, since the key light replaces it.
  let best = -1;
  let at = 0;
  const lums = new Float32Array(full.w * full.h);
  for (let i = 0; i < full.w * full.h; i++) {
    const L = lum(full.data, i * 3);
    lums[i] = L;
    if (L > best) {
      best = L;
      at = i;
    }
  }
  const sorted = Float32Array.from(lums).sort();
  const median = sorted[Math.floor(sorted.length / 2)];
  const p99 = sorted[Math.floor(sorted.length * 0.995)];
  let sun = null;
  const env = downsample(full, spec.env ?? 512);
  if (best > median * 25 && !spec.noSun) {
    const cx = at % full.w;
    const cy = Math.floor(at / full.w);
    const R = Math.round(full.w * 0.02);
    const limit = Math.max(p99 * 2, best * 0.25);
    let er = 0, eg = 0, eb = 0;
    let wx = 0, wy = 0, wz = 0;
    for (let y = Math.max(0, cy - R); y < Math.min(full.h, cy + R); y++) {
      const solid = ((2 * Math.PI) / full.w) * (Math.PI / full.h) * Math.cos(((y + 0.5) / full.h - 0.5) * Math.PI);
      for (let x = cx - R; x < cx + R; x++) {
        const xx = (x + full.w) % full.w;
        const i = (y * full.w + xx) * 3;
        const L = lum(full.data, i);
        if (L <= limit) continue;
        const k = (L - limit) / L;
        er += full.data[i] * k * solid;
        eg += full.data[i + 1] * k * solid;
        eb += full.data[i + 2] * k * solid;
        const d = dirOf(xx, y, full.w, full.h);
        wx += d[0] * L;
        wy += d[1] * L;
        wz += d[2] * L;
      }
    }
    const n = Math.hypot(wx, wy, wz) || 1;
    const peak = Math.max(er, eg, eb) || 1;
    sun = {
      dir: [wx / n, wy / n, wz / n].map((v) => Number(v.toFixed(4))),
      color: [er / peak, eg / peak, eb / peak].map((v) => Number(v.toFixed(3))),
      // irradiance from the bright region, in the HDR's own units
      power: Number(peak.toFixed(3)),
      disc: best > median * 200,
    };
    // a hard disc comes out of the lighting map
    if (sun.disc)
      for (let i = 0; i < env.w * env.h; i++) {
      const L = lum(env.data, i * 3);
      if (L > limit) {
        const k = limit / L;
        env.data[i * 3] *= k;
        env.data[i * 3 + 1] *= k;
        env.data[i * 3 + 2] *= k;
      }
    }
  }
  const outDir = outPath('sky', name);
  await ensureDir(outDir);
  await writeFile(`${outDir}/env.hdr`, writeHDR(env));
  let skyBytes = 0;
  if (spec.sky) {
    const jpg = await fetchTo(files.tonemapped.url, `${dir}/${id}_tonemapped.jpg`);
    await sharp(jpg, { limitInputPixels: false })
      .resize(spec.sky, spec.sky / 2, { kernel: 'lanczos3' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(`${outDir}/sky.jpg`);
    skyBytes = (await stat(`${outDir}/sky.jpg`)).size;
  }
  // average sky colour near the horizon, for fog
  let hr = 0, hg = 0, hb = 0, hn = 0;
  const y0 = Math.floor(env.h * 0.46);
  for (let y = y0; y < y0 + Math.max(2, Math.floor(env.h * 0.04)); y++)
    for (let x = 0; x < env.w; x++) {
      const i = (y * env.w + x) * 3;
      hr += env.data[i];
      hg += env.data[i + 1];
      hb += env.data[i + 2];
      hn++;
    }
  const envBytes = (await stat(`${outDir}/env.hdr`)).size;
  catalog.skies[name] = {
    sun,
    horizon: [hr / hn, hg / hn, hb / hn].map((v) => Number(v.toFixed(4))),
    sky: !!spec.sky,
    bytes: envBytes + skyBytes,
  };
  credits.push({ kind: 'Sky', name, src: `polyhaven:${id}`, source: 'Poly Haven', url: `https://polyhaven.com/a/${id}`, authors: Object.keys(info.authors ?? {}).join(', ') });
  console.log(`sky     ${name.padEnd(18)} ${id.padEnd(34)} env ${kb(envBytes)} sky ${kb(skyBytes)} sun ${sun ? sun.dir.join(',') : 'none'}`);
}

// ── Models ─────────────────────────────────────────────────────────────────

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

async function model(name, spec) {
  const id = spec.src;
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  const info = await json(`https://api.polyhaven.com/info/${id}`);
  const res = phRes(files.gltf, spec.source ?? 1024);
  const g = files.gltf[res].gltf;
  const dir = cachePath('models', id, res);
  await ensureDir(dir);
  const main = await fetchTo(g.url, `${dir}/${id}.gltf`);
  for (const [rel, v] of Object.entries(g.include)) {
    await ensureDir(`${dir}/${rel.slice(0, rel.lastIndexOf('/') + 1) || '.'}`);
    await fetchTo(v.url, `${dir}/${rel}`);
  }
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const doc = await io.read(main);
  const root = doc.getRoot();
  // keep only the named nodes (some files hold several variants side by side)
  if (spec.keep) {
    for (const n of root.listNodes()) if (n.getMesh() && !spec.keep.includes(n.getName())) n.dispose();
  }
  const tris = () =>
    root
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
  const before = tris();
  const steps = [dedup(), prune(), weld()];
  if (spec.simplify) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: spec.simplify, error: spec.error ?? 0.01, lockBorder: false }));
  steps.push(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.tex ?? 1024, spec.tex ?? 1024], quality: 84, slots: /^(?!normalTexture).*$/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.tex ?? 1024, spec.tex ?? 1024], nearLossless: true, quality: 60, slots: /^normalTexture$/ }),
  );
  if (spec.flatten !== false) steps.push(flatten());
  steps.push(join({ keepNamed: true }), prune(), reorder({ encoder: MeshoptEncoder }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...steps);
  const after = tris();
  await ensureDir(outPath('models'));
  const glb = await io.writeBinary(doc);
  await writeFile(outPath('models', `${name}.glb`), glb);

  // its size, for placing it in the world
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  const nodes = {};
  for (const n of root.listNodes()) {
    const m = n.getMesh();
    if (!m) continue;
    let nmin = [Infinity, Infinity, Infinity];
    let nmax = [-Infinity, -Infinity, -Infinity];
    const wm = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const x = wm[0] * v[0] + wm[4] * v[1] + wm[8] * v[2] + wm[12];
        const y = wm[1] * v[0] + wm[5] * v[1] + wm[9] * v[2] + wm[13];
        const z = wm[2] * v[0] + wm[6] * v[1] + wm[10] * v[2] + wm[14];
        nmin = [Math.min(nmin[0], x), Math.min(nmin[1], y), Math.min(nmin[2], z)];
        nmax = [Math.max(nmax[0], x), Math.max(nmax[1], y), Math.max(nmax[2], z)];
      }
    }
    nodes[n.getName()] = { min: nmin.map((v) => +v.toFixed(3)), max: nmax.map((v) => +v.toFixed(3)) };
    min = min.map((v, k) => Math.min(v, nmin[k]));
    max = max.map((v, k) => Math.max(v, nmax[k]));
  }
  catalog.models[name] = { min: min.map((v) => +v.toFixed(3)), max: max.map((v) => +v.toFixed(3)), tris: Math.round(after), bytes: glb.byteLength, nodes };
  credits.push({ kind: 'Model', name, src: `polyhaven:${id}`, source: 'Poly Haven', url: `https://polyhaven.com/a/${id}`, authors: Object.keys(info.authors ?? {}).join(', ') });
  console.log(`model   ${name.padEnd(18)} ${id.padEnd(34)} ${kb(glb.byteLength)} tris ${Math.round(before)} → ${Math.round(after)}`);
}

// ── Run ────────────────────────────────────────────────────────────────────

for (const [name, spec] of Object.entries(manifest.textures ?? {})) if (wanted('tex', name)) await texture(name, spec);
for (const [name, spec] of Object.entries(manifest.skies ?? {})) if (wanted('sky', name)) await sky(name, spec);
for (const [name, spec] of Object.entries(manifest.models ?? {})) if (wanted('model', name)) await model(name, spec);

// what's in the manifest, and nothing that was removed from it
const keepOnly = (obj, names) => Object.fromEntries(Object.entries(obj).filter(([k]) => names.includes(k)).sort(([a], [b]) => a.localeCompare(b)));
const T = keepOnly(catalog.textures, Object.keys(manifest.textures ?? {}));
const S = keepOnly(catalog.skies, Object.keys(manifest.skies ?? {}));
const M = keepOnly(catalog.models, Object.keys(manifest.models ?? {}));
await ensureDir(new URL('.', CATALOG).pathname);
await writeFile(
  CATALOG,
  `// Written by scripts/hq-assets.mjs: what's in public/hq/. Don't edit by hand.\n` +
    `export const TEXTURES = ${JSON.stringify(T, null, 1)};\n\n` +
    `export const SKIES = ${JSON.stringify(S, null, 1)};\n\n` +
    `export const MODELS = ${JSON.stringify(M, null, 1)};\n`,
);

// the credits, kept across partial runs
const creditFile = outPath('CREDITS.md');
let previous = [];
try {
  previous = JSON.parse((await readFile(creditFile, 'utf8')).match(/<!-- data (.*) -->/)[1]);
} catch {
  /* none yet */
}
const byKey = new Map(previous.map((c) => [`${c.kind}:${c.name}`, c]));
for (const c of credits) byKey.set(`${c.kind}:${c.name}`, c);
const names = new Set([...Object.keys(T).map((n) => `Texture:${n}`), ...Object.keys(S).map((n) => `Sky:${n}`), ...Object.keys(M).map((n) => `Model:${n}`)]);
const all = [...byKey.values()].filter((c) => names.has(`${c.kind}:${c.name}`)).sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name));
await writeFile(
  creditFile,
  `# Avengers HQ assets\n\nEvery texture, sky and model here is CC0 (public domain): free to use, no credit required. Credited anyway, with thanks.\n\n` +
    `| | Name | From | By |\n| --- | --- | --- | --- |\n` +
    all.map((c) => `| ${c.kind} | ${c.name} | [${c.source}](${c.url}) | ${c.authors || ''} |`).join('\n') +
    `\n\n<!-- data ${JSON.stringify(all)} -->\n`,
);
console.log('catalog and credits written');
