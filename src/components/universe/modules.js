// The parts fitted in the hangar (outfit.js), bolted on to a ship: built
// from simple shapes, a handful of draws, at hardpoints on each ship (its
// flanks for boosters, its corners for thrusters, its belly for guns, its
// back for a shield, its tail for fins), in the ship's own frame (BUILT
// units, nose −z: shipModels.js puts them in with the ship). The painted
// parts are a plain grey that takes the ship's paint job (livery.js) with a
// band that takes its trim; chrome stays chrome and Cap's shield stays
// Cap's.
//
// buildModules(kind, loadout, engines) → { group, nozzles (where the
//   boosters' exhaust leaves from, for scene.js's plumes), boosterColor,
//   flame (how much longer the main exhaust burns, boosting), muzzles
//   (where the shots leave from, in turn), update(t, { throttle, boost,
//   turn, climb }), dispose() }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Each ship's hardpoints (one side's, +x; the other is its mirror): pod
// (a booster's middle, its length and radius), corner (the thruster blocks,
// fore and aft), pipe (where a racing exhaust starts), gun (a twin barrel's
// root), belly (the fusion cannon's), plate (armour's middle and length),
// emitter (a shield node), badge (Cap's shield: where, how big, how far it
// tips back), fin (a fin's root), and ring (an afterburner collar's radius
// round each engine).
const MOUNTS = {
  xwing: {
    pod: [0.058, -0.055, 0.05, 0.13, 0.013],
    corner: [
      [0.032, 0.03, -0.06],
      [0.045, 0.035, 0.11],
    ],
    pipe: [0.025, -0.035, 0.12],
    gun: [0.022, -0.028, -0.06],
    belly: [0, -0.05, -0.02],
    plate: [0.044, 0.0, 0.05, 0.1],
    emitter: [0.03, 0.044, 0.07],
    badge: [0, 0.047, 0.1, 0.022, 0.25],
    fin: [0.028, 0.04, 0.13],
    ring: 0.021,
  },
  falcon: {
    pod: [0.158, -0.012, 0.04, 0.14, 0.016],
    corner: [
      [0.095, 0.04, -0.05],
      [0.1, 0.034, 0.08],
    ],
    pipe: [0.045, -0.032, 0.12],
    gun: [0.03, -0.04, -0.07],
    belly: [0, -0.05, -0.01],
    plate: [0.143, 0.0, -0.02, 0.12],
    emitter: [0.06, 0.05, 0.04],
    badge: [0, 0.052, 0.06, 0.034, 0.1],
    fin: [0.06, 0.038, 0.1],
    ring: 0.03,
  },
  rv: {
    pod: [0.165, -0.022, -0.05, 0.11, 0.013],
    corner: [
      [0.045, 0.072, -0.085],
      [0.045, 0.072, 0.1],
    ],
    pipe: [0.034, -0.05, 0.11],
    gun: [0.036, -0.06, -0.09],
    belly: [0, -0.078, -0.01],
    plate: [0.056, 0.005, 0.03, 0.13],
    emitter: [0.03, 0.078, 0.04],
    badge: [0, 0.074, -0.02, 0.03, 0],
    fin: [0.042, 0.07, 0.105],
    ring: 0.014,
  },
  cruiser: {
    pod: [0.17, -0.04, 0.04, 0.13, 0.016],
    corner: [
      [0.13, -0.01, -0.08],
      [0.13, -0.01, 0.08],
    ],
    pipe: [0.055, -0.07, 0.12],
    gun: [0.05, -0.07, -0.12],
    belly: [0, -0.115, -0.02],
    plate: [0.166, -0.03, 0.0, 0.12],
    emitter: [0.13, 0.01, 0.06],
    badge: [0, 0.03, 0.14, 0.032, 1.1],
    fin: [0.08, 0.02, 0.13],
    ring: 0.03,
  },
};
// the colours the boosters' exhaust burns
const BOOSTER_COLOR = { srb: '#ffb15c', repulsor: '#a8eeff', portal: '#7dff5c' };

const LAY = [-Math.PI / 2, 0, 0]; // a cylinder laid along z, top forward
const tube = (rTop, rBottom, len, seg = 12) => new THREE.CylinderGeometry(rTop, rBottom, len, seg);

// geometries placed by [geometry, position, rotation, scale], merged into one
function merge(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(m);
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}
// both sides of a part given for +x
const both = (list) => [...list, ...list.map(([g, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], s]) => [g.clone(), [-x, y, z], [rx, -ry, -rz], s])];

