// Dimension C-137, the world, in WebGL: the Smiths' street (./street.js),
// the rooms and the alien street (registered in AREAS_BUILT below), Morty
// walking about as the rigged Meshy Morty, and Rick's space cruiser, parked
// in the driveway or flown with Morty at the wheel. Toon-shaded and inked
// like the show (portal/toon.js), on lib/stage3d's renderer with
// lib/device's budget, drawn less sharp while frames come late
// (lib/three/pace).
//
// It draws what the component hands it each frame and decides nothing;
// ./rules.js has the rules.
//
// createRmWorld(canvas, { onLost }) resolves to { render(state, ms),
// resize(w, h), dispose(), lost, fx(type, data), info() }, where state is
// { area, morty: { x, z, face, speed, running }, flying, cruiser: { x, z, y,
// yaw, speed, bank }, camYaw, camPitch, near: { link, hotspot }, done }.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createStage, disposeTree } from '../../../lib/stage3d';
import { budget, device } from '../../../lib/device';
import { createPace } from '../../../lib/three/pace';
import { InkPass, toon } from '../portal/toon';
import { createMeshyCast } from '../portal/meshyCast';
import { AREAS, BUILDINGS, CRUISER, HOTSPOTS, LINKS, MORTY, OUTDOOR, ROAD, behindYaw, wallsIn } from './rules';
import { kitMaterials, toonModel } from './kit';
import { ROAD_Y, buildStreet } from './street';
import { STREET_SKY, makeSky } from './sky';
import { createFx } from './fx';

export { kitMaterials };

// Each area's builder: (kit) → { group, update?(t, dt, state, camera),
// noInk?: Object3D[], light?: { sun: [colour, intensity], hemi: [sky,
// ground, intensity], fog: [colour, near, far] | null, background }, dispose? }
// (or a promise of one). Its group is drawn at the area's own place in
// rules.js's AREAS and shown only while Morty is there. An area with no
// builder gets a plain lit room (or, outdoors, plain ground under a sky).
// The rooms and the annex add theirs here.
export const AREAS_BUILT = { street: buildStreet };

