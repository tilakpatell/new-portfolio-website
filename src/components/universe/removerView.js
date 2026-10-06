// The NX-5 Planet Remover, drawn (remover.js has the rules, scene.js plays
// them): the Federation's crimson warship (modelled with Meshy for the Rick
// and Morty multiverse, Phase 3: its hull of dark red armour, the bulb of
// teal hexagon plates at its stern, the ring cannon at its bow), dropping
// out of warp beside the planet you're at with its nose on it, smeared long
// and thin in a flash and snapping to its shape. Its cannon charges, a
// green glow swelling at the bow inside a ring that spins up; when it
// fires, a beam runs to the planet and the planet goes dark and cracked
// for as long as it's removed. Shot down, it flickers, bursts along its
// length and is gone; otherwise it jumps away as it came.
//
// createRemoverView(parent, { small }) → { start(at, target), update(r, dt, t),
//   fire(target), hit(point), down(), leave(), spheres(), bow, busy,
//   scar(id, group, size), unscar(id), scarred(id), update…, dispose() }
// Everything is in `parent`'s space (the map's). The model loads the first
// time one comes; until it's in, a built stand-in of the same colours flies.

import * as THREE from 'three';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';

export const NX5_LEN = 42; // map units long (a fandom planet is about 50 across its middle)
const WARP = 0.7; // seconds to snap out of (or into) warp
const BEAM = 2.6; // seconds the beam's on

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// a removed planet's skin: its crust gone dark, glowing cracks across it
const SCAR_VERT = /* glsl */ `
varying vec3 vDir;
varying vec3 vN;
varying vec3 vView;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SCAR_FRAG = /* glsl */ `
uniform float uOn;
uniform float uTime;
varying vec3 vDir;
varying vec3 vN;
varying vec3 vView;
// cells over the sphere: the distance to the nearest and next-nearest seed
vec2 cells(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 h = fract(sin(vec3(dot(i + o, vec3(127.1, 311.7, 74.7)), dot(i + o, vec3(269.5, 183.3, 246.1)), dot(i + o, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
    float d = length(o + h - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}
void main() {
  vec2 c = cells(vDir * 4.5);
  float crack = 1.0 - smoothstep(0.0, 0.06, c.y - c.x);
  vec2 c2 = cells(vDir * 11.0 + 3.1);
  crack = max(crack, (1.0 - smoothstep(0.0, 0.05, c2.y - c2.x)) * 0.6);
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
  float pulse = 0.75 + 0.25 * sin(uTime * 3.0 + c.x * 9.0);
  vec3 crust = vec3(0.06, 0.05, 0.05) + vec3(0.12, 0.05, 0.02) * rim;
  vec3 col = mix(crust, vec3(1.8, 0.55, 0.12) * pulse, crack);
  gl_FragColor = vec4(col, uOn);
}`;

export function createRemoverView(parent, { small = false } = {}) {
  const owned = [];
  const keep = (x) => (owned.push(x), x);
  const root = new THREE.Group();
  root.visible = false;
  parent.add(root);
  // the ship's own frame: its bow (the cannon) along +z
  const hull = new THREE.Group();
  root.add(hull);

  // a built stand-in, the model's colours, until the model's in
  const standIn = new THREE.Group();
  {
    const red = keep(new THREE.MeshLambertMaterial({ color: 0x8a1626, emissive: 0x2a0408 }));
    const teal = keep(new THREE.MeshLambertMaterial({ color: 0x2f8a8a, emissive: 0x0a2424 }));
    const body = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.14, 0.62, 6, 16).rotateX(Math.PI / 2)), red);
    const bulb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.26, 24, 16)), teal);
    bulb.position.z = -0.34;
    const head = new THREE.Mesh(keep(new THREE.SphereGeometry(0.17, 20, 14)), red);
    head.position.z = 0.36;
    standIn.add(body, bulb, head);
    standIn.scale.setScalar(NX5_LEN);
    hull.add(standIn);
  }
  let model = null;
  let loading = null;
  const want = () => {
    loading ??= loadGLTF('/models/c137/rm/nx5.glb').then((gltf) => {
      if (!gltf?.scene) return;
      const m = cloneScene(gltf);
      m.traverse((o) => {
        if (!o.isMesh) return;
        const map = o.material.map ?? null;
        // (lit by the map's lights, its painted lights glowing a little of their own)
        o.material = keep(new THREE.MeshLambertMaterial({ map, emissive: map ? 0xffffff : 0, emissiveMap: map, emissiveIntensity: 0.38 }));
      });
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      const k = NX5_LEN / size.z;
      m.scale.setScalar(k);
      m.position.copy(c).multiplyScalar(-k);
      hull.add(m);
      hull.remove(standIn);
      model = m;
    });
  };

  // the cannon: a glow at the bow and a ring spinning round it
  const glowTex = keep(glowTexture());
  const BOW = new THREE.Vector3(0, -0.02 * NX5_LEN, 0.5 * NX5_LEN);
  const glow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0.6, 3.2, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
  glow.position.copy(BOW);
  hull.add(glow);
  const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.11 * NX5_LEN, 0.008 * NX5_LEN, 8, small ? 32 : 64)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.6, 1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  ring.position.copy(BOW);
  hull.add(ring);
  // the beam, bow to planet, and the flash it makes there
  const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 3.4, 1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
  beam.visible = false;
  parent.add(beam);
  const flash = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.6, 3.4, 4.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
  flash.visible = false;
  parent.add(flash);
  const impact = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.2, 3.6, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
  impact.visible = false;
  parent.add(impact);
  // bursts along the hull as it goes up
  const bursts = Array.from({ length: 7 }, () => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(3.2, 1.6, 0.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
    s.visible = false;
    root.add(s);
    return s;
  });

  const v = { mode: null, age: 0, beamAge: -1, hitAge: -1, target: new THREE.Vector3() };
  const tmp = new THREE.Vector3();
  const bowAt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  // turn `obj` (in parent space) so its +z points from `from` to `to`
  // (Object3D.lookAt works in the world's space, and the map turns)
  const aim = (obj, from, to) => {
    dir.subVectors(to, from).normalize();
    obj.rotation.order = 'YXZ';
    obj.rotation.set(-Math.asin(Math.max(-1, Math.min(1, dir.y))), Math.atan2(dir.x, dir.z), 0);
  };
  const bowWorld = () => bowAt.copy(BOW).applyQuaternion(root.quaternion).add(root.position);

  // a planet's removal, drawn: a dark, cracked skin over it
  const scars = new Map(); // planet id → { mesh, on }
  const scarMat = (on) => keep(new THREE.ShaderMaterial({ vertexShader: SCAR_VERT, fragmentShader: SCAR_FRAG, uniforms: { uOn: { value: on }, uTime: { value: 0 } }, transparent: true, depthWrite: false, toneMapped: false }));

  return {
    // one drops out of warp at `at`, its nose on `target` (both Vector3s, map space)
    start(at, target) {
      want();
      root.position.copy(at);
      aim(root, at, target);
      root.updateMatrix();
      v.target.copy(target);
      v.mode = 'in';
      v.age = 0;
      v.beamAge = -1;
      root.visible = true;
      hull.visible = true;
      flash.visible = true;
      flash.position.copy(at);
      for (const b of bursts) b.visible = false;
    },
    // the beam: from the bow to the planet
    fire(target) {
      v.target.copy(target);
      v.beamAge = 0;
      beam.visible = true;
      impact.visible = true;
    },
    // a hit: the hull flashes where it was struck
    hit() {
      v.hitAge = 0;
    },
    // shot down: it bursts along its length and is gone
    down() {
      v.mode = 'down';
      v.age = 0;
      bursts.forEach((b, i) => {
        b.userData.at = i / bursts.length;
        b.position.set(((i * 37) % 7) / 7 - 0.5, ((i * 53) % 5) / 5 - 0.5, (i / (bursts.length - 1) - 0.5) * 0.9).multiply(tmp.set(0.3 * NX5_LEN, 0.25 * NX5_LEN, NX5_LEN));
        b.visible = false;
      });
    },
    // it jumps away (after firing)
    leave() {
      if (v.mode === 'here' || v.mode === 'in') {
        v.mode = 'out';
        v.age = 0;
        flash.visible = true;
        flash.position.copy(root.position);
      }
    },
    // where it can be hit: its bow and its stern bulb, [{ c, r }] in map space
    spheres() {
      if (!root.visible || v.mode === 'down' || v.mode === 'out') return [];
      root.updateMatrixWorld(true);
      const f = tmp.set(0, 0, 1).applyQuaternion(root.quaternion);
      const p = root.position;
      return [
        { c: [p.x + f.x * 0.22 * NX5_LEN, p.y + f.y * 0.22 * NX5_LEN, p.z + f.z * 0.22 * NX5_LEN], r: 0.2 * NX5_LEN },
        { c: [p.x - f.x * 0.26 * NX5_LEN, p.y - f.y * 0.26 * NX5_LEN, p.z - f.z * 0.26 * NX5_LEN], r: 0.27 * NX5_LEN },
      ];
    },
    // the cannon's point, in map space (what the guns lock on to)
    get bow() {
      return bowWorld();
    },
    get busy() {
      return root.visible;
    },
    // r: remover.js's state (null once it's gone)
    update(r, dt, t) {
      for (const s of scars.values()) {
        s.mesh.material.uniforms.uTime.value = t;
        s.on += ((s.want ? 1 : 0) - s.on) * Math.min(1, dt * (s.want ? 3 : 0.8));
        s.mesh.material.uniforms.uOn.value = s.on;
        s.mesh.visible = s.on > 0.003;
      }
      if (!root.visible) return;
      v.age += dt;
      // out of warp: long and thin along its flight, snapping to its shape
      if (v.mode === 'in' || v.mode === 'out') {
        const k = Math.min(1, v.age / WARP);
        const s = v.mode === 'in' ? k : 1 - k;
        const e = 1 - (1 - s) ** 3;
        hull.scale.set(0.15 + 0.85 * e, 0.15 + 0.85 * e, 1 + (1 - e) * 7);
        flash.material.opacity = 1 - k;
        flash.scale.setScalar(NX5_LEN * (0.6 + k * 1.2));
        if (k >= 1) {
          flash.visible = false;
          if (v.mode === 'in') v.mode = 'here';
          else {
            root.visible = false;
            v.mode = null;
            return;
          }
        }
      } else hull.scale.setScalar(1);
      // the cannon, charging
      const charge = r?.phase === 'charging' ? r.charge : r?.phase === 'fired' ? Math.max(0, 1 - (v.beamAge >= 0 ? v.beamAge / BEAM : 0)) : 0;
      const pulse = 0.85 + 0.15 * Math.sin(t * (6 + charge * 18));
      glow.visible = charge > 0.01 && v.mode !== 'down';
      glow.scale.setScalar(NX5_LEN * (0.08 + charge * 0.5) * pulse);
      ring.material.opacity = Math.min(1, charge * 1.6);
      ring.rotation.z += dt * (1 + charge * 14);
      // the beam
      if (v.beamAge >= 0) {
        v.beamAge += dt;
        const from = bowWorld();
        const len = from.distanceTo(v.target);
        const k = v.beamAge / BEAM;
        beam.position.copy(from);
        aim(beam, from, v.target);
        const w = NX5_LEN * 0.07 * Math.sin(Math.min(1, k) * Math.PI) ** 0.5;
        beam.scale.set(Math.max(0.01, w), Math.max(0.01, w), len);
        beam.material.opacity = Math.max(0, 1 - k);
        impact.position.copy(from).lerp(v.target, Math.max(0, 1 - (NX5_LEN * 0.4) / len));
        impact.scale.setScalar(NX5_LEN * 2.4 * Math.sin(Math.min(1, k) * Math.PI));
        impact.material.opacity = Math.max(0, 1 - k);
        if (k >= 1) {
          v.beamAge = -1;
          beam.visible = false;
          impact.visible = false;
        }
      }
      // a hit: a flicker of the hull
      if (v.hitAge >= 0) {
        v.hitAge += dt;
        if (model) model.visible = v.hitAge > 0.12 || Math.floor(v.hitAge * 40) % 2 === 0;
        if (v.hitAge > 0.12) v.hitAge = -1;
      }
      // going up: bursts down its length, the hull flickering out
      if (v.mode === 'down') {
        const k = v.age / 3;
        bursts.forEach((b) => {
          const a = k * 1.4 - b.userData.at * 0.8;
          b.visible = a > 0 && a < 1;
          b.scale.setScalar(NX5_LEN * 0.45 * Math.sin(Math.min(1, Math.max(0, a)) * Math.PI));
        });
        hull.visible = k < 0.7 && Math.floor(v.age * 18) % 3 !== 0;
        if (k >= 1) {
          root.visible = false;
          v.mode = null;
        }
      }
    },
    // the planet `id` removed: its skin over `group` (the planet's, map
    // space), a little bigger than its `size`
    scar(id, group, size) {
      let s = scars.get(id);
      if (!s) {
        const mesh = new THREE.Mesh(keep(new THREE.SphereGeometry(size * 1.012, small ? 48 : 72, small ? 32 : 48)), scarMat(0));
        mesh.renderOrder = 2;
        group.add(mesh);
        s = { mesh, on: 0, want: true };
        scars.set(id, s);
      }
      s.want = true;
    },
    unscar(id) {
      const s = scars.get(id);
      if (s) s.want = false;
    },
    scarred: (id) => Boolean(scars.get(id)?.want),
    dispose() {
      root.removeFromParent();
      beam.removeFromParent();
      flash.removeFromParent();
      impact.removeFromParent();
      for (const s of scars.values()) s.mesh.removeFromParent();
      for (const x of owned) x.dispose?.();
    },
  };
}
