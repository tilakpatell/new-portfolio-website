/* global window, document, getComputedStyle */
// Takes every tour of the site end to end in headless Chromium (software
// WebGL, as scripts/autopilot-check.mjs does) and says how each stop came
// out: lit round its target, or a card in the middle; how long its text is;
// which page it was on; how long it took to show. Fails on a stop that never
// showed, a tour that got stuck or closed early, a finish that didn't record
// itself (tp-tour, the achievement), or a console error that isn't known
// noise (scripts/lib/noise.mjs).
//
//   node scripts/tour-check.mjs [--phone | --both] [--tour classic,universe,recruiter,player,mixed]
//     [--shots <name>] [--no-build] [--strict] [--quality high|mid|low] [--chromium /path/to/chrome]
//
// The view tours (classic, on /home; universe, on /universe) start as ⌘K
// starts them, with the tp:tour event. The audience tours (recruiter, player,
// mixed) start from their links (/#/home?tour=hiring, /#/universe?tour=player,
// /#/home?tour=all); a build without them shows no tour there, and that
// audience is skipped (a failure with --strict). dist/ is rebuilt first when
// it's older than the source (vite build, as autopilot-check runs it: no
// prebuild, so no network). With --shots, a PNG per stop goes to
// /tmp/tour-check/<name>/ (a phone/ or desktop/ folder under it with --both),
// named <tour>-<nn>-<title>.png. The tables print as markdown, for a PR.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort, noisy } from './lib/noise.mjs';

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
const list = (s) => (typeof s === 'string' ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

// how each tour starts, and what finishing it must leave behind
const TOURS = {
  classic: { view: true, route: '/home' },
  universe: { view: true, route: '/universe' },
  recruiter: { audience: 'recruiter', route: '/home?tour=hiring', unlocks: ['tourRecruiter'] }, // the owner's link says hiring
  player: { audience: 'player', route: '/universe?tour=player', unlocks: ['tourPlayer'] },
  mixed: { audience: 'mixed', route: '/home?tour=all', unlocks: ['tourRecruiter', 'tourPlayer'] },
};
const picked = list(args.tour).length ? list(args.tour) : Object.keys(TOURS);
const unknown = picked.filter((t) => !TOURS[t]);
if (unknown.length) {
  console.log(`unknown tour: ${unknown.join(', ')} (have ${Object.keys(TOURS).join(', ')})`);
  process.exit(2);
}
const modes = args.both ? ['desktop', 'phone'] : [args.phone ? 'phone' : 'desktop'];
const strict = Boolean(args.strict);
const quality = ['high', 'mid', 'low'].includes(args.quality) ? args.quality : 'high';
const shotsDir = typeof args.shots === 'string' ? join('/tmp/tour-check', args.shots.replace(/[^\w.-]+/g, '-')) : null;
if (args.shots === true) console.log('note: --shots takes a name (--shots tours-0007)');

const MAX_STOPS = 120;
const STOP_WAIT = 25000; // for a stop to show (lit, or a card in the middle that isn't waiting): a world's page takes a while to come
const MOVE_WAIT = 3000; // for Next to move it on
const STEADY = 500; // a stop counts once its card has held still this long (a page change re-renders it in steps)
const STEADY_CENTRE = 3000; // longer for a card in the middle: a target far down the page is scrolled to first
const AUDIENCE_WAIT = 6000; // for an audience link to start a tour, once the page is up

const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
const head = (s) => console.log(`\n── ${s} (${since()})`);
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 40) || 'stop';
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ');

// ── dist/, rebuilt when the source is newer ──
async function newest(path) {
  const s = await stat(path).catch(() => null);
  if (!s) return 0;
  if (!s.isDirectory()) return s.mtimeMs;
  let m = 0;
  for (const e of await readdir(path, { withFileTypes: true })) m = Math.max(m, await newest(join(path, e.name)));
  return m;
}
if (!args['no-build']) {
  const built = (await stat(join(ROOT, 'dist/index.html')).catch(() => null))?.mtimeMs ?? 0;
  const source = Math.max(...(await Promise.all(['src', 'index.html', 'vite.config.js', 'package.json'].map((p) => newest(join(ROOT, p))))));
  if (source > built) {
    head(built ? 'build (dist/ is older than the source)' : 'build (no dist/)');
    const r = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) {
      console.log('\nFAIL the build. Fix that first.');
      process.exit(1);
    }
  } else console.log('dist/ is up to date');
}
if (!existsSync(join(ROOT, 'dist/index.html'))) {
  console.log('FAIL no dist/ to serve (build first, or drop --no-build)');
  process.exit(1);
}

