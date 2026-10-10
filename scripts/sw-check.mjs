// The install, end to end in headless Chromium, against a built site served
// by `npx vite preview` (or --base): Install a world on /worlds, see its
// pack in the Cache API and the service worker registered, reload the world
// and see its models come from the service worker, the page itself and a
// file outside the pack not; then Remove, and see the caches and the worker
// go. Exit 1 on a failure.
//
//   npx vite build && npx vite preview &   node scripts/sw-check.mjs [--base http://127.0.0.1:4173] [--route /earth]
//
// With --bucket, the asset bucket too, on its own: a local server stands in
// for it (public/ by hash, with CORS), the site is built against it into a
// temporary folder with a manifest of every heavy file and previewed on 4175,
// and the check also sees the pack list bucket files, the install fetch them
// across origins, and a reload answer them from the service worker.
//
//   node scripts/sw-check.mjs --bucket [--route /avengers]

/* global window, caches */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { KINDS, hashOf, manifestOf, remoteFiles } from './assets-upload.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const bucket = process.argv.includes('--bucket');
const route = arg('route', bucket ? '/avengers' : '/earth');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUCKET = 'http://127.0.0.1:4174/assets';

// the stand-in bucket: /assets/<hash>/<path> is public/<path> when the hash is its own
const bucketAsked = [];
let stand = null;
let preview = null;
let tmp = null;
let base = arg('base', 'http://127.0.0.1:4173').replace(/\/$/, '');
if (bucket) {
  stand = createServer((req, res) => {
    const m = /^\/assets\/([0-9a-f]{12})\/(.+)$/.exec(decodeURIComponent(new URL(req.url, BUCKET).pathname));
    const file = m && join(ROOT, 'public', m[2]);
    bucketAsked.push(req.url);
    if (!m || !existsSync(file) || hashOf(readFileSync(file)) !== m[1]) {
      res.writeHead(404, { 'access-control-allow-origin': '*' }).end();
      return;
    }
    res.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': KINDS[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'max-age=31536000' }).end(readFileSync(file));
  }).listen(4174, '127.0.0.1');
  tmp = mkdtempSync(join(tmpdir(), 'sw-bucket-'));
  writeFileSync(join(tmp, 'manifest.json'), JSON.stringify(manifestOf(remoteFiles(join(ROOT, 'public')))));
  const env = { ...process.env, VITE_ASSET_BASE: BUCKET, ASSET_MANIFEST: join(tmp, 'manifest.json') };
  console.log('building against the stand-in bucket…');
  const built = spawnSync('npx', ['vite', 'build', '--outDir', join(tmp, 'dist'), '--emptyOutDir'], { cwd: ROOT, env, encoding: 'utf8' });
  if (built.status !== 0) {
    console.log(built.stdout.slice(-2000), built.stderr.slice(-2000));
    process.exit(1);
  }
  // (vite itself, in a group of its own, so the whole of it stops with the check)
  preview = spawn(join(ROOT, 'node_modules/.bin/vite'), ['preview', '--outDir', join(tmp, 'dist'), '--port', '4175', '--strictPort'], { cwd: ROOT, env, stdio: 'ignore', detached: true });
  base = 'http://127.0.0.1:4175';
  for (let i = 0; i < 60 && !(await fetch(`${base}/packs/index.json`).then((r) => r.ok, () => false)); i++) await new Promise((r) => setTimeout(r, 500));
}
const slug = route.replace(/\//g, '-').replace(/^-/, '');
const exe =
  process.env.CHROMIUM ??
  readdirSync('/opt/pw-browsers', { withFileTypes: true })
    .filter((d) => /^chromium-\d+$/.test(d.name))
    .map((d) => `/opt/pw-browsers/${d.name}/chrome-linux/chrome`)
    .find(existsSync);

const problems = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) problems.push(what);
};

