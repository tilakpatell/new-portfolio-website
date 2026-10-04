// The Shire's ground in WebGL: the rolling green itself (one mesh, shaped by
// ./rules.js's height and painted in its vertex colours: worn lanes, the
// Party Field, Maggot's tilled rows, mud by the water), the pond and the
// stream under a moving surface, and the grass and flowers on top, instanced
// so thousands cost one draw each.

import * as THREE from 'three';
import { canvasTexture } from '../../../lib/stage3d';
import { fbm, makeCanvas, makeNoise, normalFromField, paintPixels, smooth } from '../../../lib/paint';
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

// A grass detail texture: blades and clover, tiling, plus its relief.
function grassTextures(renderer) {
  const size = 256;
  const n = makeNoise(5);
  const field = new Float32Array(size * size);
  const c = makeCanvas(size);
  paintPixels(c, (u, v, out, x, y) => {
    const blades = fbm(n, u * 64, v * 16, { period: 64, octaves: 2 });
    const clumps = fbm(n, u * 8 + 3, v * 8, { period: 8, octaves: 3 });
    const fine = fbm(n, u * 128, v * 128, { period: 128, octaves: 1 });
    const h = blades * 0.55 + clumps * 0.3 + fine * 0.15;
    field[y * size + x] = h;
    const k = 0.72 + h * 0.5;
    out[0] = 200 * k;
    out[1] = 214 * k;
    out[2] = 180 * k;
  });
  return {
    map: canvasTexture(c, renderer, { repeat: [56, 56] }),
    normalMap: canvasTexture(normalFromField(field, size, size, 2.2), renderer, { repeat: [56, 56], srgb: false }),
  };
}

// The ground: a square of the world, shaped and painted. `seg` squares a side.
export function makeTerrain(renderer, { seg = 200 } = {}) {
  const size = WORLD.edge * 2;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colours = new Float32Array(p.count * 3);
  const n = makeNoise(13);
  const tmp = [0, 0, 0];
  const out = [0, 0, 0];
  const fieldMidX = (FIELD.x0 + FIELD.x1) / 2;
  const fieldMidZ = (FIELD.z0 + FIELD.z1) / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const h = height(x, z);
    p.setY(i, h);
    // grass: deeper in the hollows, sunnier on the tops, dry in patches
    const patch = fbm(n, x * 0.05 + 4, z * 0.05, { octaves: 3 });
    lerp3(out, GRASS_DEEP, GRASS, smooth(-0.6, 1.6, h + (patch - 0.5) * 2));
    lerp3(out, out, GRASS_SUN, smooth(2.5, 9, h) * 0.55 + smooth(0.62, 0.8, patch) * 0.35);
    lerp3(out, out, DRY, smooth(0.66, 0.84, fbm(n, x * 0.09, z * 0.09 + 7, { octaves: 2 })) * 0.45);
    // Maggot's field: tilled rows running east-west
    const inF = Math.max(Math.abs(x - fieldMidX) - (FIELD.x1 - FIELD.x0) / 2, Math.abs(z - fieldMidZ) - (FIELD.z1 - FIELD.z0) / 2);
    const tilled = 1 - smooth(-0.6, 0.4, inF);
    if (tilled > 0) {
      const row = 0.5 + 0.5 * Math.sin(z * 2.4);
      lerp3(tmp, SOIL, GRASS_DEEP, row * 0.35);
      lerp3(out, out, tmp, tilled);
    }
    // the lanes and paths, worn to dirt
    const road = roadAmount(x, z);
    if (road > 0) lerp3(out, out, DIRT, road * (0.82 + fbm(n, x * 0.4, z * 0.4, { octaves: 2 }) * 0.18));
    // round the doors: trodden
    for (const hole of [...HOLES, { ...BAG_END }]) {
      const d = Math.hypot(x - hole.x, z - (hole.z + hole.r * 0.95));
      if (d < 2.2) lerp3(out, out, DIRT, (1 - smooth(0.8, 2.2, d)) * 0.6);
    }
    const inn = Math.hypot(x - INN.x, z - (INN.z - INN.d / 2 - 1.5));
    if (inn < 5) lerp3(out, out, DIRT, (1 - smooth(2, 5, inn)) * 0.7);
    // mud at the water's edge, and the bed under it
    if (h < 0.15) lerp3(out, out, MUD, smooth(0.15, -0.3, h));
    if (h < WATER_Y) lerp3(out, out, BED, smooth(WATER_Y, -1.2, h));
    colours[i * 3] = out[0];
    colours[i * 3 + 1] = out[1];
    colours[i * 3 + 2] = out[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const tex = grassTextures(renderer);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.96 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
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

// Grass tufts: three crossed blades, dark at the root, sunlit at the tip,
// swaying in the wind (in the vertex shader, so it costs nothing to move).
function tuftGeometry() {
  const pos = [];
  const col = [];
  const base = new THREE.Color(0x2f5a22);
  const tip = new THREE.Color(0xa8c860);
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI + 0.3;
    const ca = Math.cos(a) * 0.09;
    const sa = Math.sin(a) * 0.09;
    const lean = 0.08 * (b - 1);
    const h = 0.42 + b * 0.06;
    pos.push(-ca, 0, -sa, ca, 0, sa, lean, h, lean * 0.5);
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // point the normals up, so the blades light like the ground they grow from
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

// wind for anything instanced that sways: bends the top by its height
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

export function makeGrass(count, wind) {
  const geo = tuftGeometry();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  swaying(material, wind, 0.16);
  const mesh = new THREE.InstancedMesh(geo, material, count);
  const rand = seeded(99);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  let n = 0;
  let tries = 0;
  while (n < count && tries++ < count * 6) {
    // thickest near the middle, where the camera goes
    const a = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.75) * (WORLD.radius + 6);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!growable(x, z)) continue;
    const sc = 0.7 + rand() * 0.8;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    s.set(sc, sc * (0.8 + rand() * 0.6), sc);
    v.set(x, height(x, z) - 0.03, z);
    m.compose(v, q, s);
    mesh.setMatrixAt(n, m);
    tint.setHSL(0.24 + rand() * 0.06, 0.5, 0.42 + rand() * 0.18);
    mesh.setColorAt(n, tint);
    n += 1;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// Flowers: in the gardens before the doors, and in drifts along the verges.
const FLOWER_COLOURS = [0xf2d24a, 0xe8655a, 0xf3f0e8, 0xb07ad8, 0xf29ac2, 0xf08a3a, 0x7ab0f0];
export function makeFlowers(geometry, material, count, wind) {
  swaying(material, wind, 0.1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
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
    mesh.setMatrixAt(n, m);
    tint.set(colour);
    mesh.setColorAt(n, tint);
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
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
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
