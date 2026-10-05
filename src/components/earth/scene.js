// Earth, the world, in WebGL: the globe from NASA's Blue Marble (with the
// sea floor's shape, and the land's relief lit by the sun), the 2016 Black
// Marble's city lights on the night side, the sun glinting off the sea, a
// shell of clouds that casts its shadows on the ground, an atmosphere that's
// a blue rim from orbit and a sky from low down, the stars behind, a beacon
// at every place in the passport, and the plane (a 737, repainted) with its
// lights and contrails. The sun is where it really is now.
//
// It draws what the component hands it every frame (the flight from
// ./rules.js, where the camera is in its dive from orbit, which places are
// stamped, the trail) and decides nothing.
//
// createEarth(canvas, { onLost, small }) returns { render(state, ms),
// screenOf(v), pick(ndcX, ndcY), resize, dispose, lost, ready }.

import * as THREE from 'three';
import { createRenderer, disposeTree, precompile } from '../../lib/three/renderer';
import { gltfLoader } from '../../lib/three/gltf';
import { loadTexture, sharpenMaterial } from '../../lib/three/textures';
import { device } from '../../lib/device';
import { CLOUD_ALT, HOME_V, STAMPS, TRAIL as LOG, cross, placeById, routeArc, unit } from './rules';

const BASE = '/textures/earth/';
const CLOUDS_UP = CLOUD_ALT; // the cloud shell's height over the ground (the plane can get under it)
const AIR = 1.085; // the top of the atmosphere
const PLANE = 0.0075; // the plane's length, in Earth radii (a toy: you'd never see a real one from up here)
const TRAIL_UP = 0.0015; // the trail flown is drawn this far under where the plane was
const ROUTE_UP = 0.008; // the routes to the places stamped

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ── the globe ──
//
// Lit by hand, so the day side, the night lights, the glint, the cloud
// shadows and the haze at the rim are one pass. Texture coordinates are
// worked out from the direction (longitude 0 at +z), not from the mesh, so
// there's no seam and the poles don't pinch.
const GLOBE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const COMMON = /* glsl */ `
const float PI = 3.141592653589793;
vec2 uvOf(vec3 n) {
  return vec2(atan(n.x, n.z) / (2.0 * PI) + 0.5, asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5);
}`;
const GLOBE_FRAG = /* glsl */ `
uniform sampler2D tDay;
uniform sampler2D tNight;
uniform sampler2D tClouds;
uniform sampler2D tWater;
uniform sampler2D tRelief;
uniform vec3 uSun;
uniform float uCloud; // the clouds' drift, a fraction of the way round
uniform float uRelief;
uniform float uHasNight;
varying vec3 vN;
varying vec3 vW;
${COMMON}
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  vec3 N = normalize(vN);
  vec2 uv = uvOf(N);
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-6, 0.0, 0.0));
  vec3 north = cross(N, east);
  float water = texture2D(tWater, uv).r;

  // the land's relief: its slopes tilt the light
  vec2 slope = texture2D(tRelief, uv).rg * 2.0 - 1.0;
  vec3 Nr = normalize(N - uRelief * (1.0 - water) * (slope.x * east + slope.y * north));
  float sunUp = dot(N, uSun);
  float lit = max(dot(Nr, uSun), 0.0);

  vec3 day = texture2D(tDay, uv).rgb;
  // close up, a little grain on the land, so it isn't smooth as paint
  float dist = length(cameraPosition - vW);
  float grain = (noise(N * 900.0) * 0.6 + noise(N * 2600.0) * 0.4 - 0.5) * (1.0 - water) * smoothstep(0.25, 0.03, dist);
  day *= 1.0 + grain * 0.22;

  // the clouds' shadows: where the sun's ray from here passes through the cloud shell
  vec2 toward = vec2(dot(uSun, east), dot(uSun, north)) * (${CLOUDS_UP} / max(sunUp, 0.12));
  float lat = asin(clamp(N.y, -1.0, 1.0));
  vec2 shift = vec2(toward.x / (2.0 * PI * max(cos(lat), 0.05)), toward.y / PI);
  float shade = texture2D(tClouds, uv + shift + vec2(uCloud, 0.0)).r;

  vec3 col = day * (lit * 1.35 + 0.012) * (1.0 - shade * 0.5);

  // the sun on the sea
  vec3 V = normalize(cameraPosition - vW);
  vec3 H = normalize(uSun + V);
  float nh = max(dot(N, H), 0.0);
  float glint = pow(nh, 160.0) * 2.4 + pow(nh, 18.0) * 0.12;
  col += vec3(1.0, 0.9, 0.72) * glint * water * smoothstep(-0.02, 0.15, sunUp) * (1.0 - shade * 0.8);

  // the lights at night, warm, dimmed where cloud covers them
  float night = 1.0 - smoothstep(-0.2, 0.06, sunUp);
  vec3 lights = texture2D(tNight, uv).rgb;
  col += lights * lights * vec3(1.6, 1.2, 0.75) * 2.2 * night * uHasNight * (1.0 - shade * 0.6);
  // and a little moonlight, so the land still shows on the night side
  col += day * vec3(0.035, 0.05, 0.085) * night;

  // the air between you and the ground: how much of it the view passes
  // through (from orbit, the shell's thickness, more towards the rim; from
  // low down, the whole way), lit by day, with a warm edge at dusk
  vec3 ray = normalize(vW - cameraPosition);
  float b = dot(cameraPosition, ray);
  float c = dot(cameraPosition, cameraPosition) - ${AIR.toFixed(4)} * ${AIR.toFixed(4)};
  float enter = max(0.0, -b - sqrt(max(b * b - c, 0.0)));
  float path = max(dist - enter, 0.0);
  float haze = 1.0 - exp(-path * 1.5);
  float dusk = smoothstep(-0.25, 0.1, sunUp) * (1.0 - smoothstep(0.1, 0.45, sunUp));
  vec3 air = mix(vec3(0.3, 0.55, 1.0), vec3(1.0, 0.55, 0.3), dusk * 0.6);
  col = mix(col, air * 0.8 * smoothstep(-0.22, 0.35, sunUp), haze * 0.5);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the clouds, a little way up: white by day, dark at night, softer at the rim
const CLOUD_FRAG = /* glsl */ `
uniform sampler2D tClouds;
uniform vec3 uSun;
uniform float uCloud;
varying vec3 vN;
varying vec3 vW;
${COMMON}
void main() {
  vec3 N = normalize(vN);
  float c = texture2D(tClouds, uvOf(N) + vec2(uCloud, 0.0)).r;
  float a = smoothstep(0.08, 0.85, c);
  float sunUp = dot(N, uSun);
  vec3 V = normalize(cameraPosition - vW);
  float light = smoothstep(-0.12, 0.25, sunUp) * (0.55 + 0.6 * max(sunUp, 0.0)) + 0.008;
  float dusk = smoothstep(-0.15, 0.05, sunUp) * (1.0 - smoothstep(0.05, 0.35, sunUp));
  vec3 col = mix(vec3(1.0), vec3(1.0, 0.68, 0.45), dusk * 0.7) * light;
  float facing = dot(N, V);
  // from far off, their edges against space thin out
  a *= mix(1.0, 0.75, pow(1.0 - max(facing, 0.0), 3.0));
  // seen from underneath, in their own shade
  col *= mix(1.0, 0.62, smoothstep(0.0, -0.2, facing));
  gl_FragColor = vec4(col, a * 0.94);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The atmosphere: for each view ray that misses the planet, how much air it
// passes through, as a sphere's inside drawn behind everything. A long path
// (the horizon from low down, the rim from orbit) is bright blue where the
// sun lights it, orange where it's setting.
const AIR_VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const AIR_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vW;
vec2 hit(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
void main() {
  vec3 o = cameraPosition;
  vec3 d = normalize(vW - o);
  vec2 a = hit(o, d, ${AIR.toFixed(4)});
  float t0 = max(a.x, 0.0);
  float t1 = a.y;
  vec2 g = hit(o, d, 1.0);
  if (g.x > 0.0) t1 = min(t1, g.x);
  float path = max(t1 - t0, 0.0);
  if (path <= 0.0) discard;
  // the middle of the path: how high, and how sunlit
  vec3 m = o + d * (t0 + t1) * 0.5;
  float up = dot(normalize(m), uSun);
  float h = clamp((length(m) - 1.0) / ${(AIR - 1).toFixed(4)}, 0.0, 1.0);
  float thick = (1.0 - exp(-path * 7.0)) * (1.0 - h * 0.55);
  float day = smoothstep(-0.28, 0.2, up);
  float dusk = smoothstep(-0.3, 0.0, up) * (1.0 - smoothstep(0.0, 0.3, up));
  vec3 blue = vec3(0.2, 0.45, 1.0);
  vec3 col = mix(blue, vec3(1.0, 0.5, 0.25), dusk * 0.75) * thick * (day * 0.95 + dusk * 0.4);
  // looking towards the sun through the air: a brighter glow round it
  float toSun = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(toSun, 24.0) * thick * day * 0.9;
  // from orbit it's a rim, and a softer one than it is a sky from inside
  col *= mix(1.0, 0.55, smoothstep(1.12, 2.2, length(o)));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// a beacon at a place: a beam straight up, brightest at its foot
const BEAM_VERT = /* glsl */ `
varying float vH;
void main() {
  vH = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vH;
void main() {
  float a = (1.0 - vH) * (1.0 - vH) * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
  #include <colorspace_fragment>
}`;

// a soft round glow, for the sun and the plane's lights
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The plane in code, for while the model loads (or if it doesn't): a
// fuselage, swept wings, a tail and two engines, nose along +z, 1 long.
function paperPlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f2f4f7', roughness: 0.45, metalness: 0.1 });
  const blue = new THREE.MeshStandardMaterial({ color: '#1f5f99', roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.86, 6, 12).rotateX(Math.PI / 2), white);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.16), white);
  wing.position.set(0, -0.015, 0.02);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.14), blue);
  fin.position.set(0, 0.11, -0.42);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.01, 0.08), white);
  tail.position.set(0, 0.02, -0.43);
  const eng = new THREE.CylinderGeometry(0.035, 0.03, 0.14, 10).rotateX(Math.PI / 2);
  for (const x of [-0.2, 0.2]) {
    const e = new THREE.Mesh(eng, blue);
    e.position.set(x, -0.06, 0.08);
    g.add(e);
  }
  g.add(body, wing, fin, tail);
  return g;
}

