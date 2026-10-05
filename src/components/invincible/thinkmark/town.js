// The city of Think, Mark!, drawn: every tower one instance of a box (one
// draw for the whole skyline) whose walls are painted in the shader from
// where they are in the world: glass curtain walls, stone with punched
// windows, brick walk-ups, a shopfront at street level; the windows
// reflect the sky by day and light up, one by one, at night. Round it, the
// streets and the park painted on one texture, the river, water towers and
// air-conditioning on the roofs, spires with their lights, and a lower
// skyline running off into the haze beyond where anyone can fly.

import * as THREE from 'three';
import { hot } from '../../avengers/hq/engine';
import { CITY, HALF, RIVER, cellKind, rng } from './city';

const KIND = { glass: 0, stone: 1, brick: 2 };

// ── the walls ──
function facadeMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aStyle;\nvarying vec3 vCity;\nvarying vec3 vCityN;\nvarying vec4 vStyle;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          mat4 im = modelMatrix;
          #ifdef USE_INSTANCING
            im = modelMatrix * instanceMatrix;
          #endif
          vCity = (im * vec4(transformed, 1.0)).xyz;
          vCityN = normalize(mat3(im) * objectNormal);
          vStyle = aStyle;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec3 vCity;
        varying vec3 vCityN;
        varying vec4 vStyle;
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float box(vec2 f, vec4 r) { return step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 cn = normalize(vCityN);
        float kind = vStyle.x;
        float tone = vStyle.y;
        float seed = vStyle.z;
        float roof = step(0.6, cn.y);
        float u = abs(cn.x) > 0.5 ? vCity.z : vCity.x;
        float glassK = 1.0 - step(0.5, kind);
        float brickK = step(1.5, kind);
        float stoneK = 1.0 - glassK - brickK;
        float fh = mix(mix(3.6, 3.2, brickK), 3.9, glassK);
        float cw = mix(mix(3.1, 2.7, brickK), 1.85, glassK);
        vec2 cell = vec2(u / cw, vCity.y / fh);
        vec2 f = fract(cell);
        vec2 wid = floor(cell);
        float win = glassK * box(f, vec4(0.05, 0.95, 0.12, 0.93))
          + stoneK * box(f, vec4(0.2, 0.8, 0.26, 0.84))
          + brickK * box(f, vec4(0.24, 0.76, 0.3, 0.86));
        // the street floor: shopfronts, a band of glass under a sign
        float street = 1.0 - step(4.6, vCity.y);
        float shop = box(vec2(fract(u / 7.0), vCity.y), vec4(0.08, 0.92, 0.35, 3.3));
        win = mix(win, shop, street) * (1.0 - roof);
        vec3 wall = glassK * mix(vec3(0.46, 0.5, 0.55), vec3(0.72, 0.74, 0.74), tone)
          + stoneK * mix(vec3(0.46, 0.43, 0.39), vec3(0.72, 0.69, 0.63), tone)
          + brickK * mix(vec3(0.38, 0.19, 0.14), vec3(0.62, 0.38, 0.28), tone);
        // a floor's band of stone or spandrel, slightly darker
        wall *= 0.92 + 0.08 * step(0.5, fract(vCity.y / fh + 0.35));
        // grime toward the street
        wall *= 0.8 + 0.2 * smoothstep(0.0, 24.0, vCity.y);
        float pane = cityHash(wid + seed * 13.0);
        vec3 glass = mix(vec3(0.07, 0.11, 0.15), vec3(0.16, 0.22, 0.28), pane) * mix(1.0, 1.35, glassK);
        vec3 roofC = vec3(0.3, 0.3, 0.31) * (0.85 + 0.3 * cityHash(floor(vCity.xz * 0.5)));
        diffuseColor.rgb = mix(mix(wall, glass, win), roofC, roof);
        float cityWin = win;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.82, 0.45, glassK), 0.06 + 0.08 * pane, cityWin);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.55 * glassK, 0.85, cityWin);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // a lit window, here and there: whole floors of an office, a few flats
          float floorOn = step(0.55, cityHash(vec2(wid.y, seed * 9.0)));
          float lit = step(mix(0.82, 0.45, floorOn), cityHash(wid * 1.7 + seed * 5.0)) * cityWin * uNight;
          vec3 warm = mix(vec3(1.0, 0.7, 0.38), vec3(0.7, 0.82, 1.0), step(0.7, cityHash(wid + seed)));
          totalEmissiveRadiance += lit * warm * (0.35 + 0.45 * cityHash(wid * 3.1 + seed));
          // shopfronts glow at street level after dark
          totalEmissiveRadiance += street * cityWin * uNight * vec3(1.0, 0.85, 0.6) * 0.8;
          // and after dark the walls themselves are darker than the sky lights them
          diffuseColor.rgb *= 1.0 - 0.45 * uNight * (1.0 - cityWin);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'tm-facade';
  return m;
}

