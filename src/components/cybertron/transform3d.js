// The transformation, in WebGL.
//
// Optimus really transforms: his cab-over truck unfolds, panel by panel, and
// stands up as the robot, and folds back down again. That's one model whose
// parts are animated through the whole change ("Bumblebee - Optimus Prime
// Transform Animation" by dioiiiii2, CC Attribution, from Sketchfab: see
// public/cc0/README.md), run forwards and backwards here.
//
// Megatron has no such model, so his is staged: his jet is built here from
// plated parts, the robot is the Meshy model the site owner made
// (public/models/meshy), and between them the jet's parts fly apart while a
// ring of energon sweeps up and the robot is there below it. Optimus falls
// back to the same staging (with a truck built from parts) if his model
// can't be had. Drag to turn the figure round.
//
// `mode` is 'alt' or 'robot'; `matrix` opens the Matrix of Leadership in
// Optimus's chest; `firing` fires Megatron's fusion cannon.
//
// A lib/three/useScene scene: create(canvas, ctx) → { resize, render, update, dispose }.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRenderer, disposeTree, easeInOut } from '../../lib/three/renderer';

const SIDES = {
  autobot: { model: 'optimus-prime', energon: 0x4fd8ff, rim: 0x2fbfff, key: 0xfff1dc },
  decepticon: { model: 'megatron', energon: 0xb478ff, rim: 0xff465a, key: 0xe9dcff },
};
const TALL = 2.5; // the robot's height in the scene

const metal = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.32, ...o });

// Parts: each a mesh with a home in the vehicle. `part(geo, mat, x, y, z)`.
function builder() {
  const group = new THREE.Group();
  const parts = [];
  const part = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    group.add(m);
    parts.push({ m, home: m.position.clone(), turn: m.rotation.clone(), seed: parts.length * 2.399 });
    return m;
  };
  return { group, parts, part };
}

// Optimus's truck: a red cab-over, blue behind, chrome grille, tanks and stacks.
function truck() {
  const { group, parts, part } = builder();
  const red = metal(0xc8102e);
  const blue = metal(0x1f4fa8);
  const chrome = metal(0xd9dde3, { metalness: 1, roughness: 0.12 });
  const dark = metal(0x14171c, { metalness: 0.3, roughness: 0.6 });
  const glass = metal(0x2f6fb5, { metalness: 0.4, roughness: 0.06, emissive: 0x123f73, emissiveIntensity: 0.5 });
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c4).multiplyScalar(2.2) });
  const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa01e).multiplyScalar(2) });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // the cab: lower body, upper body with the windscreen, roof
  part(B(1.5, 0.62, 1.05), red, 0, 0.92, 0.95);
  part(B(1.5, 0.6, 0.9), red, 0, 1.52, 0.88);
  part(B(1.42, 0.1, 0.94), red, 0, 1.86, 0.88);
  for (const s of [-1, 1]) {
    part(B(0.6, 0.42, 0.04), glass, s * 0.36, 1.56, 1.345);
    part(B(0.04, 0.34, 0.5), glass, s * 0.752, 1.56, 0.98);
    part(B(0.22, 0.14, 0.06), lamp, s * 0.52, 0.72, 1.49);
    part(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 12), chrome, s * 0.82, 1.75, 0.36); // stacks
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), chrome, s * 0.72, 0.52, -0.05, [Math.PI / 2, 0, 0]); // tanks
  }
  for (let i = -2; i <= 2; i++) part(B(0.07, 0.07, 0.06), amber, i * 0.28, 1.95, 1.3);
  // the grille, bar by bar, and the bumper
  for (let i = 0; i < 7; i++) part(B(0.07, 0.5, 0.05), chrome, -0.39 + i * 0.13, 0.95, 1.49);
  part(B(1.62, 0.18, 0.16), chrome, 0, 0.5, 1.5);
  // the chassis and the fifth wheel, in blue
  part(B(1.1, 0.26, 2.3), blue, 0, 0.62, -0.75);
  part(B(1.3, 0.1, 1.2), blue, 0, 0.8, -1.1);
  part(B(0.9, 0.08, 0.7), dark, 0, 0.88, -1.15);
  // six wheels, with hubs
  const tyre = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 24);
  const hub = new THREE.CylinderGeometry(0.17, 0.17, 0.32, 12);
  for (const z of [0.95, -0.85, -1.55])
    for (const s of [-1, 1]) {
      part(tyre, dark, s * 0.72, 0.36, z, [0, 0, Math.PI / 2]);
      part(hub, chrome, s * 0.72, 0.36, z, [0, 0, Math.PI / 2]);
    }
  group.position.y = 0;
  return { group, parts, length: 3.4 };
}

