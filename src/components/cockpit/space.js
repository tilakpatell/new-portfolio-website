// Space outside the Falcon's and the X-wing's glass: a sky of stars and a
// faint nebula, a planet with its atmosphere lit from one side by a far sun,
// and the jump to lightspeed. The jump is drawn in the world, beyond the
// glass, so the canopy's frame stays in front of it: stars a little way
// ahead stretch into lines as the ship speeds up, curl in the tunnel of blue
// light, and the white flash on the way out. All of it is drawn in the
// outside pass (scene.js), before the cockpit.

import * as THREE from 'three';
import { glowSprite, rng } from './kit';

// A sky: a sphere of stars (points, varied in size and colour) and the
// nebula behind them (domain-warped noise on the view direction, so it has
// no seams).
const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const NEBULA_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uDeep;
uniform float uFade;
uniform vec3 uBand;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 q = vec3(fbm(d * 2.2), fbm(d * 2.2 + 5.2), fbm(d * 2.2 + 9.7));
  float n = fbm(d * 3.0 + q * 2.4);
  // a band across the sky, where the nebula gathers (a galaxy's plane)
  float band = exp(-pow(dot(d, normalize(uBand)) * 3.2, 2.0));
  float cloud = smoothstep(0.42, 0.95, n) * (0.35 + 0.65 * band);
  vec3 col = uDeep + mix(uA, uB, smoothstep(0.3, 0.8, q.x)) * cloud;
  // dark lanes of dust through the band
  col *= 1.0 - 0.55 * smoothstep(0.55, 0.75, fbm(d * 7.0 + 3.0)) * band;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPx;
uniform float uFade;
varying vec3 vColor;
void main() {
  vColor = aColor * uFade;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPx;
}
`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vColor * a, a);
}
`;