export function createEarth(canvas, { onLost, small = false } = {}) {
  const tier = device().tier;
  const gl = createRenderer(canvas, { alpha: false, antialias: true, ratio: 2, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.05, onLost });
  const { renderer } = gl;
  const big = !small && tier === 'high' && renderer.capabilities.maxTextureSize >= 8192;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.0005, 80);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  flat.needsUpdate = true;
  const sunDir = new THREE.Vector3(0, 0, 1);

  // the maps: the day side first (the world waits for it), the rest as they come
  // (decoded off the main thread, as sharp as the device's tier allows, and
  // shared with the universe map where they want the same file)
  const tex = (name, colour) =>
    loadTexture(`${BASE}${name}${big ? '' : '-sm'}.webp`, { renderer, color: colour }).then((t) => {
      t.wrapS = THREE.RepeatWrapping;
      return t;
    });
  const globeU = {
    tDay: { value: blank },
    tNight: { value: blank },
    tClouds: { value: blank },
    tWater: { value: blank },
    tRelief: { value: flat },
    uSun: { value: sunDir },
    uCloud: { value: 0 },
    uRelief: { value: 0.55 },
    uHasNight: { value: 0 },
  };
  const owned = [];
  const want = (name, colour, set) =>
    tex(name, colour)
      .then((t) => {
        owned.push(t);
        set(t);
        return t;
      })
      .catch(() => null);
  const ready = want('day', true, (t) => (globeU.tDay.value = t));
  want('water', false, (t) => (globeU.tWater.value = t));
  want('relief', false, (t) => (globeU.tRelief.value = t));
  want('night', true, (t) => {
    globeU.tNight.value = t;
    globeU.uHasNight.value = 1;
  });
  want('clouds', false, (t) => {
    globeU.tClouds.value = t;
    cloudU.tClouds.value = t;
    cloudMat.visible = true;
  });

  const seg = tier === 'low' || small ? [160, 96] : [288, 160];
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, seg[0], seg[1]), new THREE.ShaderMaterial({ vertexShader: GLOBE_VERT, fragmentShader: GLOBE_FRAG, uniforms: globeU }));
  scene.add(globe);
  const cloudU = { tClouds: { value: blank }, uSun: { value: sunDir }, uCloud: globeU.uCloud };
  const cloudMat = new THREE.ShaderMaterial({ vertexShader: GLOBE_VERT, fragmentShader: CLOUD_FRAG, uniforms: cloudU, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  cloudMat.visible = false;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1 + CLOUDS_UP, seg[0], seg[1]), cloudMat);
  clouds.renderOrder = 2;
  scene.add(clouds);
  const air = new THREE.Mesh(new THREE.SphereGeometry(AIR, 96, 48), new THREE.ShaderMaterial({ vertexShader: AIR_VERT, fragmentShader: AIR_FRAG, uniforms: { uSun: { value: sunDir } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  air.renderOrder = 1;
  scene.add(air);

  // the stars (the universe map's Milky Way), faint
  loadTexture(`/textures/universe/sky${big ? '' : '-sm'}.webp`, { renderer, color: true })
    .then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      owned.push(t);
      scene.background = t;
      scene.backgroundIntensity = 0.32;
    })
    .catch(() => {});

  // the sun, far off in its direction
  const glow = glowTexture();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.93, 0.8).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sun.scale.setScalar(5);
  scene.add(sun);
  const light = new THREE.DirectionalLight(0xffffff, 2.6);
  scene.add(light, light.target, new THREE.HemisphereLight(0xb8d4ff, 0x203040, 0.35));

  // ── the beacons ──
  const beamGeo = new THREE.CylinderGeometry(0.0022, 0.0042, 0.07, 10, 1, true).translate(0, 0.035, 0);
  const ringGeo = new THREE.RingGeometry(0.004, 0.0062, 32);
  const beacons = new Map();
  const place = (id, v, colour) => {
    const g = new THREE.Group();
    g.position.copy(v3(v));
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(v));
    const mat = new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: { uColor: { value: new THREE.Color(colour) }, uOpacity: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeo, mat);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colour), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.0004;
    g.add(beam, ring);
    beam.renderOrder = ring.renderOrder = 3;
    scene.add(g);
    beacons.set(id, { g, mat, ringMat, ring, colour });
  };
  for (const s of STAMPS) place(s.id, s.v, '#5cb8ff');
  place('home', HOME_V, '#ffe6a8');
  const STAMPED = new THREE.Color('#ffd27a');
  const OPEN = new THREE.Color('#5cb8ff');

  // ── the flight log ──
  // the trail flown, as a line just over the ground: the component keeps
  // the points (rules' logTrail) and bumps `trailV` when they change
  const trailPos = new Float32Array(LOG.max * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: '#8fd3ff', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  trailLine.frustumCulled = false;
  trailLine.renderOrder = 3;
  scene.add(trailLine);
  let trailSeen = -1;
  // the route home to each place stamped, along the great circle, in gold
  const routes = new Map();
  const routeMat = new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const route = (id) => {
    const s = placeById(id);
    if (!s) return;
    const pts = routeArc(HOME_V, s.v, 64).map((v) => v3(v).multiplyScalar(1 + ROUTE_UP));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), routeMat);
    line.renderOrder = 3;
    scene.add(line);
    routes.set(id, line);
  };

  // ── the plane ──
  const plane = new THREE.Group(); // placed and turned each frame
  const body = new THREE.Group(); // banks and pitches inside it
  plane.add(body);
  body.scale.setScalar(PLANE);
  let model = paperPlane();
  body.add(model);
  scene.add(plane);
  let gone = false;
  gltfLoader()
    .loadAsync('/models/sketchfab/earth-plane.glb')
    .then((g) => {
      if (gone) return disposeTree(g.scene);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          sharpenMaterial(m, { renderer });
          if ('roughness' in m) m.roughness = Math.min(m.roughness, 0.5);
        }
      });
      body.remove(model);
      disposeTree(model);
      model = g.scene;
      body.add(model);
      return null;
    })
    .catch(() => {});
  // its lights: red on the left wingtip, green on the right, a white strobe on the tail
  const navMat = (c) => new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const nav = [
    [navMat('#ff3b30'), [0.45, -0.02, -0.02]],
    [navMat('#30ff7a'), [-0.45, -0.02, -0.02]],
    [navMat('#ffffff'), [0, 0.17, -0.48]],
  ].map(([m, at]) => {
    const s = new THREE.Sprite(m);
    s.position.set(...at);
    s.scale.setScalar(0.09);
    body.add(s);
    return s;
  });

  // two contrails, from the engines, fading behind
  const TRAIL = 64;
  const trails = [-0.2, 0.2].map((x) => {
    const pos = new Float32Array(TRAIL * 2 * 3);
    const fade = new Float32Array(TRAIL * 2);
    for (let i = 0; i < TRAIL; i++) fade[i * 2] = fade[i * 2 + 1] = 1 - i / (TRAIL - 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
    const idx = [];
    for (let i = 0; i < TRAIL - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uLight: { value: 1 } },
      vertexShader: 'attribute float aFade; varying float vF; void main() { vF = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uLight; varying float vF; void main() { gl_FragColor = vec4(vec3(uLight), vF * vF * vF * 0.5);\n#include <colorspace_fragment>\n}',
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    scene.add(mesh);
    return { x, pos, geo, mat, mesh, pts: [], acc: 0 };
  });

  // ── sizes ──
  const size = { w: 1, h: 1 };
  const resize = (w, h) => {
    size.w = Math.max(1, w);
    size.h = Math.max(1, h);
    gl.setSize(size.w, size.h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // ── per frame ──
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const pose = { pos: new THREE.Vector3(0, 0, 3), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), ready: false };
  let disposed = false;
  let warmed = false;

  // where the chase camera wants to be: behind and above the plane, swung
  // round it by the look (yaw to either side, pitch up and down); or, in
  // the cockpit, at the nose looking ahead, banking with the wings
  const chase = (f, out, look = null, cockpit = false) => {
    const p = v3(f.p);
    const h = v3(f.h);
    const r = 1 + f.alt;
    out.plane = p.clone().multiplyScalar(r);
    if (cockpit) {
      out.pos = out.plane.clone().addScaledVector(h, 0.0045).addScaledVector(p, 0.0012);
      out.look = out.plane.clone().addScaledVector(h, 0.06).addScaledVector(p, 0.0012 + 0.003 * (f.climb ?? 0));
      out.up = p.clone().applyAxisAngle(h, -(f.turn * 0.6 + (f.roll ?? 0)));
      return out;
    }
    const yaw = look?.yaw ?? 0;
    const pitch = look?.pitch ?? 0;
    const right = h.clone().cross(p).normalize();
    // the way back from the plane, swung round by the yaw and tipped by the pitch
    const back = h.clone().multiplyScalar(-Math.cos(yaw)).addScaledVector(right, Math.sin(yaw));
    // (under the cloud deck the camera comes down with the plane, so the
    // clouds go by overhead instead of hiding it)
    const base = Math.min(0.0105, Math.max(0.0015, CLOUD_ALT - 0.0008 - f.alt));
    const lift = base + 0.03 * Math.sin(pitch) + 0.012 * (1 - Math.cos(yaw));
    out.pos = out.plane.clone().addScaledVector(back, 0.03 * Math.cos(pitch)).addScaledVector(p, lift);
    out.look = out.plane.clone().addScaledVector(h, 0.022 * Math.max(0, Math.cos(yaw))).addScaledVector(p, 0.002);
    out.up = p.clone().applyAxisAngle(h, -f.turn * 0.18 * Math.cos(yaw));
    return out;
  };
  const chaseNow = {};

  const render = (state, ms = 16) => {
    if (disposed || gl.lost) return;
    const dt = Math.min(0.05, ms / 1000);
    const { flight: f, sun: s, view, stamped, orbit, trail = null, trailV = 0, look = null, cockpit = false } = state;
    const t = performance.now() / 1000;
    sunDir.set(s[0], s[1], s[2]);
    sun.position.copy(sunDir).multiplyScalar(40);
    light.position.copy(sunDir).multiplyScalar(10);
    globeU.uCloud.value = (t * 0.0006) % 1;

    // the plane: on the sphere at its height, nose along its heading
    const p = v3(f.p);
    const h = v3(f.h);
    // (the model's +x is its left wing, +y its top, +z its nose)
    basis.makeBasis(v3(unit(cross(f.p, f.h))), p, h);
    plane.position.copy(p).multiplyScalar(1 + f.alt);
    plane.quaternion.setFromRotationMatrix(basis);
    q.setFromAxisAngle(Z, f.turn * 0.6 + (f.roll ?? 0));
    qb.setFromAxisAngle(X, -f.climb * 0.22);
    body.quaternion.copy(q).multiply(qb);
    nav[2].visible = t % 1.2 < 0.07; // the strobe
    const lightUp = Math.max(0, p.dot(sunDir));

    // the camera: orbit, the dive between, or the chase (or the cockpit)
    const inside = cockpit && view >= 1;
    chase(f, chaseNow, look, inside);
    body.visible = !inside;
    const k = view; // 0 orbit … 1 chase
    const orbitPos = v3(orbit).multiplyScalar(3.1);
    // in a dive the camera comes in along the way, then swings in behind
    const e = k * k * (3 - 2 * k);
    const r0 = orbitPos.length();
    const r1 = chaseNow.pos.length();
    const dirA = orbitPos.clone().normalize();
    const dirB = chaseNow.pos.clone().normalize();
    const dir = dirA.clone().lerp(dirB, Math.min(1, e * 1.25)).normalize();
    const radius = r1 + (r0 - r1) * Math.pow(1 - k, 2.4);
    const target = tmp.copy(chaseNow.look).multiplyScalar(Math.pow(e, 0.6));
    const up = tmp2.set(0, 1, 0).lerp(chaseNow.up, e).normalize();
    if (k >= 1) {
      // the chase: follow smoothly (the cockpit at once, or the nose would lag)
      const a = pose.ready && !inside ? 1 - Math.exp(-9 * dt) : 1;
      pose.pos.lerp(chaseNow.pos, a);
      pose.look.lerp(chaseNow.look, a);
      pose.up.lerp(chaseNow.up, a).normalize();
    } else {
      pose.pos.copy(dir).multiplyScalar(radius);
      pose.look.copy(target);
      pose.up.copy(up);
    }
    pose.ready = true;
    camera.position.copy(pose.pos);
    camera.up.copy(pose.up);
    camera.lookAt(pose.look);
    // near and far for where the camera is: close in for the plane, far out for the globe
    const height = camera.position.length() - 1;
    camera.near = Math.max(0.00025, Math.min(0.2, height * 0.04));
    camera.far = 80;
    camera.fov = inside ? 58 : 50 - 8 * k;
    camera.updateProjectionMatrix();
    // no stars by day, inside the air
    const inAir = 1 - THREE.MathUtils.smoothstep(height, 0.06, 0.13);
    const sunHere = THREE.MathUtils.clamp(camera.position.clone().normalize().dot(sunDir) * 4 + 0.6, 0, 1);
    scene.backgroundIntensity = 0.32 * (1 - inAir * sunHere * 0.94);

    // the beacons: gold once stamped, the beam shorter as you come in low
    for (const [id, b] of beacons) {
      const got = id === 'home' || stamped.has(id);
      if (id !== 'home') {
        b.mat.uniforms.uColor.value.copy(got ? STAMPED : OPEN);
        b.ringMat.color.copy(got ? STAMPED : OPEN);
      }
      const pulse = 1 + 0.25 * Math.sin(t * 3 + b.g.position.x * 9);
      b.ring.scale.setScalar(pulse);
      b.mat.uniforms.uOpacity.value = 0.22 + 0.7 * (1 - k);
      b.g.scale.setScalar(1 + (1 - k) * 0.8);
    }

    // the flight log: the trail as it grows, and a route for each new stamp
    if (trail && trailV !== trailSeen) {
      trailSeen = trailV;
      const n = Math.min(trail.length, LOG.max);
      for (let i = 0; i < n; i++) {
        const pt = trail[trail.length - n + i];
        const r = 1 + Math.max(0.002, (pt[3] ?? 0.01) - TRAIL_UP);
        trailPos[i * 3] = pt[0] * r;
        trailPos[i * 3 + 1] = pt[1] * r;
        trailPos[i * 3 + 2] = pt[2] * r;
      }
      trailGeo.setDrawRange(0, n);
      trailGeo.attributes.position.needsUpdate = true;
    }
    for (const id of stamped) if (!routes.has(id)) route(id);
    trailLine.material.opacity = 0.45 + 0.3 * (1 - k);
    routeMat.opacity = 0.35 + 0.3 * (1 - k);

    // contrails: a point dropped behind each engine every little while
    for (const tr of trails) {
      tr.acc += dt;
      const at = tmp.set(tr.x * PLANE, -0.05 * PLANE, -0.15 * PLANE).applyQuaternion(plane.quaternion).add(plane.position);
      if (!tr.pts.length || tr.acc > 0.04) {
        tr.acc = 0;
        tr.pts.unshift(at.clone());
        if (tr.pts.length > TRAIL) tr.pts.pop();
      } else tr.pts[0].copy(at);
      const side = tmp2.copy(p).cross(h).normalize();
      for (let i = 0; i < TRAIL; i++) {
        const pt = tr.pts[Math.min(i, tr.pts.length - 1)];
        const w = PLANE * (0.012 + 0.05 * (i / TRAIL));
        tr.pos.set([pt.x + side.x * w, pt.y + side.y * w, pt.z + side.z * w, pt.x - side.x * w, pt.y - side.y * w, pt.z - side.z * w], i * 6);
      }
      tr.geo.attributes.position.needsUpdate = true;
      tr.mat.uniforms.uLight.value = 0.08 + 0.92 * Math.min(1, lightUp * 3);
      tr.mesh.visible = k > 0.6 && !inside;
    }

    renderer.render(scene, camera);
  };

  // where a point on the globe is on the canvas, in CSS pixels, and whether
  // it's facing the camera
  const screenOf = (v, lift = 0) => {
    const w = v3(v).multiplyScalar(1 + lift);
    const facing = w.clone().normalize().dot(tmp.copy(camera.position).sub(w).normalize()) > 0.02;
    w.project(camera);
    return { x: ((w.x + 1) / 2) * size.w, y: ((1 - w.y) / 2) * size.h, on: facing && w.z < 1 && Math.abs(w.x) < 1.05 && Math.abs(w.y) < 1.05 };
  };

  // the place under a click, if any (for picking a destination from orbit)
  const pick = (nx, ny) => {
    let best = null;
    let bd = 0.06;
    for (const s of STAMPS) {
      const o = screenOf(s.v, 0.01);
      if (!o.on) continue;
      const d = Math.hypot((o.x / size.w) * 2 - 1 - nx, 1 - (o.y / size.h) * 2 - ny);
      if (d < bd) {
        bd = d;
        best = s.id;
      }
    }
    return best;
  };

  return {
    get lost() {
      return gl.lost;
    },
    ready,
    render,
    resize,
    screenOf,
    pick,
    warm(state) {
      if (warmed) return Promise.resolve();
      warmed = true;
      render(state, 16);
      return precompile(renderer, scene, camera);
    },
    dispose() {
      disposed = true;
      gone = true;
      disposeTree(scene);
      for (const t of owned) t.dispose();
      glow.dispose();
      blank.dispose();
      flat.dispose();
      gl.dispose();
    },
  };
}
