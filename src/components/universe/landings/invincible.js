// Down on Invincible's planet: the Graysons' city, after Omni-Man came
// through. The towers round the skyline are painted the way the city's own
// are (lib/three/facade.js: one instanced box each, its walls, windows and
// shopfronts drawn in the shader); here they stand round the crater he left,
// with wrecked cars, broken slabs of road and rubble everywhere.

import * as THREE from 'three';
import { box, cyl, part, rockGeometry } from '../../galaxy/surface/kit';
import { SCATTER as GENERIC } from '../../galaxy/surface/props/generic';
import { rng } from '../../galaxy/surface/noise';
import { KIND, facadeMaterial } from '../../../lib/three/facade';

const { PI, cos, sin } = Math;

export const PROPS = {
  // the skyline: towers in a ring `from`…`to` metres round the landing,
  // each standing up off the curve of the ground where it is (so laid out
  // round the landing spot itself: `around` in landings.js)
  skyline(k, { n = 16, from = 64, to = 100, seed = 11 } = {}) {
    const rand = rng(seed);
    const Rm = k.Rm ?? 640;
    const geo = k.own(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const mat = k.own(facadeMaterial({ uNight: { value: 0 } }, { space: 'local' }));
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const style = new Float32Array(n * 4);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3();
    const solids = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + (rand() - 0.5) * 0.25;
      const d = from + rand() * (to - from);
      const x = sin(a) * d;
      const z = cos(a) * d;
      const w = 14 + rand() * 18;
      const dd = 14 + rand() * 16;
      const h = 30 + rand() ** 1.6 * 150;
      // round the curve: down by how far the ground's fallen away, turned to stand up off it
      const th = d / Rm;
      axis.set(z, 0, -x).normalize();
      q.setFromAxisAngle(axis, th);
      const p = new THREE.Vector3(sin(th) * (x / d) * Rm, (cos(th) - 1) * Rm - 1.5, sin(th) * (z / d) * Rm);
      m.compose(p, q.multiply(new THREE.Quaternion().setFromAxisAngle(up, a)), new THREE.Vector3(w, h, dd));
      mesh.setMatrixAt(i, m);
      style.set([[KIND.glass, KIND.stone, KIND.brick][Math.floor(rand() * 3)], 0.6 + rand() * 0.6, rand() * 100, 0], i * 4);
      solids.push({ circle: [x, z, Math.min(w, dd) * 0.5] });
    }
    geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 4));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    const object = new THREE.Group();
    object.name = 'skyline';
    object.add(mesh);
    return { object, solids };
  },

  // the crater: scorched ground, a rim of broken road thrown up round it
  crater(k, { r = 9, seed = 3 } = {}) {
    const rand = rng(seed);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(12,10,9,1)');
    g.addColorStop(0.55, 'rgba(30,24,20,0.95)');
    g.addColorStop(0.8, 'rgba(40,34,30,0.6)');
    g.addColorStop(1, 'rgba(40,34,30,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    const tex = k.own(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    const scorch = new THREE.Mesh(k.own(new THREE.PlaneGeometry(r * 2.6, r * 2.6).rotateX(-PI / 2)), k.own(new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })));
    scorch.position.y = 0.03;
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2 + rand() * 0.2;
      const d = r * (0.95 + rand() * 0.25);
      parts.push(part(box(2 + rand() * 2.5, 0.3, 1.2 + rand() * 1.5), { at: [cos(a) * d, 0.2 + rand() * 0.6, sin(a) * d], rot: [(rand() - 0.5) * 0.4, -a, 0.5 + rand() * 0.5], color: rand() < 0.5 ? '#5d5e5c' : '#77746e', to: 'stone' }));
      if (i % 3 === 0) parts.push(part(rockGeometry(i + seed), { at: [cos(a) * d * 1.15, 0, sin(a) * d * 1.15], scale: 0.8 + rand() * 1.4, color: '#8a8580', to: 'stone' }));
    }
    const object = k.build(parts, { name: 'crater' });
    object.add(scorch);
    // a glow down in it, still hot
    const ember = new THREE.PointLight('#ff7a3a', 1.6, 14, 2);
    ember.position.y = 0.6;
    object.add(ember);
    return { object, solids: Array.from({ length: 12 }, (_, i) => ({ circle: [cos((i / 12) * PI * 2) * r * 1.05, sin((i / 12) * PI * 2) * r * 1.05, 1.1] })) };
  },

  // a car, thrown: on its roof or its side, its glass gone
  wreck(k, { color = '#7c2a2a', side = false } = {}) {
    const parts = [part(box(1.8, 0.7, 4.4), { at: [0, 0.35, 0], color, to: 'paint' }), part(box(1.6, 0.5, 2.2), { at: [0, 1.0, -0.2], color: '#1d2025', to: 'dark' })];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(part(cyl(0.34, 0.34, 0.24, 14), { at: [sx * 0.95, 0.34, sz * 1.4], rot: [0, 0, PI / 2], color: '#141414', to: 'dark' }));
    const car = k.build(parts, { name: 'car' });
    const object = new THREE.Group();
    object.name = 'wreck';
    car.rotation.z = side ? PI / 2 : PI;
    car.position.y = side ? 0.9 : 1.35;
    object.add(car);
    return { object, solids: [{ box: [0, 0, side ? 0.8 : 0.95, 2.3] }] };
  },
};

export const SCATTER = {
  rock: GENERIC.rock,
  // lumps of concrete and road, and the rebar out of them
  rubble(k, { seed = 7 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 3; i++) parts.push(part(rockGeometry(seed + i, { sharp: 0.6 }), { at: [(rand() - 0.5) * 0.9, 0, (rand() - 0.5) * 0.9], scale: 0.3 + rand() * 0.5, color: rand() < 0.5 ? '#8c8a84' : '#6f6d68', to: 'stone' }));
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.stone }], radius: null };
  },
  // broken glass, catching the light
  glass(k) {
    const g = new THREE.CircleGeometry(0.12, 3).rotateX(-PI / 2).translate(0, 0.01, 0);
    return { parts: [{ geometry: k.geometry([part(g, { color: '#cfe6f2', to: 'glass' })]), material: k.mats.glass }], radius: null };
  },
};
