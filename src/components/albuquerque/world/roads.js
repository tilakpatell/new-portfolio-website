// Albuquerque's streets, drawn: the asphalt (following the ground where a
// road runs on out into the dunes), the lines on it (Central's double
// yellow and its lanes, the boulevards' bike lines, the dashes down the side
// streets, the crosswalks at the lights and a stop line wherever anyone has
// to stop), the sidewalks with their kerbs, the blocks they ring, and what's
// laid on each block: car parks with their bays painted, drives, lawns, a
// plaza's pavers, gravel yards.
//
// createStreets({ ground, noise, aniso, small }) → { object, dispose }.
// `ground` is the desert floor's own material: a block that's bare is the
// same desert, a kerb's height up.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, GRID, NODES, ROADS, groundHeight } from './rules';
import { asphaltMaps, concreteMaps, dirtMaps, gravelMaps, paverMaps } from './terrain';

const YELLOW = 0xe8b830;
const WHITE = 0xeeece4;
const ROAD_Y = 0.02;
const PAINT_Y = 0.045;

// Textures laid by where they are in the world (so a surface of any size
// tiles evenly, and two that overlap match): `scale` metres a tile.
function worldUv(mat, scale, { lot = false, key = '' } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${lot ? 'attribute vec4 aLot;\nvarying vec2 vLotP;\nvarying vec2 vLotS;' : ''}`)
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        {
          vec4 wq = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            wq = instanceMatrix * wq;
          #endif
          wq = modelMatrix * wq;
          vec2 wuv = wq.xz / ${scale.toFixed(3)};
          #ifdef USE_MAP
            vMapUv = wuv;
          #endif
          #ifdef USE_NORMALMAP
            vNormalMapUv = wuv;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv = wuv;
          #endif
          ${lot ? 'vLotP = wq.xz - aLot.xy; vLotS = aLot.zw;' : ''}
        }`,
      );
    if (lot)
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vLotP;\nvarying vec2 vLotS;').replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          // the bays: a white line every 2.8 m across each row of cars, rows 6.2 m deep
          float rows = max(1.0, floor(vLotS.y / 6.2));
          float cols = floor((vLotS.x - 1.0) / 2.8);
          float bx = (vLotP.x - 0.5) / 2.8;
          float inBays = step(0.0, bx) * step(bx, cols + 0.02) * step(vLotP.y, rows * 6.2);
          float line = step(fract(bx + 0.018), 0.036);
          float fy = fract(vLotP.y / 6.2);
          line *= step(0.06, fy) * step(fy, 0.94);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.85, 0.8), line * inBays * 0.9);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `abq-world-uv-${scale}-${lot}-${key}`;
  return mat;
}

// A road's strip, cut into lengths so it follows the ground: uv in world
// metres (asphalt) or across and along (the dirt track's ruts).
function strip(r, { ext = 0 } = {}) {
  const len = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z);
  const fx = (r.b.x - r.a.x) / len;
  const fz = (r.b.z - r.a.z) / len;
  const rx = -fz * (r.w / 2);
  const rz = fx * (r.w / 2);
  const flat = Math.max(Math.hypot(r.a.x, r.a.z), Math.hypot(r.b.x, r.b.z)) < 300;
  const n = flat ? 1 : Math.ceil((len + ext * 2) / 6);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const s = -ext + ((len + ext * 2) * i) / n;
    const cx = r.a.x + fx * s;
    const cz = r.a.z + fz * s;
    for (const side of [-1, 1]) {
      const x = cx + rx * side;
      const z = cz + rz * side;
      pos.push(x, groundHeight(x, z) + ROAD_Y, z);
      uv.push(...(r.dirt ? [side < 0 ? 0 : 1, s / 7] : [x / 7, z / 7]));
    }
    if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (wound so it faces up whichever way the road runs)
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

// The corners along a road: where along it each one is, and how far either
// side of it the crossing (and its crosswalk) reaches.
function cornersOn(r) {
  const along = r.a.z === r.b.z;
  const out = [];
  for (const n of NODES) {
    if (along ? n.z !== r.a.z : n.x !== r.a.x) continue;
    const s = along ? (n.x - r.a.x) * Math.sign(r.b.x - r.a.x) : (n.z - r.a.z) * Math.sign(r.b.z - r.a.z);
    const half = along ? n.hw : n.hd;
    out.push({ n, s, half });
  }
  return out;
}

