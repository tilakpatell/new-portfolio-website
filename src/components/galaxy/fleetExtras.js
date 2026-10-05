// The odd ones the set pieces want that neither fleet has: Bespin's cloud
// cars, and the New Republic era's Mandalorians.
//
// cloudcar: a Bespin twin-pod cloud car (Cloud City's patrol, Lando's
// Wing Guard): two round cockpit pods side by side, joined across the middle
// by a short wing that carries the engine and its repulsor, each pod's nose a
// glass bubble, painted Bespin orange over grey.
// razorcrest: the Razor Crest, Din Djarin's ST-70 assault ship (an old
// pre-Empire gunship): a long boxy fuselage of bare, battered silver plating
// with a few darker patches, the raised cockpit up front with its band of
// small windows, a blunt nose with a cannon either side, and the two great
// engines close against its flanks, big dark intakes in front and their
// exhausts glowing blue-white astern.
// gauntlet: a Kom'rk-class fighter (Bo-Katan's Gauntlet), flying the way it
// does with its wings swung down: a long narrow fuselage with a pointed nose
// and the canopy forward, the two long blade-like wings hanging from a
// hinge on its back in an upside-down V seen from the front, a blue stripe
// down each and a cannon at each tip, three engines astern; gunmetal grey.
//
// Every model points its nose along +z with +y up (universe/trafficKit.js).

import * as THREE from 'three';
import { ball, blinker, box8, flicker, glowMaterial, loft, meshes, mirror, panelTexture, part, place, plateXZ, pulse, rod, standard, trap8, turned } from '../universe/trafficKit';

const { PI, sin } = Math;

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

// An engine's mouth facing astern at z: a short housing with a lip, and the
// glow just inside it.
function exhaust(L, [x, y], z, r, glow, color = '#33373d') {
  L.push(part(turned([[r * 0.82, z + r * 0.9], [r * 0.82, z + r * 0.12], [r, z], [r * 1.14, z + r * 0.2], [r * 1.14, z + r * 0.9]], 16), { at: [x, y, 0], to: 'metal', color }));
  L.push(part(new THREE.CircleGeometry(r * 0.82, 16), { at: [x, y, z + r * 0.1], rot: [0, PI, 0], to: 'glow', color: glow }));
}

