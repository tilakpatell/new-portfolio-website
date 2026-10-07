/* global window */
// Pictures of the Death Stars' HD exteriors (scripts/deathstar-hd.mjs), for
// judging them: each GLB as the galaxy draws it (galaxy/models.js: centred,
// 1 across, its materials tuned the same way; one sun, a little blue
// ambient), far off and close in, in headless Chromium, as WebPs in
// docs/superpowers/shots/deathstar-hd/. Its own page and server rather than
// scripts/glb-shot.mjs's, whose page has no KTX2 loader (these normal maps
// are KTX2), and it needs no dev server.
//
//   node scripts/deathstar-hd.mjs shots
//   shoot([{ file, out, views, sun }], dir) → the files written

import { chromium } from 'playwright-core';
import sharp from 'sharp';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = () => process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const W = 960;
const H = 640;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>shot</title>
<style>html,body{margin:0;background:#000}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/examples/jsm/":"/node_modules/three/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
const q = new URLSearchParams(location.search);
const W = +q.get('w'), H = +q.get('h');
const views = JSON.parse(q.get('views'));
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W * views.length, H);
renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#04060a');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.04; // (a little: space has nothing much to reflect)
const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(...JSON.parse(q.get('sun')));
scene.add(sun, new THREE.AmbientLight('#9fb0d8', 0.32));
const ktx2 = new KTX2Loader().setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/').detectSupport(renderer);
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2).loadAsync(q.get('url'));
const root = gltf.scene;
// (galaxy/models.js's tune: roughness kept between 0.35 and 0.75, lit windows at 2.2)
root.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of [o.material].flat()) {
    m.roughness = Math.min(Math.max(m.roughness ?? 1, 0.35), 0.75);
    if (m.emissiveMap) m.emissiveIntensity = 2.2;
    for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'aoMap']) if (m[k]) m[k].anisotropy = 8;
  }
});
// (and its normalise: centred, its biggest side 1)
const box = new THREE.Box3().setFromObject(root, true);
const size = box.getSize(new THREE.Vector3());
root.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1);
const holder = new THREE.Group();
holder.add(root);
holder.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
scene.add(holder);
let tris = 0;
root.traverse((o) => o.isMesh && (tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3));
document.title = JSON.stringify({ size: size.toArray().map((v) => +v.toFixed(2)), tris });
const cam = new THREE.PerspectiveCamera(35, W / H, 0.0005, 50);
views.forEach((v, i) => {
  cam.fov = v.fov ?? 35;
  cam.updateProjectionMatrix();
  cam.position.set(...v.pos);
  cam.lookAt(...(v.at ?? [0, 0, 0]));
  renderer.setViewport(i * W, 0, W, H);
  renderer.setScissor(i * W, 0, W, H);
  renderer.render(scene, cam);
});
window.__done = true;
</script></body></html>`;

// the page, three from node_modules, and the models: from public/ or a file named outright
function serve(files) {
  const types = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u === '/shot.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(PAGE);
      return;
    }
    const f = u.startsWith('/node_modules/three/') ? join(ROOT, u) : files.get(u);
    if (!f || !existsSync(f) || !statSync(f).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' });
    createReadStream(f).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// A direction scaled to a length: where a view stands or looks.
const along = (dir, r) => {
  const l = Math.hypot(...dir);
  return dir.map((v) => +((v / l) * r).toFixed(4));
};

// Each shot: a GLB, the WebP to write (one view each, side by side if more),
// its views ({ pos, at, fov }, the model 1 across at the origin) and its sun.
export async function shoot(shots, dir) {
  await mkdir(dir, { recursive: true });
  const files = new Map(shots.map((s, i) => [`/m${i}.glb`, resolve(ROOT, s.file)]));
  const server = await serve(files);
  const browser = await chromium.launch({ executablePath: CHROME(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const written = [];
  try {
    for (const [i, s] of shots.entries()) {
      const page = await browser.newPage({ viewport: { width: W * s.views.length, height: H } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${server.address().port}/shot.html?url=/m${i}.glb&w=${W}&h=${H}&sun=${encodeURIComponent(JSON.stringify(s.sun))}&views=${encodeURIComponent(JSON.stringify(s.views))}`);
      await page.waitForFunction(() => window.__done, null, { timeout: 600000 }).catch((e) => {
        throw new Error(`${s.file}: ${errors[0] ?? e.message}`);
      });
      const out = join(dir, s.out);
      await sharp(await page.screenshot()).webp({ quality: 80 }).toFile(out);
      console.log(`${out}  ${await page.title()}`);
      written.push(out);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return written;
}

// The DS1 lit from the right, so its night side shows its windows; the DS2
// from the front right, its dish and its open side both in the light.
const DS1_SUN = [1, 0.4, -0.2];
const DS2_SUN = [0.6, 0.7, 0.5];
export const VIEWS = {
  ds1: {
    far: { pos: along([0.75, 0.3, 1], 1.65) },
    close: { pos: along([0.55, 0.12, 1], 0.66), at: along([0.12, 0.28, 1], 0.5), fov: 40 },
    surface: { pos: along([0.75, 0.1, 0.65], 0.55), at: along([0.45, 0.02, 0.9], 0.5), fov: 45 },
  },
  ds2: {
    far: { pos: [0.95, 0.45, 1.25] },
    open: { pos: [0.62, 0.32, 0.38], at: [0.15, 0.05, -0.1], fov: 50 },
    hull: { pos: along([-0.55, 0.05, 0.85], 0.64), at: along([-0.3, -0.12, 0.95], 0.5), fov: 45 },
  },
};

export const SHOTS = [
  { file: 'public/models/universe/death-star.hq.glb', out: 'ds1-hq-far.webp', views: [VIEWS.ds1.far], sun: DS1_SUN },
  { file: 'public/models/universe/death-star.hq.glb', out: 'ds1-hq-close.webp', views: [VIEWS.ds1.close], sun: DS1_SUN },
  { file: 'public/models/universe/death-star.hq.glb', out: 'ds1-hq-surface.webp', views: [VIEWS.ds1.surface], sun: DS1_SUN },
  { file: 'public/models/universe/death-star.glb', out: 'ds1-close.webp', views: [VIEWS.ds1.close], sun: DS1_SUN },
  { file: 'public/models/galaxy/deathstar2.hq.glb', out: 'ds2-hq-far.webp', views: [VIEWS.ds2.far], sun: DS2_SUN },
  { file: 'public/models/galaxy/deathstar2.hq.glb', out: 'ds2-hq-open.webp', views: [VIEWS.ds2.open], sun: DS2_SUN },
  { file: 'public/models/galaxy/deathstar2.hq.glb', out: 'ds2-hq-hull.webp', views: [VIEWS.ds2.hull], sun: DS2_SUN },
  { file: 'public/models/galaxy/deathstar2.glb', out: 'ds2-far.webp', views: [VIEWS.ds2.far], sun: DS2_SUN },
];

export const shots = (dir) => shoot(SHOTS, dir);
