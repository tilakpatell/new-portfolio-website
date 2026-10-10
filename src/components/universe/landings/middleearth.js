// Down on Middle-earth's planet: the Shire, on the day of Bilbo's party.
// Its landmarks are the Shire world's own (middleearth/shire/props.js's
// kit: Bag End and the hobbit holes, the Party Tree, the Green Dragon, the
// cart, the hives and the sheep), stood about where the ship comes down;
// the oaks, hedges, flowers, mushrooms and grass round them, and the
// rocks and woods elsewhere, are Quaternius's (landings.js names them). Come
// down elsewhere on Tolkien's map (landings.js's biomes) and it's Mordor's
// ash, with Orodruin and Barad-dûr on the skyline and the ground split
// with fire; Harad's sand and thorn; the mountains' rock; or the old forest.

import * as THREE from 'three';
import { createShireKit } from '../../middleearth/shire/props';
import { makeGandalf, makeHobbit } from '../../middleearth/kit';
import { faceStep } from './face';
import { cyl, part, rockGeometry, upright } from '../../galaxy/surface/kit';
import { SCATTER as GENERIC } from '../../galaxy/surface/props/generic';
import { rng } from '../../galaxy/surface/noise';

const { PI, cos, sin } = Math;

// the Shire's kit (its textures want the renderer), made once for the page:
// its eighteen pictures are painted a pixel at a time, a second or more of
// the landing, and the same every time. A lift-off frees what the things
// drew with, the kit's materials and pictures too (furnish's release), and
// the next landing sends them to the graphics chip again as it readies
// itself, which is quick beside the painting.
let shire = null;
export function prepare(k) {
  shire ??= createShireKit(k.renderer ?? { capabilities: { getMaxAnisotropy: () => 4 } });
  k.shire = shire;
}

// a Shire builder's colliders ({ x, z, r }) as a landing's solids
const solidsOf = (made, fallback = 0) => (made.colliders?.length ? made.colliders.map((c) => ({ circle: [c.x, c.z, c.r] })) : fallback ? [{ circle: [0, 0, fallback] }] : []);
const small = (fn, r) => (k, o) => {
  const made = fn(k.shire, o);
  return { object: made.group, solids: r ? [{ circle: [0, 0, r] }] : [] };
};

