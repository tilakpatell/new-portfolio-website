// The way down into a planet's air (an entry: footScene.js flies the ship
// down its path, entry.js's fxAt says how far through the show it is): the
// bow shock wrapped round the ship's nose, white-hot at its tip and going
// orange back along it, flickering; streaks of it and sparks shed off its
// rim and streaming away behind; then the cloud deck, soft puffs rushing at
// and past the camera, and the white-out at its thickest, the whole view
// gone to cloud for a moment before it breaks out over the landing.
//
// Everything is in the planet's own frame (footScene adds `group` to its
// root, whose middle is the planet's), made once with the foot scene and
// hidden, so the first entry doesn't make shaders mid-flight. Four draws
// while it plays (the sheath, the streaks, the clouds, the white-out), none
// when it's done. With reduced motion the sheath's flicker is held still and
// the clouds don't rush: they fade in and out where they are. On phones,
// fewer streaks and puffs.
//
// createReentry({ small, reduced }) → { group, start({ cloud, glow }),
//   update(dt, { ship, dir, up, size, cam, fx, t }), stop(), dispose() }
// ship: the ship's middle; dir: the way it's going (unit); up: the ground's
// normal under it (unit); size: the ship's length; cam: { pos, look, up };
// fx: { burn, cloud, white }, 0…1 each; t: seconds since start().

import * as THREE from 'three';

const V = THREE.Vector3;

// the sheath, in ship lengths: its tip a little ahead of the nose, its
// inner shell and a wider, fainter one round it
const TIP = 0.55;
const INNER = { r: 0.45, len: 2.4 };
const OUTER = { r: 0.68, len: 3.1, ahead: 0.08 };

// the cloud deck, in map units: how far ahead the puffs are placed along
// the ground, how far out to either side of the way the ship's going, the
// band of heights they're in (from a little under where the ship was when
// it reached the deck to well over it, so it comes down through them and
// out under them), and how fast they rush at the camera on top of its own
// speed
const DECK = { far: 9, wide: 3, low: -0.5, high: 0.9, rush: 6 };
// the puffs fade out over this much (map units) down to a floor as far
// under the ship's middle
const FLOOR = 0.3;
// and thin out as they come up to the lens, on how far their middle is in
// front of it: all there at `full`, gone by `gone`, each that much further
// out per unit of the puff's size (a big one fills the view sooner)
const NEAR = { gone: [0.08, 0.1], full: [0.25, 0.55] };
const nearGone = (size) => NEAR.gone[0] + NEAR.gone[1] * size;

// The white-out: a sheet just in front of the lens (the camera's near plane
// on foot is 0.004), wide enough to fill any view up to 160 degrees across.
const WHITE_AT = 0.02;
const WHITE_SIZE = 2 * WHITE_AT * Math.tan((80 * Math.PI) / 180);

// a little value noise, for the plasma's flicker
const NOISE_GLSL = `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}`;

// ── The bow shock ──