const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  const index = await (await fetch(`${base}/packs/index.json`)).json();
  const pack = await (await fetch(`${base}/packs/${slug}.json`)).json();
  check(index[route]?.v === pack.v, `the build lists ${route}'s pack (${(pack.bytes / 1048576).toFixed(1)} MB, ${pack.files.length} files)`);
  const far = pack.files.filter((f) => f.local);
  if (bucket) check(far.length > 0 && far.every((f) => f.url.startsWith(`${BUCKET}/`)), `the pack lists ${far.length} files from the bucket`);

  // nothing installed: no worker
  await page.goto(`${base}/#/worlds`, { waitUntil: 'load' });
  const label = await page.locator(`[data-world="${route}"] a`).first().textContent({ timeout: 30000 });
  check((await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))) === 0, 'no service worker before anything is installed');

  await page.getByRole('button', { name: `Install ${label}` }).click();
  await page.getByRole('button', { name: `Remove ${label}` }).waitFor({ timeout: 300000 });
  const names = await page.evaluate(() => caches.keys());
  check(names.includes(`tp-pack-${slug}-${pack.v}`), `the install made tp-pack-${slug}-${pack.v}`);
  if (bucket) check(far.every((f) => bucketAsked.some((u) => f.url.endsWith(u))), 'the install fetched them from the bucket, across origins');
  check(await page.evaluate(() => navigator.serviceWorker.ready.then((r) => Boolean(r.active))), 'the service worker is registered and active');

  // the world, reloaded: its files from the worker
  const served = [];
  // (a file of the site by its path, one from the bucket by its whole URL, as the pack lists them)
  page.on('response', (r) => served.push({ url: r.url().startsWith(base) ? new URL(r.url()).pathname : r.url(), sw: r.fromServiceWorker() }));
  await page.goto(`${base}/#${route}`, { waitUntil: 'load' });
  // (software WebGL holds the world: the gate's card says it's on this device, Open)
  const open = page.getByRole('button', { name: 'Open', exact: true });
  if (await open.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    check(true, 'the card says Open for an installed world');
    await open.click();
  }
  const doc = await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 90000, state: 'attached' }).catch(() => {});
  await page.waitForTimeout(8000);
  const inPack = new Set(pack.files.map((f) => f.url));
  const fromSw = served.filter((s) => s.sw).map((s) => s.url);
  // (its models and textures: a world may load a model only later, Earth's plane when flown)
  const media = fromSw.filter((u) => !u.startsWith('/assets/'));
  const requested = served.filter((s) => inPack.has(s.url) && !s.url.startsWith('/assets/'));
  check(media.length > 0 && media.length === requested.length, `a reload serves its models and textures from the service worker (${media.length} of ${requested.length}: ${media.slice(0, 3).join(', ')})`);
  check(fromSw.some((u) => u.startsWith('/assets/')), 'and its code');
  const strays = fromSw.filter((u) => !inPack.has(u));
  check(!strays.length, `and nothing outside its pack${strays.length ? `: ${strays.slice(0, 3).join(', ')}` : ''}`);
  if (bucket) check(fromSw.some((u) => u.startsWith(`${BUCKET}/`)), `and the bucket's files (${fromSw.filter((u) => u.startsWith(`${BUCKET}/`)).length})`);
  check(!doc.fromServiceWorker(), 'the page itself comes from the network');
  const [outside] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/robots.txt')), page.evaluate(() => fetch('/robots.txt').then((r) => r.text()))]);
  check(!outside.fromServiceWorker(), 'a file outside every pack is left alone');

  // Remove: the caches and the worker go
  await page.goto(`${base}/#/worlds`, { waitUntil: 'load' });
  await page.getByRole('button', { name: `Remove ${label}` }).click();
  await page.getByRole('button', { name: `Install ${label}` }).waitFor({ timeout: 30000 });
  check((await page.evaluate(() => caches.keys())).every((n) => !n.startsWith('tp-pack-')), 'Remove deletes its cache');
  await page.waitForTimeout(500);
  check((await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))) === 0, 'and the service worker goes with the last pack');
  check(!errors.length, `no page errors${errors.length ? `: ${errors[0]}` : ''}`);
} catch (e) {
  check(false, `didn't finish: ${String(e.message ?? e).split('\n')[0]}`);
}
await browser.close();
if (preview) process.kill(-preview.pid);
stand?.close();
if (tmp) rmSync(tmp, { recursive: true, force: true });
if (problems.length) process.exit(1);
console.log('sw check: the install works');