export const PROPS = {
  // Orodruin, the Mountain of Fire: a broad heap of ash and slag, and on it
  // the great cone, its top broken and red, fire running down its flanks
  // (metres, brought down to fit the skyline: the real one is 1,350)
  orodruin(k, { seed = 3 } = {}) {
    const rand = rng(seed);
    // one profile from the ash plain to the broken rim, then roughened: ribs
    // and gullies down its sides, the rim jagged
    const PROFILE = [[82, -3], [72, 3], [60, 9], [48, 16], [39, 24], [32, 36], [26, 52], [20, 72], [15, 88], [11.5, 99], [9, 104]];
    const rough = (a, y) => 1 + 0.07 * sin(a * 9 + y * 0.09) + 0.045 * sin(a * 17 - y * 0.17 + seed) + 0.025 * sin(a * 37 + y * 0.31) + (y > 98 ? 0.12 * sin(a * 11 + seed) : 0);
    // (the cone's radius at a height, from its profile, before roughening)
    const radiusAt = (y) => {
      const i = PROFILE.findIndex(([, py]) => py >= y);
      if (i <= 0) return PROFILE[Math.max(0, i)][0];
      const [[r0, y0], [r1, y1]] = [PROFILE[i - 1], PROFILE[i]];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    };
    const cone = upright([...PROFILE, [7.5, 100], [0, 97]], 72);
    const pos = cone.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const k = rough(a, y);
      pos.setXYZ(i, x * k, y + (y > 98 ? 2.2 * sin(a * 7 + seed * 2) : 0), z * k);
    }
    cone.computeVertexNormals();
    // (a point on its side, a little out from it: the lava, the door's glow)
    const onSide = (a, y, out = 0.5) => [cos(a) * (radiusAt(y) * rough(a, y) + out), y, sin(a) * (radiusAt(y) * rough(a, y) + out)];
    const parts = [
      part(cone, { color: '#2c2422', to: 'rock' }),
      // the crater's fire, and the glow at the Sammath Naur's door on its side
      part(new THREE.CircleGeometry(6.5, 24).rotateX(-PI / 2), { at: [0, 100.5, 0], color: '#ff6a1a', to: 'glow' }),
      part(new THREE.SphereGeometry(1.6, 10, 8), { at: onSide(-PI / 2, 74, 0.2), scale: [1.6, 1, 0.6], color: '#ff8a2a', to: 'glow' }),
    ];
    // fire down the flanks: each a run of glowing pieces following the slope
    // (each run wanders round the cone a little as it goes down, thin, and
    // stops short where it's cooled; the newest are brightest at the top)
    const LAVA = ['#ffc050', '#ff8a24', '#ff5a14', '#d8380e', '#a8280a'];
    for (let i = 0; i < 6; i++) {
      let a = (i / 6) * PI * 2 + rand() * 0.8;
      let y = 97 - rand() * 6;
      const runs = 5 + Math.floor(rand() * 6);
      for (let j = 0; j < runs && y > 26; j++) {
        const drop = 4 + rand() * 3;
        const a2 = a + (rand() - 0.5) * 0.12;
        const [x1, , z1] = onSide(a, y);
        const [x2, , z2] = onSide(a2, Math.max(24, y - drop));
        const len = Math.hypot(x2 - x1, drop, z2 - z1);
        const g = new THREE.BoxGeometry(0.35 + rand() * 0.35 + j * 0.06, len, 0.3);
        // (stood along the segment from its top to its foot)
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x2 - x1, -drop, z2 - z1).normalize()));
        parts.push(part(g, { at: [(x1 + x2) / 2, y - drop / 2, (z1 + z2) / 2], color: LAVA[Math.min(LAVA.length - 1, Math.floor((j / runs) * LAVA.length))], to: 'glow' }));
        y -= drop;
        a = a2;
      }
    }
    // slag boulders round its foot
    for (let i = 0; i < 16; i++) {
      const a = rand() * PI * 2;
      const d = 80 + rand() * 16;
      parts.push(part(rockGeometry(seed * 20 + i, { sharp: 0.8 }), { at: [cos(a) * d, 0, sin(a) * d], scale: 3 + rand() * 6, color: '#241e1c', to: 'rock' }));
    }
    const object = k.build(parts, { name: 'orodruin' });
    const light = new THREE.PointLight('#ff5a1a', 6, 300, 1.4);
    light.position.set(0, 106, 0);
    object.add(light);
    return { object, solids: [] };
  },
  // Barad-dûr, the Dark Tower: black stone in steps, buttressed, rising to
  // two horns, and between them the Eye, lidless, wreathed in flame
  baradDur(k) {
    const stone = '#1c1817';
    const parts = [];
    let y = 0;
    for (const [w, h] of [
      [22, 24],
      [17, 40],
      [13, 34],
      [9.5, 30],
      [7, 22],
    ]) {
      parts.push(part(new THREE.CylinderGeometry(w * 0.86, w, h, 8).translate(0, h / 2, 0), { at: [0, y, 0], rot: [0, PI / 8, 0], color: stone, to: 'rock' }));
      // a buttress at each corner, a little taller than the tier
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 4;
        parts.push(part(cyl(w * 0.18, w * 0.08, h * 1.15), { at: [cos(a) * w * 0.95, y, sin(a) * w * 0.95], color: '#141110', to: 'rock' }));
      }
      y += h;
    }
    // the horns, curving in toward each other, and the Eye between them
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const g = new THREE.CylinderGeometry(2.2 * (1 - t * 0.8), 2.6 * (1 - t * 0.8), 7, 7).translate(0, 3.5, 0);
        parts.push(part(g, { at: [s * (5.5 - t * t * 3.2), y + i * 6, 0], rot: [0, 0, s * (0.08 + t * 0.35)], color: stone, to: 'rock' }));
      }
    }
    parts.push(part(new THREE.SphereGeometry(2.6, 16, 12), { at: [0, y + 18, 0], scale: [1, 1.9, 0.6], color: '#ff9a2a', to: 'glow' }));
    parts.push(part(new THREE.SphereGeometry(2.7, 12, 10), { at: [0, y + 18, 0.2], scale: [0.18, 1.7, 0.6], color: '#2a0800', to: 'glow' }));
    const object = k.build(parts, { name: 'barad-dur' });
    const light = new THREE.PointLight('#ff7a20', 4, 200, 1.5);
    light.position.set(0, y + 18, 6);
    object.add(light);
    return { object, solids: [] };
  },
  // a split in Gorgoroth's ash, fire showing at the bottom of it
  fissure(k, { seed = 2 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 1.1;
      const w = 0.25 + rand() * 0.35;
      parts.push(part(new THREE.PlaneGeometry(1.2, w).rotateX(-PI / 2), { at: [x, 0.04, (rand() - 0.5) * 0.4], rot: [0, (rand() - 0.5) * 0.5, 0], color: i % 2 ? '#ff6a1a' : '#ffa030', to: 'glow' }));
      parts.push(part(rockGeometry(seed * 9 + i, { sharp: 0.7 }), { at: [x, 0, w + 0.4], scale: 0.7 + rand() * 0.6, color: '#2a2321', to: 'rock' }));
      parts.push(part(rockGeometry(seed * 9 + i + 50, { sharp: 0.7 }), { at: [x, 0, -w - 0.4], scale: 0.7 + rand() * 0.6, color: '#2a2321', to: 'rock' }));
    }
    const object = k.build(parts, { name: 'fissure' });
    const light = new THREE.PointLight('#ff6a1a', 1.5, 9, 2);
    light.position.set(0, 0.6, 0);
    object.add(light);
    return { object, solids: [{ box: [0, 0, 3.4, 0.6] }] };
  },
  bagEnd(k) {
    const made = k.shire.bagEnd();
    return { object: made.group, solids: solidsOf(made, 6) };
  },
  hole(k, { door = '#2e6b3a', seed = 1, radius = 4 } = {}) {
    const made = k.shire.hobbitHole({ door: new THREE.Color(door).getHex(), seed, radius });
    return { object: made.group, solids: solidsOf(made, radius * 0.8) };
  },
  partyTree(k) {
    const made = k.shire.partyTree();
    // (its crown, for leaves to fall from: the clumps round 9.5 m up, 6.5 m out)
    return { object: made.group, solids: [{ circle: [0, 0, made.trunkRadius ?? 1] }], crowns: [{ at: [0, 0], r: 6, lo: 5, hi: 14 }] };
  },
  greenDragon(k) {
    const made = k.shire.greenDragon();
    const { w = 10, d = 7 } = made.footprint ?? {};
    return { object: made.group, solids: [{ box: [0, 0, w / 2, d / 2] }] };
  },
  signpost: (k, { lines } = {}) => ({ object: k.shire.signpost(lines).group, solids: [{ circle: [0, 0, 0.2] }] }),
  cart: small((s) => s.cart(), 1.2),
  sheep: small((s, o) => s.sheep(o), 0.5),
  hayBale: small((s) => s.hayBale(), 0.6),
  beehive: small((s) => s.beehive(), 0.35),
  barrel: small((s) => s.barrel(), 0.35),
  mailbox: small((s) => s.mailbox(), 0.15),
  scarecrow: small((s) => s.scarecrow(), 0.3),
  mushroom: small((s) => s.mushroom(), 0),
  // Gandalf by Bag End, his staff's light low (the Middle-earth pages' own figure)
  // (both breathe, and turn to you as you come up: people.js's faceStep)
  gandalf() {
    const made = makeGandalf();
    made.group.rotation.y = Math.PI / 2; // (made facing −x)
    if (made.light) made.light.intensity = 2; // (a glow at the staff's head, by day: furnish brings it to scale)
    return alive(made, 0.4, 0.7);
  },
  // a hobbit in a cloak (Sam with his pack)
  hobbit(k, { cloak = '#4b5a3a', pack = false } = {}) {
    const made = makeHobbit({ cloak: new THREE.Color(cloak).getHex(), pack });
    made.group.rotation.y = -Math.PI / 2; // (made facing +x)
    return alive(made, 0.3, 1.1);
  },
};

// a toy figure of the kit's, stood where it is: a breath on its body (its
// own pace, from its own moment), turned on the spot to face you
function alive(made, r, pace) {
  const object = new THREE.Group();
  const turn = new THREE.Group();
  turn.add(made.group);
  object.add(turn);
  const face = {};
  const phase = Math.random() * Math.PI * 2;
  return {
    object,
    solids: [{ circle: [0, 0, r] }],
    update(t, dt, ctx) {
      faceStep(face, object, turn, ctx, dt, { rate: 2.5 });
      const body = made.body ?? made.group.children[0];
      if (body) body.scale.y = 1 + 0.012 * Math.sin(t * pace * 2 + phase);
    },
  };
}

export const SCATTER = {
  // (the mountains' snow-capped boulders)
  rock: GENERIC.rock,
  // Mordor's embers, glowing in the ash
  embers(k) {
    const g = new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.5, 1).translate(0, 0.02, 0);
    return { parts: [{ geometry: k.geometry([part(g, { color: '#ff7a24', to: 'glow' })]), material: k.mats.glow }], radius: null, tints: ['#ff7a24', '#ff5014', '#ffb048'] };
  },
};
