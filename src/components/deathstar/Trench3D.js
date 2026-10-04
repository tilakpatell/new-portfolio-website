// The trench run in WebGL, for devices with a graphics chip. It draws the
// same simulation (./trench.js) that the 2D canvas does; the 2D canvas stays
// on top for the HUD. Loaded only when 3D is on, so nobody else downloads it.
//
// The world: the simulation's x across and y up, and its z (distance along
// the run) running down -Z here. The camera rides just behind and above the
// X-wing. Textures are painted once on a canvas at start; the trench's detail
// is a few instanced meshes; lasers, bolts and engines glow through bloom.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TRENCH, portZ } from './trench';
import { paintGasGiant, paintPlating, starSprite } from './plating';

const LENGTH = 340; // how much station to build, in units
const SHIP_AHEAD = 0.55; // the X-wing sits this far ahead of the simulation's z
const CAM_BACK = 1.45;

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(canvas, repeatX, repeatY, renderer, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bright colours for things that glow: above 1, so bloom picks them up.
const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

function buildXwing() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.25, roughness: 0.55 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.4, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.52), hull);
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 4), hull);
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.z = -0.37;
  g.add(nose);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.1), dark);
  canopy.position.set(0, 0.045, -0.05);
  g.add(canopy);
  const droid = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3a6ad8, roughness: 0.4 }));
  droid.position.set(0, 0.045, 0.08);
  g.add(droid);
  const glowMat = new THREE.MeshBasicMaterial({ color: hot(0xff8a5a, 1.8), toneMapped: false });
  const tipMat = new THREE.MeshBasicMaterial({ color: hot(0xff4030, 0.4), toneMapped: false });
  const tips = [];
  for (const a of [0.42, Math.PI - 0.42, Math.PI + 0.42, -0.42]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.012, 0.15), hull);
    wing.position.set(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.08);
    wing.rotation.z = a;
    g.add(wing);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.14), red);
    stripe.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.08);
    stripe.rotation.z = a;
    g.add(stripe);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.2, 10), grey);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.06);
    g.add(engine);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.021, 12), glowMat);
    glow.position.set(Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.161);
    g.add(glow);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 6), grey);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35, -0.04);
    g.add(cannon);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), tipMat);
    tip.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35, -0.21);
    g.add(tip);
    tips.push(tip);
  }
  return { group: g, tipMat, glowMat };
}

function buildTie(mats) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(mats.ballGeo, mats.ball);
  g.add(ball);
  const win = new THREE.Mesh(mats.windowGeo, mats.window);
  win.position.z = 0.1;
  g.add(win);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(mats.strutGeo, mats.ball);
    strut.rotation.z = Math.PI / 2;
    strut.position.x = side * 0.11;
    g.add(strut);
    const wing = new THREE.Mesh(mats.wingGeo, mats.wing);
    wing.rotation.z = Math.PI / 2;
    wing.rotation.y = Math.PI / 2;
    wing.position.x = side * 0.22;
    g.add(wing);
    const frame = new THREE.Mesh(mats.frameGeo, mats.frame);
    frame.rotation.z = Math.PI / 2;
    frame.rotation.y = Math.PI / 2;
    frame.position.x = side * 0.222;
    g.add(frame);
  }
  return g;
}

