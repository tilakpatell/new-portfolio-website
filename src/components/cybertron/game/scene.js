// Cybertron's world, drawn: whichever area you're in (its stage), Optimus
// as a robot or a truck and the change between them piece by piece
// (chunks.js), the Autobots standing about and turning to look at him, the
// Decepticons closing in, the bolts, flashes and fireballs, energon lying
// about, the mission's beacon, and the chase camera. sim.js says where
// everything is; this only shows it.
//
// createGame(canvas, { tier, onLost }) → Promise<{ setArea(id), render(sim, view, dt, now),
//   events(list, sim), resize(w, h), precompile(), info(), dispose() }>
// `view` is the camera: { yaw, pitch, zoom } (GameWorld.jsx turns it).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { budget } from '../../../lib/device';
import { createPace } from '../../../lib/three/pace';
import { precompile, quiet, releaseContext } from '../../../lib/three/renderer';
import { createPost } from '../../universe/post';
import { makeFigure, makeThing } from './bots';
import { bake, centresOf, cluster, makeTransformer } from './chunks';
import { createEffects } from './effects';
import { MEGATRON, TRANSFORM } from './rules';

const STAGES = {
  iacon: () => import('./stage/iacon'),
  base: () => import('./stage/base'),
  jasper: () => import('./stage/jasper'),
};
const plainStage = () => import('./stage/plain');

const CAM = {
  robot: { dist: 21, height: 9, look: 7.5, side: 2.6, fov: 58 },
  vehicle: { dist: 25, height: 8.5, look: 3, side: 0, fov: 64 },
};