// ── the server and the browser, as autopilot-check has them ──
const { chromium } = await import('playwright-core');
const port = await freePort();
const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
// the server goes with the script, however it ends
process.on('exit', () => server.kill());
let serverDown = null;
server.on('error', (e) => (serverDown = e.message));
server.on('exit', (code) => (serverDown ??= `vite preview exited with ${code}`));
const base = `http://127.0.0.1:${port}`;
const up = Date.now();
for (;;) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not yet */
  }
  if (serverDown || Date.now() - up > 30000) {
    server.kill();
    console.log(`FAIL ${serverDown ?? 'vite preview never answered'}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 300));
}
const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
if (!exe) {
  server.kill();
  console.log('FAIL no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });

// ── in the page ──
// the stop on show: { sig, count, title, text, lit, side, waiting, done } or { gone }
const readStop = () => {
  const tour = document.querySelector('.tour');
  const card = tour?.querySelector('.tour-card');
  if (!card) return { gone: true };
  const txt = (sel) => card.querySelector(sel)?.textContent.trim() ?? '';
  const spot = tour.querySelector('.tour-spot');
  const r = spot?.getBoundingClientRect();
  const count = txt('.tour-count');
  const title = txt('.tour-title');
  const text = txt('.tour-text');
  const next = card.querySelector('.tour-buttons .btn-primary')?.textContent.trim() ?? '';
  return {
    count,
    title,
    text,
    sig: `${count}|${title}|${text}`,
    lit: Boolean(r && r.width >= 1 && r.height >= 1),
    side: card.dataset.side ?? '',
    shown: getComputedStyle(card).visibility !== 'hidden',
    waiting: tour.dataset.waiting !== undefined,
    // a world asking whether to download its 3D (the tour holds for the answer)
    gate: Boolean(document.querySelector('.world-gate')),
    done: /^Done\b/.test(next),
    // a stop that lets keys through to try them (spec 8, A4)
    release: document.documentElement.dataset.touring === 'release',
    route: window.location.hash.replace(/^#/, '') || '/',
  };
};
const ready = (s) => !s.gone && s.shown && !s.waiting && (s.lit || (s.side === 'center' && s.text.length > 0));

async function stopNow(page) {
  return page.evaluate(readStop).catch(() => ({ gone: true }));
}
// polls until `ok(stop)` or the time's up; the last look either way
async function until(page, ok, ms) {
  const end = Date.now() + ms;
  for (;;) {
    const s = await stopNow(page);
    if (ok(s) || Date.now() > end) return s;
    await page.waitForTimeout(100);
  }
}

// a terminal colour code (built, so the pattern holds no control character)
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

// At a stop that lets keys through: ? opens the guide over the tour (the
// guide's panel, #guide-panel, which isn't aria-modal; the tour marks itself
// `data-over` while anything is over it), Esc closes it and leaves the tour
// where it was. Esc only if something opened, since at a stop that lets only
// the palette through it would end the tour. A stop that asks for ? (its
// card says "press ?" or "try ?") must open the guide.
const over = () => Boolean(document.getElementById('guide-panel')) || document.querySelector('.tour')?.dataset.over !== undefined;
const clear = () => !document.getElementById('guide-panel') && document.querySelector('.tour')?.dataset.over === undefined;
// (polled on an interval: the universe's 3D starves the animation frames
// Playwright's default polling waits on)
const POLL = { timeout: 1500, polling: 100 };
async function tryRelease(page, n, s) {
  await page.keyboard.press('?');
  const opened = await page.waitForFunction(over, null, POLL).then(() => true, () => false);
  if (!opened) return /\b(press|try) \?/i.test(s.text) ? [`stop ${n} “${s.title}”: it asks for ? but ? opened nothing`] : [];
  await page.keyboard.press('Escape');
  const closed = await page.waitForFunction(clear, null, POLL).then(() => true, () => false);
  const after = await stopNow(page);
  if (after.gone) return [`stop ${n} “${s.title}”: Esc after ? ended the tour, not the guide`];
  if (!closed) return [`stop ${n} “${s.title}”: Esc didn't close the guide`];
  return [];
}

// the stop once its card is ready and has held the same for STEADY ms: on
// a page change the card is redrawn in steps (the count first, then the
// stop), and a key pressed in between would skip a stop
async function steady(page, ms) {
  let end = Date.now() + ms;
  let last = null;
  let since = 0;
  for (;;) {
    const s = await stopNow(page);
    if (s.gone) return s;
    // a world's gate: answered "keep it light" (software WebGL asks on a
    // laptop too), as a phone would; the tour then tours the light version
    if (s.gate) {
      await page.$eval('.world-gate-x', (b) => b.click()).catch(() => {});
      end = Date.now() + ms;
    }
    if (!last || s.sig !== last.sig || !ready(s)) since = Date.now();
    last = s;
    if (ready(s) && Date.now() - since >= (s.lit ? STEADY : STEADY_CENTRE)) return s;
    if (Date.now() > end) return s;
    await page.waitForTimeout(100);
  }
}

// the page up and settled enough for its tour's targets to be there
async function settle(page, route) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  if (route.startsWith('/universe')) {
    await page.waitForSelector('canvas', { timeout: 90000, state: 'attached' }).catch(() => {});
    await page.waitForSelector('[data-tour~="panel"]', { timeout: 30000, state: 'visible' }).catch(() => {});
    await page.waitForTimeout(4000);
  } else {
    await page.waitForSelector('[data-tour]', { timeout: 30000, state: 'attached' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
}

async function walk(name, mode) {
  const spec = TOURS[name];
  const phone = mode === 'phone';
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: phone, deviceScaleFactor: 1 });
  await ctx.addInitScript(
    ({ q, view }) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-quality', q);
      // the first arrival's offer, made already (an audience link brings its
      // own tour, and whatever the new engine keeps there is its own)
      if (view && window.localStorage.getItem('tp-tour') == null) window.localStorage.setItem('tp-tour', '"offered"');
    },
    { q: quality, view: Boolean(spec.view) },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (!noisy(text)) errors.push(`console: ${text.slice(0, 300)}`);
  });

  const res = { name, mode, stops: [], failures: [], skipped: null };
  const dir = shotsDir && (modes.length > 1 ? join(shotsDir, mode) : shotsDir);
  if (dir) await mkdir(dir, { recursive: true });
  try {
    await page.goto(`${base}/#${spec.route}`, { waitUntil: 'load', timeout: 120000 });
    await settle(page, spec.route.split('?')[0]);
    if (spec.view) {
      await page.evaluate(() => window.dispatchEvent(new Event('tp:tour')));
      if (!(await page.waitForSelector('.tour', { timeout: 15000, state: 'attached' }).then(() => true, () => false))) res.failures.push('the tour never opened on tp:tour');
    } else if (!(await page.waitForSelector('.tour', { timeout: AUDIENCE_WAIT, state: 'attached' }).then(() => true, () => false))) {
      // an engine that knows audiences takes the ?tour= off the address and
      // keeps its progress as JSON: then no tour is a failure, not a skip
      const known = await page.evaluate(() => !/[?&]tour=/.test(window.location.hash) || /^\{/.test(window.localStorage.getItem('tp-tour') ?? ''));
      if (known) res.failures.push(`the engine took /#${spec.route} but no tour showed`);
      else {
        res.skipped = `not available in this build (engine not merged): no tour from /#${spec.route}`;
        if (strict) res.failures.push(res.skipped);
      }
    }

    if (!res.failures.length && !res.skipped) {
      let prev = null;
      for (let n = 1; ; n++) {
        if (n > MAX_STOPS) {
          res.failures.push(`more than ${MAX_STOPS} stops: a loop?`);
          break;
        }
        const from = Date.now();
        if (prev) {
          await page.keyboard.press('ArrowRight');
          const moved = await until(page, (s) => s.gone || s.sig !== prev.sig, MOVE_WAIT);
          if (moved.gone) {
            res.failures.push(`stop ${n}: the tour closed after “${prev.title}” (not on Done)`);
            break;
          }
          if (moved.sig === prev.sig) {
            res.failures.push(`stop ${n - 1} “${prev.title}”: stuck (Next didn't move it on in ${MOVE_WAIT / 1000} s)`);
            break;
          }
        }
        const s = await steady(page, STOP_WAIT);
        const waited = Date.now() - from;
        if (s.gone) {
          res.failures.push(`stop ${n}: the tour closed`);
          break;
        }
        if (!ready(s)) {
          res.failures.push(`stop ${n} “${s.title || s.count}”: neither lit nor a centred card after ${STOP_WAIT / 1000} s${s.waiting ? ' (still waiting)' : ''}`);
          res.stops.push({ n, count: s.count, title: s.title, how: 'FAIL', words: 0, route: s.route, waited });
          break;
        }
        const words = s.text ? s.text.split(/\s+/).length : 0;
        res.stops.push({ n, count: s.count, title: s.title, how: s.lit ? 'lit' : 'centre', words, route: s.route, waited });
        if (dir) await page.screenshot({ path: join(dir, `${name}-${String(n).padStart(2, '0')}-${slug(s.title)}.png`), timeout: 60000 }).catch(() => {});
        prev = s;
        if (s.release) res.failures.push(...(await tryRelease(page, n, s)));
        if (s.done) {
          // (the button's own click: Playwright's click waits on animation
          // frames to scroll and to see it still, and the universe's
          // software-rendered 3D starves them; the card itself is still)
          await page.$eval('.tour-card .tour-buttons .btn-primary', (b) => b.click());
          const closed = await page.waitForSelector('.tour', { state: 'detached', timeout: 5000 }).then(() => true, () => false);
          if (!closed) res.failures.push('Done didn’t close the tour');
          await page.waitForTimeout(300);
          res.failures.push(...(await finished(page, spec)));
          break;
        }
      }
    }
  } catch (e) {
    // (Playwright's call log, uncoloured, says what it was waiting for)
    res.failures.push(`didn't run: ${String(e.message ?? e).replace(ANSI, '').split('\n').slice(0, 6).join(' / ')}`);
  }
  for (const e of [...new Set(errors)]) res.failures.push(e);
  await ctx.close();
  return res;
}

