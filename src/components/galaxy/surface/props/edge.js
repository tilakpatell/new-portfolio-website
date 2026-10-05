// The edge worlds' props, built in code (props/index.js has what a builder
// returns): Mustafar's mining facility, lava fleas and Fortress Vader;
// Scarif's Citadel, palms and AT-ACTs; Exegol's throne and statues;
// Ahch-To's beehive huts and first Jedi temple; Cloud City's towers,
// platforms and cloud cars. What a model (catalog/edge.js) takes over when
// it comes, and what there's no model of at all (the lava geysers, the
// carbon-freezing chamber, the reactor shaft…). And the people who aren't
// in figures.js: Vader, the shoretroopers, K-2SO, Mustafarians, Lando.

import * as THREE from 'three';
import { box, cyl, dome, part, place, ring, rod, rockGeometry } from '../kit';
import { loft, trap8, upright } from '../../../universe/trafficKit';

const { PI, cos, sin, abs, max } = Math;
const hot = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);
const shade = (c, l) => new THREE.Color(c).offsetHSL(0, 0, l);

// a mesh of its own (one that moves on its own in update), with the kit's
// material for what it's made of
const own = (k, parts, name) => k.build(parts, { name });

// ── People, built ──
// Someone standing on y = 0 facing +z, `tall` metres: the body in one
// piece, legs and arms swinging from the hips and shoulders as they go
// (update's move, 0…1). o: { tall, body, legs, boots, skin, glove, bulk,
// thin, to (what the body's made of), head() (the head's parts, about its
// middle), extra() (more on the body), cape, robe, saber, still }
function figure(k, o) {
  const bulk = o.bulk ?? 1;
  const thin = o.thin ?? 1;
  const to = o.to ?? 'cloth';
  const model = new THREE.Group();
  const P = [
    part(new THREE.CapsuleGeometry(0.17 * bulk * thin, 0.32, 4, 12), { at: [0, 1.18, 0], scale: [1, 1, 0.72], color: o.body, to }),
    part(new THREE.SphereGeometry(0.15 * bulk * thin, 12, 8), { at: [0, 0.9, 0], scale: [1.15, 0.7, 0.8], color: o.legs, to: o.legsTo ?? to }),
    part(new THREE.CylinderGeometry(0.055, 0.065, 0.14, 8), { at: [0, 1.47, 0], color: o.neck ?? o.skin ?? o.body, to: o.neckTo ?? to }),
  ];
  if (o.robe) P.push(part(new THREE.CylinderGeometry(0.2 * bulk, 0.34 * bulk, o.robe.len ?? 0.95, 14, 1, true), { at: [0, (o.robe.y ?? 0.5), 0], color: o.robe.color, to: 'cloth' }));
  if (o.cape) P.push(part(new THREE.CylinderGeometry(0.24 * bulk, 0.48 * bulk, 1.32, 14, 1, true, PI / 2 + 0.15, PI - 0.3), { at: [0, 0.78, -0.03], color: o.cape.color, to: 'cloth' }));
  if (o.cape?.lining) P.push(part(new THREE.CylinderGeometry(0.235 * bulk, 0.47 * bulk, 1.3, 14, 1, true, PI / 2 + 0.2, PI - 0.4), { at: [0, 0.79, -0.02], color: o.cape.lining, to: 'cloth' }));
  if (o.head) P.push(...place(o.head(), [0, 1.6, 0]));
  if (o.extra) P.push(...o.extra());
  model.add(k.build(P, { name: 'figure' }));
  const legs = [];
  for (const x of [-0.09, 0.09]) {
    const hip = new THREE.Group();
    hip.position.set(x * bulk, 0.86, 0);
    const lr = 0.07 * thin * bulk;
    hip.add(own(k, [part(new THREE.CapsuleGeometry(lr, 0.33, 4, 8), { at: [0, -0.2, 0], color: o.legs, to: o.legsTo ?? to })], 'thigh'));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    knee.add(own(k, [part(new THREE.CapsuleGeometry(lr * 0.86, 0.3, 4, 8), { at: [0, -0.18, 0], color: o.shins ?? o.legs, to: o.legsTo ?? to }), part(new THREE.BoxGeometry(0.12 * bulk, 0.08, 0.25), { at: [0, -0.4, 0.04], color: o.boots ?? '#1a1714', to: 'dark' })], 'shin'));
    hip.add(knee);
    model.add(hip);
    legs.push({ hip, knee });
  }
  const arms = [];
  for (const x of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(x * 0.24 * bulk * (thin < 1 ? 0.85 : 1), 1.4, 0);
    const ar = 0.05 * thin * bulk;
    const sleeve = o.sleeves ?? o.body;
    sh.add(own(k, [part(new THREE.CapsuleGeometry(ar, 0.24, 4, 8), { at: [0, -0.15, 0], color: sleeve, to: o.sleevesTo ?? to })], 'arm'));
    const el = new THREE.Group();
    el.position.y = -0.32;
    const fore = [part(new THREE.CapsuleGeometry(ar * 0.9, 0.22, 4, 8), { at: [0, -0.14, 0], color: sleeve, to: o.sleevesTo ?? to }), part(new THREE.SphereGeometry(0.045 * bulk, 8, 6), { at: [0, -0.3, 0.01], color: o.glove ?? o.skin ?? '#2a2420', to: o.glove ? 'dark' : 'cloth' })];
    // a lightsaber, lit, in the right hand; a blaster, a staff
    if (o.saber && x < 0) fore.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), { at: [0, -0.3, 0.1], rot: [PI / 2 - 0.5, 0, 0], color: '#9a9a9a', to: 'metal' }), rod([0, -0.24, 0.2], [0, 0.22, 1.1], 0.022, 0.022, { color: hot(o.saber, 3), to: 'glow' }));
    if (o.gun && x < 0) fore.push(part(new THREE.BoxGeometry(0.06, 0.1, 0.42), { at: [0, -0.3, 0.14], color: '#1a1a1c', to: 'metal' }));
    if (o.staff && x < 0) fore.push(rod([0, -1.25, 0.08], [0, 0.55, 0.08], 0.022, 0.022, { color: o.staff, to: 'bark' }));
    el.add(own(k, fore, 'forearm'));
    sh.add(el);
    model.add(sh);
    arms.push({ sh, el, x });
  }
  model.scale.setScalar((o.tall ?? 1.8) / 1.75);
  let phase = k.rand() * 10;
  return {
    object: model,
    solids: [{ circle: [0, 0, 0.35] }],
    update(t, dt = 0, move = 0) {
      phase += dt * (2.5 + move * 6);
      const sw = sin(phase) * (0.1 + move * 0.55) * Math.min(1, move * 5);
      legs[0].hip.rotation.x = sw;
      legs[1].hip.rotation.x = -sw;
      legs[0].knee.rotation.x = max(0, -sin(phase + 0.6)) * move * 0.9;
      legs[1].knee.rotation.x = max(0, sin(phase + 0.6)) * move * 0.9;
      for (const a of arms) {
        // (a saber held up and ready when they're stood still)
        const ready = o.saber && a.x < 0 ? (1 - move) * 0.7 : 0;
        a.sh.rotation.x = -sw * 0.7 * a.x - ready;
        a.el.rotation.x = -ready * 0.6 - (o.gun && a.x < 0 ? 0.9 : 0);
      }
    },
  };
}