export function sky({ seed = 4, count = 5200, radius = 1800, nebula = ['#2a3f7a', '#6a2f6e'], deep = '#020309', band = [0.3, 1, 0.25] } = {}) {
  const r = rng(seed);
  const group = new THREE.Group();
  const nebU = {
    uA: { value: new THREE.Color(nebula[0]) },
    uB: { value: new THREE.Color(nebula[1]) },
    uDeep: { value: new THREE.Color(deep) },
    uFade: { value: 1 },
    uBand: { value: new THREE.Vector3(...band) },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, uniforms: nebU, side: THREE.BackSide, depthWrite: false, toneMapped: false }),
  );
  dome.renderOrder = -10;
  group.add(dome);

  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  const bandDir = new THREE.Vector3(...band).normalize();
  for (let i = 0; i < count; i++) {
    // more stars near the band
    let v;
    do {
      v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize();
    if (r() < 0.45) v.addScaledVector(bandDir, -v.dot(bandDir) * (0.6 + r() * 0.4)).normalize();
    pos.set([v.x * radius * 0.9, v.y * radius * 0.9, v.z * radius * 0.9], i * 3);
    const big = Math.pow(r(), 9);
    size[i] = 1.1 + r() * 1.4 + big * 5;
    // star colours: mostly white, some blue, some warm
    const k = r();
    c.setHSL(k < 0.25 ? 0.6 : k < 0.4 ? 0.08 : 0.13, k < 0.4 ? 0.5 : 0.1, 0.75 + r() * 0.25);
    const b = 0.5 + r() * 0.7 + big * 2;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const starU = { uPx: { value: 1 }, uFade: { value: 1 } };
  const stars = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  group.add(stars);
  return {
    group,
    // px: the renderer's pixel ratio; fade: 1 shown … 0 gone (in the jump)
    set({ px, fade }) {
      if (px != null) starU.uPx.value = px;
      if (fade != null) {
        starU.uFade.value = fade;
        nebU.uFade.value = fade;
      }
    },
  };
}

// A planet: its map wrapped round a sphere, lit from `sun` (a direction),
// with a thin atmosphere that glows on its lit limb and a softer one in the
// dark. `night` lights the dark side (city lights or lava), optional.
const ATMO_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  vW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSun;
uniform float uStrength;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
void main() {
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float lit = smoothstep(-0.25, 0.6, dot(normalize(vW), normalize(uSun)));
  float a = pow(rim, 2.4) * (0.15 + 0.85 * lit) * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}
`;

export function planet({ map, radius = 100, sun = [1, 0.3, 0.4], atmosphere = '#9fc2ff', strength = 1.2, tint = 0xffffff, ambient = 0.03 } = {}) {
  const group = new THREE.Group();
  const sunDir = new THREE.Vector3(...sun).normalize();
  const mat = new THREE.MeshStandardMaterial({ map: map ?? null, color: tint, roughness: 0.95, metalness: 0 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
  group.add(body);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.035, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { uColor: { value: new THREE.Color(atmosphere) }, uSun: { value: sunDir }, uStrength: { value: strength } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      toneMapped: false,
    }),
  );
  group.add(atmo);
  // its own light, so the rest of the scene can be lit differently
  const light = new THREE.DirectionalLight(0xfff4e6, 2.6);
  light.position.copy(sunDir).multiplyScalar(radius * 10);
  light.target = body;
  group.add(light, light.target);
  const amb = new THREE.AmbientLight(0x8090b0, ambient);
  group.add(amb);
  return { group, body, spin: (dt) => (body.rotation.y += dt * 0.004) };
}

// The jump to lightspeed, in the world ahead of the ship (which flies down
// −z): stars on a long cylinder round the way ahead come at you faster and
// faster, each a streak as long as the distance it covers while the eye
// holds its light; at the jump they curl round the vanishing point and the
// mottled blue tunnel opens; a flash on the way out. update() takes the
// throttle (0…1) and the tunnel (0…1).
const STREAK_VERT = /* glsl */ `
attribute vec2 aRow;   // x: 0 head, 1 tail; y: side
attribute vec4 aStar;  // x: angle, y: radius, z: depth phase, w: size
attribute vec2 aLook;  // x: tint, y: brightness
uniform float uTravel;
uniform float uLen;
uniform float uDepth;
uniform float uSwirl;
uniform float uTunnel;
uniform float uFade;
uniform vec2 uView;
uniform float uPx;
varying float vAcross;
varying float vF;
varying float vGlow;
varying vec3 vColor;

vec3 at(float z) {
  // the swirl turns the far end more, so long streaks curve
  float a = aStar.x + uSwirl * clamp(-z / uDepth, 0.0, 1.0) * (0.4 + 0.6 * aLook.x);
  return vec3(cos(a) * aStar.y, sin(a) * aStar.y, z);
}
vec2 px(vec4 c) { return c.xy / c.w * 0.5 * uView; }

void main() {
  float zh = -mod(aStar.z * uDepth - uTravel, uDepth) - 0.5;
  float zt = zh - uLen;
  vec3 h = at(zh);
  vec3 t = at(zt);
  vec4 hv = modelViewMatrix * vec4(h, 1.0);
  vec4 tv = modelViewMatrix * vec4(t, 1.0);
  // nothing behind the eye
  float hide = step(-0.2, hv.z);
  hv.z = min(hv.z, -0.2);
  tv.z = min(tv.z, -0.2);
  vec4 hc = projectionMatrix * hv;
  vec4 tc = projectionMatrix * tv;
  vec2 hp = px(hc);
  vec2 tp = px(tc);
  vec2 dir = tp - hp;
  float len = length(dir);
  dir = len > 0.001 ? dir / len : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  float near = clamp(1.0 + zh / uDepth, 0.0, 1.0);
  float w = (0.55 + 1.6 * near * near) * aStar.w * uPx;
  vec4 c = aRow.x < 0.5 ? hc : tc;
  vec2 p = (aRow.x < 0.5 ? hp - dir * w : tp + dir * w) + side * aRow.y * (w + uPx);
  vAcross = aRow.y;
  vF = aRow.x;
  // fade in out of the far dark, so nothing pops
  float arrive = 1.0 - smoothstep(uDepth * 0.7, uDepth, -zh);
  vGlow = aLook.y * arrive * uFade * (1.0 - hide) * (0.55 + 0.45 * near);
  float blue = mix(0.12 + aLook.x * 0.25, 0.55 + aLook.x * 0.45, uTunnel);
  vColor = vec3(1.0 - 0.45 * blue, 1.0 - 0.18 * blue, 1.0);
  gl_Position = vec4(p / (0.5 * uView) * c.w, c.z, c.w);
}
`;
const STREAK_FRAG = /* glsl */ `
varying float vAcross;
varying float vF;
varying float vGlow;
varying vec3 vColor;
void main() {
  float a = 1.0 - smoothstep(0.35, 1.0, abs(vAcross));
  a *= vGlow * mix(1.0, 0.15, vF * vF);
  gl_FragColor = vec4(vColor * a * 1.6, a);
}
`;

const TUNNEL_VERT = /* glsl */ `
varying vec2 vUv;
varying float vZ;
void main() {
  vUv = uv;
  vZ = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const TUNNEL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOn;
uniform float uScroll;
varying vec2 vUv;
varying float vZ;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  // round the tunnel (u) and along it (v): long streaks rushing past
  vec2 p = vec2(vUv.x * 48.0, vUv.y * 3.0 + uScroll);
  float n = noise(p * vec2(1.0, 0.6)) * 0.6 + noise(p * vec2(2.3, 1.1) + 7.0) * 0.4;
  float streak = smoothstep(0.45, 0.95, n);
  float mottle = noise(vec2(vUv.x * 9.0, vUv.y * 0.8 + uScroll * 0.3 + uTime * 0.2));
  vec3 deep = vec3(0.05, 0.16, 0.55);
  vec3 bright = vec3(0.7, 0.88, 1.0);
  vec3 col = mix(deep, bright, streak) * (0.55 + 0.9 * mottle);
  // round you to far away; it fades only at the very ends
  float depth = smoothstep(0.0, 0.03, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
  float a = uOn * (0.45 + 0.9 * streak) * depth;
  gl_FragColor = vec4(col * a, a);
}
`;

const additive = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, toneMapped: false };

export function hyperspace({ count = 1800, depth = 260, inner = 2.5, outer = 60, seed = 21 } = {}) {
  const r = rng(seed);
  const group = new THREE.Group();
  const row = new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]);
  const star = new Float32Array(count * 4);
  const look = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const rad = inner + Math.pow(r(), 0.75) * (outer - inner);
    star.set([r() * Math.PI * 2, rad, r(), 0.6 + r() * 0.8], i * 4);
    look.set([r(), 0.35 + Math.pow(r(), 0.6) * 0.65], i * 2);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 2));
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(star, 4));
  geo.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 2));
  geo.instanceCount = count;
  const u = {
    uTravel: { value: 0 },
    uLen: { value: 0 },
    uDepth: { value: depth },
    uSwirl: { value: 0 },
    uTunnel: { value: 0 },
    uFade: { value: 0 },
    uView: { value: new THREE.Vector2(1, 1) },
    uPx: { value: 1 },
  };
  const streaks = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, uniforms: u, side: THREE.DoubleSide, ...additive }));
  streaks.frustumCulled = false;
  streaks.renderOrder = 2;
  group.add(streaks);

  // the tunnel: a long open tube down −z, seen from inside
  const tubeGeo = new THREE.CylinderGeometry(9, 9, depth * 1.6, 64, 1, true);
  tubeGeo.rotateX(-Math.PI / 2);
  tubeGeo.translate(0, 0, -depth * 0.8);
  const tu = { uTime: { value: 0 }, uOn: { value: 0 }, uScroll: { value: 0 } };
  const tunnel = new THREE.Mesh(tubeGeo, new THREE.ShaderMaterial({ vertexShader: TUNNEL_VERT, fragmentShader: TUNNEL_FRAG, uniforms: tu, side: THREE.BackSide, ...additive }));
  tunnel.frustumCulled = false;
  tunnel.renderOrder = 1;
  tunnel.visible = false;
  group.add(tunnel);

  // the glow at the vanishing point, as the jump opens
  const core = glowSprite('#bcd8ff', 90, 0);
  core.position.set(0, 0, -depth * 0.9);
  core.renderOrder = 3;
  group.add(core);

  let travel = 0;
  let swirl = 0;
  let scroll = 0;
  return {
    group,
    // the canvas's size in drawing-buffer pixels and its pixel ratio
    resize(w, h, px) {
      u.uView.value.set(w, h);
      u.uPx.value = px;
    },
    // throttle 0…1 (the ship's speed), tunnel 0…1 (inside the jump), shown 0…1
    update(dt, t, { throttle, tunnel: inTunnel, shown = 1 }) {
      // world units a second: a slow drift at rest, a wall of light at the top
      const v = 4 + 900 * Math.pow(throttle, 2.2);
      travel += v * dt;
      u.uTravel.value = travel % depth;
      // the eye's exposure: a dot at rest, long lines when going fast
      u.uLen.value = Math.min(depth * 0.8, v * (0.012 + 0.07 * Math.pow(throttle, 1.5)));
      if (inTunnel > 0) swirl += dt * 0.9 * inTunnel;
      u.uSwirl.value = swirl;
      u.uTunnel.value = inTunnel;
      u.uFade.value = shown;
      tunnel.visible = inTunnel > 0.01;
      scroll += dt * (2 + 10 * inTunnel);
      tu.uScroll.value = scroll;
      tu.uTime.value = t;
      tu.uOn.value = inTunnel * shown;
      core.material.opacity = Math.max(inTunnel * 0.9, Math.max(0, throttle - 0.5) * 1.2) * shown;
    },
    // the light the jump throws on the cockpit: its colour and how strong
    light(target, { throttle, tunnel: inTunnel }) {
      const k = Math.max(0, throttle - 0.3) * 0.8 + inTunnel * 1.6;
      target.setRGB(0.55 * k, 0.75 * k, 1.25 * k);
      return k;
    },
  };
}
