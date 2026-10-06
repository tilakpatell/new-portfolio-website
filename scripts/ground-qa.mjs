/* global window, document, requestAnimationFrame */
// A world on baked floor light (lib/three/groundwork), looked at in headless
// Chromium: it opens a world's page, waits for the world and for its floor
// bake to land, and keeps a screenshot, the bake's time and the draw count.
//
//   node scripts/ground-qa.mjs --route /middle-earth/bree --global __BREE__
//     [--name bree] [--quality mid] [--settle 6000] [--out dir] [--port 5197]
//     [--reuse] [--frames 8] [--wait 900000]
//
// `--global` is the window property the world's page sets in development
// (window.__BREE__ = { api }); its `api.ground` is the groundWorld handle.
// A world without one is still photographed. Software WebGL is slow: a bake
// takes minutes there and seconds on a GPU.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const k = argv[i].slice(2);
  const n = argv[i + 1];
  if (n === undefined || n.startsWith("--")) args[k] = true;
  else args[k] = argv[++i];
}
const route = args.route ?? "/middle-earth/bree";
const global = args.global ?? null;
const name = args.name ?? route.replace(/\W+/g, "-").replace(/^-|-$/g, "");
const quality = args.quality ?? "mid";
const port = Number(args.port ?? 5197);
const outDir = args.out ?? join(ROOT, "docs/superpowers/shots");
const wait = Number(args.wait ?? 900000);

let server = null;
if (!args.reuse)
  server = spawn(
    process.execPath,
    [
      join(ROOT, "node_modules/vite/bin/vite.js"),
      "--port",
      String(port),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    { cwd: ROOT, stdio: "ignore" },
  );
const base = `http://127.0.0.1:${port}`;
for (let t0 = Date.now(); ; ) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not yet */
  }
  if (Date.now() - t0 > 60000) throw new Error("vite never answered");
  await new Promise((r) => setTimeout(r, 300));
}
const sandbox = (await readdir("/opt/pw-browsers").catch(() => []))
  .filter((n) => /^chromium-\d+$/.test(n))
  .map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`);
const exe =
  args.chromium ??
  process.env.CHROME ??
  [...sandbox, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
    existsSync,
  );
const browser = await chromium.launch({
  executablePath: exe,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--js-flags=--max-old-space-size=6144",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 960, height: 600 },
  deviceScaleFactor: 1,
});
await ctx.addInitScript((q) => {
  window.localStorage.setItem("tp-intro", "1");
  window.localStorage.setItem("tp-3d", "on");
  window.localStorage.setItem("tp-worlds", '"load"');
  window.localStorage.setItem("tp-quality", q);
  window.__tpKeepFrames = true;
  // a steady 60 Hz clock: software WebGL's seconds-long frames would
  // otherwise read as a slow device and step the quality down
  const raf = window.requestAnimationFrame.bind(window);
  let lastReal = -1;
  let fake = 0;
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      if (t !== lastReal) {
        lastReal = t;
        fake += 1000 / 60;
      }
      cb(fake);
    });
  // when a canvas loses its context, and how far the bake had got
  window.__lost = [];
  document.addEventListener(
    "webglcontextlost",
    () =>
      window.__lost.push({
        at: Math.round(performance.now()),
        ground: (() => {
          for (const k of Object.keys(window))
            if (k.startsWith("__") && window[k]?.api?.ground)
              return { ...window[k].api.ground.stats };
          return null;
        })(),
      }),
    true,
  );
  const G = { calls: 0 };
  window.__gl = G;
  for (const C of [window.WebGL2RenderingContext]) {
    if (!C) continue;
    const p = C.prototype;
    for (const k of [
      "drawElements",
      "drawArrays",
      "drawElementsInstanced",
      "drawArraysInstanced",
    ]) {
      const f = p[k];
      p[k] = function (...a) {
        G.calls++;
        return f.apply(this, a);
      };
    }
  }
}, quality);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" || /grounding|groundwork/.test(t))
    errors.push(`${m.type()}: ${t.slice(0, 300)}`);
});
const t0 = Date.now();
await page.goto(`${base}/#${route}`, { waitUntil: "load", timeout: 180000 });
const result = { route, quality, upMs: null, bake: null, calls: null, errors };
if (global) {
  const up = await page
    .waitForFunction(
      (g) => window[g]?.api || (window[g] && window[g].sim),
      global,
      { timeout: wait, polling: 1000 },
    )
    .then(() => true)
    .catch(() => false);
  result.upMs = up ? Date.now() - t0 : null;
  console.log(
    up
      ? `world up in ${(result.upMs / 1000).toFixed(0)}s`
      : "the world never came up",
  );
  const got = !up
    ? false
    : await page
        .waitForFunction(
          (g) =>
            window[g]?.api?.ground?.stats?.baked ||
            (window[g] && !(window[g].api && "ground" in window[g].api)),
          global,
          { timeout: wait, polling: 2000 },
        )
        .then(() => true)
        .catch(() => false);
  result.bake = await page.evaluate((g) => {
    const s = window[g]?.api?.ground?.stats;
    return s ? { ...s } : null;
  }, global);
  if (!got) console.log("the bake never landed");
} else await page.waitForTimeout(30000);
await page.waitForTimeout(Number(args.settle ?? 6000));
// the draw calls in a few frames, every pass included
result.calls = await page.evaluate(
  (n) =>
    new Promise((res) => {
      const seen = [];
      const tick = () => {
        seen.push(window.__gl.calls);
        if (seen.length > n) res(Math.round((seen[n] - seen[0]) / n));
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }),
  Number(args.frames ?? 4),
);
result.lost = await page.evaluate(() => window.__lost);
await mkdir(outDir, { recursive: true });
const file = join(outDir, `${name}.png`);
await page.screenshot({ path: file });
await writeFile(join(outDir, `${name}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log(`shot: ${file}`);
await browser.close();
server?.kill();
