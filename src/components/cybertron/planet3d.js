// Cybertron in WebGL, the way War for Cybertron, Fall of Cybertron and Prime
// show it from space: a world built over from pole to pole. Its maps are
// worked out offline (scripts/build-cybertron-planet.mjs: tiers of plating,
// stepped chasms, the city-states' discs of rings, the Sea of Rust, the
// war's craters and fires) and dressed by ./skin.js, which colours the
// energon by side, lights the cities on the night side and carries the
// plating on in the shader where the maps run out. And it's at war:
// fireballs burst out of the fronts and now and then one boils up off the
// edge (./war.js), a warm light flickering on the plating round the
// biggest. It hangs in a blue-green nebula, in a haze of its own air that
// thickens toward the edge. Metal wants something to reflect, so it has a
// sky of its own to shine with (a sun and the nebula's glow, made into an
// environment map); two moons and a ring of wreckage go round it, and a
// space bridge, whose portal opens now and then. Bloom carries the energon,
// the fires and the explosions, and only those.
//
// Drag to turn it. `side` (autobot or decepticon) is the energon's colour,
// and how much of the planet is burning; changing it cross-fades.
//
// A lib/three/useScene scene: create(canvas, ctx) → { resize, render, update, dispose }.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { LOOK } from './look';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { budget, device } from '../../lib/device';
import { noiseAtlas } from '../../lib/texture';
import { createRenderer, disposeTree, precompile, precompilePasses } from '../../lib/three/renderer';
import { loadTexture } from '../../lib/three/textures';
import { SIDES, cybertronSkin } from './skin';
import { createWar, warZones } from './war';

const MAPS = '/textures/universe/';
const SUN = new THREE.Vector3(-0.82, 0.34, 0.3).normalize();
const HAZE = new THREE.Color(0x5cc8f0); // the air's own colour, before the energon tints it

// the air at the limb: the back of a sphere a little bigger than the planet,
// brightest just outside the edge and on the sunlit side
const AIR_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const AIR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSun;
  uniform float uReach;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    float c = -dot(n, normalize(vV));
    float x = clamp((sqrt(max(1.0 - c * c, 0.0)) * uReach - 1.0) / (uReach - 1.0), 0.0, 1.0);
    // lit all the way round (the nebula behind it lights it too), most on the sunlit side
    float lit = 0.4 + 0.6 * smoothstep(-0.5, 0.45, dot(n, uSun));
    // warmer where the light grazes the terminator
    vec3 col = mix(uColor, vec3(1.0, 0.62, 0.35), smoothstep(0.35, 0.0, abs(dot(n, uSun))) * 0.25);
    gl_FragColor = vec4(col * (pow(1.0 - x, 2.6) * 1.0 + pow(1.0 - x, 9.0) * 0.55) * lit, 1.0);
  }`;

// and the same air seen against the planet: a haze over the plating that
// thickens toward the edge, where you look through more of it
const HAZE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSun;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    float edge = 1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0);
    float lit = 0.45 + 0.55 * smoothstep(-0.4, 0.5, dot(n, uSun));
    gl_FragColor = vec4(uColor * (pow(edge, 2.8) * 0.38 + pow(edge, 8.0) * 0.35 + 0.008) * lit, 1.0);
  }`;