// Megatron's jet: a Cybertronian wedge, swept wings, twin fins, one cannon.
function jet() {
  const { group, parts, part } = builder();
  const steel = metal(0x8a8f9c);
  const darks = metal(0x2a2c35, { roughness: 0.5 });
  const purple = metal(0x6b2fa0);
  const glass = metal(0xff5a6e, { metalness: 0.2, roughness: 0.08, emissive: 0xa0122a, emissiveIntensity: 0.9 });
  const burn = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb478ff).multiplyScalar(2.6) });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const y = 1.25;
  part(B(0.6, 0.36, 2.4), steel, 0, y, 0); // fuselage
  part(new THREE.ConeGeometry(0.3, 1.2, 4), steel, 0, y, 1.8, [Math.PI / 2, Math.PI / 4, 0]); // nose
  part(B(0.34, 0.18, 0.7), glass, 0, y + 0.22, 0.75);
  for (const s of [-1, 1]) {
    part(B(1.5, 0.07, 0.95), darks, s * 1.0, y - 0.02, -0.3, [0, s * -0.42, s * 0.05]); // wings
    part(B(0.9, 0.05, 0.4), purple, s * 1.25, y + 0.02, -0.52, [0, s * -0.42, s * 0.05]);
    part(B(0.06, 0.6, 0.6), darks, s * 0.34, y + 0.4, -1.0, [0, 0, s * -0.3]); // fins
    part(B(0.3, 0.3, 0.9), steel, s * 0.42, y - 0.06, -0.85); // engines
    part(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 12), burn, s * 0.42, y - 0.06, -1.33, [Math.PI / 2, 0, 0]);
  }
  part(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 12), darks, 0, y - 0.3, 0.7, [Math.PI / 2, 0, 0]); // the fusion cannon
  part(new THREE.CylinderGeometry(0.15, 0.15, 0.24, 12), purple, 0, y - 0.3, 1.4, [Math.PI / 2, 0, 0]);
  return { group, parts, length: 4.2, hover: true };
}

