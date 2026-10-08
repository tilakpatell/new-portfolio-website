/* global window, document, requestAnimationFrame, WebGL2RenderingContext, WebGLRenderingContext, HTMLImageElement, MutationObserver */
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
// worst frames were spent on; and where the universe map's files were
// fetched, what its first frame waited on (its maps' bytes before the first
// frame; FILES=1 names them: firstFetch, below).
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
  const zero = () => ({ links: 0, compiles: 0, glMs: 0, drawMs: 0, tex: 0, texBytes: 0, buf: 0, bufBytes: 0, draws: 0, tris: 0, slow: '' });
  let cur = zero();
  const frames = []; // [t, links, texUploads, texMB, bufMB, draws, tris, glMs, drawMs, slow]
  const stacks = new Map(); // a slow GL call's callers → ms
  const loaf = [];
  const tick = () => {
    const c = cur;
    frames.push([performance.now(), c.links, c.tex, c.texBytes / 1048576, c.bufBytes / 1048576, c.draws, c.tris, c.glMs, c.drawMs, c.slow]);
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
        const ms = performance.now() - t0;
        cur.glMs += ms;
        // (the slowest call of the frame, named: what a stall waited in)
        if (ms > 20 && !cur.slow.includes(name)) cur.slow += `${name} ${Math.round(ms)}ms `;
        // (who asked, for the slow ones: the stack's first frames outside three)
        if (ms > 20) {
          const at = (new Error().stack ?? '')
            .split('\n')
            .slice(2)
            .map((l) => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\//, '(').replace(/\?[^:)]*/, ''))
            .filter((l) => !l.includes('recorder') && !l.includes('three.core') && !l.includes('deps/three.js'))
            .slice(0, 3)
            .join(' < ');
          const key = `${name}: ${at}`;
          stacks.set(key, (stacks.get(key) ?? 0) + ms);
        }
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
  // The first frame: when the scene began drawing it, where the scene says
  // (the universe's DEV hook, `__universe().firstFrame`, read at the end),
  // else when its box says it has drawn one (lib/three/useScene's
  // data-gl="on", as the loading veil drops: a little after, so what that
  // first frame itself asked for, the near maps of a planet already near,
  // counts as before it). What the page fetched before it is what the first
  // frame waited on (firstFetch, below).
  const first = { frame: null, on: null };
  try {
    performance.setResourceTimingBufferSize(100000); // (a dev server's modules alone are thousands)
  } catch {
    /* (kept at its default) */
  }
  new MutationObserver((_, obs) => {
    if (!document.querySelector('[data-gl="on"]')) return;
    first.on = performance.now();
    obs.disconnect();
  }).observe(document, { attributes: true, attributeFilter: ['data-gl'], subtree: true });
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
      // (the universe map's own files, each [path, started, bytes]: its maps, its stars)
      const fetched = performance
        .getEntriesByType('resource')
        .filter((e) => e.name.includes('/textures/universe/'))
        .map((e) => [e.name.replace(/^.*\/textures\/universe\//, ''), e.startTime, e.encodedBodySize || e.decodedBodySize || e.transferSize || 0]);
      try {
        first.frame = window.__universe?.().firstFrame ?? null;
      } catch {
        /* (no universe up) */
      }
      return { frames, loaf, origin: performance.timeOrigin, heap: performance.memory?.usedJSHeapSize ?? null, stacks: [...stacks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), first, fetched };
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
        return { ms: Math.round(g.ms), links: g.f[1], tex: g.f[2], texMB: r1(g.f[3]), bufMB: r1(g.f[4]), glMs: Math.round(g.f[7]), drawMs: Math.round(g.f[8]), slow: g.f[9], scripts: lf?.scripts?.slice(0, 3) ?? [] };
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

// ── what the first frame waited on ──
// The universe map's files (public/textures/universe/) fetched before its
// first frame (the recorder's `first`: as the scene began drawing it, or
// else the veil down): its maps (the manifest's .webp and .ktx2, the
// planets' and the sky's glow) apart from its other files (stars.bin), in MB
// of 10^6 bytes as fetched (the files' own bytes); and the maps fetched
// after it, by the journey's end (the near maps as the ship goes). (The
// manifests a dev server hands over as modules, `?import`, are code: bundled
// in the built site, not counted.)
function firstFetch(data) {
  if (!data?.fetched) return null;
  const at = data.first?.frame ?? data.first?.on;
  const files = data.fetched.filter((f) => !f[0].includes('?import'));
  const sum = (list) => ({ n: list.length, bytes: list.reduce((s, f) => s + f[2], 0), MB: Math.round(list.reduce((s, f) => s + f[2], 0) / 1e4) / 100, files: list.map((f) => f[0]) });
  const before = at == null ? files : files.filter((f) => f[1] < at);
  const map = (f) => /\.(webp|ktx2)$/.test(f[0]);
  return {
    frameS: data.first?.frame != null ? r1(data.first.frame / 1000) : null,
    onS: data.first?.on != null ? r1(data.first.on / 1000) : null,
    maps: sum(before.filter(map)),
    other: sum(before.filter((f) => !map(f))),
    later: sum(files.filter((f) => map(f) && !before.includes(f))),
  };
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
    // (and its first frame: the loading veil down, lib/three/useScene's
    // data-gl="on"; minutes in a container that draws in software)
    await page.waitForFunction(() => document.querySelector('.universe-map[data-gl="on"]'), null, { timeout: 600000, polling: 250 });
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
  // a planet of the Expanse (seed 7) driven flat out along +x with the boost
  // and back again, so cells keep arriving ahead and going behind
  async expanseDrive(page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#/universe/expanse/7`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__RUNTIME__?.status === 'on' && window.__EXPANSE__, null, { timeout: 180000 });
    mark('settle');
    await wait(page, 4000);
    for (const [name, yaw] of [['out', 0], ['back', Math.PI]]) {
      // (turned round where it stands, still, so both legs are the same drive)
      await page.evaluate((y) => {
        const [x, h, z] = window.__EXPANSE__.vehicle.chassis.position();
        window.__EXPANSE__.vehicle.moveTo(x, h + 0.5, z, y);
      }, yaw);
      mark(name);
      await page.keyboard.down('ShiftLeft');
      await hold(page, 'KeyW', 12000);
      await page.keyboard.up('ShiftLeft');
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
      // (no reading back every shader's log: the built site doesn't, and it waits on each link)
      window.__tpNoShaderChecks = true;
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
    });
    if (trace) await ctx.addInitScript(() => (window.__probeTrace = true));
    await ctx.addInitScript(recorder);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    // (lib/three/frameGuard names, in development, what still compiles mid-frame)
    const slips = new Map();
    page.on('console', (m) => {
      const t = m.text();
      if (t.startsWith('[frameGuard]')) slips.set(t, (slips.get(t) ?? 0) + 1);
    });
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
    report[name] = { rows, errors, failed, secs: Math.round((Date.now() - t0) / 1000), readyS: ready ? r1((ready[1] - data.origin) / 1000) : null, heapMB: data?.heap ? Math.round(data.heap / 1048576) : null, first: firstFetch(data) };
    console.log(`\n== ${name}${failed ? `  (stopped: ${failed})` : ''}  ready ${report[name].readyS}s  total ${report[name].secs}s  heap ${report[name].heapMB} MB${errors.length ? `  errors ${errors.length}` : ''}`);
    const ff = report[name].first;
    if (ff?.maps.n || ff?.other.n) {
      console.log(`first frame at ${ff.frameS ?? ff.onS}s (the veil down at ${ff.onS}s): the universe's maps fetched before it ${ff.maps.MB} MB (${ff.maps.bytes} bytes, ${ff.maps.n} files), its other files ${ff.other.MB} MB${ff.other.n ? ` (${ff.other.files.join(', ')})` : ''}; maps after it, by the journey's end, ${ff.later.MB} MB (${ff.later.n} files)`);
      if (process.env.FILES) console.log(`  before: ${ff.maps.files.join(' ')}\n  after: ${ff.later.files.join(' ')}`);
    }
    console.log('phase      secs  fps    p50   p95   p99   max  >50 >100 links texMB bufMB draws ktris');
    for (const r of rows) {
      console.log(
        [r.phase.padEnd(9), String(r.secs).padStart(5), String(r.fps).padStart(5), String(r.p50).padStart(6), String(r.p95).padStart(5), String(r.p99).padStart(5), String(r.max).padStart(5), String(r.over50).padStart(4), String(r.over100).padStart(4), String(r.links).padStart(5), String(r.texMB).padStart(5), String(r.bufMB).padStart(5), String(r.draws).padStart(5), String(r.ktris).padStart(5)].join(' '),
      );
    }
    for (const r of rows) {
      const bad = r.worst.filter((w) => w.ms > 50);
      if (!bad.length) continue;
      console.log(`  worst in ${r.phase}: ${bad.map((w) => `${w.ms}ms[links ${w.links}, tex ${w.tex}/${w.texMB}MB, buf ${w.bufMB}MB, gl ${w.glMs}ms${w.slow ? ` (${w.slow.trim()})` : ''}${trace ? `, draws ${w.drawMs}ms` : ''}${w.scripts.length ? `; ${w.scripts.map((s) => `${s.fn || '?'}@${s.url.split('/').slice(-2).join('/')} ${s.ms}ms`).join(', ')}` : ''}]`).join('  ')}`);
    }
    if (process.env.STACKS && data?.stacks?.length) {
      console.log('  slow GL calls, by caller:');
      for (const [k, ms] of data.stacks) console.log(`    ${Math.round(ms)}ms ${k}`);
    }
    if (slips.size) {
      console.log('  mid-frame compiles:');
      for (const [t, n] of [...slips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${n}× ${t.slice(13)}`);
    }
    report[name].slips = Object.fromEntries(slips);
    await ctx.close();
  }
} finally {
  writeFileSync(`${out}/perf-probe.json`, JSON.stringify({ view: { vw, vh, vdpr }, quality, report }, null, 1));
  await browser.close();
  await server?.close();
}
