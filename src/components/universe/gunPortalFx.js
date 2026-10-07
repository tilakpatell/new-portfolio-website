// The portal gun's shot, drawn (gunPortal.js has the numbers, scene.js flies
// it): a green bolt out of the cruiser's nose, then the portal splatting open
// where it lands, upright across the way the ship's flying (not turned to
// the camera: it's a door, flown through), the show's swirl
// (rickmorty/swirl.js's portal()) on both faces, a green haze round it, a
// ring of goo thrown off as it opens, and flecks spiralling in. All shaders.
//
// createGunPortal(parent) → { fire(ship), update(dt), shut(), spot, age, open, dispose() }

import * as THREE from 'three';
import { GUN, gunOpen, gunSpot } from './gunPortal';
import { SWIRL_GLSL } from '../rickmorty/swirl';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const PAD = 1.35; // the swirl's square, past its rim (the haze and the lumps)
const SWIRL_FRAG = `
uniform float uTime;
uniform float uOpen;
uniform float uSeed;
varying vec2 vUv;
${SWIRL_GLSL}
void main() {
  vec4 c = portal((vUv * 2.0 - 1.0) * ${PAD.toFixed(2)}, uTime, uOpen, uSeed);
  if (c.a < 0.004) discard;
  gl_FragColor = vec4(c.rgb * 1.5, c.a);
  #include <colorspace_fragment>
}`;
const HAZE_FRAG = `
uniform float uOpen;
uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float a = (exp(-r * r * 6.0) * 0.5 + exp(-r * r * 22.0) * 0.35) * uOpen * (0.85 + 0.15 * sin(uTime * 2.3));
  gl_FragColor = vec4(vec3(0.4, 1.0, 0.45) * a, a);
}`;
// the goo thrown off as it splats: a ring going out and thinning
const SPLAT_FRAG = `
uniform float uK;
varying vec2 vUv;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 o = vUv * 2.0 - 1.0;
  float r = length(o);
  float a = atan(o.y, o.x);
  float lump = 0.06 * sin(a * 7.0 + 1.3) + 0.04 * sin(a * 13.0);
  float at = mix(0.35, 0.95, uK) + lump * uK;
  float w = mix(0.1, 0.02, uK);
  float c = smoothstep(w, 0.0, abs(r - at)) * (1.0 - uK);
  // and drops flung off it
  for (int i = 0; i < 10; i++) {
    float f = float(i);
    float aa = h(f * 4.7) * 6.2832;
    vec2 p = vec2(cos(aa), sin(aa)) * (at + 0.05 + h(f) * 0.12 * uK);
    c += exp(-dot(o - p, o - p) * 900.0) * (1.0 - uK);
  }
  gl_FragColor = vec4(vec3(0.6, 1.0, 0.35) * c, c);
}`;
// the bolt: a hot core in a green glow, long along its way
const BOLT_FRAG = `
varying vec2 vUv;
void main() {
  vec2 o = vUv * 2.0 - 1.0;
  float d = length(vec2(o.x, o.y * 0.22));
  float c = exp(-d * d * 7.0);
  vec3 col = mix(vec3(0.3, 1.0, 0.35), vec3(0.95, 1.0, 0.85), exp(-d * d * 30.0));
  gl_FragColor = vec4(col * c, c);
}`;

const shader = (frag, uniforms, extra = {}) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...extra });
const glow = (frag, uniforms) => shader(frag, uniforms, { blending: THREE.AdditiveBlending, toneMapped: false });

