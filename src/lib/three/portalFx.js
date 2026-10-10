// What the portal gun does to someone it kills, as the show has it: a
// portal opens on the ground just behind them, tilted up at them; they're
// pulled off their feet toward its eye, tumbling (ragdoll.js over the pose
// they died in), sinking into the green as they cross its plane (the
// materials clip there, so nothing shows behind the disc); somewhere between
// the waist and the shoulders it snaps shut with a flash of the lip, and
// what was still on this side stays cut at that plane, drops to the ground
// and lies there. Nothing comes out the other side. World-agnostic: the
// universe map's foot combat and the galaxy's worlds both draw it.
//
// createPortalFx({ parent }) → { swallow(fig, opts), update(dt), dispose }
//   parent: the Object3D the portals go under; every figure swallowed must
//     be a child of it (positions are in its space, sizes in its units).
//   swallow({ root, tall, up, push, joints, ground, seed, on }) → handle
//     root: the figure's Object3D (its origin at the feet, +y its up);
//     tall: its height; up and push: unit vectors in `parent`'s space (the
//     ground's normal there, and the way the shot sent them); joints:
//     ragdoll.js's [{ obj, len }], as many as the figure has; ground(p):
//     the point on the ground under p (default: the plane through the
//     feet); on(event): 'open' as it opens, 'cut' as it shuts.
//     handle: { done (the fall's over), cut (it's shut), dispose() }.
//   update(dt): once a frame after the figures' clips have posed them (the
//     ragdoll and the swallow own the root and the joints from then on).

import * as THREE from 'three';
import { SWIRL_GLSL } from './swirl';
import { createRagdoll } from './ragdoll';

const V = THREE.Vector3;
const PAD = 1.22; // the disc is this much wider than the rim, for the haze
const OPEN = 0.22; // seconds to open
const SHUT = 0.12; // seconds to snap shut
const GRAB = 0.1; // seconds in before the pull starts
const CUT = [0.55, 0.8]; // when it shuts: seconds in, drawn between these
const TIP = 0.75; // radians the body's tipped back onto the portal by then
const BACK = 0.45; // the portal's plane, this many heights behind the feet
const WAIST = [0.46, 0.66]; // where the cut lands: this much of the way up the body
const FALL = 0.45; // seconds the remainder takes to hit the ground
const SETTLE = 1.6; // seconds the ragdoll goes on after that
const MOTES = 14;

const portalMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { t: { value: 0 }, seed: { value: 0 }, open: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, seed, open, flash;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * ${PAD.toFixed(2)}, t, open, seed);
        if (c.a < 0.004) discard;
        // the flash as it shuts: the whole disc goes to the lip's light
        c.rgb = mix(c.rgb, vec3(0.93, 1.0, 0.7) * c.a, flash);
        gl_FragColor = c;
      }`,
  });

const moteTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(190,255,140,0.8)');
  r.addColorStop(1, 'rgba(120,255,60,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const easeIn = (k) => k * k * k;
const clamp01 = (k) => Math.min(1, Math.max(0, k));

export function createPortalFx({ parent }) {
  const disc = new THREE.PlaneGeometry(1, 1);
  const motes = typeof document !== 'undefined' ? moteTexture() : null;
  const live = new Set();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _v = new V();

  function swallow({ root, tall, up, push, joints = [], ground = null, seed = Math.random() * 10, on = null }) {
    if (!root || !tall) return null;
    const U = up.clone().normalize();
    const P = push.clone().addScaledVector(U, -push.dot(U)).normalize(); // (along the ground)
    if (P.lengthSq() < 1e-6) P.copy(new V(0, 0, 1)).addScaledVector(U, -U.z).normalize();
    const axis = new V().crossVectors(U, P).normalize(); // (a tip about this tips the head toward the portal)
    const S = root.position.clone(); // the feet, at the start
    const Q = root.quaternion.clone();
    const r = tall * 0.62; // the rim's radius: a person goes through with room
    const C = S.clone().addScaledVector(P, tall * BACK).addScaledVector(U, tall * 0.42); // the eye (about the tipped body's middle)
    const cutAt = CUT[0] + Math.random() * (CUT[1] - CUT[0]);
    // how far they're dragged by the cut: enough that the plane crosses the
    // body where the cut should land, given how far it's tipped by then
    const waist = WAIST[0] + Math.random() * (WAIST[1] - WAIST[0]);
    const drag = Math.max(0.02, BACK - Math.sin(TIP) * waist) * tall;
    const underfoot = ground ?? ((p) => p.clone().addScaledVector(U, -_v.copy(p).sub(S).dot(U)));

    // the disc: facing the figure, an oval a little taller than wide
    const mat = portalMat();
    mat.uniforms.seed.value = seed;
    const mesh = new THREE.Mesh(disc, mat);
    mesh.position.copy(C);
    mesh.quaternion.setFromUnitVectors(new V(0, 0, 1), _v.copy(P).negate());
    mesh.scale.set(r * 2 * PAD * 0.88, r * 2 * PAD, 1);
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    parent.add(mesh);

    // the plane it cuts at: fixed in the world while it's open, then the
    // body's own once it's shut (the materials clip in world space)
    parent.updateWorldMatrix(true, false);
    const planeP = new THREE.Plane().setFromNormalAndCoplanarPoint(_v.copy(P).negate(), C); // (keeps the side toward the shooter)
    const plane = planeP.clone().applyMatrix4(parent.matrixWorld);
    let planeLocal = null;
    const swapped = new Map();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const own = (m) => {
        if (!swapped.has(m)) {
          const c = m.clone();
          c.clippingPlanes = [plane];
          c.clipShadows = true;
          swapped.set(m, c);
        }
        return swapped.get(m);
      };
      o.userData.portalMat = o.material;
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    });

    // the ragdoll, kicked the way the shot went
    const gW = U.clone().negate().transformDirection(parent.matrixWorld);
    const pW = P.clone().transformDirection(parent.matrixWorld);
    const rag = joints.length ? createRagdoll(joints, { gravity: gW, push: pW, kick: 10 }) : null;

    // motes of light drawn off the body into the eye
    const sprites = [];
    if (motes) {
      for (let i = 0; i < MOTES; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: motes, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true, opacity: 0 }));
        const size = tall * (0.05 + Math.random() * 0.06);
        s.scale.set(size, size, 1);
        s.userData.from = S.clone().addScaledVector(U, tall * (0.1 + Math.random() * 0.8)).addScaledVector(axis, (Math.random() - 0.5) * tall * 0.4).addScaledVector(P, (Math.random() - 0.5) * tall * 0.3);
        s.userData.at = GRAB + Math.random() * (cutAt - GRAB - 0.15);
        s.visible = false;
        parent.add(s);
        sprites.push(s);
      }
    }

    const h = {
      t: 0,
      cut: false,
      done: false,
      landed: null, // where the remainder lies, once it's shut: { at, q }
      step(dt) {
        if (this.done && (!rag || this.t > cutAt + FALL + SETTLE)) return;
        this.t += dt;
        const t = this.t;
        const u = mat.uniforms;
        u.t.value = t;
        if (!this.cut) {
          u.open.value = easeOut(clamp01(t / OPEN));
          if (t >= OPEN && !this.opened) {
            this.opened = true;
            on?.('open');
          }
          // the pull: dragged back toward the eye, faster as it takes hold,
          // and tipped over onto the portal, the feet coming up: the head and
          // shoulders go through first
          const k = clamp01((t - GRAB) / (cutAt - GRAB));
          root.position.copy(S).addScaledVector(P, drag * easeIn(k)).addScaledVector(U, tall * 0.08 * Math.sin(k * Math.PI));
          root.quaternion.copy(Q).premultiply(_q.setFromAxisAngle(axis, TIP * easeOut(k)));
          if (t >= cutAt) {
            this.cut = true;
            on?.('cut');
            root.updateWorldMatrix(true, false);
            planeLocal = plane.clone().applyMatrix4(_m.copy(root.matrixWorld).invert());
            this.landed = { from: root.position.clone(), q: root.quaternion.clone() };
            const lie = underfoot(root.position);
            this.landed.at = lie.addScaledVector(U, tall * 0.13);
            // on its back, across the way it was pulled (so it reads from where the shot came), one side or the other
            const L = axis.clone().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
            this.landed.lie = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(_v.crossVectors(L, U), L, U));
            rag?.release();
          }
        } else {
          // shut, with a flash; the remainder drops and lies on its back
          const s = clamp01((t - cutAt) / SHUT);
          u.open.value = 1 - easeIn(s);
          u.flash.value = s < 0.5 ? s * 2 : 2 - s * 2;
          if (s >= 1) mesh.visible = false;
          const f = clamp01((t - cutAt) / FALL);
          const drop = f * f;
          root.position.lerpVectors(this.landed.from, this.landed.at, drop);
          root.quaternion.slerpQuaternions(this.landed.q, this.landed.lie, easeOut(f));
          root.updateWorldMatrix(true, false);
          plane.copy(planeLocal).applyMatrix4(root.matrixWorld);
          if (f >= 1) this.done = true;
        }
        for (const s of sprites) {
          const d = s.userData;
          const k = (t - d.at) / 0.3;
          if (k < 0 || k > 1 || this.cut) {
            s.visible = false;
            continue;
          }
          s.visible = true;
          s.position.lerpVectors(d.from, C, easeIn(k));
          s.material.opacity = Math.sin(k * Math.PI);
        }
        if (rag) {
          root.updateWorldMatrix(true, true);
          rag.step(dt);
        }
      },
      dispose() {
        live.delete(h);
        parent.remove(mesh);
        mat.dispose();
        for (const s of sprites) {
          parent.remove(s);
          s.material.dispose();
        }
        rag?.dispose();
        root.traverse((o) => {
          if (o.userData.portalMat) {
            o.material = o.userData.portalMat;
            delete o.userData.portalMat;
          }
        });
        for (const m of swapped.values()) m.dispose();
        swapped.clear();
      },
    };
    live.add(h);
    return h;
  }

  return {
    swallow,
    get count() {
      return live.size;
    },
    update(dt) {
      if (!live.size) return;
      parent.updateWorldMatrix(true, false);
      for (const h of live) h.step(Math.min(dt, 0.05));
    },
    dispose() {
      for (const h of [...live]) h.dispose();
      disc.dispose();
      motes?.dispose();
    },
  };
}

// the joints a Meshy-rigged figure (the 24-bone skeleton) swings, found by
// name under `model`, with each limb's length in metres scaled by `unit`
const MESHY_JOINTS = [
  ['LeftArm', 0.28],
  ['LeftForeArm', 0.26],
  ['RightArm', 0.28],
  ['RightForeArm', 0.26],
  ['LeftUpLeg', 0.42],
  ['LeftLeg', 0.4],
  ['RightUpLeg', 0.42],
  ['RightLeg', 0.4],
  ['Spine', 0.2],
  ['neck', 0.1],
  ['Head', 0.14],
];
export function meshyJoints(model, unit = 1, tall = 1.8) {
  const k = (tall / 1.8) * unit;
  return MESHY_JOINTS.map(([n, len]) => ({ obj: model.getObjectByName(n), len: len * k })).filter((j) => j.obj);
}