// the models the world loads (public/models/c137/), shared with the builders by name
const MODELS = ['smith-house', 'school', 'arcade', 'roy-cabinet'];
const MORTY_H = 1.7; // how tall Morty stands here
const SAUCER = 2.4; // the cruiser's height (it's 3.8 m across)
const SEAT = { x: 0.38, y: 1.16, z: 0.07, tall: 1.3 }; // Morty at the wheel, in the saucer's frame, sat
const GLASS = 0.69; // where the saucer's hull stops and its dome starts, as a share of its height
const ROOM_LIGHT = { sun: [0xfff1dc, 0.7], hemi: [0xfff4e6, 0x8a7a68, 1.7], fog: null, background: 0x15110d };
const ANNEX_LIGHT = { sun: [0xffd6f0, 1.9], hemi: [0xd9b8ff, 0x553366, 1.3], fog: [0x8a5fb8, 60, 260] };
const ANNEX_SKY = { top: 0x2a1250, mid: 0x7a3c9a, low: 0xf0a0c8, sun: 0xfff0c0, clouds: 0.6, moons: 1 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = new THREE.Vector3();

export async function createRmWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const fit = budget();
  const stage = createStage(canvas, { shadows: true, fov: 55, near: 0.1, far: 1000, exposure: 1.05, bloom: { strength: 0.5, radius: 0.45, threshold: 0.9 }, onLost });
  const { renderer, scene, camera } = stage;
  // a tone map that keeps the show's flat bright colours bright
  renderer.toneMapping = THREE.NeutralToneMapping;
  stage.grade({ contrast: 0.06, saturation: 1.12, vignette: 0.12, grain: 0.008, shadow: [0, 0.004, 0.012], high: [0.012, 0.008, 0] });
  renderer.info.autoReset = false; // counted over the whole frame, every pass
  const big = Math.min(window.screen?.width ?? 1280, window.screen?.height ?? 800) >= 700;

  // ── light ──
  const hemi = new THREE.HemisphereLight(0xd6f0ff, 0x6a9a4a, 1.3);
  const sun = new THREE.DirectionalLight(0xfff3df, 2.4);
  const sunDir = new THREE.Vector3(-0.55, 0.78, 0.45).normalize();
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(fit.shadowMap, fit.shadowMap);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const fx = createFx();
  scene.add(fx.group);
  const mats = kitMaterials(renderer);

  // ── the models and the cast ──
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const cast = createMeshyCast();
  const [loaded] = await Promise.all([
    Promise.all(MODELS.map((n) => loader.loadAsync(`/models/c137/${n}.glb`).then((g) => [n, toonModel(g.scene, { aniso: fit.aniso })], () => [n, null]))),
    cast.load(null, ['morty', 'saucer'], { clips: ['idle', 'walk', 'run', 'sit'] }),
  ]);
  const models = new Map(loaded);
  if (stage.disposed) return null;

  // ── the areas ──
  const kit = { renderer, models, cast, mats, tier, camera, fit };
  const areas = {};
  const building = {};
  const build = async (id) => {
    const make = AREAS_BUILT[id] ?? (OUTDOOR.includes(id) ? plainGround : plainRoom);
    let a = null;
    try {
      a = await make(kit, id);
    } catch (err) {
      if (import.meta.env.DEV) console.warn(`C-137: the ${id} builder failed`, err);
      a = plainRoom(kit, id);
    }
    a.group.visible = false;
    scene.add(a.group);
    areas[id] = a;
    return a;
  };
  await Promise.all(Object.keys(AREAS_BUILT).map(build));

  // ── Morty, walking, and sat at the cruiser's wheel ──
  const morty = cast.make('morty') ?? standInMorty();
  morty.group.scale.setScalar(MORTY_H / (morty.height ?? MORTY_H));
  scene.add(morty.group);
  const mortyShadow = fx.blob(0.55);

  const cruiser = new THREE.Group();
  cruiser.rotation.order = 'YXZ';
  const hull = new THREE.Group();
  hull.position.y = -SAUCER / 2;
  cruiser.add(hull);
  const saucer = cast.prop('saucer', SAUCER);
  const glassMats = [];
  if (saucer) {
    hull.add(saucer);
    saucer.traverse((o) => {
      if (!o.isMesh) return;
      o.material = glass(o.material, o.geometry);
      glassMats.push(o.material);
    });
  } else hull.add(standInSaucer(mats));
  const pilot = cast.make('morty');
  if (pilot) {
    pilot.group.scale.setScalar(SEAT.tall / pilot.height);
    pilot.group.position.set(SEAT.x, SEAT.y, SEAT.z);
    for (const [n, a] of Object.entries(pilot.act ?? {})) a.setEffectiveWeight(n === 'sit' ? 1 : 0);
    hull.add(pilot.group);
  }
  // the exhaust cans' glow, at the back
  const glowMat = new THREE.SpriteMaterial({ map: fx.spot, color: new THREE.Color(0x9dff6a).multiplyScalar(2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glows = [-1, 1].map((s) => {
    const g = new THREE.Sprite(glowMat);
    g.position.set(s * 1.23, 1.41, -1.84);
    hull.add(g);
    return g;
  });
  scene.add(cruiser);
  const cruiserShadow = fx.blob(2.1);

  // the doors' rings and where a hotspot is
  for (const l of LINKS) fx.markAt(l.id, l.x, l.area === 'street' && Math.abs(l.z) < ROAD.w / 2 ? ROAD_Y : 0, l.z).userData.area = l.area;
  const hotspots = new Map(HOTSPOTS.map((h) => [h.id, h]));

  // the street has a sky; the plain annex gets its own
  const ink = new InkPass(scene, camera, { hide: () => [fx.group, ...glows, ...(areas[shown]?.noInk ?? [])], width: big ? 1.35 : 1.05 });
  // thinning out into the distance, as the show draws its backgrounds (and
  // with no line along the horizon)
  const inkMat = ink.quad.material;
  inkMat.uniforms.fade = { value: new THREE.Vector2(110, 300) };
  inkMat.fragmentShader = inkMat.fragmentShader
    .replace('uniform float near, far, width;', 'uniform float near, far, width;\nuniform vec2 fade;')
    .replace('gl_FragColor = vec4(mix(c.rgb, ink, e * 0.92), c.a);', 'float nz = max(max(zc, max(zl, zr)), max(zd, zu));\ne *= 1.0 - smoothstep(fade.x, fade.y, nz > 0.0 ? 1.0 / nz : 1e6);\ngl_FragColor = vec4(mix(c.rgb, ink, e * 0.92), c.a);');
  stage.composer.insertPass(ink, 1);

  // ── the camera ──
  const cam = { at: new THREE.Vector3(), look: new THREE.Vector3(), area: null, flying: null };
  const want = { at: new THREE.Vector3(), look: new THREE.Vector3() };
  // how far from the head to the camera it can go before it's inside a
  // building (outdoors) or through a wall (indoors), as a share
  const blocked = (area, x, y, z) => {
    if (area === 'street') return BUILDINGS.some((b) => y < b.roof + 0.5 && Math.abs(x - b.x) < b.w / 2 + 0.35 && Math.abs(z - b.z) < b.d / 2 + 0.35);
    return false;
  };
  const crossesWall = (area, ax, az, bx, bz) =>
    wallsIn(area).some(([x0, z0, x1, z1, , low]) => {
      if (low) return false;
      const d1 = (bx - ax) * (z0 - az) - (bz - az) * (x0 - ax);
      const d2 = (bx - ax) * (z1 - az) - (bz - az) * (x1 - ax);
      const d3 = (x1 - x0) * (az - z0) - (z1 - z0) * (ax - x0);
      const d4 = (x1 - x0) * (bz - z0) - (z1 - z0) * (bx - x0);
      return d1 * d2 < 0 && d3 * d4 < 0;
    });
  const clearance = (area, from, to) => {
    const N = 16;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      const x = from.x + (to.x - from.x) * k;
      const y = from.y + (to.y - from.y) * k;
      const z = from.z + (to.z - from.z) * k;
      if (blocked(area, x, y, z) || (!OUTDOOR.includes(area) && crossesWall(area, from.x, from.z, x, z))) return Math.max(0.2, (i - 1) / N);
    }
    return 1;
  };

  // ── per-area light ──
  let shown = null;
  const fog = new THREE.Fog(0xffffff, 1e4, 2e4); // one, so a room without fog doesn't recompile every shader
  scene.fog = fog;
  const showArea = (id) => {
    if (!areas[id]) {
      building[id] ??= build(id); // (a plain one, built on the way in)
      return false;
    }
    for (const [k, a] of Object.entries(areas)) a.group.visible = k === id;
    const L = areas[id].light ?? (OUTDOOR.includes(id) ? ANNEX_LIGHT : ROOM_LIGHT);
    sun.color.set(L.sun[0]);
    sun.intensity = L.sun[1];
    hemi.color.set(L.hemi[0]);
    hemi.groundColor.set(L.hemi[1]);
    hemi.intensity = L.hemi[2];
    if (L.fog) {
      fog.color.set(L.fog[0]);
      fog.near = L.fog[1];
      fog.far = L.fog[2];
    } else {
      fog.near = 1e4;
      fog.far = 2e4;
    }
    scene.background = L.background != null ? new THREE.Color(L.background) : null;
    for (const m of fx.marks.values()) m.visible = m.userData.area === id;
    shown = id;
    return true;
  };

  // every shader compiled before the first frame
  for (const a of Object.values(areas)) a.group.visible = true;
  await stage.precompile();
  if (stage.disposed) return null;
  for (const a of Object.values(areas)) a.group.visible = false;

  // ── each frame ──
  const pace = createPace();
  let sharp = 1;
  let t = 0;
  let mortyY = 0;
  let craftY = CRUISER.hover;
  const render = (state, ms = 16) => {
    if (stage.lost || stage.disposed) return;
    const now = performance.now();
    const s = pace.frame(now);
    if (s !== null) {
      sharp = s;
      resize(stage.size.w, stage.size.h);
    }
    const dt = Math.min(0.1, ms / 1000);
    t += dt;
    const area = state.area ?? 'street';
    if (area !== shown && !showArea(area)) return;
    const jump = cam.area !== area || cam.flying !== !!state.flying;
    const outdoors = area === 'street';

    // Morty
    const m = state.morty;
    const ground = outdoors && Math.abs(m.z - ROAD.z) < ROAD.w / 2 ? ROAD_Y : 0;
    mortyY = jump ? ground : mortyY + (ground - mortyY) * Math.min(1, dt * 14);
    morty.group.visible = !state.flying;
    morty.group.position.set(m.x, mortyY, m.z);
    morty.group.rotation.y = (m.face ?? 0) + Math.PI / 2;
    morty.update?.(t, clamp((m.speed ?? 0) / MORTY.run, 0, 1), 0);
    mortyShadow.visible = morty.group.visible;
    mortyShadow.position.set(m.x, mortyY + 0.02, m.z);

    // the cruiser: in the street only; its pilot only while flying; its
    // height eased over the step its floor makes at a roof's edge
    const c = state.cruiser;
    cruiser.visible = outdoors && !!c;
    if (c && outdoors) {
      craftY = jump ? c.y : craftY + (c.y - craftY) * Math.min(1, dt * (c.y > craftY ? 10 : 4));
      const bob = Math.sin(t * 2.2) * (state.flying ? 0.12 : 0.05);
      cruiser.position.set(c.x, craftY + 0.15 + bob, c.z);
      cruiser.rotation.set(-clamp((c.vy ?? 0) * 0.03, -0.22, 0.22), c.yaw ?? 0, -(c.bank ?? 0));
      if (pilot) {
        pilot.group.visible = !!state.flying;
        pilot.mixer?.update(dt);
      }
      glowMat.opacity = 0.7 + Math.sin(t * 19) * 0.15;
      glows.forEach((g, i) => {
        g.visible = !!state.flying;
        g.scale.setScalar(0.5 + Math.sin(t * 13 + i * 2) * 0.05);
      });
      const hy = cruiser.position.y;
      cruiserShadow.visible = true;
      cruiserShadow.position.set(c.x, Math.abs(c.z - ROAD.z) < ROAD.w / 2 ? ROAD_Y + 0.03 : 0.03, c.z);
      cruiserShadow.scale.setScalar(clamp(1 - (hy - 1.4) / 40, 0.4, 1));
      cruiserShadow.material.opacity = clamp(0.4 - (hy - 1.4) / 60, 0.08, 0.4);
    } else cruiserShadow.visible = false;

    // the rings at the doors, the marker over what you're next to
    for (const [id, mk] of fx.marks) mk.userData.near = state.near?.link === id;
    const spot = state.near?.hotspot && hotspots.get(state.near.hotspot);
    fx.pin.visible = !!spot && spot.area === area && !state.flying;
    if (fx.pin.visible) {
      fx.pin.position.x = spot.x;
      fx.pin.position.z = spot.z;
      fx.pin.userData.y = 2.3;
    }

    // the camera: behind Morty at the component's yaw, or chasing the cruiser
    if (state.flying && c && outdoors) {
      const fx0 = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      want.at.set(c.x - fx0 * 12.5, craftY + 4.6, c.z - fz * 12.5);
      want.look.set(c.x + fx0 * 6, craftY + 0.2, c.z + fz * 6);
    } else {
      const yaw = state.camYaw ?? behindYaw(m.face ?? 0);
      const pitch = clamp(state.camPitch ?? 0.17, -0.25, 1.2);
      const dist = outdoors || OUTDOOR.includes(area) ? 5.6 : 3.6;
      want.look.set(m.x, mortyY + 1.45, m.z);
      want.at.set(m.x + Math.sin(yaw) * Math.cos(pitch) * dist, mortyY + 1.45 + Math.sin(pitch) * dist, m.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const k = clearance(area, want.look, want.at);
      if (k < 1) want.at.lerpVectors(want.look, want.at, k);
      if (!OUTDOOR.includes(area)) {
        const a = AREAS[area];
        want.at.x = clamp(want.at.x, a.x0 + 0.3, a.x1 - 0.3);
        want.at.z = clamp(want.at.z, a.z0 + 0.3, a.z1 - 0.3);
        want.at.y = Math.min(want.at.y, 2.35);
      }
      want.at.y = Math.max(want.at.y, mortyY + 0.4);
    }
    const ease = jump ? 1 : 1 - Math.exp(-dt * (state.flying ? 4.5 : 10));
    cam.at.lerp(want.at, ease);
    cam.look.lerp(want.look, ease);
    cam.area = area;
    cam.flying = !!state.flying;
    camera.position.copy(cam.at);
    camera.lookAt(cam.look);

    // the sun's shadows follow whoever you are
    const focus = state.flying && c ? V.set(c.x, 0, c.z) : V.set(m.x, 0, m.z);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, 70);
    sun.castShadow = renderer.shadowMap.enabled;

    areas[area].update?.(t, dt, state, camera);
    if (fx.portal.visible) fx.portal.rotation.y = Math.atan2(camera.position.x - fx.portal.position.x, camera.position.z - fx.portal.position.z);
    fx.update(dt, t);
    renderer.info.reset();
    stage.render(ms);
  };

  // drawn a step less sharp than the stage's own ratio while pace says so
  const resize = (w, h) => {
    stage.resize(w, h);
    if (sharp < 1) {
      const pr = renderer.getPixelRatio() * sharp;
      renderer.setPixelRatio(pr);
      renderer.setSize(stage.size.w, stage.size.h, false);
      stage.composer.setPixelRatio(pr);
      stage.composer.setSize(stage.size.w, stage.size.h);
    }
  };

  const fxEvent = (type, d = {}) => {
    const m = morty.group.position;
    if (type === 'done') fx.burst(m.x, m.y + 2.1, m.z, 110, 4.5);
    else if (type === 'portal') {
      const p = d.at ?? { x: m.x, z: m.z };
      fx.openPortal(p.x, p.z, 0);
    } else if (type === 'board') {
      fx.ring(cruiser.position.x, 0, cruiser.position.z, 0x9dff5a, 3.5, 0.6);
      fx.burst(cruiser.position.x, cruiser.position.y + 0.6, cruiser.position.z, 40, 3);
    } else if (type === 'land') fx.ring(cruiser.position.x, 0, cruiser.position.z, 0xf2efe6, 6, 0.9);
  };

  const api = {
    render,
    resize,
    fx: fxEvent,
    info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, sharp, tier, models: MODELS.filter((n) => models.get(n)), cast: !!saucer };
    },
    get lost() {
      return stage.lost;
    },
    dispose() {
      if (stage.disposed) return;
      for (const a of Object.values(areas)) a.dispose?.();
      // models a builder never put in the scene
      for (const o of models.values()) if (o && !o.parent) disposeTree(o);
      fx.dispose();
      glowMat.dispose();
      for (const g of glassMats) g.dispose();
      cast.dispose();
      mats.dispose();
      stage.dispose();
      if (import.meta.env.DEV && window.__C137__?.api === api) delete window.__C137__;
    },
  };
  if (import.meta.env.DEV) window.__C137__ = { ...(window.__C137__ ?? {}), api, scene };
  return api;
}

