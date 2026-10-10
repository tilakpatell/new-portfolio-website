/* global window */
// A model that came as an .fbx, as a .glb: three.js's own FBXLoader reads it
// and GLTFExporter writes it (skeleton, skin and clips kept), in headless
// Chromium through the dev server (npx vite --port 5188) and
// scripts/preview/fbx-to-glb.html. For a Sketchfab upload whose automatic
// glTF came out wrong (parts parented to bones left behind, or scaled away)
// while its original .fbx is right.
//
//   node scripts/fbx-to-glb.mjs <file.fbx> <out.glb> [material=texture.png …]
//   fbxToGlb(file, out, { maps, base }) → { parts, shared, clips }
// The .fbx and its textures must be under the project (the dev server serves
// them): its textures are looked for beside it by file name, and `maps` gives
// a material a texture the file lost; `base`, a dev server elsewhere than
// BASE (scripts/kit/fbx.mjs starts one on a free port when 5188 is down).

import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5188';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium';

export async function fbxToGlb(file, out, { maps = {}, base = BASE } = {}) {
  const rel = `/${relative(ROOT, file).split('\\').join('/')}`;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/scripts/preview/fbx-to-glb.html`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    const r = await page.evaluate(([url, dir, m]) => window.convert(url, dir, m), [rel, rel.split('/').slice(0, -1).join('/'), maps]).catch((e) => {
      throw new Error(`${rel}: ${errors[0] ?? e.message}`);
    });
    await writeFile(out, Buffer.from(r.glb, 'base64'));
    return { parts: r.parts, shared: r.shared, clips: r.clips };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, out, ...pairs] = process.argv.slice(2);
  if (!file || !out) throw new Error('usage: fbx-to-glb.mjs <file.fbx> <out.glb> [material=texture.png …]');
  const maps = Object.fromEntries(pairs.map((p) => p.split('=')));
  const r = await fbxToGlb(join(process.cwd(), file), out, { maps });
  for (const p of r.parts) console.log(`${p.name}${p.skinned ? ' (skinned)' : ''}: ${p.materials.join(', ')}`);
  console.log(out, `${r.shared} parts moved onto one skeleton;`, r.clips.length ? `clips: ${r.clips.join(', ')}` : 'no clips');
}
