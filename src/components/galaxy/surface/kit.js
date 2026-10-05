// What the worlds' own props are built from (props.js and the worlds'
// builders): parts put together as the galaxy's code-built ships are
// (universe/trafficKit.js: a geometry, where it goes, its colour, the
// material it's drawn with), baked into one mesh per material, each part's
// colour in its vertices. A handful of shared materials: painted metal
// with panel lines, bare metal, weathered stone, adobe, cloth, bark,
// leaves, glass and glow (hot enough to bloom). All in metres.

import * as THREE from 'three';
import { bake, canvasTexture, panelTexture, part, place, rod, between, compose, mirror, ball, upright } from '../../universe/trafficKit';
import { rng } from './noise';

export { part, place, rod, between, compose, mirror, ball, upright };

const { PI } = Math;

// a grey speckled texture: grime on metal, the grain of stone and adobe
function grimeTexture(seed = 7) {
  const r = rng(seed);
  return canvasTexture(256, (c, n) => {
    c.fillStyle = '#e4e4e4';
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + r() * 105;
      c.fillStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`;
      const s = 1 + r() * r() * 9;
      c.fillRect(r() * n, r() * n, s, s);
    }
    // streaks, down (rain and dust down a wall)
    for (let i = 0; i < 70; i++) {
      const v = 120 + r() * 70;
      c.fillStyle = `rgba(${v},${v},${v},0.12)`;
      c.fillRect(r() * n, r() * n, 1 + r() * 3, 10 + r() * 60);
    }
  });
}

export function createKit({ seed = 11 } = {}) {
  const owned = [];
  const own = (x) => {
    owned.push(x);
    return x;
  };
  const r = rng(seed);
  const grime = own(grimeTexture(seed));
  grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
  grime.colorSpace = THREE.SRGBColorSpace;
  const plates = own(panelTexture(r, { min: 10, base: 222, spread: 16, seam: 0.55, detail: 0.35 }));
  plates.wrapS = plates.wrapT = THREE.RepeatWrapping;
  plates.colorSpace = THREE.SRGBColorSpace;
  const std = (o, density) => {
    const m = own(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }));
    m.userData.density = density;
    return m;
  };
  const mats = {
    paint: std({ roughness: 0.72, metalness: 0.15, map: plates }, 0.35),
    metal: std({ roughness: 0.42, metalness: 0.55, map: grime }, 0.5),
    stone: std({ roughness: 0.96, map: grime }, 0.18),
    adobe: std({ roughness: 0.98, map: grime }, 0.12),
    cloth: std({ roughness: 1, side: THREE.DoubleSide }, 0.5),
    bark: std({ roughness: 0.95, map: grime }, 0.6),
    leaf: std({ roughness: 0.82, side: THREE.DoubleSide }, 0.5),
    dark: std({ roughness: 0.55, metalness: 0.2 }, 1),
    glass: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55 })),
    glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  };
  for (const m of [mats.glass, mats.glow]) m.userData.density = 1;

  // one geometry of the parts drawn with one material (for instancing)
  const geometry = (parts) => own(bake(parts, mats[parts[0]?.to ?? 'paint']?.userData.density ?? 0.5));

  return {
    mats,
    own,
    rand: r,
    geometry,
    // parts → a group of meshes, one per material; shadows cast unless
    // they glow or see through
    build(parts, { shadows = true, name = 'prop' } = {}) {
      const group = new THREE.Group();
      group.name = name;
      const by = {};
      for (const p of parts) (by[p.to ?? 'paint'] ??= []).push(p);
      for (const [to, list] of Object.entries(by)) {
        const mat = mats[to] ?? mats.paint;
        const mesh = new THREE.Mesh(own(bake(list, mat.userData.density ?? 0.5)), mat);
        mesh.name = to;
        mesh.castShadow = shadows && to !== 'glow' && to !== 'glass';
        mesh.receiveShadow = to !== 'glow';
        group.add(mesh);
      }
      return group;
    },
    dispose() {
      for (const o of owned) o.dispose();
      owned.length = 0;
    },
  };
}

// ── Shapes ──

// a lumpy rock, about 1 across, its base flat-ish at y = 0
export function rockGeometry(seed = 1, { sharp = 0.35, detail = 1, flat = 0.55 } = {}) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const r = rng(seed);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 5 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (r() - 0.4) * sharp]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 3;
    v.multiplyScalar(k);
    v.y = v.y < 0 ? v.y * 0.25 : v.y * flat * 1.6; // sat in the ground, a little squat
    p.setXYZ(i, v.x, v.y + 0.12, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// a cone of cloth (a tent), a dome, a ring
export const dome = (r, h = r, seg = 20) => upright(Array.from({ length: 9 }, (_, i) => [r * Math.cos((i / 8) * (PI / 2)), h * Math.sin((i / 8) * (PI / 2))]), seg);
export const ring = (r, tube, seg = 24) => new THREE.TorusGeometry(r, tube, 8, seg).rotateX(PI / 2);
export const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r2, r1, h, seg).translate(0, h / 2, 0); // (standing on y = 0)
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); // (standing on y = 0)
