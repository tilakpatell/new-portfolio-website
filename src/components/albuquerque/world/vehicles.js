// The town's cars, built in code: a sedan, a pickup, an SUV, a van, a
// lowrider and a hatchback, each its side drawn as a profile and pushed out
// to its width with rounded edges, glass where the windows are, wheels, a
// bumper and lights that come on after dark. Every car of a kind is one
// instance of one mesh, painted its own colour, so the whole traffic and
// every car left parked is six draws.
//
// createFleet({ parked, max }) → { object, set(cars), update(night), dispose }:
// `parked` are plan.js's parked cars (placed once), `max` how many moving
// cars there can be of each kind; set() places the moving ones each frame
// ({ x, y, z, yaw, type, tint, brake }). footprint(type) is a kind's size on
// the ground, [width, length] in metres (for the blob under a moving one).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAR_TYPES } from './plan';

// Each kind: its side profile (z along the car, front +z; y up), its width,
// where its windows begin (the belt line), its wheels, and its bumpers and
// lights. All in metres.
const KINDS = {
  sedan: {
    profile: [[-2.3, 0.32], [-2.33, 0.64], [-2.16, 0.98], [-1.28, 1.03], [-0.86, 1.43], [0.36, 1.46], [1.06, 1.03], [2.06, 0.88], [2.33, 0.64], [2.31, 0.32]],
    width: 1.8,
    belt: 1.04,
    wheel: 0.34,
    base: 2.75,
    lights: { front: [2.3, 0.72, 0.62], rear: [-2.3, 0.8, 0.6] },
  },
  pickup: {
    profile: [[-2.72, 0.46], [-2.75, 1.06], [-0.78, 1.06], [-0.74, 1.8], [0.46, 1.84], [1.16, 1.2], [2.42, 1.06], [2.74, 0.94], [2.72, 0.46]],
    width: 1.96,
    belt: 1.21,
    wheel: 0.4,
    base: 3.3,
    bed: -0.78, // everything behind this, on top, is the open bed
    lights: { front: [2.72, 0.86, 0.68], rear: [-2.73, 0.86, 0.78] },
  },
  suv: {
    profile: [[-2.4, 0.42], [-2.46, 1.02], [-2.36, 1.84], [0.74, 1.88], [1.36, 1.24], [2.26, 1.1], [2.46, 0.9], [2.43, 0.42]],
    width: 1.96,
    belt: 1.25,
    wheel: 0.39,
    base: 2.85,
    lights: { front: [2.44, 0.98, 0.66], rear: [-2.44, 1.18, 0.74] },
  },
  van: {
    profile: [[-2.56, 0.4], [-2.6, 2.04], [1.18, 2.1], [1.96, 1.36], [2.46, 1.12], [2.6, 0.86], [2.57, 0.4]],
    width: 2.0,
    belt: 1.34,
    wheel: 0.36,
    base: 3.2,
    lights: { front: [2.58, 0.96, 0.7], rear: [-2.6, 1.0, 0.82] },
  },
  lowrider: {
    profile: [[-2.6, 0.24], [-2.63, 0.6], [-2.3, 0.82], [-1.42, 0.86], [-0.96, 1.22], [0.2, 1.25], [0.92, 0.88], [2.42, 0.76], [2.63, 0.55], [2.61, 0.24]],
    width: 1.96,
    belt: 0.87,
    wheel: 0.31,
    base: 3.05,
    chrome: true,
    lights: { front: [2.6, 0.6, 0.66], rear: [-2.62, 0.62, 0.66] },
  },
  hatch: {
    profile: [[-1.96, 0.35], [-1.99, 0.96], [-1.86, 1.42], [0.26, 1.48], [0.86, 1.01], [1.76, 0.86], [1.99, 0.66], [1.96, 0.35]],
    width: 1.74,
    belt: 1.02,
    wheel: 0.31,
    base: 2.45,
    lights: { front: [1.97, 0.76, 0.6], rear: [-1.98, 0.92, 0.6] },
  },
};

const GLASS = new THREE.Color(0x10161c);
const TYRE = new THREE.Color(0x111214);
const DARK = new THREE.Color(0x2a2b2d);
const CHROME = new THREE.Color(0xd8dadc);
const LIGHT_F = new THREE.Color(0xf4f1e6);
const LIGHT_R = new THREE.Color(0x8a1410);
const BED = new THREE.Color(0x1c1c1e);