// the far sky: a nebula, deep blue and blue-green, behind the planet. The
// camera never leaves its spot, so it's laid out flat on the sky ahead (the
// way it looks from there), the clouds' shapes pushed about by more noise,
// with brighter wisps through them, dark lanes between, and a glow behind
// the planet itself; round the back it's just the dark
const SKY_FRAG = /* glsl */ `
  uniform sampler2D uNoise;
  varying vec3 vDir;
  float soft(vec2 p) { return texture2D(uNoise, p).r; }
  void main() {
    vec3 d = normalize(vDir);
    vec2 p = d.xy / max(0.3, -d.z);
    vec2 w = vec2(soft(p * 1.7 + 0.13), soft(p * 1.7 + vec2(0.51, 0.27))) - 0.5;
    float big = soft(p * 0.9 + w * 0.5 + vec2(0.21, 0.6));
    float mid = soft(p * 2.6 + w * 0.8 + 0.31);
    float fine = soft(p * 7.0 + w * 1.4 + 0.77);
    float wisp = texture2D(uNoise, p * 2.1 + w * 1.1 + 0.6).g;
    float cloud = smoothstep(0.36, 0.72, big * 0.6 + mid * 0.3 + fine * 0.1);
    float lace = smoothstep(0.62, 0.95, wisp) * smoothstep(0.4, 0.62, mid);
    // blue-green, blue and indigo, drifting across it
    float hue = soft(p * 0.6 + vec2(0.71, 0.18)) + (mid - 0.5) * 0.4;
    vec3 tint = mix(vec3(0.02, 0.1, 0.12), vec3(0.022, 0.045, 0.15), smoothstep(0.38, 0.56, hue));
    tint = mix(tint, vec3(0.055, 0.028, 0.13), smoothstep(0.58, 0.74, hue));
    vec3 col = vec3(0.002, 0.004, 0.01);
    col += tint * cloud * 1.3;
    col += vec3(0.07, 0.17, 0.22) * lace * cloud;
    // the glow round the planet: the nebula's thickest just behind it
    col += vec3(0.012, 0.05, 0.075) * exp(-dot(p, p) * 14.0) * (0.6 + cloud);
    // dark lanes of dust through it
    col *= 0.3 + 0.7 * smoothstep(0.32, 0.55, fine * 0.35 + mid * 0.65);
    col = mix(vec3(0.002, 0.004, 0.01), col, smoothstep(0.15, 0.5, -d.z));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// the space bridge's portal: a swirl that opens, flares and closes
const PORTAL_FRAG = /* glsl */ `
  uniform float uOpen;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    float a = atan(q.y, q.x);
    float swirl = 0.5 + 0.5 * sin(a * 5.0 + r * 14.0 - uTime * 7.0);
    float disc = smoothstep(1.0, 0.75, r) * uOpen;
    float core = smoothstep(0.55, 0.0, r) * uOpen;
    vec3 col = uColor * (swirl * 1.6 + 0.6) * disc + vec3(1.0) * core * 2.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

// a little environment for the metal to shine with: the sky's dark and the
// nebula's glow, and the sun
function makeEnvironment(renderer) {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 col = mix(vec3(0.02, 0.035, 0.06), vec3(0.07, 0.12, 0.18), smoothstep(-0.4, 0.8, d.y));
          // the nebula, glowing blue-green behind, indigo overhead
          col += vec3(0.05, 0.16, 0.2) * smoothstep(0.0, -0.9, d.z);
          col += vec3(0.08, 0.06, 0.2) * exp(-pow(dot(d, normalize(vec3(0.25, 0.9, -0.35))) * 3.0, 2.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 12, 10) }));
  sun.position.copy(SUN).multiplyScalar(8);
  scene.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  disposeTree(scene);
  return env;
}

// a map, or null if it can't be had (lib/three/textures shares it by URL)
const fetchMap = (url, color, renderer) => loadTexture(url, { renderer, color }).catch(() => null);

