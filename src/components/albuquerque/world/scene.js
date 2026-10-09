// Albuquerque, the world, in 3D: the city in its desert valley at golden
// hour, the Sandias catching the light to the east. Its streets (./roads.js)
// and everything on its blocks and along them (./city.js: downtown's towers,
// Central's shops and motels, the houses, the warehouses, the trees, the
// lamps and lights), its traffic and parked cars (./vehicles.js), Walt's
// street, and the places the shows happen, each with its sign (the title
// cards' periodic-table tile) and a marker where you pull up. Walt's Aztek,
// Hank's SUV and the shows' buildings are Meshy models made for the site
// (scripts/meshy-albuquerque.mjs); any that don't load stand in as shapes.
//
//
// The day goes round: golden hour, dusk, a night of stars with the signs and
// street lights on and the Aztek's headlights out in front, dawn with the
// Balloon Fiesta up over the valley, noon. The sky and its light are in
// ./sky.js, the desert floor, the roads' surfaces and the mountains in
// ./terrain.js, and what moves and glows (balloons, tumbleweeds, the Blue
// Sky crystals, the lamps, the RV's smoke, the pizza on Walt's roof) in
// ./life.js. Bright things bloom, and the picture is graded warm.
//
// Nothing here casts a shadow in real time. The floor (the desert, the
// streets, the sidewalks, the car parks) reads masks baked offline from the
// city's own geometry (scripts/bake-floor-shadows.mjs, lib/three/grounding):
// the sun's shadows at dawn, noon and golden hour, softened at their edges,
// and the sky's, which darkens the foot of every wall and the gap between two
// buildings; what moves stands on a soft blob slid away from the sun; and the
// lower faces of everything take a little of the ground's colour. The shadow
// pass that used to draw the city a second time every frame is gone.
//
// Other drivers online in Albuquerque at the same time drive about in yours
// as ghosts from another world: a pale Aztek each, lit at the edges, their
// name over it and a ring of light under it (the Middle-earth towns' ghosts,
// ../../middleearth/towns/ghosts.js). Nothing passes between you but where
// each of you is: no one bumps into anyone, Hank doesn't see them, and your
// career's your own.
//
// createAbqWorld(canvas) resolves to { render(state, ms), setPlaces(progress),
// beam(id), setTime(tod), setBlue(ids), took(id), resize, info, dispose, lost }.
// `state` is the component's: the car, Hank, the heat, the place you're at
// (rules.js does the moving) and the other drivers (`travellers`, the
// towns' travellers.js list()). loadModel(loader, name) resolves to one of the
// town's models as loaded (its scene, or null); SKETCHFAB names the ones that
// come from Sketchfab, and their files.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { loadPeople } from '../../office/people';
import { budgetClock } from '../../../lib/three/animBudget';
import { CAST_AT, CIVILIANS, castFor, createErrand, createStreet, ringOf } from './street';
import { createStage } from '../../office/stage3d';
import { budget, device } from '../../../lib/device';
import { loadTexture } from '../../../lib/hdri';
import { prefersReducedMotion } from '../../../lib/hooks';
import { createFeel, feelGroups } from '../../../lib/three/feel';
import { createVehicleFeel, feelGroups as carFeelGroups } from '../../../lib/vehicleFeel';
import { attachVehicleBody } from '../../../lib/three/vehicleBody';
import { wireImpacts } from '../../../lib/three/impacts';
import { createDust } from '../../../lib/three/dust';
import { createStreetProps } from './roadside';
import { LOOK } from './look';
import { createImpacts, impactGroups } from '../../../lib/impact';
import { GRADE } from '../../../lib/stage3d';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { splitWord } from '../elements';
import { ABQ, dressedAs } from '../wardrobe';
import { LOOK_KEY, readLooks } from '../../rickmorty/wardrobe/looks';
import { dress } from '../../rickmorty/wardrobe/wear';
import { local } from '../../../lib/hooks';
import { TOWN_MODELS, createTown } from './buildings';
import { createCity } from './city';
import { createBalloons, createCrystals, createNightLights, createPizza, createSmoke, createTumbleweeds, glowTexture } from './life';
import { createStreets } from './roads';
import { CITY, GRID, HOUSES, LANDMARKS, PLACES, RAIL, ROADS, TIMES, WASH, WORLD_RADIUS, collidersNear, groundHeight, onRoad, surfaceHeight } from './rules';
import { createSky, lightAt, sunAt } from './sky';
import { createMountains, groundMaterial } from './terrain';
import { createFleet, footprint, paintFor } from './vehicles';
import { gltfLoader } from '../../../lib/three/gltf';
import { dropTransmission } from '../../../lib/three/glass';
import { bounce, createBlobShadows, floorShadow, loadFloorShadow, setFloorTime } from '../../../lib/three/grounding';
import { createHouse, shadowFor } from '../../../lib/three/house';
import { coreOf, loadCore, wear } from '../../../lib/three/core';
import { sharpen } from '../../../lib/three/textures';

// Models from Sketchfab (CC Attribution, credited in public/cc0/README.md; scripts/sketchfab-import.mjs
// brings them to web size): the RV, Saul's car, the water tank, the train's tank cars, cacti, a
// tumbleweed and the Pollos bucket. Everything else is the site's own, made with Meshy.
export const SKETCHFAB = { rv: 'rv', esteem: 'esteem', watertank: 'watertower', tank: 'tank', cactus: 'cactus', tumbleweed: 'tumbleweed', bucket: 'bucket' };
const MODEL = (name) => (SKETCHFAB[name] ? `/models/sketchfab/${SKETCHFAB[name]}.glb` : `/models/albuquerque/world/${name}.glb`);
// One of the town's models by name: its scene, or null if it didn't load. A
// Sketchfab one keeps the materials it came with, all but transmission (Saul's
// Esteem has it on its windows), which has three draw the whole town a second
// time, every frame the car's in view: its glass is plain see-through glass.
export const loadModel = (loader, name) =>
  loader.loadAsync(MODEL(name)).then(
    (g) => {
      if (SKETCHFAB[name]) dropTransmission(g.scene);
      return g.scene;
    },
    () => null,
  );
// which way each model's front faces as it was made, turned to face +z
export const FACING = { aztek: Math.PI / 2, rv: 0, suv: Math.PI / 2, house: -Math.PI / 2, pollos: -Math.PI / 2, laundry: 0, casa: 0, office: 0, carwash: 0 };
const DAY = 480; // seconds for the sun to go all the way round
const NEON = { home: 0xfff0c0, rv: 0x8cff6a, saul: 0xffd23a, pollos: 0xff5a3a, superlab: 0x52c8ff, casa: 0xff8ad0 };
// The floor's baked shadows, and the colour every shadow here goes: the
// sand's own deep warm brown, darker, never grey.
const SHADOW_DIR = `${import.meta.env.BASE_URL}albuquerque/shadow`;
export const SHADE = 0x5a3420;
// the blobs under what moves, [across, along] in metres (wider than the car:
// the pool fades out past its edges)
const AZTEK_BLOB = [3.2, 5];
const HANK_BLOB = [3.3, 5.4];
const PERSON_BLOB = [1.1, 1.1];
const FREIGHT_BLOB = [3.6, 14.2];

