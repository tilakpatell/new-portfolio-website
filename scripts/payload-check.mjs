/* global window */
// What a route downloads before and just after its first frame, so a change
// to what loads when has a before and an after of the same measurement:
//
//   node scripts/payload-check.mjs [--route /] [--seconds 12] [--quality high]
//     [--visit return|first] [--top 15] [--json lab/payload/<name>.json] [--url http://127.0.0.1:4173] [--chromium /path]
//
// It serves dist/ with `vite preview` (build first: `npm run build`) unless
// --url names a server, opens the route in headless Chromium at 1280 × 720 as
// a returning visitor (the intro seen, the front door on the universe, as
// autopilot-check.mjs does; --visit first leaves storage empty, so the
// welcome and the intro's preloads run), and for the first --seconds counts
// every response by type (JavaScript, GLB, images, the rest), both as the
// bytes that came over the wire and unpacked (what the brief's sizes and
// Vite's build report say: a chunk's 321 kB is 109 kB gzipped), lists the biggest, the JavaScript chunks with when each arrived,
// and the first contentful paint. Headless Chromium draws in software, so
// the times are this machine's; the bytes are everyone's.
//
// On main before the front door's payload work (2026-10-06, `/`, high, 12 s):
//   assets 7.2 MB (GLB 3.6 MB, images 3.4 MB) in 293 requests; JavaScript
//   2.9 MB in 126 chunks; early: chewie.glb 721 kB, star-destroyer.glb
//   462 kB, megatron-orbit.glb 391 kB, optimus-orbit.glb 380 kB,
//   saucer.glb 380 kB, venator.glb 374 kB, transformers-glow-sm.webp
//   419 kB; fleet 321 kB, footScene 149 kB and trench 74 kB at about 1 s,
//   ModelCredits 93 kB and crews 65 kB at 0.5 s.
// The exact numbers, before and after, are in lab/payload/.
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else args[key] = argv[++i];
}
const route = typeof args.route === 'string' ? args.route : '/';
const seconds = Number(args.seconds) || 12;
const quality = ['high', 'mid', 'low'].includes(args.quality) ? args.quality : 'high';
const top = Number(args.top) || 15;
const first = args.visit === 'first';

// ── the server: vite preview of dist/, as autopilot-check.mjs starts it ──
let server = null;
let base = typeof args.url === 'string' ? args.url.replace(/\/$/, '') : null;
if (!base) {
  if (!existsSync(join(ROOT, 'dist/index.html'))) throw new Error('no dist/ to serve: npm run build first');
  const port = await new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  let down = null;
  server.on('exit', (code) => (down ??= `vite preview exited with ${code}`));
  base = `http://127.0.0.1:${port}`;
  const up = Date.now();
  for (;;) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (down || Date.now() - up > 30000) {
      server.kill();
      throw new Error(down ?? 'vite preview never answered');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([q, fresh]) => {
  if (!fresh) {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
  }
  window.localStorage.setItem('tp-quality', q);
  window.__fcp = null;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__fcp = e.startTime;
  }).observe({ type: 'paint', buffered: true });
}, [quality, first]);
const page = await ctx.newPage();
// the bytes over the wire, from the DevTools protocol (Playwright's own
// sizes don't count what a cache or the encoding saved)
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
const byId = new Map();
let t0 = null;
cdp.on('Network.requestWillBeSent', (e) => {
  t0 ??= e.timestamp;
  byId.set(e.requestId, { url: e.request.url, start: e.timestamp, type: e.type });
});
cdp.on('Network.responseReceived', (e) => {
  const r = byId.get(e.requestId);
  if (r) {
    r.mime = e.response.mimeType;
    r.status = e.response.status;
  }
});
cdp.on('Network.dataReceived', (e) => {
  const r = byId.get(e.requestId);
  if (r) r.raw = (r.raw ?? 0) + e.dataLength;
});
cdp.on('Network.loadingFinished', (e) => {
  const r = byId.get(e.requestId);
  if (r) {
    r.bytes = e.encodedDataLength;
    r.end = e.timestamp;
  }
});
const errors = [];
page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`));

await page.goto(`${base}/?quality=${quality}#${route}`, { waitUntil: 'commit', timeout: 120000 });
await page.waitForTimeout(seconds * 1000);
const fcp = await page.evaluate(() => window.__fcp);
await browser.close();
server?.kill();