// what finishing must leave behind: tp-tour saying so, and the achievement(s)
async function finished(page, spec) {
  const { tour, got } = await page.evaluate(() => {
    const read = (k) => {
      try {
        return JSON.parse(window.localStorage.getItem(k));
      } catch {
        return window.localStorage.getItem(k);
      }
    };
    return { tour: read('tp-tour'), got: read('tp-achievements') };
  });
  const out = [];
  const have = Array.isArray(got) ? got : [];
  const done = tour && typeof tour === 'object' ? tour.done : undefined;
  if (spec.view) {
    const ok = tour === 'done' || done === true || (Array.isArray(done) && done.length > 0);
    if (!ok) out.push(`tp-tour isn't marked done (it's ${JSON.stringify(tour)})`);
    if (!have.includes('tour')) out.push('the tour achievement wasn’t unlocked');
  } else {
    const list = Array.isArray(done) ? done : [];
    const ok = spec.audience === 'mixed' ? list.includes('mixed') || list.includes('all') || (list.includes('recruiter') && list.includes('player')) : list.includes(spec.audience);
    if (!ok) out.push(`tp-tour's done doesn't include ${spec.audience} (it's ${JSON.stringify(tour)})`);
    for (const a of spec.unlocks) if (!have.includes(a)) out.push(`the ${a} achievement wasn’t unlocked`);
  }
  return out;
}

