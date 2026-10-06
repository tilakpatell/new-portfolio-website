/* global window */
// Impostors for the HQ games' forests: Poly Haven's trees are millions of
// triangles each, far too many for a browser, so each one is photographed
// here, once, from the side: a lit colour picture (with its transparency) and
// a picture of its surface normals. The games draw distant trees as cards
// that turn to face the camera, lit by the scene's own sun through those
// normals, so a forest costs a few hundred triangles and looks like the model.
//
// The models come from scripts/.cache/hq/ (downloaded by hq-assets.mjs, or
// here if missing). The rendering runs in headless Chromium.
//
//   public/hq/impostors/<name>/{color.webp, normal.png}
//   src/components/avengers/hq/catalog.js gains IMPOSTORS (each card's size)
//
// Run:   node scripts/hq-impostors.mjs [names...]
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = join(ROOT, 'scripts/.cache/hq/models');
const OUT = join(ROOT, 'public/hq/impostors');
const CATALOG = join(ROOT, 'src/components/avengers/hq/catalog.js');
const UA = 'tilakpatell.com asset script (https://tilakpatell.com)';

// name: Poly Haven model, the node to photograph, the picture's size
const IMPOSTORS = {
  'fir-a': { src: 'fir_tree_01', node: 'fir_tree_01_a_LOD0' },
  'fir-b': { src: 'fir_tree_01', node: 'fir_tree_01_b_LOD0' },
  'fir-c': { src: 'fir_tree_01', node: 'fir_tree_01_c_LOD0' },
  broadleaf: { src: 'tree_small_02', node: 'tree_small_02_LOD0' },
};
const SIZE = 1024; // shipped; rendered at twice this and scaled down
const only = process.argv.slice(2);

async function download(id) {
  const dir = join(CACHE, id, '1k');
  const main = join(dir, `${id}.gltf`);
  if (existsSync(main)) return;
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: { 'User-Agent': UA } })).json();
  const g = files.gltf['1k'].gltf;
  await mkdir(join(dir, 'textures'), { recursive: true });
  for (const [rel, v] of [[`${id}.gltf`, g], ...Object.entries(g.include)]) {
    const res = await fetch(v.url, { headers: { 'User-Agent': UA } });
    await writeFile(join(dir, rel), Buffer.from(await res.arrayBuffer()));
  }
}

// a static server for the project, so the page can load three.js and the model
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png' };
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
const NORMAL_VERT = \`varying vec3 vN; varying vec2 vUv;
  void main() { vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }\`;
const NORMAL_FRAG = \`uniform sampler2D map; uniform float useMap; varying vec3 vN; varying vec2 vUv;
  void main() { if (useMap > 0.5 && texture2D(map, vUv).a < 0.5) discard; vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(n * 0.5 + 0.5, 1.0); }\`;
window.bake = async (url, nodeName, size) => {
  const gltf = await new GLTFLoader().loadAsync(url);
  const node = gltf.scene.getObjectByName(nodeName) ?? gltf.scene;
  const root = new THREE.Group();
  const copy = node.clone(true);
  copy.position.set(0, 0, 0);
  root.add(copy);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const half = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, box.max.y - box.min.y) / 2;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, half * 8);
  cam.position.set(cx, box.min.y + half, cz + half * 4);
  cam.lookAt(cx, box.min.y + half, cz);
  const scene = new THREE.Scene();
  scene.add(root);
  const mats = new Map();
  root.traverse((o) => { if (o.isMesh) mats.set(o, o.material); });
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  const read = () => { const buf = new Uint8Array(size * size * 4); renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf); return buf; };
  const toB64 = (buf) => { let s = ''; const CH = 0x8000; for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH)); return btoa(s); };
  // colour: the model's own materials under soft, even light
  for (const [o, m] of mats) { m.side = THREE.DoubleSide; if (m.transparent || m.alphaTest) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; } m.needsUpdate = true; }
  scene.environment = env;
  scene.environmentIntensity = 1.1;
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(0.3, 1, 0.6); scene.add(key);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
  const color = read();
  // normals, as seen from the camera
  for (const [o, m] of mats) o.material = new THREE.ShaderMaterial({ vertexShader: NORMAL_VERT, fragmentShader: NORMAL_FRAG, uniforms: { map: { value: m.map }, useMap: { value: m.map && m.alphaTest ? 1 : 0 } }, side: THREE.DoubleSide });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x8080ff, 0); renderer.clear(); renderer.render(scene, cam);
  const normal = read();
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setRenderTarget(null);
  return { color: toB64(color), normal: toB64(normal), height: box.max.y - box.min.y, width: Math.max(box.max.x - box.min.x, box.max.z - box.min.z), span: half * 2 };
};
window.ready = true;
</script>`;

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/bake.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
    return;
  }
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'],
});
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('page:', m.text()));
await page.goto(`http://127.0.0.1:${port}/bake.html`);
await page.waitForFunction(() => window.ready);

