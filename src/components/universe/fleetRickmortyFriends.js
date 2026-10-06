// The Rick and Morty universe's friends on your wing, built (see
// trafficModels.js; fleetRickmortyKit.js for what's shared): Squanchy's and Mr.
// Poopybutthole's ships.
//
// squanchship: Squanchy's ship: a round little orange cat of a craft, cream
// at its muzzle and belly, glowing slit-pupilled eyes that blink now and
// then, whiskers, cat-ear fins, little cream paws, a stubby curled tail,
// and Squanchy under the canopy.
// poopyship: Mr. Poopybutthole's little ship: a round ball, yellow over
// pink, his big eyes and open grin on the front and a top hat for a dome,
// lights chasing round its middle and its engine popping quick and bright.

import * as THREE from 'three';
import { part, place, mirror, rod, ball, meshes, blinker, plate, plateXZ, turned, upright, panelTexture, standard, glowMaterial, flicker, pulse } from './trafficKit';
import { bubble, bead, smoothLoft, oval, roundOf, onHull, painted } from './fleetRickmortyKit';

const { PI, sin, cos, max } = Math;

// ── Squanchy's ship ──

// Squanchy's ship: a round little orange cat of a craft, lofted smooth,
// cream on its belly and up over its muzzle; headlamp eyes glowing
// green-gold with slit pupils, a pink nose, whiskers; cat-ear fins on top,
// pink inside; little cream paws for wings, a stubby tail curling up
// behind with the engine under it; and Squanchy himself under the canopy.
function squanchship(k) {
  const ORANGE = '#ec8a2e';
  const CREAM = '#f4e4c4';
  const PINK = '#ee9a9c';
  const DARK = '#3b2a20';
  const L = [];
  const RINGS = [
    [-0.37, 0.029],
    [-0.345, 0.08],
    [-0.27, 0.136],
    [-0.14, 0.17],
    [0, 0.178],
    [0.13, 0.164],
    [0.23, 0.136],
    [0.3, 0.098],
    [0.345, 0.054],
    [0.365, 0.014],
    [0.368, 0.0005],
  ];
  const SHAPE = [1.04, 0.9, 0.78];
  const body = smoothLoft(RINGS.map(([z, r]) => ({ z, pts: oval(r * 2 * SHAPE[0], r * SHAPE[1], r * SHAPE[2], 0, 24) })));
  L.push(...painted(body, [[(x, y, z) => roundOf(SHAPE, x, y) < -0.5 || (z > 0.23 && roundOf(SHAPE, x, y) < 0.3), CREAM]], ORANGE));
  // the face: the eyes, each a lamp with a slit for its pupil, the nose,
  // whiskers
  for (const sx of [-1, 1]) {
    const a = sx > 0 ? 0.62 : PI - 0.62;
    L.push(onHull(new THREE.SphereGeometry(0.026, 12, 8), RINGS, SHAPE, 0.305, a, { lift: -0.004, scale: [1, 1.15, 0.5], to: 'glow', color: [2.2, 3.0, 0.5], mark: 'eyes' }));
    L.push(onHull(new THREE.BoxGeometry(0.0055, 0.034, 0.008), RINGS, SHAPE, 0.305, a, { lift: 0.008, color: '#141210' }));
    for (const dy of [-0.012, 0.0, 0.012]) L.push(rod([sx * 0.035, -0.012 + dy * 0.5, 0.345], [sx * 0.17, -0.012 + dy * 2, 0.36], 0.0022, 0.0012, { color: '#fbf6ea' }, 4));
  }
  L.push(bead(0.014, [0, 0.004, 0.364], [1.3, 0.9, 0.8], { color: PINK }, 8, 5));
  // the cat-ear fins, pink inside
  const ear = [];
  ear.push(part(plate([[-0.055, 0], [0.052, 0], [0.012, 0.105], [0, 0.115], [-0.016, 0.104]], 0.024, 0.007), { color: ORANGE }));
  ear.push(part(plate([[-0.032, 0.012], [0.03, 0.012], [0.006, 0.08], [-0.008, 0.08]], 0.006), { at: [0, 0, 0.012], color: PINK }));
  const ears = place(ear, [0.08, 0.125, -0.06], [-0.2, 0, -0.32]);
  L.push(...ears, ...mirror(ears));
  // the paws, little cream wings
  const paw = part(plateXZ([[0, -0.08], [0.05, -0.085], [0.085, -0.06], [0.095, -0.015], [0.075, 0.025], [0, 0.03]], 0.026, 0.009), { at: [0.15, -0.055, -0.05], rot: [0, 0, -0.25], color: CREAM });
  L.push(paw, ...mirror([paw]));
  // the tail, curling up behind, cream at its tip
  const tail = [
    [0, 0.03, -0.31],
    [0, 0.07, -0.37],
    [0, 0.12, -0.4],
    [0, 0.165, -0.395],
  ];
  for (let i = 0; i < tail.length - 1; i++) L.push(rod(tail[i], tail[i + 1], 0.024 - i * 0.003, 0.021 - i * 0.003, { color: ORANGE }, 10));
  for (let i = 1; i < tail.length - 1; i++) L.push(ball(0.021 - (i - 1) * 0.003, tail[i], 1, { color: ORANGE }, 10));
  L.push(ball(0.02, tail.at(-1), [1, 1.25, 1], { color: CREAM }, 10));
  // the engine under the tail
  L.push(part(turned([[0.026, -0.39], [0.034, -0.395], [0.04, -0.38], [0.04, -0.33], [0.03, -0.3]], 14), { at: [0, -0.03, 0], color: DARK }));
  L.push(part(new THREE.CircleGeometry(0.028, 14), { at: [0, -0.03, -0.388], rot: [0, PI, 0], to: 'glow', color: [3.4, 1.7, 0.45] }));
  L.push(part(new THREE.ConeGeometry(0.024, 0.045, 12, 1, true), { at: [0, -0.03, -0.413], rot: [-PI / 2, 0, 0], to: 'glow', color: [3.0, 1.3, 0.3], mark: 'jet' }));
  // the canopy, and Squanchy under it: his round head, ears, eyes, muzzle
  L.push(part(new THREE.SphereGeometry(0.068, 22, 10, 0, PI * 2, 0, PI * 0.62), { at: [0, 0.145, 0.1], to: 'glass' }));
  const hd = [0, 0.172, 0.1];
  L.push(bead(0.032, hd, [1.1, 0.95, 1], { color: ORANGE }, 12, 9));
  L.push(bead(0.016, [0, hd[1] - 0.012, hd[2] + 0.026], [1.3, 0.8, 0.8], { color: CREAM }, 8, 5));
  for (const sx of [-1, 1]) {
    L.push(part(new THREE.ConeGeometry(0.012, 0.03, 5), { at: [sx * 0.022, hd[1] + 0.034, hd[2] - 0.004], rot: [0, 0, -sx * 0.35], color: ORANGE }));
    L.push(bead(0.009, [sx * 0.013, hd[1] + 0.008, hd[2] + 0.027], [1, 1.2, 0.6], { color: '#ffffff' }, 6, 4));
    L.push(bead(0.004, [sx * 0.013, hd[1] + 0.008, hd[2] + 0.032], 1, { color: '#111111' }, 4, 3));
  }

  const paint = standard(k, { map: k.own(panelTexture(k.rand, { base: 244, spread: 4, seam: 0.9, detail: 0, min: 30 })), metalness: 0.1, roughness: 0.45 });
  paint.userData.density = 4;
  const mats = { paint, glass: bubble(k, '#ffe9cf', 0.22), glow: glowMaterial(k) };
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      mats.glow.color.setScalar(flicker(t, 37));
      // a slow blink now and then, as a cat does
      blink('eyes', pulse(t, 4.1, 0.5, 0.035) ? 0.1 : 1);
      blink('jet', Math.round(flicker(t * 1.5, 11) * 10) / 10);
    },
  };
}