// One part of a car, with its colour, whether it takes the paint, and whether it lights up (1 front, 2 rear).
function part(geo, color, paint = 0, glow = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color.toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aPaint', new THREE.BufferAttribute(new Float32Array(n).fill(paint), 1));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aPaint', 'aGlow'].includes(k)) g.deleteAttribute(k);
  return g;
}

// The body: the profile pushed out to the car's width, its edges rounded;
// then every face above the belt line that isn't the roof is glass.
function body(k) {
  const shape = new THREE.Shape();
  k.profile.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const bevel = 0.07;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: k.width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 1 });
  // the shape's x is along the car: turn it so that's z, and centre it across
  geo.rotateY(-Math.PI / 2);
  geo.translate((k.width - bevel * 2) / 2, 0, 0);
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const paint = new Float32Array(n);
  const white = new THREE.Color(1, 1, 1);
  for (let t = 0; t < n; t += 3) {
    let cy = 0;
    let cz = 0;
    let ny = 0;
    for (let v = t; v < t + 3; v++) {
      cy += pos.getY(v) / 3;
      cz += pos.getZ(v) / 3;
      ny += nrm.getY(v) / 3;
    }
    const roofTop = ny > 0.82 && cy > k.belt + 0.2;
    const glass = cy > k.belt + 0.03 && !roofTop;
    const bed = k.bed !== undefined && cz < k.bed && ny > 0.82 && cy > 0.9;
    const c = glass ? GLASS : bed ? BED : white;
    for (let v = t; v < t + 3; v++) {
      c.toArray(col, v * 3);
      paint[v] = glass || bed ? 0 : 1;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aPaint', new THREE.BufferAttribute(paint, 1));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

function build(name) {
  const k = KINDS[name];
  const parts = [body(k)];
  const len = Math.max(...k.profile.map(([z]) => z)) - Math.min(...k.profile.map(([z]) => z));
  const bottom = Math.min(...k.profile.map(([, y]) => y));
  // the underside, dark, between the wheels
  parts.push(part(new THREE.BoxGeometry(k.width - 0.3, Math.max(0.05, bottom - 0.14), len - 0.5).translate(0, (bottom + 0.14) / 2, 0), DARK));
  // the wheels: tyre and hub
  for (const z of [-k.base / 2, k.base / 2])
    for (const s of [-1, 1]) {
      const x = s * (k.width / 2 - 0.13);
      parts.push(part(new THREE.CylinderGeometry(k.wheel, k.wheel, 0.26, 14).rotateZ(Math.PI / 2).translate(x, k.wheel, z), TYRE));
      parts.push(part(new THREE.CylinderGeometry(k.wheel * 0.62, k.wheel * 0.62, 0.04, 12).rotateZ(Math.PI / 2).translate(x + s * 0.12, k.wheel, z), k.chrome ? CHROME : new THREE.Color(0x8a8d90)));
    }
  // bumpers
  const zMax = Math.max(...k.profile.map(([z]) => z));
  const zMin = Math.min(...k.profile.map(([z]) => z));
  const bump = k.chrome ? CHROME : DARK;
  parts.push(part(new THREE.BoxGeometry(k.width - 0.06, 0.2, 0.18).translate(0, bottom + 0.12, zMax - 0.02), bump));
  parts.push(part(new THREE.BoxGeometry(k.width - 0.06, 0.2, 0.18).translate(0, bottom + 0.12, zMin + 0.02), bump));
  // the lights, front and back, a pair each
  const [fz, fy, fx] = k.lights.front;
  const [rz, ry, rx] = k.lights.rear;
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.34, 0.14, 0.06).translate((s * fx), fy, fz + 0.01), LIGHT_F, 0, 1));
    parts.push(part(new THREE.BoxGeometry(0.3, 0.16, 0.06).translate(s * rx, ry, rz - 0.01), LIGHT_R, 0, 2));
    // a mirror on each side
    parts.push(part(new THREE.BoxGeometry(0.12, 0.12, 0.2).translate(s * (k.width / 2 + 0.05), k.belt + 0.06, (fz + rz) * 0.5 + len * 0.17), DARK));
  }
  // the lowrider's chrome trim down its side
  if (k.chrome) for (const s of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.03, 0.05, len * 0.8).translate(s * (k.width / 2 + 0.005), bottom + 0.34, 0), CHROME));
  const geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  geo.computeBoundingSphere();
  return geo;
}