// boxes as instances: [{ x, y, z, w, h, d, kind, tone, seed }]
function boxField(list, material) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const style = new Float32Array(list.length * 4);
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  list.forEach((b, i) => {
    mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y ?? 0, b.z), q, s.set(b.w, b.h, b.d)));
    style.set([b.kind, b.tone, b.seed, 0], i * 4);
  });
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 4));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// ── the ground: streets, pavements and the park on one texture ──
const GROUND = 820; // metres the painted ground covers
function groundTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const k = size / GROUND;
  const at = (v) => (v + GROUND / 2) * k;
  x.fillStyle = '#34373b';
  x.fillRect(0, 0, size, size);
  const lot = CITY.cell - CITY.street;
  for (let i = 0; i < CITY.cells; i++)
    for (let j = 0; j < CITY.cells; j++) {
      const kind = cellKind(i, j);
      if (kind === 'water') continue;
      const cx = -HALF + (i + 0.5) * CITY.cell;
      const cz = -HALF + (j + 0.5) * CITY.cell;
      // the pavement round the block, then the block
      x.fillStyle = '#8b8a86';
      x.fillRect(at(cx - lot / 2 - 3), at(cz - lot / 2 - 3), (lot + 6) * k, (lot + 6) * k);
      x.fillStyle = kind === 'park' ? '#4d7536' : '#5d5e5c';
      x.fillRect(at(cx - lot / 2), at(cz - lot / 2), lot * k, lot * k);
      if (kind === 'park') {
        x.strokeStyle = '#b8a888';
        x.lineWidth = 3 * k;
        x.beginPath();
        x.moveTo(at(cx - lot / 2), at(cz - lot / 2));
        x.lineTo(at(cx + lot / 2), at(cz + lot / 2));
        x.moveTo(at(cx + lot / 2), at(cz - lot / 2));
        x.lineTo(at(cx - lot / 2), at(cz + lot / 2));
        x.stroke();
        x.beginPath();
        x.arc(at(cx), at(cz), 9 * k, 0, Math.PI * 2);
        x.fillStyle = '#6aa0c0';
        x.fill();
      }
    }
  // the streets' paint: a dashed yellow middle, crossings at the corners
  x.setLineDash([3 * k, 3 * k]);
  x.strokeStyle = '#c9a43a';
  x.lineWidth = Math.max(1, 0.3 * k);
  for (let i = 0; i <= CITY.cells; i++) {
    const v = -HALF + i * CITY.cell;
    x.beginPath();
    x.moveTo(at(v), at(-HALF));
    x.lineTo(at(v), at(RIVER.z0));
    x.moveTo(at(-HALF), at(v));
    x.lineTo(at(HALF), at(v));
    x.stroke();
  }
  x.setLineDash([]);
  x.fillStyle = 'rgba(230,230,225,0.75)';
  for (let i = 0; i <= CITY.cells; i++)
    for (let j = 0; j <= CITY.cells; j++) {
      const vx = -HALF + i * CITY.cell;
      const vz = -HALF + j * CITY.cell;
      if (vz > RIVER.z0) continue;
      for (let s = -6; s <= 6; s += 1.5) {
        x.fillRect(at(vx + s - 0.4), at(vz - CITY.street / 2 - 3), 0.8 * k, 2.4 * k);
        x.fillRect(at(vx - CITY.street / 2 - 3), at(vz + s - 0.4), 2.4 * k, 0.8 * k);
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// the street lamps' glow, for the night: a dot at each corner and along each street
function lampTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, size, size);
  const k = size / GROUND;
  const at = (v) => (v + GROUND / 2) * k;
  for (let i = 0; i <= CITY.cells; i++)
    for (let j = 0; j < CITY.cells; j++) {
      const v = -HALF + i * CITY.cell;
      for (let s = 0; s < CITY.cell; s += 16) {
        const w = -HALF + j * CITY.cell + s;
        if (w > RIVER.z0) continue;
        for (const [px, pz] of [
          [v - CITY.street / 2, w],
          [w, v - CITY.street / 2],
        ]) {
          const g = x.createRadialGradient(at(px), at(pz), 0, at(px), at(pz), 6 * k);
          g.addColorStop(0, 'rgba(255,200,130,0.9)');
          g.addColorStop(1, 'rgba(255,200,130,0)');
          x.fillStyle = g;
          x.fillRect(at(px) - 6 * k, at(pz) - 6 * k, 12 * k, 12 * k);
        }
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildTown(city, { small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'town';
  const uniforms = { uNight: { value: 0 } };
  const facade = facadeMaterial(uniforms);
  const r = rng(91);

  // the towers and their top tiers
  const list = [];
  for (const t of city.towers) {
    const style = { kind: KIND[t.kind], tone: t.tone, seed: (t.id * 0.6180339) % 1 };
    list.push({ x: t.x, z: t.z, w: t.w, d: t.d, h: t.h, ...style });
    if (t.top) list.push({ x: t.x, y: t.h, z: t.z, w: t.top.w, d: t.top.d, h: t.top.h, ...style });
  }
  // and the city beyond, low and far, where nobody flies
  const far = [];
  const n = small ? 260 : 520;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = HALF + 70 + r() ** 0.7 * 900;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z > RIVER.z0 - 20 && z < RIVER.z0 + 235) continue; // the river, and its far bank
    const h = 12 + r() ** 2.2 * (d < 700 ? 120 : 60);
    far.push({ x, z, w: 18 + r() * 30, d: 18 + r() * 30, h, kind: h > 60 ? 0 : r() < 0.5 ? 1 : 2, tone: r(), seed: r() });
  }
  const towers = boxField([...list, ...far], facade);
  towers.castShadow = true;
  towers.receiveShadow = true;
  towers.name = 'towers';
  group.add(towers);

  // the ground
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(small ? 1024 : 2048), roughness: 0.92, metalness: 0, emissive: 0xffffff, emissiveMap: lampTexture(small ? 512 : 1024), emissiveIntensity: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND).rotateX(-Math.PI / 2), groundMat);
  ground.receiveShadow = true;
  group.add(ground);
  const outer = new THREE.Mesh(new THREE.RingGeometry(GROUND * 0.5, 3200, 64, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f4144, roughness: 0.95 }));
  outer.position.y = -0.05;
  group.add(outer);

  // the river, and its embankment
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5200, 220).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x16303d, roughness: 0.28, metalness: 0, envMapIntensity: 0.6 }));
  water.position.set(0, 0.06, RIVER.z0 + 110);
  water.receiveShadow = true;
  group.add(water);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(5200, 2.4, 3), new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.9 }));
  wall.position.set(0, 0.4, RIVER.z0 - 1.5);
  group.add(wall);

  // on the roofs: water towers, air-conditioning, spires and their lights
  const tanks = [];
  const units = [];
  const spires = [];
  for (const t of city.towers) {
    const top = t.h + (t.top?.h ?? 0);
    const w = t.top?.w ?? t.w;
    const d = t.top?.d ?? t.d;
    if (t.roof === 'tank') tanks.push([t.x + (r() - 0.5) * w * 0.4, top, t.z + (r() - 0.5) * d * 0.4]);
    else if (t.roof === 'spire') spires.push([t.x, top, t.z, Math.min(w, d) * 0.22, 14 + t.h * 0.18]);
    if (t.roof !== 'spire') for (let i = 0, m = 1 + Math.floor(r() * 3); i < m; i++) units.push([t.x + (r() - 0.5) * w * 0.6, top, t.z + (r() - 0.5) * d * 0.6, 2 + r() * 3, 1.4 + r(), 2 + r() * 2]);
  }
  const mtx = new THREE.Matrix4();
  const inst = (geo, mat, rows, place) => {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, rows.length));
    rows.forEach((row, i) => mesh.setMatrixAt(i, place(row, mtx)));
    mesh.count = rows.length;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  };
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.6, metalness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.45, metalness: 0.7 });
  inst(new THREE.CylinderGeometry(2.2, 2.2, 4, 14).translate(0, 4.4, 0), wood, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.ConeGeometry(2.5, 1.8, 14).translate(0, 7.3, 0), iron, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5).translate(1.4, 1.2, 0), iron, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5).translate(-1.4, 1.2, 0), iron, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), metal, units, ([x, y, z, w, h, d], m) => m.makeScale(w, h, d).setPosition(x, y, z));
  inst(new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0), metal, spires, ([x, y, z, rr, h], m) => m.makeScale(rr, h, rr).setPosition(x, y, z));
  const beacons = inst(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: hot(0xff2a2a, 3), toneMapped: false }), spires, ([x, y, z, , h], m) => m.makeTranslation(x, y + h + 0.6, z));
  beacons.castShadow = false;

  // the park's trees: a crown and a trunk each
  const trees = [];
  for (let i = 0; i < CITY.cells; i++)
    for (let j = 0; j < CITY.cells; j++) {
      if (cellKind(i, j) !== 'park') continue;
      const cx = -HALF + (i + 0.5) * CITY.cell;
      const cz = -HALF + (j + 0.5) * CITY.cell;
      for (let k = 0; k < 42; k++) {
        const x = cx + (r() - 0.5) * 44;
        const z = cz + (r() - 0.5) * 44;
        if (Math.hypot(x - cx, z - cz) < 12) continue;
        trees.push([x, z, 3 + r() * 2.5]);
      }
    }
  inst(new THREE.CylinderGeometry(0.25, 0.35, 1, 6).translate(0, 0.5, 0), wood, trees, ([x, z, s], m) => m.makeScale(1, s * 0.9, 1).setPosition(x, 0, z));
  inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x3f6e2e, roughness: 0.9 }), trees, ([x, z, s], m) => m.makeScale(s, s * 1.1, s).setPosition(x, s * 1.7, z));

  return {
    group,
    uniforms,
    // 0 by day, 1 at night: the windows, the shops and the street lamps
    setNight(k) {
      uniforms.uNight.value = k;
      groundMat.emissiveIntensity = k * 0.9;
    },
    beacons,
  };
}