export async function createGame(canvas, { tier = 'high', onLost } = {}) {
  const B = budget(tier);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  quiet(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, B.ratio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !!B.shadows && tier === 'high';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAM.robot.fov, 1, 0.6, 9000);
  const post = createPost(renderer, scene, camera, { small: tier !== 'high' });
  const pace = createPace();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = room;
  scene.environmentIntensity = 0.45;
  const effects = createEffects(scene, { tier });

  // what's in the scene for the area you're in
  let stage = null;
  let areaId = null;
  let people = new Map(); // id → figure
  const foes = new Map(); // id → { figure, boomed }
  const player = { root: new THREE.Group(), robot: null, vehicle: null, forms: { robot: null, vehicle: null }, change: null, kinds: null };
  scene.add(player.root);
  // the mission's beacon: a column of light where you're meant to go
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc44a').multiplyScalar(1.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const beaconGeo = new THREE.CylinderGeometry(4, 4, 300, 24, 1, true);
  beaconGeo.translate(0, 150, 0);
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  // a drive step's gates, as rings standing on the road
  const gateMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb03a').multiplyScalar(2), toneMapped: false });
  const gateGeo = new THREE.TorusGeometry(1, 0.06, 8, 48);
  const gates = new THREE.InstancedMesh(gateGeo, gateMat, 16);
  gates.count = 0;
  gates.frustumCulled = false;
  scene.add(gates);

  let loading = Promise.resolve();
  let generation = 0;

  const clearArea = () => {
    if (stage) {
      scene.remove(stage.group);
      stage.dispose();
      stage = null;
    }
    for (const f of people.values()) {
      scene.remove(f.group);
      f.dispose();
    }
    people = new Map();
    for (const { figure } of foes.values()) {
      scene.remove(figure.group);
      figure.dispose();
    }
    foes.clear();
  };

  // Optimus's two forms for an area (Fall of Cybertron's on Cybertron,
  // Prime's on Earth), and each cut into chunks once for the changes
  const loadPlayer = async (robotKind, vehicleKind) => {
    if (player.kinds === `${robotKind}/${vehicleKind}`) return;
    player.kinds = `${robotKind}/${vehicleKind}`;
    for (const o of [player.robot?.group, player.vehicle]) if (o) player.root.remove(o);
    player.robot?.dispose();
    const [robot, vehicle] = await Promise.all([makeFigure(robotKind, { shadows: renderer.shadowMap.enabled }), makeThing(vehicleKind, { shadows: renderer.shadowMap.enabled })]);
    player.robot = robot;
    player.vehicle = vehicle;
    player.root.add(robot.group, vehicle);
    vehicle.visible = false;
    // the chunks: the truck's once and for all, the robot's from how he stands
    robot.update(0.016);
    const n = tier === 'low' ? 30 : 48;
    const vParts = bake(vehicle, vehicle);
    player.forms.vehicle = { parts: vParts, ...cluster(vParts, n, 2), kind: 'vehicle' };
    const rParts = bake(robot.group, robot.group);
    player.forms.robot = { parts: rParts, ...cluster(rParts, n, 1), kind: 'robot' };
  };

  const setArea = (area) => {
    const my = ++generation;
    loading = (async () => {
      clearArea();
      areaId = area.id;
      const look = area.look ?? {};
      const fog = look.fog ?? ['#0b1220', 150, 2600];
      scene.fog = new THREE.Fog(fog[0], fog[1], Math.max(fog[2], 1800));
      // (the metal shines with the room it's in: dim at night in Iacon)
      scene.environmentIntensity = look.env ?? 0.45;
      scene.background = new THREE.Color(fog[0]);
      const make = (STAGES[area.id] ?? plainStage)();
      const [mod] = await Promise.all([make, loadPlayer(area.player.robot, area.player.vehicle)]);
      if (my !== generation) return;
      stage = await mod.buildStage(area, { renderer, tier });
      if (my !== generation) {
        stage.dispose();
        stage = null;
        return;
      }
      scene.add(stage.group);
      // the people of the place, standing where they stand
      const made = await Promise.all(
        area.people.map((p) =>
          makeFigure(p.kind, { shadows: renderer.shadowMap.enabled }).then((f) => {
            f.group.position.set(p.x, p.y ?? 0, p.z);
            f.group.rotation.y = p.yaw ?? 0;
            f.home = p.yaw ?? 0;
            return [p.id, f];
          }),
        ),
      );
      if (my !== generation) return;
      for (const [id, f] of made) {
        people.set(id, f);
        scene.add(f.group);
      }
    })();
    return loading;
  };

  // a Decepticon's figure, made the first time it's seen
  const foeFor = (e) => {
    if (foes.has(e.id)) return foes.get(e.id);
    const entry = { figure: null, boomed: false, pending: true };
    foes.set(e.id, entry);
    makeFigure(e.model ?? e.kind, { shadows: false }).then((f) => {
      if (foes.get(e.id) !== entry) return f.dispose();
      entry.figure = f;
      entry.pending = false;
      scene.add(f.group);
    });
    return entry;
  };

  // the change from one form to the other, as it happens
  const startChange = (to) => {
    const { robot, vehicle, forms } = player;
    if (!robot || !forms.robot || !forms.vehicle) return;
    // the robot as he stands right now, cut where he was cut before
    const rParts = bake(robot.group, robot.group);
    const rForm = { parts: rParts, ids: forms.robot.ids, centres: centresOf(rParts, forms.robot.ids, forms.robot.centres.length / 3), kind: 'robot' };
    const from = to === 'vehicle' ? rForm : forms.vehicle;
    const into = to === 'vehicle' ? { ...forms.vehicle, kind: 'vehicle' } : { ...rForm, kind: 'robot' };
    const t = makeTransformer(from, into);
    player.change?.t.dispose();
    player.change = { t, to };
    player.root.add(t.group);
    robot.group.visible = false;
    vehicle.visible = false;
  };
  const endChange = (mode) => {
    if (player.change) {
      player.root.remove(player.change.t.group);
      player.change.t.dispose();
      player.change = null;
    }
    if (player.robot) player.robot.group.visible = mode === 'robot';
    if (player.vehicle) player.vehicle.visible = mode === 'vehicle';
  };

  // ── the camera ──
  const cam = { pos: new THREE.Vector3(0, 20, -30), look: new THREE.Vector3(), fov: CAM.robot.fov, ready: false };
  const want = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const blocked = (world, x0, y0, z0, x1, y1, z1) => {
    // how far along the line from the player to the camera it can go clear of walls
    const steps = 14;
    for (let k = 1; k <= steps; k++) {
      const f = k / steps;
      const x = x0 + (x1 - x0) * f;
      const y = y0 + (y1 - y0) * f;
      const z = z0 + (z1 - z0) * f;
      for (const s of world.near(x, z, 1.5)) {
        if (y > s.top + 1 || y < (s.base ?? 0) - 1) continue;
        const inside =
          s.kind === 'circle'
            ? Math.hypot(x - s.x, z - s.z) < s.r + 1.5
            : (() => {
                const dx = x - s.x;
                const dz = z - s.z;
                const lx = dx * s.c - dz * s.s;
                const lz = dx * s.s + dz * s.c;
                return Math.abs(lx) < s.hw + 1.5 && Math.abs(lz) < s.hd + 1.5;
              })();
        if (inside) return Math.max(0.15, (k - 1) / steps);
      }
    }
    return 1;
  };

  const placeCamera = (sim, view, dt) => {
    const p = sim.player;
    const c = p.mode === 'vehicle' && !p.shifting ? CAM.vehicle : CAM.robot;
    const zoom = view.zoom ?? 1;
    const fx = Math.sin(view.yaw);
    const fz = Math.cos(view.yaw);
    const cp = Math.cos(view.pitch);
    const sp = Math.sin(view.pitch);
    const dist = c.dist * zoom;
    // behind and above, a little to the side so the robot isn't in the way of the aim
    const rx = -fz;
    const rz = fx;
    want.set(p.x - fx * cp * dist + rx * c.side, p.y + c.height * zoom + sp * dist * 0.9, p.z - fz * cp * dist + rz * c.side);
    lookAt.set(p.x + fx * 12 + rx * c.side * 0.6, p.y + c.look + sp * 10, p.z + fz * 12 + rz * c.side * 0.6);
    // pulled in short of any wall between, and never through the floor or a ceiling
    const k = blocked(sim.world, p.x, p.y + c.look, p.z, want.x, want.y, want.z);
    want.set(p.x + (want.x - p.x) * k, p.y + c.look + (want.y - p.y - c.look) * k, p.z + (want.z - p.z) * k);
    want.y = Math.max(want.y, sim.world.floorAt(want.x, want.z, want.y + 2, 4) + 1.5);
    if (sim.world.ceiling < Infinity) want.y = Math.min(want.y, sim.world.ceiling - 2);
    const ease = cam.ready ? 1 - Math.exp(-dt * 10) : 1;
    cam.pos.lerp(want, ease);
    cam.look.lerp(lookAt, ease);
    cam.ready = true;
    const speedFov = p.mode === 'vehicle' ? Math.min(10, Math.abs(p.speed) * 0.18) : 0;
    cam.fov += (c.fov + speedFov - cam.fov) * Math.min(1, dt * 4);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
  };

  // ── a frame ──
  const size = { w: 1, h: 1 };
  let clock = 0;
  const spark = [];
  const gm = new THREE.Matrix4();
  const gq = new THREE.Quaternion();
  const gs = new THREE.Vector3();
  const gp = new THREE.Vector3();

  const render = (sim, view, dt, now) => {
    if (lost) return;
    clock += dt;
    const p = sim.player;
    // Optimus
    player.root.position.set(p.x, p.y, p.z);
    player.root.rotation.y = p.yaw;
    if (p.shifting > 0 && !player.change && player.robot) startChange(p.shiftTo);
    if (player.change) {
      const k = 1 - p.shifting / TRANSFORM.time;
      player.change.t.set(k);
      if (Math.random() < 0.5) {
        const n = player.change.t.sparks(k, spark, 3);
        for (let i = 0; i < n; i++) {
          gp.copy(spark[i]).applyMatrix4(player.root.matrixWorld);
          effects.spark(gp.x, gp.y, gp.z);
        }
      }
      if (!p.shifting) endChange(p.mode);
    } else if (player.robot) {
      player.robot.group.visible = p.mode === 'robot';
      if (player.vehicle) player.vehicle.visible = p.mode === 'vehicle';
    }
    if (player.robot && p.mode === 'robot' && !player.change) {
      const speed = Math.hypot(p.vx, p.vz);
      const state = p.dead ? 'dead' : !p.grounded ? (p.vy > 0 ? 'jump' : 'fall') : p.hurt > 0.25 ? 'hurt' : speed > 9 ? 'run' : speed > 0.8 ? 'walk' : 'idle';
      const aiming = view.firing && !p.dead;
      // the gun arm along the aim, in his own frame
      const rel = view.yaw - p.yaw;
      player.robot.play(state, { speed, aim: aiming ? [Math.sin(rel), Math.sin(view.pitch) + 0.05, Math.cos(rel)] : null });
      player.robot.update(dt);
    }
    if (player.vehicle && p.mode === 'vehicle') {
      // the truck leans into a slide and squats as it pulls away
      player.vehicle.rotation.z = Math.max(-0.08, Math.min(0.08, -p.slide * 0.01 - p.steer * Math.min(1, Math.abs(p.speed) / 30) * 0.05));
      player.vehicle.rotation.x = Math.max(-0.04, Math.min(0.04, -(view.throttle ?? 0) * 0.02));
    }
    // the Autobots, turning to look at him when he's near
    if (stage) {
      for (const [id, f] of people) {
        const who = sim.area.people.find((q) => q.id === id);
        if (!who) continue;
        const d = Math.hypot(p.x - who.x, p.z - who.z);
        const face = d < 40 ? Math.atan2(p.x - who.x, p.z - who.z) : f.home;
        let r = f.group.rotation.y;
        r += Math.atan2(Math.sin(face - r), Math.cos(face - r)) * Math.min(1, dt * 2.5);
        f.group.rotation.y = r;
        f.play('idle');
        f.update(dt);
      }
    }
    // the Decepticons
    const seen = new Set();
    for (const e of sim.enemies) {
      seen.add(e.id);
      const entry = foeFor(e);
      const f = entry.figure;
      if (!f) continue;
      f.group.position.set(e.x, e.y, e.z);
      f.group.rotation.y = e.yaw;
      // Megatron as his own model changes: its clip, robot to tank and back
      const change = f.spec?.clips?.toVehicle && f.hold ? f.spec.clips : null;
      if (change && (e.shift > 0 || e.form === 'tank')) {
        const [a, b] = e.form === 'tank' ? change.toVehicle : change.toRobot;
        const k = e.shift > 0 ? 1 - e.shift / (e.form === 'tank' ? MEGATRON.shift : MEGATRON.back) : 1;
        f.hold(change.transform, e.shift > 0 ? a + (b - a) * k : change.vehicle);
        if (e.shift > 0 && Math.random() < dt * 14) effects.spark(e.x + (Math.random() - 0.5) * 8, e.y + Math.random() * e.h * 1.4, e.z + (Math.random() - 0.5) * 8);
        f.update(dt);
        if (e.dead && !entry.boomed) {
          entry.boomed = true;
          effects.boom(e.x, e.y + e.h * 0.4, e.z, 16);
        }
        f.group.visible = !e.dead || (e.gone ?? 0) < 3;
        continue;
      }
      f.release?.();
      if (e.dead) {
        if (!entry.boomed) {
          entry.boomed = true;
          effects.boom(e.x, e.y + e.h * 0.4, e.z, e.boss ? 16 : 9);
        }
        f.play('dead');
        f.group.visible = (e.gone ?? 0) < 3;
      } else f.play(e.state === 'advance' ? 'walk' : 'walk', { speed: e.state === 'advance' ? 6 : 3.6, aim: [0, 0.05, 1] });
      f.update(dt);
    }
    for (const [id, entry] of foes) {
      if (seen.has(id)) continue;
      if (entry.figure) {
        scene.remove(entry.figure.group);
        entry.figure.dispose();
      }
      foes.delete(id);
    }
    // the fighting's light, and energon lying about
    effects.bolts(sim.shots);
    effects.pickups(
      sim.pickups.filter((k) => !k.mission || k.mission === sim.missions.active),
      clock,
    );
    effects.update(dt);
    // where the mission wants you
    const hud = view.hud;
    beacon.visible = !!hud?.target;
    if (hud?.target) {
      beacon.position.set(hud.target.x, sim.world.floorAt(hud.target.x, hud.target.z, 200, 300), hud.target.z);
      beaconMat.opacity = 0.22 + 0.12 * Math.sin(clock * 3);
    }
    const m = hud?.drive;
    gates.count = 0;
    if (m) {
      m.gates.forEach((g, i) => {
        if (i < m.next) return;
        gp.set(g.x, 9, g.z);
        gq.setFromEuler(new THREE.Euler(0, i + 1 < m.gates.length ? Math.atan2(m.gates[i + 1].x - g.x, m.gates[i + 1].z - g.z) : 0, 0));
        gs.setScalar(g.r * (i === m.next ? 1 + 0.05 * Math.sin(clock * 6) : 0.8));
        gates.setMatrixAt(gates.count++, gm.compose(gp, gq, gs));
      });
      gates.instanceMatrix.needsUpdate = true;
    }
    stage?.update(clock, dt, camera);
    placeCamera(sim, view, dt);
    const sharp = pace.frame(now);
    if (sharp !== null) post.sharpness = sharp;
    post.render(size.w, size.h);
  };

  return {
    camera,
    scene,
    setArea,
    get loading() {
      return loading;
    },
    render,
    // what just happened, as light
    events(list) {
      for (const e of list) {
        if (e.type === 'hit') effects.hit(e.x, e.y, e.z, true);
        else if (e.type === 'hitMe') effects.hit(e.x, e.y, e.z, false);
        else if (e.type === 'pickup') effects.boom(e.x, (e.y ?? 0) + 1, e.z, 2.5);
      }
    },
    resize(w, h) {
      size.w = Math.max(1, Math.round(w));
      size.h = Math.max(1, Math.round(h));
      renderer.setSize(size.w, size.h, false);
      camera.aspect = size.w / size.h;
      camera.updateProjectionMatrix();
    },
    precompile: () => precompile(renderer, scene, camera),
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, area: areaId }),
    dispose() {
      generation++;
      clearArea();
      endChange('robot');
      player.robot?.dispose();
      effects.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      gateGeo.dispose();
      gateMat.dispose();
      room.dispose();
      pmrem.dispose();
      post.composer?.dispose?.();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      if (!lost) releaseContext(renderer);
    },
  };
}
