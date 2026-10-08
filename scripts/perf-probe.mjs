/* global window, document, requestAnimationFrame, WebGL2RenderingContext, WebGLRenderingContext, HTMLImageElement */
// How smooth the worlds draw, measured in a real browser on the real
// graphics chip: every frame's time, and what the graphics chip was sent in
// it (shaders linked, pictures and buffers uploaded, draws and triangles),
// so a hitch can be told from a slow scene and a hitch's cause named.
//
//   node scripts/perf-probe.mjs [journey ...]      (all of them with none named)
//   node scripts/perf-probe.mjs --list
//
// With BASE unset it starts its own Vite (on 5294) and stops it after; with
// BASE set (a dev server already up) it uses that. CHROME is the Chromium
// to drive (Playwright's own on a Mac, on Metal, uncapped: no vsync, no
// frame-rate limit, so a frame's time is what it cost). VIEW is the window
// (default 1470x956@2, a 13" laptop's retina screen), QUALITY pins the
// device tier (?quality=), OUT is where the JSON report goes. Each journey
// prints a table: a row per phase (load, idle, move...), with the frame
// times' spread, the hitches (frames over 50 and 100 ms), and what the
// worst frames were spent on.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const profile = Boolean(process.env.PROFILE);
const trace = Boolean(process.env.TRACE);
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? '';
const [vw, vh, vdpr] = (process.env.VIEW ?? '1470x956@2').match(/(\d+)x(\d+)(?:@([\d.]+))?/).slice(1).map(Number);