// a hood over a face in shadow (Jedi, Sith, hermits)
const hood = (color, face = '#0a0806', r = 0.15) => [
  part(new THREE.SphereGeometry(r, 14, 10, 0, PI * 2, 0, PI * 0.62), { at: [0, 0.01, -0.01], scale: [1, 1.12, 1.08], color, to: 'cloth' }),
  part(new THREE.CylinderGeometry(r * 1.02, r * 1.25, 0.16, 14, 1, true, PI * 0.25, PI * 1.5), { at: [0, -0.07, -0.01], color, to: 'cloth' }),
  part(new THREE.SphereGeometry(r * 0.72, 12, 8), { at: [0, -0.01, 0.03], color: face, to: 'cloth' }),
];
// a face, bare (skin, eyes, hair)
const face = (skin, hair, { beard = null, bald = false } = {}) => {
  const P = [part(new THREE.SphereGeometry(0.11, 14, 10), { scale: [0.95, 1.08, 1], color: skin, to: 'cloth' })];
  for (const x of [-0.04, 0.04]) P.push(part(new THREE.SphereGeometry(0.014, 6, 4), { at: [x, 0.015, 0.1], color: '#141010', to: 'dark' }));
  if (!bald) P.push(part(new THREE.SphereGeometry(0.118, 14, 8, 0, PI * 2, 0, PI * 0.5), { at: [0, 0.012, -0.012], scale: [1, 1.1, 1.08], color: hair, to: 'cloth' }));
  if (beard) P.push(part(new THREE.SphereGeometry(0.085, 10, 8, 0, PI * 2, PI * 0.45, PI * 0.55), { at: [0, -0.02, 0.035], scale: [1, 1.1, 0.9], color: beard, to: 'cloth' }));
  return P;
};
// a trooper's helmet: a dome, a visor, a brow
const helmet = (white, visor = '#0a0a0c', { band = null, brow = white } = {}) => [
  part(new THREE.SphereGeometry(0.14, 16, 12), { scale: [1, 1.06, 1.08], color: white, to: 'paint' }),
  part(new THREE.CylinderGeometry(0.15, 0.16, 0.06, 16), { at: [0, -0.08, 0], color: brow, to: 'paint' }),
  part(new THREE.BoxGeometry(0.17, 0.045, 0.06), { at: [0, 0.015, 0.125], color: visor, to: 'dark' }),
  ...(band ? [part(new THREE.BoxGeometry(0.1, 0.07, 0.05), { at: [0, -0.06, 0.13], color: band, to: 'paint' })] : []),
];

// ── Mustafar ──

const BASALT = '#242020';
const MUSTAFAR_STEEL = '#3e3c3e';
const LAVA = '#ff6a1c';

