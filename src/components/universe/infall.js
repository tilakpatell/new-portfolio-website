// The fall into the Maw, drawn (maw.js has the numbers, the scene moves the
// ship): what lets you follow a ship a fraction of a unit long from far
// enough off to see the whole black hole.
//
// - A trail of light behind it in its engines' colour, paled toward blue-white
//   (it's coming round toward you fast, and the light's shifted; and it has
//   to stand out from the disk's oranges), a ribbon that always faces you,
//   thinning and fading down its tail: as the ship spirals in it draws the
//   whirlpool it's going down.
// - A glow round the ship itself, so it reads as a point of light against
//   the disk and the black.
// - Its last light: held at the horizon it reddens and fades (the trail and
//   the glow with it), and what light it gives off runs round the ring of
//   light at the shadow's edge, spreading from where it went in till it's
//   all the way round, and gone.
//
// createInfall(parent, { color, shadow, at }) → { start(), update(dt, s,
// cam, camera), clear(), dispose() }, in the parent's space (the map's).
// s is maw.js's fallAt(), or null; cam the camera's position in that space.

import * as THREE from 'three';

const POINTS = 110; // along the trail
const LIFE = 1.5; // seconds a point of it lasts
const WIDTH = 0.55; // map units, at the head
const RED = new THREE.Color(1, 0.22, 0.06);
const BLUE = new THREE.Color(0.72, 0.86, 1);

const TRAIL_VERT = `
attribute float aT;
attribute float aSide;
varying float vT;
varying float vSide;
void main() {
  vT = aT;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TRAIL_FRAG = `
uniform vec3 uColor;
uniform float uGlow;
varying float vT;
varying float vSide;
void main() {
  float core = exp(-vSide * vSide * 3.5);
  float fade = pow(1.0 - vT, 1.6) * smoothstep(0.0, 0.03, 1.0 - vT);
  vec3 col = mix(uColor, vec3(1.0), core * core * 0.6 * (1.0 - vT));
  gl_FragColor = vec4(col * core * fade * uGlow, 1.0);
  #include <colorspace_fragment>
}`;

// a quad that always faces the camera, at the object's origin
const FACING_VERT = `
uniform float uSize;
uniform float uR;
varying vec2 vC;
varying float vSil;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float d = length(mv.xyz);
  vSil = uR > 0.0 && d > uR * 1.02 ? d / sqrt(d * d - uR * uR) : 1.0;
  vC = position.xy;
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = `
uniform vec3 uColor;
uniform float uGlow;
varying vec2 vC;
void main() {
  float r = length(vC);
  float g = exp(-r * r * 9.0) * 1.6 + exp(-r * 3.2) * 0.35;
  g *= 1.0 - smoothstep(0.8, 1.0, r);
  gl_FragColor = vec4(uColor * g * uGlow, 1.0);
  #include <colorspace_fragment>
}`;
// the last light round the ring at the shadow's edge (as deepspace.js's
// photon ring sits, so the lens moves both together): from where the ship
// went in (uAngle) round both ways, uSpread wide
const RING_FRAG = `
uniform vec3 uColor;
uniform float uGlow;
uniform float uAngle;
uniform float uSpread;
uniform float uTime;
varying vec2 vC;
varying float vSil;
void main() {
  float r = length(vC) * 1.4 / vSil;
  float ring = (exp(-abs(r - 1.03) * 70.0) + exp(-abs(r - 1.03) * 14.0) * 0.18) * smoothstep(0.99, 1.02, r); // (nothing inside the shadow)
  float a = atan(vC.y, vC.x) - uAngle;
  a = abs(atan(sin(a), cos(a)));
  float arc = exp(-a * a / max(uSpread * uSpread, 1e-4));
  float flicker = 0.85 + 0.15 * sin(a * 9.0 - uTime * 14.0);
  gl_FragColor = vec4(uColor * ring * arc * flicker * uGlow, 1.0);
  #include <colorspace_fragment>
}`;