// Paint: what Albuquerque drives. Mostly white, silver, grey and black,
// then the sun-faded reds, blues and greens, and the odd loud one.
const PAINT = [0xf2f0ea, 0xf2f0ea, 0xe6e4de, 0xb9bcbf, 0xa2a6aa, 0x5c6166, 0x2a2c2f, 0x161718, 0x7a1f1d, 0xa8322a, 0x1f3f6b, 0x3a6a9a, 0x2f4f3a, 0x8a7a5a, 0xc9b48a, 0x6b4a8a, 0x2c8a8a, 0xd9a521];
const LOWRIDER = [0x7a1f8a, 0x1f8a8a, 0xb31f2e, 0x1f4fb3, 0xc98a1f];
export const paintFor = (tint, type) => (CAR_TYPES[type] === 'lowrider' ? LOWRIDER[Math.floor(tint * LOWRIDER.length)] : PAINT[Math.floor(tint * PAINT.length)]);

function fleetMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.15 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = uniforms.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPaint;\nattribute float aGlow;\nvarying float vPaint;\nvarying float vGlow;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        // only the paintwork takes the car's own colour (vColor's a vec3 or a vec4, by three's version)
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(color.rgb, color.rgb * instanceColor.rgb, aPaint);
        #endif
        vPaint = aPaint;
        vGlow = aGlow;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vPaint;\nvarying float vGlow;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.12, 0.38, vPaint);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.95, 0.82) * step(0.5, vGlow) * step(vGlow, 1.5) * (0.15 + uNight * 1.4);
        totalEmissiveRadiance += vec3(1.0, 0.08, 0.05) * step(1.5, vGlow) * (0.2 + uNight * 1.1);`,
      );
  };
  m.customProgramCacheKey = () => 'abq-fleet';
  return m;
}

// A kind's size on the ground, [width, length], by its CAR_TYPES index.
export function footprint(type) {
  const k = KINDS[CAR_TYPES[type]] ?? KINDS.sedan;
  const zs = k.profile.map(([z]) => z);
  return [k.width, Math.max(...zs) - Math.min(...zs)];
}

export function createFleet({ parked = [], max = 8 } = {}) {
  const uniforms = { uNight: { value: 0 } };
  const material = fleetMaterial(uniforms);
  const group = new THREE.Group();
  const meshes = CAR_TYPES.map((name, type) => {
    const geo = build(name);
    const still = parked.filter((p) => p.type === type);
    const mesh = new THREE.InstancedMesh(geo, material, still.length + max);
    mesh.frustumCulled = false;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    still.forEach((p, i) => {
      o.position.set(p.x, p.y ?? 0, p.z);
      o.rotation.set(0, p.yaw, 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      // a parked car's colour, from where it is
      mesh.setColorAt(i, c.set(paintFor(Math.abs(Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453) % 1, type)));
    });
    for (let i = still.length; i < still.length + max; i++) mesh.setColorAt(i, c.set(0xffffff));
    mesh.count = still.length;
    group.add(mesh);
    return { mesh, base: still.length };
  });
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  return {
    object: group,
    // the moving cars, where they are this frame
    set(cars) {
      const used = meshes.map(() => 0);
      for (const car of cars) {
        const m = meshes[car.type];
        if (!m) continue;
        const k = m.base + used[car.type];
        if (used[car.type] >= max) continue;
        used[car.type]++;
        o.position.set(car.x, car.y ?? 0, car.z);
        o.rotation.set(car.pitch ?? 0, car.yaw, 0, 'YXZ');
        o.updateMatrix();
        m.mesh.setMatrixAt(k, o.matrix);
        if (car.paint !== undefined && m.mesh.userData[k] !== car.paint) {
          m.mesh.userData[k] = car.paint;
          m.mesh.setColorAt(k, c.set(car.paint));
          m.mesh.instanceColor.needsUpdate = true;
        }
      }
      meshes.forEach((m, type) => {
        m.mesh.count = m.base + used[type];
        m.mesh.instanceMatrix.needsUpdate = true;
      });
    },
    update(night) {
      uniforms.uNight.value = night;
    },
    dispose() {
      for (const m of meshes) {
        m.mesh.geometry.dispose();
        m.mesh.dispose();
      }
      material.dispose();
    },
  };
}