export const PROPS = {
  // Darth Vader: black armour, the helmet and its mask, the chest box, the
  // cape (and, if he means it, his lightsaber lit)
  vader(k, { saber = false } = {}) {
    return figure(k, {
      tall: 2.03,
      bulk: 1.15,
      body: '#151517',
      legs: '#111113',
      boots: '#0a0a0a',
      glove: '#0c0c0c',
      to: 'dark',
      neck: '#0e0e10',
      saber: saber ? '#ff2a1a' : null,
      cape: { color: '#0b0b0d' },
      head: () => [
        part(new THREE.SphereGeometry(0.145, 18, 12, 0, PI * 2, 0, PI * 0.55), { at: [0, 0.03, -0.01], scale: [1, 1.1, 1.08], color: '#0e0e10', to: 'dark' }),
        part(new THREE.CylinderGeometry(0.15, 0.2, 0.2, 18, 1, true, PI * 0.42, PI * 1.16), { at: [0, -0.06, -0.01], color: '#0e0e10', to: 'dark' }),
        part(new THREE.BoxGeometry(0.15, 0.2, 0.08), { at: [0, -0.04, 0.09], color: '#141416', to: 'dark' }),
        part(new THREE.SphereGeometry(0.035, 10, 6), { at: [-0.04, 0.01, 0.135], scale: [1.1, 0.8, 0.5], color: '#2a1414', to: 'glass' }),
        part(new THREE.SphereGeometry(0.035, 10, 6), { at: [0.04, 0.01, 0.135], scale: [1.1, 0.8, 0.5], color: '#2a1414', to: 'glass' }),
        part(new THREE.ConeGeometry(0.045, 0.09, 3), { at: [0, -0.09, 0.13], rot: [PI, 0, 0], color: '#3a3a3c', to: 'metal' }),
      ],
      extra: () => [
        part(box(0.16, 0.12, 0.04), { at: [0, 1.2, 0.12], color: '#1e1e22', to: 'metal' }),
        part(new THREE.BoxGeometry(0.03, 0.02, 0.01), { at: [-0.04, 1.28, 0.145], color: hot('#ff3030', 2), to: 'glow' }),
        part(new THREE.BoxGeometry(0.03, 0.02, 0.01), { at: [0.0, 1.28, 0.145], color: hot('#30a0ff', 2), to: 'glow' }),
        part(new THREE.BoxGeometry(0.03, 0.02, 0.01), { at: [0.04, 1.24, 0.145], color: hot('#40ff60', 2), to: 'glow' }),
        part(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), { at: [0, 0.98, 0], scale: [1.05, 1, 0.8], color: '#1a1a1c', to: 'metal' }),
        part(new THREE.BoxGeometry(0.1, 0.07, 0.03), { at: [0, 0.98, 0.15], color: '#8a8a8c', to: 'metal' }),
        // the shoulder bells
        part(new THREE.SphereGeometry(0.11, 12, 8, 0, PI * 2, 0, PI / 2), { at: [-0.25, 1.38, 0], color: '#121214', to: 'dark' }),
        part(new THREE.SphereGeometry(0.11, 12, 8, 0, PI * 2, 0, PI / 2), { at: [0.25, 1.38, 0], color: '#121214', to: 'dark' }),
      ],
    });
  },

  // Obi-Wan Kenobi, in his Jedi robes, his lightsaber lit (the high ground)
  obiwan(k, { saber = true } = {}) {
    return figure(k, {
      tall: 1.82,
      body: '#d8c8a6',
      legs: '#c4b08c',
      boots: '#3a2a1e',
      skin: '#e0b090',
      sleeves: '#6a4a30',
      saber: saber ? '#4a8cff' : null,
      robe: { color: '#cdb994', len: 0.62, y: 0.62 },
      cape: { color: '#5a3e28' },
      head: () => face('#e0b090', '#9a6a3a', { beard: '#9a6a3a' }),
    });
  },

  // Anakin Skywalker, all in black, his lightsaber lit
  anakin(k, { saber = true } = {}) {
    return figure(k, {
      tall: 1.85,
      body: '#2a1e18',
      legs: '#1e1612',
      boots: '#0e0a08',
      skin: '#e2b08e',
      sleeves: '#22180f',
      glove: '#111',
      saber: saber ? '#4a8cff' : null,
      robe: { color: '#1e1612', len: 0.55, y: 0.65 },
      head: () => face('#e2b08e', '#6a4a2a'),
    });
  },

  // a Mustafarian: tall and thin in a heat-proof suit, the long snout of
  // its breathing mask, goggles glowing in the dark
  mustafarian(k) {
    return figure(k, {
      tall: 2.1,
      thin: 0.7,
      body: '#5a4a3e',
      legs: '#4a3c32',
      boots: '#2a221c',
      glove: '#2a2420',
      to: 'stone',
      head: () => [
        part(new THREE.SphereGeometry(0.12, 12, 10), { scale: [0.9, 1.1, 1.1], color: '#6a5444', to: 'stone' }),
        part(new THREE.CylinderGeometry(0.05, 0.03, 0.34, 10), { at: [0, -0.1, 0.17], rot: [0.95, 0, 0], color: '#5a4636', to: 'stone' }),
        part(new THREE.SphereGeometry(0.03, 8, 6), { at: [-0.05, 0.03, 0.1], color: hot('#ff9a3a', 2.5), to: 'glow' }),
        part(new THREE.SphereGeometry(0.03, 8, 6), { at: [0.05, 0.03, 0.1], color: hot('#ff9a3a', 2.5), to: 'glow' }),
        part(new THREE.ConeGeometry(0.1, 0.16, 10), { at: [0, 0.13, -0.02], color: '#4a3a2e', to: 'stone' }),
      ],
      extra: () => [part(new THREE.BoxGeometry(0.22, 0.26, 0.1), { at: [0, 1.22, -0.13], color: '#3a302a', to: 'metal' })],
    });
  },

  // a lava flea: a high, hard shell on six long legs (the hind ones for
  // leaping), its small head down low; Mustafarians ride them
  lavaflea(k, { color = '#3a2e28' } = {}) {
    const object = new THREE.Group();
    const body = new THREE.Group();
    object.add(body);
    const P = [
      part(new THREE.SphereGeometry(1, 20, 14), { at: [0, 3.4, -0.4], scale: [1.6, 1.25, 2.4], color, to: 'dark' }),
      part(new THREE.SphereGeometry(1, 16, 10), { at: [0, 2.9, -0.2], scale: [1.4, 0.8, 2.1], color: '#8a4a26', to: 'stone' }),
      // the plates down its back
      ...[-1.2, 0, 1.2].map((z) => part(new THREE.TorusGeometry(1.25, 0.08, 6, 20, PI), { at: [0, 3.35, z - 0.4], scale: [1.25, 0.95, 1], color: '#241c18', to: 'dark' })),
      // the head, the mandibles, its little eyes
      part(new THREE.SphereGeometry(0.55, 14, 10), { at: [0, 2.6, 2.1], scale: [1, 0.8, 1.2], color: '#4a3a30', to: 'dark' }),
      part(new THREE.ConeGeometry(0.1, 0.6, 6), { at: [-0.22, 2.25, 2.6], rot: [2.1, 0, 0.2], color: '#2a201a', to: 'dark' }),
      part(new THREE.ConeGeometry(0.1, 0.6, 6), { at: [0.22, 2.25, 2.6], rot: [2.1, 0, -0.2], color: '#2a201a', to: 'dark' }),
      part(new THREE.SphereGeometry(0.08, 8, 6), { at: [-0.3, 2.8, 2.5], color: hot('#ffb040', 2), to: 'glow' }),
      part(new THREE.SphereGeometry(0.08, 8, 6), { at: [0.3, 2.8, 2.5], color: hot('#ffb040', 2), to: 'glow' }),
      // a saddle and its pack
      part(new THREE.BoxGeometry(0.9, 0.25, 1.1), { at: [0, 4.6, 0.3], rot: [0.15, 0, 0], color: '#5a3a26', to: 'cloth' }),
      part(new THREE.BoxGeometry(1.4, 0.5, 0.7), { at: [0, 4.4, -0.8], color: '#4a3a2c', to: 'cloth' }),
    ];
    body.add(k.build(P, { name: 'lavaflea' }));
    const legs = [];
    for (const [x, z, len, phase] of [
      [-1, 1.4, 1, 0],
      [1, 1.4, 1, 0.5],
      [-1, -0.1, 1.05, 0.5],
      [1, -0.1, 1.05, 0],
      [-1, -1.6, 1.3, 0],
      [1, -1.6, 1.3, 0.5],
    ]) {
      const hip = new THREE.Group();
      hip.position.set(x * 1.3, 3.0, z);
      const knee = [x * 1.5 * len, 1.8 * len, z * 0.15];
      const foot = [x * 2.1 * len, -3.0, z * 0.3 + (z < -1 ? -0.8 : 0)];
      hip.add(own(k, [rod([0, 0, 0], knee, 0.2, 0.14, { color: '#2e2420', to: 'dark' }), part(new THREE.SphereGeometry(0.2, 8, 6), { at: knee, color: '#2a201c', to: 'dark' }), rod(knee, foot, 0.14, 0.06, { color: '#3a2e26', to: 'dark' })], 'flea-leg'));
      body.add(hip);
      legs.push({ hip, phase, x });
    }
    let cycle = k.rand();
    return {
      object,
      solids: [{ circle: [0, 0, 2.2] }],
      update(t, dt = 0, move = 0) {
        cycle += dt * (0.25 + move * 1.1);
        for (const l of legs) {
          const a = (cycle + l.phase) * PI * 2;
          l.hip.rotation.x = sin(a) * 0.28 * (0.15 + move);
          l.hip.rotation.z = max(0, cos(a)) * 0.1 * l.x * move;
        }
        body.position.y = abs(sin(cycle * PI * 2)) * 0.18 * move + sin(t * 1.3) * 0.04;
      },
    };
  },

  // the Klegger Corp mining facility, where the Separatist council hid at
  // the end of the war: a long hall up on its struts, the control tower and
  // the council's room at its top, two collector arms reaching back over
  // the lava with their scoops (60 m tall), its windows lit amber
  mining(k) {
    const amber = hot('#ffb062', 1.9);
    const P = [];
    // the podium it stands on, and the struts under the hall
    P.push(part(box(46, 5, 34), { at: [0, 0, -2], color: '#2c2a2a', to: 'stone' }));
    for (const x of [-15, -5, 5, 15]) for (const z of [-14, 10]) P.push(part(cyl(1.2, 0.9, 6, 10), { at: [x, 4.5, z], color: '#2a2829', to: 'metal' }));
    // the hall: sloped walls, a ridge on top, a band of windows down each side
    P.push(part(loft([
      { z: -19, pts: trap8(30, 20, 12, 1.5, 16) },
      { z: 13, pts: trap8(30, 20, 12, 1.5, 16) },
      { z: 17, pts: trap8(24, 14, 9, 1.2, 15) },
    ]), { color: MUSTAFAR_STEEL, to: 'paint' }));
    P.push(part(loft([
      { z: -16, pts: trap8(18, 9, 5, 0.8, 24.5) },
      { z: 10, pts: trap8(18, 9, 5, 0.8, 24.5) },
    ]), { color: '#333133', to: 'paint' }));
    for (const s of [-1, 1]) P.push(part(new THREE.BoxGeometry(0.3, 1.2, 28), { at: [s * 13.3, 17.5, -3], rot: [0, 0, s * 0.39], color: amber, to: 'glow' }));
    P.push(part(new THREE.BoxGeometry(16, 1.4, 0.3), { at: [0, 15.5, 16.5], color: amber, to: 'glow' }));
    // the control tower and the council's room, round and lit, at its top
    P.push(part(cyl(3.6, 2.6, 34, 14), { at: [-9, 20, 6], color: '#363436', to: 'paint' }));
    P.push(part(upright([[2.6, 0], [8.5, 2.5], [9, 5], [7, 7.5], [2, 8.5]], 20), { at: [-9, 50, 6], color: '#3c3a3c', to: 'paint' }));
    P.push(part(new THREE.CylinderGeometry(8.85, 8.6, 1.1, 24, 1, true), { at: [-9, 54.8, 6], color: amber, to: 'glow' }));
    P.push(rod([-9, 58, 6], [-9, 66, 6], 0.35, 0.12, { color: '#4a4648', to: 'metal' }));
    P.push(part(new THREE.SphereGeometry(0.4, 8, 6), { at: [-9, 66.2, 6], color: hot('#ff3a20', 3), to: 'glow' }));
    // a second, thinner stack at the back, venting
    P.push(part(cyl(2.4, 1.6, 30, 12), { at: [10, 20, -12], color: '#2e2c2e', to: 'metal' }));
    P.push(part(ring(1.7, 0.3, 14), { at: [10, 50, -12], color: hot('#ff7a2a', 2.2), to: 'glow' }));
    // the collector arms: girders out over the lava behind, scoops on their ends
    for (const s of [-1, 1]) {
      const a = [s * 8, 18, -18];
      const b = [s * 15, 4, -58];
      P.push(rod(a, b, 1.3, 0.9, { color: '#4a4446', to: 'metal' }));
      P.push(rod([a[0], a[1] + 4, a[2]], [b[0], b[1] + 6, b[2] + 2], 0.5, 0.4, { color: '#3a3638', to: 'metal' }));
      for (let i = 1; i < 6; i++) {
        const f = i / 6;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        P.push(rod(p, [p[0], p[1] + 4 + f * 2, p[2] + 0.4], 0.25, 0.25, { color: '#3a3638', to: 'metal' }));
      }
      P.push(part(new THREE.SphereGeometry(4, 16, 10, 0, PI * 2, PI / 2, PI / 2), { at: [b[0], b[1] + 1, b[2] - 2], color: '#3a3436', to: 'metal' }));
      P.push(part(new THREE.CircleGeometry(3.7, 16).rotateX(-PI / 2), { at: [b[0], b[1] + 0.9, b[2] - 2], color: hot(LAVA, 2.4), to: 'glow' }));
      P.push(part(new THREE.ConeGeometry(0.6, 3, 8), { at: [b[0], b[1] - 4, b[2] - 2], rot: [PI, 0, 0], color: hot(LAVA, 2.6), to: 'glow' }));
    }
    // pipes along its flanks
    for (const s of [-1, 1]) P.push(part(new THREE.CylinderGeometry(0.7, 0.7, 34, 10), { at: [s * 21, 6.5, -2], rot: [PI / 2, 0, 0], color: '#4a4244', to: 'metal' }));
    return { object: k.build(P, { name: 'mining' }), solids: [{ box: [0, -2, 23, 17, 0] }, { circle: [-9, 6, 4] }] };
  },

  // Fortress Vader: two black towers like the tines of a fork, 120 m tall,
  // over a lava fall, its slit windows lit, and the long landing bridge out
  // to its pad
  fortress(k) {
    const black = '#17161a';
    const P = [];
    // the rock it's built on, and its foundations
    P.push(part(loft([
      { z: -26, pts: trap8(70, 52, 26, 3, 13) },
      { z: 22, pts: trap8(70, 52, 26, 3, 13) },
      { z: 30, pts: trap8(50, 36, 18, 2, 9) },
    ]), { color: '#221e1e', to: 'stone' }));
    // the tines, tapering to their points
    for (const s of [-1, 1]) {
      P.push(part(loft([
        { z: -12, pts: trap8(15, 12, 1, 0.2, 25) },
        { z: 12, pts: trap8(15, 12, 1, 0.2, 25) },
      ]), { color: black, to: 'dark' }));
      const tine = loft([
        { z: -11, pts: trap8(14, 9, 96, 1.2, 72).map(([x, y]) => [x + s * 10, y]) },
        { z: 8, pts: trap8(14, 9, 96, 1.2, 72).map(([x, y]) => [x + s * 10, y]) },
        { z: 12, pts: trap8(9, 5, 90, 0.8, 69).map(([x, y]) => [x + s * 10, y]) },
      ]);
      P.push(part(tine, { color: black, to: 'dark' }));
      P.push(part(new THREE.ConeGeometry(5.5, 14, 4), { at: [s * 10, 126, -1], rot: [0, PI / 4, 0], scale: [1.1, 1, 1.6], color: black, to: 'dark' }));
      // the slits of light up its front
      for (const y of [40, 58, 76, 94]) P.push(part(new THREE.BoxGeometry(0.6, 9, 0.3), { at: [s * 10, y, 12.2], color: hot('#ff9a5a', 1.5), to: 'glow' }));
    }
    // the bridge between them, high up: the chamber
    P.push(part(box(12, 10, 16), { at: [0, 80, -3], color: '#1c1b20', to: 'dark' }));
    P.push(part(new THREE.BoxGeometry(10, 1.2, 0.3), { at: [0, 85, 5.2], color: hot('#ff5a3a', 2), to: 'glow' }));
    // the landing bridge, out the front, and its pad
    P.push(part(box(8, 1.2, 40), { at: [0, 22, 46], color: '#1e1d22', to: 'paint' }));
    for (const z of [36, 56]) P.push(part(cyl(1.2, 1.2, 22, 8), { at: [0, 0, z], color: '#1a191c', to: 'metal' }));
    P.push(part(cyl(13, 13, 1.4, 24), { at: [0, 21.5, 72], color: '#24222a', to: 'paint' }));
    P.push(part(new THREE.TorusGeometry(12.6, 0.2, 6, 28).rotateX(PI / 2), { at: [0, 23, 72], color: hot('#ff6a3a', 2), to: 'glow' }));
    P.push(part(cyl(2.4, 1.5, 21.5, 10), { at: [0, 0, 72], color: '#1a191c', to: 'metal' }));
    // the lava pouring out of its foot, and the pool it falls into
    P.push(part(new THREE.BoxGeometry(14, 16, 0.6), { at: [0, 8, 30.5], rot: [0.25, 0, 0], color: hot(LAVA, 2.6), to: 'glow' }));
    P.push(part(new THREE.BoxGeometry(6, 10, 0.6), { at: [-24, 6, 23], rot: [0.25, 0.3, 0], color: hot('#ff8a2a', 2.4), to: 'glow' }));
    return { object: k.build(P, { name: 'fortress', shadows: false }), solids: [{ box: [0, -2, 35, 28, 0] }, { circle: [0, 72, 2.6] }, { circle: [0, 36, 1.4] }, { circle: [0, 56, 1.4] }] };
  },

  // Vader's meditation chamber: a black sphere on its pedestal, its upper
  // half lifting open on its hinge, white inside, his seat in the middle
  vadermeditation(k) {
    const object = new THREE.Group();
    const R = 2.3;
    const P = [
      part(cyl(1.6, 1.1, 0.9, 20), { color: '#1e1e22', to: 'metal' }),
      part(new THREE.SphereGeometry(R, 28, 16, 0, PI * 2, PI / 2, PI / 2), { at: [0, 3.1, 0], color: '#121214', to: 'dark' }),
      part(new THREE.SphereGeometry(R - 0.08, 24, 12, 0, PI * 2, PI / 2, PI / 2), { at: [0, 3.1, 0], color: '#e8e8ea', to: 'cloth' }),
      part(new THREE.TorusGeometry(R, 0.08, 6, 32).rotateX(PI / 2), { at: [0, 3.1, 0], color: '#2a2a2e', to: 'metal' }),
      part(box(1.0, 0.5, 0.9), { at: [0, 1.5, 0], color: '#2a2a2e', to: 'metal' }),
      part(box(0.9, 1.4, 0.2), { at: [0, 1.5, -0.6], color: '#2a2a2e', to: 'metal' }),
      part(new THREE.CircleGeometry(0.5, 16).rotateX(-PI / 2), { at: [0, 0.92, 0], color: hot('#9ab8ff', 1.4), to: 'glow' }),
    ];
    object.add(k.build(P, { name: 'meditation' }));
    // the lid, on its hinge at the back
    const hinge = new THREE.Group();
    hinge.position.set(0, 3.1, -R);
    hinge.add(own(k, [
      part(new THREE.SphereGeometry(R, 28, 14, 0, PI * 2, 0, PI / 2), { at: [0, 0, R], color: '#121214', to: 'dark' }),
      part(new THREE.SphereGeometry(R - 0.08, 24, 12, 0, PI * 2, 0, PI / 2), { at: [0, 0, R], color: '#e8e8ea', to: 'cloth' }),
      part(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12), { at: [0, R + 0.1, R], color: '#2a2a2e', to: 'metal' }),
    ], 'lid'));
    object.add(hinge);
    return {
      object,
      solids: [{ circle: [0, 0, R] }],
      update(t) {
        hinge.rotation.x = -0.7 - 0.25 * sin(t * 0.25);
      },
    };
  },

  // a geyser of lava: a glowing mound, and gouts of it thrown up and
  // falling back, over and over
  lavaspout(k, { h = 16, n = 10 } = {}) {
    const object = k.build([
      part(new THREE.ConeGeometry(6, 3.2, 14, 1, true), { at: [0, 1.4, 0], color: '#1e1a18', to: 'stone' }),
      part(new THREE.CircleGeometry(2.2, 14).rotateX(-PI / 2), { at: [0, 2.9, 0], color: hot(LAVA, 3), to: 'glow' }),
      part(new THREE.ConeGeometry(1.4, 5, 10, 1, true), { at: [0, 4.6, 0], color: hot('#ffa040', 3), to: 'glow' }),
    ], { name: 'lavaspout' });
    const g = k.geometry([part(new THREE.IcosahedronGeometry(0.6, 1), { color: hot('#ffb050', 3), to: 'glow' })]);
    const blobs = new THREE.InstancedMesh(g, k.mats.glow, n);
    blobs.frustumCulled = false;
    object.add(blobs);
    const dirs = Array.from({ length: n }, (_, i) => [cos(i * 2.4) * (0.3 + (i % 3) * 0.25), sin(i * 2.4) * (0.3 + (i % 3) * 0.25), 0.8 + (i % 4) * 0.15, i / n]);
    const m = new THREE.Matrix4();
    const light = new THREE.PointLight('#ff7a2a', 30, 40, 2);
    light.position.y = 4;
    object.add(light);
    return {
      object,
      solids: [{ circle: [0, 0, 3.5] }],
      update(t) {
        dirs.forEach(([dx, dz, v, ph], i) => {
          const p = (t * 0.45 + ph) % 1;
          const y = 3 + h * v * 4 * p * (1 - p);
          const s = 1.4 * (1 - p * 0.7);
          m.makeScale(s, s * 1.3, s).setPosition(dx * p * h * 0.6, y, dz * p * h * 0.6);
          blobs.setMatrixAt(i, m);
        });
        blobs.instanceMatrix.needsUpdate = true;
        light.intensity = 24 + 8 * sin(t * 7);
      },
    };
  },

  // a volcano on the horizon: a black cone, its crater glowing, lava down
  // its sides, its plume of ash going up into the murk
  volcano(k, { h = 420, r = 700 } = {}) {
    const P = [
      part(upright([[r, 0], [r * 0.6, h * 0.35], [r * 0.25, h * 0.85], [r * 0.14, h], [r * 0.1, h * 0.95]], 28), { color: '#1c1818', to: 'stone' }),
      part(new THREE.CircleGeometry(r * 0.11, 20).rotateX(-PI / 2), { at: [0, h * 0.96, 0], color: hot(LAVA, 3), to: 'glow' }),
    ];
    // the flows down its sides
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3;
      const top = [cos(a) * r * 0.13, h * 0.98, sin(a) * r * 0.13];
      const mid = [cos(a + 0.08) * r * 0.32, h * 0.62, sin(a + 0.08) * r * 0.32];
      const low = [cos(a + 0.14) * r * 0.55, h * 0.18, sin(a + 0.14) * r * 0.55];
      P.push(rod(top, mid, r * 0.012, r * 0.016, { color: hot('#ff5a14', 2.6), to: 'glow' }));
      if (i % 2 === 0) P.push(rod(mid, low, r * 0.016, r * 0.01, { color: hot('#ff4a10', 2.2), to: 'glow' }));
    }
    // the plume
    for (let i = 0; i < 6; i++) P.push(part(new THREE.SphereGeometry(r * (0.16 + i * 0.05), 12, 8), { at: [i * r * 0.06, h * (1.05 + i * 0.22), i * r * 0.03], scale: [1, 0.7, 1], color: shade('#2a2220', -i * 0.01), to: 'stone' }));
    return { object: k.build(P, { name: 'volcano', shadows: false }) };
  },

  // a droid platform, adrift on the lava (Obi-Wan rode one down the
  // river): a flat deck over the droid's body, bobbing
  droidplatform(k) {
    const object = new THREE.Group();
    const inner = k.build([
      part(cyl(1.5, 1.7, 0.35, 16), { at: [0, 0.6, 0], color: '#5a5450', to: 'metal' }),
      part(new THREE.SphereGeometry(0.9, 14, 10, 0, PI * 2, PI / 2, PI / 2), { at: [0, 0.6, 0], color: '#3a3634', to: 'metal' }),
      part(new THREE.SphereGeometry(0.22, 10, 8), { at: [0, 0.2, 0.8], color: hot('#ff4a2a', 2.5), to: 'glow' }),
      part(new THREE.TorusGeometry(1.55, 0.06, 6, 20).rotateX(PI / 2), { at: [0, 0.97, 0], color: '#8a8278', to: 'metal' }),
    ], { name: 'droidplatform' });
    object.add(inner);
    const ph = k.rand() * 10;
    return {
      object,
      update(t) {
        inner.position.y = sin(t * 1.4 + ph) * 0.12;
        inner.rotation.z = sin(t * 0.9 + ph) * 0.05;
        inner.rotation.x = sin(t * 0.7 + ph) * 0.05;
        inner.rotation.y = t * 0.05 + ph;
      },
    };
  },

  // the collector, adrift on the lava river: the platform Obi-Wan and
  // Anakin fought on, its tower leaning, a scoop arm hanging off it
  collector(k) {
    const object = new THREE.Group();
    const P = [
      part(box(16, 1.6, 11), { at: [0, -0.6, 0], color: '#3a3636', to: 'metal' }),
      part(box(15, 0.15, 10), { at: [0, 1.0, 0], color: '#4a4442', to: 'paint' }),
    ];
    // the tower: a girder mast, leaning, with its crossbars
    const a = [-3, 1, -1];
    const b = [3, 26, -6];
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(rod([a[0] + dx, a[1], a[2] + dz], [b[0] + dx * 0.5, b[1], b[2] + dz * 0.5], 0.22, 0.18, { color: '#4a4446', to: 'metal' }));
    for (let i = 1; i < 8; i++) {
      const f = i / 8;
      const y = a[1] + (b[1] - a[1]) * f;
      const x = a[0] + (b[0] - a[0]) * f;
      const z = a[2] + (b[2] - a[2]) * f;
      const w = 1 - f * 0.5;
      P.push(part(new THREE.BoxGeometry(2 * w + 0.3, 0.25, 0.25), { at: [x, y, z + w], color: '#3e3a3a', to: 'metal' }));
      P.push(part(new THREE.BoxGeometry(2 * w + 0.3, 0.25, 0.25), { at: [x, y, z - w], color: '#3e3a3a', to: 'metal' }));
    }
    P.push(part(box(4, 3, 3), { at: [b[0], b[1] - 1, b[2]], color: '#3a3636', to: 'paint' }));
    // the scoop arm, out over the side
    P.push(rod([5, 1, 3], [12, 6, 8], 0.4, 0.3, { color: '#4a4446', to: 'metal' }));
    P.push(part(new THREE.SphereGeometry(2, 14, 8, 0, PI * 2, PI / 2, PI / 2), { at: [12, 5, 9], color: '#3a3636', to: 'metal' }));
    P.push(part(new THREE.ConeGeometry(0.4, 2.5, 8), { at: [12, 2.5, 9], rot: [PI, 0, 0], color: hot(LAVA, 2.6), to: 'glow' }));
    const inner = k.build(P, { name: 'collector' });
    object.add(inner);
    return {
      object,
      floors: [{ x: 0, z: 0, hw: 7.5, hd: 5, y: 1.05 }],
      update(t) {
        inner.rotation.z = sin(t * 0.35) * 0.025;
        inner.rotation.x = sin(t * 0.27 + 1) * 0.02;
        inner.position.y = sin(t * 0.5) * 0.08;
      },
    };
  },

  // Padmé's landing platform at the facility: a dark deck on its legs at
  // the edge of the cliff, lights round its rim
  mpad(k, { r = 18 } = {}) {
    const P = [part(cyl(r, r * 0.96, 1.2, 36), { color: '#2e2c2e', to: 'metal' }), part(cyl(r * 0.9, r * 0.9, 1.25, 36), { color: '#3a3838', to: 'paint' })];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2;
      P.push(part(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8), { at: [cos(a) * r * 0.95, 1.28, sin(a) * r * 0.95], color: hot('#ff8a3a', 3), to: 'glow' }));
    }
    for (const a of [0, PI / 2]) P.push(part(new THREE.BoxGeometry(r * 1.4, 0.03, 0.6), { at: [0, 1.26, 0], rot: [0, a, 0], color: '#8a6a3a', to: 'paint' }));
    return { object: k.build(P, { name: 'mpad' }), floors: [{ x: 0, z: 0, r, y: 1.25 }] };
  },
  // ── Scarif ──

  // a shoretrooper: sand-coloured armour, the white helmet with its wide
  // black visor
  shoretrooper(k) {
    return figure(k, {
      tall: 1.83,
      body: '#c9b998',
      legs: '#b8a886',
      shins: '#d8d4cc',
      boots: '#2a2622',
      glove: '#1e1c1a',
      to: 'paint',
      gun: true,
      head: () => helmet('#e6e4de', '#141416', { band: '#c9b998', brow: '#c9b998' }),
      extra: () => [part(box(0.3, 0.26, 0.06), { at: [0, 1.1, 0.12], color: '#e6e4de', to: 'paint' }), part(box(0.34, 0.1, 0.25), { at: [0, 0.94, 0], color: '#3a3836', to: 'dark' })],
    });
  },

  // a death trooper: Krennic's guard, black and glossy, green lights on
  // the helmet
  deathtrooper(k) {
    return figure(k, {
      tall: 2.0,
      body: '#18191b',
      legs: '#141517',
      boots: '#0a0a0a',
      glove: '#0e0e0e',
      to: 'dark',
      gun: true,
      head: () => [...helmet('#141518', '#060607'), part(new THREE.BoxGeometry(0.02, 0.02, 0.02), { at: [-0.08, 0.03, 0.12], color: hot('#5aff6a', 3), to: 'glow' }), part(new THREE.BoxGeometry(0.02, 0.02, 0.02), { at: [0.08, 0.03, 0.12], color: hot('#5aff6a', 3), to: 'glow' })],
    });
  },

  // K-2SO: a tall, thin Imperial security droid, reprogrammed, black, his
  // round eyes lit white
  k2so(k) {
    return figure(k, {
      tall: 2.16,
      thin: 0.55,
      body: '#2a2c30',
      legs: '#25272b',
      boots: '#1a1b1e',
      glove: '#2a2c30',
      to: 'metal',
      head: () => [
        part(new THREE.SphereGeometry(0.15, 14, 10), { at: [0, 0.03, 0.02], scale: [1.25, 0.7, 1.05], color: '#2e3034', to: 'metal' }),
        part(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), { at: [-0.07, 0.04, 0.17], rot: [PI / 2, 0, 0], color: hot('#f0f4ff', 2.5), to: 'glow' }),
        part(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), { at: [0.07, 0.04, 0.17], rot: [PI / 2, 0, 0], color: hot('#f0f4ff', 2.5), to: 'glow' }),
      ],
      extra: () => [part(new THREE.SphereGeometry(0.16, 12, 8), { at: [0, 1.25, 0], scale: [1.4, 1.1, 0.8], color: '#2e3034', to: 'metal' })],
    });
  },

  // Jyn Erso: a brown jacket, a grey scarf, a blaster
  jyn(k) {
    return figure(k, {
      tall: 1.6,
      body: '#6a5440',
      legs: '#3a3a40',
      boots: '#2a2018',
      skin: '#e8c0a0',
      gun: true,
      head: () => face('#e8c0a0', '#3a2618'),
      extra: () => [part(new THREE.TorusGeometry(0.12, 0.05, 6, 14).rotateX(PI / 2), { at: [0, 1.42, 0], color: '#8a8a86', to: 'cloth' })],
    });
  },

  // Cassian Andor: the blue-grey parka, stubble, his rifle
  cassian(k) {
    return figure(k, {
      tall: 1.78,
      body: '#3e4a5a',
      legs: '#2a2a2e',
      boots: '#1e1a16',
      skin: '#c08c68',
      gun: true,
      head: () => face('#c08c68', '#1e1610', { beard: '#2a1e16' }),
    });
  },

  // Chirrut Îmwe: dark robes, a red sash, his staff
  chirrut(k) {
    return figure(k, {
      tall: 1.75,
      body: '#2e3646',
      legs: '#262c38',
      boots: '#1a1a1e',
      skin: '#c8a080',
      staff: '#4a3a2a',
      robe: { color: '#2a3240', len: 0.8, y: 0.45 },
      head: () => face('#c8a080', '#1a1410'),
      extra: () => [part(new THREE.CylinderGeometry(0.17, 0.18, 0.08, 14), { at: [0, 0.98, 0], color: '#8a2a22', to: 'cloth' })],
    });
  },

  // the Citadel, 300 m: a podium round the data vault, a ribbed shaft lit
  // in bands, and the great dish on top that sends to the fleet, turning
  citadel(k) {
    const grey = '#5a5c60';
    const object = new THREE.Group();
    const P = [
      // the podium (the vault's in it), stepped
      part(upright([[52, 0], [52, 7], [46, 8], [46, 15], [40, 16], [40, 20]], 40), { color: '#6a6c6e', to: 'paint' }),
      // the shaft, slimming, then out again for the head
      part(upright([[24, 18], [21, 60], [17, 200], [17, 236], [24, 252], [25, 262], [18, 270], [14, 272]], 32), { color: grey, to: 'paint' }),
    ];
    // ribs up it, and bands of windows round it
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2;
      P.push(rod([cos(a) * 23.5, 20, sin(a) * 23.5], [cos(a) * 17.2, 232, sin(a) * 17.2], 0.9, 0.7, { color: '#4a4c50', to: 'metal' }, 4));
    }
    for (const [y, r] of [[40, 22.1], [90, 20.3], [140, 18.6], [190, 17.3], [244, 21]]) P.push(part(new THREE.CylinderGeometry(r + 0.3, r + 0.3, 2.2, 32, 1, true), { at: [0, y, 0], color: hot('#ffe2a8', 1.5), to: 'glow' }));
    // the vault's doors, and the hangar mouths round the podium
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      P.push(part(box(12, 6, 1), { at: [sin(a) * 51.8, 0, cos(a) * 51.8], rot: [0, a, 0], color: '#1a1c1e', to: 'dark' }));
    }
    // the beacon on its mast
    P.push(rod([0, 270, 0], [0, 300, 0], 1.6, 0.5, { color: '#6a6c70', to: 'metal' }));
    P.push(part(new THREE.SphereGeometry(1.4, 10, 8), { at: [0, 301, 0], color: hot('#ff3a2a', 3), to: 'glow' }));
    object.add(k.build(P, { name: 'citadel', shadows: false }));
    // the dish, on its yoke, turning
    const dish = new THREE.Group();
    dish.position.y = 272;
    dish.add(own(k, [
      part(new THREE.CylinderGeometry(4, 6, 8, 12), { at: [0, 4, 0], color: '#4a4c50', to: 'metal' }),
      part(new THREE.SphereGeometry(34, 32, 10, 0, PI * 2, 0, 0.62), { at: [0, 44, 0], rot: [PI, 0, 0], scale: [1, 1, 1], color: '#8a8c90', to: 'paint', m: new THREE.Matrix4().compose(new THREE.Vector3(0, 40, -6), new THREE.Quaternion().setFromEuler(new THREE.Euler(PI - 0.55, 0, 0)), new THREE.Vector3(1, 1, 1)) }),
      rod([0, 8, 0], [0, 30, 8], 1.2, 0.8, { color: '#4a4c50', to: 'metal' }),
      rod([0, 16, 8], [0, 34, 22], 0.6, 0.3, { color: '#6a6c70', to: 'metal' }),
      part(new THREE.SphereGeometry(1.2, 8, 6), { at: [0, 34.5, 22.5], color: hot('#9ad8ff', 3), to: 'glow' }),
    ], 'citadel-dish'));
    object.add(dish);
    return {
      object,
      solids: [{ circle: [0, 0, 51] }],
      update(t) {
        dish.rotation.y = sin(t * 0.03) * 1.2;
      },
    };
  },

  // an AT-ACT: the cargo walker, an AT-AT built taller with a container
  // slung in its middle, 31 m to its back; its legs walk as it goes
  atact(k, { color = '#8c8a84' } = {}) {
    const dark = '#4e4c48';
    const object = new THREE.Group();
    const inner = new THREE.Group();
    object.add(inner);
    const body = new THREE.Group();
    body.position.y = 24.5;
    inner.add(body);
    const P = [
      part(loft([
        { z: -12, pts: trap8(6.0, 4.6, 5.2, 0.8, 0) },
        { z: -11, pts: trap8(7.0, 5.4, 6.2, 1.0, 0) },
        { z: 11, pts: trap8(7.0, 5.4, 6.2, 1.0, 0) },
        { z: 12, pts: trap8(6.0, 4.6, 5.2, 0.8, 0) },
      ]), { color, to: 'paint' }),
      // the container, slung under its middle, ribbed
      part(box(9.6, 9, 12.5), { at: [0, -7.2, 0], color: '#7c7a72', to: 'paint' }),
      part(new THREE.BoxGeometry(9.8, 0.6, 12.7), { at: [0, -2.9, 0], color: '#b8783a', to: 'paint' }),
    ];
    for (const z of [-5.4, -1.8, 1.8, 5.4]) P.push(part(new THREE.BoxGeometry(9.9, 9.2, 0.35), { at: [0, -2.6, z], color: dark, to: 'metal' }));
    for (const z of [-9, -6, 6, 9]) for (const x of [-3.62, 3.62]) P.push(part(new THREE.BoxGeometry(0.15, 4.6, 0.5), { at: [x, 0.2, z], color: dark, to: 'metal' }));
    // the neck and head
    for (let i = 0; i < 4; i++) P.push(part(new THREE.CylinderGeometry(1.1 - i * 0.05, 1.2 - i * 0.05, 0.75, 12), { at: [0, -0.4, 12.4 + i * 0.8], rot: [PI / 2, 0, 0], color: i % 2 ? color : dark, to: i % 2 ? 'paint' : 'metal' }));
    P.push(part(loft([
      { z: 15.2, pts: trap8(3.2, 2.2, 3.0, 0.45, -0.5) },
      { z: 18.6, pts: trap8(3.4, 2.4, 3.0, 0.45, -0.5) },
      { z: 19.8, pts: trap8(2.6, 1.8, 2.0, 0.35, -0.8) },
    ]), { color, to: 'paint' }));
    for (const x of [-1.9, 1.9]) P.push(part(new THREE.CylinderGeometry(0.18, 0.22, 3, 8), { at: [x, -1.4, 19.6], rot: [PI / 2, 0, 0], color: dark, to: 'metal' }));
    for (const x of [-0.7, 0.7]) P.push(part(new THREE.BoxGeometry(0.5, 0.18, 0.1), { at: [x, 0.0, 19.85], rot: [-0.3, 0, 0], color: hot('#ffb070', 1.6), to: 'glow' }));
    body.add(k.build(P, { name: 'atact-body' }));
    const legs = [];
    for (const [x, z, phase] of [[-3, 8.6, 0], [3, 8.6, 0.5], [-3, -8.6, 0.75], [3, -8.6, 0.25]]) {
      const hip = new THREE.Group();
      hip.position.set(x * 1.1, 22.4, z);
      hip.add(own(k, [part(new THREE.BoxGeometry(1.7, 11, 2.0).translate(0, -5.5, 0), { color, to: 'paint' }), part(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 14), { rot: [0, 0, PI / 2], color: dark, to: 'metal' })], 'atact-thigh'));
      const knee = new THREE.Group();
      knee.position.y = -10.8;
      knee.add(own(k, [
        part(new THREE.CylinderGeometry(1.0, 1.0, 2.0, 14), { rot: [0, 0, PI / 2], color: dark, to: 'metal' }),
        part(new THREE.BoxGeometry(1.4, 10, 1.6).translate(0, -5.1, 0), { color, to: 'paint' }),
        part(new THREE.CylinderGeometry(0.55, 0.65, 0.8, 10), { at: [0, -10.4, 0], color: dark, to: 'metal' }),
        part(new THREE.CylinderGeometry(1.6, 1.8, 0.8, 16), { at: [0, -11.1, 0], color, to: 'paint' }),
      ], 'atact-shin'));
      hip.add(knee);
      inner.add(hip);
      legs.push({ hip, knee, phase });
    }
    let cycle = 0;
    return {
      object,
      solids: legs.map((l) => ({ circle: [l.hip.position.x, l.hip.position.z, 1.7] })),
      update(t, dt = 0, move = 0) {
        cycle += dt * 0.28 * move;
        for (const l of legs) {
          const a = (cycle + l.phase) * PI * 2;
          l.hip.rotation.x = sin(a) * 0.2 * move;
          l.knee.rotation.x = -max(0, sin(a + 0.9)) * 0.42 * move;
        }
        body.position.y = 24.5 + abs(sin(cycle * PI * 4)) * 0.3 * move;
        body.rotation.z = sin(cycle * PI * 2) * 0.012 * move;
      },
    };
  },

  // a Scarif palm, 12 m: a long trunk, leaning, and its crown of fronds
  palm(k, opts = {}) {
    const p = palmParts(opts);
    return { object: k.build([...p.trunk, ...p.leaves], { name: 'palm' }), solids: [{ circle: [0, 0, 0.35] }] };
  },

  // the master switch: a lever on a pillar out in the open, between the
  // pads, that opens the way for the plans to go out to the fleet
  masterswitch(k) {
    const P = [
      part(cyl(3.2, 3.4, 0.5, 20), { color: '#8a8884', to: 'stone' }),
      part(cyl(0.7, 0.6, 2.2, 10), { at: [0, 0.5, 0], color: '#5a5c60', to: 'metal' }),
      part(box(1.8, 0.9, 1.1), { at: [0, 2.6, 0], color: '#6a6c70', to: 'paint' }),
      part(new THREE.BoxGeometry(1.5, 0.5, 0.05), { at: [0, 3.05, 0.57], color: '#1a1c1e', to: 'dark' }),
      rod([0.3, 3.5, 0], [0.3, 4.6, 0.5], 0.08, 0.06, { color: '#3a3a3c', to: 'metal' }),
      part(new THREE.SphereGeometry(0.16, 8, 6), { at: [0.3, 4.65, 0.52], color: '#c83a2a', to: 'paint' }),
    ];
    for (let i = 0; i < 4; i++) P.push(part(new THREE.BoxGeometry(0.16, 0.1, 0.02), { at: [-0.5 + i * 0.25, 3.15, 0.6], color: hot(i % 2 ? '#ffcc4a' : '#4aff8a', 2.4), to: 'glow' }));
    // the cable, run out across the ground
    P.push(rod([0, 0.3, -1.2], [-3, 0.1, -6], 0.08, 0.08, { color: '#1a1a1a', to: 'dark' }));
    return { object: k.build(P, { name: 'masterswitch' }), solids: [{ circle: [0, 0, 1] }, { circle: [0, 0, 3.2], top: 0.5 }] };
  },

  // an Imperial bunker on the beach: a low block, sloped, slit windows,
  // a hazard stripe across its door
  bunker(k, { w = 14, d = 10 } = {}) {
    const P = [
      part(loft([
        { z: -d / 2, pts: trap8(w, w * 0.8, 5, 0.6, 2.5) },
        { z: d / 2, pts: trap8(w, w * 0.8, 5, 0.6, 2.5) },
      ]), { color: '#9a9a96', to: 'paint' }),
      part(box(w * 0.82, 0.6, d * 0.9), { at: [0, 5, 0], color: '#7a7a76', to: 'paint' }),
      part(box(4, 3.4, 0.4), { at: [0, 0, d / 2], color: '#2a2c2e', to: 'dark' }),
      part(new THREE.BoxGeometry(4.6, 0.4, 0.45), { at: [0, 3.6, d / 2], color: '#d8a83a', to: 'paint' }),
      part(new THREE.BoxGeometry(w * 0.6, 0.4, 0.2), { at: [0, 4.0, d / 2 - 0.02], color: hot('#ffe6b0', 1.2), to: 'glow' }),
    ];
    return { object: k.build(P, { name: 'bunker' }), solids: [{ box: [0, 0, w / 2, d / 2, 0] }] };
  },

  // the Death Star, high over the sea: grey, its dish, its trench; out of
  // the fog (it's that far away)
  ds1sky(k, { r = 900 } = {}) {
    const P = [
      part(new THREE.SphereGeometry(r, 48, 32), { color: '#8a8c90', to: 'paint' }),
      part(new THREE.TorusGeometry(r * 1.0, r * 0.012, 6, 64).rotateX(PI / 2), { color: '#4a4c50', to: 'paint' }),
    ];
    const dish = new THREE.Group();
    const mat = k.own(k.mats.paint.clone());
    mat.fog = false;
    const mesh = new THREE.Mesh(k.geometry(P), mat);
    const crater = new THREE.Mesh(k.geometry([part(new THREE.SphereGeometry(r * 0.26, 24, 12, 0, PI * 2, 0, PI * 0.5), { color: '#5a5c60', to: 'paint' })]), mat);
    // the dish, up in the northern half, facing out (+z)
    const dir = new THREE.Vector3(0.35, 0.45, 1).normalize();
    crater.position.copy(dir).multiplyScalar(r * 0.99);
    crater.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    dish.add(mesh, crater);
    return { object: dish };
  },

};

