// The odd ones the set pieces want that neither fleet has.
//
// cloudcar: a Bespin twin-pod cloud car (Cloud City's patrol, Lando's
// Wing Guard): two round cockpit pods side by side, joined across the middle
// by a short wing that carries the engine and its repulsor, each pod's nose a
// glass bubble, painted Bespin orange over grey.
//
// Every model points its nose along +z with +y up (universe/trafficKit.js).

import * as THREE from 'three';
import { ball, flicker, glowMaterial, meshes, panelTexture, part, rod, standard, turned } from '../universe/trafficKit';

const { PI } = Math;

function cloudcar(k) {
  const ORANGE = '#d9783a';
  const GREY = '#8f9399';
  const DARK = '#3a3d42';
  const L = [];
  // a pod: a rounded tube, the glass bubble at its nose, a fin at its tail
  const pod = (x) => {
    L.push(part(turned([[0.0001, -0.5], [0.07, -0.47], [0.1, -0.38], [0.11, -0.1], [0.11, 0.18], [0.1, 0.3], [0.075, 0.36], [0.0001, 0.37]], 18), { at: [x, 0, 0], color: ORANGE }));
    L.push(ball(0.09, [x, 0.012, 0.3], [1, 0.9, 1.15], { to: 'glass' }, 14));
    L.push(part(new THREE.BoxGeometry(0.012, 0.12, 0.16), { at: [x, 0.11, -0.4], rot: [-0.35, 0, 0], color: ORANGE }));
    L.push(part(new THREE.CylinderGeometry(0.115, 0.115, 0.03, 18), { at: [x, 0, -0.12], rot: [PI / 2, 0, 0], color: DARK }));
    // the cannon under its nose
    L.push(rod([x, -0.09, 0.15], [x, -0.09, 0.42], 0.012, 0.009, { to: 'metal', color: DARK }, 6));
  };
  pod(-0.24);
  pod(0.24);
  // the middle: the wing between the pods, the engine housing on it
  L.push(part(new THREE.BoxGeometry(0.4, 0.05, 0.34), { at: [0, 0, -0.1], color: GREY }));
  L.push(part(turned([[0.0001, -0.46], [0.07, -0.44], [0.085, -0.3], [0.08, 0.05], [0.0001, 0.12]], 14), { at: [0, 0.01, 0], color: GREY }));
  L.push(part(new THREE.CircleGeometry(0.06, 14), { at: [0, 0.01, -0.461], rot: [0, PI, 0], to: 'glow', color: [3.4, 1.6, 0.6] }));
  for (const x of [-0.24, 0.24]) L.push(part(new THREE.CircleGeometry(0.05, 12), { at: [x, 0, -0.505], rot: [0, PI, 0], to: 'glow', color: [3, 1.4, 0.5] }));
  // the repulsor glowing underneath
  L.push(part(new THREE.CircleGeometry(0.07, 14), { at: [0, -0.03, -0.1], rot: [PI / 2, 0, 0], to: 'glow', color: [1.2, 1.8, 2.6] }));
  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 214, spread: 14, seam: 0.6, detail: 0.3 })), metalness: 0.3, roughness: 0.45 }),
    metal: standard(k, { metalness: 0.7, roughness: 0.4 }),
    glass: standard(k, { color: '#0d1a20', metalness: 0.9, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
  const M = meshes(k, L, mats);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 2));
    },
  };
}

export const FLEET = { cloudcar };
export const INFO = { cloudcar: { name: 'Cloud car', meters: 7, side: 'neutral' } };