// ── stand-ins and plain areas ──

// A room with nothing in it yet: floor, walls and a ceiling light, at the
// area's place.
function plainRoom(kit, id) {
  const a = AREAS[id];
  const group = new THREE.Group();
  const w = a.x1 - a.x0;
  const d = a.z1 - a.z0;
  const cx = (a.x0 + a.x1) / 2;
  const cz = (a.z0 + a.z1) / 2;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), kit.mats.floor(0xc4a77a));
  floor.position.set(cx, -0.05, cz);
  floor.receiveShadow = true;
  group.add(floor);
  const wallMat = kit.mats.wall(0xe9dfc8);
  for (const [x, z, ww, dd] of [[cx, a.z0, w, 0.2], [cx, a.z1, w, 0.2], [a.x0, cz, 0.2, d], [a.x1, cz, 0.2, d]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, 2.8, dd), wallMat);
    wall.position.set(x, 1.4, z);
    wall.receiveShadow = true;
    group.add(wall);
  }
  const lamp = new THREE.PointLight(0xfff0d8, 2.5, Math.max(w, d) * 1.2, 1.4);
  lamp.position.set(cx, 2.5, cz);
  group.add(lamp);
  return { group, light: ROOM_LIGHT };
}

// Outdoors with nothing built yet: ground under its own sky.
function plainGround(kit, id) {
  const a = AREAS[id];
  const group = new THREE.Group();
  const sky = makeSky(560, id === 'street' ? STREET_SKY : ANNEX_SKY);
  group.add(sky.dome);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), kit.mats.floor(id === 'street' ? 0x62b347 : 0x7b5aa6));
  ground.position.set((a.x0 + a.x1) / 2, 0, (a.z0 + a.z1) / 2);
  ground.receiveShadow = true;
  group.add(ground);
  return { group, noInk: [sky.dome], light: id === 'street' ? undefined : ANNEX_LIGHT, update: (t, dt, s, camera) => sky.update(t, camera) };
}

