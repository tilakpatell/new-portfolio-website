// The Shire's ground in WebGL: the rolling green itself (one mesh, shaped by
// ./rules.js's height and painted by its ground map, `groundAt`: worn lanes,
// the Party Field, Maggot's tilled rows, mud by the water), the pond and the
// stream under a moving surface, and the flowers on top, instanced so
// thousands cost one draw. The grass is lib/three/grass's, on the same map.

import * as THREE from 'three';
import { canvasTexture } from '../../../lib/stage3d';
import { fbm, makeNoise, normalFromField, smooth } from '../../../lib/paint';
import { createGroundMap } from '../../../lib/three/groundmap';
import { BRIDGE, FIELD, HOLES, BAG_END, INN, POND, ROADS, STREAM, WATER_Y, WORLD, height, inWater, onRoad, roadAmount, seeded } from './rules';

const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const GRASS = C(0x5f9a3a);
const GRASS_DEEP = C(0x3f7a2c);
const GRASS_SUN = C(0x9cbf4a);
const DRY = C(0xb3a65a);
const DIRT = C(0x9a7a52);
const SOIL = C(0x6a4a30);
const MUD = C(0x4f4432);
const BED = C(0x5a5a40);

// The floor's grain: the relief of blades and clover, tiling.
function grassTextures(renderer) {
  const size = 256;
  const n = makeNoise(5);
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const blades = fbm(n, u * 64, v * 16, { period: 64, octaves: 2 });
      const clumps = fbm(n, u * 8 + 3, v * 8, { period: 8, octaves: 3 });
      const fine = fbm(n, u * 128, v * 128, { period: 128, octaves: 1 });
      field[y * size + x] = blades * 0.55 + clumps * 0.3 + fine * 0.15;
    }
  return { normalMap: canvasTexture(normalFromField(field, size, size, 2.2), renderer, { repeat: [56, 56], srgb: false }) };
}

// The Shire's ground at a point, as one function (lib/three/groundmap paints
// it into the ground map, which colours the ground, the grass on it and the
// light it bounces up): its colour into `out` (linear), and how much grass
// grows there, 0 to 1. Green deeper in the hollows and sunnier on the tops,
// dry in patches; the lanes worn to dirt, trodden round the doors and the
// inn; Maggot's tilled rows; mud at the water's edge and the bed under it.
const groundNoise = makeNoise(13);
const fieldMidX = (FIELD.x0 + FIELD.x1) / 2;
const fieldMidZ = (FIELD.z0 + FIELD.z1) / 2;
const DOORS = [...HOLES, { ...BAG_END }];
const tmpC = [0, 0, 0];
// (the warm, slightly dimmed tint the floor's old detail picture laid over
// it, folded in a little lighter: the grass on it is this colour too, and a
// field of it should read sunlit, as the old tufts' tips did)
const DETAIL_TINT = [0.84, 0.92, 0.66];
export function groundAt(x, z, out) {
  const n = groundNoise;
  const h = height(x, z);
  let grass = 1;
  const patch = fbm(n, x * 0.05 + 4, z * 0.05, { octaves: 3 });
  lerp3(out, GRASS_DEEP, GRASS, smooth(-0.6, 1.6, h + (patch - 0.5) * 2));
  lerp3(out, out, GRASS_SUN, smooth(2.5, 9, h) * 0.55 + smooth(0.62, 0.8, patch) * 0.35);
  lerp3(out, out, DRY, smooth(0.66, 0.84, fbm(n, x * 0.09, z * 0.09 + 7, { octaves: 2 })) * 0.45);
  // Maggot's field: tilled rows running east-west
  const inF = Math.max(Math.abs(x - fieldMidX) - (FIELD.x1 - FIELD.x0) / 2, Math.abs(z - fieldMidZ) - (FIELD.z1 - FIELD.z0) / 2);
  const tilled = 1 - smooth(-0.6, 0.4, inF);
  if (tilled > 0) {
    const row = 0.5 + 0.5 * Math.sin(z * 2.4);
    lerp3(tmpC, SOIL, GRASS_DEEP, row * 0.35);
    lerp3(out, out, tmpC, tilled);
    grass *= 1 - tilled;
  }
  // the lanes and paths, worn to dirt
  const road = roadAmount(x, z);
  if (road > 0) {
    lerp3(out, out, DIRT, road * (0.82 + fbm(n, x * 0.4, z * 0.4, { octaves: 2 }) * 0.18));
    grass *= 1 - smooth(0.05, 0.6, road);
  }
  // round the doors: trodden; and no grass on the mounds' fronts
  for (const hole of DOORS) {
    const d = Math.hypot(x - hole.x, z - (hole.z + hole.r * 0.95));
    if (d < 2.2) {
      lerp3(out, out, DIRT, (1 - smooth(0.8, 2.2, d)) * 0.6);
      grass *= smooth(0.8, 2.2, d);
    }
    if (Math.hypot(x - hole.x, z - hole.z) < hole.r * 0.95) grass = 0;
  }
  const inn = Math.hypot(x - INN.x, z - (INN.z - INN.d / 2 - 1.5));
  if (inn < 5) {
    lerp3(out, out, DIRT, (1 - smooth(2, 5, inn)) * 0.7);
    grass *= smooth(2, 5, inn);
  }
  // the bridge's footing
  if (Math.abs(x - BRIDGE.x) < 2.5 && z > BRIDGE.z0 - 1 && z < BRIDGE.z1 + 1) grass = 0;
  // mud at the water's edge, and the bed under it
  if (h < 0.15) lerp3(out, out, MUD, smooth(0.15, -0.3, h));
  if (h < WATER_Y) lerp3(out, out, BED, smooth(WATER_Y, -1.2, h));
  grass *= smooth(0.02, 0.25, h);
  // (one colour for the floor and the blades on it)
  out[0] *= DETAIL_TINT[0];
  out[1] *= DETAIL_TINT[1];
  out[2] *= DETAIL_TINT[2];
  return grass;
}