// what kind each response is, by its path (the server's types can be generic)
const kindOf = (r) => {
  const path = new URL(r.url).pathname;
  if (/\.(m?js)$/.test(path)) return 'js';
  if (/\.glb$/.test(path)) return 'glb';
  if (/\.(webp|png|jpe?g|avif|ktx2|gif|svg|hdr|exr)$/.test(path)) return 'image';
  if (/\.css$/.test(path)) return 'css';
  if (/\.(woff2?|ttf|otf)$/.test(path)) return 'font';
  if (/\.(mp3|ogg|wav|m4a|opus)$/.test(path)) return 'audio';
  if (/\.json$/.test(path)) return 'json';
  if (/\.bin$/.test(path)) return 'bin';
  return 'other';
};
const done = [...byId.values()].filter((r) => r.end != null && r.url.startsWith(base) && r.end - t0 <= seconds);
for (const r of done) {
  r.kind = kindOf(r);
  r.path = decodeURIComponent(new URL(r.url).pathname);
  r.at = r.end - t0;
  // (Chromium tells no data events for some, images among them: their bytes
  // as they came, then)
  if (!r.raw) r.raw = r.bytes ?? 0;
}
const sum = (list) => list.reduce((s, r) => s + (r.bytes ?? 0), 0);
const sumRaw = (list) => list.reduce((s, r) => s + (r.raw ?? 0), 0);
const kinds = {};
for (const r of done) {
  kinds[r.kind] ??= { bytes: 0, raw: 0, requests: 0 };
  kinds[r.kind].bytes += r.bytes ?? 0;
  kinds[r.kind].raw += r.raw ?? 0;
  kinds[r.kind].requests++;
}
const js = done.filter((r) => r.kind === 'js').sort((a, b) => a.at - b.at);
const assets = done.filter((r) => r.kind !== 'js');
// a chunk's name without its hash (dist/assets/fleet-AbC123.js → fleet)
const chunk = (p) => p.replace(/^.*\//, '').replace(/-[A-Za-z0-9_-]{8}\.m?js$/, '');
const kB = (b) => `${(b / 1000).toFixed(0)} kB`;
const MB = (b) => `${(b / 1e6).toFixed(2)} MB`;
const report = {
  route,
  visit: first ? 'first' : 'return',
  quality,
  seconds,
  viewport: [1280, 720],
  fcpMs: fcp == null ? null : Math.round(fcp),
  // bytes: over the wire; raw: unpacked
  assets: { bytes: sum(assets), raw: sumRaw(assets), requests: assets.length },
  js: { bytes: sum(js), raw: sumRaw(js), chunks: js.length },
  kinds,
  biggest: [...assets].sort((a, b) => b.bytes - a.bytes).slice(0, top).map((r) => ({ path: r.path, bytes: r.bytes, at: Number(r.at.toFixed(2)) })),
  chunks: js.map((r) => ({ name: chunk(r.path), bytes: r.bytes, raw: r.raw, at: Number(r.at.toFixed(2)) })),
  errors: [...new Set(errors)].slice(0, 10),
};

console.log(`${route} on ${quality}, a ${first ? 'first' : 'returning'} visit, first ${seconds} s, 1280 × 720`);
console.log(`first contentful paint ${report.fcpMs ?? '?'} ms`);
console.log(`assets ${MB(report.assets.bytes)} in ${report.assets.requests} requests; JavaScript ${MB(report.js.bytes)} over the wire, ${MB(report.js.raw)} unpacked, in ${report.js.chunks} chunks`);
console.log('         wire  unpacked');
for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1].bytes - a[1].bytes)) console.log(`  ${k.padEnd(6)} ${MB(v.bytes).padStart(9)} ${MB(v.raw).padStart(9)}  ${String(v.requests).padStart(4)} requests`);
console.log('\nbiggest assets');
for (const r of report.biggest) console.log(`  ${kB(r.bytes).padStart(8)}  ${r.at.toFixed(2).padStart(5)} s  ${r.path}`);
console.log('\nJavaScript chunks over 40 kB unpacked, by arrival (wire, unpacked)');
for (const c of report.chunks.filter((c) => c.raw > 40000)) console.log(`  ${c.at.toFixed(2).padStart(5)} s  ${kB(c.bytes).padStart(8)} ${kB(c.raw).padStart(8)}  ${c.name}`);
if (report.errors.length) {
  console.log('\nerrors');
  for (const e of report.errors) console.log(`  ${e}`);
}
if (typeof args.json === 'string') {
  const out = resolve(ROOT, args.json);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nwrote ${args.json}`);
}
