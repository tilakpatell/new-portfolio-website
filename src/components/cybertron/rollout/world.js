// Roll out's three stages as places: the sky, the road and the ground beside
// it, the canyon under a broken bridge, and layers of scenery that recycle
// down the road (guard rails and posts near, cacti and street lamps in the
// middle, mesas, towers and spires far off). Each stage brings its own light:
// a Nevada sunset, Mission City at night, Kaon under a red sky. The surfaces
// are scanned CC0 materials (Poly Haven, ambientCG) and the light the metal
// reflects is a Poly Haven HDRI per stage; scripts/cc0.mjs fetches them all.

import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { canvasTexture, hot } from '../../../lib/stage3d';
import { paintChasm, paintClouds, paintConcrete, paintDeck, paintFacade, paintLanes, paintPavement, paintRoad, paintSand, paintSign, paintSpire, paintStrata, ROAD_TILE } from './paint';
import { ROLL } from './rules';

export const LOOK = {
  jasper: {
    hdri: 'jasper',
    env: 0.9,
    exposure: 1.05,
    fog: 0xc98a62,
    fogDensity: 0.0052,
    sky: { top: 0x3b3f78, mid: 0xd77a52, low: 0xf2b27a, sun: 0xffd9a0 },
    sunDir: [-0.35, 0.16, -1],
    sun: { color: 0xffc58f, k: 2.6 },
    hemi: [0xf2b38a, 0x5a3a28, 0.75],
    clouds: 0.46,
    stars: 0,
    night: false,
  },
  mission: {
    hdri: 'mission',
    env: 0.35,
    exposure: 1.15,
    fog: 0x1a2236,
    fogDensity: 0.0068,
    sky: { top: 0x050914, mid: 0x14203d, low: 0x40324a, sun: 0x9fb4ff },
    sunDir: [0.4, 0.5, -1],
    sun: { color: 0x9fb4ff, k: 0.55 },
    hemi: [0x3a4a7a, 0x120f14, 0.55],
    clouds: 0.35,
    stars: 0.7,
    night: true,
  },
  kaon: {
    hdri: 'kaon',
    env: 0.45,
    exposure: 1.1,
    fog: 0x3a1714,
    fogDensity: 0.0062,
    sky: { top: 0x12060c, mid: 0x4a1410, low: 0xa8401a, sun: 0xff8a50 },
    sunDir: [0.5, 0.22, -1],
    sun: { color: 0xff8b5a, k: 1.2 },
    hemi: [0xb0503a, 0x1a0a0c, 0.6],
    clouds: 0.55,
    stars: 0.9,
    night: true,
  },
};

// One cache per renderer: an environment map belongs to the GL context it
// was made in.
const HDRI = new WeakMap();
export function loadHdri(name, stage) {
  const { renderer } = stage;
  if (!HDRI.has(renderer)) HDRI.set(renderer, new Map());
  const cache = HDRI.get(renderer);
  if (cache.has(name)) return cache.get(name);
  const p = new Promise((resolve) => {
    new HDRLoader().load(
      `/games/hdri/${name}.hdr`,
      (tex) => {
        if (stage.disposed) {
          tex.dispose();
          resolve(null);
          return;
        }
        const pm = new THREE.PMREMGenerator(renderer);
        const env = pm.fromEquirectangular(tex).texture;
        pm.dispose();
        tex.dispose();
        resolve(env);
      },
      undefined,
      () => resolve(null), // no HDRI: the lights still light it
    );
  });
  cache.set(name, p);
  return p;
}

// A material that cuts holes for the broken bridges: anything between a
// gap's two ends (world z) is discarded.
function holes(material, key) {
  material.userData.gaps = new Array(3).fill(null).map(() => new THREE.Vector2(1e9, 1e9));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGaps = { value: material.userData.gaps };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vHoleWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vHoleWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWPos;\nuniform vec2 uGaps[3];')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfor (int i = 0; i < 3; i++) { if (-vHoleWPos.z > uGaps[i].x && -vHoleWPos.z < uGaps[i].y) discard; }');
  };
  material.customProgramCacheKey = () => `holes-${key}`;
  return material;
}