// Both shells in one geometry (one draw): each a paraboloid round +z, its
// tip at the middle and opening back down −z, in ship lengths. aLayer is 0
// on the inner one and 1 on the outer.
function sheathGeometry() {
  const RINGS = 22;
  const AROUND = 36;
  const pos = [];
  const layer = [];
  const index = [];
  for (const [k, shell] of [INNER, OUTER].entries()) {
    const base = pos.length / 3;
    const ahead = shell.ahead ?? 0;
    for (let i = 0; i <= RINGS; i++) {
      // (rings closer together at the tip, where it curves most)
      const s = (i / RINGS) ** 2;
      const r = shell.r * Math.sqrt(s);
      for (let j = 0; j <= AROUND; j++) {
        const a = (j / AROUND) * Math.PI * 2;
        pos.push(Math.cos(a) * r, Math.sin(a) * r, ahead - s * shell.len);
        layer.push(k);
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < AROUND; j++) {
        const a = base + i * (AROUND + 1) + j;
        const b = a + AROUND + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layer, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

const SHEATH_VERT = `
attribute float aLayer;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
varying float vLayer;
void main() {
  vP = position;
  vLayer = aLayer;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const SHEATH_FRAG = `
uniform float uTime;
uniform float uBurn;
uniform vec3 uGlow;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
varying float vLayer;
${NOISE_GLSL}
void main() {
  // 0 at the tip, 1 at the open end
  float len = mix(${INNER.len.toFixed(2)}, ${OUTER.len.toFixed(2)}, vLayer);
  float s = clamp((${OUTER.ahead.toFixed(2)} * vLayer - vP.z) / len, 0.0, 1.0);
  // brightest where it's seen edge on, so it reads as a glow round the
  // ship, not a solid cone (clamped: pow() of anything below zero is NaN)
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(clamp(1.0 - facing, 0.0, 1.0), 2.5);
  // tongues of flame running back along it
  vec3 q = vec3(vP.xy * 7.0, vP.z * 2.2 + uTime * 7.0);
  float n = noise3(q) * 0.65 + noise3(q * 2.7 + 3.1) * 0.35;
  float flick = 0.35 + 1.3 * n * n;
  // white-hot at the tip, through yellow, to the glow colour
  vec3 col = mix(vec3(1.0, 0.96, 0.88), vec3(1.0, 0.72, 0.28), smoothstep(0.0, 0.1, s));
  col = mix(col, uGlow, smoothstep(0.08, 0.3, s));
  // above white near the tip, so the bloom catches it there and not all along
  float heat = mix(3.6, 0.7, smoothstep(0.0, 0.3, s));
  // a ragged end, gone well before the open end (nearest the camera)
  float tail = 1.0 - smoothstep(0.15 + 0.25 * n, 0.7, s);
  float a = (0.05 + rim) * tail * flick * heat * mix(1.0, 0.3, vLayer);
  gl_FragColor = vec4(col * a * uBurn, 1.0);
}`;

// ── The streaks and sparks ──

// Each a quad from its head (by the ship) back to its tail, turned about
// its own length to face the camera, so it never shows edge on.
const STREAK_VERT = `
attribute vec3 aHead;
attribute vec3 aTail;
attribute vec3 aLook;
varying vec2 vQ;
varying float vLife;
varying float vSpark;
void main() {
  vec3 h = (modelMatrix * vec4(aHead, 1.0)).xyz;
  vec3 t = (modelMatrix * vec4(aTail, 1.0)).xyz;
  vec3 p = mix(h, t, position.y);
  vec3 side = cross(t - h, cameraPosition - p);
  float l = length(side);
  p += (l > 1e-9 ? side / l : vec3(0.0)) * position.x * aLook.y;
  vQ = vec2(position.x * 2.0, position.y);
  // gone before it reaches the camera
  vLife = aLook.x * smoothstep(0.25, 0.6, distance(p, cameraPosition));
  vSpark = aLook.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const STREAK_FRAG = `
uniform vec3 uHot;
uniform vec3 uCool;
varying vec2 vQ;
varying float vLife;
varying float vSpark;
void main() {
  float across = clamp(1.0 - abs(vQ.x), 0.0, 1.0);
  float body = across * across * (3.0 - 2.0 * across);
  // brightest just behind its head, thinning away down its length
  float along = smoothstep(0.0, 0.12, vQ.y) * (1.0 - vQ.y) * (1.0 - vQ.y);
  vec3 col = mix(uCool, uHot, vLife * vLife);
  col = mix(col, vec3(3.2, 2.4, 1.4), vSpark);
  gl_FragColor = vec4(col * body * along * vLife, 1.0);
}`;

// ── The cloud deck ──

// one soft puff of cloud: lumpy (a few octaves of value noise), its alpha
// falling to nothing well inside the square, so no edge ever shows
function puffTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const seed = Math.random() * 100;
  const hash = (x, y) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return h - Math.floor(h);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const a = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * fx;
    const b = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * fx;
    return a + (b - a) * fy;
  };
  const fbm = (x, y) => value(x * 4, y * 4) * 0.5 + value(x * 8, y * 8) * 0.28 + value(x * 16, y * 16) * 0.14 + value(x * 32, y * 32) * 0.08;
  const step = (a, b, t) => smooth(Math.min(1, Math.max(0, (t - a) / (b - a))));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S;
      const v = (y + 0.5) / S;
      const r = Math.hypot(u - 0.5, v - 0.5) * 2; // 0 in the middle, 1 at the sides
      // (fbm's mostly between a quarter and three quarters: stretched, so
      // the lumps show)
      const n = Math.min(1, Math.max(0, (fbm(u, v) - 0.3) / 0.45));
      // the lumps push its edge in and out, so it isn't a disc; and nothing
      // at all past 0.9 of the way out, whatever the lumps do
      const a = (1 - step(0.2, 0.95, r + (n - 0.5) * 0.5)) * (1 - step(0.7, 0.92, r)) * (0.2 + 0.8 * n);
      const o = (y * S + x) * 4;
      const shade = 150 + 105 * n;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = shade;
      img.data[o + 3] = Math.round(255 * Math.min(1, a * 1.25));
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

// Each puff a quad turned to face the camera (in view space), a little
// lighter on its side toward the sky. Its bottom fades out over a floor
// a little under the ship (uFloor, a distance from the planet's middle), so
// a puff never cuts into the ground as a hard line.
const CLOUD_VERT = `
attribute vec4 aPuff;
attribute vec2 aLook;
uniform vec3 uUp;
varying vec2 vUv;
varying float vAlpha;
varying float vTop;
varying float vR;
void main() {
  vec4 mv = modelViewMatrix * vec4(aPuff.xyz, 1.0);
  // thinning out as it comes up to the lens. The quad lies flat at its
  // middle's depth, so that depth (not each corner's distance, which stays
  // large across a big puff) says how near all of it is: gone before it
  // reaches the near plane, and before it passes the camera
  float depth = -mv.z;
  vAlpha = aLook.x * smoothstep(${NEAR.gone[0].toFixed(2)} + ${NEAR.gone[1].toFixed(2)} * aPuff.w, ${NEAR.full[0].toFixed(2)} + ${NEAR.full[1].toFixed(2)} * aPuff.w, depth);
  float c = cos(aLook.y);
  float s = sin(aLook.y);
  vec2 corner = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
  mv.xy += corner * aPuff.w;
  vUv = uv;
  vec3 up = mat3(modelViewMatrix) * uUp;
  vTop = dot(corner, up.xy);
  vR = distance(mv.xyz, (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
  gl_Position = projectionMatrix * mv;
}`;

const CLOUD_FRAG = `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFloor;
varying vec2 vUv;
varying float vAlpha;
varying float vTop;
varying float vR;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  float a = tex.a * vAlpha * uOpacity * smoothstep(uFloor, uFloor + ${FLOOR.toFixed(2)}, vR);
  if (a < 0.002) discard;
  // lit from above: lighter on top, greyer under, and its lumps shaded
  vec3 col = uColor * (0.82 + 0.3 * vTop) * (0.7 + 0.35 * tex.r);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

export function createReentry({ small = false, reduced = false } = {}) {
  const STREAKS = small ? 40 : 90;
  const PUFFS = small ? 14 : 28;
  const group = new THREE.Group();
  group.name = 'reentry';
  group.visible = false;

  // the bow shock
  const sheathGeo = sheathGeometry();
  const sheathMat = new THREE.ShaderMaterial({
    vertexShader: SHEATH_VERT,
    fragmentShader: SHEATH_FRAG,
    uniforms: { uTime: { value: 0 }, uBurn: { value: 0 }, uGlow: { value: new THREE.Color() } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    forceSinglePass: true, // (added light: one pass draws the same as two)
  });
  const sheath = new THREE.Mesh(sheathGeo, sheathMat);
  sheath.frustumCulled = false;
  sheath.visible = false;
  sheath.renderOrder = 6; // (over the cloud deck: nearly all of it's further off than the ship)
  group.add(sheath);

  // the streaks and sparks: a pool, each held as an offset from the ship
  // (so they trail it wherever it turns) and shed in turn
  const streakGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); // (across, and head to tail)
  const head = new Float32Array(STREAKS * 3);
  const tail = new Float32Array(STREAKS * 3);
  const look = new Float32Array(STREAKS * 3); // life (1 new … 0 gone), width, spark
  streakGeo.setAttribute('aHead', new THREE.InstancedBufferAttribute(head, 3).setUsage(THREE.DynamicDrawUsage));
  streakGeo.setAttribute('aTail', new THREE.InstancedBufferAttribute(tail, 3).setUsage(THREE.DynamicDrawUsage));
  streakGeo.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 3).setUsage(THREE.DynamicDrawUsage));
  const streakMat = new THREE.ShaderMaterial({
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    uniforms: { uHot: { value: new THREE.Color() }, uCool: { value: new THREE.Color(0.55, 0.06, 0.02) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const streaks = new THREE.InstancedMesh(streakGeo, streakMat, STREAKS);
  streaks.frustumCulled = false;
  streaks.visible = false;
  streaks.renderOrder = 6;
  group.add(streaks);
  const streakV = Array.from({ length: STREAKS }, () => ({ off: new V(), v: new V(), age: 1, max: 1, len: 0, width: 0, spark: 0 }));
  let nextStreak = 0;
  let owed = 0;

  // the cloud deck: a pool of puffs, placed ahead and recycled once past
  const puffTex = puffTexture();
  const cloudGeo = new THREE.PlaneGeometry(1, 1);
  const puffAt = new Float32Array(PUFFS * 4); // middle, size
  const puffLook = new Float32Array(PUFFS * 2); // opacity, turn
  cloudGeo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(puffAt, 4).setUsage(THREE.DynamicDrawUsage));
  cloudGeo.setAttribute('aLook', new THREE.InstancedBufferAttribute(puffLook, 2).setUsage(THREE.DynamicDrawUsage));
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: { uMap: { value: puffTex }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uUp: { value: new V(0, 1, 0) }, uFloor: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true, // (flat: its faces never overlap each other)
  });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, PUFFS);
  clouds.frustumCulled = false;
  clouds.visible = false;
  // before the sheath and streaks (the puffs nearer the camera than the
  // ship are faded out already: NEAR) and the white-out
  clouds.renderOrder = 5;
  group.add(clouds);
  const puffV = Array.from({ length: PUFFS }, () => ({ p: new V(), r: 0, size: 1, age: 0, alive: false, turn: 0 }));
  let seeded = false;
  let deck = 0; // where the deck is: the ship's distance from the planet's middle as it reached it

  // the white-out: over everything
  const whiteGeo = new THREE.PlaneGeometry(1, 1);
  const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
  const white = new THREE.Mesh(whiteGeo, whiteMat);
  white.frustumCulled = false;
  white.visible = false;
  white.renderOrder = 1000;
  // placed on the camera as it's drawn (shaken and all, by whatever shakes
  // it), not as it was asked to be, so no shake can carry the lens through it
  const whiteAt = new THREE.Matrix4().makeTranslation(0, 0, -WHITE_AT).multiply(new THREE.Matrix4().makeScale(WHITE_SIZE, WHITE_SIZE, 1));
  white.onBeforeRender = (renderer, scene, camera) => white.matrixWorld.multiplyMatrices(camera.matrixWorld, whiteAt);
  group.add(white);

  // scratch, so a frame makes nothing
  const side = new V();
  const lift = new V();
  const fwd = new V();
  const level = new V();
  const flank = new V();
  const tmp = new V();
  const m = new THREE.Matrix4();
  const X = new V(1, 0, 0);
  const rand = (a, b) => a + Math.random() * (b - a);

  // two directions square to `d` and each other, `d` the third (the first
  // level with the ground where it can be)
  const across = (d, up) => {
    side.crossVectors(d, up);
    if (side.lengthSq() < 1e-8) side.crossVectors(d, X);
    side.normalize();
    lift.crossVectors(side, d);
  };

  const shed = (ship, dir, size) => {
    const sv = streakV[nextStreak];
    nextStreak = (nextStreak + 1) % STREAKS;
    // off the sheath's rim, somewhere round it a little behind the tip
    const s = rand(0.06, 0.32);
    const r = INNER.r * Math.sqrt(s) * size * rand(0.85, 1.05);
    const a = Math.random() * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    sv.off.copy(dir).multiplyScalar((TIP - s * INNER.len) * size);
    sv.off.addScaledVector(side, ca * r).addScaledVector(lift, sa * r);
    // back along the way it's going, drifting out a little
    sv.v.copy(dir).multiplyScalar(-rand(4, 8) * size);
    sv.v.addScaledVector(side, ca * rand(0.2, 1) * size).addScaledVector(lift, sa * rand(0.2, 1) * size);
    sv.spark = Math.random() < 0.3 ? 1 : 0;
    sv.age = 0;
    sv.max = sv.spark ? rand(0.2, 0.45) : rand(0.14, 0.34);
    sv.len = (sv.spark ? rand(0.05, 0.12) : rand(0.35, 1.1)) * size;
    sv.width = (sv.spark ? rand(0.014, 0.024) : rand(0.022, 0.045)) * size;
    if (sv.spark) sv.v.multiplyScalar(0.8).addScaledVector(side, rand(-1, 1) * size).addScaledVector(lift, rand(-1, 1) * size);
  };

  // the way the ship's going along the ground, and square to it, both
  // level with the ground under it
  const flat = (dir, up) => {
    level.copy(dir).addScaledVector(up, -dir.dot(up));
    if (level.lengthSq() < 1e-8) level.copy(side); // (straight down: any way along the ground)
    level.normalize();
    flank.crossVectors(level, up);
  };

  // a puff placed ahead of the camera along the ground, somewhere in the
  // deck's band of heights (anywhere along it the first time, then out at
  // the far end)
  const place = (pv, cam, ahead) => {
    pv.p.copy(cam.pos).addScaledVector(level, ahead).addScaledVector(flank, rand(-1, 1) * DECK.wide);
    pv.r = deck + rand(DECK.low, DECK.high);
    pv.p.setLength(pv.r);
    pv.size = rand(0.7, 2.3);
    pv.turn = Math.random() * Math.PI * 2;
    pv.age = 0;
    pv.alive = true;
  };

  const clearPools = () => {
    for (const sv of streakV) sv.age = sv.max;
    for (const pv of puffV) pv.alive = false;
    look.fill(0);
    puffLook.fill(0);
    owed = 0;
    seeded = false;
  };

  const hideAll = () => {
    group.visible = false;
    sheath.visible = false;
    streaks.visible = false;
    clouds.visible = false;
    white.visible = false;
  };

  return {
    group,

    // cloud: the cloud deck's colour (the landing sky's horizon); glow: the
    // plasma's outer colour
    start({ cloud = '#ffffff', glow = '#ff8a3c' } = {}) {
      clearPools();
      cloudMat.uniforms.uColor.value.set(cloud);
      whiteMat.color.set(cloud);
      sheathMat.uniforms.uGlow.value.set(glow);
      // a streak's head: the glow colour, hot enough to bloom
      streakMat.uniforms.uHot.value.set(glow).multiplyScalar(3.2);
      group.visible = true;
    },

    update(dt, { ship, dir, up, size, cam, fx, t }) {
      const { burn, cloud, white: whiteK } = fx;
      across(dir, up);

      // the bow shock: round the nose, drawn out a little as it gets hotter
      sheath.visible = burn > 0.001;
      if (sheath.visible) {
        sheath.position.copy(ship).addScaledVector(dir, TIP * size);
        sheath.quaternion.setFromRotationMatrix(m.makeBasis(side, tmp.crossVectors(dir, side), dir));
        sheath.scale.set(size, size, size * (0.75 + 0.3 * burn));
        sheathMat.uniforms.uBurn.value = burn;
        sheathMat.uniforms.uTime.value = reduced ? 0 : t;
      }

      // the streaks: shed in proportion to the burn, each streaming back
      // (held to the pool: a long frame sheds each streak once, not over and over)
      owed = Math.min(STREAKS, owed + burn * (small ? 110 : 240) * dt);
      while (owed >= 1) {
        owed -= 1;
        shed(ship, dir, size);
      }
      let anyStreak = false;
      for (let i = 0; i < STREAKS; i++) {
        const sv = streakV[i];
        const o = i * 3;
        if (sv.age >= sv.max) {
          look[o] = look[o + 1] = 0; // (no width: nothing drawn)
          continue;
        }
        sv.age = Math.min(sv.max, sv.age + dt);
        anyStreak = true;
        sv.off.addScaledVector(sv.v, dt);
        tmp.copy(ship).add(sv.off);
        head[o] = tmp.x;
        head[o + 1] = tmp.y;
        head[o + 2] = tmp.z;
        // drawn out behind its head, along the way it's going
        const grow = Math.min(1, sv.age / 0.05);
        tmp.addScaledVector(fwd.copy(sv.v).normalize(), sv.len * grow);
        tail[o] = tmp.x;
        tail[o + 1] = tmp.y;
        tail[o + 2] = tmp.z;
        look[o] = 1 - sv.age / sv.max;
        look[o + 1] = sv.width * grow; // (a sliver at first, not a block)
        look[o + 2] = sv.spark;
      }
      streaks.visible = anyStreak;
      if (anyStreak) {
        streakGeo.attributes.aHead.needsUpdate = true;
        streakGeo.attributes.aTail.needsUpdate = true;
        streakGeo.attributes.aLook.needsUpdate = true;
      }

      // the cloud deck
      if (cloud > 0.001) {
        if (!seeded) deck = ship.length();
        flat(dir, up);
        fwd.subVectors(cam.look, cam.pos).normalize();
        for (let i = 0; i < PUFFS; i++) {
          const pv = puffV[i];
          if (!pv.alive) place(pv, cam, (seeded ? rand(0.7, 1) : rand(0.05, 1)) * DECK.far);
          // rushing at the camera along the ground, over and above its own
          // speed, keeping its height (not with reduced motion: there they
          // sit where they are)
          if (!reduced) pv.p.addScaledVector(level, -DECK.rush * dt).setLength(pv.r);
          pv.age += dt;
          tmp.subVectors(pv.p, cam.pos);
          // faded right out at the lens (so its slot goes back ahead rather
          // than waiting to pass), or left out to the side where the way has
          // turned
          if (tmp.dot(fwd) < nearGone(pv.size) || Math.abs(tmp.dot(flank)) > DECK.wide * 1.6 || tmp.dot(level) > DECK.far * 1.4) {
            place(pv, cam, rand(0.7, 1) * DECK.far);
            tmp.subVectors(pv.p, cam.pos);
          }
          const o = i * 4;
          puffAt[o] = pv.p.x;
          puffAt[o + 1] = pv.p.y;
          puffAt[o + 2] = pv.p.z;
          puffAt[o + 3] = pv.size;
          // faded in as it's placed, and in from the far end
          const far = 1 - THREE.MathUtils.smoothstep(tmp.dot(level), DECK.far * 0.8, DECK.far * 1.1);
          puffLook[i * 2] = Math.min(1, pv.age / 0.4) * far;
          puffLook[i * 2 + 1] = pv.turn;
        }
        seeded = true;
        cloudMat.uniforms.uOpacity.value = cloud;
        cloudMat.uniforms.uUp.value.copy(up);
        cloudMat.uniforms.uFloor.value = ship.length() - FLOOR;
        cloudGeo.attributes.aPuff.needsUpdate = true;
        cloudGeo.attributes.aLook.needsUpdate = true;
        clouds.visible = true;
      } else if (seeded || clouds.visible) {
        // the deck's behind: the next one starts again round the camera
        for (const pv of puffV) pv.alive = false;
        seeded = false;
        clouds.visible = false;
      }

      // the white-out: a sheet just in front of the lens, facing it (placed as it's drawn: above)
      white.visible = whiteK > 0.001;
      if (white.visible) whiteMat.opacity = Math.min(1, whiteK);

      group.visible = sheath.visible || streaks.visible || clouds.visible || white.visible;
    },

    // everything gone at once
    stop() {
      clearPools();
      hideAll();
    },

    dispose() {
      hideAll();
      group.removeFromParent();
      streaks.dispose();
      clouds.dispose();
      for (const thing of [sheathGeo, sheathMat, streakGeo, streakMat, cloudGeo, cloudMat, puffTex, whiteGeo, whiteMat]) thing.dispose();
    },
  };
}