// Morty in shapes, if his model won't load: yellow shirt, blue trousers.
function standInMorty() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const part = (geo, color, x, y, z) => {
    const mesh = new THREE.Mesh(geo, toon(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  };
  const legs = [-0.12, 0.12].map((x) => part(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), 0x3b5fa8, x, 0.38, 0));
  part(new THREE.CapsuleGeometry(0.24, 0.36, 4, 10), 0xf2d23c, 0, 0.98, 0);
  part(new THREE.SphereGeometry(0.27, 16, 12), 0xf6d2b0, 0, 1.48, 0);
  part(new THREE.SphereGeometry(0.29, 16, 12, 0, Math.PI * 2, 0, 1.3), 0x6b3a1e, 0, 1.52, -0.02);
  return {
    group,
    body,
    height: 1.78,
    update(t, move) {
      legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 9 + i * Math.PI) * 0.5 * move));
      body.position.y = Math.abs(Math.sin(t * 9)) * 0.05 * move;
    },
  };
}

// A saucer in shapes, if its model won't load: hull, rim and dome.
function standInSaucer(mats) {
  const g = new THREE.Group();
  const hullMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.9, 0.9, 24), mats.toon(0xa0a6ad));
  hullMesh.position.y = 0.75;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass);
  dome.position.y = 1.2;
  for (const o of [hullMesh, dome]) {
    o.castShadow = true;
    g.add(o);
  }
  return g;
}

// The saucer's dome as glass: everything above its rim see-through face-on
// and thicker towards its edges, so it reads as a bubble with Morty in it.
function glass(src, geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const y = min.y + (max.y - min.y) * GLASS;
  const m = src.clone();
  m.transparent = true;
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('void main() {', 'varying float vGlassY;\nvoid main() {\nvGlassY = position.y;');
    s.fragmentShader = s.fragmentShader
      .replace('void main() {', 'varying float vGlassY;\nvoid main() {\nfloat glass = 0.0;')
      .replace('#include <map_fragment>', `#include <map_fragment>\nglass = smoothstep(${y.toFixed(5)} - 0.004, ${y.toFixed(5)} + 0.004, vGlassY);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.95, 0.96), glass * 0.6);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ float rim = 1.0 - abs(normal.z); diffuseColor.a *= mix(1.0, 0.18 + 0.6 * rim * rim, glass); }');
  };
  m.customProgramCacheKey = () => `c137-glass-${y.toFixed(4)}`;
  return m;
}