// The Shire's ground map: its colour and grass `size` texels a side over
// the whole floor, its height at a quarter of that (lib/three/groundmap).
export function shireGroundMap({ size = 512 } = {}) {
  const e = WORLD.edge;
  return createGroundMap({ area: { x0: -e, z0: -e, w: e * 2, d: e * 2 }, size, heightSize: Math.max(64, size / 2), paint: groundAt, height });
}

// The ground's shape: a square of the world, `seg` squares a side, its
// corners on the height function.
export function terrainGeometry(seg = 200) {
  const size = WORLD.edge * 2;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  return geo;
}

// The ground: that shape, painted by the ground map per point (sharper
// lanes than the old colour per vertex, a metre apart).
export function makeTerrain(renderer, { seg = 200, map } = {}) {
  const geo = terrainGeometry(seg);
  // (the map is the colour; a fine relief of blades and clover is the grain)
  const tex = grassTextures(renderer);
  const material = new THREE.MeshStandardMaterial({ normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.96 });
  map.paint(material);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// The ground as the terrain draws it: the height function at its corners,
// straight between them as each square's two triangles are (what a thing
// lying on the ground lies on: between the corners the height function
// itself is a few centimetres off it, at a lane's worn edge most, and more
// on a weak device's coarser ground). Cheaper than the height function, too.
// `terrain` is makeTerrain's (or its terrainGeometry).
export function drawnHeight(terrain) {
  const g = terrain.geometry ?? terrain;
  const { width, widthSegments: seg } = g.parameters;
  const y = g.attributes.position.array;
  const n = seg + 1;
  const cell = width / seg;
  const half = width / 2;
  return (x, z) => {
    const fx = Math.min(seg, Math.max(0, (x + half) / cell));
    const fz = Math.min(seg, Math.max(0, (z + half) / cell));
    const i = Math.min(seg - 1, Math.floor(fx));
    const j = Math.min(seg - 1, Math.floor(fz));
    const u = fx - i;
    const v = fz - j;
    // (the corners: i along x, j along z; each square cut from (i, j + 1) to (i + 1, j))
    const a = y[3 * (i + n * j) + 1];
    const b = y[3 * (i + n * (j + 1)) + 1];
    const c = y[3 * (i + 1 + n * (j + 1)) + 1];
    const d = y[3 * (i + 1 + n * j) + 1];
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
}

// The water: one sheet at the water line (the ground hides it everywhere
// but the pond and the stream), rippling, catching the sky and the sun.
export function makeWater() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSky: { value: new THREE.Color(0x9cc3e6) },
      uDeep: { value: new THREE.Color(0x1f4a4a) },
      uSun: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff0d0) },
      uGlints: { value: 1 },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime, uGlints;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float waves(vec2 p) {
        return noise(p * 0.9 + vec2(uTime * 0.35, uTime * 0.2)) * 0.5 + noise(p * 2.3 - vec2(uTime * 0.5, -uTime * 0.3)) * 0.3 + noise(p * 5.0 + uTime * 0.8) * 0.2;
      }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.08;
        float h = waves(p);
        vec3 n = normalize(vec3((h - waves(p + vec2(e, 0.0))) * 1.6, 1.0, (h - waves(p + vec2(0.0, e))) * 1.6));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.25 + 0.65 * fres);
        vec3 r = reflect(-view, n);
        float spec = pow(max(dot(r, uSun), 0.0), 140.0);
        col += uSunColor * spec * 2.4 * uGlints;
        col += uSunColor * smoothstep(0.86, 0.98, h) * 0.12 * uGlints;
        gl_FragColor = vec4(col, 0.86);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // just over the pond and the stream, not the whole world
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(geo, material);
  pond.scale.set(POND.rx * 2.3, 1, POND.rz * 2.3);
  pond.position.set(POND.x, WATER_Y, POND.z);
  const g = new THREE.Group();
  g.add(pond);
  const pts = STREAM.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(geo, material);
    m.scale.set(len + STREAM.w, 1, STREAM.w * 2.2);
    m.position.set((ax + bx) / 2, WATER_Y, (az + bz) / 2);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    g.add(m);
  }
  g.renderOrder = 1;
  return { group: g, material };
}

