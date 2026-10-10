// The Force push the game's way: Luke's half-sphere (the 2017 drop's
// forcefronthalfsphere, ./gameLook's `force.push`) flung out from the
// hand along the push and fading as it goes, drawn as a rim of light
// (bright where it is seen edge on, clear through the middle), and for a
// pull the same drawn in. A few pooled, one draw each while they play.
// Null look (the bucket hadn't it): `push` returns false and the scene's
// own rush of dust stands alone.
//
// createPush(parent) → { ready: Promise, push(from, dir, { colour, pull, reach }) → bool, update(dt), dispose() }

import * as THREE from 'three';
import { loadLookMesh } from './gameLook';

const LIFE = 0.45; // s
const POOL = 3;

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColour;
uniform float uAge;
varying vec3 vN;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.0);
  float k = 1.0 - uAge;
  // (never over the bloom's threshold: a wave of air, not a light)
  gl_FragColor = vec4(uColour * rim * k * k * 0.8, 1.0);
}`;

export function createPush(parent) {
  const group = new THREE.Group();
  group.name = 'fx-push';
  parent.add(group);
  const pool = [];
  let geo = null;
  const ready = loadLookMesh('force.push')
    .then((gltf) => {
      if (!gltf) return false;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (o.isMesh && !geo) geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      });
      if (!geo) return false;
      // (the dome's base at its origin, 1 across: its own is 3.1 m)
      geo.computeBoundingBox();
      const r = Math.max(geo.boundingBox.max.x, geo.boundingBox.max.y) || 1;
      geo.scale(1 / r, 1 / r, 1 / r);
      for (let i = 0; i < POOL; i++) {
        const u = { uColour: { value: new THREE.Color() }, uAge: { value: 1 } };
        const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 7;
        group.add(mesh);
        pool.push({ mesh, u, age: 1, pull: false, reach: 4 });
      }
      return true;
    })
    .catch(() => false);
  const Z = new THREE.Vector3(0, 0, 1);
  const d = new THREE.Vector3();
  let next = 0;

  return {
    ready,
    // `from` the hand, `dir` the way (Vector3s); `reach` how far it goes (m)
    push(from, dir, { colour = '#c8d8ff', pull = false, reach = 4 } = {}) {
      if (!pool.length) return false;
      const p = pool[next++ % pool.length];
      p.mesh.position.copy(from);
      p.mesh.quaternion.setFromUnitVectors(Z, d.copy(dir).normalize());
      p.u.uColour.value.set(colour);
      Object.assign(p, { age: 0, pull, reach });
      p.mesh.visible = true;
      return true;
    },
    update(dt) {
      for (const p of pool) {
        if (!p.mesh.visible) continue;
        p.age += dt / LIFE;
        if (p.age >= 1) {
          p.mesh.visible = false;
          continue;
        }
        // out fast and easing (in, for a pull), widening as it goes
        const k = p.pull ? 1 - p.age : 1 - (1 - p.age) ** 2;
        const across = 0.4 + k * p.reach * 0.35;
        p.mesh.scale.set(across, across, 0.3 + k * p.reach * 0.25);
        p.u.uAge.value = p.age;
      }
    },
    dispose() {
      group.removeFromParent();
      for (const p of pool) p.mesh.material.dispose();
      geo?.dispose();
    },
  };
}
