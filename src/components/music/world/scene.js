// The music planet's courtyard, drawn. It decides nothing (./layout.js says
// what stands where; MusicWorld.jsx walks and plays): it builds the planet
// at dusk and draws what it's handed.
//
//   the sky      a dusk gradient, stars, and the planet's brass rings arcing overhead
//   the dunes    saffron sand to the horizon, chhatris standing on them
//   the terrace  sandstone paving (Poly Haven scans), a parapet of pillars and
//                jali, little chhatris on its corners, a stepped pool with diyas
//   the music    the instruments (Meshy models: scripts/meshy-music.mjs) on a
//                rug before the chhatri, brass lamps either side lighting them
//
// Instruments glow when they sound, and what they play floats up as sargam.

import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { createStage } from '../../../lib/stage3d';
import { budget, device } from '../../../lib/device';
import { antiTile } from '../../../lib/three/surface';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { groundWorld } from '../../../lib/three/groundwork';
import { houseOn } from '../../../lib/three/house';
import { LOOK } from './look';
import { EYE, GADDI, INSTRUMENTS, LAMPS, PARAPET, PAVILION, POOL, RUG, TERRACE } from './layout';
import { sharpen } from '../../../lib/three/textures';

// (the site's shared loader, fetched only once the courtyard is up)
const loaders = () => import('../../../lib/three/gltf');

// dusk, in display colours
const SKY = { zenith: '#16173a', mid: '#4b2f5c', horizon: '#f2894a', sun: '#ffc27a' };
const SUN_DIR = new THREE.Vector3(-0.86, 0.12, -0.5).normalize(); // low in the west, ahead and to the left
const FOG = '#c8734a';
// the planet (its radius) and its rings, as seen from the courtyard on top of it
const RING = { planet: 3000, inner: 3700, outer: 5600, lean: 0.36 };

