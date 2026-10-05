// Down on Middle-earth's planet: the Shire, on the day of Bilbo's party.
// Everything here is the Shire world's own (middleearth/shire/props.js's
// kit: Bag End and the hobbit holes, the Party Tree, the Green Dragon, the
// oaks, flowers and sheep), stood about where the ship comes down.

import * as THREE from 'three';
import { createShireKit } from '../../middleearth/shire/props';
import { tuftGeometry } from '../../cybertron/rollout/flora';

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
};

const FLOWER_COLOURS = [0xf2d24a, 0xe8655a, 0xf3f0e8, 0xb07ad8, 0xf29ac2, 0xf08a3a, 0x7ab0f0];

export const SCATTER = {
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
