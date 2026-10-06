// The wardrobe's gear: hats and headphones, shades, goggles and an eyepatch,
// and something in his hand. Built in code in the show's toon look (the
// portal gun is Bob.Ho's model, CC BY 4.0: scripts/sketchfab-gear.mjs, with
// a built one standing in until it loads), each in a frame of its own:
//
//   head gear  its origin on the crown, a head (chin to crown) a unit, +y up,
//              +z the way the face looks;
//   face gear  its origin between the eyes on the face, the same units;
//   hand gear  its origin in the grip, a unit long, its front −z, its top +y.
//
// wearGear(figure, look) works the frames out from the figure's own
// skeleton, in its bind pose (the Head bone, the crown's head_end, the
// face's headfront; the hand and the forearm it points from), and sets each
// piece on its bone, so it moves with every clip the figure plays.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon } from '../portal/toon';
import { GEAR, GEAR_SLOTS } from './looks';

// geometries placed by [geometry, position, rotation, scale], merged into one
function merged(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(m);
  });
  const out = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return out;
}
// a piece of gear: { colour: [[geometry, pos, rot, scale], …] } → a group of one mesh a colour
function piece(parts, glow = {}) {
  const g = new THREE.Group();
  for (const [color, list] of Object.entries(parts)) {
    const mat = glow[color] ? new THREE.MeshBasicMaterial({ color, toneMapped: false }) : toon(color);
    const mesh = new THREE.Mesh(merged(list), mat);
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}
const cyl = (r0, r1, h, seg = 32, open = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
const ball = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ALONG = [Math.PI / 2, 0, 0]; // (a cylinder along z)

const BUILD = {
  // ── on the head ──
  partyhat() {
    const pink = [];
    const yellow = [];
    const bands = 4;
    for (let i = 0; i < bands; i++) {
      const y0 = (i / bands) * 0.78;
      const y1 = ((i + 1) / bands) * 0.78;
      const r = (y) => 0.27 * (1 - y / 0.8);
      (i % 2 ? yellow : pink).push([cyl(r(y0), r(y1), y1 - y0, 32), [0, y0 + (y1 - y0) / 2, 0]]);
    }
    yellow.push([ball(0.075), [0, 0.8, 0]]);
    const g = piece({ '#ef5a9c': pink, '#f6d743': yellow });
    g.position.y = -0.12;
    g.rotation.set(-0.2, 0, 0.18);
    const holder = new THREE.Group();
    holder.add(g);
    return holder;
  },
  beanie() {
    return piece({
      '#3d8f86': [
        [ball(0.44, 32, 16), [0, -0.2, 0], [0, 0, 0], [1, 0.82, 1.06]],
        [ball(0.1), [0, 0.2, 0]],
      ],
      '#2f6f68': [[cyl(0.452, 0.452, 0.15, 40), [0, -0.27, 0], [0, 0, 0], [1, 1, 1.06]]],
    });
  },
  tophat() {
    return piece({
      '#1f1d26': [
        [cyl(0.25, 0.27, 0.52, 40), [0, 0.22, 0]],
        [cyl(0.44, 0.44, 0.03, 48), [0, -0.04, 0]],
      ],
      '#b8323b': [[cyl(0.256, 0.262, 0.09, 40), [0, 0.03, 0]]],
    });
  },
  crown() {
    const gold = [[cyl(0.3, 0.31, 0.15, 48, true), [0, 0.0, 0]]];
    const gems = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      gold.push([new THREE.ConeGeometry(0.05, 0.15, 12), [Math.sin(a) * 0.3, 0.14, Math.cos(a) * 0.3]]);
      gold.push([ball(0.025, 10, 8), [Math.sin(a) * 0.3, 0.22, Math.cos(a) * 0.3]]);
      if (i % 2 === 0) gems.push([ball(0.035, 12, 8), [Math.sin(a) * 0.31, 0.0, Math.cos(a) * 0.31]]);
    }
    const g = piece({ '#f2c14e': gold, '#c23a57': gems });
    g.position.y = -0.06;
    g.rotation.z = 0.12;
    const holder = new THREE.Group();
    holder.add(g);
    return holder;
  },
  headphones() {
    return piece(
      {
        '#2b2a33': [
          [new THREE.TorusGeometry(0.45, 0.035, 12, 48, Math.PI), [0, -0.42, 0]],
          ...[-1, 1].map((sx) => [cyl(0.15, 0.15, 0.11, 32), [sx * 0.46, -0.45, 0], [0, 0, Math.PI / 2]]),
        ],
        '#97ce4c': [-1, 1].map((sx) => [new THREE.TorusGeometry(0.11, 0.022, 10, 32), [sx * 0.52, -0.45, 0], [0, Math.PI / 2, 0]]),
      },
      {},
    );
  },
  // ── on the face (e: where the eyes are, in heads: spread either side, and their size) ──
  shades(e = EYES.rick) {
    const frame = [[box(e.spread * 0.7, 0.025, 0.03), [0, e.size * 0.3, 0.02]]];
    const lens = [];
    for (const sx of [-1, 1]) {
      lens.push([new THREE.CylinderGeometry(e.size * 1.25, e.size * 1.25, 0.03, 32), [sx * e.spread, 0, 0.03], [Math.PI / 2, 0, 0], [1.15, 1, 0.82]]);
      frame.push([box(0.025, 0.03, 0.42), [sx * Math.max(0.29, e.spread + e.size * 1.35), e.size * 0.3, -0.18]]);
    }
    return piece({ '#16141c': frame, '#27303a': lens });
  },
  goggles(e = EYES.rick) {
    const brass = [];
    const glass = [];
    const r = e.size * 1.2;
    for (const sx of [-1, 1]) {
      brass.push([cyl(r, r, 0.09, 28, true), [sx * e.spread, 0, 0.03], ALONG]);
      brass.push([new THREE.TorusGeometry(r, 0.018, 10, 28), [sx * e.spread, 0, 0.075]]);
      glass.push([new THREE.CircleGeometry(r * 0.94, 28), [sx * e.spread, 0, 0.07]]);
    }
    brass.push([box(Math.max(0.03, e.spread * 2 - r * 2), 0.03, 0.03), [0, 0.0, 0.05]]);
    const strap = [[new THREE.TorusGeometry(0.5, 0.03, 8, 48, Math.PI), [0, 0, -0.32], [Math.PI / 2, 0, Math.PI], [1, 1.05, 1]]];
    return piece({ '#c8963e': brass, '#e7a74a': glass, '#6b4527': strap });
  },
  eyepatch(e = EYES.rick) {
    // over his right eye (−x: he faces +z), its strap round the back of his head
    return piece({
      '#121016': [
        [ball(e.size * 1.3, 24, 12), [-e.spread, 0, 0.02], [0, 0, 0], [1, 0.9, 0.35]],
        [new THREE.TorusGeometry(0.5, 0.014, 6, 48, Math.PI), [0, 0.04, -0.32], [Math.PI / 2 - 0.2, 0, Math.PI], [1, 1.05, 1]],
      ],
    });
  },
  // ── in the hand (front −z, top +y, the grip at the origin) ──
  portalgun() {
    return piece(
      {
        '#dfe3e6': [
          [box(0.34, 0.26, 0.9), [0, 0.25, -0.38]],
          [box(0.22, 0.48, 0.2), [0, -0.05, 0.02], [0.3, 0, 0]],
        ],
        '#2b2d33': [[box(0.18, 0.06, 0.18), [0, 0.4, -0.05]]],
      },
      { '#7dff5c': true },
    ).add(piece({ '#7dff5c': [[ball(0.14, 20, 12), [0, 0.38, -0.5], [0, 0, 0], [1, 0.9, 1]]] }, { '#7dff5c': true }));
  },
  plumbus() {
    const pink = [
      [new THREE.LatheGeometry([[0.0, -0.3], [0.16, -0.26], [0.22, -0.1], [0.15, 0.08], [0.2, 0.22], [0.08, 0.36], [0.0, 0.38]].map(([r, y]) => new THREE.Vector2(r, y)), 32), [0, 0.12, -0.42], [-Math.PI / 2, 0, 0]],
      [ball(0.09), [0.15, 0.2, -0.72]],
    ];
    const deep = [
      [cyl(0.05, 0.06, 0.4, 16), [0, 0, 0.02], [0.15, 0, 0]],
      [new THREE.TorusGeometry(0.12, 0.035, 10, 24), [-0.16, 0.12, -0.3], [0, Math.PI / 2, 0]],
    ];
    return piece({ '#f2a3b8': pink, '#c86b84': deep });
  },
  laserpistol() {
    return piece(
      {
        '#8d96a3': [
          [cyl(0.09, 0.07, 0.62, 24), [0, 0.2, -0.35], ALONG],
          [box(0.14, 0.42, 0.18), [0, -0.05, 0.02], [0.25, 0, 0]],
          ...[0, 1, 2].map((i) => [box(0.02, 0.16, 0.12), [0, 0.3, -0.18 - i * 0.12]]),
        ],
        '#b8323b': [[cyl(0.1, 0.1, 0.06, 24), [0, 0.2, -0.05], ALONG]],
      },
      {},
    ).add(piece({ '#7dff5c': [[cyl(0.045, 0.06, 0.08, 20), [0, 0.2, -0.68], ALONG]] }, { '#7dff5c': true }));
  },
};

// where the eyes are, by face: Morty's take up most of it
const EYES = { rick: { spread: 0.11, size: 0.08 }, morty: { spread: 0.2, size: 0.15 } };

// a piece of gear, in its own frame; face gear for `face` ('rick' or 'morty')
export function buildGear(id, face = 'rick') {
  return BUILD[id] ? BUILD[id](EYES[face] ?? EYES.rick) : null;
}

// the portal gun, the model's, set in the hand's frame: its grip (towards
// its back and below, as it comes: a unit long, centred) at the origin
let gltf = null;
const GRIP = [0, 0.2, -0.32]; // (how far to move the model so its grip's on the origin)
function loadModel(url) {
  if (!gltf) {
    gltf = new GLTFLoader();
    gltf.setMeshoptDecoder(MeshoptDecoder);
  }
  return gltf.loadAsync(url).then((g) => g.scene);
}
const MODELS = Object.fromEntries(Object.values(GEAR).flat().filter((g) => g.file).map((g) => [g.id, g.file])); // (the gear that's a model of someone else's)
const models = new Map();
export function loadGear(id) {
  if (!MODELS[id]) return Promise.resolve(buildGear(id));
  if (!models.has(id))
    models.set(
      id,
      loadModel(MODELS[id]).catch(() => null),
    );
  return models.get(id).then((scene) => {
    if (!scene) return buildGear(id);
    const g = new THREE.Group();
    const m = scene.clone(true);
    // toon, like the cast: its own colours, the glow kept bright
    m.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      const t = toon(src.color ?? 0xffffff, { map: src.map ?? null, transparent: src.transparent, opacity: src.opacity, emissive: src.emissive ?? 0x000000, emissiveMap: src.emissiveMap ?? null, emissiveIntensity: src.emissiveIntensity ?? 1 });
      if (src.transparent) t.depthWrite = false;
      o.material = t;
      o.userData.sharedGeometry = true; // (the loaded model's: every copy has it)
      o.castShadow = true;
    });
    m.position.set(...GRIP);
    g.add(m);
    return g;
  });
}