export function createGunPortal(parent) {
  const group = new THREE.Group();
  group.name = 'gun-portal';
  group.visible = false;
  parent.add(group);

  const S = GUN.r * 2 * PAD;
  const swirlMat = shader(SWIRL_FRAG, { uTime: { value: 0 }, uOpen: { value: 0 }, uSeed: { value: 0 } }, { premultipliedAlpha: true });
  const hazeMat = glow(HAZE_FRAG, { uOpen: { value: 0 }, uTime: { value: 0 } });
  const splatMat = glow(SPLAT_FRAG, { uK: { value: 1 } });
  const boltMat = glow(BOLT_FRAG, {});
  const swirl = new THREE.Mesh(new THREE.PlaneGeometry(S, S), swirlMat);
  swirl.renderOrder = 4;
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(S * 2.6, S * 2.6), hazeMat);
  haze.renderOrder = 3;
  const splat = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.6, S * 1.6), splatMat);
  splat.renderOrder = 5;
  const door = new THREE.Group(); // the portal's own frame: +z back at the ship
  door.add(haze, swirl, splat);
  group.add(door);
  // the bolt: a quad along its way (turned about it to face the eye isn't
  // worth it: two crossed quads read from anywhere)
  const boltGeo = new THREE.PlaneGeometry(1, 1);
  boltGeo.rotateX(-Math.PI / 2); // (lying along z)
  const bolt = new THREE.Group();
  const b1 = new THREE.Mesh(boltGeo, boltMat);
  const b2 = new THREE.Mesh(boltGeo, boltMat);
  b2.rotation.z = Math.PI / 2;
  bolt.add(b1, b2);
  bolt.renderOrder = 6;
  group.add(bolt);

  let spot = null;
  let from = null;
  let age = 0;
  let shutAt = null;
  let seed = 0;
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const v = new THREE.Vector3();

  return {
    // a shot from the ship as it is now: false while one's still open
    fire(ship) {
      if (spot) return false;
      spot = gunSpot(ship);
      from = [ship.x, ship.y, ship.z];
      age = 0;
      shutAt = null;
      seed = (seed + 1.618) % 7;
      swirlMat.uniforms.uSeed.value = seed;
      door.position.set(...spot.at);
      // facing back down the way it was fired (both faces are drawn)
      door.quaternion.copy(q.setFromUnitVectors(zAxis, v.set(-spot.normal[0], -spot.normal[1], -spot.normal[2])));
      group.visible = true;
      return true;
    },
    // the ship's through: it shuts now
    shut() {
      if (spot && shutAt == null) shutAt = age;
    },
    get spot() {
      return spot;
    },
    get age() {
      return age;
    },
    get open() {
      return spot ? gunOpen(age, shutAt) : 0;
    },
    // a step on; true while there's anything to draw
    update(dt) {
      if (!spot) return false;
      age += dt;
      const o = gunOpen(age, shutAt);
      if (age >= GUN.life || (shutAt != null && age >= shutAt + GUN.close)) {
        spot = null;
        group.visible = false;
        return false;
      }
      swirlMat.uniforms.uTime.value = age * 1.3;
      swirlMat.uniforms.uOpen.value = Math.min(1, o);
      hazeMat.uniforms.uOpen.value = Math.min(1, o);
      hazeMat.uniforms.uTime.value = age;
      door.scale.setScalar(Math.max(0.001, o));
      swirl.visible = o > 0.002;
      haze.visible = swirl.visible;
      // the splat's ring, in the first half second it's open
      const ks = (age - GUN.bolt) / 0.5;
      splat.visible = ks > 0 && ks < 1;
      splatMat.uniforms.uK.value = Math.max(0, Math.min(1, ks));
      splat.scale.setScalar(1 / Math.max(0.3, o)); // (thrown out past it, whatever its size)
      // the bolt, out from the nose to where it lands
      const kb = age / GUN.bolt;
      bolt.visible = kb < 1;
      if (bolt.visible) {
        const a = Math.max(0, kb - 0.35);
        const b = Math.min(1, kb + 0.05);
        const at = (k) => from.map((f, i) => f + (spot.at[i] - f) * k);
        const p0 = at(a);
        const p1 = at(b);
        const len = Math.max(0.05, Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]));
        bolt.position.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
        bolt.quaternion.copy(q.setFromUnitVectors(zAxis, v.set(...spot.normal)));
        bolt.scale.set(Math.max(0.12, len * 0.04), 1, len);
      }
      return true;
    },
    dispose() {
      parent.remove(group);
      for (const m of [swirlMat, hazeMat, splatMat, boltMat]) m.dispose();
      for (const g of [swirl.geometry, haze.geometry, splat.geometry, boltGeo]) g.dispose();
    },
  };
}
