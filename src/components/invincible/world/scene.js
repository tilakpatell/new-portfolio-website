// The Graysons' city in 3D, to fly about as Invincible: the land and the
// water (./ground.js), the city (./city.js), Mark (the page's HD figure,
// posed every frame by lib/three/rig: standing, walking, running, hanging
// in the air, flat out with a fist ahead, down on one knee after a hard
// landing), his father keeping an eye on the city from over downtown, and
// what flying leaves behind (./fx.js). The rules (./flight.js) say where
// he is; this draws it, with a camera behind him that pulls back and
// widens with speed and never ends up inside a building.

import * as THREE from 'three';
import { createEngine } from '../../avengers/hq/engine';
import { createFeel } from '../../avengers/hq/feel';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { CAST, asset } from '../cast';
import { buildCity } from './city';
import { createFlightFx } from './fx';
import { buildGround } from './ground';
import { buildLandmarks } from './landmarks';
import { WORLD, buildWorld, groundAt, near } from './map';

const FOV = 64;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));
const Y = new THREE.Vector3(0, 1, 0);

// the times of day: the sky, how it sits, the light, the haze, the night
export const TIMES = ['noon', 'dusk', 'night'];
const LOOK = {
  noon: { sky: 'noon', rotate: 0.6, env: 1, bg: 1, sun: 3, fill: 0.22, fog: { density: 0.00026, tint: 0.95 }, night: 0, exposure: 1 },
  dusk: { sky: 'dusk', rotate: 2.2, env: 0.62, bg: 1, sun: 2.6, sunColor: [1, 0.66, 0.4], fill: 0.16, fog: { density: 0.0003, tint: 0.7 }, night: 0.5, exposure: 1 },
  night: { sky: 'night', rotate: 0, env: 0.22, bg: 0.2, sun: 0.7, sunDir: [-0.3, 0.75, -0.4], sunColor: [0.62, 0.72, 1], fill: 0.4, fog: { density: 0.00024, color: new THREE.Color(0.05, 0.06, 0.08) }, night: 1, exposure: 1 },
};

// Down on one knee, a fist on the ground: how a hard landing ends.
const LAND = {
  thighL: [0.1, -0.3, 0.95],
  calfL: [0.05, -1, -0.05],
  footL: [0, -0.3, 1],
  thighR: [-0.1, -1, -0.2],
  calfR: [-0.05, -0.12, -1],
  footR: [0, -0.2, -1],
  armR: [-0.15, -1, 0.4],
  foreR: [-0.05, -1, 0.1],
  armL: [0.65, -0.15, -0.7],
  foreL: [0.5, 0.15, -0.85],
  torso: { pitch: 0.55, yaw: 0.1, roll: 0 },
};