// a seeded random, so the desert's the same every visit
const seeded = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// A roadside sign: the place's name with its periodic-table tile, as the
// title cards have it, and LOCKED across it until it's open.
function paintSign(g, place, open) {
  const W = 1024;
  const H = 512;
  g.clearRect(0, 0, W, H);
  g.fillStyle = open ? '#123a22' : '#2a2f2c';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f2efe4';
  g.lineWidth = 14;
  g.strokeRect(14, 14, W - 28, H - 28);
  // the first word with an element in it gets the tile
  const words = place.name.split(' ');
  let tile = null;
  const parts = words.map((w) => {
    if (tile) return { text: w };
    const s = splitWord(w.replace(/[^A-Za-zÁ-ú]/g, ''));
    if (!s.el) return { text: w };
    tile = s.el;
    return { before: w.slice(0, s.before.length), el: s.el, after: w.slice(s.before.length + s.el.sym.length) };
  });
  const size = place.name.length > 18 ? 74 : 92;
  g.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
  g.textBaseline = 'middle';
  const widths = parts.map((p) => (p.el ? g.measureText(p.before).width + size * 1.15 + g.measureText(p.after).width : g.measureText(p.text).width));
  const gap = size * 0.35;
  let x = (W - widths.reduce((a, b) => a + b, 0) - gap * (parts.length - 1)) / 2;
  const y = H * 0.42;
  parts.forEach((p, i) => {
    g.fillStyle = '#f2efe4';
    if (!p.el) {
      g.fillText(p.text, x, y);
    } else {
      g.fillText(p.before, x, y);
      let tx = x + g.measureText(p.before).width;
      const t = size * 1.1;
      g.fillStyle = '#2f8a45';
      g.fillRect(tx, y - t / 2 - 6, t, t + 12);
      g.strokeStyle = '#d7f0dc';
      g.lineWidth = 3;
      g.strokeRect(tx, y - t / 2 - 6, t, t + 12);
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.round(size * 0.78)}px Georgia, serif`;
      g.fillText(p.el.sym, tx + (t - g.measureText(p.el.sym).width) / 2, y + 4);
      g.font = `600 ${Math.round(size * 0.2)}px 'Courier New', monospace`;
      g.fillText(String(p.el.n), tx + 6, y - t / 2 + 6);
      g.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
      tx += t + 4;
      g.fillStyle = '#f2efe4';
      g.fillText(p.after, tx, y);
    }
    x += widths[i] + gap;
  });
  g.font = `600 44px 'Courier New', monospace`;
  g.fillStyle = '#f0c330';
  const sub = place.sub ?? '';
  g.fillText(sub, (W - g.measureText(sub).width) / 2, H * 0.76);
  if (!open) {
    g.fillStyle = 'rgba(10, 10, 10, 0.55)';
    g.fillRect(28, H * 0.3, W - 56, H * 0.24);
    g.font = `800 64px 'Courier New', monospace`;
    g.fillStyle = '#ff8a7a';
    const t = 'LOCKED';
    g.fillText(t, (W - g.measureText(t).width) / 2, H * 0.42);
  }
}

// a marker's icon: a diamond with a glyph, or a padlock
function paintIcon(g, open, glyph) {
  const s = 256;
  g.clearRect(0, 0, s, s);
  g.save();
  g.translate(s / 2, s / 2);
  g.rotate(Math.PI / 4);
  g.fillStyle = open ? '#f0c330' : '#5b605d';
  g.strokeStyle = '#111';
  g.lineWidth = 10;
  g.fillRect(-70, -70, 140, 140);
  g.strokeRect(-70, -70, 140, 140);
  g.restore();
  g.fillStyle = '#111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (open) {
    g.font = '800 84px Georgia, serif';
    g.fillText(glyph, s / 2, s / 2 + 4);
  } else {
    // a padlock
    g.fillStyle = '#e8e8e8';
    g.fillRect(s / 2 - 34, s / 2 - 10, 68, 52);
    g.strokeStyle = '#e8e8e8';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(s / 2, s / 2 - 12, 24, Math.PI, 0);
    g.stroke();
  }
}
const GLYPH = { home: 'W', rv: 'Me', saul: 'Sa', pollos: 'Po', superlab: 'Bl', casa: 'Ti' };

// The glow on bright things (UnrealBloomPass): its strength by day (times the
// device's fit), how much of it goes after dark, its radius, the threshold
// and how soft the edge over it is, the weight of each blur level (the
// widest last, and least), and the brightest a pixel counts for.
const BLOOM = { ...LOOK.bloom, night: 0.4, soft: 0.35, levels: [1, 0.65, 0.35, 0.12, 0.04], clamp: 4 };

// ── shapes standing in for a model that didn't load ──
function standIn(name) {
  const g = new THREE.Group();
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const box = (w, h, d, c, x = 0, y = h / 2, z = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c));
    b.position.set(x, y, z);
    g.add(b);
  };
  const s = {
    aztek: () => (box(1.9, 1.1, 4.4, 0xb9b58f, 0, 0.75), box(1.7, 0.6, 2.4, 0x2a3036, 0, 1.5, -0.3)),
    suv: () => (box(2, 1.2, 4.8, 0x161718, 0, 0.8), box(1.85, 0.7, 2.8, 0x0d0e10, 0, 1.6, -0.2)),
    rv: () => (box(2.5, 2.6, 8.4, 0xe8dfcc, 0, 1.6), box(2.52, 0.25, 8.42, 0x9b5a2c, 0, 1.6)),
    house: () => (box(16, 3.2, 11, 0xd2b48c), box(16.4, 0.4, 11.4, 0x7a5a40, 0, 3.4)),
    pollos: () => (box(18, 4.2, 11, 0xf0c330), box(18.2, 0.6, 11.2, 0xc0392b, 0, 4.4)),
    laundry: () => box(24, 5.5, 14, 0xd8c4a0),
    casa: () => box(20, 3.6, 12, 0xd9b98f),
    office: () => (box(16, 4.2, 10, 0xd8c4a0), box(1.4, 5, 1.4, 0x5fa58a, 0, 6.7)),
    carwash: () => (box(18, 4.4, 9, 0xf2f2f0), box(18.2, 0.5, 9.2, 0x2e6fb5, 0, 4.4)),
  }[name];
  s?.();
  return g;
}

export async function createAbqWorld(canvas, { onLost, onSlow } = {}) {
  // (a graphics chip the site counts as middling, an integrated laptop one,
  // gets the middle row here, however strong the rest of the device is: the
  // town's a lot to draw)
  const dev = device();
  const fit = budget(dev.detail === 'mid' && dev.tier === 'high' ? 'mid' : undefined);
  let post = null;
  const stage = createStage(canvas, {
    onLost,
    fov: 58,
    // (the composer's target smooths the edges; and a CSS pixel needn't be
    // more than one and a half of the device's, here: the town's a lot of
    // pixels to fill, and steps down a little sooner if it can't keep up)
    antialias: !(fit.bloom > 0),
    maxRatio: 1.5,
    slowMs: 30,
    // frames running long: the stage has already dropped sharpness or shadows; the glow goes next
    onSlow: (step) => {
      if (step >= 2 && post) post.bloom.enabled = false;
      onSlow?.(step);
    },
  });
  const { renderer, scene, camera } = stage;
  // (no shadow pass: the floor's shadows are baked, see the top)
  renderer.shadowMap.enabled = false;
  // the house look (lib/three/house): one shadow colour on everything, from
  // the hour's sky light, fog the sky's colour, under the house tone mapper
  // (its exposure on top of the hour's, which were set under ACES)
  const house = createHouse();
  renderer.toneMapping = house.toneMapping;
  // what's drawn in a frame, every pass of it counted (api.info), not just the last
  renderer.info.autoReset = false;
  // far enough for the sky dome and the Sandias
  camera.far = 2600;
  camera.near = 0.4; // (nothing's nearer than that, and the depth's sharper for it)
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color(0x0a0f1c);
  scene.fog = new THREE.Fog(0xe9c9a0, 170, 1500);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.35;
  const owned = [env];
  const own = (...xs) => (owned.push(...xs), xs[0]);
  const mobile = stage.coarse;
  const still = prefersReducedMotion();
  const aniso = Math.min(fit.aniso, renderer.capabilities.getMaxAnisotropy());

  // ── the picture: bright things bloom, then a warm grade (amber in the
  // highlights, teal in the shadows, the way the shows are timed) ──
  // The bloom is for what's really bright (a sign's neon, the sun off glass),
  // not every lit window: a high, soft threshold, a tight radius (its widest
  // levels were most of the glow, a haze over the whole night), glints held
  // down so one doesn't flare into a blob, and drawn at half the screen.
  // Only the scene's own target is multisampled: the composer's second is a
  // copy, and smoothing it again is three resolves a frame for nothing.
  if (fit.bloom > 0) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(fit.samples, 2) });
    const composer = new EffectComposer(renderer, target);
    composer.renderTarget2.samples = 0;
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM.strength * fit.bloom + 0.1, BLOOM.radius, BLOOM.threshold);
    bloom.highPassUniforms.smoothWidth.value = BLOOM.soft;
    bloom.compositeMaterial.uniforms.bloomFactors.value = BLOOM.levels;
    bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', `vec4 texel = min( texture2D( tDiffuse, vUv ), vec4( ${BLOOM.clamp.toFixed(1)} ) );`);
    bloom.materialHighPassFilter.needsUpdate = true;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GRADE);
    Object.assign(grade.uniforms.uContrast, { value: 0.2 });
    Object.assign(grade.uniforms.uSat, { value: 1.1 });
    Object.assign(grade.uniforms.uVignette, { value: 0.26 });
    grade.uniforms.uShadow.value = new THREE.Color(0, 0.012, 0.022);
    grade.uniforms.uHigh.value = new THREE.Color(0.03, 0.014, 0);
    composer.addPass(grade);
    post = { composer, bloom, grade, target };
    stage.draw = (ms) => {
      grade.uniforms.uTime.value += ms / 1000;
      composer.render();
    };
    stage.target = target; // (where the scene's drawn, for its shaders made ahead: office/stage3d's prepare)
    stage.onResize = (w, h, ratio) => {
      composer.setPixelRatio(ratio);
      composer.setSize(w, h);
      // (after the composer's, which sizes it to the device's pixels)
      bloom.setSize(Math.round(w / 2), Math.round(h / 2));
      grade.uniforms.uAspect.value = w / h;
    };
  }

  // ── light: the sun or the moon (whichever's up), the sky, the warm ground ──
  const hemi = new THREE.HemisphereLight(0xb7d3f0, 0xb08a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd6a0, 2.7);
  scene.add(sun, sun.target);
  // the floor's colour now, thrown back up onto the lower faces of everything
  // (lib/three/grounding's bounce): the hemisphere's ground colour, by the time of day
  const bounceColor = new THREE.Color(0xb08a5a);
  const bounced = new Set();
  // every lit material under `root` gets the bounce once: `floor` the height
  // it stands on, or each instance its own where it's an instanced flock
  const bounceAll = (root, floor) =>
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m || bounced.has(m) || m.isMeshBasicMaterial || m.isShaderMaterial || !('roughness' in m || m.isMeshLambertMaterial)) continue;
        bounced.add(m);
        bounce(m, { color: bounceColor, floor: floor ?? (o.isInstancedMesh ? 'instance' : 0) });
      }
    });

  // ── the sky, through the whole day ──
  const sky = own(createSky({ radius: 1300 }));
  sky.noise.anisotropy = aniso;
  scene.add(sky.mesh);
  const L = lightAt(TIMES[0].tod);
  let tod = TIMES[0].tod;
  let todTo = null; // a time being run to, fast

  // ── the ground: sand, rising into low dunes past the edge of town ──
  const rand = seeded(42);
  const groundGeo = own(new THREE.PlaneGeometry(1800, 1800, 180, 180));
  groundGeo.rotateX(-Math.PI / 2);
  {
    const p = groundGeo.attributes.position;
    // the rules say how high the ground is (the car rides the same dunes)
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, own(groundMaterial({ noise: sky.noise, roads: ROADS, bump: fit.bloom > 0 && !mobile })));
  // (drawn after what stands on it, so its shader, the dearest here, only
  // runs where the floor's seen, not under every street and building)
  ground.renderOrder = 1;
  scene.add(ground);

  // ── the mountains: the Sandias to the east, mesas in front of the rest ──
  const mountains = own(createMountains());
  scene.add(mountains.group);

  // ── the streets, the sidewalks and the blocks, and the city on them ──
  const streets = own(createStreets({ ground: ground.material, aniso, small: mobile }));
  scene.add(streets.object);
  const city = own(createCity({ noise: sky.noise }));
  scene.add(city.object);
  bounceAll(city.object, GRID.kerb);

  // ── the desert: creosote, yucca, cholla and rocks, never on a road or in a building ──
  const cityEdge = { x: GRID.xs.at(-1) + 10, z: GRID.zs.at(-1) + 10 };
  const clear = (x, z, pad) => {
    if (Math.abs(x) < cityEdge.x + pad && Math.abs(z) < cityEdge.z + pad) return false;
    if (Math.abs(z - RAIL.z) < 5 + pad) return false;
    for (const r of ROADS) {
      const dx = r.b.x - r.a.x;
      const dz = r.b.z - r.a.z;
      const t = Math.max(0, Math.min(1, ((x - r.a.x) * dx + (z - r.a.z) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - (r.a.x + t * dx), z - (r.a.z + t * dz)) < r.w / 2 + pad) return false;
    }
    for (const c of collidersNear(x, z)) if (Math.abs(x - c.x) < c.w / 2 + pad + 2 && Math.abs(z - c.z) < c.d / 2 + pad + 2) return false;
    for (const p of PLACES) if (Math.hypot(x - p.door.x, z - p.door.z) < p.radius + 2) return false;
    return true;
  };
  const scatter = (geo, mat, n, { pad = 2, rMin = 0, rMax = 420, scale = [0.7, 1.4], tint }) => {
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    let k = 0;
    for (let tries = 0; k < n && tries < n * 30; tries++) {
      const a = rand() * Math.PI * 2;
      const r = rMin + Math.sqrt(rand()) * (rMax - rMin);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!clear(x, z, pad)) continue;
      const s = scale[0] + rand() * (scale[1] - scale[0]);
      o.position.set(x, groundHeight(x, z), z);
      o.rotation.set(0, rand() * Math.PI * 2, 0);
      o.scale.setScalar(s);
      o.updateMatrix();
      inst.setMatrixAt(k, o.matrix);
      if (tint) inst.setColorAt(k, c.copy(tint[0]).lerp(tint[1], rand()));
      k++;
    }
    inst.count = k;
    bounceAll(inst);
    scene.add(inst);
    return inst;
  };
  {
    // creosote: a cluster of blobs
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.IcosahedronGeometry(0.55 + (i % 3) * 0.12, 0);
      b.translate(Math.sin(i * 2.4) * 0.5, 0.45 + (i % 2) * 0.25, Math.cos(i * 2.4) * 0.5);
      parts.push(b);
    }
    const shrub = own(mergeGeometries(parts));
    for (const p of parts) p.dispose();
    const shrubMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));
    scatter(shrub, shrubMat, mobile ? 260 : 520, { pad: 1.5, tint: [new THREE.Color(0x6a7440), new THREE.Color(0x8f8a52)] });
    // yucca: a spray of blades
    const blades = [];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.ConeGeometry(0.07, 1.4, 3);
      b.translate(0, 0.7, 0);
      b.rotateZ(0.35 + (i % 3) * 0.12);
      b.rotateY((i / 9) * Math.PI * 2);
      blades.push(b);
    }
    const yucca = own(mergeGeometries(blades));
    for (const b of blades) b.dispose();
    scatter(yucca, own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true })), mobile ? 70 : 140, { pad: 2, tint: [new THREE.Color(0x5f7a4a), new THREE.Color(0x8aa060)] });
    // cholla: a trunk and crooked arms
    const arms = [new THREE.CylinderGeometry(0.16, 0.2, 1.8, 6).translate(0, 0.9, 0)];
    for (let i = 0; i < 4; i++) {
      const a = new THREE.CylinderGeometry(0.11, 0.13, 0.8, 5);
      a.rotateZ(0.9);
      a.translate(0.3, 0.9 + i * 0.25, 0);
      a.rotateY(i * 1.7);
      arms.push(a);
    }
    const cholla = own(mergeGeometries(arms));
    for (const a of arms) a.dispose();
    scatter(cholla, own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true })), mobile ? 40 : 90, { pad: 2, scale: [0.8, 1.5], tint: [new THREE.Color(0x7d8f55), new THREE.Color(0x9aa46a)] });
    // rocks
    const rock = own(new THREE.DodecahedronGeometry(0.8, 0));
    {
      const p = rock.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.25), p.getY(i) * 0.6, p.getZ(i) * (1 + Math.cos(i * 2.3) * 0.2));
      rock.computeVertexNormals();
    }
    scatter(rock, own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true })), mobile ? 120 : 240, { pad: 1, scale: [0.5, 2.2], tint: [new THREE.Color(0x9a7a5a), new THREE.Color(0xc0a07a)] });
  }

  // (the street lamps are the city's)
  const lampHeads = city.lamps;

  // ── the edge of the world: a ranch fence all the way round, where you can see it ──
  {
    const R = WORLD_RADIUS + 1.6;
    const n = Math.round((Math.PI * 2 * R) / 7);
    const postGeo = own(new THREE.CylinderGeometry(0.07, 0.09, 1.7, 5).translate(0, 0.85, 0));
    const posts = new THREE.InstancedMesh(postGeo, own(new THREE.MeshStandardMaterial({ color: 0x5b4634, roughness: 1 })), n);
    const o = new THREE.Object3D();
    const wire = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const [x0, z0, x1, z1] = [Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R];
      const [y0, y1] = [groundHeight(x0, z0), groundHeight(x1, z1)];
      o.position.set(x0, y0 - 0.1, z0);
      o.rotation.set(0, i * 1.7, 0.04 * Math.sin(i * 2.1));
      o.updateMatrix();
      posts.setMatrixAt(i, o.matrix);
      for (const h of [0.55, 1.0, 1.45]) wire.push(x0, y0 + h, z0, (x0 + x1) / 2, (y0 + y1) / 2 + h - 0.07, (z0 + z1) / 2, (x0 + x1) / 2, (y0 + y1) / 2 + h - 0.07, (z0 + z1) / 2, x1, y1 + h, z1);
    }
    posts.frustumCulled = false;
    const wg = own(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    const wires = new THREE.LineSegments(wg, own(new THREE.LineBasicMaterial({ color: 0x3a3028 })));
    wires.frustumCulled = false;
    scene.add(posts, wires);
  }

  // ── signs and markers at each place ──
  const signs = {};
  const markers = {};
  const ringMat = (c) => own(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const signPost = own(new THREE.MeshStandardMaterial({ color: 0x5d6064, roughness: 0.5, metalness: 0.6 }));
  for (const p of PLACES) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const tex = own(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    sharpen(tex);
    const face = own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
    const sign = new THREE.Group();
    const board = new THREE.Mesh(own(new THREE.PlaneGeometry(5.2, 2.6)), face);
    board.position.y = 3.6;
    const back = board.clone();
    back.rotation.y = Math.PI;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(own(new THREE.CylinderGeometry(0.09, 0.09, 4.9, 6)), signPost);
      post.position.set(s * 2.2, 2.45, -0.06);
      sign.add(post);
    }
    sign.add(board, back);
    // on the sidewalk in front, to one side of the door, facing the road the
    // way the building does: from the door toward the building till it's
    // off the road, then a little further, then along the kerb
    {
      const tl = Math.hypot(p.at.x - p.door.x, p.at.z - p.door.z) || 1;
      const tx = (p.at.x - p.door.x) / tl;
      const tz = (p.at.z - p.door.z) / tl;
      let sx = p.door.x;
      let sz = p.door.z;
      for (let k = 0; k < 120 && onRoad(sx, sz); k++) {
        sx += tx * 0.25;
        sz += tz * 0.25;
      }
      sx += tx * 1.4 - tz * (p.radius - 1);
      sz += tz * 1.4 + tx * (p.radius - 1);
      sign.position.set(sx, surfaceHeight(sx, sz), sz);
    }
    sign.rotation.y = p.yaw;
    scene.add(sign);
    // a frame of neon round the board, lit after dark
    const neon = own(new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const tube = own(mergeGeometries([new THREE.BoxGeometry(5.5, 0.09, 0.09).translate(0, 4.98, 0), new THREE.BoxGeometry(5.5, 0.09, 0.09).translate(0, 2.22, 0), new THREE.BoxGeometry(0.09, 2.85, 0.09).translate(-2.75, 3.6, 0), new THREE.BoxGeometry(0.09, 2.85, 0.09).translate(2.75, 3.6, 0)]));
    sign.add(new THREE.Mesh(tube, neon));
    signs[p.id] = { ctx: c.getContext('2d'), tex, key: '', face, neon, hue: new THREE.Color(NEON[p.id] ?? 0xffffff) };
    // the marker: a ring on the ground and a diamond over it
    const ring = new THREE.Mesh(own(new THREE.RingGeometry(p.radius - 1.2, p.radius - 0.7, 48)), ringMat(0xf0c330));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.door.x, 0.08, p.door.z);
    const ic = document.createElement('canvas');
    ic.width = ic.height = 256;
    const icTex = own(new THREE.CanvasTexture(ic));
    icTex.colorSpace = THREE.SRGBColorSpace;
    const icon = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: icTex, depthWrite: false, toneMapped: false })));
    icon.scale.setScalar(2.6);
    icon.position.set(p.door.x, 5, p.door.z);
    scene.add(ring, icon);
    markers[p.id] = { ring, icon, ictx: ic.getContext('2d'), icTex, open: null };
  }

  // the unlock beam: a tall column of light over a place, for a few seconds
  const beamMat = own(new THREE.MeshBasicMaterial({ color: 0xf6d76a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const beamMesh = new THREE.Mesh(own(new THREE.CylinderGeometry(2.4, 3.4, 120, 24, 1, true)), beamMat);
  beamMesh.visible = false;
  scene.add(beamMesh);
  let beamAt = -1;

  // ── dust: puffs kicked up behind the car ──
  let cloud = null;
  const dust = [];
  const dustMat = own(new THREE.SpriteMaterial({ color: 0xd9bf98, transparent: true, opacity: 0, depthWrite: false }));
  for (let i = 0; i < (mobile ? 12 : 22); i++) {
    const s = new THREE.Sprite(dustMat.clone());
    owned.push(s.material);
    s.visible = false;
    scene.add(s);
    dust.push({ s, t: 1, v: new THREE.Vector3() });
  }
  let dustNext = 0;

  // ── rubber on the road: where the back tyres slid, a dark strip each, the
  // oldest painted over when they run out (one draw) ──
  const MARKS = mobile ? 160 : 360;
  const markMat = own(new THREE.MeshBasicMaterial({ color: 0x15120f, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  const marks = new THREE.InstancedMesh(own(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), markMat, MARKS);
  marks.frustumCulled = false;
  marks.renderOrder = -1; // straight after the ground: under the smoke, the rings at the doors and the ghosts
  {
    const none = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MARKS; i++) marks.setMatrixAt(i, none);
  }
  scene.add(marks);
  owned.push(marks);
  let markNext = 0;
  const markFrom = [null, null]; // where each back tyre last left rubber (null: it wasn't sliding)
  const markO = new THREE.Object3D();
  const layMarks = (c, gy, on) => {
    const sn = Math.sin(c.yaw);
    const cs = Math.cos(c.yaw);
    let laid = false;
    for (let i = 0; i < 2; i++) {
      if (!on) {
        markFrom[i] = null;
        continue;
      }
      const side = i ? 0.78 : -0.78;
      const x = c.x - sn * 1.3 + cs * side;
      const z = c.z - cs * 1.3 - sn * side;
      const from = markFrom[i];
      if (!from) {
        markFrom[i] = { x, z };
        continue;
      }
      const len = Math.hypot(x - from.x, z - from.z);
      if (len < 0.4) continue;
      // (a jump, back home or to a door: no strip across town)
      if (len < 6) {
        markO.position.set((x + from.x) / 2, gy + 0.068, (z + from.z) / 2);
        markO.rotation.set(0, Math.atan2(x - from.x, z - from.z), 0);
        markO.scale.set(0.24, 1, len + 0.08);
        markO.updateMatrix();
        marks.setMatrixAt(markNext, markO.matrix);
        markNext = (markNext + 1) % MARKS;
        laid = true;
      }
      from.x = x;
      from.z = z;
    }
    if (laid) marks.instanceMatrix.needsUpdate = true;
  };

  // ── the models ──
  const loader = gltfLoader();
  const names = ['aztek', 'suv', ...new Set([...PLACES, ...LANDMARKS].map((p) => p.model)), 'house', ...Object.values(TOWN_MODELS), 'tank', 'cactus', 'tumbleweed', 'bucket'];
  // (the floor's masks come with the models; a phone saving data on the low
  // tier goes without them, and its floor without their shadows)
  const lean = device().saveData && device().tier === 'low';
  const [loaded, cloudTex, floorBake] = await Promise.all([
    Promise.all(names.map((n) => loadModel(loader, n).then((o) => [n, o]))).then(Object.fromEntries),
    loadTexture('cloud.webp').catch(() => null),
    lean ? null : loadFloorShadow(SHADOW_DIR, { renderer, shade: SHADE }),
  ]);
  cloud = cloudTex;
  if (cloud) for (const d of dust) d.s.material.map = cloud;
  // (`floor`: the height it stands on, for the bounce off it)
  // the core kit's stucco (lib/three/core) on the town's own buildings, at
  // its real size: up close a wall shows the grain of real plaster instead
  // of its one stretched picture (the cars wear nothing)
  const STUCCO = coreOf('adobe');
  const stucco = dev.tier === 'low' ? Promise.resolve(null) : loadCore('adobe');
  const dressModel = (o, name, floor = GRID.kerb) => {
    const own3 = !SKETCHFAB[name]; // the site's own Meshy models are matte; a Sketchfab one keeps the materials it came with
    const building = own3 && !['aztek', 'suv'].includes(name);
    o.traverse((m) => {
      if (!m.isMesh) return;
      if (m.material.map) m.material.map.anisotropy = aniso;
      if (building) stucco.then((scan) => scan && wear(m.material, scan, { metres: STUCCO.metres, mean: STUCCO.mean, strength: 0.3, normal: 0.6 }));
      if (own3) {
        m.material.roughness = 0.85;
        m.material.metalness = 0;
      } else if (m.material.metalness > 0.2) m.material.metalness = 0.2; // under an open sky, bare metal has only the sky to show
      owned.push(m.geometry, m.material, ...(m.material.map ? [m.material.map] : []));
    });
    bounceAll(o, floor);
    return o;
  };
  const make = (name, floor) => {
    const g = new THREE.Group();
    const m = loaded[name] ? dressModel(loaded[name], name, floor) : standIn(name);
    if (!loaded[name]) bounceAll(m, floor ?? GRID.kerb);
    m.rotation.y = FACING[name] ?? 0;
    g.add(m);
    return g;
  };
  const placed = {};
  for (const p of [...PLACES, ...LANDMARKS]) {
    const b = make(p.model, surfaceHeight(p.at.x, p.at.z));
    b.position.set(p.at.x, surfaceHeight(p.at.x, p.at.z), p.at.z);
    b.rotation.y = p.yaw;
    scene.add(b);
    placed[p.id] = b;
  }
  // (for the QA scripts: each building's real footprint, to check the rules' colliders against)
  const footprints = {};
  if (import.meta.env.DEV)
    for (const [id, b] of Object.entries(placed)) {
      b.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(b);
      footprints[id] = { x: +((box.min.x + box.max.x) / 2).toFixed(2), z: +((box.min.z + box.max.z) / 2).toFixed(2), w: +(box.max.x - box.min.x).toFixed(2), d: +(box.max.z - box.min.z).toFixed(2), h: +box.max.y.toFixed(2) };
    }
  // the rest of town: Meshy's buildings where they've been made, built in code where not
  const town = own(
    createTown({
      aniso,
      small: mobile,
      models: Object.fromEntries(Object.entries(TOWN_MODELS).map(([id, name]) => [id, loaded[name] ? dressModel(loaded[name], name) : null])),
      tankCar: loaded.tank ? dressModel(loaded.tank, 'tank', 0.1) : null,
    }),
  );
  scene.add(town.object);
  bounceAll(town.object, GRID.kerb);
  // the neighbours: Walt's house again, turned and tinted, as one draw
  {
    let mesh = null;
    loaded.house?.traverse((o) => o.isMesh && !mesh && (mesh = o));
    if (mesh) {
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, HOUSES.length);
      const o = new THREE.Object3D();
      const parent = new THREE.Matrix4();
      mesh.updateWorldMatrix(true, false);
      HOUSES.forEach((h, i) => {
        o.position.set(h.at.x, GRID.kerb, h.at.z);
        o.rotation.set(0, h.yaw + (FACING.house ?? 0), 0);
        o.scale.setScalar(0.82);
        o.updateMatrix();
        inst.setMatrixAt(i, parent.multiplyMatrices(o.matrix, mesh.matrixWorld));
      });
      scene.add(inst);
    } else
      for (const h of HOUSES) {
        const b = standIn('house');
        b.position.set(h.at.x, GRID.kerb, h.at.z);
        b.rotation.y = h.yaw;
        b.scale.setScalar(0.8);
        scene.add(b);
      }
  }
  // Walt's Aztek, which leans as it goes, and Hank's SUV with its lights
  const car = new THREE.Group();
  const body = make('aztek', 0);
  car.add(body);
  scene.add(car);
  // (the Aztek's floor goes where it goes: its bounce follows it, per frame)
  const carBounce = new Set();
  body.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m?.userData.bounce && carBounce.add(m.userData.bounce.uBounceFloor)));
  const hank = new THREE.Group();
  hank.add(make('suv', 0));
  const siren = ['#ff2a2a', '#2a6bff'].map((c, i) => {
    const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    s.material.color.multiplyScalar(3);
    s.scale.setScalar(1.8);
    s.position.set(i ? 0.5 : -0.5, 2.25, 0.4);
    hank.add(s);
    return s;
  });
  scene.add(hank);
  // the town's traffic and the cars parked about it (Hank's is his own model)
  const fleet = own(createFleet({ parked: CITY.parked.map((p) => ({ ...p, y: GRID.kerb })), max: mobile ? 8 : 14 }));
  scene.add(fleet.object);
  bounceAll(fleet.object);
  const moving = [];
  const carSizes = new Map(); // a kind's blob, by its type
  const blobOf = (type) => {
    if (!carSizes.has(type)) {
      const [w, l] = footprint(type);
      carSizes.set(type, [w + 1.3, l + 0.6]);
    }
    return carSizes.get(type);
  };
  // the other drivers: Walt's Aztek again (its geometry and materials, under
  // the ghosts' own), rocking a little on its springs as it goes
  const ghosts = createGhosts({
    height: surfaceHeight,
    make: () => {
      const g = new THREE.Group();
      const m = loaded.aztek ? loaded.aztek.clone(true) : standIn('aztek');
      m.rotation.y = FACING.aztek;
      g.add(m);
      // (the real one's geometry and materials: left alone when a ghost goes)
      return loaded.aztek ? { group: g, top: 2.1, shared: true, dispose: () => {} } : { group: g, top: 2.1 };
    },
    tag: 0.9,
    halo: 6.5,
    animate: (f, t, p) => {
      f.group.position.y = p.moving ? Math.abs(Math.sin(t * 7)) * 0.05 : 0;
    },
    snap: 40, // (a car covers ground between steps)
  });
  scene.add(ghosts.group);

  // ── the Aztek's lights: two beams out front after dark, tail lights always ──
  const glow = own(glowTexture());
  const beams = new THREE.SpotLight(0xfff1d0, 0, 70, 0.52, 0.7, 1.1);
  beams.position.set(0, 1.1, 1.6);
  beams.target.position.set(0, 0.2, 16);
  car.add(beams, beams.target);
  const lampMat = own(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0xfff1d0).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const tailMat = own(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0xff2a1a).multiplyScalar(3), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const [x, z, m, sc] of [[-0.7, 2.25, lampMat, 0.8], [0.7, 2.25, lampMat, 0.8], [-0.72, -2.2, tailMat, 0.6], [0.72, -2.2, tailMat, 0.6]]) {
    const sp = new THREE.Sprite(m);
    sp.position.set(x, 0.95, z);
    sp.scale.setScalar(sc);
    car.add(sp);
  }

  // ── the cast, out where they belong: Jesse by the RV, Saul at his door, Gus
  // outside Los Pollos, Mike at the laundry, Badger and Skinny Pete at the Dog
  // House, Tuco at Tampico (./street.js); on a phone, or without the bloom,
  // the three you go to see first. Each stands on clips (office/people.js:
  // a calm idle, the clip library's for the rest), their heads on Walt's car
  // when it's near, and each with their own way of taking it (Saul waves you
  // in, Tuco pounds his chest). With the bloom, a few more with errands on
  // the sidewalks. Jesse is as the universe’s wardrobe has him: in his
  // hoodie or the lab’s suit, its colours and his gear on. ──
  const cast = []; // { id, p, clock (how often it's stepped), errand?, doing, talk }
  let people = null;
  let gone = false;
  const undress = [];
  const street = createStreet();
  {
    const jesse = dressedAs('jesse', readLooks(local.get(LOOK_KEY)).jesse);
    const specOf = (id) => (id === 'jesse' ? jesse.spec : ABQ[id]);
    const ids = castFor({ phone: mobile, bloom: fit.bloom });
    const walkers = mobile || !(fit.bloom > 0) ? [] : CIVILIANS;
    loadPeople([...ids.map(specOf), ...walkers.map((c) => ABQ[c.id])].filter(Boolean), null, { clips: true })
      .then((got) => {
        if (gone) return got.dispose();
        people = got;
        for (const id of ids) {
          const [, x, z, yaw] = CAST_AT.find(([k]) => k === id);
          const p = got.person(specOf(id), { pose: 'stand', idle: true, anim: true });
          if (!p) continue;
          if (id === 'jesse') undress.push(dress(p, jesse.look));
          p.group.position.set(x, surfaceHeight(x, z), z);
          p.group.rotation.y = yaw;
          scene.add(p.group);
          cast.push({ id, p, clock: budgetClock(cast.length + 1), doing: null, talk: false });
        }
        walkers.forEach((c, i) => {
          const b = CITY.blocks.find((k) => c.near.x > k.kerb.x0 && c.near.x < k.kerb.x1 && c.near.z > k.kerb.z0 && c.near.z < k.kerb.z1);
          const p = b && got.person(ABQ[c.id], { pose: 'stand', idle: true, anim: true });
          if (!p) return;
          scene.add(p.group);
          const errand = createErrand({ ring: ringOf(b.kerb), stops: c.stops, seed: 31 + i, pace: c.pace });
          cast.push({ id: c.id, p, clock: budgetClock(cast.length + 1), errand, phone: Boolean(c.phone), doing: null, talk: false });
        });
      })
      .catch(() => {});
  }
  const lookAt = new THREE.Vector3();
  // what the street makes of the car (./street.js), on each of them; and
  // the walkers along their errands. Each stepped as often as it's near the
  // camera (every frame up close, every second or fourth further off)
  const stepCast = (state, dt) => {
    const c = state.car;
    const car = { x: c.x, z: c.z, yaw: c.yaw, speed: c.speed };
    const acts = street.step(dt, { car, near: state.near });
    for (const f of cast) {
      const p = f.p;
      if (f.errand) {
        const e = f.errand.step(dt, car);
        p.group.position.set(e.x, surfaceHeight(e.x, e.z), e.z);
        p.group.rotation.y = e.yaw;
        // (Lydia's always on the phone; the rest do their thing at their stops)
        const doing = e.doing ?? (f.phone ? 'phone' : null);
        if (doing !== f.doing) {
          if (f.doing) p.stop('upper');
          if (doing) p.play(doing, { layer: 'upper', loop: doing !== 'scared' });
          f.doing = doing;
        }
        p.look(Math.hypot(c.x - e.x, c.z - e.z) < 12 ? lookAt.set(c.x, surfaceHeight(c.x, c.z) + 1.1, c.z) : null);
      } else {
        const a = acts[f.id];
        if (a) {
          p.look(a.look ? lookAt.set(a.look.x, surfaceHeight(a.look.x, a.look.z) + (a.look.y ?? 1.1), a.look.z) : null);
          if (a.clip) p.play(a.clip, { layer: a.layer });
          if (a.gesture) p.gesture(a.gesture);
          if (a.talk !== f.talk) {
            if (a.talk) p.play('talk', { layer: 'upper', loop: true });
            else if (p.anim?.playing('upper') === 'talk') p.stop('upper');
            f.talk = a.talk;
          }
        }
      }
      const d = camera.position.distanceTo(p.group.position);
      const step = f.clock(d < 40 ? 1 : d < 120 ? 0.5 : 0.25, dt);
      if (step > 0) p.update(clock, step);
    }
  };

  // ── what moves and glows ──
  const balloons = own(createBalloons({ count: mobile ? 16 : 34 }));
  const weeds = own(createTumbleweeds({ count: mobile ? 4 : 7, radius: 340, height: groundHeight, model: loaded.tumbleweed ? dressModel(loaded.tumbleweed, 'tumbleweed') : null }));
  // cacti from the pack: each of its nine as its own flock, stood upright on its base
  if (loaded.cactus) {
    loaded.cactus.updateMatrixWorld(true);
    const kinds = [];
    loaded.cactus.traverse((o) => o.isMesh && kinds.push(o));
    kinds.slice(0, mobile ? 4 : 9).forEach((src, i) => {
      const geo = own(src.geometry.clone().applyMatrix4(src.matrixWorld));
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const tall = Math.max(1e-3, bb.max.y - bb.min.y);
      geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(1 / tall, 1 / tall, 1 / tall);
      if (src.material.map) src.material.map.anisotropy = aniso;
      owned.push(src.material);
      scatter(geo, src.material, mobile ? 5 : 9, { pad: 3, rMin: 40, rMax: 400, scale: [2.4 + (i % 3) * 0.6, 4.6 + (i % 3)] });
    });
  }
  const crystals = own(createCrystals({ glow }));
  const doors = PLACES.map((p) => ({ x: p.door.x, z: p.door.z, r: p.radius + 3, color: NEON[p.id] }));
  const night = own(
    createNightLights({
      glow,
      lamps: lampHeads,
      pools: [...lampHeads.map((l) => ({ x: l.x, z: l.z, r: 9 })), ...doors, ...LANDMARKS.map((l) => ({ x: l.at.x, z: l.at.z - 9, r: 12, color: 0x7ab8ff }))],
    }),
  );
  scene.add(balloons.object, weeds.object, crystals.object, night.object);

  // ── grounding: the floor's baked shadows, and a blob under what moves ──
  const floors = [ground.material, ...streets.floors, ...town.floors];
  if (floorBake) {
    for (const m of floors) floorShadow(m, floorBake);
    owned.push(floorBake);
  }
  const blobs = own(createBlobShadows({ color: SHADE, max: 96, ground: surfaceHeight }));
  scene.add(blobs.mesh);
  let baking = false; // (dev: the floor's shadows being baked, api.bake; nothing else draws meanwhile)
  let roof = null; // where on Walt's roof the pizza lies, and which way the slope faces
  const rv = PLACES.find((p) => p.id === 'rv');
  const smoke = cloud ? own(createSmoke({ x: rv.at.x + 0.6, y: 3.3, z: rv.at.z, map: cloud })) : null;
  if (smoke) scene.add(smoke.object);
  // the pizza, where it landed: find the roof under it and lay it on the slope
  {
    const home = PLACES.find((p) => p.id === 'home');
    const house = loaded.house ? placed.home : null;
    house?.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster(new THREE.Vector3(home.at.x + 3.2, 40, home.at.z + 2.6), new THREE.Vector3(0, -1, 0));
    const hit = house ? ray.intersectObject(house, true)[0] : null;
    if (hit && hit.point.y > 1.5) {
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (n.y < 0) n.negate();
      roof = { at: hit.point.clone(), n, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n) };
    }
  }
  // pizzas: the one that's always been up there, and any you throw
  const pizzaKit = own(createPizza());
  const pizzas = [];
  const flying = [];
  const landPizza = (k) => {
    if (!roof) return null;
    const m = pizzaKit.object.clone();
    // each lands a little off from the last, up and down the slope
    const side = new THREE.Vector3(1, 0, 0);
    const down = new THREE.Vector3().crossVectors(side, roof.n).normalize();
    m.userData.rest = roof.at.clone().addScaledVector(side, ((k * 1.9) % 5) - 2.4).addScaledVector(down, ((k * 1.3) % 2) - 0.8).addScaledVector(roof.n, 0.06 + k * 0.004);
    m.position.copy(m.userData.rest);
    m.quaternion.copy(roof.q);
    m.rotateY(k * 2.1);
    scene.add(m);
    pizzas.push(m);
    return m;
  };
  landPizza(0);

  // a delivery's drop: a column of green light, a ring on the ground and a crate
  const dropMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x58ff8a).multiplyScalar(1.5), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  const drop = new THREE.Group();
  const dropBeam = new THREE.Mesh(own(new THREE.CylinderGeometry(0.5, 1.6, 90, 16, 1, true).translate(0, 45, 0)), dropMat);
  const dropRing = new THREE.Mesh(own(new THREE.RingGeometry(5.2, 5.9, 48).rotateX(-Math.PI / 2)), own(new THREE.MeshBasicMaterial({ color: 0x58ff8a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })));
  dropRing.position.y = 0.12;
  const crate = new THREE.Mesh(own(new THREE.BoxGeometry(1.1, 0.8, 0.8)), own(new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.9 })));
  // (with the model, what's waiting at the drop is a bucket of Los Pollos Hermanos' finest)
  if (loaded.bucket) {
    const b = dressModel(loaded.bucket, 'bucket');
    b.scale.setScalar(1.7);
    b.position.y = -0.7;
    crate.geometry = own(new THREE.BufferGeometry());
    crate.add(b);
  }
  drop.add(dropBeam, dropRing, crate);
  drop.visible = false;
  scene.add(drop);

  // suds, for the car wash
  const foam = [];
  if (cloud)
    for (let i = 0; i < 16; i++) {
      const m = own(new THREE.SpriteMaterial({ map: cloud, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      scene.add(sp);
      foam.push({ sp, m, ph: i * 2.399 });
    }
  let washing = 0;
  const waterMat = own(new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const water = new THREE.Mesh(own(new THREE.CylinderGeometry(2.6, 3.2, 3.4, 20, 1, true).translate(0, 1.7, 0)), waterMat);
  water.position.set(WASH.x, 0, WASH.z);
  scene.add(water);

  // ── per frame ──
  const camPos = new THREE.Vector3(0, 120, 160);
  const camLook = new THREE.Vector3();
  const want = new THREE.Vector3();
  const look = new THREE.Vector3();
  const v = new THREE.Vector3();
  let clock = 0;
  let intro = 0; // seconds into the swoop down from over the town
  let snap = false; // straight to behind the car on the next frame
  // the Aztek's weight (lib/vehicleFeel): thrown out of a turn and back on
  // the throttle as it was (its old numbers: 0.07 of roll at 19 m/s² round a
  // corner, 0.004 of pitch a m/s², eased about as quickly), and a squash on
  // a spring for a bump, a kerb and the ruts off the road
  const carFeel = createVehicleFeel({ rollPer: 0.07 / 19, rollMax: 0.11, pitchPer: 0.004, pitchMax: 0.05, ease: 6, squashPerHit: 0.12 });
  let carBody = null; // (attached once the body's there)
  let rut = 0; // seconds to the next rut off the road
  let lastSpeed = 0;
  // the shake (lib/three/feel: still under reduced motion), as big as the
  // old one's ±0.2 m and gone as quickly
  const feel = createFeel({ offset: 0.2, baseFov: 58 });
  feel.set({ decay: 2.5 });
  // a bump into a wall, a car or the fence: a thud by how hard, from where
  // it was, and a puff there (the shake is the bump's own, below)
  const knockDust = createDust({ count: 48, colour: 0xd9bf98, size: 1.1 });
  const ear = new THREE.Vector3();
  scene.add(knockDust.mesh);
  const knockRules = createImpacts();
  const knocks = wireImpacts({
    rules: knockRules,
    dust: knockDust,
    listener: () => ({ position: camera.position.toArray(), forward: camera.getWorldDirection(ear).toArray() }),
    toWorld: (at) => (Array.isArray(at) ? at : [at.x, surfaceHeight(at.x, at.z) + 0.6, at.z]),
  });
  let fov = 58;
  let idle = 0; // seconds parked, before the camera wanders off round the car
  let orbit = 0;
  let aurora = 0;
  let auroraTo = 0;
  let peek = null; // (dev only: a fixed camera for the QA scripts)

  // the light for the time of day, on everything that takes it
  const skyCols = { top: new THREE.Color(), low: new THREE.Color(), ground: new THREE.Color() };
  function applyLight() {
    lightAt(tod, L);
    // how much of the floor's light is the sun's: none at night, a little
    // just after sunrise, all of it from a few degrees up (the shadows' tint
    // and the blobs' strength follow it)
    const sunShare = L.key === L.sun ? THREE.MathUtils.smoothstep(L.sun.y, 0, 0.15) : 0;
    setFloorTime(floorBake, tod, sunShare);
    bounceColor.copy(L.hemiGround);
    // the blobs lie away from the sun while it's up, from the moon (and fainter) when it isn't
    if (L.sun.y > 0) blobs.setSun(L.sun, 0.5 + 0.5 * sunShare);
    else blobs.setSun(L.moon, 0.5);
    sky.uniforms.uSun.value.copy(L.sun);
    sky.uniforms.uMoon.value.copy(L.moon);
    sun.color.copy(L.keyColor);
    sun.intensity = L.keyIntensity;
    hemi.color.copy(L.hemiSky);
    hemi.groundColor.copy(L.hemiGround);
    hemi.intensity = L.hemiIntensity;
    scene.fog.color.copy(L.fog);
    scene.environmentIntensity = L.env;
    renderer.toneMappingExposure = L.exposure * house.exposure;
    house.light({ sun, hemi });
    house.set({ shadow: shadowFor({ hemiSky: hemi.color.getHex(), hemi: hemi.intensity }) });
    house.sky({ low: L.fog, high: L.hemiSky, below: 1, sunDir: L.key });
    const dark = L.night;
    night.update(dark);
    fleet.update(dark);
    skyCols.top.copy(L.hemiSky);
    skyCols.low.copy(L.fog);
    skyCols.ground.copy(L.hemiGround);
    beams.intensity = dark * 28; // (enough to see the road by, not to flare off every window)
    lampMat.opacity = dark * 0.7;
    for (const p of PLACES) {
      const s = signs[p.id];
      // (the lettering lit enough to read, under the bloom; the neon round it just over)
      s.face.emissiveIntensity = 0.25 + dark * 0.55;
      s.neon.color.copy(s.hue).multiplyScalar(dark * 1.8);
    }
    // (gentler after dark, when there's far more that's bright, not stronger)
    if (post) post.bloom.strength = (BLOOM.strength * fit.bloom + 0.1) * (1 - BLOOM.night * dark);
  }
  applyLight();

  function setPlaces(prog) {
    for (const p of prog.places) {
      const s = signs[p.id];
      const key = `${p.open}`;
      if (s.key !== key) {
        s.key = key;
        paintSign(s.ctx, p, p.open);
        s.tex.needsUpdate = true;
      }
      const m = markers[p.id];
      if (m.open !== p.open) {
        m.open = p.open;
        paintIcon(m.ictx, p.open, GLYPH[p.id]);
        m.icTex.needsUpdate = true;
        m.ring.material.color.set(p.open ? 0xf0c330 : 0x9a9f9c);
      }
      m.next = p.id === prog.next;
    }
  }

  function render(state, ms = 16) {
    if (stage.lost || baking) return;
    const dt = Math.min(0.05, ms / 1000);
    clock += dt;
    const c = state.car;
    // the day: on its own slowly, or run fast to a time that's been asked for
    if (todTo != null) {
      const left = (((todTo - tod) % 1) + 1) % 1;
      const step = dt * 0.3;
      if (left <= step) {
        tod = todTo;
        todTo = null;
      } else tod = (tod + step) % 1;
    } else if (!still) tod = (tod + dt / DAY) % 1;
    applyLight();
    sky.uniforms.uTime.value = still ? 40 : clock + tod * 900;
    aurora += (auroraTo - aurora) * Math.min(1, dt * 0.5);
    sky.uniforms.uAurora.value = aurora;
    const dawn = Math.max(0, 1 - Math.abs(L.sun.y) / 0.3); // a low sun, or none: the burners show
    balloons.update(still ? 0 : clock, Math.min(1, dawn * 0.6 + L.night * 0.35));
    if (!still) weeds.update(dt, clock);
    crystals.update(dt, clock, L.night);
    town.update(dt, still ? 0 : clock, L.night);
    city.update(state.t ?? clock, L.night, skyCols);
    // the traffic (all but Hank, who's his own model), on the street or a kerb up
    moving.length = 0;
    for (const t of state.traffic ?? []) {
      if (t.route) continue;
      t.paint ??= paintFor(t.tint, t.type);
      moving.push({ x: t.x, y: groundHeight(t.x, t.z), z: t.z, yaw: t.yaw, type: t.type, paint: t.paint });
    }
    fleet.set(moving);
    if (!still && cast.length) stepCast(state, dt);
    smoke?.update(still ? 0 : dt, 0.3 + 0.7 * L.day);
    tailMat.opacity = 0.16 + L.night * 0.34 + ((state.throttle ?? 0) < -0.1 || state.handbrake ? 0.5 : 0);
    // the car: where it is (a kerb up, on a block), its weight thrown out of the turn and back on the throttle
    const gy = surfaceHeight(c.x, c.z);
    const sn = Math.sin(c.yaw);
    const cs = Math.cos(c.yaw);
    // nose up a dune (or a kerb) and down the other side, and leaning across a slope
    const slope = Math.atan2(surfaceHeight(c.x + sn * 1.4, c.z + cs * 1.4) - surfaceHeight(c.x - sn * 1.4, c.z - cs * 1.4), 2.8);
    const lean = Math.atan2(surfaceHeight(c.x + cs * 0.9, c.z - sn * 0.9) - surfaceHeight(c.x - cs * 0.9, c.z + sn * 0.9), 1.8);
    car.position.set(c.x, gy, c.z);
    car.rotation.set(-slope, c.yaw, -lean, 'YXZ');
    for (const u of carBounce) u.value = gy;
    ghosts.update(state.travellers ?? [], clock, dt);
    const accel = (c.speed - lastSpeed) / Math.max(dt, 1e-3);
    lastSpeed = c.speed;
    // its weight goes to the outside of a turn, by how hard it's cornering
    // (a left turn is a positive yaw rate, and the left side comes up), and
    // onto the side it's sliding toward
    const slide = c.slide ?? 0;
    const going = Math.hypot(c.speed, slide);
    const cornering = THREE.MathUtils.clamp((c.speed * (c.yawRate ?? 0)) / 19, -1.2, 1.2);
    // (the lean's lateral acceleration, + right: a left turn's pull is to
    // the left, and the slide's lean is folded in as the old one had it)
    const lateral = -cornering * 19 + THREE.MathUtils.clamp(slide * 0.008, -0.05, 0.05) / (0.07 / 19);
    // off the road, a rut every couple of metres jolts it
    rut -= dt;
    let jolt = state.bump > 1 ? Math.min(1, state.bump / 20) : 0;
    if (Math.abs(c.speed) > 1 && !state.onRoad && rut <= 0) {
      rut = 2.2 / Math.abs(c.speed) * (0.7 + Math.random() * 0.6);
      jolt = Math.max(jolt, 0.12 + 0.12 * Math.min(1, Math.abs(c.speed) / 18));
    }
    carBody ??= attachVehicleBody({ body, forward: 'z' });
    carBody.apply(carFeel.step({ forwardAccel: accel, lateralAccel: lateral, hit: jolt }, dt));
    // Hank, and his lights when he's on you
    hank.position.set(state.hank.x, groundHeight(state.hank.x, state.hank.z), state.hank.z);
    hank.rotation.y = state.hank.yaw;
    const flash = state.heat > 0.25 ? state.heat : 0;
    siren.forEach((s, i) => (s.material.opacity = flash * (Math.sin(clock * 14 + i * Math.PI) > 0 ? 1 : 0.15)));
    // dust off the sand, the dirt, and a bump; smoke off the tyres when
    // they slide on the road, and the rubber they leave on it
    if (state.bump > 4) feel.trauma(Math.min(1, state.bump / 20));
    const slip = going > 2.5 ? (state.slip ?? 0) : 0;
    const smoking = slip > 0.3;
    layMarks(c, gy, smoking && state.onRoad && gy < 0.01);
    dustNext -= dt;
    if ((going > 5 && !state.asphalt) || state.bump > 4 || smoking) {
      if (dustNext <= 0) {
        dustNext = smoking ? 0.03 : 0.05;
        const d = dust.find((p) => p.t >= 1);
        if (d) {
          d.t = 0;
          d.s.visible = true;
          d.s.material.color.setHex(state.asphalt ? 0xe2ddd4 : 0xd9bf98);
          d.s.position.set(c.x - Math.sin(c.yaw) * 2.3 + (Math.random() - 0.5), gy + 0.5, c.z - Math.cos(c.yaw) * 2.3 + (Math.random() - 0.5));
          // (a slide's smoke is left behind where the car was going, not where it points)
          d.v.set((Math.random() - 0.5) * 1.2 + (smoking ? cs * slide * 0.12 : 0), 0.8 + Math.random(), (Math.random() - 0.5) * 1.2 - (smoking ? sn * slide * 0.12 : 0));
        }
      }
    }
    for (const d of dust) {
      if (d.t >= 1) continue;
      d.t += dt / 1.4;
      d.s.position.addScaledVector(d.v, dt);
      d.s.scale.setScalar(1 + d.t * 3.5);
      d.s.material.opacity = (1 - d.t) * 0.55;
      if (d.t >= 1) d.s.visible = false;
    }
    // the markers pulse, the next place's most
    for (const p of PLACES) {
      const m = markers[p.id];
      const near = state.near === p.id;
      const k = 0.5 + 0.5 * Math.sin(clock * (m.next ? 4 : 2));
      m.ring.material.opacity = (m.open ? 0.5 : 0.3) + k * (near ? 0.5 : 0.3);
      m.ring.scale.setScalar(1 + (near ? 0.04 * k : 0));
      m.icon.position.y = 5 + Math.sin(clock * 2 + p.door.x) * 0.3;
      m.icon.scale.setScalar(m.next ? 3.2 : 2.4);
    }
    // a delivery's drop turns and breathes
    if (drop.visible) {
      crate.rotation.y = clock * 0.9;
      crate.position.y = 1.3 + Math.sin(clock * 2.2) * 0.25;
      dropMat.opacity = 0.22 + 0.12 * Math.sin(clock * 3);
      dropRing.scale.setScalar(1 + 0.05 * Math.sin(clock * 4));
    }
    // pizzas on their way up to the roof
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t = Math.min(1, f.t + dt / 0.9);
      f.m.position.lerpVectors(f.from, f.m.userData.rest, f.t);
      f.m.position.y += Math.sin(f.t * Math.PI) * 5;
      f.m.rotateY(dt * 14 * (1 - f.t));
      if (f.t >= 1) {
        f.m.position.copy(f.m.userData.rest);
        f.m.quaternion.copy(roof.q);
        flying.splice(i, 1);
        feel.trauma(0.12);
      }
    }
    // the car wash: water coming down in the bay, and suds all over the Aztek
    if (washing > 0) {
      washing = Math.max(0, washing - dt / WASH.seconds);
      const k = Math.sin(Math.min(1, (1 - washing) * 5) * Math.PI * 0.5) * Math.min(1, washing * 5);
      waterMat.opacity = 0.16 * k;
      for (const f of foam) {
        f.sp.visible = k > 0.01;
        const a = f.ph + clock * 2.4;
        f.sp.position.set(c.x + Math.cos(a) * 1.5, gy + 0.7 + ((f.ph * 0.37 + clock * 0.9) % 1.6), c.z + Math.sin(a) * 2.4);
        f.sp.scale.setScalar(0.9 + 0.5 * Math.sin(f.ph + clock * 3));
        f.m.opacity = 0.75 * k;
      }
    } else if (waterMat.opacity > 0) {
      waterMat.opacity = 0;
      for (const f of foam) f.sp.visible = false;
    }
    // the beam over a place that's just opened
    if (beamAt >= 0) {
      beamAt += dt;
      beamMat.opacity = Math.min(1, beamAt * 2) * Math.max(0, 1 - (beamAt - 4) / 2) * 0.5;
      if (beamAt > 6) {
        beamAt = -1;
        beamMesh.visible = false;
      }
    }

    // the camera: from over the town, down behind the car, and after it. In
    // a slide it sits between where the car points and where it's going, so
    // the tail is seen to come round; into a turn it looks a little ahead.
    // (a blend of the two directions, by how much of its speed is sideways:
    // none of it driving straight, forwards or back, and it comes and goes
    // without a step however the car is turned)
    const follow = state.follow ?? 1;
    const drift = going > 0.5 ? 0.6 * Math.min(1, Math.abs(slide) / (0.35 * Math.abs(c.speed) + 2)) * Math.min(1, going / 5) : 0;
    const fwd = v.set(sn + ((sn * c.speed + cs * slide) / Math.max(going, 0.5) - sn) * drift, 0, cs + ((cs * c.speed - sn * slide) / Math.max(going, 0.5) - cs) * drift);
    if (fwd.lengthSq() > 1e-4) fwd.normalize();
    else fwd.set(sn, 0, cs);
    const back = mobile ? 11 : 9.5;
    want.set(c.x - fwd.x * back, gy + (mobile ? 5.2 : 4.4) + Math.max(0, c.speed) * 0.04, c.z - fwd.z * back);
    const lead = THREE.MathUtils.clamp((c.yawRate ?? 0) * 1.4, -2.2, 2.2) * Math.min(1, going / 8);
    // (further ahead the faster you go, so a corner's seen in time to take it)
    const ahead = 5 + Math.max(0, c.speed) * 0.4;
    look.set(c.x + fwd.x * ahead + Math.cos(c.yaw) * lead, gy + 2.3, c.z + fwd.z * ahead - Math.sin(c.yaw) * lead); // a little up, for the sky
    if (intro < 1) {
      intro = Math.min(1, intro + dt / 2.8);
      const k = intro * intro * (3 - 2 * intro);
      camPos.lerpVectors(v.set(c.x + 60, 95, c.z + 90), want, k);
      camLook.copy(look);
    } else if (snap) {
      snap = false;
      camPos.copy(want);
      camLook.copy(look);
    } else {
      // parked for a while (and not at a door): the camera drifts out and round, for the view
      idle = going < 0.4 && !state.near && !still ? idle + dt : 0;
      const wander = Math.min(1, Math.max(0, idle - 7) / 5);
      if (wander > 0) {
        orbit += dt * 0.11;
        const a = c.yaw + Math.PI + orbit;
        want.set(c.x + Math.sin(a) * 24, gy + 7 + wander * 5, c.z + Math.cos(a) * 24);
        look.set(c.x, gy + 2.2 + wander * 3, c.z);
      } else orbit = 0;
      // (kept close behind at speed: trailing back, it showed the road late)
      const k = 1 - Math.exp(-dt * (wander > 0 ? 0.9 : 6 * follow));
      camPos.lerp(want, k);
      camLook.lerp(look, 1 - Math.exp(-dt * (wander > 0 ? 1.5 : 10 * follow)));
    }
    camera.position.copy(camPos);
    // never under a dune, and never inside a building: come in towards the car until it's out
    camera.position.y = Math.max(camera.position.y, surfaceHeight(camPos.x, camPos.z) + 1.6);
    for (let n = 0; n < 8; n++) {
      const px = camera.position.x;
      const pz = camera.position.z;
      // (the buildings: not a parked car or a yard wall, which it can see over)
      if (!collidersNear(px, pz).some((b) => !b.kind && (b.h === undefined || b.h > camera.position.y - 0.5) && Math.abs(px - b.x) < b.w / 2 + 0.6 && Math.abs(pz - b.z) < b.d / 2 + 0.6)) break;
      camera.position.x += (c.x - px) * 0.22;
      camera.position.z += (c.z - pz) * 0.22;
      camera.position.y += 0.9;
    }
    camera.lookAt(camLook);
    // (the QA scripts' own view, if they've asked for one)
    if (peek) {
      camera.position.set(...peek.at);
      camera.lookAt(...peek.look);
    }
    const fovWant = 58 + Math.min(1, going / 24) * 8;
    if (Math.abs(fovWant - fov) > 0.05) {
      fov += (fovWant - fov) * Math.min(1, dt * 3);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // the shake, after the camera's placed (the fov is ours: the feel only keeps it)
    knocks.update(dt);
    roadside?.step(dt, c);
    feel.setBaseFov(camera.fov);
    if (!peek) feel.update(dt, camera);
    // the sun (or the moon) shines from where it is
    sun.target.position.set(c.x, gy, c.z);
    sun.position.copy(sun.target.position).addScaledVector(L.key, 160);
    // a blob under everything that moves: the Aztek, Hank, the traffic, the
    // cast, the tumbleweeds (by how high they've hopped) and the freight's cars
    blobs.clear();
    let nb = 0;
    blobs.set(nb++, c, 0, 0, AZTEK_BLOB, c.yaw);
    blobs.set(nb++, state.hank, 0, 0, HANK_BLOB, state.hank.yaw);
    for (const t of moving) blobs.set(nb++, t, 0, 0, blobOf(t.type), t.yaw);
    for (const f of cast) blobs.set(nb++, f.p.group.position, 0, 0, PERSON_BLOB, 0);
    for (const w of weeds.weeds) blobs.set(nb++, w.w.position, w.w.position.y - groundHeight(w.x, w.z) - 0.62 * w.s, 0, [1.4 * w.s, 1.4 * w.s], 0);
    for (const t of town.train) if (t.visible) blobs.set(nb++, t.position, 0, 0, FREIGHT_BLOB, Math.PI / 2);
    sky.mesh.position.copy(camera.position);
    renderer.info.reset();
    stage.render(ms);
  }

  // the shaders of what only shows later (the night's lamps and pools, a
  // delivery's drop, the unlock beam, the car wash's water) built now, while
  // the page is still loading, not as a stall the first time dark falls
  // (everything built so far in the house look, before the shaders are)
  // cones, bins and crates along Central, for the Aztek to send flying (./roadside.js)
  const roadside = await createStreetProps({ parent: scene, dev, impacts: knocks }).catch(() => null);
  house.adopt(scene);
  {
    const later = [night.object, drop, beamMesh, water];
    const was = later.map((o) => o.visible);
    for (const o of later) o.visible = true;
    await stage.precompile().catch(() => {});
    later.forEach((o, i) => (o.visible = was[i]));
  }

  return {
    render,
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: office/stage3d)
    setPlaces,
    // a beam of light over a place that's just opened
    beam(id) {
      const p = PLACES.find((x) => x.id === id);
      if (!p) return;
      beamMesh.position.set(p.door.x, 60, p.door.z);
      beamMesh.visible = true;
      beamAt = 0;
    },
    // straight down behind the car, no swoop (after leaving a place)
    settle() {
      intro = 1;
      snap = true;
      idle = 0;
    },
    // the time of day, 0 to 1 (0.25 is sunrise, 0.75 sunset): run there fast, or be there
    setTime(t, { jump = still } = {}) {
      if (jump) {
        tod = ((t % 1) + 1) % 1;
        todTo = null;
      } else todTo = ((t % 1) + 1) % 1;
    },
    get time() {
      return tod;
    },
    // the crystals already taken (and, with all of them, the aurora)
    setBlue(ids, all = false) {
      crystals.setGot(ids);
      auroraTo = all ? 1 : 0;
    },
    took: (id) => crystals.burst(id),
    // a delivery's drop, lit up (or put out, with nothing)
    setDrop(pt) {
      drop.visible = !!pt;
      if (pt) drop.position.set(pt.x, groundHeight(pt.x, pt.z), pt.z);
    },
    // pizzas already on the roof from before (the first has always been there)
    setPizzas(n) {
      while (pizzas.length < Math.min(8, n + 1)) if (!landPizza(pizzas.length)) break;
    },
    // one more, thrown from the car: false if there's no roof to land it on
    throwPizza(from) {
      const m = landPizza(pizzas.length);
      if (!m) return false;
      flying.push({ m, t: 0, from: new THREE.Vector3(from.x, 1.6, from.z) });
      m.position.set(from.x, 1.6, from.z);
      if (pizzas.length > 8) scene.remove(pizzas.splice(1, 1)[0]);
      return true;
    },
    wash() {
      washing = 1;
    },
    // a bump, as the rules tell it: { force, at: { x, z } }
    hit(force, at) {
      knocks.onHit(force, at, 'bump');
    },
    // the feel's numbers, for the ?debug panel
    tune: () => [...feelGroups(feel), ...impactGroups(knockRules), ...carFeelGroups(carFeel)],
    footprints,
    townFits: town.fits,
    // (for the QA scripts: what's drawn, to count, and a camera of their own)
    scene: import.meta.env.DEV ? scene : null,
    peek: import.meta.env.DEV ? (at, look) => (peek = at ? { at, look } : null) : () => {},
    // (dev: the floor's shadow masks for one area, rendered through this scene
    // with everything that moves put away: scripts/bake-floor-shadows.mjs)
    bake: import.meta.env.DEV
      ? async ({ area, size = 1024, times, sunSamples, skySamples }) => {
          const { bakeFloorMask, bytesToDataUrl } = await import('../../../lib/three/grounding-bake');
          const away = [car, hank, ghosts.group, blobs.mesh, marks, balloons.object, weeds.object, crystals.object, night.object, drop, water, beamMesh, sky.mesh, mountains.group, ...Object.values(markers).flatMap((m) => [m.ring, m.icon]), ...town.train, ...cast.map((f) => f.p.group)];
          const shown = away.map((o) => o.visible);
          baking = true;
          away.forEach((o) => (o.visible = false));
          fleet.set([]);
          try {
            const floorMeshes = [ground, streets.object];
            town.object.traverse((o) => o.isMesh && town.floors.includes(o.material) && floorMeshes.push(o));
            const out = await bakeFloorMask(renderer, scene, { area, size, floor: floorMeshes, casters: [scene], times, sunAt: (t) => sunAt(t), sunSamples, skySamples, onProgress: (p) => console.info(`bake ${p.done}/${p.of} ${(p.ms / 1000).toFixed(0)}s`) });
            return { width: out.width, height: out.height, ms: out.ms, passes: out.passes, url: bytesToDataUrl(out.data) };
          } finally {
            away.forEach((o, i) => (o.visible = shown[i]));
            baking = false;
          }
        }
      : undefined,
    resize: stage.resize,
    info: stage.info,
    project: stage.project,
    dispose() {
      gone = true;
      for (const off of undress) off();
      people?.dispose();
      roadside?.dispose();
      knocks.dispose();
      ghosts.dispose();
      for (const o of owned) o.dispose?.();
      if (cloud) cloud.dispose();
      if (post) {
        post.composer.dispose();
        post.target.dispose();
        post.bloom.dispose();
        post.grade.dispose?.();
      }
      stage.dispose();
    },
    get lost() {
      return stage.lost;
    },
  };
}
