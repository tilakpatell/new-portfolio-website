// The Flaxans' invasion (./fight.js), drawn: the portal over the river, a
// whirl of purple that opens when they come and closes when they're beaten;
// the Flaxans themselves, small and armoured, built on the HQ kit as Think,
// Mark! builds them (aiming their arms at Mark, tumbling when knocked
// out); their bolts with a trail; and the flashes when they come through,
// fire, are hit.

import * as THREE from 'three';
import { hot } from '../../avengers/hq/engine';
import { buildHumanoid, poseHumanoid } from '../../avengers/hq/kit/humanoid';
import { FIGHT, PORTAL } from './fight';

const FLAX = 0xd04dff;
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function portalMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float r = length(vUv) / max(0.001, uOpen);
        if (r > 1.0) discard;
        float a = atan(vUv.y, vUv.x);
        float s = a - uTime * 0.6 + 2.2 / (r + 0.3);
        float n = noise(vec2(cos(s), sin(s)) * 3.0 + r * 5.0 - uTime * 0.5) * 0.65 + noise(vec2(s * 2.0, r * 9.0 - uTime)) * 0.35;
        vec3 col = mix(vec3(0.03, 0.0, 0.06), mix(vec3(0.35, 0.05, 0.6), vec3(1.6, 0.6, 2.0), n * n), smoothstep(0.1, 0.95, r) * (0.3 + n * 0.7));
        float rim = smoothstep(0.75, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        col += vec3(1.8, 0.7, 2.4) * rim * (1.6 + n * 2.0);
        gl_FragColor = vec4(col, smoothstep(1.0, 0.93, r));
      }`,
  });
}

export function createFlaxans(scene, vfx, { calm = false } = {}) {
  const group = new THREE.Group();
  group.name = 'flaxans';
  scene.add(group);

  // the portal, facing downtown
  const portal = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.r, 72), portalMaterial());
  portal.position.set(...PORTAL.p);
  portal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(PORTAL.n));
  portal.renderOrder = 4;
  portal.visible = false;
  group.add(portal);
  let open = 0;

  // the Flaxans: small, armoured, purple, something glowing on their arms
  const mats = {
    armour: new THREE.MeshStandardMaterial({ color: 0x4b3a78, metalness: 0.65, roughness: 0.38 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x8b8fa8, roughness: 0.65 }),
    glow: new THREE.MeshBasicMaterial({ color: hot(FLAX, 2.6), toneMapped: false }),
  };
  const foes = Array.from({ length: FIGHT.count }, () => {
    const h = buildHumanoid({ style: 'chitauri', materials: mats, scale: 0.74 });
    const holder = new THREE.Group();
    h.root.position.y = -0.95 * 0.74; // the hips at the holder
    holder.add(h.root);
    holder.visible = false;
    group.add(holder);
    return { h, holder, spin: 0 };
  });

  // their bolts
  const MAX = 48;
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ color: hot(FLAX, 3.2), toneMapped: false }), MAX);
  bolts.frustumCulled = false;
  bolts.count = 0;
  group.add(bolts);
  const m4 = new THREE.Matrix4();

  return {
    group,
    // what just happened, as flashes and sparks
    fx(e) {
      if (e.type === 'spawn') vfx.ring(V(e.at), { color: FLAX, from: 0.5, to: 5, life: 0.4, normal: V(PORTAL.n) });
      else if (e.type === 'ko') {
        vfx.sparks(V(e.at), { count: 34, speed: 16, color: 0xffd0ff, to: FLAX, dir: V(e.dir), spread: 0.7, life: 0.6 });
        vfx.debris(V(e.at), { count: 8, speed: 12, size: 0.14, dir: V(e.dir), spread: 0.6, color: 0x4b3a78 });
        vfx.flash(V(e.at), { color: 0xe7a6ff, intensity: 25, distance: 18, life: 0.15 });
        vfx.ring(V(e.at), { color: 0xffffff, from: 0.3, to: 4, life: 0.25, normal: V(e.dir) });
      } else if (e.type === 'down') vfx.smoke(V(e.at), { size: 1.6, count: 3, life: 1.6, color: 0x6a4a8a, to: 0x9a8aa8, rise: 1 });
      else if (e.type === 'hurt') vfx.sparks(V(e.at), { count: 22, speed: 9, color: 0xffffff, to: FLAX, life: 0.4 });
      else if (e.type === 'won') vfx.ring(V(PORTAL.p), { color: FLAX, from: PORTAL.r, to: PORTAL.r * 3, life: 0.9, normal: V(PORTAL.n) });
    },
    update(f, dt, t, hero) {
      // the portal opens with the invasion, and closes after it
      open += ((f.on ? 1 : 0) - open) * (1 - Math.exp(-(f.on ? 1.5 : 3) * dt));
      portal.visible = open > 0.01;
      portal.material.uniforms.uOpen.value = open;
      portal.material.uniforms.uTime.value = t;
      const chest = V([hero.p[0], hero.p[1] + 1, hero.p[2]]);
      f.foes.forEach((e, i) => {
        const v = foes[i];
        const show = e.state === 'fight' || e.state === 'ko';
        v.holder.visible = show;
        if (!show) return;
        v.holder.position.set(...e.p);
        if (e.state === 'ko') {
          v.spin += dt * 9;
          v.holder.rotation.set(v.spin, v.spin * 0.6, 0);
          poseHumanoid(v.h, { t, mode: 'hover', flinch: 1 });
        } else {
          // facing him, arm up at him when he's in range
          const d = chest.clone().sub(v.holder.position);
          v.holder.rotation.set(0, Math.atan2(d.x, d.z), 0);
          poseHumanoid(v.h, { t: t + i, mode: 'hover', aim: d.length() < FIGHT.range ? 1 : 0.3, lean: Math.min(1, Math.hypot(...e.v) / 20) * 0.6 });
        }
      });
      bolts.count = Math.min(MAX, f.bolts.length);
      for (let i = 0; i < bolts.count; i++) {
        const b = f.bolts[i];
        bolts.setMatrixAt(i, m4.makeTranslation(...b.p));
        if (!calm) vfx.trail(V(b.p), { size: 0.75, life: 0.25, color: 0xe070ff, to: 0x300060, a: 0.7 });
      }
      bolts.instanceMatrix.needsUpdate = true;
    },
  };
}
