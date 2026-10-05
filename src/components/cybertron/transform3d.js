// The transformation, in WebGL.
//
// Optimus really transforms: his cab-over truck unfolds, panel by panel, and
// stands up as the robot, and folds back down again. That's one model whose
// parts are animated through the whole change ("Bumblebee - Optimus Prime
// Transform Animation" by dioiiiii2, CC Attribution, from Sketchfab: see
// public/cc0/README.md), run forwards and backwards here.
//
// Megatron has no such model, so his change is animated here, from the two
// the site owner made for Roll out with Meshy: the seeker jet, and Megatron
// rigged. The jet stands up on its tail, turning, and thins out; he forms in
// its place folded down on his haunches, unfolds and stands, and then
// breathes (his idle clip). His fusion cannon rides his right forearm: Fire,
// and the arm comes up, the muzzle charges, and the beam goes out along it.
//
// If a model can't be had, the change is staged instead: a vehicle built
// here from plated parts flies apart while a ring of energon sweeps up and
// the Meshy statue (public/models/meshy) is there below it. Drag to turn
// the figure round.
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
  let jet3d = null; // the seeker, under a pivot that pitches it and one that spins it
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
      const mats = [];
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.material.metalness = 0.5;
        o.material.roughness = 0.4;
        o.material.alphaHash = true; // thins out grain by grain, with nothing to sort
        if (o.material.map) o.material.map.anisotropy = 8;
        mats.push(o.material);
      });
      jetModel.add(g.scene);
      jetModel.rotation.y = Math.PI / 2; // made nose to -x; turned nose-forward
      const pitch = new THREE.Group();
      pitch.add(jetModel);
      const spin = new THREE.Group();
      spin.add(pitch);
      spin.position.y = 1.25;
      for (const p of alt.parts) alt.group.remove(p.m);
      alt.parts.length = 0;
      alt.group.add(spin);
      alt.parts.push({ m: spin, home: spin.position.clone(), turn: spin.rotation.clone(), seed: 1.3 });
      jet3d = { spin, pitch, mats };
    }
  }

  // Megatron himself, rigged: his bones fold him down and stand him up, and raise the cannon
  let meg = null;
  if (jet3d) {
    const [rig, idle] = await Promise.all([
      loader.loadAsync(`${import.meta.env.BASE_URL}games/meshy/rollout/megatron.glb`).catch(() => null),
      loader.loadAsync(`${import.meta.env.BASE_URL}games/meshy/rollout/megatron-idle.glb`).catch(() => null),
    ]);
    let body = null;
    rig?.scene.traverse((o) => {
      if (o.isSkinnedMesh) body = o;
    });
    if (body) {
      const model = rig.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const k = TALL / Math.max(1e-3, box.max.y - box.min.y);
      const holder = new THREE.Group();
      holder.scale.setScalar(k);
      holder.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
      holder.add(model);
      const figure = new THREE.Group();
      figure.add(holder);
      turntable.add(figure);
      body.frustumCulled = false; // its bounds move with its bones
      const mats = [].concat(body.material);
      for (const m of mats) {
        m.metalness = 0.6;
        m.roughness = 0.38;
        m.alphaHash = true;
        if (m.map) m.map.anisotropy = 8;
      }
      const mixer = idle?.animations?.[0] ? new THREE.AnimationMixer(model) : null;
      mixer?.clipAction(idle.animations[0]).play();
      mixer?.update(0);
      turntable.updateMatrixWorld(true);
      const bones = body.skeleton.bones;
      const bone = (n) => model.getObjectByName(n);
      const stand = bones.map((b) => b.quaternion.clone());
      // turn a bone about one of the figure's own axes (x is across him), whatever the bone's are
      const [qa, qb, qc, qf] = [0, 0, 0, 0].map(() => new THREE.Quaternion());
      const ax = new THREE.Vector3();
      const turn = (b, angle, axis = 'x') => {
        if (!b || !angle) return;
        ax.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0).applyQuaternion(figure.getWorldQuaternion(qf));
        b.getWorldQuaternion(qa);
        qb.setFromAxisAngle(ax, angle).multiply(qa);
        b.parent.getWorldQuaternion(qc);
        b.quaternion.copy(qc.invert().multiply(qb));
        b.updateMatrixWorld(true);
      };
      const at = new THREE.Vector3();
      const soles = () => Math.min(...['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((n) => bone(n)?.getWorldPosition(at).y ?? 0));
      // folded down: knees up, back curled, arms in
      const floor = soles();
      turn(bone('Spine02'), 0.5);
      turn(bone('Spine'), 0.5);
      turn(bone('Head'), 0.5);
      for (const side2 of ['Left', 'Right']) {
        turn(bone(`${side2}UpLeg`), -1.7);
        turn(bone(`${side2}Leg`), 2.3);
        turn(bone(`${side2}Arm`), -0.9);
        turn(bone(`${side2}ForeArm`), -1.6);
      }
      const folded = bones.map((b) => b.quaternion.clone());
      const lift = soles() - floor; // how far folding lifts his feet: he comes down by that
      bones.forEach((b, i) => b.quaternion.copy(stand[i]));
      model.updateMatrixWorld(true);

      // the fusion cannon, along his right forearm and out past the hand
      const fore = bone('RightForeArm');
      const hand = bone('RightHand');
      const cannon = new THREE.Group();
      const muzzle = new THREE.Object3D();
      if (fore && hand) {
        const from = fore.getWorldPosition(new THREE.Vector3());
        const dir = hand.getWorldPosition(new THREE.Vector3()).sub(from);
        const len = dir.length();
        dir.normalize();
        const long = len * 2.1;
        const steel = metal(0x1d1f27, { roughness: 0.42, metalness: 0.8 });
        const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(side.energon).multiplyScalar(1.6) });
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.125, long, 16), steel);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, long * 0.34, 16), steel);
        sleeve.position.y = -long * 0.2;
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.11, 0.09, 16), steel);
        lip.position.y = long / 2;
        cannon.add(barrel, sleeve, lip);
        for (const y of [-0.02, 0.16, 0.34]) {
          const band = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.016, 8, 24).rotateX(Math.PI / 2), hot);
          band.position.y = long * y;
          cannon.add(band);
        }
        muzzle.position.y = long / 2 + 0.04;
        cannon.add(muzzle);
        // on the outside of the arm, lying along it
        const out = new THREE.Vector3(Math.sign(from.x) || -1, 0.25, 0).normalize();
        cannon.position.copy(from).addScaledVector(dir, len * 0.75).addScaledVector(out, 0.13);
        cannon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        scene.add(cannon);
        fore.attach(cannon);
      }
      alt.group.visible = true;
      meg = { figure, mats, mixer, bones, stand, folded, lift, bone, turn, muzzle, cannon, from: stand.map((q) => q.clone()), was: 0 };
    }
  }

  // the robot, cut by a plane that the scan line rides
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const robot = new THREE.Group();
  turntable.add(robot);
  let robotReady = false;
  const loaded =
    change || meg
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

  // light, drawn: a soft round glow, and a streak for rays
  const paint = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const glowTex = paint(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.13)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
  const rayTex = paint(256, 32, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 13, 256, 6);
    g.globalAlpha = 0.35;
    g.fillRect(0, 6, 256, 20);
  });
  const lit = (map, color, o = {}) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, ...o });

  // the Matrix of Leadership, in Optimus's chest: found on the model itself
  // (the front of his chest, by a ray from in front of him), so it sits on
  // him and turns with him. A core, a halo, and rays that turn slowly.
  const chest = new THREE.Vector3(0, TALL * 0.7, 0.42);
  if (change) {
    change.at(change.duration);
    change.holder.position.copy(change.to);
    turntable.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    let best = null;
    for (const h of [0.66, 0.7, 0.74]) {
      ray.set(new THREE.Vector3(0, TALL * h, 6), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(change.holder, true)[0];
      if (hit && (!best || hit.point.z > best.z)) best = hit.point;
    }
    if (best) chest.set(0, best.y, best.z + 0.05);
    change.at(0);
    change.holder.position.copy(change.from);
  }
  const matrixGroup = new THREE.Group();
  matrixGroup.position.copy(chest);
  const spark = new THREE.PointLight(0xffd27a, 0, 4.5, 1.6);
  spark.position.z = 0.25;
  const core = new THREE.Sprite(lit(glowTex, new THREE.Color(0xfff3c4).multiplyScalar(1.6)));
  const halo = new THREE.Sprite(lit(glowTex, 0xffb648));
  const blue = new THREE.Sprite(lit(glowTex, 0x7fd4ff));
  const rays = [0, 1, 2].map((i) => {
    const r = new THREE.Sprite(lit(rayTex, 0xffe0a0, { rotation: (i * Math.PI) / 3 }));
    matrixGroup.add(r);
    return r;
  });
  matrixGroup.add(spark, halo, blue, core);
  turntable.add(matrixGroup);

  // the fusion cannon's fire: a charge gathering at the muzzle, then the beam
  // (a white-hot core in a sheath of violet) out along the barrel, and the flash
  const beam = new THREE.Group();
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4e8ff).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sheathMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(side.energon).multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const LONG = 18;
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, LONG, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, LONG / 2), coreMat);
  const beamSheath = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, LONG, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, LONG / 2), sheathMat);
  const flash = new THREE.Sprite(lit(glowTex, new THREE.Color(side.energon).lerp(new THREE.Color(0xffffff), 0.55).multiplyScalar(1.8)));
  const flare = new THREE.PointLight(side.energon, 0, 7, 1.5);
  beam.add(beamCore, beamSheath, flash, flare);
  scene.add(beam);
  const muzzleAt = new THREE.Vector3();
  const aimAt = new THREE.Vector3();
  const pivot = new THREE.Vector3();

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

  const pivotQ = new THREE.Quaternion();
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
    if (meg) {
      const ss = (a, b, x) => {
        const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return u * u * (3 - 2 * u);
      };
      // the jet: up on its tail, turning, drawing in, and thinning out
      const up = ss(0.03, 0.42, t);
      jet3d.pitch.rotation.x = -up * (Math.PI / 2);
      jet3d.spin.rotation.y = up * Math.PI * 2.5;
      jet3d.spin.position.y = 1.25 + up * 0.2 + (!ctx.reduced ? Math.sin(clock * 1.3) * 0.06 * (1 - up) : 0);
      jet3d.spin.scale.setScalar(1 - 0.36 * up);
      const gone = ss(0.4, 0.62, t);
      for (const m of jet3d.mats) m.opacity = 1 - gone;
      alt.group.visible = gone < 0.999;
      // Megatron: forming where it stood, folded down; then he unfolds and stands
      const here = ss(0.38, 0.6, t);
      const rise = ss(0.56, 1, t);
      for (const m of meg.mats) m.opacity = here;
      meg.figure.visible = here > 0.001;
      meg.cannon.visible = here > 0.5;
      if (t >= 1 && meg.mixer) meg.mixer.update(Math.min(0.05, clock - meg.was));
      else {
        // (coming back down from his idle, he starts from however he was standing)
        if (meg.at === 1 && t < 1) meg.bones.forEach((b, i) => meg.from[i].copy(b.quaternion));
        const blend = ss(0.8, 1, rise);
        meg.bones.forEach((b, i) => b.quaternion.copy(meg.folded[i]).slerp(pivotQ.copy(meg.stand[i]).slerp(meg.from[i], blend), rise));
      }
      meg.at = t;
      meg.was = clock;
      meg.figure.position.y = -meg.lift * (1 - rise);
      meg.figure.scale.setScalar(0.9 + 0.1 * rise);
      // the floor answers: a ring of energon out from under him as he forms
      const moving = t > 0.001 && t < 0.999;
      const shock = ss(0.36, 0.8, t);
      scan.position.y = scanDisc.position.y = 0.03;
      scan.scale.setScalar(0.35 + shock * 1.7);
      scanMat.opacity = moving ? Math.sin(shock * Math.PI) * 0.9 : 0;
      scanDisc.material.opacity = 0;
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
      const to = mode === 'robot' && (robotReady || change || meg) ? 1 : 0;
      // Optimus's own change takes its time (a little quicker than it was animated); Megatron's is its own; the staged one is brisk
      const span = change ? change.duration / 2.3 : meg ? 2.6 : 1.25;
      if (ctx.reduced) t = to;
      else if (t !== to) t = to > t ? Math.min(1, t + dt / span) : Math.max(0, t - dt / span);
      pose();
      // the Matrix, and the cannon
      matrix += ((wantMatrix && t > 0.99 ? 1 : 0) - matrix) * Math.min(1, dt * 4);
      const beat = 0.85 + 0.15 * Math.sin(clock * 5.5);
      spark.intensity = matrix * 7 * beat;
      core.material.opacity = matrix;
      core.scale.setScalar(0.34 * (0.5 + 0.5 * matrix) * beat);
      halo.material.opacity = matrix * 0.7;
      halo.scale.setScalar(1.25 * matrix * beat);
      blue.material.opacity = matrix * 0.28;
      blue.scale.setScalar(2.1 * matrix);
      rays.forEach((r, i) => {
        r.material.opacity = matrix * (0.5 + 0.25 * Math.sin(clock * 3 + i * 2));
        r.material.rotation = (i * Math.PI) / 3 + clock * 0.22 * (i % 2 ? -1 : 1);
        r.scale.set((1.5 + 0.35 * Math.sin(clock * 2.2 + i)) * matrix, 0.16, 1);
      });
      matrixGroup.visible = matrix > 0.005;

      // the cannon: the arm comes up, the muzzle charges, the beam goes, the arm kicks and comes down
      if (fire > 0) fire = Math.max(0, fire - dt / 1.5);
      const shot = fire > 0 ? 1 - fire : -1; // 0 to 1 through the shot
      const band = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));
      const aim = shot < 0 ? 0 : band(0, 0.16, shot) * (1 - band(0.78, 1, shot));
      const charge = shot < 0 ? 0 : band(0.1, 0.3, shot) * (shot < 0.3 ? 1 : 0);
      const going = shot < 0 ? 0 : (shot >= 0.3 ? 1 : 0) * (1 - band(0.5, 0.66, shot));
      const kick = shot < 0.3 ? 0 : Math.exp(-(shot - 0.3) * 14);
      const robotNow = meg && t > 0.6;
      if (robotNow && aim > 0) {
        // (after the pose is set for this frame, so it rides on his breathing)
        meg.turn(meg.bone('RightShoulder'), -0.25 * aim);
        meg.turn(meg.bone('RightArm'), -1.28 * aim + 0.16 * kick);
        meg.turn(meg.bone('Spine'), 0.07 * kick);
      }
      // where the fire comes from, and which way it goes: the cannon's own muzzle and barrel, or the jet's nose
      turntable.rotation.y = yaw;
      turntable.updateMatrixWorld(true);
      if (robotNow) {
        meg.muzzle.getWorldPosition(muzzleAt);
        meg.cannon.getWorldPosition(pivot);
        aimAt.copy(muzzleAt).sub(pivot).normalize();
      } else if (jet3d) {
        aimAt.set(0, 0, 1).applyQuaternion(turntable.quaternion);
        muzzleAt.set(0, jet3d.spin.position.y - 0.1, 0).applyMatrix4(turntable.matrixWorld).addScaledVector(aimAt, 2.2);
      } else {
        aimAt.set(0, 0, 1).applyQuaternion(turntable.quaternion);
        muzzleAt.set(0.62, TALL * 0.5, 0.3).applyMatrix4(turntable.matrixWorld);
      }
      beam.position.copy(muzzleAt);
      beam.lookAt(pivot.copy(muzzleAt).add(aimAt));
      const flick = 0.75 + 0.25 * Math.sin(clock * 70);
      coreMat.opacity = going * flick;
      sheathMat.opacity = going * 0.5 * flick;
      beamSheath.scale.set(1 + kick * 1.6, 1 + kick * 1.6, 1);
      flash.material.opacity = Math.max(charge * 0.9, going * flick);
      flash.scale.setScalar(0.25 + charge * 0.5 + going * 0.9 + kick * 1.2);
      flare.intensity = (charge * 5 + going * 26) * flick;
      beam.visible = charge > 0 || going > 0;
      // turning: by hand, then back to a slow turn of its own
      if (!drag) {
        vel += ((ctx.reduced ? 0 : 0.16) - vel) * Math.min(1, dt * 1.4);
        yaw += vel * dt;
      }
      turntable.rotation.y = yaw;
      // the camera sits back for the vehicle and stands up for the robot
      const k = easeInOut(t);
      const wide = camera.aspect < 1 ? 1.25 : 1;
      camera.position.set((Math.random() - 0.5) * kick * 0.07, 1.5 + k * 0.25 + (Math.random() - 0.5) * kick * 0.05, (change ? 7.9 - k * 0.3 : 8.6 - k * 1.3) * wide);
      camera.lookAt(0, 0.85 + k * 0.45, 0);
      renderer.render(scene, camera);
      stage.watch(now);
      const busy = t !== to || fire > 0 || Math.abs(matrix - (wantMatrix && t > 0.99 ? 1 : 0)) > 0.01 || !!drag;
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
      meg?.mixer?.stopAllAction();
      glowTex.dispose();
      rayTex.dispose();
      disposeTree(scene);
      env.dispose();
      stage.dispose();
    },
  };
}
