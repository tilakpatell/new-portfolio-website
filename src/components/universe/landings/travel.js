// Down on Earth's planet: an airfield somewhere I've been. The 737 from the
// Earth page (sketchfab/earth-plane.glb, CC BY: landings.js names it) waits
// on the runway; by the grass a signpost points to every place on my travel
// map (data/places.js), each arm turned the way that place really lies from
// home and marked with how far it is; and a windsock. The trees and the
// wildflowers round the field are Quaternius's (landings.js names them).

import * as THREE from 'three';
import { box, cyl, part } from '../../galaxy/surface/kit';
import { HOME, PLACES, distanceKm } from '../../../data/places';
import { sharpen } from '../../../lib/three/textures';

const { PI, sin, cos, atan2 } = Math;
const rad = (d) => (d * PI) / 180;

// the way from home to `at` ([lon, lat]), as a compass bearing in radians (0: north, clockwise)
export function bearing([lon1, lat1], [lon2, lat2]) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dl = rad(lon2 - lon1);
  return atan2(sin(dl) * cos(p2), cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl));
}

// the places the signpost points to: everywhere but home, furthest at the top
export const SIGNS = PLACES.filter((p) => !p.home)
  .map((p) => ({ name: p.name, km: Math.round(distanceKm(HOME.at, p.at)), way: bearing(HOME.at, p.at) }))
  .sort((a, b) => a.km - b.km);

function atlas(signs) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 48 * signs.length;
  const x = c.getContext('2d');
  signs.forEach((s, i) => {
    const y = i * 48;
    x.fillStyle = i % 2 ? '#f2efe4' : '#fbf8ee';
    x.fillRect(0, y, 512, 48);
    x.fillStyle = '#1f2a36';
    x.font = 'bold 26px "Archivo Variable", Arial, sans-serif';
    x.textBaseline = 'middle';
    x.fillText(s.name, 14, y + 25, 330);
    x.font = '22px "JetBrains Mono", monospace';
    x.textAlign = 'right';
    x.fillText(`${s.km.toLocaleString('en-US')} km`, 496, y + 25);
    x.textAlign = 'left';
  });
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const PROPS = {
  // the airfield: a runway along x, its markings, the plane on it and a windsock
  async airfield(k, { len = 220, wide = 30 } = {}) {
    const strip = (w, h, z = 0) => new THREE.BoxGeometry(len, h, w, Math.ceil(len / 3), 1, 1).translate(0, h / 2, z);
    const parts = [part(strip(wide, 0.05), { at: [0, 0.01, 0], color: '#3c3e42', to: 'stone' })];
    for (const z of [-wide / 2 + 1, wide / 2 - 1]) parts.push(part(strip(0.5, 0.06, z), { at: [0, 0.01, 0], color: '#e8e6dc', to: 'paint' }));
    for (let x = -len / 2 + 14; x < len / 2 - 14; x += 18) parts.push(part(box(9, 0.07, 0.6), { at: [x, 0.01, 0], color: '#e8e6dc', to: 'paint' }));
    // threshold bars at each end
    for (const end of [-1, 1]) for (let i = -5; i <= 5; i++) if (i) parts.push(part(box(10, 0.07, 1), { at: [end * (len / 2 - 8), 0.01, i * 2.3], color: '#e8e6dc', to: 'paint' }));
    const object = k.bend(k.build(parts, { name: 'runway', shadows: false }));
    const plane = k.specs?.plane ? await k.models.get(k.specs.plane) : null;
    if (plane) {
      plane.rotation.y = PI / 2;
      plane.position.set(-24, 0.05, 0);
      object.add(plane);
    }
    // the windsock by the runway's edge, its sock out on the wind
    const sock = k.build([part(cyl(0.06, 0.06, 6, 8), { color: '#d8d8d8', to: 'metal' }), part(new THREE.CylinderGeometry(0.45, 0.2, 2.2, 12, 1, true).rotateZ(PI / 2).translate(1.2, 0, 0), { at: [0, 5.8, 0], color: '#f26a1f', to: 'cloth' })], { name: 'windsock' });
    sock.position.set(40, 0, -wide / 2 - 6);
    object.add(sock);
    return {
      object,
      solids: plane ? [{ box: [-24, 0, 17, 2.5] }, { box: [-24, 0, 2.5, 16] }, { circle: [40, -wide / 2 - 6, 0.2] }] : [],
      update(t) {
        sock.rotation.y = sin(t * 0.7) * 0.25;
      },
    };
  },

  // the signpost: an arm for each place I've been, turned the way it lies from home, with how far
  signpost(k, { signs = SIGNS } = {}) {
    const H = 2.4 + signs.length * 0.32;
    const object = k.build([part(cyl(0.12, 0.1, H, 10), { color: '#e8e4d8', to: 'paint' }), part(new THREE.ConeGeometry(0.16, 0.3, 10), { at: [0, H + 0.15, 0], color: '#c8b46a', to: 'metal' })], { name: 'signpost' });
    const tex = k.own(atlas(signs));
    const mat = k.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    const L = 1.9;
    signs.forEach((s, i) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.13);
      shape.lineTo(L - 0.16, -0.13);
      shape.lineTo(L, 0);
      shape.lineTo(L - 0.16, 0.13);
      shape.lineTo(0, 0.13);
      const geo = k.own(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }));
      // its faces show this place's row of the atlas
      const uv = geo.attributes.uv;
      const pos = geo.attributes.position;
      const v0 = 1 - (i + 1) / signs.length;
      const v1 = 1 - i / signs.length;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, pos.getX(j) / L, v0 + ((pos.getY(j) + 0.13) / 0.26) * (v1 - v0));
      const arm = new THREE.Mesh(geo, mat);
      // north is the post's +z, east to its right (−x): the arm points along +x before it's turned
      arm.rotation.y = -PI / 2 - s.way;
      arm.position.y = 2 + i * 0.32;
      arm.castShadow = true;
      object.add(arm);
    });
    // (its arms, one mesh each, as one)
    return { object: k.merge(object), solids: [{ circle: [0, 0, 0.2] }] };
  },
};