function razorcrest(k) {
  const SILVER = '#b9bec4';
  const PATCH = '#8d939a';
  const DARK = '#32363c';
  const L = [];
  // the fuselage: boxy, its top corners rounded off, a blunt nose
  L.push(
    part(
      loft([
        { z: -0.5, pts: box8(0.16, 0.15, 0.04) },
        { z: -0.47, pts: box8(0.2, 0.18, 0.05) },
        { z: 0.06, pts: box8(0.21, 0.19, 0.05) },
        { z: 0.3, pts: box8(0.19, 0.16, 0.045, -0.01) },
        { z: 0.44, pts: box8(0.15, 0.1, 0.03, -0.03) },
        { z: 0.5, pts: box8(0.09, 0.05, 0.015, -0.04) },
      ]),
      { color: SILVER },
    ),
  );
  // the cockpit, raised over the nose, and its windows: a band of small
  // panes down each side and the sloping front
  L.push(
    part(
      loft([
        { z: 0.1, pts: box8(0.15, 0.02, 0.008, 0.095) },
        { z: 0.15, pts: box8(0.16, 0.07, 0.025, 0.11) },
        { z: 0.32, pts: box8(0.14, 0.06, 0.02, 0.105) },
        { z: 0.4, pts: box8(0.1, 0.02, 0.008, 0.083) },
      ]),
      { color: SILVER },
    ),
  );
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) L.push(part(new THREE.BoxGeometry(0.004, 0.02, 0.026), { at: [sx * 0.07, 0.114, 0.19 + i * 0.034], to: 'glass' }));
  L.push(part(new THREE.BoxGeometry(0.1, 0.004, 0.07), { at: [0, 0.117, 0.362], rot: [0.5, 0, 0], to: 'glass' }));
  for (const x of [-0.034, 0, 0.034]) L.push(part(new THREE.BoxGeometry(0.006, 0.007, 0.072), { at: [x, 0.119, 0.362], rot: [0.5, 0, 0], to: 'metal', color: DARK }));
  // the spine astern, the ramp's seam under the tail, a few patched panels
  L.push(part(new THREE.BoxGeometry(0.07, 0.03, 0.42), { at: [0, 0.1, -0.22], color: PATCH }));
  L.push(part(new THREE.BoxGeometry(0.15, 0.004, 0.2), { at: [0, -0.096, -0.37], to: 'metal', color: DARK }));
  for (let i = 0; i < 7; i++) {
    const sx = k.rand() < 0.5 ? -1 : 1;
    const z = -0.42 + k.rand() * 0.7;
    const y = (k.rand() - 0.5) * 0.1;
    L.push(part(new THREE.BoxGeometry(0.004, 0.03 + k.rand() * 0.04, 0.05 + k.rand() * 0.08), { at: [sx * 0.106, y, z], color: k.rand() < 0.5 ? PATCH : '#a2a7ad' }));
  }
  // an engine: a great cylinder close against the flank, its dark intake in
  // front with the fan's hub, its exhaust glowing astern; and the pylon
  const engine = [
    part(turned([[0.06, -0.5], [0.074, -0.47], [0.084, -0.42], [0.086, -0.3], [0.086, 0], [0.09, 0.03], [0.09, 0.06], [0.082, 0.066]], 22), { color: SILVER }),
    part(new THREE.CircleGeometry(0.076, 22), { at: [0, 0, 0.056], to: 'metal', color: DARK }),
    part(turned([[0.09, 0.03], [0.094, 0.044], [0.094, 0.064]], 22), { to: 'metal', color: '#9ba1a7' }),
    part(turned([[0.026, 0.02], [0.02, 0.05], [0.0001, 0.058]], 12), { to: 'metal', color: '#5d6269' }),
    part(turned([[0.087, -0.2], [0.087, -0.18]], 22), { to: 'metal', color: PATCH }),
  ];
  const right = [...place(engine, [-0.205, -0.012, 0]), part(new THREE.BoxGeometry(0.1, 0.04, 0.24), { at: [-0.14, -0.012, -0.2], color: PATCH })];
  L.push(...right, ...mirror(right));
  for (const sx of [-1, 1]) {
    exhaust(L, [sx * 0.205, -0.012], -0.5, 0.058, [2.2, 2.8, 4.4]);
    // the cannons either side of the nose
    L.push(rod([sx * 0.082, -0.045, 0.3], [sx * 0.082, -0.045, 0.45], 0.008, 0.006, { to: 'metal', color: DARK }, 8));
  }
  // a red light on its back
  L.push(part(new THREE.BoxGeometry(0.01, 0.006, 0.01), { at: [0, 0.118, -0.1], to: 'glow', color: [3.2, 0.5, 0.3], mark: 'beacon' }));
  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 206, spread: 22, seam: 0.5, detail: 0.45, min: 10 })), metalness: 0.55, roughness: 0.42 }),
    metal: standard(k, { metalness: 0.7, roughness: 0.4 }),
    glass: standard(k, { color: '#0c1418', metalness: 0.9, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  let blink;
  return {
    root: Object.values(M),
    update(t) {
      blink ??= blinker(M.glow.geometry);
      blink('beacon', pulse(t, 1.6, 0, 0.1) ? 1.3 : 0.15);
      mats.glow.color.setScalar(flicker(t, 4));
    },
  };
}

function gauntlet(k) {
  const GREY = '#7b838c';
  const DARK = '#353a41';
  const BLUE = '#3f6ea8';
  const L = [];
  // the fuselage: long and narrow, deepest astern, tapering to a point
  L.push(
    part(
      loft([
        { z: -0.5, pts: box8(0.07, 0.1, 0.02) },
        { z: -0.36, pts: box8(0.1, 0.13, 0.03) },
        { z: 0.05, pts: box8(0.1, 0.12, 0.03) },
        { z: 0.3, pts: trap8(0.08, 0.06, 0.1, 0.02, -0.005) },
        { z: 0.46, pts: trap8(0.04, 0.03, 0.05, 0.01, -0.015) },
        { z: 0.5, pts: box8(0.012, 0.012, 0.004, -0.02) },
      ]),
      { color: GREY },
    ),
  );
  // the canopy, and the hinge housing the wings hang from
  L.push(part(loft([{ z: 0.14, pts: trap8(0.07, 0.04, 0.03, 0.006, 0.066) }, { z: 0.36, pts: trap8(0.05, 0.02, 0.02, 0.004, 0.046) }]), { to: 'glass' }));
  L.push(part(loft([{ z: -0.48, pts: box8(0.1, 0.03, 0.01, 0.07) }, { z: -0.02, pts: box8(0.1, 0.03, 0.01, 0.07) }, { z: 0.06, pts: box8(0.05, 0.01, 0.004, 0.063) }]), { to: 'metal', color: DARK }));
  // a wing, out along x in its own plane: a long blade swept back, the
  // stripe down it, the cannon at its tip; swung down from the hinge
  const outline = [[0, -0.46], [0, 0.1], [0.07, 0.08], [0.36, -0.12], [0.42, -0.22], [0.42, -0.42], [0.32, -0.5]];
  const wing = [
    part(plateXZ(outline, 0.02, 0.004), { color: GREY }),
    part(plateXZ([[0.11, -0.4], [0.11, 0.0], [0.17, -0.04], [0.17, -0.42]], 0.024), { color: BLUE }),
    part(plateXZ([[0.36, -0.44], [0.36, -0.2], [0.41, -0.24], [0.41, -0.43]], 0.024), { color: DARK }),
    rod([0.42, 0, -0.36], [0.42, 0, 0.02], 0.009, 0.006, { to: 'metal', color: DARK }, 8),
  ];
  const right = place(wing, [-0.045, 0.06, 0], [0, 0, PI + 0.95]);
  L.push(...right, ...mirror(right));
  // engines astern, and the lights along its back
  for (const [x, y, r] of [[0, 0.015, 0.034], [0.034, -0.035, 0.022], [-0.034, -0.035, 0.022]]) exhaust(L, [x, y], -0.5, r, [1.8, 2.6, 4.6], DARK);
  L.push(part(new THREE.BoxGeometry(0.008, 0.005, 0.008), { at: [0, 0.088, -0.3], to: 'glow', color: [3.2, 0.5, 0.3], mark: 'beacon' }));
  const mats = {
    paint: standard(k, { map: k.own(panelTexture(k.rand, { base: 210, spread: 16, seam: 0.55, detail: 0.35, min: 10 })), metalness: 0.45, roughness: 0.45 }),
    metal: standard(k, { metalness: 0.7, roughness: 0.4 }),
    glass: standard(k, { color: '#0b1520', metalness: 0.9, roughness: 0.08 }),
    glow: glowMaterial(k),
  };
  mats.paint.userData.density = 6;
  const M = meshes(k, L, mats);
  let blink;
  return {
    root: Object.values(M),
    update(t) {
      blink ??= blinker(M.glow.geometry);
      blink('beacon', pulse(t, 2.2, 0.3, 0.1) ? 1.3 : 0.15);
      mats.glow.color.setScalar(flicker(t, 9) + 0.02 * sin(t * 1.3));
    },
  };
}

export const FLEET = { cloudcar, razorcrest, gauntlet };
export const INFO = {
  cloudcar: { name: 'Cloud car', meters: 7, side: 'neutral' },
  razorcrest: { name: 'Razor Crest', meters: 22, side: 'mandalorian' },
  gauntlet: { name: 'Gauntlet starfighter', meters: 52, side: 'mandalorian' },
};