export function createTrench3D(canvas, { onLost, onSlow } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const maxRatio = Math.min(1.75, window.devicePixelRatio || 1);
  let ratio = maxRatio;
  renderer.setPixelRatio(ratio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04050a);
  scene.fog = new THREE.FogExp2(0x05060c, 0.038);
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 420);

  scene.add(new THREE.AmbientLight(0x6a7488, 0.55));
  scene.add(new THREE.HemisphereLight(0x8a9ac0, 0x0a0a12, 0.45));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.7);
  sun.position.set(-4, 7, 3);
  scene.add(sun);
  scene.add(sun.target);
  const blast = new THREE.PointLight(0xffa860, 0, 6, 2);
  scene.add(blast);

  // ── the station ──
  // painted plating with real relief (normal and roughness maps), sized to the device
  const big = renderer.capabilities.maxTextureSize >= 4096 && !(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const tex = big ? 1024 : 512;
  const surf = paintPlating({ seed: 7, size: tex, kind: 'surface' });
  const side = paintPlating({ seed: 19, size: tex, kind: 'wall' });
  const plating = (p, rx, ry, extra = {}) =>
    new THREE.MeshStandardMaterial({
      map: texture(p.color, rx, ry, renderer),
      normalMap: texture(p.normal, rx, ry, renderer, false),
      roughnessMap: texture(p.rough, rx, ry, renderer, false),
      emissiveMap: texture(p.lit, rx, ry, renderer),
      emissive: new THREE.Color(1.5, 1.25, 0.95),
      metalness: 0.32,
      roughness: 1,
      normalScale: new THREE.Vector2(1.1, 1.1),
      ...extra,
    });
  const surfaceMat = plating(surf, 15, LENGTH / 2);
  const wallMat = plating(side, LENGTH / 2, 1);
  const floorMat = plating(surf, 1, LENGTH / 2, { color: 0x9aa0a8, emissive: new THREE.Color(0.4, 0.34, 0.26) });
  const add = (mesh) => {
    scene.add(mesh);
    return mesh;
  };
  for (const sd of [-1, 1]) {
    const s = add(new THREE.Mesh(new THREE.PlaneGeometry(30, LENGTH), surfaceMat));
    s.rotation.x = -Math.PI / 2;
    s.position.set(sd * 16, 1, -LENGTH / 2 + 12);
    const w = add(new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, 2), wallMat));
    w.rotation.y = sd < 0 ? Math.PI / 2 : -Math.PI / 2;
    w.position.set(sd, 0, -LENGTH / 2 + 12);
  }
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(2, LENGTH), floorMat));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1, -LENGTH / 2 + 12);

  // pipe runs down both walls, with collars every few metres
  {
    const pipeGeo = new THREE.CylinderGeometry(0.035, 0.035, 6, 10, 1, true);
    const collarGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.08, 10);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8c939c, metalness: 0.7, roughness: 0.35 });
    const runs = [];
    for (const sd of [-1, 1]) for (const y of [0.55, -0.35, -0.72]) runs.push([sd, y]);
    const per = Math.ceil(LENGTH / 6);
    const pipes = new THREE.InstancedMesh(pipeGeo, pipeMat, runs.length * per);
    const collars = new THREE.InstancedMesh(collarGeo, pipeMat, runs.length * per);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    let n = 0;
    for (const [sd, y] of runs) {
      for (let i = 0; i < per; i++) {
        const z = 12 - i * 6 - 3;
        m.compose(new THREE.Vector3(sd * 0.955, y, z), q, new THREE.Vector3(1, 1, 1));
        pipes.setMatrixAt(n, m);
        m.compose(new THREE.Vector3(sd * 0.955, y, z - 3), q, new THREE.Vector3(1, 1, 1));
        collars.setMatrixAt(n, m);
        n += 1;
      }
    }
    pipes.instanceMatrix.needsUpdate = true;
    collars.instanceMatrix.needsUpdate = true;
    add(pipes);
    add(collars);
  }

  // guide lights along the foot of each wall: they streak past at speed
  {
    const lampGeo = new THREE.BoxGeometry(0.05, 0.02, 0.22);
    const lampMat = new THREE.MeshBasicMaterial({ color: hot(0xffc27a, 2.2), toneMapped: false });
    const per = Math.ceil(LENGTH / 2.5);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, per * 2);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const sd of [-1, 1]) {
      for (let i = 0; i < per; i++) {
        m.makeTranslation(sd * 0.96, -0.97, 12 - i * 2.5);
        lamps.setMatrixAt(n++, m);
      }
    }
    lamps.instanceMatrix.needsUpdate = true;
    add(lamps);
  }

  // greebles: blocks on the trench walls and on the surface either side
  {
    const rand = rng(31);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.62, normalMap: texture(surf.normal, 0.5, 0.5, renderer, false) });
    const wallCount = 900;
    const surfCount = 700;
    const inst = new THREE.InstancedMesh(box, mat, wallCount + surfCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    let i = 0;
    for (; i < wallCount; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const d = 0.04 + rand() * 0.14;
      const h = 0.06 + rand() * 0.4;
      const len = 0.2 + rand() * 1.1;
      m.compose(new THREE.Vector3(side * (1 - d / 2), -0.92 + rand() * 1.84, -rand() * LENGTH + 10), q, new THREE.Vector3(d, h, len));
      inst.setMatrixAt(i, m);
      const v = 0.3 + rand() * 0.28;
      inst.setColorAt(i, c.setRGB(v, v * 1.02, v * 1.08));
    }
    for (; i < wallCount + surfCount; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const h = 0.03 + rand() * rand() * 0.45;
      const w = 0.15 + rand() * rand() * 1.1;
      m.compose(new THREE.Vector3(side * (1.25 + rand() * 9), 1 + h / 2, -rand() * LENGTH + 10), q, new THREE.Vector3(w, h, 0.15 + rand() * rand() * 1.2));
      inst.setMatrixAt(i, m);
      const v = 0.22 + rand() * 0.22;
      inst.setColorAt(i, c.setRGB(v, v * 1.02, v * 1.07));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    add(inst);
  }

  // the stars, far off, moving with the camera
  const stars = (() => {
    const rand = rng(5);
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * r * 300, Math.abs(u) * 300, Math.sin(th) * r * 300], i * 3); // beyond Yavin
      const k = 0.6 + rand() * 0.8;
      const tint = rand();
      col.set(tint < 0.15 ? [k, k * 0.85, k * 0.7] : tint < 0.3 ? [k * 0.8, k * 0.9, k] : [k, k, k], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sprite = new THREE.CanvasTexture(starSprite());
    sprite.colorSpace = THREE.SRGBColorSpace;
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, map: sprite, transparent: true, alphaTest: 0.02 }));
    scene.add(pts);
    return pts;
  })();

  // Yavin, the gas giant, and its fourth moon, low in the sky
  const sky = new THREE.Group();
  {
    const giantTex = new THREE.CanvasTexture(paintGasGiant({ w: big ? 1024 : 512, h: big ? 512 : 256 }));
    giantTex.colorSpace = THREE.SRGBColorSpace;
    const giant = new THREE.Mesh(new THREE.SphereGeometry(26, 48, 32), new THREE.MeshLambertMaterial({ map: giantTex, fog: false }));
    giant.rotation.z = 0.3;
    giant.position.set(46, 30, -120);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshLambertMaterial({ color: 0x6f8f62, fog: false }));
    moon.position.set(14, 22, -96);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(27.5, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.08, side: THREE.BackSide, fog: false, depthWrite: false }));
    glow.position.copy(giant.position);
    sky.add(giant, moon, glow);
    scene.add(sky);
  }

  // the exhaust port, two metres across, at the end of the trench
  const port = new THREE.Group();
  {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: 0x020203 }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.35 }));
    port.add(hole, rim);
    port.rotation.x = -Math.PI / 2;
    port.position.set(0, -0.985, -portZ());
    scene.add(port);
  }
  const portGlowMat = new THREE.MeshBasicMaterial({ color: hot(0xffb347, 2), toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const portGlow = new THREE.Group();
  for (const [a, b] of [[0.42, 0.46], [0.6, 0.63]]) portGlow.add(new THREE.Mesh(new THREE.RingGeometry(a, b, 40), portGlowMat));
  portGlow.rotation.x = -Math.PI / 2;
  portGlow.position.set(0, -0.98, -portZ());
  scene.add(portGlow);

  // ── the ships ──
  const xw = buildXwing();
  scene.add(xw.group);
  const tieMats = {
    ball: new THREE.MeshStandardMaterial({ color: 0xb4bcc6, metalness: 0.45, roughness: 0.4 }),
    wing: new THREE.MeshStandardMaterial({ color: 0x4a515b, metalness: 0.35, roughness: 0.5, emissive: new THREE.Color(0.03, 0.035, 0.05) }),
    frame: new THREE.MeshStandardMaterial({ color: 0xc8d0da, metalness: 0.6, roughness: 0.35, wireframe: true }),
    window: new THREE.MeshBasicMaterial({ color: 0x0b0e12 }),
    ballGeo: new THREE.SphereGeometry(0.1, 16, 12),
    windowGeo: new THREE.CircleGeometry(0.05, 16),
    strutGeo: new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8),
    wingGeo: new THREE.CylinderGeometry(0.27, 0.27, 0.014, 6),
    frameGeo: new THREE.CylinderGeometry(0.27, 0.27, 0.018, 6, 1, true),
  };
  const ties = Array.from({ length: 12 }, () => {
    const t = buildTie(tieMats);
    t.scale.setScalar(1.25);
    t.visible = false;
    scene.add(t);
    return t;
  });

  // ── what flies: lasers, bolts, torpedoes, explosions ──
  const laserGeo = new THREE.BoxGeometry(0.014, 0.014, 1.1);
  const laserMat = new THREE.MeshBasicMaterial({ color: hot(0xff3a26, 4), toneMapped: false });
  const boltGeo = new THREE.BoxGeometry(0.02, 0.02, 1.3);
  const boltMat = new THREE.MeshBasicMaterial({ color: hot(0x7dff5a, 3.4), toneMapped: false });
  const pool = (n, geo, mat) =>
    Array.from({ length: n }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      return m;
    });
  const lasers = pool(32, laserGeo, laserMat);
  const bolts = pool(48, boltGeo, boltMat);
  const torpMat = new THREE.MeshBasicMaterial({ color: hot(0xb8dcff, 5), toneMapped: false });
  const torps = pool(4, new THREE.SphereGeometry(0.05, 12, 10), torpMat);
  // the station going up: a soft fireball, and a shockwave across the floor
  const fireTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)');
    gr.addColorStop(0.25, 'rgba(255,214,140,0.95)');
    gr.addColorStop(0.55, 'rgba(255,120,40,0.55)');
    gr.addColorStop(1, 'rgba(255,60,10,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const boom = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: hot(0xffe0b0, 2.4), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  boom.visible = false;
  scene.add(boom);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96), new THREE.MeshBasicMaterial({ color: hot(0xbfe2ff, 2.2), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  shock.rotation.x = -Math.PI / 2;
  shock.visible = false;
  scene.add(shock);
  const sparks = (() => {
    const n = 140;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  })();

  // ── the course: obstacles, towers and turrets for this run ──
  const course = new THREE.Group();
  scene.add(course);
  const shared = {
    catwalk: new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.45, roughness: 0.5 }),
    band: new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.4, roughness: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x8e949c, metalness: 0.35, roughness: 0.6 }),
    tower: new THREE.MeshStandardMaterial({ color: 0x7c828a, metalness: 0.35, roughness: 0.6 }),
    gun: new THREE.MeshBasicMaterial({ color: hot(0xff6a4a, 2.4), toneMapped: false }),
    turret: new THREE.MeshStandardMaterial({ color: 0x5c626c, metalness: 0.5, roughness: 0.5 }),
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const gunGeo = new THREE.SphereGeometry(0.035, 8, 6);
  let built = null;
  const itemMeshes = [];
  const towerMeshes = [];
  const clearCourse = () => {
    course.clear();
    itemMeshes.length = 0;
    towerMeshes.length = 0;
  };
  const buildCourse = (g) => {
    clearCourse();
    built = g;
    for (const it of g.items) {
      let m = null;
      if (it.kind === 'catwalk') {
        m = new THREE.Group();
        const deck = new THREE.Mesh(boxGeo, shared.catwalk);
        deck.scale.set(2, 0.2, 0.26);
        const band = new THREE.Mesh(boxGeo, shared.band);
        band.scale.set(2.01, 0.06, 0.27);
        band.position.y = -0.07;
        const rail = new THREE.Mesh(boxGeo, shared.band);
        rail.scale.set(2, 0.03, 0.03);
        rail.position.set(0, 0.16, -0.1);
        m.add(deck, band, rail);
        m.position.set(0, it.y, -it.z);
      } else if (it.kind === 'wall') {
        m = new THREE.Mesh(boxGeo, shared.wall);
        m.scale.set(1.05, 2, 0.3);
        m.position.set(it.side < 0 ? -0.475 : 0.475, 0, -it.z);
      } else if (it.kind === 'turret') {
        m = new THREE.Group();
        const body = new THREE.Mesh(boxGeo, shared.turret);
        body.scale.set(0.16, 0.22, 0.24);
        const barrel = new THREE.Mesh(boxGeo, shared.turret);
        barrel.scale.set(0.16, 0.03, 0.03);
        barrel.position.x = -it.side * 0.12;
        const gun = new THREE.Mesh(gunGeo, shared.gun);
        gun.position.x = -it.side * 0.2;
        m.add(body, barrel, gun);
        m.position.set(it.side * 0.92, it.y, -it.z);
      } else if (it.kind === 'bolt') {
        m = new THREE.Mesh(boltGeo, boltMat);
      }
      if (m) course.add(m);
      itemMeshes.push(m);
    }
    for (const tw of g.towers) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(boxGeo, shared.tower);
      body.scale.set(0.32, tw.h, 0.32);
      body.position.y = tw.h / 2;
      const cap = new THREE.Mesh(boxGeo, shared.band);
      cap.scale.set(0.4, 0.06, 0.4);
      cap.position.y = tw.h;
      const gun = new THREE.Mesh(gunGeo, shared.gun);
      gun.position.y = tw.h + 0.07;
      m.add(body, cap, gun);
      m.position.set(tw.x, 1, -tw.z);
      course.add(m);
      towerMeshes.push(m);
    }
  };

  // ── post: bloom for everything that glows ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.38, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useBloom = true;

  let size = { w: 1, h: 1 };
  const resize = (w, h) => {
    size = { w: Math.max(1, w), h: Math.max(1, h) };
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.w, size.h);
    bloom.resolution.set(size.w / 2, size.h / 2);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // the GPU can go away (a driver reset, too many tabs): tell the page
  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // slow frames: drop the pixel ratio, then bloom, then tell the page
  const perf = { acc: 0, n: 0, step: 0 };
  const watch = (ms) => {
    perf.acc += ms;
    perf.n += 1;
    if (perf.n < 120) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg < 24) return;
    perf.step += 1;
    if (perf.step === 1 && ratio > 1) {
      ratio = 1;
      resize(size.w, size.h);
    } else if (perf.step <= 2) useBloom = false;
    else if (avg > 34) onSlow?.();
  };

  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const shakeV = new THREE.Vector3();

  function render(g, ms = 16, { calm = false } = {}) {
    if (lost) return;
    if (g.items && g !== built && g.towers) buildCourse(g);
    const t = g.t ?? 0;
    const z = g.z;
    // camera, just behind and above the X-wing, easing with it
    const bank = (g.tx - g.px) * 1.5;
    shakeV.set(0, 0, 0);
    if (!calm) {
      const k = (g.shake ?? 0) * 0.12 + (g.win?.boom ? Math.max(0, 0.9 - (g.win.t - 0.6)) * 0.08 : 0);
      if (k) shakeV.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, 0);
    }
    camera.position.set(g.px * 0.9 + shakeV.x, g.py * 0.92 + 0.42 + shakeV.y, -z + CAM_BACK);
    camera.lookAt(g.px * 0.7, g.py * 0.86 + 0.28, -z - 9);
    camera.rotateZ(-bank * 0.12);
    stars.position.copy(camera.position);
    sky.position.set(camera.position.x * 0.2, 0, camera.position.z);
    sun.position.set(camera.position.x - 4, 7, camera.position.z + 3);
    sun.target.position.set(camera.position.x, 0, camera.position.z - 6);

    // the X-wing
    const ship = xw.group;
    ship.visible = g.status !== 'won';
    ship.position.set(g.px, g.py - 0.06, -(z + SHIP_AHEAD));
    ship.rotation.set((g.ty - g.py) * 0.5, -(g.tx - g.px) * 0.25, -bank);
    const firing = (g.laserCool ?? 0) > TRENCH.laser.cooldown - 0.05;
    xw.tipMat.color.copy(firing ? hot(0xff4030, 5) : hot(0xff4030, 0.4));
    xw.glowMat.color.setRGB(1.9 + Math.sin(t * 30) * 0.25, 0.85, 0.55);

    // TIE fighters
    let ti = 0;
    for (const tie of g.ties ?? []) {
      if (!tie.alive || ti >= ties.length) continue;
      const m = ties[ti++];
      m.visible = true;
      m.position.set(tie.x, tie.y, -tie.z);
      m.rotation.set(0, Math.PI, Math.cos(tie.phase ?? 0) * 0.35);
    }
    for (; ti < ties.length; ti++) ties[ti].visible = false;

    // the course
    if (built === g) {
      g.items.forEach((it, i) => {
        const m = itemMeshes[i];
        if (!m) return;
        if (it.kind === 'bolt') m.position.set(it.x, it.y, -it.z);
        if (it.kind === 'turret') m.visible = it.alive;
      });
      g.towers.forEach((tw, i) => {
        towerMeshes[i].visible = tw.alive;
      });
    }

    // lasers and bolts
    let li = 0;
    for (const l of g.lasers ?? []) {
      if (li >= lasers.length) break;
      const m = lasers[li++];
      m.visible = true;
      m.position.set(l.x, l.y, -(l.z + 0.55));
    }
    for (; li < lasers.length; li++) lasers[li].visible = false;
    let bi = 0;
    for (const b of g.bolts ?? []) {
      if (bi >= bolts.length) break;
      const m = bolts[bi++];
      m.visible = true;
      m.position.set(b.x, b.y, -b.z);
      dir.set(b.vx, b.vy, -b.vz).normalize();
      m.quaternion.setFromUnitVectors(zAxis, dir);
    }
    for (const r of g.rear ?? []) {
      if (bi >= bolts.length) break;
      const m = bolts[bi++];
      m.visible = true;
      m.position.set(r.x, r.y, -(r.z + 0.8));
      m.quaternion.identity();
    }
    for (; bi < bolts.length; bi++) bolts[bi].visible = false;

    // explosions: the simulation's sparks, and a flash of light at the newest
    const pos = sparks.geometry.attributes.position;
    const col = sparks.geometry.attributes.color;
    let si = 0;
    let newest = null;
    for (const f of g.fx ?? []) {
      if (si >= pos.count) break;
      const k = f.t / f.life;
      pos.setXYZ(si, f.x, f.y, -f.z);
      col.setXYZ(si, 3 * (1 - k * 0.3), 1.6 * (1 - k), 0.5 * (1 - k));
      si += 1;
      if (!newest || f.t < newest.t) newest = f;
    }
    for (let i = si; i < pos.count; i++) pos.setXYZ(i, 0, -1000, 0);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    if (newest) {
      blast.position.set(newest.x, newest.y, -newest.z);
      blast.intensity = 6 * Math.max(0, 1 - newest.t / 0.35);
    } else blast.intensity = 0;

    // missed torpedoes streak on ahead
    let pi = 0;
    for (const s of g.shots ?? []) {
      if (pi >= 2) break;
      const m = torps[pi++];
      m.visible = true;
      m.position.set(s.x, s.y - 0.1, -s.z);
    }
    // the two that go in, curving down into the port
    const winning = g.status === 'winning' && g.win;
    for (let i = 2; i < 4; i++) torps[i].visible = false;
    if (winning && !g.win.boom) {
      const p = Math.min(1, g.win.t / 0.6);
      const e = p * p;
      [-1, 1].forEach((side, i) => {
        const m = torps[2 + i];
        m.visible = true;
        const sx = g.px + side * 0.12;
        m.position.set(sx + (0 - sx) * e, g.py + (-0.95 - g.py) * e + Math.sin(p * Math.PI) * 0.25, -(z + SHIP_AHEAD) + (-portZ() + z + SHIP_AHEAD) * e);
      });
    }
    for (let i = pi; i < 2; i++) torps[i].visible = false;
    // the port: amber as you close in, pulsing in range, green when lined up
    const toPort = portZ() - z;
    const [lo, hi] = TRENCH.window;
    const inWindow = toPort > lo && toPort < hi;
    const lined = Math.abs(g.px) < TRENCH.lined.x && g.py < TRENCH.lined.y;
    portGlow.visible = (g.status === 'running' || g.status === 'winning') && toPort < 30;
    portGlowMat.color.copy(inWindow && lined ? hot(0x78ffa0, 2.6) : hot(0xffb347, 2));
    portGlowMat.opacity = inWindow ? 0.55 + 0.45 * Math.sin(t * 10) : 0.5;
    // the station goes up
    if (g.win?.boom) {
      const e = Math.max(0, g.win.t - 0.6);
      boom.visible = true;
      boom.position.set(0, -0.6, -portZ());
      boom.scale.setScalar(0.6 + Math.min(1, e / 1.1) * 26);
      boom.material.opacity = Math.max(0, 1 - e / 1.9);
      shock.visible = true;
      shock.position.set(0, -0.95, -portZ());
      shock.scale.setScalar(0.5 + e * 22);
      shock.material.opacity = Math.max(0, 1 - e / 1.5);
      blast.position.copy(boom.position);
      blast.distance = 40;
      blast.intensity = 30 * Math.max(0, 1 - e / 1.4);
    } else {
      boom.visible = false;
      shock.visible = false;
      blast.distance = 6;
    }

    if (useBloom) composer.render();
    else renderer.render(scene, camera);
    watch(ms);
  }

  renderer.compile(scene, camera);

  // where a point in the world is on screen, in CSS pixels
  const project = (x, y, z) => {
    tmp.set(x, y, -z).project(camera);
    return [((tmp.x + 1) / 2) * size.w, ((1 - tmp.y) / 2) * size.h];
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    clearCourse();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap']) m[k]?.dispose?.();
        m.dispose?.();
      }
    });
    composer.dispose?.();
    renderer.dispose();
  };

  return { render, resize, project, dispose, get lost() { return lost; } };
}
