// The planets' buildings and places, built in code where there's no model
// (galaxy/surface/props/index.js has what a builder gives): the women's
// city's walls and towers and the men's fighting pit on Gazorpazorp, Gear
// World's cog-faced towers and its oil canals, Pluto's mine mouths and the
// king's rally stage, the snakes' domes, tunnels and launch gantry, the
// Purge Planet's huts and lighthouse, and Cronenberg World's broken houses
// and dead trees. In metres, standing on y = 0, facing +z.

import * as THREE from 'three';
import { ball, box, cyl, dome, part, ring, rockGeometry } from '../../../galaxy/surface/kit';
import { rng } from '../../../galaxy/surface/noise';

const { PI, cos, sin } = Math;
const lit = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);

// a cog's face, lying in the xy plane facing +z: a disc, its teeth, its hub
function cogParts(r, { at = [0, 0, 0], color = '#b8892e', hub = '#5a4a2a', teeth = 12, depth = 0.4 } = {}) {
  const parts = [part(new THREE.CylinderGeometry(r, r, depth, 24).rotateX(PI / 2), { at, color, to: 'metal' })];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * PI * 2;
    parts.push(part(new THREE.BoxGeometry(r * 0.22, r * 0.22, depth), { at: [at[0] + cos(a) * r * 1.06, at[1] + sin(a) * r * 1.06, at[2]], rot: [0, 0, a], color, to: 'metal' }));
  }
  parts.push(part(new THREE.CylinderGeometry(r * 0.3, r * 0.3, depth * 1.4, 12).rotateX(PI / 2), { at, color: hub, to: 'metal' }));
  return parts;
}