export async function create(canvas, ctx) {
  const tier = device().tier;
  const B = budget(tier);
  const stage = createRenderer(canvas, { alpha: false, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.0, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = stage;
  renderer.setClearColor(0x020308, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(0, 0, 5.4);

  const small = tier === 'low';
  const [albedo, normalMap, glow] = await Promise.all([
    fetchMap(`${MAPS}transformers${small ? '-sm' : ''}.webp`, true, renderer),
    fetchMap(`${MAPS}transformers-normal.webp`, false, renderer),
    fetchMap(`${MAPS}transformers-glow.webp`, false, renderer),
  ]);

  const noise = new THREE.DataTexture(noiseAtlas(256, 1984), 256, 256, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.generateMipmaps = true;
  noise.needsUpdate = true;

  const env = makeEnvironment(renderer);
  scene.environment = env;
  let starDot = null;

  // the sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uNoise: { value: noise } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY_FRAG,
    }),
  );
  scene.add(sky);
  // stars: most of them in the patch of sky behind the planet, the only sky
  // anyone sees, white, blue-white, a few blue-green and violet; and a few
  // big soft ones
  {
    let seed = 11;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const tint = [new THREE.Color(1, 1, 1), new THREE.Color(0.72, 0.85, 1), new THREE.Color(0.55, 1, 0.95), new THREE.Color(0.8, 0.62, 1)];
    const c = new THREE.Color();
    const stars = (n, size, bright, map) => {
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        // two in three in a cone round the view, the rest anywhere
        const ahead = rand() < 0.68;
        const z = ahead ? 1 - rand() * 0.25 : rand() * 2 - 1;
        const a = rand() * Math.PI * 2;
        const s = Math.sqrt(1 - z * z);
        pos.set([Math.cos(a) * s * 50, Math.sin(a) * s * 50, -z * 50], i * 3);
        c.copy(tint[Math.floor(rand() ** 1.6 * 4)]).multiplyScalar(bright * (0.25 + rand() ** 3 * 1.6));
        col.set([c.r, c.g, c.b], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false, map, transparent: !!map, blending: map ? THREE.AdditiveBlending : THREE.NormalBlending });
      scene.add(new THREE.Points(g, m));
    };
    stars(Math.round(2600 * B.stars) + 400, 1.6, 1, null);
    // a soft round dot for the big ones
    const dot = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const r = Math.hypot(x - 7.5, y - 7.5) / 7.5;
        const v = Math.round(255 * Math.max(0, 1 - r) ** 2.2);
        dot.set([v, v, v, v], (y * 16 + x) * 4);
      }
    starDot = new THREE.DataTexture(dot, 16, 16, THREE.RGBAFormat);
    starDot.needsUpdate = true;
    stars(Math.round(90 * B.stars) + 20, 6, 1.4, starDot);
  }

  // the light: a cool white sun, the nebula's blue on the side away from it
  // so the night side still reads as blued steel, and a blue-green kick on
  // the far limb so it keeps its shape against the sky
  const sun = new THREE.DirectionalLight(0xf0f4ff, 4.4);
  sun.position.copy(SUN).multiplyScalar(10);
  const fill = new THREE.DirectionalLight(0x5b8cff, 1.1);
  fill.position.set(0.75, -0.25, 0.6);
  const kick = new THREE.DirectionalLight(0x4fd0ff, 1.0);
  kick.position.set(0.9, 0.25, -0.6);
  scene.add(sun, fill, kick, new THREE.AmbientLight(0x22324a, 0.35));

  // the planet
  const from = SIDES[ctx.side] ?? SIDES.autobot;
  const tilt = new THREE.Group();
  tilt.rotation.set(0.38, 0, -0.18);
  scene.add(tilt);
  const mat = new THREE.MeshStandardMaterial({
    map: albedo,
    color: albedo ? 0xffffff : 0x3a404a,
    normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    metalness: 0.4,
    roughness: 0.58,
    envMapIntensity: 0.7,
  });
  const skin = glow && albedo ? cybertronSkin(mat, { glow, sun: SUN }) : null;
  if (skin) {
    skin.uEnergon.value.copy(from.energon);
    skin.uLevels.value.y = 2.2 * from.war;
  }
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, small ? 96 : 192, small ? 64 : 128), mat);
  tilt.add(planet);

  // the war: fireballs out of the fronts (where the glow map burns), two
  // flares coming up off the edge in turn, and a warm light on the biggest
  const battle = createWar({ radius: 1, zones: warZones(glow), count: small ? 5 : 8, flares: 2, small, light: true });
  planet.add(battle.group);

  const airColor = from.energon.clone().lerp(HAZE, 0.7);
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: airColor }, uSun: { value: SUN }, uReach: { value: 1.08 } },
      vertexShader: AIR_VERT,
      fragmentShader: AIR_FRAG,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  air.renderOrder = 1;
  scene.add(air);
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(1.004, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: airColor }, uSun: { value: SUN } },
      vertexShader: AIR_VERT,
      fragmentShader: HAZE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  haze.renderOrder = 1;
  scene.add(haze);

  // the moons, cratered, lit by the same sun
  const moonMat = new THREE.MeshStandardMaterial({ color: 0x7c828c, roughness: 0.92, metalness: 0.15, bumpMap: noise, bumpScale: 4 });
  const moons = [
    { r: 0.09, orbit: 1.78, speed: 0.06, phase: 0.9, incl: 0.32 },
    { r: 0.05, orbit: 2.15, speed: -0.04, phase: 3.6, incl: -0.5 },
  ].map((m) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(m.r, 5), moonMat);
    scene.add(mesh);
    return { ...m, mesh };
  });

  // wreckage in orbit: a thin, tilted ring of tumbling metal
  const ringTilt = new THREE.Group();
  ringTilt.rotation.set(0.5, 0, 0.32);
  scene.add(ringTilt);
  const DEBRIS = small ? 500 : 1400;
  const debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8a909a, metalness: 0.9, roughness: 0.35 }), DEBRIS);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let seed = 7;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < DEBRIS; i++) {
      const a = rand() * Math.PI * 2;
      const r = 1.32 + rand() ** 1.4 * 0.3;
      const s = 0.0025 + rand() ** 3 * 0.011;
      q.setFromEuler(e.set(rand() * 6, rand() * 6, rand() * 6));
      m.compose(new THREE.Vector3(Math.cos(a) * r, (rand() - 0.5) * 0.025, Math.sin(a) * r), q, new THREE.Vector3(s, s * (0.5 + rand()), s));
      debris.setMatrixAt(i, m);
    }
  }
  ringTilt.add(debris);

  // the space bridge: a ring of pylons on its own orbit, facing the planet,
  // its portal opening every so often
  const bridge = new THREE.Group();
  const bridgeMetal = new THREE.MeshStandardMaterial({ color: 0x9aa2ae, metalness: 0.85, roughness: 0.35 });
  const bridgeGlow = new THREE.MeshBasicMaterial({ color: from.energon.clone().multiplyScalar(2.2), toneMapped: false });
  bridge.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 10, 48), bridgeMetal));
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.003, 6, 48), bridgeGlow);
  bridge.add(inner);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.03), bridgeMetal);
    pylon.position.set(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0);
    pylon.rotation.z = a + Math.PI / 2;
    bridge.add(pylon);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), bridgeGlow);
    tip.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
    bridge.add(tip);
  }
  const portalU = { uOpen: { value: 0 }, uTime: { value: 0 }, uColor: { value: from.energon.clone() } };
  const portal = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 48),
    new THREE.ShaderMaterial({
      uniforms: portalU,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: PORTAL_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  bridge.add(portal);
  bridge.scale.setScalar(0.9);
  scene.add(bridge);

  // bloom for the energon, the fires, the portal
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: B.samples }));
  composer.addPass(new RenderPass(scene, camera));
  // (only what's brighter than lit metal gets it)
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), LOOK.bloom.strength, LOOK.bloom.radius, LOOK.bloom.threshold);
  bloom.enabled = B.bloom > 0;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // turning it by hand
  let spin = 2.2;
  let vel = 0.04; // radians a second
  let drag = null;
  const el = ctx.el;
  const down = (e) => {
    drag = { x: e.clientX, id: e.pointerId, at: performance.now() };
    el.setPointerCapture?.(e.pointerId);
    ctx.invalidate();
  };
  const move = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const now = performance.now();
    const dx = e.clientX - drag.x;
    const turn = (dx / Math.max(160, el.clientWidth)) * Math.PI * 1.4;
    spin += turn;
    vel = turn / Math.max(0.008, (now - drag.at) / 1000);
    drag.x = e.clientX;
    drag.at = now;
    ctx.invalidate();
  };
  const up = (e) => {
    if (drag?.id === e.pointerId) drag = null;
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.style.touchAction = 'pan-y';
  el.style.cursor = 'grab';

  let want = from;
  let visible = true;
  let clock = 0;
  const idle = ctx.reduced ? 0 : 0.035;
  const war = { value: from.war };
  const tmp = new THREE.Vector3();

  return {
    // its shaders, linked in the background: useScene holds the first frame for this
    ready: Promise.all([precompile(renderer, scene, camera), precompilePasses(renderer, composer, camera)]),
    resize(w, h) {
      stage.setSize(w, h);
      const r = stage.ratio;
      composer.setPixelRatio(r);
      composer.setSize(w, h);
      bloom.resolution.set(Math.round(w * r * 0.5), Math.round(h * r * 0.5));
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    setVisible(on) {
      visible = on;
    },
    update({ side }) {
      want = SIDES[side] ?? SIDES.autobot;
    },
    render(ms, now) {
      if (stage.lost) return false;
      const dt = Math.min(0.05, ms / 1000);
      clock += ctx.reduced ? 0 : dt;
      // the side's colours, eased across
      const k = Math.min(1, dt * 2.5);
      war.value += (want.war - war.value) * k;
      if (skin) {
        skin.uEnergon.value.lerp(want.energon, k);
        skin.uLevels.value.y = 2.2 * war.value;
        skin.uTime.value = clock;
      }
      airColor.copy(skin ? skin.uEnergon.value : want.energon).lerp(HAZE, 0.7);
      bridgeGlow.color.copy(skin ? skin.uEnergon.value : want.energon).multiplyScalar(2.2);
      portalU.uColor.value.copy(bridgeGlow.color).multiplyScalar(0.5);
      const settling = Math.abs(want.war - war.value) > 0.004;
      // a flick of the wrist coasts down to the planet's own slow turn
      if (!drag) {
        vel += (idle - vel) * Math.min(1, dt * 1.2);
        spin += vel * dt;
      }
      planet.rotation.y = spin;
      battle.update(clock, camera, war.value);
      for (const m of moons) {
        const a = m.phase + clock * m.speed;
        m.mesh.position.set(Math.cos(a) * m.orbit, Math.sin(a) * m.orbit * Math.sin(m.incl), Math.sin(a) * m.orbit * Math.cos(m.incl));
        m.mesh.rotation.y = a;
      }
      ringTilt.rotation.y = clock * 0.02;
      // the bridge: round on its orbit, its open face to the planet; the
      // portal opens for a few seconds in every fourteen
      const ba = 2.4 + clock * 0.05;
      bridge.position.set(Math.cos(ba) * 1.62, 0.55 + Math.sin(ba * 0.5) * 0.08, Math.sin(ba) * 1.62);
      bridge.lookAt(tmp.set(0, 0, 0));
      const cycle = clock % 14;
      portalU.uOpen.value = cycle < 3.2 ? Math.sin((cycle / 3.2) * Math.PI) ** 0.6 : 0;
      portalU.uTime.value = clock;
      inner.material.color.multiplyScalar(1 + portalU.uOpen.value * 0.8);
      composer.render();
      stage.watch(now);
      return visible && (!ctx.reduced || !!drag || settling || Math.abs(vel) > 0.01);
    },
    dispose() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.style.cursor = '';
      el.style.touchAction = '';
      disposeTree(scene);
      battle.dispose();
      // (the maps are shared by URL: lib/three/textures keeps them for the next visit)
      for (const t of [noise, env, starDot]) t?.dispose();
      composer.dispose();
      stage.dispose();
    },
  };
}