// ── what's recorded in the page ──
// A rAF of its own (one a frame), the GL calls that cost (shader links,
// uploads) counted and timed per frame, draws and triangles counted, and
// the browser's long animation frames with the scripts in them.
function recorder() {
  const zero = () => ({ links: 0, compiles: 0, glMs: 0, drawMs: 0, tex: 0, texBytes: 0, buf: 0, bufBytes: 0, draws: 0, tris: 0 });
  let cur = zero();
  const frames = []; // [t, links, texUploads, texMB, bufMB, draws, tris, glMs, drawMs]
  const loaf = [];
  const tick = () => {
    const c = cur;
    frames.push([performance.now(), c.links, c.tex, c.texBytes / 1048576, c.bufBytes / 1048576, c.draws, c.tris, c.glMs, c.drawMs]);
    cur = zero();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const timed = (proto, name, add) => {
    const fn = proto[name];
    if (typeof fn !== 'function') return;
    proto[name] = function (...a) {
      const t0 = performance.now();
      try {
        return fn.apply(this, a);
      } finally {
        cur.glMs += performance.now() - t0;
        add?.(a);
      }
    };
  };
  // (TRACE times the draws too: a draw whose shader is still linking waits
  // for it, and that wait shows here; it costs a little on every draw)
  const trace = Boolean(window.__probeTrace);
  const counted = (proto, name, add) => {
    const fn = proto[name];
    if (typeof fn !== 'function') return;
    proto[name] = trace
      ? function (...a) {
          add(a);
          const t0 = performance.now();
          try {
            return fn.apply(this, a);
          } finally {
            cur.drawMs += performance.now() - t0;
          }
        }
      : function (...a) {
          add(a);
          return fn.apply(this, a);
        };
  };
  const side = (s) => (s ? [s.width ?? s.naturalWidth ?? s.videoWidth ?? 0, s.height ?? s.naturalHeight ?? s.videoHeight ?? 0] : [0, 0]);
  const texBytes = (a) => {
    // (target, level, internal, w, h, border, format, type, pixels) or (target, level, internal, format, type, source)
    if (a.length >= 8 && typeof a[3] === 'number' && typeof a[4] === 'number') return a[3] * a[4] * 4;
    const [w, h] = side(a[a.length - 1] instanceof HTMLImageElement || typeof a[a.length - 1] === 'object' ? a[a.length - 1] : null);
    return w * h * 4;
  };
  const TRIANGLES = 4;
  for (const C of [typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext : null, typeof WebGLRenderingContext !== 'undefined' ? WebGLRenderingContext : null]) {
    if (!C) continue;
    const p = C.prototype;
    timed(p, 'linkProgram', () => (cur.links += 1));
    timed(p, 'compileShader', () => (cur.compiles += 1));
    timed(p, 'getProgramParameter');
    timed(p, 'getShaderParameter');
    timed(p, 'texImage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += texBytes(a);
    });
    timed(p, 'texSubImage2D', (a) => {
      // (target, level, x, y, w, h, format, type, pixels) or (target, level, x, y, format, type, source)
      cur.tex += 1;
      cur.texBytes += a.length >= 9 ? (a[4] || 0) * (a[5] || 0) * 4 : texBytes(a.slice(0, 2).concat(a.slice(4)));
    });
    timed(p, 'texImage3D', (a) => {
      cur.tex += 1;
      cur.texBytes += (a[3] || 0) * (a[4] || 0) * (a[5] || 1) * 4;
    });
    timed(p, 'texStorage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += (a[3] || 0) * (a[4] || 0) * 4 * 1.33;
    });
    timed(p, 'compressedTexImage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += a[6]?.byteLength ?? 0;
    });
    timed(p, 'compressedTexSubImage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += a[8]?.byteLength ?? 0;
    });
    timed(p, 'generateMipmap');
    timed(p, 'bufferData', (a) => {
      cur.buf += 1;
      cur.bufBytes += typeof a[1] === 'number' ? a[1] : (a[1]?.byteLength ?? 0);
    });
    timed(p, 'bufferSubData', (a) => {
      cur.buf += 1;
      cur.bufBytes += a[2]?.byteLength ?? 0;
    });
    timed(p, 'readPixels');
    counted(p, 'drawElements', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += a[1] / 3;
    });
    counted(p, 'drawArrays', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += a[2] / 3;
    });
    counted(p, 'drawElementsInstanced', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += (a[1] / 3) * a[4];
    });
    counted(p, 'drawArraysInstanced', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += (a[2] / 3) * a[3];
    });
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        loaf.push({
          t: e.startTime,
          ms: Math.round(e.duration),
          block: Math.round(e.blockingDuration ?? 0),
          scripts: (e.scripts ?? [])
            .filter((s) => s.duration > 8)
            .map((s) => ({ ms: Math.round(s.duration), fn: s.sourceFunctionName || s.invoker || '', url: (s.sourceURL || '').replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, ''), at: s.sourceCharPosition })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {
    /* no LoAF in this browser */
  }
  window.__probe = {
    take() {
      return { frames, loaf, origin: performance.timeOrigin, heap: performance.memory?.usedJSHeapSize ?? null };
    },
  };
}

// ── where a phase's main-thread time went (PROFILE=1): the heaviest
// functions by self time, named with their file ──
function hot(profile, top = 12) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas ?? [];
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]);
    if (!n) continue;
    const { functionName, url, lineNumber } = n.callFrame;
    if (functionName === '(idle)' || functionName === '(program)') continue;
    const key = `${functionName || '(anon)'}@${(url || '').replace(/^.*\/(src|node_modules|deps)\//, '').replace(/\?.*$/, '')}:${lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  }
  return [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([k, ms]) => `${Math.round(ms)}ms ${k}`)
    .join(' | ');
}

// ── the numbers per phase ──
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
const r1 = (n) => Math.round(n * 10) / 10;
function phases({ frames, marks, loaf }) {
  const rows = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const [name, t0] = marks[i];
    const t1 = marks[i + 1][1];
    const fs = frames.filter((f) => f[0] > t0 && f[0] <= t1);
    const gaps = [];
    for (let k = 1; k < fs.length; k++) gaps.push({ ms: fs[k][0] - fs[k - 1][0], f: fs[k] });
    const ms = gaps.map((g) => g.ms).sort((a, b) => a - b);
    const sum = (j) => fs.reduce((s, f) => s + f[j], 0);
    const worst = gaps
      .slice()
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5)
      .map((g) => {
        const lf = loaf.find((l) => g.f[0] >= l.t && g.f[0] <= l.t + l.ms + 20);
        return { ms: Math.round(g.ms), links: g.f[1], tex: g.f[2], texMB: r1(g.f[3]), bufMB: r1(g.f[4]), glMs: Math.round(g.f[7]), drawMs: Math.round(g.f[8]), scripts: lf?.scripts?.slice(0, 3) ?? [] };
      });
    const secs = (t1 - t0) / 1000;
    rows.push({
      phase: name,
      secs: r1(secs),
      frames: fs.length,
      fps: r1(gaps.length / Math.max(0.001, gaps.reduce((s, g) => s + g.ms, 0) / 1000)),
      p50: r1(pct(ms, 0.5)),
      p95: r1(pct(ms, 0.95)),
      p99: r1(pct(ms, 0.99)),
      max: Math.round(ms[ms.length - 1] ?? 0),
      over50: ms.filter((m) => m > 50).length,
      over100: ms.filter((m) => m > 100).length,
      links: sum(1),
      texMB: r1(sum(3)),
      bufMB: r1(sum(4)),
      draws: Math.round(sum(5) / Math.max(1, fs.length)),
      ktris: Math.round(sum(6) / Math.max(1, fs.length) / 1000),
      worst,
    });
  }
  return rows;
}

// ── the journeys ──
// Each is (page, mark, h) => ..., h has the helpers. A phase runs from one
// mark to the next; the journey's last mark ends the last phase.
const wait = (page, ms) => page.waitForTimeout(ms);
const hold = async (page, key, ms) => {
  await page.keyboard.down(key);
  await wait(page, ms);
  await page.keyboard.up(key);
};
const canvasUp = (page, timeout = 180000) => page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.width > 300 && c.height > 200), null, { timeout });

// a world page: the load (from the address to its first frames), resting, then walking about
const worldPage = (route, { ready = canvasUp, move = 'KeyW' } = {}) =>
  async function (page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#${route}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    mark('settle');
    await wait(page, 4000);
    mark('idle');
    await wait(page, 6000);
    mark('move');
    await page.mouse.click(vw / 2, vh / 2).catch(() => {});
    await hold(page, move, 3000);
    await hold(page, 'KeyA', 1500);
    await hold(page, move, 3000);
    mark('end');
  };

const JOURNEYS = {
  async universe(page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#/universe`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
    mark('settle');
    await wait(page, 4000);
    mark('idle');
    await wait(page, 6000);
    mark('fly');
    await hold(page, 'KeyW', 4000);
    await hold(page, 'ArrowLeft', 2000);
    await page.keyboard.down('ShiftLeft');
    await hold(page, 'KeyW', 3000);
    await page.keyboard.up('ShiftLeft');
    mark('end');
  },
  async galaxy(page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#/galaxy/tatooine`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__galaxyDebug?.state?.ship && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
    mark('settle');
    await wait(page, 4000);
    mark('idle');
    await wait(page, 5000);
    mark('fly');
    await hold(page, 'KeyW', 4000);
    await hold(page, 'ArrowLeft', 2000);
    mark('end');
  },
  // the galaxy's flown trip: down to Tatooine's surface, a walk, and back up
  async travel(page, mark) {
    await page.goto(`${this.base}/${this.q}#/galaxy/tatooine`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__galaxyDebug?.state?.ship && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
    await wait(page, 4000);
    await page.evaluate(() => {
      const { state } = window.__galaxyDebug;
      const r = state.sys.body.r;
      Object.assign(state.ship, { x: r * 1.6, y: r * 0.2, z: 0, speed: 0 });
    });
    await page.waitForSelector('.galaxy-land', { timeout: 120000 });
    mark('dive');
    await page.click('.galaxy-land');
    await page.waitForFunction(() => window.location.hash.includes('/surface'), null, { timeout: 300000 });
    mark('landing');
    const phase = () => page.evaluate(() => document.querySelector('.surface-page')?.dataset.phase ?? null);
    for (let i = 0; i < 40 && (await phase()) === 'landing'; i++) {
      await page.keyboard.press('Space');
      await wait(page, 1000);
    }
    await page.waitForFunction(() => document.querySelector('.surface-page')?.dataset.phase === 'walk', null, { timeout: 300000 });
    mark('walk');
    await hold(page, 'KeyW', 4000);
    await hold(page, 'KeyA', 1500);
    await hold(page, 'KeyW', 3000);
    mark('climb');
    await page.evaluate(() => document.querySelector('.surface-world')?.click());
    await page.waitForFunction(() => /#\/galaxy\/[a-z]+$/.test(window.location.hash), null, { timeout: 300000 });
    mark('space');
    await wait(page, 6000);
    mark('end');
  },
  surface: worldPage('/galaxy/tatooine/surface', { ready: (p) => p.waitForFunction(() => document.querySelector('.surface-page')?.dataset.phase === 'walk' || document.querySelector('.surface-page')?.dataset.phase === 'landing', null, { timeout: 240000 }) }),
  avengers: worldPage('/avengers'),
  shire: worldPage('/middle-earth/shire'),
  abq: worldPage('/albuquerque'),
  c137: worldPage('/c-137'),
  cybertron: worldPage('/cybertron'),
  invincible: worldPage('/invincible'),
  earth: worldPage('/earth'),
  minecraft: worldPage('/dot-matrix/minecraft'),
  // Minecraft walked 200 blocks each way along x and z, a block every 100 ms
  // (a sprint's pace and more), so chunks keep arriving and going
  async minecraftWalk(page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#/dot-matrix/minecraft`, { waitUntil: 'domcontentloaded' });
    // (past the game's password, to the tribute)
    await page.getByRole('button', { name: /Walk the tribute/ }).click({ timeout: 120000 });
    await page.waitForFunction(() => window.__RUNTIME__?.status === 'on' && window.__RUNTIME__.current?.world?.game, null, { timeout: 180000 });
    // (the same world every run: seed 1, at its spawn)
    await page.evaluate(() => window.__RUNTIME__.current.world.newWorld(1));
    await page.waitForFunction(() => {
      const g = window.__RUNTIME__.current.world.game;
      return g.world.loaded(g.player.x, g.player.z);
    }, null, { timeout: 180000 });
    mark('settle');
    await wait(page, 4000);
    for (const [name, dx, dz] of [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]) {
      mark(name);
      for (let i = 0; i < 200; i++) {
        await page.evaluate(([dx, dz]) => {
          const { world } = window.__RUNTIME__.current;
          const p = world.game.player;
          world.debug.teleport(p.x + dx, 120, p.z + dz);
        }, [dx, dz]);
        await wait(page, 100);
      }
    }
    mark('end');
  },
  music: worldPage('/music'),
  scranton: worldPage('/scranton'),
  citadel: worldPage('/c-137/citadel'),
  dotmatrix: worldPage('/dot-matrix'),
  caribbean: worldPage('/caribbean'),
};

if (argv.includes('--list')) {
  console.log(Object.keys(JOURNEYS).join('\n'));
  process.exit(0);
}
const picked = argv.filter((a) => !a.startsWith('--'));
const names = picked.length ? picked : Object.keys(JOURNEYS);
for (const n of names) if (!JOURNEYS[n]) throw new Error(`no journey ${n} (--list)`);

let server = null;
let base = process.env.BASE;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { host: '127.0.0.1', port: 5294, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  base = 'http://127.0.0.1:5294';
}
const chrome = process.env.CHROME ?? `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: chrome, args });
const report = {};
mkdirSync(out, { recursive: true });
try {
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vdpr || 1 });
    await ctx.addInitScript(() => {
      const set = (k, v) => window.localStorage.setItem(k, v);
      set('tp-intro', '1');
      set('tp-start', '"universe"');
      set('tp-sound', 'off');
      set('tp-worlds', JSON.stringify('load'));
      set('tp-tour', 'skipped');
      set('tp-universe-ship', JSON.stringify('xwing'));
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
    });
    if (trace) await ctx.addInitScript(() => (window.__probeTrace = true));
    await ctx.addInitScript(recorder);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    // (marked by the wall clock here, so a page frozen mid-frame can't hold a mark back)
    const marks = [];
    const cdp = profile ? await ctx.newCDPSession(page) : null;
    const profiles = [];
    let profiling = null;
    const mark = (n) => {
      marks.push([n, Date.now()]);
      if (!cdp) return;
      // (each phase its own CPU profile: stopped and started on the mark)
      const was = profiling;
      profiling = n;
      cdp
        .send('Profiler.stop')
        .then(({ profile: p }) => was && profiles.push([was, p]))
        .catch(() => {})
        .then(() => n !== 'end' && cdp.send('Profiler.start'))
        .catch(() => {});
    };
    if (cdp) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    }
    const h = { base, q: quality ? `?quality=${quality}` : '' };
    const t0 = Date.now();
    let failed = null;
    try {
      // (the first mark comes once the page and its recorder are up)
      await JOURNEYS[name].call(h, page, mark);
    } catch (err) {
      failed = String(err).split('\n')[0];
      mark('end');
    }
    const data = await page.evaluate(() => window.__probe?.take()).catch(() => null);
    const rows = data ? phases({ ...data, marks: marks.map(([n, t]) => [n, t - data.origin]) }) : [];
    const ready = data && marks.find((m) => m[0] === 'settle');
    if (cdp) {
      await new Promise((r) => setTimeout(r, 300));
      for (const [phase, p] of profiles) console.log(`  cpu in ${phase}: ${hot(p)}`);
    }
    report[name] = { rows, errors, failed, secs: Math.round((Date.now() - t0) / 1000), readyS: ready ? r1((ready[1] - data.origin) / 1000) : null, heapMB: data?.heap ? Math.round(data.heap / 1048576) : null };
    console.log(`\n== ${name}${failed ? `  (stopped: ${failed})` : ''}  ready ${report[name].readyS}s  total ${report[name].secs}s  heap ${report[name].heapMB} MB${errors.length ? `  errors ${errors.length}` : ''}`);
    console.log('phase      secs  fps    p50   p95   p99   max  >50 >100 links texMB bufMB draws ktris');
    for (const r of rows) {
      console.log(
        [r.phase.padEnd(9), String(r.secs).padStart(5), String(r.fps).padStart(5), String(r.p50).padStart(6), String(r.p95).padStart(5), String(r.p99).padStart(5), String(r.max).padStart(5), String(r.over50).padStart(4), String(r.over100).padStart(4), String(r.links).padStart(5), String(r.texMB).padStart(5), String(r.bufMB).padStart(5), String(r.draws).padStart(5), String(r.ktris).padStart(5)].join(' '),
      );
    }
    for (const r of rows) {
      const bad = r.worst.filter((w) => w.ms > 50);
      if (!bad.length) continue;
      console.log(`  worst in ${r.phase}: ${bad.map((w) => `${w.ms}ms[links ${w.links}, tex ${w.tex}/${w.texMB}MB, buf ${w.bufMB}MB, gl ${w.glMs}ms${trace ? `, draws ${w.drawMs}ms` : ''}${w.scripts.length ? `; ${w.scripts.map((s) => `${s.fn || '?'}@${s.url.split('/').slice(-2).join('/')} ${s.ms}ms`).join(', ')}` : ''}]`).join('  ')}`);
    }
    await ctx.close();
  }
} finally {
  writeFileSync(`${out}/perf-probe.json`, JSON.stringify({ view: { vw, vh, vdpr }, quality, report }, null, 1));
  await browser.close();
  await server?.close();
}