export const PROPS = {
  // a length of the women's city wall: pink-grey stone, buttressed, a
  // walk along its top behind a parapet (`len` metres along x)
  womenswall(k, { len = 24, h = 9 } = {}) {
    const stone = '#c8a0a0';
    const parts = [part(box(len, h, 2.4), { color: stone, to: 'stone' })];
    parts.push(part(box(len, 1.1, 0.5), { at: [0, h, 1], color: stone, to: 'stone' }));
    const n = Math.max(1, Math.round(len / 8));
    // (its buttresses inside its ends, so lengths of it meet flush)
    for (let i = 0; i <= n; i++) parts.push(part(box(1.4, h * 0.85, 1.2), { at: [-len / 2 + 0.7 + (i / n) * (len - 1.4), 0, 1.6], color: '#a88080', to: 'stone' }));
    return { object: k.build(parts, { name: 'womenswall' }), solids: [{ box: [0, 0.6, len / 2, 1.8] }] };
  },

  // a tower of the city wall: round, tapering, a pink-lit window ring and a
  // pointed roof
  womenstower(k, { h = 16 } = {}) {
    const parts = [part(cyl(3.6, 3, h), { color: '#c8a0a0', to: 'stone' })];
    parts.push(part(ring(3.1, 0.25), { at: [0, h * 0.75, 0], color: lit('#ff8ac8', 1.6), to: 'glow' }));
    parts.push(part(new THREE.ConeGeometry(3.8, 5, 16).translate(0, 2.5, 0), { at: [0, h, 0], color: '#8a4a6a', to: 'paint' }));
    return { object: k.build(parts, { name: 'womenstower' }), solids: [{ circle: [0, 0, 3.6] }] };
  },

  // the pit where the men fight: a ring of standing boulders round a hollow
  // of trampled sand, bones at its edge
  fightpit(k, { r = 12, seed = 3 } = {}) {
    const rand = rng(seed);
    const parts = [part(new THREE.CircleGeometry(r, 32).rotateX(-PI / 2), { at: [0, 0.03, 0], color: '#a84a30', to: 'sand' })];
    const solids = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      // (a gap on its south side: the way in)
      if (i === 0) continue;
      const a = (i / n) * PI * 2 + PI / 2;
      const s = 1.4 + rand() * 1.2;
      const x = cos(a) * (r + 1);
      const z = sin(a) * (r + 1);
      parts.push(part(rockGeometry(seed + i, { sharp: 0.5, flat: 0.3 }).scale(s, s * 1.6, s), { at: [x, s * 0.6, z], color: '#8a3a2a', to: 'rock' }));
      solids.push({ circle: [x, z, s * 0.9] });
    }
    for (let i = 0; i < 6; i++) parts.push(part(cyl(0.05, 0.05, 0.7, 6), { at: [cos(i * 1.1) * (r - 1), 0.05, sin(i * 1.1) * (r - 1)], rot: [0, i, PI / 2], color: '#e8e0c8', to: 'paint' }));
    return { object: k.build(parts, { name: 'fightpit' }), solids };
  },

  // a Gear World tower: a brass block with a great cog for a face, turning
  cogtower(k, { h = 24, seed = 2 } = {}) {
    const w = Math.max(8, h * 0.4);
    const base = k.build([part(box(w, h, w), { color: '#8a6a3a', to: 'metal' }), part(box(w * 1.1, 0.8, w * 1.1), { at: [0, h, 0], color: '#5a4a2a', to: 'metal' })], { name: 'cogtower' });
    const cog = k.build(cogParts(w * 0.38, { teeth: 10 + (seed % 4) }), { name: 'cogtower-cog' });
    cog.position.set(0, h * 0.62, w / 2 + 0.25);
    const object = new THREE.Group();
    object.add(base, cog);
    const turn = seed % 2 ? 1 : -1;
    return { object, solids: [{ box: [0, 0, w / 2, w / 2] }], update: (t, dt) => (cog.rotation.z += (dt ?? 0) * 0.2 * turn) };
  },

  // an oil canal: a sunk trough of black oil between brass kerbs (`len`
  // along z); you can wade into it (the site's water is the oil)
  oilcanal(k, { len = 40, w = 6 } = {}) {
    const parts = [part(box(w, 0.05, len), { at: [0, -0.4, 0], color: '#14100a', to: 'dark' })];
    for (const x of [-w / 2, w / 2]) parts.push(part(box(0.5, 0.4, len), { at: [x, 0, 0], color: '#8a6a3a', to: 'metal' }));
    return { object: k.build(parts, { name: 'oilcanal' }) };
  },

  // a plutonium mine's mouth on Pluto: a timbered adit into a mound of
  // grey ice-rock, a green glow from inside, a cart on its rails
  minemouth(k) {
    const parts = [part(dome(9, 6, 16), { color: '#8a94a8', to: 'rock' })];
    parts.push(part(box(4.2, 4.2, 1), { at: [0, 0, 8.4], color: '#1a1c20', to: 'dark' }));
    for (const x of [-2.2, 2.2]) parts.push(part(box(0.5, 4.6, 0.5), { at: [x, 0, 8.9], color: '#6a4a2a', to: 'wood' }));
    parts.push(part(box(5, 0.6, 0.6), { at: [0, 4.4, 8.9], color: '#6a4a2a', to: 'wood' }));
    parts.push(part(box(3.6, 1.2, 0.2), { at: [0, 0.2, 8.95], color: lit('#7aff6a', 1.4), to: 'glow' }));
    for (const x of [-0.6, 0.6]) parts.push(part(box(0.1, 0.08, 8), { at: [x, 0, 13], color: '#5a5a58', to: 'metal' }));
    parts.push(part(box(1.4, 0.9, 1.8), { at: [0, 0.3, 12], color: '#6a6a70', to: 'metal' }));
    return { object: k.build(parts, { name: 'minemouth' }), solids: [{ circle: [0, 0, 8.4] }, { box: [0, 12, 0.8, 1] }] };
  },

  // King Flippy Nips' rally stage: a raised platform, steps up its front, a
  // lectern, Pluto's banner on two poles behind
  rallystage(k, { w = 14, d = 8 } = {}) {
    const top = 1.5;
    const parts = [part(box(w, top, d), { color: '#3a4a6a', to: 'deck' })];
    for (let i = 0; i < 3; i++) parts.push(part(box(4, (top / 3) * (i + 1), 0.6), { at: [0, 0, d / 2 + 1.5 - i * 0.6], color: '#2a3a5a', to: 'deck' }));
    parts.push(part(box(1, 1.2, 0.6), { at: [0, top, d / 2 - 1.2], color: '#c8a050', to: 'wood' }));
    for (const x of [-w / 2 + 1, w / 2 - 1]) parts.push(part(cyl(0.12, 0.12, 7, 8), { at: [x, top, -d / 2 + 0.5], color: '#c8c8d0', to: 'metal' }));
    parts.push(part(box(w - 2, 3, 0.08), { at: [0, top + 3.6, -d / 2 + 0.5], color: '#d84a4a', to: 'cloth' }));
    parts.push(ball(0.9, [0, top + 5.1, -d / 2 + 0.45], [1, 1, 0.1], { color: '#e8eef8', to: 'paint' }, 16));
    return {
      object: k.build(parts, { name: 'rallystage' }),
      solids: [{ box: [0, 0, w / 2, d / 2], top }],
      floors: [{ x: 0, z: 0, hw: w / 2, hd: d / 2, yaw: 0, y: top }],
    };
  },

  // a snake dome: a squat green dome, its door a low round hole (snakes
  // have no use for a tall one), scales painted in rings
  snakedome(k, { r = 7 } = {}) {
    const parts = [part(dome(r, r * 0.7, 20), { color: '#5a8a3a', to: 'paint' })];
    for (let i = 1; i < 4; i++) parts.push(part(ring(r * cos((i / 4) * (PI / 2)) * 1.005, 0.12), { at: [0, r * 0.7 * sin((i / 4) * (PI / 2)), 0], color: '#3a5a2a', to: 'paint' }));
    parts.push(part(new THREE.CircleGeometry(1.1, 16), { at: [0, 1, r * 0.97], color: '#101808', to: 'dark' }));
    return { object: k.build(parts, { name: 'snakedome' }), solids: [{ circle: [0, 0, r] }] };
  },

  // the mouth of a snake tunnel: a low arch of packed earth into a bank
  snaketunnel(k) {
    const parts = [part(dome(4.5, 2.8, 14), { color: '#6a5a3a', to: 'mud' })];
    parts.push(part(new THREE.TorusGeometry(1.3, 0.35, 8, 16, PI), { at: [0, 0, 4.1], color: '#4a3a22', to: 'mud' }));
    parts.push(part(new THREE.CircleGeometry(1.2, 16, 0, PI), { at: [0, 0.01, 4.2], color: '#0a0806', to: 'dark' }));
    return { object: k.build(parts, { name: 'snaketunnel' }), solids: [{ circle: [0, 0, 4] }] };
  },

  // the snakes' launch gantry: a red lattice tower and its arm; the
  // rocket (a model) stands in it, beside, as the site puts it
  launchgantry(k, { h = 16 } = {}) {
    const red = '#c84a2a';
    const parts = [];
    for (const [x, z] of [
      [-1.5, -1.5],
      [1.5, -1.5],
      [-1.5, 1.5],
      [1.5, 1.5],
    ])
      parts.push(part(box(0.3, h, 0.3), { at: [x, 0, z], color: red, to: 'metal' }));
    for (let y = 2; y < h; y += 2.5) {
      parts.push(part(box(3.3, 0.18, 0.18), { at: [0, y, -1.5], color: red, to: 'metal' }), part(box(3.3, 0.18, 0.18), { at: [0, y, 1.5], color: red, to: 'metal' }));
      parts.push(part(box(0.18, 0.18, 3.3), { at: [-1.5, y, 0], color: red, to: 'metal' }), part(box(0.18, 0.18, 3.3), { at: [1.5, y, 0], color: red, to: 'metal' }));
    }
    parts.push(part(box(5, 0.4, 0.6), { at: [4, h * 0.7, 0], color: red, to: 'metal' }));
    parts.push(part(box(10, 0.3, 10), { at: [3, 0, 0], color: '#6a6a6a', to: 'concrete' }));
    parts.push(ball(0.25, [0, h + 0.2, 0], 1, { color: lit('#ff4030', 2.5), to: 'glow' }, 8));
    return { object: k.build(parts, { name: 'launchgantry' }), solids: [{ box: [0, 0, 1.7, 1.7] }] };
  },

  // a hut of the Purge Planet's village: plank walls, a thatched roof, a
  // lamp in its window. `burnt`: blackened and roofless, the lamp out; a
  // standing one burns when its quest signals `burn-<i>`
  hut(k, { burnt = false, i = 0 } = {}) {
    const hutParts = (ash) => {
      const wall = ash ? '#2a2420' : '#8a6a4a';
      const parts = [part(box(5, 3, 4), { color: wall, to: 'wood' })];
      if (!ash) {
        parts.push(part(new THREE.ConeGeometry(4.2, 2.6, 4).rotateY(PI / 4).translate(0, 1.3, 0), { at: [0, 3, 0], scale: [1.05, 1, 0.85], color: '#c8a860', to: 'wood' }));
        parts.push(part(box(0.9, 0.8, 0.08), { at: [1.3, 1.4, 2.02], color: lit('#ffb050', 1.6), to: 'glow' }));
      } else for (const x of [-2, 0.4, 2]) parts.push(part(box(0.25, 1.4, 0.25), { at: [x, 3, 1.8], rot: [0.3, 0, x * 0.1], color: '#141010', to: 'dark' }));
      parts.push(part(box(1, 2, 0.1), { at: [-1, 0, 2.02], color: ash ? '#141010' : '#5a3a22', to: 'wood' }));
      return parts;
    };
    const solids = [{ box: [0, 0, 2.5, 2] }];
    if (burnt) return { object: k.build(hutParts(true), { name: 'hut-burnt' }), solids };
    const standing = k.build(hutParts(false), { name: 'hut' });
    const ash = k.build(hutParts(true), { name: 'hut-burnt' });
    ash.visible = false;
    const object = new THREE.Group();
    object.add(standing, ash);
    return {
      object,
      solids,
      signal(name, on = true) {
        if (name !== `burn-${i}`) return;
        standing.visible = !on;
        ash.visible = on;
      },
    };
  },

  // the village's lighthouse on its point: white and red bands, its lamp
  // turning
  lighthouse(k, { h = 22 } = {}) {
    const parts = [];
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      const r0 = 3.2 - (b / bands) * 1.2;
      const r1 = 3.2 - ((b + 1) / bands) * 1.2;
      parts.push(part(cyl(r0, r1, h / bands, 16), { at: [0, (b * h) / bands, 0], color: b % 2 ? '#c83a2a' : '#f0ece0', to: 'paint' }));
    }
    parts.push(part(cyl(2.4, 2.4, 0.3, 16), { at: [0, h, 0], color: '#2a2a2a', to: 'metal' }));
    parts.push(part(cyl(1.2, 1.2, 2, 12), { at: [0, h + 0.3, 0], color: '#a8c0c8', to: 'glass' }));
    parts.push(part(new THREE.ConeGeometry(1.6, 1.4, 12).translate(0, 0.7, 0), { at: [0, h + 2.3, 0], color: '#2a2a2a', to: 'metal' }));
    const tower = k.build(parts, { name: 'lighthouse' });
    const beam = k.build([part(box(0.5, 0.5, 1.6), { at: [0, -0.25, 0.4], color: lit('#fff0c0', 3), to: 'glow' })], { name: 'lighthouse-lamp' });
    beam.position.y = h + 1.3;
    const object = new THREE.Group();
    object.add(tower, beam);
    return { object, solids: [{ circle: [0, 0, 3.2] }], update: (t) => (beam.rotation.y = t * 0.9) };
  },

  // a house of the suburb the Cronenbergs took: its roof caved in on one
  // side, a wall gone, the frame showing. `look`: colonial (two storeys,
  // white), ranch (one long storey, tan) or diner (chrome and red)
  brokenhouse(k, { look = 'colonial', seed = 5 } = {}) {
    const rand = rng(seed);
    const L = { colonial: { w: 10, h: 6, d: 8, wall: '#e8e0d0', roof: '#4a4a52' }, ranch: { w: 14, h: 3.4, d: 8, wall: '#c8a878', roof: '#6a4a3a' }, diner: { w: 12, h: 3.6, d: 6, wall: '#c8c8d0', roof: '#c83a3a' } }[look] ?? { w: 10, h: 6, d: 8, wall: '#e8e0d0', roof: '#4a4a52' };
    const { w, h, d } = L;
    // (three walls of four standing: the front's gone on the left)
    const parts = [part(box(w, h, 0.3), { at: [0, 0, -d / 2], color: L.wall, to: 'wood' }), part(box(0.3, h, d), { at: [w / 2, 0, 0], color: L.wall, to: 'wood' }), part(box(0.3, h * 0.6, d), { at: [-w / 2, 0, 0], color: L.wall, to: 'wood' })];
    parts.push(part(box(w * 0.45, h, 0.3), { at: [w * 0.27, 0, d / 2], color: L.wall, to: 'wood' }));
    // the roof: one slope whole, the other fallen in
    parts.push(part(box(w + 0.6, 0.25, d * 0.6), { at: [0, h + d * 0.18, -d * 0.2], rot: [0.5, 0, 0], color: L.roof, to: 'paint' }));
    parts.push(part(box(w * 0.6, 0.25, d * 0.5), { at: [w * 0.15, h * 0.55, d * 0.15], rot: [-0.9, 0.2, 0.3], color: L.roof, to: 'paint' }));
    // the frame where the wall was, studs broken off
    for (let x = -w / 2 + 0.6; x < 0; x += 1.2) parts.push(part(box(0.15, h * (0.3 + rand() * 0.6), 0.15), { at: [x, 0, d / 2], color: '#8a6a4a', to: 'wood' }));
    if (look === 'diner') parts.push(part(box(w, 0.4, 0.4), { at: [0, h * 0.8, d / 2 + 0.2], color: '#e8e8f0', to: 'metal' }));
    // (fleshy growth over the rubble: the Cronenberging got in)
    for (let i = 0; i < 4; i++) parts.push(ball(0.6 + rand() * 0.8, [-w / 4 + rand() * 2, 0.3, d / 2 - rand() * 3], [1, 0.6, 1], { color: '#c87a7a', to: 'paint' }, 10));
    return { object: k.build(parts, { name: 'brokenhouse' }), solids: [{ box: [0, 0, w / 2, d / 2] }] };
  },

  // a dead tree: a grey trunk, a few bare limbs reaching
  deadtree(k, { h = 7, seed = 9 } = {}) {
    const rand = rng(seed);
    const parts = [part(cyl(0.35, 0.18, h, 8), { color: '#5a524a', to: 'bark' })];
    for (let i = 0; i < 5; i++) {
      const y = h * (0.4 + rand() * 0.5);
      const a = rand() * PI * 2;
      const len = 1.5 + rand() * 2;
      parts.push(part(cyl(0.12, 0.04, len, 6), { at: [0, y, 0], rot: [0, a, 0.7 + rand() * 0.5], color: '#5a524a', to: 'bark' }));
    }
    return { object: k.build(parts, { name: 'deadtree' }), solids: [{ circle: [0, 0, 0.4] }] };
  },
};