// Facades on buildings of any size: the windows come from world position,
// so a tall block and a short one share one texture without stretching.
function worldUv(material, tileW, tileH, key) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        float seed = float(gl_InstanceID);
        vec2 wuv = vec2((abs(wn.x) > 0.5 ? wp.z : wp.x) / ${tileW.toFixed(1)}, wp.y / ${tileH.toFixed(1)}) + vec2(floor(fract(sin(seed * 12.9898) * 43758.5453) * 4.0) * 0.25, 0.0);
        #ifdef USE_MAP
          vMapUv = wuv;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = wuv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = wuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = wuv;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv = wuv;
        #endif
        #ifdef USE_AOMAP
          vAoMapUv = wuv;
        #endif
      }`,
    );
  };
  material.customProgramCacheKey = () => `worlduv-${key}`;
  return material;
}

// The sky: a gradient dome with a sun (or a red giant over Kaon), clouds, and
// stars at night. It follows the camera.
function buildSky(look, clouds) {
  const s = look.sky;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(s.top) },
      mid: { value: new THREE.Color(s.mid) },
      low: { value: new THREE.Color(s.low) },
      sunCol: { value: new THREE.Color(s.sun) },
      sunDir: { value: new THREE.Vector3(...look.sunDir).normalize() },
      clouds: { value: clouds },
      cloudK: { value: look.clouds },
      stars: { value: look.stars },
      night: { value: look.night ? 1 : 0 },
      t: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 top, mid, low, sunCol, sunDir; uniform sampler2D clouds; uniform float cloudK, stars, night, t;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(mix(low, mid, smoothstep(0.0, 0.18, h)), top, smoothstep(0.12, 0.75, h)) : mix(low, low * 0.35, smoothstep(0.0, -0.3, h));
        float sd = max(0.0, dot(d, normalize(sunDir)));
        c += sunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 28.0) * 0.55 + pow(sd, 4.0) * 0.18) * (1.0 - night * 0.55);
        if (stars > 0.0 && h > 0.02) {
          vec3 g = floor(d * 380.0);
          float s = step(0.9965, hash(g)) * smoothstep(0.02, 0.25, h);
          c += vec3(s) * stars * (0.6 + 0.4 * sin(t * 2.0 + hash(g * 1.7) * 40.0));
        }
        vec2 uv = vec2(atan(d.x, -d.z) / 6.2831853 + 0.5, clamp(h * 1.6, 0.0, 1.0));
        vec4 cl = texture2D(clouds, vec2(uv.x * 2.0, uv.y));
        vec3 lit = mix(c * 0.6 + sunCol * 0.15, low * 1.15 + sunCol * 0.25, pow(sd, 3.0));
        c = mix(c, lit, cl.a * cloudK * smoothstep(0.0, 0.08, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

// Instances spread down the road that move forward a band at a time as you
// pass them, each taking a fresh variation from (its index, its lap).
class Band {
  constructor(mesh, count, length, place) {
    this.mesh = mesh;
    this.count = count;
    this.length = length;
    this.place = place;
    this.laps = new Int32Array(count).fill(-99999);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    if (mesh.isObject3D) mesh.frustumCulled = false;
  }

  update(z) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const base = (i / this.count) * this.length;
      // the lap that puts this one between 30 behind you and a band ahead
      const lap = Math.ceil((z - 30 - base) / this.length);
      if (lap === this.laps[i]) continue;
      this.laps[i] = lap;
      const r = rnd(i * 7919 + lap * 104729 + this.length);
      const t = this.place(i, r, base + lap * this.length);
      if (!t) {
        this.m.makeScale(0, 0, 0);
      } else {
        this.p.set(t.x, t.y ?? 0, -t.z);
        this.e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
        this.q.setFromEuler(this.e);
        const sc = t.s ?? 1;
        if (typeof sc === 'number') this.s.set(sc, sc, sc);
        else this.s.set(sc[0], sc[1], sc[2]);
        this.m.compose(this.p, this.q, this.s);
      }
      this.mesh.setMatrixAt(i, this.m);
      dirty = true;
    }
    if (dirty) {
      if (this.mesh.commit) this.mesh.commit();
      else this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
// a seeded random source per (index, lap)
function rnd(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A mesa: a noisy flat-topped prism with strata down its sides.
function mesaGeometry(seed) {
  const r = rnd(seed);
  const shape = new THREE.Shape();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = 1 + (r() - 0.5) * 0.45;
    const x = Math.cos(a) * rad * (1.6 + r() * 0.3);
    const y = Math.sin(a) * rad;
    if (i) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.35, bevelSegments: 2, steps: 3 });
  geo.rotateX(-Math.PI / 2);
  // flare the foot out into a scree slope
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = 1 + Math.max(0, 0.4 - y) * 0.9;
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
  }
  // UVs from position so the strata run level round the sides
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.atan2(p.getZ(i), p.getX(i)) / Math.PI + 1) * 3, p.getY(i) * 0.9);
  geo.computeVertexNormals();
  return geo;
}

// ── one stage's place ──

// The Poly Haven sets each stage is surfaced with (see scripts/cc0.mjs).
// The scanned props each stage scatters (see scripts/cc0.mjs).
const PROPS = {
  jasper: ['quiver-tree', 'rock', 'tyre', 'barrel'],
  mission: ['street-lamp', 'utility-box', 'trash-can'],
  kaon: ['barrel'],
};

const SETS = {
  jasper: { road: 'asphalt-desert', ground: 'desert-ground', rock: 'mesa-rock' },
  mission: { road: 'asphalt-city', ground: 'sidewalk', rock: 'concrete' },
  kaon: { road: 'plate-road', ground: 'plate-deck', rock: 'mesa-rock' },
};

export async function buildWorld(id, renderer, { big = true, M, shared, lib, models }) {
  const look = LOOK[id];
  const root = new THREE.Group();
  const own = []; // textures this world made, to free with it
  const T = (canvas, opts) => {
    const t = canvasTexture(canvas, renderer, opts);
    own.push(t);
    return t;
  };
  const size = big ? 512 : 256;
  const kind = id === 'jasper' ? 'desert' : id === 'mission' ? 'city' : 'kaon';
  const want = SETS[id];
  const [roadSet, groundSet, rockSet] = await Promise.all([want.road, want.ground, want.rock].map((n) => lib.load(n)));

  // sky
  const cloudTex = T(paintClouds({ w: big ? 1024 : 512, h: 256, seed: id.length * 31, cover: look.clouds }), { srgb: true });
  cloudTex.wrapT = THREE.ClampToEdgeWrapping;
  const sky = buildSky(look, cloudTex);
  root.add(sky);

  // the road: a strip that steps forward a tile at a time, so its texture
  // stays put on the ground; holes cut where a bridge is out. Real asphalt
  // (or Kaon's iron plate) underneath, the markings painted over it.
  const ROAD_LEN = ROAD_TILE * 34;
  const along = ROAD_LEN / ROAD_TILE;
  let roadMat;
  if (roadSet) {
    roadMat = lib.material(roadSet, { repeat: [4, 4 * along], metal: kind === 'kaon', roughness: kind === 'city' ? 0.78 : 1, envMapIntensity: kind === 'city' ? 1.5 : 0.8, normalScale: new THREE.Vector2(1.1, 1.1) });
  } else {
    const roadP = paintRoad({ size, seed: 3 + id.length, kind });
    roadMat = new THREE.MeshStandardMaterial({ map: T(roadP.color, { repeat: [1, along] }), normalMap: T(roadP.normal, { repeat: [1, along], srgb: false }), roughnessMap: T(roadP.rough, { repeat: [1, along], srgb: false }), metalness: kind === 'kaon' ? 0.55 : 0.05, roughness: 1 });
  }
  holes(roadMat, `road-${id}`);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_TILE, ROAD_LEN), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  root.add(road);
  const lanesP = paintLanes({ size: big ? 1024 : 512, seed: 3 + id.length, kind });
  const laneMat = holes(
    new THREE.MeshStandardMaterial({
      map: T(lanesP.color, { repeat: [1, along] }),
      emissiveMap: lanesP.emissive ? T(lanesP.emissive, { repeat: [1, along] }) : null,
      emissive: lanesP.emissive ? new THREE.Color(2.2, 1.4, 1) : new THREE.Color(0, 0, 0),
      transparent: true,
      depthWrite: false,
      roughness: 0.55,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
    `lanes-${id}`,
  );
  const lanes = new THREE.Mesh(road.geometry, laneMat);
  lanes.rotation.x = -Math.PI / 2;
  lanes.receiveShadow = true;
  lanes.renderOrder = 1;
  root.add(lanes);

  // the ground either side
  const GT = 16;
  const GW = 520;
  const GL = 528;
  const per = kind === 'city' ? 8 : 4; // texture repeats per 16 m
  let groundMat;
  if (groundSet) {
    groundMat = lib.material(groundSet, { repeat: [(GW / GT) * per, (GL / GT) * per], metal: kind === 'kaon', envMapIntensity: 0.6, normalScale: new THREE.Vector2(1.2, 1.2), color: kind === 'kaon' ? 0x8a7a76 : 0xffffff });
  } else {
    const groundP = kind === 'desert' ? paintSand({ size, seed: 5 }) : kind === 'city' ? paintPavement({ size, seed: 6 }) : paintDeck({ size, seed: 7 });
    groundMat = new THREE.MeshStandardMaterial({ map: T(groundP.color, { repeat: [GW / GT, GL / GT] }), normalMap: T(groundP.normal, { repeat: [GW / GT, GL / GT], srgb: false }), roughnessMap: T(groundP.rough, { repeat: [GW / GT, GL / GT], srgb: false }), roughness: 1 });
  }
  holes(groundMat, `ground-${id}`);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GL), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  root.add(ground);

  // the canyon under a broken bridge: walls, a river (or lava), the deck's
  // broken ends and the piers that held it up
  const rockTint = kind === 'kaon' ? 0x6a3a30 : kind === 'city' ? 0x9a9a9a : 0xffffff;
  let rockMat;
  if (rockSet) rockMat = lib.material(rockSet, { repeat: [GW / 26, 40 / 26], color: rockTint, normalScale: new THREE.Vector2(1.4, 1.4) });
  else {
    const strata = paintStrata({ size, seed: 9, palette: kind });
    rockMat = new THREE.MeshStandardMaterial({ map: T(strata.color, { repeat: [12, 2] }), normalMap: T(strata.normal, { repeat: [12, 2], srgb: false }), roughness: 0.95 });
  }
  // the mesas use the same rock, repeated at their own scale
  const mesaMat = rockSet ? lib.material(rockSet, { repeat: [1, 1], color: rockTint, normalScale: new THREE.Vector2(1.5, 1.5) }) : rockMat;
  const chasmP = paintChasm({ size: 256, kind });
  const chasmMat = new THREE.MeshStandardMaterial({
    map: T(chasmP.color, { repeat: [30, 3] }),
    emissiveMap: chasmP.emissive ? T(chasmP.emissive, { repeat: [30, 3] }) : null,
    emissive: chasmP.emissive ? new THREE.Color(2.2, 1, 0.3) : new THREE.Color(0, 0, 0),
    roughness: kind === 'kaon' ? 0.6 : 0.08,
    metalness: kind === 'kaon' ? 0 : 0.3,
    envMapIntensity: 1.4,
  });
  const deckMat = shared.concreteMat;
  rockMat.side = THREE.DoubleSide;
  // the ramp's side profile, extruded across the road
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(ROLL.ramp.len, ROLL.ramp.h);
  profile.lineTo(ROLL.ramp.len, -0.8);
  profile.lineTo(0, -0.06);
  const rampGeo = new THREE.ExtrudeGeometry(profile, { depth: ROAD_TILE - 0.2, bevelEnabled: false });
  rampGeo.rotateY(Math.PI / 2);
  rampGeo.translate(-(ROAD_TILE - 0.2) / 2, 0, 0);
  const lipGeo = new THREE.PlaneGeometry(ROAD_TILE - 0.2, 0.7);
  const lipMat = new THREE.MeshStandardMaterial({ map: shared.hazard, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const canyons = [0, 1].map(() => {
    const g = new THREE.Group();
    const near = new THREE.Mesh(new THREE.PlaneGeometry(GW, 40), rockMat);
    near.position.y = -20;
    const far = near.clone();
    far.rotation.y = Math.PI;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(GW, 1), chasmMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -26;
    const deckA = new THREE.Mesh(new THREE.BoxGeometry(ROAD_TILE + 0.6, 1.3, 3.2), deckMat);
    const deckB = deckA.clone();
    deckA.castShadow = deckB.castShadow = true;
    const pierGeo = new THREE.CylinderGeometry(0.9, 1.1, 26, 12);
    const piers = [];
    for (let i = 0; i < 4; i++) {
      const pier = new THREE.Mesh(pierGeo, deckMat);
      piers.push(pier);
      g.add(pier);
    }
    // jagged broken ends with rebar
    const chunkGeo = new THREE.BoxGeometry(1, 1, 1);
    const chunks = new THREE.InstancedMesh(chunkGeo, deckMat, 36);
    const rebarGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.4, 5);
    const rebars = new THREE.InstancedMesh(rebarGeo, M.dark, 40);
    chunks.castShadow = true;
    // the ramp: the broken deck tilted up toward the gap, chevrons on its lip
    const ramp = new THREE.Mesh(rampGeo, deckMat);
    ramp.castShadow = ramp.receiveShadow = true;
    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.rotation.x = -Math.PI / 2 + Math.atan2(ROLL.ramp.h, ROLL.ramp.len);
    g.add(near, far, floor, deckA, deckB, chunks, rebars, ramp, lip);
    g.visible = false;
    root.add(g);
    return { g, near, far, floor, deckA, deckB, piers, chunks, rebars, ramp, lip, gap: null };
  });
  const placeCanyon = (c, gap) => {
    c.gap = gap;
    const z0 = gap.z;
    const z1 = gap.z + gap.len;
    const pad = 3.4;
    c.near.position.set(0, -20, -(z0 - pad));
    c.far.position.set(0, -20, -(z1 + pad));
    c.near.rotation.y = Math.PI;
    c.far.rotation.y = 0;
    c.floor.scale.y = z1 - z0 + pad * 2; // the plane's own y runs along the road once laid flat
    c.ramp.position.set(0, 0, -(z0 - ROLL.ramp.len));
    c.lip.position.set(0, ROLL.ramp.h * (1 - 0.35 / ROLL.ramp.len) + 0.015, -(z0 - 0.35));
    c.floor.position.set(0, -26, -(z0 + z1) / 2);
    c.deckA.position.set(0, -0.66, -(z0 - pad / 2 + 0.1));
    c.deckB.position.set(0, -0.66, -(z1 + pad / 2 - 0.1));
    c.piers.forEach((p, i) => p.position.set(i % 2 ? 4 : -4, -13.5, i < 2 ? -(z0 - pad / 2) : -(z1 + pad / 2)));
    const r = rnd(Math.round(z0));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 36; i++) {
      const side = i < 18 ? 0 : 1;
      const x = -6.4 + ((i % 18) / 17) * 12.8;
      const z = side ? z1 : z0;
      e.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.8);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, -0.35 - r() * 0.3, -(z + (side ? -0.1 : 0.1) * (1 + r()))), q, new THREE.Vector3(0.5 + r() * 0.5, 0.4 + r() * 0.6, 0.4 + r() * 0.5));
      c.chunks.setMatrixAt(i, m);
    }
    for (let i = 0; i < 40; i++) {
      const side = i < 20 ? 0 : 1;
      const x = -6.2 + ((i % 20) / 19) * 12.4;
      const z = side ? z1 : z0;
      e.set(Math.PI / 2 + (r() - 0.5) * 0.9 * (side ? -1 : 1), 0, (r() - 0.5) * 0.5);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, -0.45, -(z + (side ? 0.55 : -0.55))), q, new THREE.Vector3(1, 0.6 + r() * 0.6, 1));
      c.rebars.setMatrixAt(i, m);
    }
    c.chunks.instanceMatrix.needsUpdate = true;
    c.rebars.instanceMatrix.needsUpdate = true;
    c.g.visible = true;
  };

  // ── scenery ──
  const cut = []; // [material, extra margin] for everything cut at a broken bridge
  // near: rails and kerbs; mid: trees, rocks, lamps and roadside junk (CC0
  // scans); far: mesas, towers and spires
  const bands = [];
  const band = (geo, mat, count, length, place, { shadow = false } = {}) => {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    root.add(mesh);
    const b = new Band(mesh, count, length, place);
    bands.push(b);
    return b;
  };
  // the same for a scanned model: every part of it instanced together
  const modelBand = (model, count, length, place, { shadow = false, scale = 1 } = {}) => {
    if (!model) return null;
    const inst = models.instanced(model, count, { shadow, scale });
    inst.addTo(root);
    const b = new Band(inst, count, length, place);
    bands.push(b);
    return b;
  };
  const sideX = (r, lo, hi) => (r() < 0.5 ? -1 : 1) * (lo + r() * (hi - lo));
  const props = await Promise.all((PROPS[id] ?? []).map((n) => models.load(n)));
  const prop = (n) => props[(PROPS[id] ?? []).indexOf(n)] ?? null;

  const railMat = holes(new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.85, roughness: 0.35 }), `rail-${id}`);
  const reflMat = holes(M.lamp(0xffb34a, 1.6), `refl-${id}`);
  cut.push([railMat, 0], [reflMat, 0]);
  if (kind === 'desert') {
    const postGeo = new THREE.BoxGeometry(0.14, 0.9, 0.14);
    postGeo.translate(0, 0.45, 0);
    band(postGeo, railMat, 120, 240, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.25, z: z + (i % 2) * 2, y: 0 }));
    const railGeo = new THREE.BoxGeometry(0.06, 0.32, 4.02);
    railGeo.translate(0, 0.72, 0);
    band(railGeo, railMat, 120, 240, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.15, z: z + (i % 2) * 2 + 2, y: 0 }));
    const refl = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6);
    refl.translate(0, 0.55, 0);
    band(refl, reflMat, 40, 240, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.6, z: z + 3, y: 0 }));
  } else if (kind === 'kaon') {
    // Kaon: iron kerb blocks, a faint molten seam
    const kerb = new THREE.BoxGeometry(0.45, 0.3, 2.6);
    kerb.translate(0, 0.15, 0);
    const kerbMat = holes(new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: 0.8, roughness: 0.4, emissive: hot(0xff4a1a, 1), emissiveIntensity: 0.14 }), 'kerb');
    cut.push([kerbMat, 0]);
    band(kerb, kerbMat, 100, 300, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.1, z, y: 0 }));
  }

  if (kind === 'desert') {
    // quiver trees and boulders (Poly Haven scans), tyres and barrels dumped
    // by the road, telephone poles, and the mesas far off
    modelBand(prop('quiver-tree'), 46, 380, (i, r, z) => ({ x: sideX(r, 10, 70), z: z + r() * 8, s: 2.6 + r() * 2.2, ry: r() * 6.3 }), { shadow: true });
    modelBand(prop('rock'), 70, 360, (i, r, z) => ({ x: sideX(r, 11, 80), z: z + r() * 5, s: [3 + r() * 9, 2.5 + r() * 7, 3 + r() * 9], ry: r() * 6.3, y: -0.1 }), { shadow: true });
    modelBand(prop('tyre'), 10, 420, (i, r, z) => ({ x: sideX(r, 8.2, 11), z, s: 1.1, rx: Math.PI / 2, ry: r() * 6.3, y: 0.08 }), { shadow: true });
    modelBand(prop('barrel'), 8, 520, (i, r, z) => ({ x: sideX(r, 8.4, 12), z, s: 1, ry: r() * 6.3, rz: r() < 0.4 ? Math.PI / 2 : 0, y: 0 }), { shadow: true });
    const pole = new THREE.CylinderGeometry(0.12, 0.16, 9, 7);
    pole.translate(0, 4.5, 0);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
    band(pole, wood, 24, 480, (i, r, z) => ({ x: 13, z }));
    const arm = new THREE.BoxGeometry(2.2, 0.14, 0.14);
    arm.translate(0, 8.4, 0);
    band(arm, wood, 24, 480, (i, r, z) => ({ x: 13, z }));
    // a mesa's footprint reaches about 2.7 times its scale from its centre
    // (the shape, plus the scree at its foot), so it stands that far clear
    for (let k = 0; k < 2; k++) {
      band(mesaGeometry(11 + k), mesaMat, 14, 900, (i, r, z) => {
        const sx = 10 + r() * 16;
        const sz = 10 + r() * 14;
        return { x: (i % 2 ? 1 : -1) * (26 + Math.max(sx, sz) * 2.7 + r() * (k ? 60 : 140)), z: z + r() * 40, s: [sx, 14 + r() * 26 + k * 6, sz], ry: r() * 6, y: -1 };
      });
    }
  } else if (kind === 'city') {
    // blocks faced with ambientCG facades: their windows light up by themselves
    const facades = await Promise.all(['facade-brick', 'facade-office', 'facade-tower', 'facade-glass'].map((n) => lib.load(n, { emission: true })));
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const plan = [
      [facades[0], 34, true, 13],
      [facades[1], 34, true, 13],
      [facades[2], 30, false, 26],
      [facades[3], 30, false, 26],
    ];
    plan.forEach(([set, count, near, tile], fi) => {
      let mat;
      if (set) mat = lib.material(set, { metal: true, envMapIntensity: 1.3, emissiveIntensity: 1.6 });
      else {
        const f = paintFacade({ w: 256, h: 384, seed: 13 + fi, kind: near ? 'brick' : 'glass' });
        mat = new THREE.MeshStandardMaterial({ map: T(f.color), emissiveMap: T(f.emissive), emissive: new THREE.Color(1.6, 1.4, 1.1), roughness: 0.6 });
      }
      worldUv(mat, tile, tile, `facade-${fi}`);
      band(box, mat, count, 420, (i, r, z) => {
        const sd = i % 2 ? 1 : -1;
        const wid = 13 + Math.round(r() * 2) * 6.5;
        const hgt = near ? 13 + Math.round(r() * 2) * 6.5 : 39 + Math.round(r() * 5) * 13;
        return { x: sd * (15.5 + wid / 2 + (near ? 0 : 6 + r() * 30)), z: z + r() * 6, s: [wid, hgt, 12 + r() * 14] };
      });
    });
    // lampposts (scanned): their glass lanterns lit, a pool of light below each
    const lampModel = prop('street-lamp');
    const lampScale = lampModel ? 6.2 / lampModel.size.y : 1;
    if (lampModel) {
      for (const part of lampModel.parts) {
        if (/glass/i.test(part.material.name)) {
          part.material.emissive = new THREE.Color(1, 0.72, 0.42);
          part.material.emissiveIntensity = 3.2;
        }
      }
    }
    modelBand(lampModel, 36, 396, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 8.1, z: z + (i % 2) * 11, ry: r() * 6.3 }), { scale: lampScale, shadow: true });
    const poolGeo = new THREE.PlaneGeometry(9, 9);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = holes(new THREE.MeshBasicMaterial({ map: shared.pool, color: new THREE.Color(1, 0.78, 0.5).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }), 'pool');
    cut.push([poolMat, 0]);
    band(poolGeo, poolMat, 36, 396, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 6.6, z: z + (i % 2) * 11, y: 0.02 }));
    modelBand(prop('utility-box'), 12, 400, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * (10.6 + r()), z, ry: (i % 2 ? -1 : 1) * Math.PI / 2 }), { shadow: true });
    modelBand(prop('trash-can'), 12, 360, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * (9.6 + r() * 0.6), z, ry: r() * 6 }), { shadow: true });
    const sidewalk = new THREE.BoxGeometry(4.5, 0.25, 20);
    band(sidewalk, deckMat, 40, 400, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 9.6, z, y: 0.12 }));
  } else {
    // Kaon: iron spires and towers (Poly Haven plate) banded with light,
    // energon arches over the road, molten channels
    const sp = paintSpire({ w: 256, h: 512, seed: 5, light: '#ff5a1f' });
    let spireMat;
    if (roadSet) spireMat = lib.material(roadSet, { metal: true, color: 0x9a9aa6, envMapIntensity: 1.2 });
    else spireMat = new THREE.MeshStandardMaterial({ map: T(sp.color), metalness: 0.85, roughness: 0.35 });
    spireMat.emissiveMap = T(sp.emissive, { repeat: [1, 1] });
    spireMat.emissive = new THREE.Color(2.2, 1.2, 0.8);
    worldUv(spireMat, 12, 24, 'spire');
    const spireGeo = new THREE.CylinderGeometry(0.15, 1, 1, 6, 1);
    spireGeo.translate(0, 0.5, 0);
    band(spireGeo, spireMat, 50, 700, (i, r, z) => {
      const w = 6 + r() * 12;
      return { x: (r() < 0.5 ? -1 : 1) * (14 + w + r() * 150), z: z + r() * 20, s: [w, 30 + r() * 110, w], ry: r() * 3 };
    });
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    towerGeo.translate(0, 0.5, 0);
    band(towerGeo, spireMat, 40, 500, (i, r, z) => {
      const w = 5 + r() * 10;
      return { x: (r() < 0.5 ? -1 : 1) * (12 + w / 2 + r() * 50), z: z + r() * 10, s: [w, 8 + r() * 30, 5 + r() * 10] };
    });
    const archMat = new THREE.MeshStandardMaterial({ color: 0x2b2d35, metalness: 0.85, roughness: 0.3 });
    band(new THREE.TorusGeometry(10, 0.5, 8, 24, Math.PI), archMat, 6, 600, (i, r, z) => ({ x: 0, z, y: 0 }), { shadow: true });
    band(new THREE.TorusGeometry(9.4, 0.12, 6, 32, Math.PI), M.lamp(0xff6a2a, 2.6), 6, 600, (i, r, z) => ({ x: 0, z, y: 0 }));
    const channel = new THREE.PlaneGeometry(6, 40);
    channel.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshStandardMaterial({ map: chasmMat.map, emissiveMap: chasmMat.emissiveMap, emissive: new THREE.Color(2.4, 1, 0.3), roughness: 0.7 });
    band(channel, lavaMat, 14, 560, (i, r, z) => ({ x: sideX(r, 20, 60), z, y: 0.02 }));
    modelBand(prop('barrel'), 10, 480, (i, r, z) => ({ x: sideX(r, 8.4, 12), z, s: 1, ry: r() * 6.3, rz: r() < 0.5 ? Math.PI / 2 : 0 }), { shadow: true });
  }

  // signs before roadblocks and broken bridges
  const signs = {
    closed: T(paintSign({ text: kind === 'kaon' ? ['DECEPTICON', 'BARRIER'] : ['ROAD', 'CLOSED'], bg: kind === 'kaon' ? '#7a2fb8' : '#f39c12', fg: kind === 'kaon' ? '#fff' : '#111' }), { wrap: false }),
    bridge: T(paintSign({ text: ['BRIDGE', 'OUT'], bg: '#f39c12' }), { wrap: false }),
  };
  const signGeo = new THREE.PlaneGeometry(2.2, 2.2);
  const signPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6);
  const makeSign = (tex) => {
    const g = new THREE.Group();
    const face = new THREE.Mesh(signGeo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide }));
    face.position.y = 3.2;
    const post = new THREE.Mesh(signPostGeo, railMat);
    post.position.y = 1.2;
    face.castShadow = true;
    g.add(face, post);
    root.add(g);
    g.visible = false;
    return g;
  };
  const signPool = Array.from({ length: 6 }, (_, i) => ({ g: makeSign(i < 3 ? signs.closed : signs.bridge), kind: i < 3 ? 'closed' : 'bridge' }));

  const placeSigns = (g) => {
    const want = [];
    for (const b of g.barricades) if (!b.broken && b.z > g.z - 10 && b.z < g.z + 260) want.push({ z: b.z - 45, kind: 'closed' });
    for (const p of g.gaps) if (p.z > g.z - 10 && p.z < g.z + 280) want.push({ z: p.z - ROLL.ramp.len - 55, kind: 'bridge' });
    let ci = 0;
    let bi = 3;
    for (const s of signPool) s.g.visible = false;
    for (const w of want) {
      const slot = w.kind === 'closed' ? signPool[ci++] : signPool[bi++];
      if (!slot || (w.kind === 'closed' ? ci > 3 : bi > 6)) continue;
      slot.g.visible = true;
      slot.g.position.set(7.9, 0, -w.z);
      slot.g.rotation.y = -0.25;
    }
  };

  // ── light ──
  const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(look.sun.color, look.sun.k);
  sun.castShadow = true;
  sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -16;
  sc.right = 16;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 1;
  sc.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  root.add(sun, sun.target);
  const sunDir = new THREE.Vector3(...look.sunDir).normalize();

  let envTex = null;
  const fog = new THREE.FogExp2(look.fog, look.fogDensity);

  const update = (g, cam, t) => {
    const z = g.z;
    sky.position.copy(cam.position);
    sky.material.uniforms.t.value = t;
    // road and ground step forward a tile at a time
    const zr = Math.floor((z - 60) / ROAD_TILE) * ROAD_TILE;
    road.position.set(0, 0, -(zr + ROAD_LEN / 2));
    lanes.position.copy(road.position);
    const zg = Math.floor((z - 120) / GT) * GT;
    ground.position.set(0, -0.03, -(zg + GL / 2));
    // the holes, and the canyons under them
    const near = g.gaps.filter((p) => p.z + p.len > z - 40 && p.z < z + 320).slice(0, 3);
    for (let i = 0; i < 3; i++) {
      const p = near[i];
      for (const [m, pad] of [[roadMat, 0], [laneMat, 0], [groundMat, 3.4], ...cut]) m.userData.gaps[i].set(p ? p.z - pad : 1e9, p ? p.z + p.len + pad : 1e9);
    }
    canyons.forEach((c, i) => {
      const p = near[i];
      if (!p) c.g.visible = false;
      else if (c.gap !== p) placeCanyon(c, p);
    });
    for (const b of bands) b.update(z);
    placeSigns(g);
    // the sun's shadow box follows you; the light comes from where the sun is
    sun.position.set(g.x + sunDir.x * 50, Math.max(22, sunDir.y * 50), -(z + 12) + sunDir.z * 50);
    sun.target.position.set(g.x, 0, -(z + 12));
  };

  const attach = (scene, stage) => {
    scene.add(root);
    scene.fog = fog;
    stage.renderer.toneMappingExposure = look.exposure;
    loadHdri(look.hdri, stage).then((env) => {
      if (!root.parent || !env || stage.disposed) return;
      envTex = env;
      scene.environment = env;
      scene.environmentIntensity = look.env;
    });
  };

  const dispose = (scene) => {
    scene.remove(root);
    if (scene.environment === envTex) scene.environment = null;
    root.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (!m.userData?.shared && !Object.values(M).includes(m)) m.dispose?.();
    });
    own.forEach((t) => t.dispose());
  };

  return { id, look, root, update, attach, dispose, night: look.night, kind };
}

// Surfaces every stage shares: Poly Haven concrete for decks, piers and
// barriers (painted if it can't load), and hazard chevrons for the ramps.
export async function sharedSurfaces(renderer, big, panels, lib) {
  const set = await lib.load('concrete');
  let concreteMat;
  if (set) concreteMat = lib.material(set, { repeat: [2, 1], envMapIntensity: 0.5 });
  else {
    const c = paintConcrete({ size: big ? 256 : 128, seed: 12 });
    concreteMat = new THREE.MeshStandardMaterial({ map: canvasTexture(c.color, renderer, { repeat: [2, 1] }), normalMap: canvasTexture(c.normal, renderer, { repeat: [2, 1], srgb: false }), roughness: 0.9 });
  }
  concreteMat.userData.shared = true;
  const hz = document.createElement('canvas');
  hz.width = 256;
  hz.height = 32;
  const x = hz.getContext('2d');
  x.fillStyle = '#f2c230';
  x.fillRect(0, 0, 256, 32);
  x.fillStyle = '#141414';
  for (let i = -32; i < 288; i += 32) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 16, 0);
    x.lineTo(i + 32, 32);
    x.lineTo(i + 16, 32);
    x.fill();
  }
  // the pool of light under a street lamp
  const pool = document.createElement('canvas');
  pool.width = pool.height = 128;
  const px = pool.getContext('2d');
  const gr = px.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  px.fillStyle = gr;
  px.fillRect(0, 0, 128, 128);
  return { panels, concreteMat, hazard: canvasTexture(hz, renderer, { repeat: [3, 1] }), pool: canvasTexture(pool, renderer, { wrap: false }) };
}