// Things scattered by the dozen (drawn instanced)
export const SCATTER = {
  // Scarif's palms (12 m), by the hundred
  palm(k, opts = {}) {
    const p = palmParts(opts);
    return {
      parts: [
        { geometry: k.geometry(p.trunk), material: k.mats.bark },
        { geometry: k.geometry(p.leaves), material: k.mats.leaf },
      ],
      radius: 0.35,
    };
  },
  // columns of basalt, a cluster of hexagons of different heights
  basalt(k, { color = BASALT, seed = 3 } = {}) {
    const r = rand(seed);
    const P = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const d = i ? 0.55 + r() * 0.2 : 0;
      const h = 0.8 + r() * 2.2;
      P.push(part(cyl(0.32, 0.3, h, 6), { at: [cos(a) * d, 0, sin(a) * d], rot: [0, r() * 0.5, 0], color: shade(color, (r() - 0.5) * 0.05), to: 'stone' }));
    }
    return { parts: [{ geometry: k.geometry(P), material: k.mats.stone }], radius: 0.9 };
  },
  // a jagged spire of black rock
  spire(k, { color = '#221e1e', seed = 5, sharp = 0.9 } = {}) {
    const g = rockGeometry(seed, { sharp, detail: 1, flat: 0.9 });
    return { parts: [{ geometry: k.geometry([part(g, { scale: [1, 3.6, 1], color, to: 'stone' })]), material: k.mats.stone }], radius: 0.42 };
  },
};

