// Down on Middle-earth's planet: the Shire, on the day of Bilbo's party.
// Everything here is the Shire world's own (middleearth/shire/props.js's
// kit: Bag End and the hobbit holes, the Party Tree, the Green Dragon, the
// oaks, flowers and sheep), stood about where the ship comes down. Come
// down elsewhere on Tolkien's map (landings.js's biomes) and it's Mordor's
// ash, with Orodruin and Barad-dûr on the skyline and the ground split
// with fire; Harad's sand and thorn; the mountains' rock; or the old forest.

import * as THREE from 'three';
import { createShireKit } from '../../middleearth/shire/props';
import { tuftGeometry } from '../../cybertron/rollout/flora';
import { makeGandalf, makeHobbit } from '../../middleearth/kit';
import { cyl, part, rockGeometry, upright } from '../../galaxy/surface/kit';
import { SCATTER as GENERIC } from '../../galaxy/surface/props/generic';
import { rng } from '../../galaxy/surface/noise';

const { PI, cos, sin } = Math;

// the Shire's kit, made once a landing (its textures want the renderer)
export function prepare(k) {
  k.shire = createShireKit(k.renderer ?? { capabilities: { getMaxAnisotropy: () => 4 } });
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
    const parts = [
      part(upright([[70, -2], [64, 6], [52, 16], [40, 22], [34, 24], [0, 24]], 40), { color: '#302724', to: 'rock' }),
      part(upright([[34, 22], [27, 40], [19, 70], [12, 96], [9, 104], [6, 101], [0, 99]], 36), { color: '#2a2321', to: 'rock' }),
      // the crater's fire, and the glow at the Sammath Naur's door on its side
      part(new THREE.CircleGeometry(6.5, 24).rotateX(-PI / 2), { at: [0, 100.5, 0], color: '#ff6a1a', to: 'glow' }),
      part(new THREE.SphereGeometry(1.6, 10, 8), { at: [0, 74, -15.5], scale: [1.6, 1, 0.6], color: '#ff8a2a', to: 'glow' }),
    ];
    // fire down the flanks: each a run of glowing pieces following the slope
    // (the cone's radius at a height, from its profile)
    const radiusAt = (y) => (y > 70 ? 19 - ((y - 70) / 26) * 7 : y > 40 ? 27 - ((y - 40) / 30) * 8 : 34 - ((y - 22) / 18) * 7);
    for (let i = 0; i < 7; i++) {
      const a = rand() * PI * 2;
      let y = 96 - rand() * 8;
      for (let j = 0; j < 10 && y > 26; j++) {
        const drop = 6 + rand() * 4;
        const r1 = radiusAt(y);
        const r2 = radiusAt(Math.max(24, y - drop));
        const tilt = Math.atan2(r2 - r1, drop);
        const g = new THREE.BoxGeometry(0.9 + j * 0.12, Math.hypot(drop, r2 - r1), 0.5).rotateZ(tilt).rotateY(-a);
        parts.push(part(g, { at: [cos(a) * ((r1 + r2) / 2 + 0.3), y - drop / 2, sin(a) * ((r1 + r2) / 2 + 0.3)], color: j < 3 ? '#ffb040' : '#ff5a14', to: 'glow' }));
        y -= drop;
      }
    }
    // slag boulders round its foot
    for (let i = 0; i < 16; i++) {
      const a = rand() * PI * 2;
      const d = 60 + rand() * 14;
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
    return { object: made.group, solids: [{ circle: [0, 0, made.trunkRadius ?? 1] }] };
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
  gandalf() {
    const made = makeGandalf();
    made.group.rotation.y = Math.PI / 2; // (made facing −x)
    if (made.light) made.light.intensity = 2; // (a glow at the staff's head, by day: furnish brings it to scale)
    const object = new THREE.Group();
    object.add(made.group);
    return { object, solids: [{ circle: [0, 0, 0.4] }] };
  },
  // a hobbit in a cloak (Sam with his pack)
  hobbit(k, { cloak = '#4b5a3a', pack = false } = {}) {
    const made = makeHobbit({ cloak: new THREE.Color(cloak).getHex(), pack });
    made.group.rotation.y = -Math.PI / 2; // (made facing +x)
    const object = new THREE.Group();
    object.add(made.group);
    return { object, solids: [{ circle: [0, 0, 0.3] }] };
  },
};

const FLOWER_COLOURS = [0xf2d24a, 0xe8655a, 0xf3f0e8, 0xb07ad8, 0xf29ac2, 0xf08a3a, 0x7ab0f0];

export const SCATTER = {
  rock: GENERIC.rock,
  stones: GENERIC.stones,
  // Mordor's embers, glowing in the ash
  embers(k) {
    const g = new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.5, 1).translate(0, 0.02, 0);
    return { parts: [{ geometry: k.geometry([part(g, { color: '#ff7a24', to: 'glow' })]), material: k.mats.glow }], radius: null, tints: ['#ff7a24', '#ff5014', '#ffb048'] };
  },
  // Harad's thorn: a low dry bush, grey-green and straw
  scrub(k, { seed = 6 } = {}) {
    const rand = rng(seed);
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const a = rand() * PI * 2;
      const d = rand() * 0.3;
      parts.push(part(new THREE.IcosahedronGeometry(0.22 + rand() * 0.1, 0), { at: [cos(a) * d, 0.2 + rand() * 0.25, sin(a) * d], scale: [1, 0.7, 1], color: rand() < 0.5 ? '#8a7e4e' : '#6e6a44', to: 'leaf' }));
    }
    return { parts: [{ geometry: k.geometry(parts), material: k.mats.leaf }], radius: null };
  },
  // the Shire's three oaks, one of them (by seed)
  oak(k, { which = 1 } = {}) {
    const oaks = (k.oaks ??= k.shire.oaks());
    const oak = oaks[which % oaks.length];
    return {
      parts: [
        { geometry: oak.trunk, material: k.shire.mats.trunk },
        { geometry: oak.crown, material: k.shire.mats.crown },
      ],
      radius: 0.6,
    };
  },
  flowers(k) {
    return { parts: [{ geometry: k.shire.flower, material: k.shire.mats.flower }], radius: null, tints: FLOWER_COLOURS };
  },
  mushroom(k) {
    const made = k.shire.mushroom();
    made.group.updateMatrixWorld(true);
    const parts = [];
    made.group.traverse((o) => o.isMesh && parts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() }));
    return { parts, radius: null };
  },
  // tufts of long grass, green at the root, gold at the tip
  tufts(k) {
    const geometry = k.own(tuftGeometry({ blades: 12, height: 0.5, width: 0.05, seed: 5 }));
    const h = geometry.attributes.aH;
    const col = new Float32Array(h.count * 3);
    const root = new THREE.Color('#3f6a22');
    const tip = new THREE.Color('#b9c46a');
    const c = new THREE.Color();
    for (let i = 0; i < h.count; i++) c.copy(root).lerp(tip, h.getX(i)).toArray(col, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // (lit as the Shire's own grass is: no shine from space's reflections)
    const material = k.own(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    return { parts: [{ geometry, material }], radius: null };
  },
};