// ── small helpers ──────────────────────────────────────────────────────────
function rand(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth value noise, for the dunes
function noise2(seed) {
  const r = rand(seed);
  const N = 256;
  const g = new Float32Array(N * N).map(() => r());
  const at = (i, j) => g[((j & (N - 1)) * N + (i & (N - 1))) | 0];
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const u = x - i;
    const v = y - j;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * su;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * su;
    return a + (b - a) * sv;
  };
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

// ── the world ──────────────────────────────────────────────────────────────
export async function createMusicWorld(el, { onLost } = {}) {
  const tier = device().tier;
  const fit = budget(tier);
  const small = tier !== 'high';
  const stage = createStage(el, { shadows: true, fov: 64, near: 0.05, far: 9000, onLost, exposure: 1.08, bloom: LOOK.bloom });
  const { scene, camera, renderer } = stage;
  stage.grade({ contrast: 0.1, saturation: 1.08, vignette: 0.24, grain: 0.018, shadow: [0.0, 0.006, 0.03], high: [0.035, 0.014, 0] });
  const aniso = Math.min(fit.aniso, renderer.capabilities.getMaxAnisotropy());
  scene.fog = new THREE.Fog(FOG, 70, 1100);
  camera.rotation.order = 'YXZ';

  // ── textures ──
  const texLoader = new THREE.TextureLoader();
  const tex = (url, { srgb = false, repeat = [1, 1] } = {}) => {
    const t = texLoader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // a Poly Haven scan: colour, normal, and AO/roughness packed in one
  const scan = (name, repeat, extra = {}) => {
    const arm = tex(`/games/tex/${name}/arm.webp`, { repeat });
    return new THREE.MeshStandardMaterial({
      map: tex(`/games/tex/${name}/color.webp`, { srgb: true, repeat }),
      normalMap: tex(`/games/tex/${name}/normal.webp`, { repeat }),
      aoMap: arm,
      roughnessMap: arm,
      roughness: 1,
      metalness: 0,
      ...extra,
    });
  };

  // ── the sky ──
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(SKY.zenith) },
      uMid: { value: new THREE.Color(SKY.mid) },
      uHorizon: { value: new THREE.Color(SKY.horizon) },
      uSun: { value: new THREE.Color(SKY.sun) },
      uSunDir: { value: SUN_DIR },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      uniform vec3 uZenith, uMid, uHorizon, uSun, uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
        c = mix(c, uZenith, smoothstep(0.18, 0.75, h));
        // below the horizon, the far dunes in the haze
        c = mix(c, uHorizon * 0.55, smoothstep(0.0, -0.12, h));
        float s = max(dot(d, uSunDir), 0.0);
        c += uSun * (pow(s, 6.0) * 0.45 + pow(s, 60.0) * 0.6 + pow(s, 900.0) * 4.0) * smoothstep(-0.05, 0.05, h);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 48, 24), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // stars, fading towards the haze at the horizon
  {
    const r = rand(7);
    const n = Math.round(2200 * fit.stars);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = 0.06 + r() * 0.94;
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * rr * 7000, y * 7000, Math.sin(a) * rr * 7000], i * 3);
      const k = Math.min(1, (y - 0.06) * 3) * (0.35 + r() * 0.65);
      col.set([k, k * (0.92 + r() * 0.08), k * (0.85 + r() * 0.15)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    stars.frustumCulled = false;
    scene.add(stars);
  }

  // the planet's rings: bands of brass and saffron, round the planet, arching over the sky
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uInner: { value: RING.inner }, uOuter: { value: RING.outer }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vP; varying float vY; void main() { vP = position.xy; vY = (modelMatrix * vec4(position, 1.0)).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uInner, uOuter, uTime;
      varying vec2 vP;
      varying float vY;
      float band(float x, float a, float b, float soft) { return smoothstep(a - soft, a, x) * (1.0 - smoothstep(b, b + soft, x)); }
      void main() {
        float t = (length(vP) - uInner) / (uOuter - uInner);
        // bands and gaps, like the rings in the universe map
        float a = band(t, 0.02, 0.2, 0.02) * 0.55 + band(t, 0.24, 0.31, 0.01) * 0.85 + band(t, 0.36, 0.62, 0.02) * 0.6 + band(t, 0.66, 0.7, 0.008) * 0.9 + band(t, 0.75, 0.97, 0.03) * 0.35;
        float grain = 0.82 + 0.18 * sin(t * 420.0) * sin(t * 97.0 + 1.3);
        vec3 brass = mix(vec3(1.0, 0.5, 0.16), vec3(1.0, 0.76, 0.4), smoothstep(0.3, 0.8, t));
        // where the ring would dip behind the planet, below the horizon, it's gone
        float above = smoothstep(-20.0, 260.0, vY);
        gl_FragColor = vec4(brass * a * grain * 0.3 * above, 1.0);
      }`,
  });
  const rings = new THREE.Mesh(new THREE.RingGeometry(RING.inner, RING.outer, 480, 1), ringMat);
  // round the planet's middle, its centre far below the courtyard: the ring's plane holds the
  // east-west line and leans north from the upright, so it arches over the northern sky
  rings.position.set(0, -RING.planet, 0);
  rings.rotation.set(-RING.lean, 0.18, 0, 'YXZ');
  rings.frustumCulled = false;
  rings.renderOrder = -9;
  scene.add(rings);

  // ── the light ──
  const hemi = new THREE.HemisphereLight('#7c78b8', '#7a4524', 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffa060', 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(60);
  sun.target.position.set(0, 0, -3);
  scene.add(sun, sun.target);
  // the house look (lib/three/house): one shadow colour from the dusk's sky
  // light on everything, fog the colour of the dusk sky, the house tone mapper
  const house = houseOn({ renderer, scene, sun, hemi });
  house.sky({ low: SKY.horizon, high: SKY.mid, below: 1, sunDir: SUN_DIR });
  if (renderer.shadowMap.enabled) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(fit.shadowMap, fit.shadowMap);
    const c = sun.shadow.camera;
    c.left = -20;
    c.right = 20;
    c.top = 20;
    c.bottom = -20;
    c.near = 1;
    c.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
  }
  // the environment the lacquer and brass reflect: a dusk sky
  new HDRLoader().load(
    '/games/hdri/music-dusk.hdr',
    (t) => {
      if (stage.disposed) return t.dispose();
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromEquirectangular(t).texture;
      scene.environmentIntensity = 0.5;
      pm.dispose();
      t.dispose();
      return null;
    },
    undefined,
    () => null,
  );

  // ── the dunes ──
  const floors = []; // what the courtyard's light is baked on: the dunes and the paving
  const dune = noise2(11);
  const groundAt = (x, z) => {
    const d = Math.hypot(x, z);
    const far = THREE.MathUtils.smoothstep(d, 26, 110);
    const h = dune(x * 0.012, z * 0.012) * 9 + dune(x * 0.035 + 7, z * 0.035) * 2.4 + dune(x * 0.004 - 3, z * 0.004) * 26;
    return -TERRACE.height - 0.05 + far * (h - 6);
  };
  {
    const seg = small ? 110 : 180;
    const g = new THREE.PlaneGeometry(2400, 2400, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    // (the sand repeats 140 times across the dunes: a turned second copy,
    // blended in by a slow noise, keeps the repeat from showing)
    const sand = antiTile(scan('music-dunes', [140, 140], { color: new THREE.Color('#ffc890') }), { frequency: 0.03, scale: 0.7 });
    const dunes = new THREE.Mesh(g, sand);
    dunes.receiveShadow = true;
    scene.add(dunes);
    floors.push(dunes);
  }

  // ── the terrace ──
  const T = TERRACE.half;
  const stoneFloor = scan('music-terrace', [1, 1], { color: new THREE.Color('#ffd0ae') });
  const stoneWall = scan('music-wall', [1, 1], { color: new THREE.Color('#f0b894') });
  const wallMat = (w, h) => {
    const m = stoneWall.clone();
    for (const k of ['map', 'normalMap', 'aoMap', 'roughnessMap']) {
      m[k] = stoneWall[k].clone();
      // the stone at its own scale (about 2.4 m to a tile), however long and thin the face
      m[k].repeat.set(w / 2.4, h / 2.4);
      m[k].needsUpdate = true;
    }
    return m;
  };
  const box = (w, h, d, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  {
    // the paving, with a hole where the pool goes down (UVs in metres: a slab every 4.6 m)
    const outline = new THREE.Shape([new THREE.Vector2(-T, -T), new THREE.Vector2(T, -T), new THREE.Vector2(T, T), new THREE.Vector2(-T, T)]);
    const P = POOL.half + 0.3;
    outline.holes.push(new THREE.Path([new THREE.Vector2(POOL.x - P, -POOL.z - P), new THREE.Vector2(POOL.x - P, -POOL.z + P), new THREE.Vector2(POOL.x + P, -POOL.z + P), new THREE.Vector2(POOL.x + P, -POOL.z - P)]));
    for (const k of ['map', 'normalMap', 'aoMap', 'roughnessMap']) stoneFloor[k].repeat.set(1 / 4.6, 1 / 4.6);
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(outline), stoneFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    floors.push(floor);
    // the plinth it stands on
    const plinth = wallMat(T * 2, TERRACE.height + 0.6);
    for (const [x, z, ry] of [[0, T, 0], [0, -T, 0], [T, 0, Math.PI / 2], [-T, 0, Math.PI / 2]]) box(T * 2 + 0.3, TERRACE.height + 0.6, 0.3, plinth, x, -(TERRACE.height + 0.6) / 2 + 0.01, z, ry);
  }

  // the parapet: pillars, a coping, and jali between them
  {
    const jali = canvas(256, 256, (c, w, h) => {
      c.fillStyle = '#000';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fff';
      c.lineWidth = 9;
      // interlocking circles, the commonest jali
      for (let i = -1; i <= 2; i++)
        for (let j = -1; j <= 2; j++) {
          c.beginPath();
          c.arc(i * 128, j * 128, 90, 0, Math.PI * 2);
          c.stroke();
          c.beginPath();
          c.arc(i * 128 + 64, j * 128 + 64, 90, 0, Math.PI * 2);
          c.stroke();
        }
      c.strokeRect(4, 4, w - 8, h - 8);
    });
    const alpha = new THREE.CanvasTexture(jali);
    sharpen(alpha);
    alpha.wrapS = alpha.wrapT = THREE.RepeatWrapping;
    const lattice = wallMat(2.2, 0.6);
    lattice.alphaMap = alpha;
    lattice.alphaTest = 0.5;
    lattice.side = THREE.DoubleSide;
    const H = T - PARAPET.inset;
    const pillar = wallMat(0.45, PARAPET.height);
    const coping = wallMat((T - PARAPET.inset) * 2, PARAPET.thick + 0.08); // sized for its top
    const step = 2.5;
    for (const side of [0, 1, 2, 3]) {
      const ry = side % 2 ? Math.PI / 2 : 0;
      const sign = side < 2 ? 1 : -1;
      const along = (v) => (side % 2 ? [sign * H, v] : [v, sign * H]);
      for (let v = -H; v <= H + 1e-6; v += step) {
        const [x, z] = along(v);
        box(0.42, PARAPET.height + 0.08, 0.42, pillar, x, (PARAPET.height + 0.08) / 2, z, ry);
        if (v + step <= H + 1e-6) {
          const [mx, mz] = along(v + step / 2);
          const panel = box(step - 0.42, PARAPET.height - 0.22, 0.08, lattice, mx, (PARAPET.height - 0.22) / 2 + 0.06, mz, ry);
          panel.castShadow = false;
        }
      }
      const [cx, cz] = along(0);
      box(H * 2 + 0.46, 0.12, PARAPET.thick + 0.08, coping, cx, PARAPET.height + 0.06, cz, ry);
    }
  }

  // the pool: a stepped kund, its water, and diyas floating on it
  let water = null;
  const diyas = [];
  {
    const P = POOL.half;
    const steps = 3;
    const rise = POOL.depth / steps;
    for (let k = 0; k < steps; k++) {
      const half = P - k * 0.42;
      const y = -k * rise - rise / 2;
      const m = wallMat(half * 2, rise);
      for (const [x, z, w, d] of [[0, half, half * 2, 0.42], [0, -half, half * 2, 0.42], [half, 0, 0.42, half * 2], [-half, 0, 0.42, half * 2]]) box(w, rise, d, m, POOL.x + x, y, POOL.z + z);
    }
    // a rim of coping round it
    const rim = wallMat(P * 2, 0.3); // sized for its top, which is what's seen
    for (const [x, z, w, d] of [[0, P + 0.15, P * 2 + 0.6, 0.3], [0, -P - 0.15, P * 2 + 0.6, 0.3], [P + 0.15, 0, 0.3, P * 2], [-P - 0.15, 0, 0.3, P * 2]]) box(w, 0.1, d, rim, POOL.x + x, 0.05, POOL.z + z);
    // the water: dark, still, the sky in it; small ripples
    const rip = canvas(256, 256, (c, w, h) => {
      const img = c.createImageData(w, h);
      const n = noise2(5);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const f = (x, y) => n(x / 18, y / 18) + 0.5 * n(x / 7 + 9, y / 7);
          const dx = f(i + 1, j) - f(i - 1, j);
          const dy = f(i, j + 1) - f(i, j - 1);
          const o = (j * w + i) * 4;
          img.data[o] = 128 + dx * 90;
          img.data[o + 1] = 128 + dy * 90;
          img.data[o + 2] = 255;
          img.data[o + 3] = 255;
        }
      c.putImageData(img, 0, 0);
    });
    const ripples = new THREE.CanvasTexture(rip);
    sharpen(ripples);
    ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping;
    ripples.repeat.set(3, 3);
    const wmat = new THREE.MeshStandardMaterial({ color: '#0b2226', roughness: 0.06, metalness: 0.0, normalMap: ripples, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.6 });
    const inner = P - (steps - 1) * 0.42 - 0.21;
    water = new THREE.Mesh(new THREE.PlaneGeometry(inner * 2 + 0.01, inner * 2 + 0.01), wmat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(POOL.x, -0.32, POOL.z);
    water.receiveShadow = true;
    scene.add(water);
    // diyas: clay lamps afloat, each a flame
    const clay = new THREE.MeshStandardMaterial({ color: '#9a4a24', roughness: 0.85 });
    const r = rand(3);
    const flameTex = new THREE.CanvasTexture(
      canvas(64, 64, (c) => {
        const g = c.createRadialGradient(32, 40, 2, 32, 36, 30);
        g.addColorStop(0, 'rgba(255,250,220,1)');
        g.addColorStop(0.25, 'rgba(255,190,90,0.9)');
        g.addColorStop(1, 'rgba(255,120,30,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 64);
      }),
    );
    for (let k = 0; k < 9; k++) {
      const a = r() * Math.PI * 2;
      const d = 0.4 + r() * (inner - 0.6);
      const g = new THREE.Group();
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.04, 14), clay);
      g.add(cup);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color('#ffb060').multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      flame.scale.set(0.09, 0.14, 1);
      flame.position.y = 0.07;
      g.add(flame);
      g.position.set(POOL.x + Math.cos(a) * d, water.position.y + 0.02, POOL.z + Math.sin(a) * d);
      scene.add(g);
      diyas.push({ g, flame, phase: r() * 10, drift: { a: r() * Math.PI * 2, s: 0.02 + r() * 0.03 } });
    }
    const glow = new THREE.PointLight('#ff9a48', 3.5, 9, 2);
    glow.position.set(POOL.x, water.position.y + 0.4, POOL.z);
    scene.add(glow);
    diyas.light = glow;
  }

  // the rug, a dhurrie woven in red and indigo
  {
    const pattern = canvas(512, 360, (c, w, h) => {
      c.fillStyle = '#7c1b1b';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f2a55';
      c.fillRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#8f2420';
      c.fillRect(30, 30, w - 60, h - 60);
      // a border of small diamonds
      c.fillStyle = '#e6b25a';
      for (let x = 22; x < w - 14; x += 18) {
        for (const y of [22, h - 22]) {
          c.beginPath();
          c.moveTo(x, y - 5);
          c.lineTo(x + 5, y);
          c.lineTo(x, y + 5);
          c.lineTo(x - 5, y);
          c.fill();
        }
      }
      // the field: stepped lozenges
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 5; i++) {
          const cx = 70 + i * 93;
          const cy = 80 + j * 100;
          c.fillStyle = (i + j) % 2 ? '#22305f' : '#d39a46';
          for (let s = 3; s >= 1; s--) {
            c.beginPath();
            c.moveTo(cx, cy - s * 13);
            c.lineTo(cx + s * 13, cy);
            c.lineTo(cx, cy + s * 13);
            c.lineTo(cx - s * 13, cy);
            c.fill();
            c.fillStyle = s % 2 ? '#8f2420' : '#f0d7a0';
          }
        }
      // a weave
      c.globalAlpha = 0.08;
      c.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    });
    const t = new THREE.CanvasTexture(pattern);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.w, RUG.d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.96 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(RUG.x, 0.006, RUG.z);
    rug.receiveShadow = true;
    scene.add(rug);
  }

  // the lamps' light (the brass stands come with the models)
  const flames = [];
  {
    const flameTex = new THREE.CanvasTexture(
      canvas(64, 64, (c) => {
        const g = c.createRadialGradient(32, 40, 2, 32, 36, 30);
        g.addColorStop(0, 'rgba(255,252,230,1)');
        g.addColorStop(0.3, 'rgba(255,196,96,0.9)');
        g.addColorStop(1, 'rgba(255,120,30,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 64);
      }),
    );
    for (const l of LAMPS) {
      const light = new THREE.PointLight('#ffb35a', 6, 12, 2);
      light.position.set(l.x, 1.3, l.z);
      scene.add(light);
      const ring = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color('#ffc070').multiplyScalar(3.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        s.scale.set(0.06, 0.1, 1);
        s.position.set(l.x + Math.cos(a) * 0.12, 1.16, l.z + Math.sin(a) * 0.12);
        scene.add(s);
        ring.push(s);
      }
      flames.push({ light, ring, phase: l.x });
    }
  }

  // ── the models ──
  const glows = new Map(); // instrument -> { mats, level }
  const base = small ? '/models/music/sm/' : '/models/music/';
  const toLoad = ['pavilion', 'gaddi', 'lamp', 'sitar', 'tanpura', 'harmonium', 'tabla'];
  const models = loaders().then(({ gltfLoader }) => {
    const loader = gltfLoader();
    return Promise.all(toLoad.map((n) => loader.loadAsync(`${base}${n}.glb`).then((g) => [n, g.scene]).catch(() => [n, null])));
  });
  const placeModel = (name, model) => {
    if (!model) return;
    const instrument = INSTRUMENTS[name];
    const lacquer = name === 'sitar' || name === 'tanpura';
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const m = o.material;
      if (m.map) m.map.anisotropy = aniso;
      // painted for a studio: here lacquer, wood, stone, cloth and brass at dusk
      m.metalness = name === 'lamp' ? 0.85 : 0;
      m.roughness = name === 'lamp' ? 0.32 : lacquer ? 0.42 : name === 'pavilion' ? 0.9 : 0.65;
      m.metalnessMap = null;
      if (name === 'lamp') m.color = new THREE.Color('#e6b860');
      // the chhatri in pink sandstone, the mattress's white not glaring under the lamps
      if (name === 'pavilion') m.color = new THREE.Color('#f2b49a');
      if (name === 'gaddi') m.color = new THREE.Color('#c9c0b6');
      if (instrument) {
        // its glow, when it sounds: its own colours, lit from within
        m.emissive = new THREE.Color('#ffcf8a');
        m.emissiveMap = m.map;
        m.emissiveIntensity = 0;
        mats.push(m);
      }
    });
    if (instrument) {
      model.position.set(instrument.x, instrument.y, instrument.z);
      model.rotation.y = instrument.turn;
      if (instrument.lean) model.rotation.z = instrument.lean;
      scene.add(model);
      glows.set(name, { mats, level: 0 });
      return;
    }
    if (name === 'pavilion') {
      model.position.set(PAVILION.x, 0, PAVILION.z);
      model.rotation.y = PAVILION.turn;
      scene.add(model);
      // little chhatris on the parapet's corners, and greater ones out on the dunes
      const H = TERRACE.half - PARAPET.inset;
      for (const [x, z] of [[-H, -H], [H, -H], [-H, H], [H, H]]) {
        const c = model.clone();
        c.scale.setScalar(0.2);
        c.position.set(x, PARAPET.height + 0.12, z);
        scene.add(c);
      }
      for (const [x, z, s, ry] of [[-120, -260, 1.6, 0.4], [210, -330, 2.2, -0.3], [-300, 40, 1.8, 1.1], [280, 120, 1.4, 0.7], [-60, 340, 2, -0.6]]) {
        const c = model.clone();
        c.scale.setScalar(s);
        c.position.set(x, groundAt(x, z) - 0.6, z);
        c.rotation.y = ry;
        c.traverse((o) => {
          o.castShadow = false;
        });
        scene.add(c);
      }
      return;
    }
    if (name === 'gaddi') {
      model.position.set(GADDI.x, 0.005, GADDI.z);
      model.rotation.y = GADDI.turn;
      scene.add(model);
      return;
    }
    if (name === 'lamp')
      for (const l of LAMPS) {
        const c = model.clone();
        c.position.set(l.x, 0, l.z);
        scene.add(c);
      }
  };
  // the courtyard's floor light, baked once everything stands in it (after
  // Bruno Simon's folio: lib/three/groundwork): the chhatri's, the
  // parapet's, the lamps' and the instruments' soft dusk shadows on the
  // paving and the sand, their feet darkened, a warm bounce off the
  // sandstone, and no shadow pass
  let ground = null;
  const loaded = models.then(async (list) => {
    if (stage.disposed) return [];
    for (const [n, m] of list) placeModel(n, m);
    ground = groundWorld({
      renderer,
      scene,
      floor: floors,
      area: { x0: -TERRACE.half - 14, z0: -TERRACE.half - 14, w: (TERRACE.half + 14) * 2, d: (TERRACE.half + 14) * 2 },
      sun,
      skip: [rings, ghosts.group],
      shade: 0x4a2418,
      height: groundAt,
      tier,
    });
    house.follow({ adopt: true });
    await stage.precompile();
    if (!stage.disposed) ground.bake();
    return list.filter(([, m]) => m).map(([n]) => n);
  });

  // ── what floats up from an instrument: the notes it plays ──
  const labelCache = new Map();
  const labelTex = (text) => {
    if (!labelCache.has(text)) {
      const c = canvas(256, 128, (x, w, h) => {
        x.font = '600 76px "Yatra One", "Cinzel", Georgia, serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.shadowColor = 'rgba(255,170,80,0.9)';
        x.shadowBlur = 18;
        x.fillStyle = '#fff6e0';
        x.fillText(text, w / 2, h / 2 + 4);
      });
      const t = new THREE.CanvasTexture(c);
      sharpen(t);
      t.colorSpace = THREE.SRGBColorSpace;
      labelCache.set(text, t);
    }
    return labelCache.get(text);
  };
  const floats = [];
  const spawn = (id, text) => {
    const i = INSTRUMENTS[id];
    if (!i || floats.length > 40) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text), transparent: true, depthWrite: false, opacity: 0, color: new THREE.Color('#ffe0b0').multiplyScalar(1.6) }));
    const top = id === 'tanpura' ? 1.5 : id === 'sitar' ? 0.65 : 0.6;
    s.position.set(i.x + (Math.random() - 0.5) * 0.5, top, i.z + (Math.random() - 0.5) * 0.2);
    s.scale.set(0.42, 0.21, 1);
    scene.add(s);
    floats.push({ s, age: 0, life: 2.4, rise: 0.75 + Math.random() * 0.35 });
  };

  // ── drawing ──
  const fitTo = (w, h) => stage.resize(w, h);
  let clock = 0;
  // others online in the courtyard (MusicWorld's useTravellers). You don't
  // see yourself here, so they aren't figures either: each is a lamp, a diya
  // floating at a listener's height where they stand, pale and shimmering as
  // the other worlds' visitors are, with their name over it
  const ghosts = createGhosts({
    make: () => {
      const bowl = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.11, 0.02), new THREE.Vector2(0.15, 0.07), new THREE.Vector2(0.13, 0.08), new THREE.Vector2(0.09, 0.04), new THREE.Vector2(0, 0.04)], 16), new THREE.MeshStandardMaterial());
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 10).translate(0, 0.16, 0), new THREE.MeshStandardMaterial());
      const lamp = new THREE.Group();
      lamp.add(bowl, flame);
      lamp.scale.setScalar(1.3);
      lamp.position.y = 1.25;
      const group = new THREE.Group();
      group.add(lamp);
      return { group, top: 1.5, lamp, flame };
    },
    animate: (f, t) => {
      f.lamp.position.y = 1.25 + Math.sin(t * 1.6) * 0.06;
      f.flame.scale.set(1, 0.85 + 0.15 * Math.sin(t * 9), 1);
    },
    tag: 0.22,
    halo: 0.6,
  });
  scene.add(ghosts.group);

  const render = (state, ms = 16) => {
    const dt = Math.min(0.1, ms / 1000);
    clock += dt;
    ghosts.update(state.travellers ?? [], clock, dt);
    camera.position.set(state.x, EYE + (state.bob || 0), state.z);
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
    sky.position.copy(camera.position);
    // the water moves a little, the flames flicker, the diyas drift
    if (water) {
      water.material.normalMap.offset.set(clock * 0.012, clock * 0.008);
    }
    for (const d of diyas) {
      const f = 0.85 + 0.15 * Math.sin(clock * 9 + d.phase) * Math.sin(clock * 5.3 + d.phase * 2);
      d.flame.scale.set(0.09 * f, 0.14 * f, 1);
      d.g.position.x += Math.cos(d.drift.a + clock * 0.05) * d.drift.s * dt;
      d.g.position.z += Math.sin(d.drift.a + clock * 0.05) * d.drift.s * dt;
      d.g.position.y = water.position.y + 0.02 + Math.sin(clock * 1.3 + d.phase) * 0.006;
    }
    if (diyas.light) diyas.light.intensity = 3.2 + 0.5 * Math.sin(clock * 7.1) * Math.sin(clock * 3.3);
    for (const f of flames) {
      const k = 0.88 + 0.12 * Math.sin(clock * 11 + f.phase) * Math.sin(clock * 4.7 + f.phase);
      f.light.intensity = 6 * k;
      for (const s of f.ring) s.scale.set(0.06 * k, 0.1 * k, 1);
    }
    // glows fade, notes rise and fade
    for (const g of glows.values()) {
      if (g.level <= 0.001) continue;
      g.level *= Math.exp(-dt * 3.2);
      for (const m of g.mats) m.emissiveIntensity = g.level;
    }
    for (let k = floats.length - 1; k >= 0; k--) {
      const f = floats[k];
      f.age += dt;
      const u = f.age / f.life;
      f.s.position.y += (f.rise / f.life) * dt;
      f.s.material.opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85);
      if (u >= 1) {
        scene.remove(f.s);
        f.s.material.dispose();
        floats.splice(k, 1);
      }
    }
    ringMat.uniforms.uTime.value = clock;
    stage.render(ms);
  };

  // build the shaders of what's there now, before the first frame
  house.follow({ adopt: true });
  await stage.precompile();

  return {
    // (for the QA scripts: the floor light, once the models are in)
    get ground() {
      return import.meta.env.DEV ? ground : null;
    },
    render,
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    resize: fitTo,
    // behind ?debug: the stage's bloom and what the page adds (the walk's numbers)
    tune: (groups = []) => stage.tune(groups),
    dispose: () => {
      ground?.dispose();
      ghosts.dispose();
      for (const t of labelCache.values()) t.dispose();
      stage.dispose();
    },
    get lost() {
      return stage.lost;
    },
    get quality() {
      return stage.quality;
    },
    // an instrument sounds: it glows, and `text` (a swara, a bol) floats up from it
    sound(id, text, strength = 0.55) {
      const g = glows.get(id);
      if (g) g.level = Math.min(1.2, g.level + strength);
      if (text) spawn(id, text);
    },
    loaded,
  };
}
