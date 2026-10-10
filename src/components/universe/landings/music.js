// Down on the music planet: a sandstone courtyard at dusk, the lamps lit.
// The pavilion, the gaddi and the instruments on it (sitar, harmonium,
// tabla, tanpura) and the brass lamps are the music room's own models
// (landings.js names them); here are the rest: the recital laid out on the
// gaddi, a fountain with lotuses, screens of jali with arches through them,
// marigolds, petals and diyas. Its trees are Quaternius's.

import * as THREE from 'three';
import { box, cyl, part } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';
import { METRE } from '../foot';
import { sharpen } from '../../../lib/three/textures';

const { PI, cos, sin } = Math;
const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const SAND = '#d9b48a';
const SAND_DARK = '#b98e62';

// a model of the landing's, by name, if it loads
const model = (k, name) => (k.specs?.[name] ? k.models.get(k.specs[name]) : Promise.resolve(null));
const at = (o, x, y, z, yaw = 0) => {
  if (!o) return null;
  o.position.set(x, y, z);
  o.rotation.y += yaw;
  return o;
};

// a jali: a stone lattice of diamonds, see-through (a canvas, alpha cut)
function jaliTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 128, 128);
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const cx = 16 + i * 32;
      const cy = 16 + j * 32;
      x.beginPath();
      x.moveTo(cx, cy - 12);
      x.lineTo(cx + 12, cy);
      x.lineTo(cx, cy + 12);
      x.lineTo(cx - 12, cy);
      x.closePath();
      x.fill();
    }
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const PROPS = {
  // the recital: the gaddi, the harmonium on it at the left, the tabla at
  // the right, the sitar laid across it and the tanpura stood at the back
  async recital(k) {
    const object = new THREE.Group();
    object.name = 'recital';
    const [gaddi, harmonium, tabla, sitar, tanpura] = await Promise.all(['gaddi', 'harmonium', 'tabla', 'sitar', 'tanpura'].map((n) => model(k, n)));
    for (const o of [at(gaddi, 0, 0, 0), at(harmonium, -0.7, 0.32, 0.1), at(tabla, 0.75, 0.32, 0.15), at(sitar, 0.05, 0.36, -0.05, 0.5), at(tanpura, 0, 0, -0.85)]) if (o) object.add(o);
    return { object, solids: [{ box: [0, 0, 1.3, 0.75] }] };
  },

  // a brass lamp on its stand, its wicks alight
  async lamp(k) {
    const object = new THREE.Group();
    object.name = 'lamp';
    const lamp = await model(k, 'lamp');
    if (lamp) object.add(lamp);
    const top = k.specs?.lamp?.tall ?? 1.25;
    const flames = k.build(
      Array.from({ length: 5 }, (_, i) => part(new THREE.ConeGeometry(0.025, 0.09, 6).translate(0, 0.045, 0), { at: [cos((i / 5) * PI * 2) * 0.09, top, sin((i / 5) * PI * 2) * 0.09], color: hot('#ffb347', 4), to: 'glow' })),
      { name: 'flames' },
    );
    object.add(flames);
    const light = new THREE.PointLight('#ffb36a', 1.4, 9, 2);
    light.position.y = top + 0.15;
    object.add(light);
    return {
      object,
      solids: [{ circle: [0, 0, 0.25] }],
      update(t) {
        const f = 1 + 0.12 * sin(t * 11 + top) + 0.08 * sin(t * 23.7);
        flames.scale.set(1, f, 1);
        light.intensity = 1.25 * f * METRE * METRE;
      },
    };
  },

  // a fountain: an eight-sided basin of sandstone, water in it, lotuses on it
  fountain(k, { r = 3.4 } = {}) {
    const parts = [part(cyl(r, r, 0.55, 8), { color: SAND, to: 'stone' }), part(cyl(r + 0.25, r + 0.25, 0.12, 8), { at: [0, 0.55, 0], color: SAND_DARK, to: 'stone' }), part(cyl(0.35, 0.45, 1.6, 8), { color: SAND_DARK, to: 'stone' }), part(cyl(0.9, 0.5, 0.25, 12), { at: [0, 1.5, 0], color: SAND, to: 'stone' })];
    const rand = rng(4);
    for (let i = 0; i < 7; i++) {
      const a = rand() * PI * 2;
      const d = 1.2 + rand() * (r - 1.6);
      parts.push(part(new THREE.CircleGeometry(0.28, 10).rotateX(-PI / 2), { at: [cos(a) * d, 0.5, sin(a) * d], color: '#3f7a3a', to: 'leaf' }));
      if (i % 2) parts.push(part(new THREE.ConeGeometry(0.12, 0.16, 6), { at: [cos(a) * d, 0.58, sin(a) * d], color: '#f2a6c2', to: 'leaf' }));
    }
    const object = k.build(parts, { name: 'fountain' });
    const water = new THREE.Mesh(k.own(new THREE.CircleGeometry(r - 0.15, 8).rotateX(-PI / 2)), k.own(new THREE.MeshStandardMaterial({ color: '#2f6f7a', roughness: 0.08, metalness: 0.2 })));
    water.position.y = 0.47;
    water.rotation.y = PI / 8;
    object.add(water);
    return { object, solids: [{ circle: [0, 0, r + 0.2] }] };
  },

  // a screen of jali on a plinth, `len` long, arches through it every few metres
  screen(k, { len = 20, h = 4.2, bays = 4 } = {}) {
    const parts = [part(box(len + 1, 0.5, 1), { color: SAND_DARK, to: 'stone' }), part(box(len + 1, 0.5, 1), { at: [0, h, 0], color: SAND_DARK, to: 'stone' })];
    const bay = len / bays;
    for (let i = 0; i <= bays; i++) {
      const x = -len / 2 + i * bay;
      parts.push(part(box(0.8, h, 0.8), { at: [x, 0, 0], color: SAND, to: 'stone' }));
      parts.push(part(new THREE.SphereGeometry(0.42, 10, 6, 0, PI * 2, 0, PI / 2), { at: [x, h + 0.5, 0], color: SAND, to: 'stone' }));
    }
    const object = k.build(parts, { name: 'screen' });
    const tex = k.own(jaliTexture());
    tex.repeat.set(bay / 1.2, (h - 0.5) / 1.2);
    const mat = k.own(new THREE.MeshStandardMaterial({ color: SAND, alphaMap: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
    const arch = new THREE.Shape();
    arch.moveTo(-bay / 2 + 0.4, 0.5);
    arch.lineTo(bay / 2 - 0.4, 0.5);
    arch.lineTo(bay / 2 - 0.4, h);
    arch.lineTo(-bay / 2 + 0.4, h);
    arch.closePath();
    const hole = new THREE.Path();
    const w = (bay - 0.8) * 0.34;
    hole.moveTo(-w, 0.5);
    hole.lineTo(w, 0.5);
    hole.lineTo(w, h * 0.6);
    hole.quadraticCurveTo(w, h * 0.82, 0, h * 0.88);
    hole.quadraticCurveTo(-w, h * 0.82, -w, h * 0.6);
    hole.closePath();
    arch.holes.push(hole);
    const panel = k.own(new THREE.ShapeGeometry(arch, 8));
    const uv = panel.attributes.uv;
    const pos = panel.attributes.position;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, (pos.getX(j) + bay / 2) / bay, pos.getY(j) / h);
    for (let i = 0; i < bays; i++) {
      const m = new THREE.Mesh(panel, mat);
      m.position.x = -len / 2 + (i + 0.5) * bay;
      object.add(m);
    }
    // (the piers and the panels between the arches: solid; the arches open)
    const solids = [];
    for (let i = 0; i <= bays; i++) solids.push({ circle: [-len / 2 + i * bay, 0, 0.6] });
    for (let i = 0; i < bays; i++)
      for (const s of [-1, 1]) solids.push({ circle: [-len / 2 + (i + 0.5) * bay + s * (bay / 2 - 0.4 - (bay / 2 - 0.4 - w) / 2), 0, (bay / 2 - 0.4 - w) / 2] });
    return { object, solids };
  },
};

export const SCATTER = {
  // marigolds: a puff of petals on a stem
  marigolds(k) {
    const head = new THREE.IcosahedronGeometry(0.07, 1).scale(1, 0.7, 1).translate(0, 0.32, 0);
    return { parts: [{ geometry: k.geometry([part(head, { color: '#ffffff', to: 'leaf' })]), material: k.mats.leaf }], radius: null, tints: ['#ff9933', '#ffb52e', '#f26a1f', '#ffd23a'] };
  },
  // petals strewn on the stone
  petals(k) {
    const g = new THREE.CircleGeometry(0.035, 6).rotateX(-PI / 2).translate(0, 0.01, 0);
    return { parts: [{ geometry: k.geometry([part(g, { color: '#ffffff', to: 'leaf' })]), material: k.mats.leaf }], radius: null, tints: ['#ff9933', '#e84a6f', '#ffd23a', '#f26a1f'] };
  },
  // diyas: little clay lamps along the way, each with its flame
  diyas(k) {
    const cup = new THREE.SphereGeometry(0.06, 10, 5, 0, PI * 2, PI / 2, PI / 2).scale(1, 0.6, 1.3).translate(0, 0.04, 0);
    const flame = new THREE.ConeGeometry(0.014, 0.05, 5).translate(0, 0.07, 0.03);
    return {
      parts: [
        { geometry: k.geometry([part(cup, { color: '#a5552e', to: 'stone' })]), material: k.mats.stone },
        { geometry: k.geometry([part(flame, { color: hot('#ffb347', 5), to: 'glow' })]), material: k.mats.glow },
      ],
      radius: null,
    };
  },
};