// spread colour into the transparent pixels next to leaves, so mipmaps don't
// darken the edges
function bleed(rgba, w, h, passes = 12) {
  const a = rgba;
  const known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) known[i] = a[i * 4 + 3] > 8 ? 1 : 0;
  for (let p = 0; p < passes; p++) {
    const next = known.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!known[j]) continue;
          r += a[j * 4]; g += a[j * 4 + 1]; b += a[j * 4 + 2]; n++;
        }
        if (n) {
          a[i * 4] = r / n; a[i * 4 + 1] = g / n; a[i * 4 + 2] = b / n;
          next[i] = 1;
        }
      }
    known.set(next);
  }
  return a;
}

const flip = (buf, w, h) => {
  // the GPU reads bottom row first
  const out = Buffer.alloc(buf.length);
  for (let y = 0; y < h; y++) buf.copy(out, (h - 1 - y) * w * 4, y * w * 4, (y + 1) * w * 4);
  return out;
};

const results = {};
for (const [name, spec] of Object.entries(IMPOSTORS)) {
  if (only.length && !only.includes(name)) continue;
  await download(spec.src);
  const url = `/scripts/.cache/hq/models/${spec.src}/1k/${spec.src}.gltf`;
  const big = SIZE * 2;
  const r = await page.evaluate(([u, n, s]) => window.bake(u, n, s), [url, spec.node, big]);
  const color = flip(Buffer.from(r.color, 'base64'), big, big);
  const normal = flip(Buffer.from(r.normal, 'base64'), big, big);
  bleed(color, big, big);
  // normals where there's no tree point straight out of the card
  // (and the picture is opaque: resizing weights colour by alpha)
  for (let i = 0; i < big * big; i++) {
    if (normal[i * 4 + 3] < 8) normal.set([128, 128, 255], i * 4);
    normal[i * 4 + 3] = 255;
  }
  const dir = join(OUT, name);
  await mkdir(dir, { recursive: true });
  await sharp(color, { raw: { width: big, height: big, channels: 4 } }).resize(SIZE, SIZE, { kernel: 'lanczos3' }).webp({ quality: 86, alphaQuality: 92, effort: 6 }).toFile(join(dir, 'color.webp'));
  await sharp(normal, { raw: { width: big, height: big, channels: 4 } }).removeAlpha().resize(SIZE, SIZE, { kernel: 'lanczos3' }).png({ compressionLevel: 9, palette: false }).toFile(join(dir, 'normal.png'));
  const bytes = (await stat(join(dir, 'color.webp'))).size + (await stat(join(dir, 'normal.png'))).size;
  results[name] = { height: +r.height.toFixed(3), width: +r.width.toFixed(3), span: +r.span.toFixed(3), size: SIZE, bytes, src: spec.src };
  console.log(`impostor ${name.padEnd(10)} ${spec.src.padEnd(14)} ${r.height.toFixed(1)} m tall  ${Math.round(bytes / 1024)} KB`);
}
await browser.close();
server.close();

// add them to the catalog
let src = await readFile(CATALOG, 'utf8');
let prev = {};
const m = src.match(/export const IMPOSTORS = ([\s\S]*?);\n/);
if (m) {
  prev = JSON.parse(m[1]);
  src = src.replace(m[0], '');
}
const all = Object.fromEntries(Object.entries({ ...prev, ...results }).filter(([k]) => IMPOSTORS[k]).sort(([a], [b]) => a.localeCompare(b)));
src = src.trimEnd() + `\n\nexport const IMPOSTORS = ${JSON.stringify(all, null, 1)};\n`;
await writeFile(CATALOG, src);
console.log('catalog updated');