// wind for anything instanced that sways: bends the top by its height (the
// towns' own; the Shire's things sway in lib/three/wind's one wind)
export function swaying(material, uniforms, strength = 0.12) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 root = instanceMatrix[3].xyz;
        #else
          vec3 root = vec3(0.0);
        #endif
        float bend = position.y * position.y;
        transformed.x += sin(uWind * 1.7 + root.x * 0.35 + root.z * 0.2) * ${strength.toFixed(3)} * bend;
        transformed.z += cos(uWind * 1.3 + root.z * 0.3) * ${(strength * 0.6).toFixed(3)} * bend;`,
      );
  };
  material.customProgramCacheKey = () => `sway${strength}`;
}

// Where grass and flowers may grow: on dry ground, off the lanes, out of
// the buildings, not in Maggot's tilled field.
const growable = (x, z) => {
  if (inWater(x, z) || onRoad(x, z) || height(x, z) < 0.05) return false;
  if (x > FIELD.x0 - 0.5 && x < FIELD.x1 + 0.5 && z > FIELD.z0 - 0.5 && z < FIELD.z1 + 0.5) return false;
  if (Math.abs(x - BRIDGE.x) < 2.5 && z > BRIDGE.z0 - 1 && z < BRIDGE.z1 + 1) return false;
  for (const h of [...HOLES, BAG_END]) if (Math.hypot(x - h.x, z - h.z) < h.r * 0.95) return false;
  return true;
};

// Instances sorted into squares of the world, one InstancedMesh each, so
// the ones off screen aren't drawn.
function chunker(geometry, material, size = 18) {
  const bins = new Map();
  return {
    add(matrix, colour, x, z) {
      const key = `${Math.floor(x / size)},${Math.floor(z / size)}`;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push([matrix.clone(), colour.clone()]);
    },
    build({ receive = true } = {}) {
      const g = new THREE.Group();
      for (const list of bins.values()) {
        const mesh = new THREE.InstancedMesh(geometry, material, list.length);
        list.forEach(([m, c], i) => {
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, c);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.receiveShadow = receive;
        g.add(mesh);
      }
      return g;
    },
  };
}

// Flowers: in the gardens before the doors, and in drifts along the verges.
const FLOWER_COLOURS = [0xf2d24a, 0xe8655a, 0xf3f0e8, 0xb07ad8, 0xf29ac2, 0xf08a3a, 0x7ab0f0];
export function makeFlowers(geometry, material, count, wind) {
  // (their heads nod in the world's one wind, lib/three/wind)
  wind.sway(material, { strength: 0.7, height: 0.4 });
  const bins = chunker(geometry, material, 24);
  const rand = seeded(57);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  let n = 0;
  const put = (x, z, colour) => {
    if (n >= count || !growable(x, z)) return;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    const sc = 0.75 + rand() * 0.5;
    s.set(sc, sc, sc);
    v.set(x, height(x, z) - 0.02, z);
    m.compose(v, q, s);
    tint.set(colour);
    bins.add(m, tint, x, z);
    n += 1;
  };
  // the gardens: an arc in front of each door
  for (const h of [...HOLES, BAG_END]) {
    const colour = FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)];
    for (let i = 0; i < 46; i++) {
      const a = Math.PI * (0.1 + rand() * 0.8);
      const r = h.r * (1.02 + rand() * 0.35);
      put(h.x + Math.cos(a) * r * (rand() < 0.5 ? 1 : -1), h.z + Math.sin(a) * r * 0.9, rand() < 0.7 ? colour : FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)]);
    }
  }
  // drifts along the lanes
  for (const road of ROADS) {
    const len = Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]);
    const dx = (road.b[0] - road.a[0]) / len;
    const dz = (road.b[1] - road.a[1]) / len;
    for (let d = 0; d < len; d += 0.9) {
      if (rand() < 0.45) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const off = road.w / 2 + 0.4 + rand() * 1.4;
      const colour = FLOWER_COLOURS[Math.floor((Math.sin(d * 0.13 + road.a[0]) * 0.5 + 0.5) * FLOWER_COLOURS.length) % FLOWER_COLOURS.length];
      put(road.a[0] + dx * d - dz * off * side, road.a[1] + dz * d + dx * off * side, colour);
    }
  }
  // and wild ones about the fields
  for (let i = 0; i < count && n < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 8 + rand() * (WORLD.radius - 4);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const colour = FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)];
    for (let k = 0; k < 6; k++) put(cx + (rand() - 0.5) * 3, cz + (rand() - 0.5) * 3, colour);
  }
  return bins.build({ receive: false });
}

// Any instanced prop: `list` of { x, z, y?, s?, sy?, turn? }.
export function instances(geometry, material, list, { shadow = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const e = new THREE.Euler();
  list.forEach((o, i) => {
    e.set(o.tilt ?? 0, o.turn ?? 0, 0);
    q.setFromEuler(e);
    s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    v.set(o.x, o.y ?? height(o.x, o.z), o.z);
    m.compose(v, q, s);
    mesh.setMatrixAt(i, m);
    if (o.colour != null) mesh.setColorAt(i, new THREE.Color(o.colour));
  });
  mesh.count = list.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = receive;
  mesh.computeBoundingSphere();
  return mesh;
}
