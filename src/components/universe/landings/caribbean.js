// Down on the Caribbean's planet: a beach, the sea in front of it and the
// Black Pearl at anchor. The Pearl, the chest, the skull rock and the palms
// are the site's models (Dead Man's Tide's, and the galaxy's palm: landings.js
// names them); here are the sea, its waves rolling in to a line of foam, a
// rowboat pulled up on the sand, a campfire, and barrels and crates off the
// ship.

import * as THREE from 'three';
import { box, cyl, part } from '../../galaxy/surface/kit';
import { PROPS as GENERIC } from '../../galaxy/surface/props/generic';
import { rng } from '../../galaxy/surface/noise';
import { METRE } from '../foot';

const { PI, cos, sin } = Math;

export const PROPS = {
  // the sea: from a shoreline `shore` metres ahead out past the horizon,
  // `wide` across, its swell moving and foam where it runs up the sand
  sea(k, { shore = 0, deep = 150, wide = 260 } = {}) {
    const geo = new THREE.PlaneGeometry(wide, deep, Math.ceil(wide / 3), Math.ceil(deep / 3)).rotateX(-PI / 2).translate(0, 0, shore + deep / 2);
    const uniforms = { uTime: { value: 0 }, uShore: { value: shore } };
    const mat = k.own(new THREE.MeshStandardMaterial({ color: '#1f8fa0', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.94 }));
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uShore;\nvarying float vOut;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vOut = position.z - uShore;
          // the swell, a little higher out to sea, and its slope for the light
          float sw = 0.04 + 0.26 * smoothstep(2.0, 30.0, vOut);
          float ph = position.z * 0.35 - uTime * 1.3 + sin(position.x * 0.05) * 1.5;
          transformed.y += sin(ph) * sw + sin(position.x * 0.21 + uTime * 0.7) * 0.06;`,
        )
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n{ float ph = position.z * 0.35 - uTime * 1.3 + sin(position.x * 0.05) * 1.5; objectNormal = normalize(vec3(0.0, 1.0, -cos(ph) * 0.18 * 0.35 * 3.0)); }`);
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vOut;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // turquoise in the shallows, deep blue out past them; foam at the edge, in lines rolling in
          diffuseColor.rgb = mix(vec3(0.16, 0.62, 0.62), vec3(0.03, 0.2, 0.36), smoothstep(4.0, 40.0, vOut));
          float foam = (1.0 - smoothstep(0.0, 3.5, vOut)) * (0.6 + 0.4 * sin(vOut * 2.2 + uTime * 2.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), clamp(foam, 0.0, 1.0));
          diffuseColor.a *= smoothstep(-0.5, 1.5, vOut);`,
        );
    };
    mat.customProgramCacheKey = () => 'landing-sea';
    const mesh = new THREE.Mesh(k.own(geo), mat);
    // (up off the sand by more than its troughs go down, so they never dip under it)
    mesh.position.y = 0.35;
    mesh.receiveShadow = true;
    const object = new THREE.Group();
    object.name = 'sea';
    object.add(mesh);
    k.bend(object);
    return {
      object,
      solids: [],
      update(t) {
        uniforms.uTime.value = t;
      },
    };
  },

  // the Black Pearl (the landing's model, `ship`) at anchor, down to its waterline, rolling a little on the swell
  async pearl(k) {
    const object = new THREE.Group();
    object.name = 'pearl';
    const ship = k.specs?.ship ? await k.models.get(k.specs.ship) : null;
    if (ship) {
      ship.position.y = -2.2;
      object.add(ship);
    }
    return {
      object,
      solids: [],
      update(t) {
        if (!ship) return;
        ship.rotation.z = Math.sin(t * 0.6) * 0.035;
        ship.rotation.x = Math.sin(t * 0.45 + 1) * 0.02;
        ship.position.y = -2.2 + Math.sin(t * 0.7) * 0.25;
      },
    };
  },

  // a rowboat pulled up on the sand, its oars in it
  rowboat(k) {
    const hull = new THREE.SphereGeometry(1, 18, 10, 0, PI * 2, PI / 2, PI / 2).scale(0.75, 0.55, 2.1);
    const parts = [
      part(hull, { at: [0, 0.5, 0], rot: [0, 0, 0], color: '#6a4a30', to: 'bark' }),
      part(box(1.3, 0.06, 0.3), { at: [0, 0.38, 0.4], color: '#8a6a48', to: 'bark' }),
      part(box(1.1, 0.06, 0.3), { at: [0, 0.38, -0.7], color: '#8a6a48', to: 'bark' }),
      part(cyl(0.03, 0.03, 2.6, 6), { at: [0.3, 0.45, -1.2], rot: [PI / 2 - 0.1, 0, 0.1], color: '#a8875e', to: 'bark' }),
    ];
    return { object: k.build(parts, { name: 'rowboat' }), solids: [{ box: [0, 0, 0.8, 2] }] };
  },

  // the galaxy's campfire, its light (set afresh each frame, in its own metres) brought to scale
  fire(k) {
    const made = GENERIC.fire(k);
    const light = made.object.children.find((o) => o.isLight);
    return {
      ...made,
      update(t, dt) {
        made.update(t, dt);
        if (light) light.intensity *= METRE * METRE;
      },
    };
  },

  // barrels and crates off the ship, stacked
  cargo(k, { seed = 1 } = {}) {
    const parts = [];
    const barrel = (x, z, y = 0) => {
      parts.push(part(cyl(0.3, 0.3, 0.9, 14), { at: [x, y, z], color: '#7a5434', to: 'bark' }));
      for (const h of [0.15, 0.75]) parts.push(part(cyl(0.31, 0.31, 0.06, 14), { at: [x, y + h, z], color: '#3a3430', to: 'metal' }));
    };
    barrel(0, 0);
    barrel(0.65, 0.1);
    barrel(0.3, 0.6);
    if (seed % 2) barrel(0.32, 0.25, 0.9);
    parts.push(part(box(0.9, 0.7, 0.9), { at: [-1, 0, 0.2], rot: [0, 0.3, 0], color: '#9a7a52', to: 'bark' }));
    parts.push(part(box(0.7, 0.55, 0.7), { at: [-1, 0.7, 0.2], rot: [0, 0.8, 0], color: '#8a6a44', to: 'bark' }));
    return { object: k.build(parts, { name: 'cargo' }), solids: [{ circle: [0, 0.2, 0.9] }, { circle: [-1, 0.2, 0.6] }] };
  },
};

export const SCATTER = {
  // shells and pebbles on the sand
  shells(k) {
    const g = new THREE.SphereGeometry(0.06, 8, 5, 0, PI * 2, 0, PI / 2).scale(1, 0.5, 1.3);
    return { parts: [{ geometry: k.geometry([part(g, { color: '#f2e6d8', to: 'stone' })]), material: k.mats.stone }], radius: null, tints: ['#f2e6d8', '#e8c8b8', '#d8b890', '#f6f0e8'] };
  },
  // coral heads left out on the reef flat by the tide: brain coral's domes
  // and staghorn's branches
  coral(k, { seed = 4 } = {}) {
    const rand = rng(seed);
    const parts = [part(new THREE.SphereGeometry(0.35, 10, 6, 0, PI * 2, 0, PI / 2), { scale: [1, 0.7, 1], color: '#e8b89a', to: 'stone' })];
    for (let i = 0; i < 5; i++) {
      const a = rand() * PI * 2;
      parts.push(part(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 5).translate(0, 0.25, 0), { at: [cos(a) * 0.3, 0.1, sin(a) * 0.3], rot: [cos(a) * 0.6, 0, sin(a) * 0.6], color: '#d88a7a', to: 'stone' }));
    }
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.stone }], radius: null, tints: ['#e8b89a', '#d8a0b0', '#c8c08a', '#f0d0b8'] };
  },
};
