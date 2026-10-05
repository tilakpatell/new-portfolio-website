// Down on Rick and Morty's planet: Dimension C-137, the Smiths' street.
// The house, the school, Shoney's, the President's limo and the
// Federation's ship are the C-137 page's models (landings.js names them);
// here are the rest: a portal open on the lawn (the show's swirl, as on
// the C-137 page), the street, a hydrant and a mailbox, the trees and
// bushes, and a Plumbus or two lying about.

import * as THREE from 'three';
import { ball, box, cyl, part } from '../../galaxy/surface/kit';
import { rng } from '../../galaxy/surface/noise';
import { SWIRL_GLSL } from '../../rickmorty/swirl';
import { METRE } from '../foot';

const { PI, cos, sin } = Math;

export const PROPS = {
  // a portal standing open on the lawn, 2.6 m tall, turning; it glows
  portal(k) {
    const mat = k.own(
      new THREE.ShaderMaterial({
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { t: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform float t;
          varying vec2 vUv;
          ${SWIRL_GLSL}
          void main() {
            vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, t, 1.0, 5.0);
            if (c.a < 0.004) discard;
            gl_FragColor = vec4(c.rgb * 1.15, c.a);
          }`,
      }),
    );
    const object = new THREE.Group();
    object.name = 'portal';
    const disc = new THREE.Mesh(k.own(new THREE.PlaneGeometry(2.4, 2.9)), mat);
    disc.position.y = 1.5;
    disc.renderOrder = 4;
    object.add(disc);
    const light = new THREE.PointLight('#8dff5a', 0.5, 7, 2);
    light.position.set(0, 1.4, 0.6);
    object.add(light);
    return {
      object,
      solids: [{ box: [0, 0, 1.1, 0.25] }],
      update(t) {
        mat.uniforms.t.value = t;
        light.intensity = (0.42 + 0.08 * sin(t * 3.1)) * METRE * METRE;
      },
    };
  },

  // the street the Smiths live on: tarmac, its yellow line, kerbs and the
  // pavement, a long way each side (into the curve of the ground)
  road(k, { len = 140 } = {}) {
    // (cut into two-metre lengths, so it bends with the ground)
    const strip = (w, h) => new THREE.BoxGeometry(len, h, w, Math.ceil(len / 2), 1, 1).translate(0, h / 2, 0);
    const parts = [
      part(strip(8, 0.04), { at: [0, -0.02, 0], color: '#3a3c40', to: 'stone' }),
      part(strip(2.4, 0.08), { at: [0, -0.02, 5.2], color: '#b9b6ae', to: 'stone' }),
      part(strip(2.4, 0.08), { at: [0, -0.02, -5.2], color: '#b9b6ae', to: 'stone' }),
    ];
    for (let x = -len / 2 + 2; x < len / 2; x += 6) parts.push(part(box(3, 0.045, 0.16), { at: [x, -0.01, 0], color: '#e8c33a', to: 'paint' }));
    return { object: k.bend(k.build(parts, { name: 'road', shadows: false })), solids: [] };
  },

  hydrant(k) {
    const red = '#d8342a';
    const parts = [part(cyl(0.16, 0.14, 0.62, 12), { color: red, to: 'paint' }), ball(0.15, [0, 0.64, 0], 1, { color: red, to: 'paint' }), part(cyl(0.06, 0.06, 0.36, 8), { at: [0, 0.4, 0], rot: [0, 0, PI / 2], color: red, to: 'paint' })];
    return { object: k.build(parts, { name: 'hydrant' }), solids: [{ circle: [0, 0, 0.2] }] };
  },

  mailbox(k) {
    const parts = [part(cyl(0.04, 0.04, 1.05, 8), { color: '#6b5a48', to: 'bark' }), part(box(0.24, 0.24, 0.5), { at: [0, 1.05, 0], color: '#3e6fb4', to: 'paint' }), part(box(0.03, 0.14, 0.04), { at: [0.13, 1.25, -0.15], color: '#d8342a', to: 'paint' })];
    return { object: k.build(parts, { name: 'mailbox' }), solids: [{ circle: [0, 0, 0.15] }] };
  },
};

export const SCATTER = {
  // a street tree, as the show draws them: a straight trunk, a round green crown in lumps
  tree(k, { seed = 4 } = {}) {
    const rand = rng(seed);
    const leaves = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2 + rand();
      leaves.push(ball(1.3 + rand() * 0.5, [cos(a) * 1.1, 4.6 + rand() * 1.2, sin(a) * 1.1], 1, { color: rand() < 0.5 ? '#4f9a3c' : '#5fae44', to: 'leaf' }, 10));
    }
    leaves.push(ball(1.8, [0, 5.6, 0], 1, { color: '#62b246', to: 'leaf' }, 12));
    return {
      parts: [
        { geometry: k.geometry([part(cyl(0.28, 0.2, 4.6, 9), { color: '#6b4a32', to: 'bark' })]), material: k.mats.bark },
        { geometry: k.geometry(leaves), material: k.mats.leaf },
      ],
      radius: 0.4,
    };
  },
  bush(k, { seed = 9 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(ball(0.5 + rand() * 0.3, [(rand() - 0.5) * 1.1, 0.45 + rand() * 0.2, (rand() - 0.5) * 1.1], 1, { color: rand() < 0.5 ? '#3f8a34' : '#4f9a3c', to: 'leaf' }, 9));
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.leaf }], radius: 0.8 };
  },
  // a Plumbus: everyone has one
  plumbus(k) {
    const pink = '#e79ab4';
    const parts = [
      ball(0.16, [0, 0.16, 0], [1, 0.8, 1], { color: pink, to: 'paint' }, 12),
      part(cyl(0.05, 0.07, 0.28, 10), { at: [0, 0.22, 0], color: '#d28aa6', to: 'paint' }),
      ball(0.12, [0, 0.55, 0], [1, 1.3, 1], { color: pink, to: 'paint' }, 12),
      part(cyl(0.02, 0.02, 0.22, 6), { at: [0.1, 0.48, 0], rot: [0, 0, -0.9], color: '#c47a96', to: 'paint' }),
      part(cyl(0.02, 0.02, 0.2, 6), { at: [-0.1, 0.48, 0], rot: [0, 0, 0.9], color: '#c47a96', to: 'paint' }),
      ball(0.05, [0, 0.76, 0], 1, { color: '#f4c2d2', to: 'paint' }, 8),
    ];
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.paint }], radius: null };
  },
};