// a seeded random for a builder's own variety
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// a palm frond: a spine arching out along +x and drooping, its leaflets
// either side in a shallow V (a strip of triangles), `len` long
function frond(len = 5, w = 0.8, lift = 0.55, droop = 0.95, n = 9) {
  const pos = [];
  const spine = (s) => [s * len, len * (lift * s - droop * s * s), 0];
  const wide = (s) => w * Math.sin(PI * Math.min(1, s * 1.1 + 0.05));
  const edge = (s, side) => {
    const [x, y] = spine(s);
    return [x - wide(s) * 0.25, y - wide(s) * 0.4, side * wide(s)];
  };
  for (let i = 0; i < n; i++) {
    const s0 = i / n;
    const s1 = (i + 1) / n;
    const a = spine(s0);
    const b = spine(s1);
    for (const side of [-1, 1]) pos.push(...a, ...edge(s0, side), ...edge(s1, side), ...a, ...edge(s1, side), ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// a palm's parts: the trunk (bark) leaning over, the fronds (leaf)
function palmParts({ h = 11.5, lean = 1.8, seed = 7, color = '#4e7a34' } = {}) {
  const r = rand(seed);
  const at = (t) => [lean * t * t, h * t, 0];
  const trunk = [part(new THREE.SphereGeometry(0.42, 10, 6), { at: [0, 0.2, 0], scale: [1, 0.8, 1], color: '#7a6448', to: 'bark' })];
  for (let i = 0; i < 6; i++) trunk.push(rod(at(i / 6), at((i + 1) / 6), 0.3 - i * 0.02, 0.28 - i * 0.02, { color: shade('#8a7254', (i % 2) * 0.04), to: 'bark' }));
  const top = at(1);
  for (let i = 0; i < 4; i++) trunk.push(part(new THREE.SphereGeometry(0.2, 8, 6), { at: [top[0] + cos(i * 1.7) * 0.32, top[1] - 0.35, sin(i * 1.7) * 0.32], color: '#5a4426', to: 'bark' }));
  const leaves = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * PI * 2 + r() * 0.3;
    const len = 4.2 + r() * 1.6;
    const g = frond(len, 0.75 + r() * 0.2, 0.45 + r() * 0.35, 0.9 + r() * 0.3);
    leaves.push(part(g, { at: top, rot: [0, a, 0], color: shade(color, (r() - 0.5) * 0.08), to: 'leaf' }));
  }
  return { trunk, leaves };
}