// ── run them ──
const results = [];
for (const mode of modes) {
  for (const name of picked) {
    head(`${name} (${mode})`);
    const r = await walk(name, mode);
    results.push(r);
    if (r.skipped && !strict) console.log(`skip ${name}: ${r.skipped}`);
    else console.log(`${r.failures.length ? 'FAIL' : 'ok  '} ${name}: ${r.stops.length} stops`);
  }
}
await browser.close();

head('tours');
for (const r of results) {
  const label = `${r.name} (${r.mode})`;
  if (r.skipped && !strict) {
    console.log(`\n### ${label}: ${r.failures.length ? 'FAIL' : 'skipped'}\n\n${r.skipped}`);
    for (const f of r.failures) console.log(`- FAIL ${f}`);
    continue;
  }
  console.log(`\n### ${label}: ${r.failures.length ? 'FAIL' : 'PASS'}\n`);
  if (r.stops.length) {
    console.log('| # | title | lit/centre | words | route | wait ms |');
    console.log('|--:|---|---|--:|---|--:|');
    for (const s of r.stops) console.log(`| ${s.n} | ${cell(s.title)} | ${s.how} | ${s.words} | \`${cell(s.route)}\` | ${s.waited} |`);
  }
  const ok = r.stops.filter((s) => s.how !== 'FAIL');
  const lit = ok.filter((s) => s.how === 'lit').length;
  const words = ok.reduce((t, s) => t + s.words, 0);
  console.log(`\n**${label}**: ${ok.length} stops, ${lit} lit, ${ok.length - lit} centred, ${words} words, ~${mmss(words / 3 + 4 * ok.length)} to read`);
  for (const f of r.failures) console.log(`- FAIL ${f}`);
}
const failed = results.filter((r) => r.failures.length);
console.log(`\n**Overall: ${failed.length ? 'FAIL' : 'PASS'}** (${results.length - failed.length}/${results.length} tours${results.some((r) => r.skipped && !strict) ? `, ${results.filter((r) => r.skipped && !strict).length} skipped` : ''}; ${since()})`);
process.exit(failed.length ? 1 : 0);