// ── Mr. Poopybutthole's ship ──

// Mr. Poopybutthole's little ship: a round ball turned upright, yellow over
// pink, his face on the front of it (the big round eyes, the open grin);
// a top hat for a dome, its crown dark glass, a pink band round it; stubby
// arms out at the sides, little feet underneath, lights round its middle,
// and behind, a little engine popping quick and bright. Ooh-wee!
function poopyship(k) {
  const YELLOW = '#f5cf55';
  const PINK = '#f29db3';
  const BLACK = '#1e1c22';
  const L = [];
  const R = 0.3;
  const HT = 0.235;
  const shell = (a0, a1, n) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [max(R * cos(a), 0.0001), HT * sin(a)];
    });
  L.push(part(upright(shell(-PI / 2, -0.3, 6), 24), { color: PINK }));
  L.push(part(upright(shell(-0.3, PI / 2, 10), 24), { color: YELLOW }));
  // a thing set into the ball's skin, elevation el up and az round from
  // straight ahead, facing out
  const onBall = (g, el, az, { lift = 0, scale = 1, ...o } = {}) => {
    const p = new THREE.Vector3(R * cos(el) * sin(az), HT * sin(el), R * cos(el) * cos(az));
    const n = new THREE.Vector3(p.x / (R * R), p.y / (HT * HT), p.z / (R * R)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    return part(g, { m: new THREE.Matrix4().compose(p.addScaledVector(n, lift), q, new THREE.Vector3(...s)), ...o });
  };
  // his face: big round eyes, small pupils, the open grin
  for (const sx of [-1, 1]) {
    L.push(onBall(new THREE.SphereGeometry(0.062, 14, 8), 0.22, sx * 0.3, { lift: -0.012, scale: [1, 1.12, 0.42], color: '#fbfbf6' }));
    L.push(onBall(new THREE.SphereGeometry(0.02, 8, 5), 0.21, sx * 0.29, { lift: 0.01, scale: [1, 1.1, 0.4], color: '#121214' }));
  }
  L.push(onBall(new THREE.SphereGeometry(0.075, 14, 5, 0, PI * 2, PI / 2, PI / 2), -0.1, 0, { lift: -0.006, scale: [1, 0.62, 0.36], color: '#4a1426' }));
  L.push(onBall(new THREE.SphereGeometry(0.03, 8, 5), -0.2, 0, { lift: -0.006, scale: [1.2, 0.6, 0.4], color: '#e86a86' }));
  // the top hat: brim, crown of dark glass, the pink band, the top
  L.push(part(upright([[0.11, 0.19], [0.178, 0.19], [0.188, 0.198], [0.182, 0.207], [0.11, 0.211]], 24), { color: BLACK }));
  L.push(part(new THREE.CylinderGeometry(0.106, 0.1, 0.16, 20, 1, true), { at: [0, 0.29, 0], to: 'glass' }));
  L.push(part(upright([[0.1, 0.212], [0.107, 0.215], [0.108, 0.245], [0.1015, 0.248]], 20), { color: PINK }));
  L.push(part(upright([[0.105, 0.368], [0.112, 0.372], [0.11, 0.381], [0.0001, 0.382]], 20), { color: BLACK }));
  // stubby arms, and little feet
  for (const sx of [-1, 1]) {
    L.push(rod([sx * 0.27, 0.0, -0.02], [sx * 0.35, 0.05, -0.03], 0.026, 0.021, { color: YELLOW }, 8));
    L.push(ball(0.028, [sx * 0.355, 0.055, -0.03], 1, { color: YELLOW }, 8));
    L.push(ball(0.04, [sx * 0.1, -0.225, 0.03], [1, 0.5, 1.4], { color: PINK }, 8));
  }
  // the lights round its middle, chasing
  const N = 10;
  for (let i = 0; i < N; i++) {
    const az = PI * 0.35 + (i / (N - 1)) * PI * 1.3;
    L.push(onBall(new THREE.SphereGeometry(0.012, 6, 4), -0.3, az, { lift: -0.004, scale: [1, 1, 0.5], to: 'glow', color: i % 2 ? [3.4, 1.3, 2.2] : [3.2, 2.6, 0.6], mark: `rim${i}` }));
  }
  // the little engine behind
  L.push(part(turned([[0.03, -0.355], [0.04, -0.36], [0.048, -0.345], [0.05, -0.3], [0.042, -0.26]], 14), { at: [0, -0.02, 0], color: BLACK }));
  L.push(part(new THREE.CircleGeometry(0.032, 14), { at: [0, -0.02, -0.353], rot: [0, PI, 0], to: 'glow', color: [3.6, 1.7, 2.6] }));
  L.push(part(new THREE.ConeGeometry(0.028, 0.05, 12, 1, true), { at: [0, -0.02, -0.38], rot: [-PI / 2, 0, 0], to: 'glow', color: [3.4, 1.4, 2.4], mark: 'jet' }));

  const paint = standard(k, { map: k.own(panelTexture(k.rand, { base: 246, spread: 3, seam: 0.92, detail: 0, min: 32 })), metalness: 0.08, roughness: 0.42 });
  paint.userData.density = 4;
  const mats = { paint, glass: standard(k, { color: '#221a2a', metalness: 0.9, roughness: 0.08 }), glow: glowMaterial(k) };
  const M = meshes(k, L, mats);
  const blink = blinker(M.glow.geometry);
  return {
    root: Object.values(M),
    update(t) {
      // the engine popping, quick
      blink('jet', pulse(t, 0.16, 0, 0.5) ? 1.15 : 0.55);
      const head = Math.floor(t * 8) % N;
      for (let i = 0; i < N; i++) blink(`rim${i}`, i === head ? 1.2 : 0.35);
    },
  };
}

export const FLEET = { squanchship, poopyship };
