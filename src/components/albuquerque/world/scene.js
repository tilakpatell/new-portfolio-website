// Albuquerque, the world, in 3D: the desert valley at golden hour, the
// Sandias catching the light to the east, Central Avenue and 4th Street,
// Walt's street, and the places the shows happen, each with its sign (the
// title cards' periodic-table tile) and a marker where you pull up. Walt's
// Aztek, Hank's SUV and the buildings are Meshy models made for the site
// (scripts/meshy-albuquerque.mjs); any that don't load stand in as shapes.
//
// createAbqWorld(canvas) resolves to { render(state, ms), setPlaces(progress),
// beam(id), resize, info, dispose, lost }. `state` is the component's: the
// car, Hank, the heat and the place you're at (rules.js does the moving).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createStage } from '../../office/stage3d';
import { loadTexture } from '../../../lib/hdri';
import { splitWord } from '../elements';
import { COLLIDERS, HOUSES, LANDMARKS, PLACES, ROADS } from './rules';

const MODEL = (name) => `/models/albuquerque/world/${name}.glb`;
// which way each model's front faces as it was made, turned to face +z
export const FACING = { aztek: Math.PI / 2, rv: Math.PI / 2, suv: -Math.PI / 2, house: -Math.PI / 2, pollos: -Math.PI / 2, laundry: 0, casa: 0, office: 0, carwash: 0 };
const SKY = { top: new THREE.Color(0x3d6fb0), mid: new THREE.Color(0x9cc0de), horizon: new THREE.Color(0xf3c78f) };
const HAZE = 0xe9c9a0;
const SUN = new THREE.Vector3(-0.75, 0.32, 0.45).normalize(); // low in the west

// a seeded random, so the desert's the same every visit
const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── textures, painted ──
function canvasTex(size, paint, repeat = 1, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const speckle = (g, s, base, flecks, n, rand) => {
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    g.fillStyle = flecks[Math.floor(rand() * flecks.length)];
    g.globalAlpha = 0.25 + rand() * 0.5;
    const r = 0.6 + rand() * 1.8;
    g.fillRect(rand() * s, rand() * s, r, r);
  }
  g.globalAlpha = 1;
};
const sandTex = () =>
  canvasTex(
    512,
    (g, s) => {
      const rand = seeded(7);
      speckle(g, s, '#cfae80', ['#b89568', '#e2c79d', '#a9845a', '#d9bc90', '#8f7150'], 9000, rand);
      // wind ripples
      g.strokeStyle = 'rgba(120, 90, 55, 0.08)';
      g.lineWidth = 3;
      for (let y = 0; y < s; y += 22) {
        g.beginPath();
        for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 5);
        g.stroke();
      }
    },
    90,
  );
const asphaltTex = () =>
  canvasTex(256, (g, s) => {
    const rand = seeded(3);
    speckle(g, s, '#3b3a3a', ['#55524f', '#2b2a29', '#6a6662', '#484543'], 5000, rand);
    g.strokeStyle = 'rgba(20, 18, 16, 0.5)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      let x = rand() * s;
      let y = rand() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (rand() - 0.5) * 40), (y += (rand() - 0.5) * 40));
      g.stroke();
    }
  });
const dirtTex = () => canvasTex(256, (g, s) => speckle(g, s, '#a88660', ['#8e6f4d', '#c09d73', '#7b5f40'], 6000, seeded(5)));