export function createInfall(parent, { color, shadow, at }) {
  const group = new THREE.Group();
  group.visible = false;
  parent.add(group);
  const own = [];
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const base = new THREE.Color(color).lerp(BLUE, 0.5);
  const tint = new THREE.Color();

  // the trail: two vertices a point, either side of it
  const pos = new Float32Array(POINTS * 2 * 3);
  const tAttr = new Float32Array(POINTS * 2);
  const side = new Float32Array(POINTS * 2);
  const index = [];
  for (let i = 0; i < POINTS; i++) {
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < POINTS - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const tA = new THREE.BufferAttribute(tAttr, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aT', tA);
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setIndex(index);
  const trailMat = new THREE.ShaderMaterial({ vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, uniforms: { uColor: { value: new THREE.Color() }, uGlow: { value: 0 } }, ...additive, side: THREE.DoubleSide });
  const trail = new THREE.Mesh(geo, trailMat);
  trail.frustumCulled = false;
  trail.renderOrder = 3;
  group.add(trail);
  own.push(geo, trailMat);

  const quad = new THREE.PlaneGeometry(2, 2);
  own.push(quad);
  const glowMat = new THREE.ShaderMaterial({ vertexShader: FACING_VERT, fragmentShader: GLOW_FRAG, uniforms: { uColor: { value: new THREE.Color() }, uGlow: { value: 0 }, uSize: { value: 1.6 }, uR: { value: 0 } }, ...additive });
  const glow = new THREE.Mesh(quad, glowMat);
  glow.frustumCulled = false;
  glow.renderOrder = 3;
  group.add(glow);
  own.push(glowMat);

  const ringMat = new THREE.ShaderMaterial({
    vertexShader: FACING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: { uColor: { value: new THREE.Color() }, uGlow: { value: 0 }, uSize: { value: shadow * 1.4 }, uR: { value: shadow }, uAngle: { value: 0 }, uSpread: { value: 0.3 }, uTime: { value: 0 } },
    ...additive,
  });
  const ring = new THREE.Mesh(quad, ringMat);
  ring.frustumCulled = false;
  ring.renderOrder = 3;
  ring.position.set(...at);
  group.add(ring);
  own.push(ringMat);

  const hist = []; // { p: Vector3, age }
  const tmp = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const view = new THREE.Vector3();
  const across = new THREE.Vector3();
  const head = new THREE.Vector3();
  const hole = new THREE.Vector3();
  let clock = 0;
  let heldFor = 0;

  return {
    start() {
      hist.length = 0;
      heldFor = 0;
      clock = 0;
      group.visible = true;
      trailMat.uniforms.uGlow.value = 0;
      glowMat.uniforms.uGlow.value = 0;
      ringMat.uniforms.uGlow.value = 0;
    },
    // s: where the ship is in its fall (maw.js), or null once it's gone
    update(dt, s, cam, camera) {
      if (!group.visible) return false;
      clock += dt;
      for (const h of hist) h.age += dt;
      while (hist.length && hist[0].age > LIFE) hist.shift();
      const red = s ? s.red : 1;
      tint.copy(base).lerp(RED, red);
      const bright = 2.3 * (1 - red * 0.4);
      if (s && !s.gone) {
        head.set(...s.at);
        const lastP = hist.at(-1)?.p;
        if (!lastP || lastP.distanceToSquared(head) > 1e-4) hist.push({ p: head.clone(), age: 0 });
        if (hist.length > POINTS) hist.shift();
        glow.position.copy(head);
      }
      const g = s ? s.glow : 0;
      trailMat.uniforms.uColor.value.copy(tint).multiplyScalar(bright);
      trailMat.uniforms.uGlow.value = g;
      glowMat.uniforms.uColor.value.copy(tint).multiplyScalar(bright * 1.3);
      glowMat.uniforms.uGlow.value = s && !s.gone ? g : 0;
      // bigger the further off it's seen from, so it always reads as a point of light
      glowMat.uniforms.uSize.value = Math.max(0.5, cam.distanceTo(glow.position) * 0.024);

      // the ribbon, newest first, turned to face the camera
      const n = hist.length;
      for (let i = 0; i < POINTS; i++) {
        const k = Math.min(i, Math.max(0, n - 1));
        const h = hist[n - 1 - k];
        const t = n > 1 ? Math.min(1, k / (n - 1)) : 1;
        if (!h) {
          pos.fill(0, i * 6, i * 6 + 6);
          tAttr[i * 2] = tAttr[i * 2 + 1] = 1;
          continue;
        }
        const a = hist[Math.min(n - 1, n - k)]?.p ?? h.p;
        const b = hist[Math.max(0, n - 2 - k)]?.p ?? h.p;
        tan.subVectors(a, b);
        if (tan.lengthSq() < 1e-10) tan.set(1, 0, 0);
        view.subVectors(cam, h.p);
        across.crossVectors(tan, view).normalize();
        const w = Math.max(WIDTH * (0.4 + 0.6 * Math.min(1, view.length() / 40)), view.length() * 0.0085) * (1 - t) ** 0.7; // (wider seen from further off)
        tmp.copy(h.p).addScaledVector(across, -w);
        pos.set([tmp.x, tmp.y, tmp.z], i * 6);
        tmp.copy(h.p).addScaledVector(across, w);
        pos.set([tmp.x, tmp.y, tmp.z], i * 6 + 3);
        tAttr[i * 2] = tAttr[i * 2 + 1] = t;
      }
      posAttr.needsUpdate = true;
      tA.needsUpdate = true;

      // its last light round the ring, once it's held at the horizon
      if (s?.held || !s) heldFor += dt;
      const flash = heldFor > 0 ? Math.min(1, heldFor / 0.18) * Math.exp(-Math.max(0, heldFor - 0.18) * 1.9) : 0;
      ringMat.uniforms.uGlow.value = flash;
      ringMat.uniforms.uSpread.value = 0.35 + Math.min(3.2, heldFor * 2.6);
      ringMat.uniforms.uColor.value.copy(tint).multiplyScalar(3.2);
      ringMat.uniforms.uTime.value = clock;
      if (s && camera) {
        // where it went in, round the hole as seen from here
        group.updateWorldMatrix(true, false);
        head.set(...s.at).applyMatrix4(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        hole.copy(ring.position).applyMatrix4(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        ringMat.uniforms.uAngle.value = Math.atan2(head.y - hole.y, head.x - hole.x);
      }
      return true;
    },
    clear() {
      group.visible = false;
      hist.length = 0;
    },
    dispose() {
      parent.remove(group);
      for (const x of own) x.dispose();
    },
  };
}