// How each body wears it: head gear raised or sunk (in heads) and sized,
// face gear brought forward (in heads); the hand's gear sized (in forearms).
// Tuned by eye in lab/gear-sheet.html.
const FIT = {
  default: { eyes: 'rick', hat: 0, hatScale: 1, face: 0, faceUp: 0, faceScale: 1, hand: 1 },
  rick: { hat: -0.12, hatScale: 1.0, face: 0.0, faceUp: 0.02, hand: 1 },
  tinyrick: { hat: -0.12, hatScale: 1.05, face: 0.0, faceUp: 0.0, hand: 1.1 },
  morty: { eyes: 'morty', hat: -0.08, hatScale: 1.05, face: 0.05, faceUp: 0.0, hand: 1.3 },
};
const fitOf = (body) => ({ ...FIT.default, ...(FIT[body] ?? (body.includes('morty') ? FIT.morty : FIT.rick)) });

const v = () => new THREE.Vector3();
// a world matrix from its axes, origin and size
const basis = (x, y, z, at, s) => new THREE.Matrix4().makeBasis(x, y, z).scale(new THREE.Vector3(s, s, s)).setPosition(at);

// Gear on a figure from createMeshyCast().make(), for a look; returns a
// function that takes it all off again. The frames are worked out in the
// skeleton's bind pose, in the skinned mesh's own space (from its bones'
// inverses: no pose is touched), and each piece is set on its bone by where
// it sits against that bone there. The portal gun comes when its model does
// (the built one meanwhile).
export function wearGear(figure, look) {
  const skinned = [];
  figure.group.traverse((o) => o.isSkinnedMesh && !o.userData.ink && skinned.push(o));
  const skeleton = skinned[0]?.skeleton;
  if (!skeleton) return () => {};
  const bone = (n) => skeleton.getBoneByName(n);
  const head = bone('Head');
  const crown = bone('head_end');
  const front = bone('headfront');
  const hand = bone('RightHand');
  const arm = bone('RightForeArm');
  const on = [];
  let gone = false;
  // a bone's matrix in the bind pose, in the mesh's space
  const bind = (b) => new THREE.Matrix4().copy(skeleton.boneInverses[skeleton.bones.indexOf(b)]).invert();
  const at = (b) => v().setFromMatrixPosition(bind(b));
  const fit = fitOf(look.body);
  const put = (b, obj, frame) => {
    if (!b || !obj || gone) return;
    bind(b).invert().multiply(frame).decompose(obj.position, obj.quaternion, obj.scale);
    obj.userData.gear = true;
    obj.traverse((o) => (o.userData.noPaint = true));
    b.add(obj);
    on.push(obj);
  };
  const frames = {};
  if (head && crown) {
    const H = at(head);
    const E = at(crown);
    const up = v().subVectors(E, H);
    const s = up.length();
    up.normalize();
    const F = front ? at(front) : H.clone().add(new THREE.Vector3(0, 0, s * 0.4));
    const fwd = v().subVectors(F, H);
    fwd.addScaledVector(up, -fwd.dot(up));
    const reach = fwd.length();
    fwd.normalize();
    const right = v().crossVectors(up, fwd);
    frames.head = basis(right, up, fwd, E.clone().addScaledVector(up, fit.hat * s), s * fit.hatScale);
    const eyes = H.clone().addScaledVector(up, (0.52 + fit.faceUp) * s).addScaledVector(fwd, reach + fit.face * s);
    frames.face = basis(right, up, fwd, eyes, s * fit.faceScale);
  }
  if (hand && arm) {
    const A = at(arm);
    const R = at(hand);
    const along = v().subVectors(R, A);
    const forearm = along.length();
    along.normalize(); // (down the forearm: where it points)
    const fwd = v().set(0, 0, 1); // (the way he faces, in his own space: the gear's top)
    fwd.addScaledVector(along, -fwd.dot(along)).normalize();
    const back = along.clone().negate(); // (the gear's +z: back up the arm)
    const x = v().crossVectors(fwd, back);
    frames.hand = basis(x, fwd, back, R.clone().addScaledVector(along, 0.25 * forearm), fit.hand * forearm);
  }
  const bones = { head, face: head, hand };
  for (const slot of GEAR_SLOTS) {
    const id = look.gear?.[slot];
    if (!id || id === 'none' || !frames[slot] || !GEAR[slot].some((g) => g.id === id)) continue; // (readLook already took any hat off a head that has its own)
    const world = frames[slot];
    if (MODELS[id]) {
      const stand = buildGear(id, fit.eyes);
      put(bones[slot], stand, world);
      loadGear(id).then((model) => {
        if (gone || !model) return;
        stand.removeFromParent();
        put(bones[slot], model, world);
      });
    } else put(bones[slot], buildGear(id, fit.eyes), world);
  }
  return () => {
    gone = true;
    for (const o of on) {
      o.removeFromParent();
      o.traverse((m) => {
        if (!m.isMesh) return;
        if (!m.userData.sharedGeometry) m.geometry.dispose();
        m.material.dispose();
      });
    }
  };
}