export function buildModules(kind, loadout = {}, engines = []) {
  const at = MOUNTS[kind] ?? MOUNTS.falcon;
  const group = new THREE.Group();
  group.name = 'modules';
  const made = []; // materials and geometries to dispose
  const glows = []; // { mat, color, idle, hot, by }: brighter as it boosts (or turns)
  const vanes = [];
  const nozzles = [];
  const muzzles = [];
  let flame = 1;

  const mat = (m) => (made.push(m), m);
  const metal = mat(new THREE.MeshStandardMaterial({ color: '#b9bdc3', roughness: 0.5, metalness: 0.3 })); // (takes the paint)
  const band = mat(new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.55, metalness: 0.2 })); // (takes the trim)
  const dark = mat(new THREE.MeshStandardMaterial({ color: '#25282e', roughness: 0.6, metalness: 0.4 }));
  const chrome = mat(new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.18, metalness: 1 }));
  const add = (geo, material, { noPaint = false } = {}) => {
    const mesh = new THREE.Mesh(geo, material);
    if (noPaint) mesh.userData.noPaint = true;
    made.push(geo);
    group.add(mesh);
    return mesh;
  };
  const glow = (geo, color, { idle = 0.4, hot = 3, by = 'boost', additive = true } = {}) => {
    const m = mat(new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive, side: THREE.DoubleSide }));
    glows.push({ mat: m, color: new THREE.Color(color), idle, hot, by });
    return add(geo, m);
  };

  const [px, py, pz, plen, pr] = at.pod;
  const tail = pz + plen / 2;

  // Boosters
  const booster = loadout.booster;
  if (booster === 'srb') {
    // a white rocket either side: a nose cone, a red band, the bell
    add(merge(both([[tube(pr, pr, plen * 0.78, 14), [px, py, pz + plen * 0.04], LAY], [new THREE.ConeGeometry(pr, plen * 0.18, 14), [px, py, pz - plen * 0.46], LAY]])), metal);
    add(merge(both([[tube(pr * 1.04, pr * 1.04, plen * 0.12, 14), [px, py, pz - plen * 0.2], LAY], [new THREE.BoxGeometry(0.004, pr * 2.2, plen * 0.22), [px + pr * 0.9, py, pz + plen * 0.3]]])), band);
    add(merge(both([[tube(pr * 0.7, pr * 1.05, plen * 0.12, 14), [px, py, tail + plen * 0.02], LAY], [new THREE.BoxGeometry(Math.max(0.006, Math.abs(px) * 0.25), 0.006, plen * 0.3), [px - Math.sign(px) * Math.abs(px) * 0.12, py + pr * 0.8, pz]]])), dark);
    glow(merge(both([[new THREE.CircleGeometry(pr * 0.85, 14), [px, py, tail + plen * 0.081]]])), BOOSTER_COLOR.srb, { idle: 0, hot: 3 });
    nozzles.push([px, py, tail + plen * 0.08], [-px, py, tail + plen * 0.08]);
  } else if (booster === 'repulsor') {
    // a disc under either flank, its face lit down and back
    const r = pr * 1.9;
    add(merge(both([[tube(r, r * 1.1, pr * 0.7, 20), [px, py - pr * 0.4, pz]]])), metal);
    add(merge(both([[new THREE.TorusGeometry(r * 0.78, pr * 0.16, 6, 24), [px, py - pr * 0.8, pz], [Math.PI / 2, 0, 0]]])), dark);
    glow(merge(both([[new THREE.CircleGeometry(r * 0.66, 20), [px, py - pr * 0.78, pz], [Math.PI / 2, 0, 0]]])), BOOSTER_COLOR.repulsor, { idle: 0.6, hot: 3.4 });
    glow(merge(both([[new THREE.CircleGeometry(pr * 0.6, 12), [px, py - pr * 0.4, pz + r * 1.02]]])), BOOSTER_COLOR.repulsor, { idle: 0.3, hot: 3 });
    nozzles.push([px, py - pr * 0.4, pz + r], [-px, py - pr * 0.4, pz + r]);
  } else if (booster === 'portal') {
    // a tank of the green stuff either side, capped and strapped
    const r = pr * 1.15;
    glow(merge(both([[tube(r, r, plen * 0.62, 16), [px, py, pz], LAY]])), BOOSTER_COLOR.portal, { idle: 0.55, hot: 2.2, additive: false });
    add(merge(both([[tube(r * 1.12, r * 1.12, plen * 0.1, 16), [px, py, pz - plen * 0.34], LAY], [tube(r * 1.12, r * 0.8, plen * 0.14, 16), [px, py, pz + plen * 0.36], LAY]])), chrome, { noPaint: true });
    add(merge(both([[new THREE.TorusGeometry(r * 1.02, r * 0.12, 6, 20), [px, py, pz - plen * 0.12]], [new THREE.TorusGeometry(r * 1.02, r * 0.12, 6, 20), [px, py, pz + plen * 0.14]]])), dark);
    glow(merge(both([[new THREE.CircleGeometry(r * 0.7, 14), [px, py, pz + plen * 0.435]]])), BOOSTER_COLOR.portal, { idle: 0.2, hot: 3.2 });
    nozzles.push([px, py, pz + plen * 0.44], [-px, py, pz + plen * 0.44]);
  } else if (booster === 'afterburner') {
    // a collar round each engine, and the exhaust burning long out of it
    flame = 1.7;
    const rings = engines.map(([x, y, z]) => [new THREE.TorusGeometry(at.ring, at.ring * 0.22, 8, 24), [x, y, z - 0.004]]);
    if (rings.length) {
      add(merge(rings), dark);
      glow(merge(engines.map(([x, y, z]) => [new THREE.TorusGeometry(at.ring * 0.8, at.ring * 0.1, 6, 24), [x, y, z + 0.002]])), '#ffd9a8', { idle: 0, hot: 3 });
    }
  }

  // Thrusters
  const thrusters = loadout.thrusters;
  if (thrusters === 'rcs') {
    // a little block at each corner, a nozzle out of each face
    const blocks = [];
    const jets = [];
    for (const [x, y, z] of at.corner) {
      blocks.push([new THREE.BoxGeometry(0.016, 0.012, 0.016), [x, y, z]]);
      jets.push([tube(0.003, 0.005, 0.008, 8), [x + 0.011, y, z], [0, 0, -Math.PI / 2]], [tube(0.003, 0.005, 0.008, 8), [x, y + 0.009, z]], [tube(0.003, 0.005, 0.008, 8), [x, y, z + (z < 0 ? -0.011 : 0.011)], [z < 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]]);
    }
    add(merge(both(blocks)), metal);
    add(merge(both(jets)), dark);
  } else if (thrusters === 'racing') {
    // chrome pipes out of the back, hot at their ends
    const [x, y, z] = at.pipe;
    add(merge(both([[tube(0.0075, 0.0095, 0.09, 12), [x, y, z], LAY], [new THREE.TorusGeometry(0.0095, 0.0022, 6, 14), [x, y, z + 0.045]]])), chrome, { noPaint: true });
    glow(merge(both([[new THREE.CircleGeometry(0.007, 12), [x, y, z + 0.0455]]])), '#ff8a3c', { idle: 0.5, hot: 3 });
    nozzles.push([x, y, z + 0.046], [-x, y, z + 0.046]);
  } else if (thrusters === 'vector') {
    // a pair of vanes behind each engine, steering the blast (they swing with the stick)
    for (const [x, y, z] of engines) {
      for (const side of [-1, 1]) {
        const vane = add(new THREE.BoxGeometry(at.ring * 1.6, 0.003, 0.02), dark);
        vane.position.set(x, y + side * at.ring * 0.9, z + 0.012);
        vane.userData.side = side;
        vanes.push(vane);
      }
    }
  }

  // Guns
  const guns = loadout.guns;
  if (guns === 'twin') {
    const [x, y, z] = at.gun;
    add(merge(both([[tube(0.0045, 0.0045, 0.11, 8), [x, y, z - 0.04], LAY], [new THREE.BoxGeometry(0.012, 0.01, 0.03), [x, y + 0.002, z + 0.02]]])), dark);
    add(merge(both([[tube(0.0065, 0.0065, 0.016, 8), [x, y, z - 0.09], LAY]])), metal);
    muzzles.push([x, y, z - 0.1], [-x, y, z - 0.1]);
  } else if (guns === 'fusion') {
    // Megatron's: a fat barrel slung under the belly, with its coils lit purple
    const [x, y, z] = at.belly;
    add(merge([[tube(0.014, 0.017, 0.15, 16), [x, y, z], LAY], [new THREE.BoxGeometry(0.02, 0.014, 0.05), [x, y + 0.012, z + 0.03]]]), metal);
    add(merge([[tube(0.011, 0.011, 0.012, 16), [x, y, z - 0.081], LAY]]), dark);
    glow(merge([-0.045, -0.015, 0.015].map((dz) => [new THREE.TorusGeometry(0.0165, 0.0028, 6, 18), [x, y, z + dz]])), '#b07cff', { idle: 1.2, hot: 1.2, by: 'fire' });
    glow(new THREE.CircleGeometry(0.009, 14).rotateX(Math.PI).translate(x, y, z - 0.0875), '#c9a6ff', { idle: 1.5, hot: 1.5, by: 'fire' });
    muzzles.push([x, y, z - 0.09]);
  }

  // Shields
  const shields = loadout.shields;
  if (shields === 'reinforced') {
    const [x, y, z, len] = at.plate;
    add(merge(both([[new THREE.BoxGeometry(0.006, 0.028, len), [x, y, z], [0, 0, 0.18]], [new THREE.BoxGeometry(0.007, 0.006, len * 0.9), [x + 0.001, y + 0.017, z], [0, 0, 0.18]]])), dark);
    add(merge(both([[new THREE.BoxGeometry(0.0065, 0.004, len * 0.94), [x + 0.0005, y - 0.006, z], [0, 0, 0.18]]])), band);
  } else if (shields === 'fastcharge') {
    const [x, y, z] = at.emitter;
    add(merge(both([[tube(0.0025, 0.004, 0.022, 8), [x, y + 0.006, z]], [tube(0.008, 0.008, 0.004, 12), [x, y - 0.004, z]]])), dark);
    glow(merge(both([[new THREE.SphereGeometry(0.0075, 12, 8), [x, y + 0.02, z]]])), '#6fd3ff', { idle: 1.2, hot: 1.2 });
  } else if (shields === 'vibranium') {
    // Cap's shield, lying on its back: red, white, red, a blue middle and the star
    const [x, y, z, r, tip] = at.badge;
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.x = -Math.PI / 2 + tip;
    group.add(holder);
    const ring = (outer, inner, color, lift) => {
      const geo = new THREE.RingGeometry(inner * r, outer * r, 36);
      const m = mat(new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.z = lift;
      mesh.userData.noPaint = true;
      made.push(geo);
      holder.add(mesh);
    };
    ring(1, 0.8, '#b3191f', 0);
    ring(0.8, 0.6, '#f1f1ee', 0.0004);
    ring(0.6, 0.4, '#b3191f', 0.0008);
    ring(0.4, 0, '#1f3e8f', 0.0012);
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const k = (i % 2 ? 0.16 : 0.38) * r;
      if (i === 0) star.moveTo(Math.cos(a) * k, Math.sin(a) * k);
      else star.lineTo(Math.cos(a) * k, Math.sin(a) * k);
    }
    const starGeo = new THREE.ShapeGeometry(star);
    const starMesh = new THREE.Mesh(starGeo, mat(new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide })));
    starMesh.position.z = 0.0016;
    starMesh.userData.noPaint = true;
    made.push(starGeo);
    holder.add(starMesh);
    // and the rim it sits in
    const rimGeo = new THREE.TorusGeometry(r, r * 0.06, 6, 36);
    const rim = new THREE.Mesh(rimGeo, chrome);
    rim.userData.noPaint = true;
    made.push(rimGeo);
    holder.add(rim);
  }

  // Fins
  if (loadout.fins === 'fins') {
    // a swept fin either side of the tail, canted out
    const [x, y, z] = at.fin;
    const shape = new THREE.Shape();
    shape.moveTo(-0.028, 0);
    shape.lineTo(0.022, 0);
    shape.lineTo(0.03, 0.045);
    shape.lineTo(0.012, 0.045);
    shape.closePath();
    const fin = new THREE.ExtrudeGeometry(shape, { depth: 0.003, bevelEnabled: false }).translate(0, 0, -0.0015).rotateY(Math.PI / 2);
    add(merge(both([[fin, [x, y, z], [0, 0, -0.32]]])), metal);
    add(merge(both([[new THREE.BoxGeometry(0.0034, 0.008, 0.032), [x + 0.0045, y + 0.03, z + 0.012], [0, 0, -0.32]]])), band);
  }

  let fired = 0;
  return {
    group,
    nozzles,
    muzzles,
    flame,
    boosterColor: BOOSTER_COLOR[booster] ?? (thrusters === 'racing' ? '#ff8a3c' : null),
    // a shot's gone: the cannon's coils flare
    fire() {
      fired = 1;
    },
    update(dt, { throttle = 0, boost = false, turn = 0, climb = 0 } = {}) {
      fired = Math.max(0, fired - dt * 4);
      const k = boost ? 1 : throttle * 0.35;
      for (const g of glows) {
        const v = g.by === 'fire' ? g.idle * (1 + 2.2 * fired) : g.idle + (g.hot - g.idle) * k;
        g.mat.color.copy(g.color).multiplyScalar(v);
        g.mat.visible = v > 0.01;
      }
      for (const v of vanes) v.rotation.set(climb * 0.35 * v.userData.side, 0, -turn * 0.4);
    },
    dispose() {
      for (const m of made) m.dispose();
    },
  };
}