// a ray against a box: how far along (0…1) it first goes in, or 1
function rayBox(o, d, b) {
  let t0 = 0;
  let t1 = 1;
  const lo = [b.x0, b.y0, b.z0];
  const hi = [b.x1, b.y1, b.z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return 1;
      continue;
    }
    let ta = (lo[a] - o[a]) / d[a];
    let tb = (hi[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return 1;
  }
  return t0;
}

export async function createInvWorld(canvas, { onLost, onSlow, calm = false } = {}) {
  const engine = createEngine(canvas, { exposure: 1, fov: FOV, near: 0.3, far: 26000, bloom: { strength: 0.5, radius: 0.5, threshold: 0.92 }, onLost, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;
  const world = buildWorld();

  const ground = buildGround(world, { small });
  const city = buildCity(world, { small });
  const landmarks = await buildLandmarks(world, city.uniforms);
  scene.add(ground.group, city.group, landmarks.group);
  // (a shadow box this big wants more bias than the HQ games' rooms)
  engine.sun.shadow.normalBias = 0.12;
  engine.sun.shadow.bias = -0.0006;

  // ── the people ──
  const [markT, omniT] = await Promise.all([loadFigure(asset(CAST.mark.file)), loadFigure(asset(CAST.omni.file))]);
  const mark = figure(markT, CAST.mark);
  const omni = figure(omniT, CAST.omni);
  for (const f of [mark, omni]) {
    f.lean = new THREE.Quaternion();
    f.snap(POSES.stand);
    scene.add(f.holder);
  }
  // Omni-Man, over downtown, hands on his hips
  const OMNI = { p: [40, 150, -60], yaw: Math.PI * 0.85 };

  const fx = createFlightFx(scene, { calm, small });
  const feel = createFeel({ calm, baseFov: FOV, offset: 0.4 });

  // ── the time of day ──
  let look = null;
  let haze = 1;
  async function setTime(name) {
    const L = LOOK[name] ?? LOOK.noon;
    if (look === L) return;
    look = L;
    scene.fog = null;
    await engine.setSky(L.sky, { rotate: L.rotate, envIntensity: L.env, bgIntensity: L.bg, sunIntensity: L.sun, sunColor: L.sunColor, sunDir: L.sunDir, fill: L.fill, fog: L.fog });
    engine.renderer.toneMappingExposure = L.exposure;
    ground.setNight(L.night);
    city.setNight(L.night);
    landmarks.setNight(L.night);
    haze = 1;
  }
  await setTime('noon');

  // ── a flyer's body: upright when still, along his flight when fast ──
  const qTmp = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion();
  const vTmp = new THREE.Vector3();
  function carry(f, p, yaw, v, dt, { lean = 1, roll = 0, lift = 0 } = {}) {
    f.holder.position.set(p[0], p[1] + f.hipHeight + lift, p[2]);
    f.holder.rotation.set(0, yaw, 0);
    const speed = Math.hypot(v[0], v[1], v[2]);
    const k = clamp((speed - 8) / 30, 0, 1) * lean;
    const dir = speed > 0.1 ? vTmp.set(v[0], v[1], v[2]).divideScalar(speed) : vTmp.copy(Y);
    dir.lerpVectors(Y, dir, k).normalize();
    qYaw.setFromAxisAngle(Y, -yaw);
    dir.applyQuaternion(qYaw); // into his own frame
    qTmp.setFromUnitVectors(Y, dir);
    if (roll) qTmp.multiply(new THREE.Quaternion().setFromAxisAngle(Y, roll));
    f.lean.slerp(qTmp, dt === 0 ? 1 : 1 - Math.exp(-8 * dt));
    f.body.quaternion.copy(f.lean);
    return k;
  }

  // ── the camera: behind him, pulled back and widened with speed ──
  const cam = { dist: 6, fov: FOV, pos: new THREE.Vector3(), at: new THREE.Vector3(), ready: false, near: 0.3 };
  const list = [];
  function placeCamera(h, yaw, pitch, speed, dt) {
    const fly = h.mode === 'air';
    const k = clamp(speed / 260, 0, 1);
    const want = h.mode === 'ground' ? 5.2 : 6.5 + k * 1.5;
    cam.dist = dt === 0 ? want : damp(cam.dist, want, 2.4, dt);
    const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const anchor = [h.p[0], h.p[1] + (fly ? 1.2 : 1.55), h.p[2]];
    // (higher over him the faster he goes, so flat out you see his back, not his boots)
    const back = [-fwd[0] * cam.dist, -fwd[1] * cam.dist + (fly ? 0.9 + k * 2.6 : 0.7), -fwd[2] * cam.dist];
    // never inside a building: stop short of the first wall behind him
    let t = 1;
    const reach = cam.dist + 2;
    for (const b of near(world, anchor[0], anchor[2], reach, list)) {
      const g = { x0: b.x0 - 0.4, x1: b.x1 + 0.4, y0: b.y0 - 0.4, y1: b.y1 + 0.4, z0: b.z0 - 0.4, z1: b.z1 + 0.4 };
      t = Math.min(t, rayBox(anchor, back, g));
    }
    t = Math.max(0.08, t);
    const pos = new THREE.Vector3(anchor[0] + back[0] * t, anchor[1] + back[1] * t, anchor[2] + back[2] * t);
    pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + 0.5, -2);
    const at = new THREE.Vector3(anchor[0] + fwd[0] * 4, anchor[1] + fwd[1] * 4, anchor[2] + fwd[2] * 4);
    if (!cam.ready || dt === 0) {
      cam.pos.copy(pos);
      cam.at.copy(at);
      cam.ready = true;
    } else {
      // tight at speed, so he stays where he is on the screen
      const r = 10 + k * 30;
      cam.pos.lerp(pos, 1 - Math.exp(-r * dt));
      cam.at.lerp(at, 1 - Math.exp(-(r + 4) * dt));
    }
    camera.position.copy(cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.at);
    // the near plane moves out as he climbs (the depth buffer goes further)
    const alt = h.p[1] - groundAt(h.p[0], h.p[2]);
    const nearWant = clamp(alt * 0.004, 0.25, 3);
    if (Math.abs(nearWant - cam.near) > 0.02) {
      cam.near = nearWant;
      camera.near = nearWant;
      camera.updateProjectionMatrix();
    }
    feel.setBaseFov(FOV + Math.pow(k, 1.2) * 16);
    feel.update(dt, camera);
    // the shadows: round him, wider the higher he is
    engine.setShadowBox(new THREE.Vector3(h.p[0], Math.max(0, h.p[1] - alt), h.p[2]), clamp(60 + alt * 0.4, 60, 360), 600 + Math.min(alt, 1500));
    // and the haze thins as the air does
    if (scene.fog?.isFogExp2 && look) {
      const thin = clamp(1 - alt / 2600, 0.3, 1);
      if (Math.abs(thin - haze) > 0.01) {
        haze = thin;
        scene.fog.density = look.fog.density * thin;
      }
    }
  }

  // ── every frame ──
  let t = 0;
  let stride = 0;
  function frame(sim, frameDt) {
    // (the QA scripts' `snap`: the camera and his pose straight to where they're going)
    const snap = Boolean(sim.snap);
    const dt = snap ? 1 : frameDt;
    t += frameDt;
    const h = sim.h;
    const speed = Math.hypot(h.v[0], h.v[1], h.v[2]);
    // what happened this frame
    for (const e of sim.events) {
      if (e.type === 'boom') {
        fx.boom(e.at, e.dir);
        feel.trauma(0.45);
        feel.punch(6);
      } else if (e.type === 'slam') {
        fx.slam(e.at, e.speed);
        feel.trauma(clamp(e.speed / 150, 0.3, 1));
      } else if (e.type === 'impact') {
        fx.impact(e.at, e.n, e.speed);
        feel.trauma(clamp(e.speed / 120, 0.4, 1));
      } else if (e.type === 'splash') fx.splash(e.at, e.speed);
      else if (e.type === 'takeoff') fx.takeoff(e.at);
    }
    sim.events.length = 0;

    // Mark
    if (h.mode === 'ground') {
      const flat = Math.hypot(h.v[0], h.v[2]);
      stride += flat * frameDt * 1.55;
      carry(mark, h.p, h.face, [0, 0, 0], dt, { lean: 0, lift: h.crouch > 0 ? -mark.hipHeight * 0.42 : 0 });
      if (h.crouch > 0) mark.pose(LAND, dt, 18);
      else if (flat > 0.3) mark.pose(POSES.stride(stride, clamp(flat / 2, 0, 1), clamp((flat - 4) / 5, 0, 1)), dt, 14);
      else mark.pose(POSES.stand, dt, 8);
    } else if (h.stun > 0) {
      carry(mark, h.p, h.face, h.v, dt, { lean: 0.4, roll: t * 9 });
      mark.pose(POSES.hurt(), dt, 14);
    } else {
      const k = carry(mark, h.p, h.face, h.v, dt, { lean: 1 });
      mark.pose(k > 0.45 ? POSES.fly() : POSES.hover(t), dt, 9);
    }

    // his father, keeping an eye on things
    const bob = Math.sin(t * 0.7) * 1.2;
    carry(omni, [OMNI.p[0], OMNI.p[1] + bob, OMNI.p[2]], OMNI.yaw, [0, 0, 0], dt, { lean: 0 });
    omni.pose(POSES.proud(), dt, 6);

    placeCamera(h, sim.yaw, sim.pitch, speed, snap ? 0 : dt);
    ground.update(t);
    city.update(t, look?.night ?? 0);
    fx.update(frameDt, camera, engine.size.h, h, speed);
    engine.render();
  }

  // where a world point is on the screen
  const project = (p) => engine.project(new THREE.Vector3(p[0], p[1], p[2]));

  return {
    engine,
    world,
    frame,
    setTime,
    project,
    resize: (w, hh) => engine.resize(w, hh),
    get lost() {
      return engine.lost;
    },
    info: () => ({ ...engine.info(), bound: WORLD.half }),
    dispose() {
      fx.dispose();
      mark.dispose();
      omni.dispose();
      engine.dispose();
    },
  };
}
