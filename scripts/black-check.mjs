/* global window, document, WebGL2RenderingContext */
// Counts the black pixels a world draws, frame by frame, in headless Chromium:
// what the screen shows, read straight off the WebGL buffer after each draw
// (a screenshot of a canvas that keeps no buffer reads black). For "it goes
// black" reports: a floor the baked light drowns, foliage lit from behind.
//
//   node scripts/black-check.mjs --route /middle-earth/amon-hen --global __AMONHEN__
//     [--quality mid] [--frames 40] [--walk] [--out docs/superpowers/shots] [--port 5197]
//
// Prints the black pixels in each frame of the world's own canvas (not a
// minigame's below it), and keeps the last frame as <name>-black.png with
// the black pixels painted red. Software WebGL: a frame takes seconds.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const n = argv[i + 1];
  args[argv[i].slice(2)] = n === undefined || n.startsWith("--") ? true : argv[++i];
}
const route = args.route ?? "/middle-earth/amon-hen";
const global = args.global ?? "__AMONHEN__";
const name = route.replace(/\W+/g, "-").replace(/^-|-$/g, "");
const port = Number(args.port ?? 5197);
const frames = Number(args.frames ?? 40);
const outDir = args.out ?? join(ROOT, "docs/superpowers/shots");
await mkdir(outDir, { recursive: true });

const server = spawn(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
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
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
await ctx.addInitScript((q) => {
  window.localStorage.setItem("tp-intro", "1");
  window.localStorage.setItem("tp-3d", "on");
  window.localStorage.setItem("tp-worlds", '"load"');
  window.localStorage.setItem("tp-quality", q);
  window.__tpKeepFrames = true;
  window.__frames = [];
  window.__drew = 0;
  for (const k of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
    const f = WebGL2RenderingContext.prototype[k];
    WebGL2RenderingContext.prototype[k] = function (...a) {
      window.__drew++;
      window.__lastGl = this;
      return f.apply(this, a);
    };
  }
  // a steady 60 Hz clock, so slow software frames don't step the quality down
  const raf = window.requestAnimationFrame.bind(window);
  let lastReal = -1;
  let fake = 0;
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      if (t !== lastReal) {
        lastReal = t;
        fake += 1000 / 60;
      }
      const before = window.__drew;
      cb(fake);
      const gl = window.__lastGl;
      if (!window.__probe || !gl || window.__drew === before || /rush/.test(gl.canvas.parentElement?.className ?? "")) return;
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const b = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
      let black = 0;
      for (let i = 0; i < b.length; i += 4) if (b[i] < 8 && b[i + 1] < 8 && b[i + 2] < 8) black++;
      window.__frames.push({ black, of: w * h, calls: window.__drew - before });
      if (window.__frames.length >= window.__want) {
        window.__probe = false;
        const o = document.createElement("canvas");
        o.width = w;
        o.height = h;
        const g = o.getContext("2d");
        const img = g.createImageData(w, h);
        for (let y = 0; y < h; y++) img.data.set(b.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4);
        for (let i = 0; i < img.data.length; i += 4)
          if (img.data[i] < 8 && img.data[i + 1] < 8 && img.data[i + 2] < 8) {
            img.data[i] = 255;
            img.data[i + 1] = 0;
            img.data[i + 2] = 0;
          }
        g.putImageData(img, 0, 0);
        window.__png = o.toDataURL("image/png");
      }
    });
}, args.quality ?? "mid");
const page = await ctx.newPage();
await page.goto(`${base}/#${route}`, { waitUntil: "load", timeout: 180000 });
await page.waitForFunction((g) => window[g]?.api, global, { timeout: 600000, polling: 1000 });
await page.waitForFunction((g) => window[g].api.ground?.stats?.baked || !window[g].api.ground, global, { timeout: 900000, polling: 2000 });
if (args.walk) await page.keyboard.down("w");
await page.evaluate((n) => {
  window.__want = n;
  window.__probe = true;
}, frames);
await page.waitForFunction(() => window.__png, null, { timeout: 900000, polling: 1000 });
if (args.walk) await page.keyboard.up("w");
const got = await page.evaluate(() => ({ frames: window.__frames, png: window.__png }));
await writeFile(join(outDir, `${name}-black.png`), Buffer.from(got.png.split(",")[1], "base64"));
const counts = got.frames.map((f) => f.black);
console.log(`${name}: black pixels per frame (of ${got.frames[0].of}): ${counts.join(" ")}`);
console.log(`min ${Math.min(...counts)} max ${Math.max(...counts)}; kept ${join(outDir, `${name}-black.png`)}`);
await browser.close();
server.kill();