// A roadside sign: the place's name with its periodic-table tile, as the
// title cards have it, and LOCKED across it until it's open.
function paintSign(g, place, open) {
  const W = 1024;
  const H = 512;
  g.clearRect(0, 0, W, H);
  g.fillStyle = open ? '#123a22' : '#2a2f2c';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f2efe4';
  g.lineWidth = 14;
  g.strokeRect(14, 14, W - 28, H - 28);
  // the first word with an element in it gets the tile
  const words = place.name.split(' ');
  let tile = null;
  const parts = words.map((w) => {
    if (tile) return { text: w };
    const s = splitWord(w.replace(/[^A-Za-zÁ-ú]/g, ''));
    if (!s.el) return { text: w };
    tile = s.el;
    return { before: w.slice(0, s.before.length), el: s.el, after: w.slice(s.before.length + s.el.sym.length) };
  });
  const size = place.name.length > 18 ? 74 : 92;
  g.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
  g.textBaseline = 'middle';
  const widths = parts.map((p) => (p.el ? g.measureText(p.before).width + size * 1.15 + g.measureText(p.after).width : g.measureText(p.text).width));
  const gap = size * 0.35;
  let x = (W - widths.reduce((a, b) => a + b, 0) - gap * (parts.length - 1)) / 2;
  const y = H * 0.42;
  parts.forEach((p, i) => {
    g.fillStyle = '#f2efe4';
    if (!p.el) {
      g.fillText(p.text, x, y);
    } else {
      g.fillText(p.before, x, y);
      let tx = x + g.measureText(p.before).width;
      const t = size * 1.1;
      g.fillStyle = '#2f8a45';
      g.fillRect(tx, y - t / 2 - 6, t, t + 12);
      g.strokeStyle = '#d7f0dc';
      g.lineWidth = 3;
      g.strokeRect(tx, y - t / 2 - 6, t, t + 12);
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.round(size * 0.78)}px Georgia, serif`;
      g.fillText(p.el.sym, tx + (t - g.measureText(p.el.sym).width) / 2, y + 4);
      g.font = `600 ${Math.round(size * 0.2)}px 'Courier New', monospace`;
      g.fillText(String(p.el.n), tx + 6, y - t / 2 + 6);
      g.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
      tx += t + 4;
      g.fillStyle = '#f2efe4';
      g.fillText(p.after, tx, y);
    }
    x += widths[i] + gap;
  });
  g.font = `600 44px 'Courier New', monospace`;
  g.fillStyle = '#f0c330';
  const sub = place.sub ?? '';
  g.fillText(sub, (W - g.measureText(sub).width) / 2, H * 0.76);
  if (!open) {
    g.fillStyle = 'rgba(10, 10, 10, 0.55)';
    g.fillRect(28, H * 0.3, W - 56, H * 0.24);
    g.font = `800 64px 'Courier New', monospace`;
    g.fillStyle = '#ff8a7a';
    const t = 'LOCKED';
    g.fillText(t, (W - g.measureText(t).width) / 2, H * 0.42);
  }
}

// a marker's icon: a diamond with a glyph, or a padlock
function paintIcon(g, open, glyph) {
  const s = 256;
  g.clearRect(0, 0, s, s);
  g.save();
  g.translate(s / 2, s / 2);
  g.rotate(Math.PI / 4);
  g.fillStyle = open ? '#f0c330' : '#5b605d';
  g.strokeStyle = '#111';
  g.lineWidth = 10;
  g.fillRect(-70, -70, 140, 140);
  g.strokeRect(-70, -70, 140, 140);
  g.restore();
  g.fillStyle = '#111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (open) {
    g.font = '800 84px Georgia, serif';
    g.fillText(glyph, s / 2, s / 2 + 4);
  } else {
    // a padlock
    g.fillStyle = '#e8e8e8';
    g.fillRect(s / 2 - 34, s / 2 - 10, 68, 52);
    g.strokeStyle = '#e8e8e8';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(s / 2, s / 2 - 12, 24, Math.PI, 0);
    g.stroke();
  }
}
const GLYPH = { home: 'W', rv: 'Me', saul: 'Sa', pollos: 'Po', superlab: 'Bl', casa: 'Ti' };

// ── shapes standing in for a model that didn't load ──
function standIn(name) {
  const g = new THREE.Group();
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const box = (w, h, d, c, x = 0, y = h / 2, z = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c));
    b.position.set(x, y, z);
    g.add(b);
  };
  const s = {
    aztek: () => (box(1.9, 1.1, 4.4, 0xb9b58f, 0, 0.75), box(1.7, 0.6, 2.4, 0x2a3036, 0, 1.5, -0.3)),
    suv: () => (box(2, 1.2, 4.8, 0x161718, 0, 0.8), box(1.85, 0.7, 2.8, 0x0d0e10, 0, 1.6, -0.2)),
    rv: () => (box(2.5, 2.6, 8.4, 0xe8dfcc, 0, 1.6), box(2.52, 0.25, 8.42, 0x9b5a2c, 0, 1.6)),
    house: () => (box(16, 3.2, 11, 0xd2b48c), box(16.4, 0.4, 11.4, 0x7a5a40, 0, 3.4)),
    pollos: () => (box(18, 4.2, 11, 0xf0c330), box(18.2, 0.6, 11.2, 0xc0392b, 0, 4.4)),
    laundry: () => box(24, 5.5, 14, 0xd8c4a0),
    casa: () => box(20, 3.6, 12, 0xd9b98f),
    office: () => (box(16, 4.2, 10, 0xd8c4a0), box(1.4, 5, 1.4, 0x5fa58a, 0, 6.7)),
    carwash: () => (box(18, 4.4, 9, 0xf2f2f0), box(18.2, 0.5, 9.2, 0x2e6fb5, 0, 4.4)),
  }[name];
  s?.();
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return g;
}

export async function createAbqWorld(canvas, { onLost, onSlow } = {}) {
  const stage = createStage(canvas, { onLost, onSlow, fov: 58 });
  const { renderer, scene, camera } = stage;
  // far enough for the sky dome and the Sandias
  camera.far = 2600;
  camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.05;
  scene.background = SKY.horizon.clone();
  scene.fog = new THREE.Fog(HAZE, 160, 900);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.35;
  const owned = [env];
  const own = (...xs) => (owned.push(...xs), xs[0]);
  const mobile = stage.coarse;

  // ── light: the low sun in the west, the sky, the warm ground ──
  scene.add(new THREE.HemisphereLight(0xb7d3f0, 0xb08a5a, 0.95));
  const sun = new THREE.DirectionalLight(0xffd6a0, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ── the sky: blue overhead, gold at the horizon, the sun's glow ──
  const skyMat = own(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: SKY.top }, mid: { value: SKY.mid }, horizon: { value: SKY.horizon }, sun: { value: SUN } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sun; varying vec3 vDir;
        void main() {
          float h = max(vDir.y, 0.0);
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.18, 0.75, h));
          float s = max(dot(normalize(vDir), sun), 0.0);
          c += vec3(1.0, 0.72, 0.42) * (pow(s, 12.0) * 0.55 + pow(s, 600.0) * 2.2);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(1300, 32, 16)), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  // ── the ground: sand, rising into low dunes past the edge of town ──
  const rand = seeded(42);
  const groundGeo = own(new THREE.PlaneGeometry(1800, 1800, 120, 120));
  groundGeo.rotateX(-Math.PI / 2);
  {
    const p = groundGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      const out = Math.max(0, r - 250) / 250;
      p.setY(i, out * out * (6 + 5 * Math.sin(x * 0.013) * Math.cos(z * 0.017) + 3 * Math.sin((x + z) * 0.031)) - (r > 250 ? 0.05 : 0));
    }
    groundGeo.computeVertexNormals();
  }
  const sand = own(sandTex());
  const ground = new THREE.Mesh(groundGeo, own(new THREE.MeshStandardMaterial({ map: sand, color: 0xffffff, roughness: 0.95 })));
  ground.receiveShadow = true;
  scene.add(ground);

  // ── the mountains: the Sandias to the east, mesas everywhere else ──
  {
    const N = 220;
    const pos = [];
    const col = [];
    const base = new THREE.Color(0x8a6a58);
    const peak = new THREE.Color(0xd99a8a); // the watermelon pink at sunset
    const mesa = new THREE.Color(0xb08560);
    const hAt = (a) => {
      const east = Math.max(0, Math.cos(a)); // the Sandias rise in the east
      const n = Math.sin(a * 9.1) * 0.35 + Math.sin(a * 23.7 + 1) * 0.2 + Math.sin(a * 51.3 + 2) * 0.1;
      return 26 + east * east * 120 * (0.75 + n * 0.5) + (1 - east) * (18 + n * 22) * (Math.sin(a * 3.3) > 0.2 ? 1.6 : 0.7);
    };
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const [h0, h1] = [hAt(a0), hAt(a1)];
      const R = 640;
      const p = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
      const quad = [p(a0, R, -8), p(a1, R, -8), p(a1, R + 60, h1), p(a0, R + 60, h0)];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(...quad[k]);
        const top = k === 2 || k === 3;
        const east = Math.max(0, Math.cos(a0));
        const c = top ? peak.clone().lerp(mesa, 1 - east) : base;
        col.push(c.r, c.g, c.b);
      }
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = own(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));
    scene.add(new THREE.Mesh(g, m));
  }

  // ── the roads ──
  const asphalt = own(asphaltTex());
  const dirt = own(dirtTex());
  const roadMat = own(new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92 }));
  const dirtMat = own(new THREE.MeshStandardMaterial({ map: dirt, roughness: 1 }));
  const lineMat = own(new THREE.MeshStandardMaterial({ color: 0xf0c330, roughness: 0.6, emissive: 0x2a1f00 }));
  const edgeMat = own(new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 }));
  const dashes = [];
  ROADS.forEach((r, i) => {
    const len = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z);
    const yaw = Math.atan2(r.b.x - r.a.x, r.b.z - r.a.z);
    const mid = { x: (r.a.x + r.b.x) / 2, z: (r.a.z + r.b.z) / 2 };
    const geo = own(new THREE.PlaneGeometry(r.w, len + r.w));
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (r.w / 6), uv.getY(k) * ((len + r.w) / 6));
    const mesh = new THREE.Mesh(geo, r.dirt ? dirtMat : roadMat);
    mesh.position.set(mid.x, 0.02 + i * 0.004, mid.z);
    mesh.rotation.y = yaw;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (r.dirt) return;
    // the lines: a solid double yellow down Central, dashes elsewhere, white edges
    for (let s = -len / 2 + 4; s < len / 2 - 4; s += r.id === 'central' ? 6 : 9) dashes.push({ x: mid.x + Math.sin(yaw) * s, z: mid.z + Math.cos(yaw) * s, yaw, y: 0.045 + i * 0.004, solid: r.id === 'central' });
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(own(new THREE.PlaneGeometry(0.18, len)), edgeMat);
      e.rotation.set(-Math.PI / 2, 0, -yaw);
      e.position.set(mid.x + Math.cos(yaw) * side * (r.w / 2 - 0.5), 0.045 + i * 0.004, mid.z - Math.sin(yaw) * side * (r.w / 2 - 0.5));
      scene.add(e);
    }
  });
  {
    const dashGeo = own(new THREE.PlaneGeometry(0.22, 3));
    dashGeo.rotateX(-Math.PI / 2);
    const n = dashes.reduce((k, d) => k + (d.solid ? 2 : 1), 0);
    const inst = new THREE.InstancedMesh(dashGeo, lineMat, n);
    const o = new THREE.Object3D();
    let k = 0;
    for (const d of dashes)
      for (const off of d.solid ? [-0.2, 0.2] : [0]) {
        o.position.set(d.x + Math.cos(d.yaw) * off, d.y, d.z - Math.sin(d.yaw) * off);
        o.rotation.set(0, d.yaw, 0);
        o.scale.set(1, 1, d.solid ? 2.05 : 1);
        o.updateMatrix();
        inst.setMatrixAt(k++, o.matrix);
      }
    scene.add(inst);
  }

  // ── the desert: creosote, yucca, cholla and rocks, never on a road or in a building ──
  const clear = (x, z, pad) => {
    for (const r of ROADS) {
      const dx = r.b.x - r.a.x;
      const dz = r.b.z - r.a.z;
      const t = Math.max(0, Math.min(1, ((x - r.a.x) * dx + (z - r.a.z) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - (r.a.x + t * dx), z - (r.a.z + t * dz)) < r.w / 2 + pad) return false;
    }
    for (const c of COLLIDERS) if (Math.abs(x - c.x) < c.w / 2 + pad + 2 && Math.abs(z - c.z) < c.d / 2 + pad + 2) return false;
    for (const p of PLACES) if (Math.hypot(x - p.door.x, z - p.door.z) < p.radius + 2) return false;
    return true;
  };
  const scatter = (geo, mat, n, { pad = 2, rMin = 0, rMax = 420, scale = [0.7, 1.4], tint }) => {
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    let k = 0;
    for (let tries = 0; k < n && tries < n * 30; tries++) {
      const a = rand() * Math.PI * 2;
      const r = rMin + Math.sqrt(rand()) * (rMax - rMin);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!clear(x, z, pad)) continue;
      const s = scale[0] + rand() * (scale[1] - scale[0]);
      o.position.set(x, r > 250 ? (((r - 250) / 250) ** 2) * 6 : 0, z);
      o.rotation.set(0, rand() * Math.PI * 2, 0);
      o.scale.setScalar(s);
      o.updateMatrix();
      inst.setMatrixAt(k, o.matrix);
      if (tint) inst.setColorAt(k, c.copy(tint[0]).lerp(tint[1], rand()));
      k++;
    }
    inst.count = k;
    inst.castShadow = true;
    inst.receiveShadow = true;
    scene.add(inst);
    return inst;
  };
  {
    // creosote: a cluster of blobs
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.IcosahedronGeometry(0.55 + (i % 3) * 0.12, 0);
      b.translate(Math.sin(i * 2.4) * 0.5, 0.45 + (i % 2) * 0.25, Math.cos(i * 2.4) * 0.5);
      parts.push(b);
    }
    const shrub = own(mergeGeometries(parts));
    for (const p of parts) p.dispose();
    const shrubMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));
    scatter(shrub, shrubMat, mobile ? 260 : 520, { pad: 1.5, tint: [new THREE.Color(0x6a7440), new THREE.Color(0x8f8a52)] });
    // yucca: a spray of blades
    const blades = [];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.ConeGeometry(0.07, 1.4, 3);
      b.translate(0, 0.7, 0);
      b.rotateZ(0.35 + (i % 3) * 0.12);
      b.rotateY((i / 9) * Math.PI * 2);
      blades.push(b);
    }
    const yucca = own(mergeGeometries(blades));
    for (const b of blades) b.dispose();
    scatter(yucca, own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true })), mobile ? 70 : 140, { pad: 2, tint: [new THREE.Color(0x5f7a4a), new THREE.Color(0x8aa060)] });
    // cholla: a trunk and crooked arms
    const arms = [new THREE.CylinderGeometry(0.16, 0.2, 1.8, 6).translate(0, 0.9, 0)];
    for (let i = 0; i < 4; i++) {
      const a = new THREE.CylinderGeometry(0.11, 0.13, 0.8, 5);
      a.rotateZ(0.9);
      a.translate(0.3, 0.9 + i * 0.25, 0);
      a.rotateY(i * 1.7);
      arms.push(a);
    }
    const cholla = own(mergeGeometries(arms));
    for (const a of arms) a.dispose();
    scatter(cholla, own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true })), mobile ? 40 : 90, { pad: 2, scale: [0.8, 1.5], tint: [new THREE.Color(0x7d8f55), new THREE.Color(0x9aa46a)] });
    // rocks
    const rock = own(new THREE.DodecahedronGeometry(0.8, 0));
    {
      const p = rock.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.25), p.getY(i) * 0.6, p.getZ(i) * (1 + Math.cos(i * 2.3) * 0.2));
      rock.computeVertexNormals();
    }
    scatter(rock, own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true })), mobile ? 120 : 240, { pad: 1, scale: [0.5, 2.2], tint: [new THREE.Color(0x9a7a5a), new THREE.Color(0xc0a07a)] });
  }

  // ── power poles and wires down Central, street lights down 4th ──
  {
    const poleGeo = own(mergeGeometries([new THREE.CylinderGeometry(0.14, 0.2, 9, 6).translate(0, 4.5, 0), new THREE.BoxGeometry(2.4, 0.16, 0.16).translate(0, 8.4, 0)]));
    const xs = [];
    for (let x = -184; x <= 184; x += 28) xs.push(x);
    const poles = new THREE.InstancedMesh(poleGeo, own(new THREE.MeshStandardMaterial({ color: 0x6b5440, roughness: 0.9 })), xs.length);
    const o = new THREE.Object3D();
    xs.forEach((x, i) => {
      o.position.set(x, 0, -9.5);
      o.updateMatrix();
      poles.setMatrixAt(i, o.matrix);
    });
    poles.castShadow = true;
    scene.add(poles);
    const wire = [];
    for (let i = 0; i + 1 < xs.length; i++)
      for (const off of [-1.05, 0, 1.05])
        for (let s = 0; s < 8; s++) {
          const a = s / 8;
          const b = (s + 1) / 8;
          const y = (t) => 8.5 - Math.sin(t * Math.PI) * 0.9;
          wire.push(xs[i] + (xs[i + 1] - xs[i]) * a, y(a), -9.5 + off, xs[i] + (xs[i + 1] - xs[i]) * b, y(b), -9.5 + off);
        }
    const wg = own(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    scene.add(new THREE.LineSegments(wg, own(new THREE.LineBasicMaterial({ color: 0x2b2420 }))));
    const lampGeo = own(mergeGeometries([new THREE.CylinderGeometry(0.1, 0.14, 7, 6).translate(0, 3.5, 0), new THREE.BoxGeometry(0.16, 0.16, 1.8).translate(0, 7, 0.9)]));
    const lamps = [];
    for (let z = -140; z <= 140; z += 30) if (Math.abs(z) > 10) lamps.push({ x: 6.2, z, yaw: -Math.PI / 2 });
    const lampInst = new THREE.InstancedMesh(lampGeo, own(new THREE.MeshStandardMaterial({ color: 0x7c8085, roughness: 0.5, metalness: 0.6 })), lamps.length);
    lamps.forEach((l, i) => {
      o.position.set(l.x, 0, l.z);
      o.rotation.set(0, l.yaw, 0);
      o.updateMatrix();
      lampInst.setMatrixAt(i, o.matrix);
    });
    lampInst.castShadow = true;
    scene.add(lampInst);
  }

  // ── signs and markers at each place ──
  const signs = {};
  const markers = {};
  const ringMat = (c) => own(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const signPost = own(new THREE.MeshStandardMaterial({ color: 0x5d6064, roughness: 0.5, metalness: 0.6 }));
  for (const p of PLACES) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const tex = own(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const face = own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
    const sign = new THREE.Group();
    const board = new THREE.Mesh(own(new THREE.PlaneGeometry(5.2, 2.6)), face);
    board.position.y = 3.6;
    const back = board.clone();
    back.rotation.y = Math.PI;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(own(new THREE.CylinderGeometry(0.09, 0.09, 4.9, 6)), signPost);
      post.position.set(s * 2.2, 2.45, -0.06);
      sign.add(post);
    }
    sign.add(board, back);
    // beside the drive, facing the road the way the building does
    const right = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
    sign.position.set(p.door.x + right.x * (p.radius + 1.5) - Math.sin(p.yaw) * 2, 0, p.door.z + right.z * (p.radius + 1.5) - Math.cos(p.yaw) * 2);
    sign.rotation.y = p.yaw;
    sign.traverse((o) => o.isMesh && (o.castShadow = true));
    scene.add(sign);
    signs[p.id] = { ctx: c.getContext('2d'), tex, key: '' };
    // the marker: a ring on the ground and a diamond over it
    const ring = new THREE.Mesh(own(new THREE.RingGeometry(p.radius - 1.2, p.radius - 0.7, 48)), ringMat(0xf0c330));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.door.x, 0.08, p.door.z);
    const ic = document.createElement('canvas');
    ic.width = ic.height = 256;
    const icTex = own(new THREE.CanvasTexture(ic));
    icTex.colorSpace = THREE.SRGBColorSpace;
    const icon = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: icTex, depthWrite: false, toneMapped: false })));
    icon.scale.setScalar(2.6);
    icon.position.set(p.door.x, 5, p.door.z);
    scene.add(ring, icon);
    markers[p.id] = { ring, icon, ictx: ic.getContext('2d'), icTex, open: null };
  }

  // the unlock beam: a tall column of light over a place, for a few seconds
  const beamMat = own(new THREE.MeshBasicMaterial({ color: 0xf6d76a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const beamMesh = new THREE.Mesh(own(new THREE.CylinderGeometry(2.4, 3.4, 120, 24, 1, true)), beamMat);
  beamMesh.visible = false;
  scene.add(beamMesh);
  let beamAt = -1;

  // ── dust: puffs kicked up behind the car ──
  let cloud = null;
  const dust = [];
  const dustMat = own(new THREE.SpriteMaterial({ color: 0xd9bf98, transparent: true, opacity: 0, depthWrite: false }));
  for (let i = 0; i < (mobile ? 12 : 22); i++) {
    const s = new THREE.Sprite(dustMat.clone());
    owned.push(s.material);
    s.visible = false;
    scene.add(s);
    dust.push({ s, t: 1, v: new THREE.Vector3() });
  }
  let dustNext = 0;

  // ── the models ──
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const names = ['aztek', 'suv', ...new Set([...PLACES, ...LANDMARKS].map((p) => p.model)), 'house'];
  const [loaded, cloudTex] = await Promise.all([
    Promise.all(names.map((n) => loader.loadAsync(MODEL(n)).then((g) => [n, g.scene], () => [n, null]))).then(Object.fromEntries),
    loadTexture('cloud.webp').catch(() => null),
  ]);
  cloud = cloudTex;
  if (cloud) for (const d of dust) d.s.material.map = cloud;
  const dressModel = (o) => {
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (m.material.map) m.material.map.anisotropy = 4;
      m.material.roughness = 0.85;
      m.material.metalness = 0;
      owned.push(m.geometry, m.material, ...(m.material.map ? [m.material.map] : []));
    });
    return o;
  };
  const make = (name) => {
    const g = new THREE.Group();
    const m = loaded[name] ? dressModel(loaded[name]) : standIn(name);
    m.rotation.y = FACING[name] ?? 0;
    g.add(m);
    return g;
  };
  for (const p of [...PLACES, ...LANDMARKS]) {
    const b = make(p.model);
    b.position.set(p.at.x, 0, p.at.z);
    b.rotation.y = p.yaw;
    scene.add(b);
  }
  // the neighbours: Walt's house again, turned and tinted, as one draw
  {
    let mesh = null;
    loaded.house?.traverse((o) => o.isMesh && !mesh && (mesh = o));
    if (mesh) {
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, HOUSES.length);
      const o = new THREE.Object3D();
      const parent = new THREE.Matrix4();
      mesh.updateWorldMatrix(true, false);
      HOUSES.forEach((h, i) => {
        o.position.set(h.at.x, 0, h.at.z);
        o.rotation.set(0, h.yaw + (FACING.house ?? 0), 0);
        o.scale.setScalar(0.82);
        o.updateMatrix();
        inst.setMatrixAt(i, parent.multiplyMatrices(o.matrix, mesh.matrixWorld));
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      scene.add(inst);
    } else
      for (const h of HOUSES) {
        const b = standIn('house');
        b.position.set(h.at.x, 0, h.at.z);
        b.rotation.y = h.yaw;
        b.scale.setScalar(0.8);
        scene.add(b);
      }
  }
  // Walt's Aztek, which leans as it goes, and Hank's SUV with its lights
  const car = new THREE.Group();
  const body = make('aztek');
  car.add(body);
  scene.add(car);
  const hank = new THREE.Group();
  hank.add(make('suv'));
  const siren = ['#ff2a2a', '#2a6bff'].map((c, i) => {
    const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    s.scale.setScalar(1.4);
    s.position.set(i ? 0.5 : -0.5, 2.25, 0.4);
    hank.add(s);
    return s;
  });
  scene.add(hank);

  // ── per frame ──
  const camPos = new THREE.Vector3(0, 120, 160);
  const camLook = new THREE.Vector3();
  const want = new THREE.Vector3();
  const look = new THREE.Vector3();
  const v = new THREE.Vector3();
  let clock = 0;
  let intro = 0; // seconds into the swoop down from over the town
  let snap = false; // straight to behind the car on the next frame
  let roll = 0;
  let pitch = 0;
  let lastSpeed = 0;
  let shake = 0;
  let fov = 58;

  function setPlaces(prog) {
    for (const p of prog.places) {
      const s = signs[p.id];
      const key = `${p.open}`;
      if (s.key !== key) {
        s.key = key;
        paintSign(s.ctx, p, p.open);
        s.tex.needsUpdate = true;
      }
      const m = markers[p.id];
      if (m.open !== p.open) {
        m.open = p.open;
        paintIcon(m.ictx, p.open, GLYPH[p.id]);
        m.icTex.needsUpdate = true;
        m.ring.material.color.set(p.open ? 0xf0c330 : 0x9a9f9c);
      }
      m.next = p.id === prog.next;
    }
  }

  function render(state, ms = 16) {
    if (stage.lost) return;
    const dt = Math.min(0.05, ms / 1000);
    clock += dt;
    const c = state.car;
    // the car: where it is, leaning into the turn and back on the throttle
    car.position.set(c.x, 0, c.z);
    car.rotation.y = c.yaw;
    const accel = (c.speed - lastSpeed) / Math.max(dt, 1e-3);
    lastSpeed = c.speed;
    roll += ((-(state.steer ?? 0) * Math.min(1, Math.abs(c.speed) / 18) * 0.06) - roll) * Math.min(1, dt * 6);
    pitch += ((-accel * 0.004) - pitch) * Math.min(1, dt * 5);
    body.rotation.set(THREE.MathUtils.clamp(pitch, -0.05, 0.05), 0, roll);
    body.position.y = Math.abs(c.speed) > 1 && !state.onRoad ? Math.sin(clock * 22) * 0.025 : 0;
    // Hank, and his lights when he's on you
    hank.position.set(state.hank.x, 0, state.hank.z);
    hank.rotation.y = state.hank.yaw;
    const flash = state.heat > 0.25 ? state.heat : 0;
    siren.forEach((s, i) => (s.material.opacity = flash * (Math.sin(clock * 14 + i * Math.PI) > 0 ? 1 : 0.15)));
    // dust off the sand, the dirt, and a bump
    if (state.bump > 4) shake = Math.min(1, state.bump / 20);
    dustNext -= dt;
    if ((Math.abs(c.speed) > 5 && !state.asphalt) || state.bump > 4) {
      if (dustNext <= 0) {
        dustNext = 0.05;
        const d = dust.find((p) => p.t >= 1);
        if (d) {
          d.t = 0;
          d.s.visible = true;
          d.s.position.set(c.x - Math.sin(c.yaw) * 2.3 + (Math.random() - 0.5), 0.5, c.z - Math.cos(c.yaw) * 2.3 + (Math.random() - 0.5));
          d.v.set((Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2);
        }
      }
    }
    for (const d of dust) {
      if (d.t >= 1) continue;
      d.t += dt / 1.4;
      d.s.position.addScaledVector(d.v, dt);
      d.s.scale.setScalar(1 + d.t * 3.5);
      d.s.material.opacity = (1 - d.t) * 0.55;
      if (d.t >= 1) d.s.visible = false;
    }
    // the markers pulse, the next place's most
    for (const p of PLACES) {
      const m = markers[p.id];
      const near = state.near === p.id;
      const k = 0.5 + 0.5 * Math.sin(clock * (m.next ? 4 : 2));
      m.ring.material.opacity = (m.open ? 0.5 : 0.3) + k * (near ? 0.5 : 0.3);
      m.ring.scale.setScalar(1 + (near ? 0.04 * k : 0));
      m.icon.position.y = 5 + Math.sin(clock * 2 + p.door.x) * 0.3;
      m.icon.scale.setScalar(m.next ? 3.2 : 2.4);
    }
    // the beam over a place that's just opened
    if (beamAt >= 0) {
      beamAt += dt;
      beamMat.opacity = Math.min(1, beamAt * 2) * Math.max(0, 1 - (beamAt - 4) / 2) * 0.5;
      if (beamAt > 6) {
        beamAt = -1;
        beamMesh.visible = false;
      }
    }

    // the camera: from over the town, down behind the car, and after it
    const fwd = v.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const back = mobile ? 11 : 9.5;
    want.set(c.x - fwd.x * back, (mobile ? 5.2 : 4.4) + Math.max(0, c.speed) * 0.04, c.z - fwd.z * back);
    look.set(c.x + fwd.x * 5, 1.3, c.z + fwd.z * 5);
    if (intro < 1) {
      intro = Math.min(1, intro + dt / 2.8);
      const k = intro * intro * (3 - 2 * intro);
      camPos.lerpVectors(v.set(c.x + 60, 95, c.z + 90), want, k);
      camLook.copy(look);
    } else if (snap) {
      snap = false;
      camPos.copy(want);
      camLook.copy(look);
    } else {
      const k = 1 - Math.exp(-dt * 4);
      camPos.lerp(want, k);
      camLook.lerp(look, 1 - Math.exp(-dt * 8));
    }
    camera.position.copy(camPos);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.4;
      camera.position.y += (Math.random() - 0.5) * shake * 0.3;
      shake = Math.max(0, shake - dt * 2.5);
    }
    camera.lookAt(camLook);
    const fovWant = 58 + Math.min(1, Math.max(0, c.speed) / 24) * 8;
    if (Math.abs(fovWant - fov) > 0.05) {
      fov += (fovWant - fov) * Math.min(1, dt * 3);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // the sun's shadows follow the car
    sun.target.position.set(c.x, 0, c.z);
    sun.position.copy(sun.target.position).addScaledVector(SUN, 160);
    sky.position.copy(camera.position);
    stage.render(ms);
  }

  return {
    render,
    setPlaces,
    // a beam of light over a place that's just opened
    beam(id) {
      const p = PLACES.find((x) => x.id === id);
      if (!p) return;
      beamMesh.position.set(p.door.x, 60, p.door.z);
      beamMesh.visible = true;
      beamAt = 0;
    },
    // straight down behind the car, no swoop (after leaving a place)
    settle() {
      intro = 1;
      snap = true;
    },
    resize: stage.resize,
    info: stage.info,
    project: stage.project,
    dispose() {
      for (const o of owned) o.dispose?.();
      if (cloud) cloud.dispose();
      stage.dispose();
    },
    get lost() {
      return stage.lost;
    },
  };
}