export function createStreets({ ground, aniso = 8, small = false } = {}) {
  const root = new THREE.Group();
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const size = small ? 256 : 512;

  // ── the asphalt and the dirt ──
  const asphalt = asphaltMaps(size, aniso);
  const dirt = dirtMaps(size, aniso);
  owned.push(...Object.values(asphalt), ...Object.values(dirt));
  const roadMat = own(new THREE.MeshStandardMaterial({ ...asphalt, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9) }));
  // the north–south streets win where they cross the others (it's the same asphalt either way)
  const roadMatNS = own(roadMat.clone());
  roadMatNS.polygonOffset = true;
  roadMatNS.polygonOffsetFactor = -1;
  roadMatNS.polygonOffsetUnits = -1;
  const dirtMat = own(new THREE.MeshStandardMaterial({ ...dirt, roughness: 1 }));
  const ewGeo = [];
  const nsGeo = [];
  for (const r of ROADS) {
    if (r.dirt) {
      const m = new THREE.Mesh(own(strip(r)), dirtMat);
      m.receiveShadow = true;
      root.add(m);
      continue;
    }
    // ends at a corner reach on across it, so the corner's covered
    const inTown = Math.max(Math.abs(r.a.x), Math.abs(r.b.x)) <= GRID.xs.at(-1) && Math.max(Math.abs(r.a.z), Math.abs(r.b.z)) <= GRID.zs.at(-1);
    (r.a.z === r.b.z ? ewGeo : nsGeo).push(strip(r, { ext: inTown ? 6 : 0 }));
  }
  for (const [list, mat] of [
    [ewGeo, roadMat],
    [nsGeo, roadMatNS],
  ]) {
    const g = own(mergeGeometries(list));
    for (const x of list) x.dispose();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    root.add(m);
  }

  // ── the lines ──
  const marks = []; // { x, z, yaw, w, l, c }
  const line = (x, z, yaw, w, l, c) => marks.push({ x, z, yaw, w, l, c });
  for (const r of ROADS) {
    if (r.dirt) continue;
    const len = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z);
    const fx = (r.b.x - r.a.x) / len;
    const fz = (r.b.z - r.a.z) / len;
    const yaw = Math.atan2(fx, fz);
    const at = (s, off) => [r.a.x + fx * s - fz * off, r.a.z + fz * s + fx * off];
    const corners = cornersOn(r);
    // the stretches of plain road between corners (and their crosswalks)
    const gaps = corners.map((c) => [c.s - c.half - 4.6, c.s + c.half + 4.6]).sort((a, b) => a[0] - b[0]);
    const stretches = [];
    let from = 0;
    for (const [g0, g1] of gaps) {
      if (g0 > from) stretches.push([from, Math.min(len, g0)]);
      from = Math.max(from, g1);
    }
    if (from < len) stretches.push([from, len]);
    const town = r.w >= 12 || ['marquette', 'copper', 'gold', 'coal', 'riogrande', 'juan', 'sixth', 'second', 'university', 'negra'].includes(r.id);
    const desert = !town;
    const solid = (off, w, c, s0, s1) => {
      for (let s = s0; s < s1 - 0.01; s += 6) {
        const l = Math.min(6, s1 - s);
        const [x, z] = at(s + l / 2, off);
        line(x, z, yaw, w, l + 0.02, c);
      }
    };
    const dashed = (off, w, c, s0, s1, dash, gap) => {
      for (let s = s0 + gap / 2; s + dash <= s1; s += dash + gap) {
        const [x, z] = at(s + dash / 2, off);
        line(x, z, yaw, w, dash, c);
      }
    };
    for (const [s0, s1] of stretches) {
      if (s1 - s0 < 2) continue;
      if (r.w >= 16) {
        // Central: a double yellow down the middle, two lanes each way
        solid(-0.2, 0.14, YELLOW, s0, s1);
        solid(0.2, 0.14, YELLOW, s0, s1);
        dashed(-4, 0.14, WHITE, s0, s1, 3, 6);
        dashed(4, 0.14, WHITE, s0, s1, 3, 6);
      } else if (r.w >= 12) {
        // a boulevard: double yellow, and a bike lane each side
        solid(-0.18, 0.13, YELLOW, s0, s1);
        solid(0.18, 0.13, YELLOW, s0, s1);
        solid(-(r.w / 2 - 1.6), 0.14, WHITE, s0, s1);
        solid(r.w / 2 - 1.6, 0.14, WHITE, s0, s1);
      } else if (desert) {
        // out of town: a dashed centre and white edges
        dashed(0, 0.14, YELLOW, s0, s1, 3, 6);
        solid(-(r.w / 2 - 0.35), 0.14, WHITE, s0, s1);
        solid(r.w / 2 - 0.35, 0.14, WHITE, s0, s1);
      } else if (r.id !== 'negra') dashed(0, 0.12, YELLOW, s0, s1, 2.4, 4.8);
    }
    // where the city's streets meet: crosswalks at the lights, stop lines where anyone stops
    for (const c of corners) {
      const N = c.n;
      for (const side of [-1, 1]) {
        // the approach coming in from this side (heading toward the corner)
        const s = c.s + side * (c.half + 0.6);
        if (s < 0 || s > len) continue;
        if (N.signal) {
          // stripes along the traffic, across the road
          for (let o = -r.w / 2 + 0.7; o <= r.w / 2 - 0.6; o += 1.15) {
            const [x, z] = at(c.s + side * (c.half + 2.2), o);
            line(x, z, yaw, 0.55, 3, WHITE);
          }
        }
        const stops = N.signal || N.stop === 'both' || N.stop === (r.a.z === r.b.z ? 'ew' : 'ns');
        if (!stops) continue;
        // the bar across the lanes coming in (on their right: the side away from `side`)
        const lanes = -side; // heading toward the corner from this side, its right is this way across
        const off = lanes * (r.w / 4 + 0.05);
        const [x, z] = at(c.s + side * (c.half + 4.2), off);
        line(x, z, yaw + Math.PI / 2, 0.45, r.w / 2 - 0.5, WHITE);
      }
    }
  }
  {
    const geo = own(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    const mat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const inst = new THREE.InstancedMesh(geo, mat, marks.length);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    marks.forEach((m, i) => {
      o.position.set(m.x, groundHeight(m.x, m.z) + PAINT_Y, m.z);
      o.rotation.set(0, m.yaw, 0);
      o.scale.set(m.w, 1, m.l);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
      inst.setColorAt(i, c.set(m.c));
    });
    inst.receiveShadow = true;
    root.add(inst);
  }

  // ── the blocks: sidewalks and kerbs round each, the desert (or what's laid on it) inside ──
  const K = GRID.kerb;
  const slabs = [];
  const pads = [];
  const quad = (x0, z0, x1, z1, y, list, uvScale) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    if (uvScale) {
      const p = g.attributes.position;
      const uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / uvScale, p.getZ(i) / uvScale);
    }
    list.push(g);
  };
  const kerbFace = (x0, z0, x1, z1, nx, nz) => {
    // a vertical face from the street up to the sidewalk, facing (nx, nz)
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.PlaneGeometry(len, K).translate(0, K / 2, 0);
    g.rotateY(Math.atan2(nx, nz));
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 1.5, p.getY(i) / 1.5);
    slabs.push(g);
  };
  for (const b of CITY.blocks) {
    const k = b.kerb;
    quad(k.x0, k.z0, k.x1, b.z0, K, slabs, 1.5);
    quad(k.x0, b.z1, k.x1, k.z1, K, slabs, 1.5);
    quad(k.x0, b.z0, b.x0, b.z1, K, slabs, 1.5);
    quad(b.x1, b.z0, k.x1, b.z1, K, slabs, 1.5);
    kerbFace(k.x0, k.z0, k.x1, k.z0, 0, -1);
    kerbFace(k.x0, k.z1, k.x1, k.z1, 0, 1);
    kerbFace(k.x0, k.z0, k.x0, k.z1, -1, 0);
    kerbFace(k.x1, k.z0, k.x1, k.z1, 1, 0);
    quad(b.x0, b.z0, b.x1, b.z1, K, pads);
  }
  const concrete = concreteMaps(small ? 128 : 256, aniso);
  owned.push(...Object.values(concrete));
  const slabMat = own(new THREE.MeshStandardMaterial({ ...concrete, roughness: 1, normalScale: new THREE.Vector2(0.7, 0.7) }));
  {
    const g = own(mergeGeometries(slabs.map((s) => (s.index ? s.toNonIndexed() : s))));
    for (const s of slabs) s.dispose();
    const m = new THREE.Mesh(g, slabMat);
    m.receiveShadow = true;
    root.add(m);
    const pg = own(mergeGeometries(pads));
    for (const s of pads) s.dispose();
    const pm = new THREE.Mesh(pg, ground);
    pm.receiveShadow = true;
    root.add(pm);
  }

  // ── what's laid on the blocks ──
  const pavers = paverMaps(small ? 128 : 256, aniso);
  const gravel = gravelMaps(small ? 128 : 256, aniso);
  owned.push(...Object.values(pavers), ...Object.values(gravel));
  const lotMats = {
    asphalt: worldUv(own(new THREE.MeshStandardMaterial({ ...asphalt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), 7, { lot: true }),
    concrete: worldUv(own(new THREE.MeshStandardMaterial({ ...concrete, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), 1.5, { key: 'c' }),
    pavers: worldUv(own(new THREE.MeshStandardMaterial({ ...pavers, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), 2.4, { key: 'p' }),
    gravel: worldUv(own(new THREE.MeshStandardMaterial({ ...gravel, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), 2, { key: 'g' }),
    grass: grassMaterial(own),
  };
  const unit = own(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  for (const [surface, mat] of Object.entries(lotMats)) {
    const list = CITY.lots.filter((l) => l.surface === surface);
    if (!list.length) continue;
    const geo = surface === 'asphalt' ? own(unit.clone()) : unit;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    const o = new THREE.Object3D();
    const lot = surface === 'asphalt' ? new Float32Array(list.length * 4) : null;
    list.forEach((l, i) => {
      o.position.set(l.x, K + 0.01, l.z);
      o.scale.set(l.w, 1, l.d);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
      // (where the car park's bays start, and how big it is; none if it has no bays)
      if (lot) lot.set([l.x - l.w / 2, l.z - l.d / 2, l.bays ? l.w : 0, l.bays ? l.d : 0], i * 4);
    });
    if (lot) geo.setAttribute('aLot', new THREE.InstancedBufferAttribute(lot, 4));
    inst.receiveShadow = true;
    root.add(inst);
  }

  return {
    object: root,
    dispose() {
      for (const o of owned) o.dispose?.();
    },
  };
}

// A lawn, watered: green with the noise of the world in it, worn paler in patches.
function grassMaterial(own) {
  const mat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGrassP;').replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      {
        vec4 gq = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gq = instanceMatrix * gq;
        #endif
        vGrassP = (modelMatrix * gq).xz;
      }`,
    );
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGrassP;').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        vec2 p = vGrassP;
        float a = sin(p.x * 0.37 + sin(p.y * 0.21) * 2.0) * 0.5 + 0.5;
        float b = fract(sin(dot(floor(p * 3.0), vec2(12.9898, 78.233))) * 43758.5453);
        float c = fract(sin(dot(floor(p * 17.0), vec2(39.3468, 11.135))) * 24634.6345);
        vec3 green = mix(vec3(0.24, 0.33, 0.13), vec3(0.37, 0.43, 0.18), a);
        green = mix(green, vec3(0.52, 0.48, 0.3), smoothstep(0.82, 1.0, a * 0.6 + b * 0.5) * 0.6);
        // mown in stripes
        green *= 0.92 + 0.08 * step(0.5, fract(p.x / 3.0));
        diffuseColor.rgb = green * (0.88 + 0.24 * c);
      }`,
    );
  };
  mat.customProgramCacheKey = () => 'abq-grass';
  return mat;
}