export async function create(canvas, ctx) {
  const stage = createRenderer(canvas, { alpha: true, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.1, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = stage;
  renderer.localClippingEnabled = true;
  const side = SIDES[ctx.side] ?? SIDES.autobot;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0x9fb6d8, 0x0b0f18, 0.7));
  const key = new THREE.DirectionalLight(side.key, 2.4);
  key.position.set(2.5, 4.5, 4);
  const rim = new THREE.DirectionalLight(side.rim, 3.2);
  rim.position.set(-3, 2.2, -4);
  scene.add(key, rim);

  // the floor: a disc of dark plate with a ring of energon round it
  const energon = new THREE.Color(side.energon);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64).rotateX(-Math.PI / 2), metal(0x0b0f16, { metalness: 0.9, roughness: 0.42 }));
  const ringMat = new THREE.MeshBasicMaterial({ color: energon.clone().multiplyScalar(1.8), transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.42, 2.5, 96).rotateX(-Math.PI / 2), ringMat);
  ring.position.y = 0.005;
  scene.add(floor, ring);

  // the figure turns as one
  const turntable = new THREE.Group();
  scene.add(turntable);
  const alt = ctx.side === 'decepticon' ? jet() : truck();
  turntable.add(alt.group);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // Optimus, animated through the whole change: stood on the floor at the
  // robot's height, the truck and the robot each centred on the turntable
  let change = null;
  if (ctx.side !== 'decepticon') {
    const g = await loader.loadAsync(`${import.meta.env.BASE_URL}models/sketchfab/optimus-transform.glb`).catch(() => null);
    const clipA = g?.animations?.[0];
    if (clipA) {
      const mixer = new THREE.AnimationMixer(g.scene);
      const action = mixer.clipAction(clipA);
      action.play();
      action.paused = true;
      const at = (sec) => {
        action.time = Math.max(0, Math.min(clipA.duration - 1e-3, sec));
        mixer.update(0);
        g.scene.updateMatrixWorld(true);
      };
      const boxAt = (sec) => {
        at(sec);
        return new THREE.Box3().setFromObject(g.scene);
      };
      const robotBox = boxAt(clipA.duration);
      const truckBox = boxAt(0);
      const k = TALL / Math.max(1e-3, robotBox.max.y - robotBox.min.y);
      const mid = (b) => new THREE.Vector3(-((b.min.x + b.max.x) / 2) * k, -b.min.y * k, -((b.min.z + b.max.z) / 2) * k);
      const holder = new THREE.Group();
      holder.scale.setScalar(k);
      holder.add(g.scene);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false; // its parts travel a long way from where they start
        if (o.material.map) o.material.map.anisotropy = 8;
      });
      turntable.add(holder);
      alt.group.visible = false;
      change = { at, duration: clipA.duration, holder, from: mid(truckBox), to: mid(robotBox), mixer };
    }
  }

  // Megatron's jet: the seeker the site owner made for Roll out, in place of the one built from parts
  if (ctx.side === 'decepticon') {
    const g = await loader.loadAsync(`${import.meta.env.BASE_URL}games/meshy/rollout/seeker.glb`).catch(() => null);
    if (g) {
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene);
      const size = box.getSize(new THREE.Vector3());
      const k = 4.2 / Math.max(size.x, size.z, 1e-3);
      const jetModel = new THREE.Group();
      g.scene.scale.setScalar(k);
      g.scene.position.set(-((box.min.x + box.max.x) / 2) * k, -((box.min.y + box.max.y) / 2) * k, -((box.min.z + box.max.z) / 2) * k);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.material.metalness = 0.5;
        o.material.roughness = 0.4;
        if (o.material.map) o.material.map.anisotropy = 8;
      });
      jetModel.add(g.scene);
      jetModel.rotation.y = Math.PI / 2; // made nose to -x; turned nose-forward
      jetModel.position.y = 1.25;
      for (const p of alt.parts) alt.group.remove(p.m);
      alt.parts.length = 0;
      alt.group.add(jetModel);
      alt.parts.push({ m: jetModel, home: jetModel.position.clone(), turn: jetModel.rotation.clone(), seed: 1.3 });
    }
  }

  // the robot, cut by a plane that the scan line rides
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const robot = new THREE.Group();
  turntable.add(robot);
  let robotReady = false;
  const loaded = change
    ? null
    : await loader.loadAsync(`${import.meta.env.BASE_URL}models/meshy/${side.model}.glb`).then(
        (g) => g.scene,
        () => null,
      );
  if (loaded) {
    loaded.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(loaded);
    const size = box.getSize(new THREE.Vector3());
    const k = TALL / Math.max(size.y, 1e-6);
    loaded.scale.setScalar(k);
    loaded.position.set((-(box.min.x + box.max.x) / 2) * k, -box.min.y * k, (-(box.min.z + box.max.z) / 2) * k);
    loaded.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      o.material = new THREE.MeshStandardMaterial({ map: src.map ?? null, color: src.color ?? 0xffffff, metalness: 0.55, roughness: 0.4, clippingPlanes: [clip] });
      if (o.material.map) o.material.map.anisotropy = 8;
      src.dispose();
    });
    robot.add(loaded);
    robotReady = true;
  }

  // the scan line: a ring of energon at the height of the cut, and its glow
  const scanMat = new THREE.MeshBasicMaterial({ color: energon.clone().multiplyScalar(3), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const scan = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.28, 64).rotateX(-Math.PI / 2), scanMat);
  const scanDisc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: energon, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  scene.add(scan, scanDisc);

  // the Matrix in Optimus's chest, and Megatron's cannon
  const spark = new THREE.PointLight(0xffe7a0, 0, 5, 1.4);
  spark.position.set(0, TALL * 0.7, 0.42);
  const sparkGlow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd98a).multiplyScalar(1.6), transparent: true, opacity: 0 }));
  sparkGlow.position.copy(spark.position);
  turntable.add(spark, sparkGlow);
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc9a0ff).multiplyScalar(3.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 9, 12).rotateX(Math.PI / 2).translate(0, 0, 4.5), boltMat);
  turntable.add(bolt);

  // where things are
  let mode = ctx.mode === 'robot' ? 'robot' : 'alt';
  let t = mode === 'robot' ? 1 : 0; // 0 the vehicle, 1 the robot
  let matrix = 0;
  let wantMatrix = false;
  let fire = 0;
  let clock = 0;
  let yaw = -0.55;
  let vel = 0;
  let drag = null;
  let visible = true;
  const v = new THREE.Vector3();

  const el = ctx.el;
  const down = (e) => {
    drag = { x: e.clientX, id: e.pointerId, at: performance.now() };
    el.setPointerCapture?.(e.pointerId);
    ctx.invalidate();
  };
  const move = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const now = performance.now();
    const turn = ((e.clientX - drag.x) / Math.max(160, el.clientWidth)) * Math.PI * 1.6;
    yaw += turn;
    vel = turn / Math.max(0.008, (now - drag.at) / 1000);
    drag.x = e.clientX;
    drag.at = now;
    ctx.invalidate();
  };
  const up = (e) => {
    if (drag?.id === e.pointerId) drag = null;
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.style.touchAction = 'pan-y';
  el.style.cursor = 'grab';

  function pose() {
    if (change) {
      // the real thing: run the change to where `t` says, and keep the figure over the middle
      change.at(t * change.duration);
      change.holder.position.lerpVectors(change.from, change.to, easeInOut(t));
      alt.group.visible = false;
      robot.visible = false;
      scanMat.opacity = 0;
      scanDisc.material.opacity = 0;
      const moving = t > 0.001 && t < 0.999;
      ringMat.opacity = 0.55 + (moving ? 0.45 * Math.sin(clock * 18) ** 2 : 0.2 * Math.sin(clock * 1.6) ** 2);
      return;
    }
    const k = easeInOut(t);
    // the vehicle's parts: out along their own direction, tumbling, shrinking away
    const away = Math.min(1, k * 1.6);
    for (const p of alt.parts) {
      v.copy(p.home).setY(p.home.y - 0.9).normalize();
      const reach = 1.1 + (Math.sin(p.seed * 3.1) * 0.5 + 0.5) * 1.2;
      p.m.position.copy(p.home).addScaledVector(v, away * reach);
      p.m.position.y += Math.sin(away * Math.PI) * 0.5;
      p.m.rotation.set(p.turn.x + away * (2 + Math.sin(p.seed) * 3), p.turn.y + away * (1.5 + Math.cos(p.seed * 1.7) * 3), p.turn.z + away * Math.sin(p.seed * 2.3) * 3);
      p.m.scale.setScalar(Math.max(0.001, 1 - Math.max(0, away - 0.35) / 0.65));
    }
    alt.group.visible = away < 0.999;
    alt.group.position.y = alt.hover && !ctx.reduced ? Math.sin(clock * 1.3) * 0.06 * (1 - away) : 0;
    // the robot: there below the scan line, which climbs as the parts clear
    const rise = Math.max(0, Math.min(1, (k - 0.25) / 0.75));
    const h = rise * (TALL + 0.1);
    clip.constant = h;
    robot.visible = robotReady && rise > 0.001;
    const moving = t > 0.001 && t < 0.999;
    scan.position.y = scanDisc.position.y = h;
    scanMat.opacity = moving ? Math.sin(Math.min(1, rise * 1.05) * Math.PI) * 0.95 + (rise > 0 && rise < 1 ? 0.25 : 0) : 0;
    scanDisc.material.opacity = scanMat.opacity * 0.12;
    ringMat.opacity = 0.55 + (moving ? 0.45 * Math.sin(clock * 18) ** 2 : 0.2 * Math.sin(clock * 1.6) ** 2);
  }

  return {
    resize(w, h) {
      stage.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    setVisible(on) {
      visible = on;
    },
    update(p) {
      mode = p.mode === 'robot' ? 'robot' : 'alt';
      wantMatrix = !!p.matrix && ctx.side !== 'decepticon';
      if (p.firing && fire <= 0 && ctx.side === 'decepticon') fire = 1;
    },
    render(ms, now) {
      if (stage.lost) return false;
      const dt = Math.min(0.05, ms / 1000);
      clock += dt;
      const to = mode === 'robot' && (robotReady || change) ? 1 : 0;
      // Optimus's own change takes its time (a little quicker than it was animated); the staged one is brisk
      const span = change ? change.duration / 2.3 : 1.25;
      if (ctx.reduced) t = to;
      else if (t !== to) t = to > t ? Math.min(1, t + dt / span) : Math.max(0, t - dt / span);
      pose();
      // the Matrix, and the cannon
      matrix += ((wantMatrix && t > 0.99 ? 1 : 0) - matrix) * Math.min(1, dt * 5);
      spark.intensity = matrix * (9 + Math.sin(clock * 9) * 1.5);
      sparkGlow.material.opacity = matrix;
      sparkGlow.scale.setScalar(0.6 + matrix * (0.9 + Math.sin(clock * 7) * 0.12));
      if (fire > 0) fire = Math.max(0, fire - dt / 1.1);
      boltMat.opacity = fire > 0 ? Math.min(1, fire * 3) * (0.6 + 0.4 * Math.sin(clock * 60)) : 0;
      bolt.position.set(t > 0.5 ? 0.62 : 0, t > 0.5 ? TALL * 0.5 : 0.95, t > 0.5 ? 0.3 : 1.5);
      bolt.scale.set(0.6 + fire * 0.9, 0.6 + fire * 0.9, 1);
      // turning: by hand, then back to a slow turn of its own
      if (!drag) {
        vel += ((ctx.reduced ? 0 : 0.16) - vel) * Math.min(1, dt * 1.4);
        yaw += vel * dt;
      }
      turntable.rotation.y = yaw;
      // the camera sits back for the vehicle and stands up for the robot
      const k = easeInOut(t);
      const wide = camera.aspect < 1 ? 1.25 : 1;
      camera.position.set(0, 1.5 + k * 0.25, (change ? 7.9 - k * 0.3 : 8.6 - k * 1.3) * wide);
      camera.lookAt(0, 0.85 + k * 0.45, 0);
      renderer.render(scene, camera);
      stage.watch(now);
      const busy = t !== to || fire > 0 || Math.abs(matrix - (wantMatrix ? 1 : 0)) > 0.01 || !!drag;
      return visible && (!ctx.reduced || busy);
    },
    dispose() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.style.cursor = '';
      el.style.touchAction = '';
      change?.mixer.stopAllAction();
      disposeTree(scene);
      env.dispose();
      stage.dispose();
    },
  };
}
