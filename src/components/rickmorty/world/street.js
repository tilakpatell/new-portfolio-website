// The Smiths' street in 3D, drawn from ./rules.js: the sky, bright lawns, the
// asphalt with its dashed yellow line between pale concrete sidewalks, the
// driveways and the Smiths' brick-edged front walk, white picket fences,
// mailboxes, telephone poles, round puffy trees in two greens, the
// neighbours' houses in their colours, the Smith house, Harry Herpson High
// with its name, flag, marquee and crosswalk, and the suburb going on past
// the end of the street. Static parts are merged by material and repeats are
// instanced, so it all draws in a few dozen calls.
//
// buildStreet(kit) → { group, update(t, dt, state, camera), noInk, light },
// kit = { renderer, models: Map<name, Object3D|null> (toon-painted), cast, mats, tier }.

import * as THREE from 'three';
import { AREAS, DRIVEWAY, FENCES, FRONT_WALK, NEIGHBOURS, ROAD, SCHOOL, TREES } from './rules';
import { at, batch, mergeParts, rng, speckle } from './kit';
import { buildingMaterials, flagpole, marquee, neighbourHouses, school, smithHouse } from './buildings';
import { STREET_SKY, makeSky } from './sky';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const FAR = 1200; // how far the ground and the road go on
const SUBURB = 330; // and the houses and trees past the street
export const ROAD_Y = -0.12; // the asphalt, a kerb's height under the sidewalks and lawns
const WALK = ROAD.w / 2 + ROAD.sidewalk; // 7

// the neighbours' driveways, on the side of each house that's clear of trees
const DRIVE_SIDE = { n0: 1, n1: -1, n2: 1, s0: 1, s1: 1, s2: -1 };
// which design each neighbour is (./buildings.js: 0 colonial, 1 ranch) and its roof
const NEIGHBOUR_LOOK = { n0: [0, 0x5d5f6c], n1: [1, 0x6e4a36], n2: [0, 0x7a4038], s0: [1, 0x56606e], s1: [0, 0x6b4c3b], s2: [1, 0x4f5a52] };
const TINTS = [0xe9c9a1, 0xb7d3c6, 0xe7b8b0, 0xc2cfe6, 0xf0dd9a, 0xd9bfd8, 0xf2e6cf, 0xc9dfb0];
const ROOFS = [0x5d5f6c, 0x6e4a36, 0x7a4038, 0x56606e, 0x4f5a52, 0x6b4c3b];

export function buildStreet(kit) {
  const { models, mats, tier = 'high' } = kit;
  const group = new THREE.Group();
  group.name = 'street';
  const b = batch();
  const m = buildingMaterials(mats);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;
  const sky = makeSky(560, STREET_SKY);
  group.add(sky.dome);

  // ── the ground ──
  const grass = mats.painted('grass', 256, 256, (g, w, h) => {
    speckle(g, w, h, { base: '#62b347', specks: ['#5dad43', '#67b84b', '#5aa940', '#6bbc4e'], n: 1800, size: 2, seed: 21 });
    const r = rng(8);
    g.globalAlpha = 0.08;
    for (let i = 0; i < 14; i++) {
      g.fillStyle = r() < 0.5 ? '#3f8a2e' : '#8fd66a';
      g.beginPath();
      g.ellipse(r() * w, r() * h, 20 + r() * 40, 12 + r() * 30, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  });
  grass.userData.tile = 7;
  for (const s of [-1, 1]) b.add(new THREE.PlaneGeometry(FAR * 2, FAR - WALK).rotateX(-Math.PI / 2), grass, 0, 0, s * (WALK + (FAR - WALK) / 2));
  const asphalt = mats.painted(
    'asphalt',
    512,
    256,
    (g, w, h) => {
      speckle(g, w, h, { base: '#74777c', specks: ['#707378', '#787b80', '#6d7075', '#7c7f84'], n: 2500, size: 1.5, seed: 33 });
      // a crack, mended with tar
      g.strokeStyle = 'rgba(52,54,58,0.3)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(w * 0.62, h * 0.2);
      g.bezierCurveTo(w * 0.7, h * 0.35, w * 0.6, h * 0.5, w * 0.72, h * 0.66);
      g.stroke();
      // the dashed yellow line down the middle: a 3 m dash every 12 m (this tile is 12 m long, 10 m across)
      g.fillStyle = '#e8c33a';
      g.fillRect(w * 0.1, h / 2 - 4, w * 0.25, 8);
    },
    { repeat: [1, 1] },
  );
  const road = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2, ROAD.w).rotateX(-Math.PI / 2), asphalt);
  asphalt.map.repeat.set((FAR * 2) / 12, 1);
  road.position.set(0, ROAD_Y, ROAD.z);
  road.receiveShadow = true;
  group.add(road);
  // sidewalks: concrete slabs a kerb's height over the road, joints every 2 m
  const slab = mats.painted('slab', 128, 128, (g, w, h) => {
    speckle(g, w, h, { base: '#dcd8cf', specks: ['#d4d0c7', '#e2dfd8', '#d0cbc1'], n: 500, size: 1.5, seed: 5 });
    g.fillStyle = '#a9a398';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, 0, 3, h);
  });
  slab.userData.tile = 2;
  for (const s of [-1, 1]) b.add(BOX, slab, at(0, (ROAD_Y + 0.03) / 2, s * (ROAD.w / 2 + ROAD.sidewalk / 2), 0, FAR * 2, 0.03 - ROAD_Y, ROAD.sidewalk));
  const pad = (x0, x1, z0, z1, top = 0.025, mat = slab) => b.add(BOX, mat, at((x0 + x1) / 2, top / 2 - 0.01, (z0 + z1) / 2, 0, x1 - x0, top + 0.02, z1 - z0));
  pad(DRIVEWAY.x0, DRIVEWAY.x1, DRIVEWAY.z0, DRIVEWAY.z1);

  // ── the houses ──
  const bushes = [];
  const houseModel = models.get('smith-house');
  const smith = smithHouse(b, m, mats, houseModel, bushes);
  if (smith.group) group.add(smith.group);
  // the front walk, edged in red brick, from the sidewalk to the porch step
  const walkTop = Math.min(FRONT_WALK.z0, smith.porch.z + 0.7);
  pad(FRONT_WALK.x0, FRONT_WALK.x1, walkTop, FRONT_WALK.z1, 0.035);
  if (Math.abs(smith.porch.x - (FRONT_WALK.x0 + FRONT_WALK.x1) / 2) > 0.4) pad(Math.min(FRONT_WALK.x0, smith.porch.x - 0.9), Math.max(FRONT_WALK.x1, smith.porch.x + 0.9), walkTop, walkTop + 1.6, 0.04);
  for (const x of [FRONT_WALK.x0 - 0.08, FRONT_WALK.x1 + 0.08]) b.add(BOX, m.brick, at(x, 0.04, (walkTop + 1.6 + FRONT_WALK.z1) / 2, 0, 0.16, 0.08, FRONT_WALK.z1 - walkTop - 1.6));
  const schoolModel = models.get('school');
  const hhhs = school(b, m, mats, schoolModel, bushes);
  if (hhhs.group) group.add(hhhs.group);
  group.add(hhhs.plate);
  const front = SCHOOL.z - SCHOOL.d / 2;
  pad(SCHOOL.x - 1.6, SCHOOL.x + 1.6, WALK, front - 2.5);
  pad(SCHOOL.x - 5, SCHOOL.x + 5, front - 2.5, front + 0.2);
  const flag = flagpole(b, m, mats, SCHOOL.x + 7.5, front - 3.2);
  group.add(flag.flag);
  marquee(b, m, mats, SCHOOL.x - 8.5, WALK + 2.4, -2.75);
  // the crosswalk in front of the school
  const zebra = mats.toon(0xe4e1d8);
  for (let z = -4; z <= 4; z += 1) b.add(BOX, zebra, at(SCHOOL.x, ROAD_Y + 0.01, z, 0, 3.2, 0.02, 0.55));
  // the neighbours, and the suburb on past the street's ends and behind its yards
  const houses = NEIGHBOURS.map((n) => ({ x: n.x, z: n.z, turn: n.z < 0 ? 0 : Math.PI, kind: NEIGHBOUR_LOOK[n.id][0], tint: n.tint, roof: NEIGHBOUR_LOOK[n.id][1], id: n.id }));
  const r = rng(77);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const drives = NEIGHBOURS.map((n) => ({ x: n.x + DRIVE_SIDE[n.id] * (n.w / 2 + 1.8), z: n.z, s: Math.sign(n.z) }));
  for (let x = AREAS.street.x1 + 8; x < SUBURB; x += 21 + r() * 4)
    for (const sx of [-1, 1])
      for (const s of [-1, 1]) {
        const hx = sx * x;
        houses.push({ x: hx, z: s * 20, turn: s < 0 ? 0 : Math.PI, kind: r() < 0.5 ? 0 : 1, tint: pick(TINTS), roof: pick(ROOFS) });
        drives.push({ x: hx + (r() < 0.5 ? -1 : 1) * 7.8, z: s * 20, s });
      }
  for (let x = -SUBURB; x < SUBURB; x += 22 + r() * 5) for (const s of [-1, 1]) houses.push({ x, z: s * 62, turn: s < 0 ? Math.PI : 0, kind: r() < 0.5 ? 0 : 1, tint: pick(TINTS), roof: pick(ROOFS) });
  // (the street's own cast shadows; the suburb's are too far off to need them)
  const hood = neighbourHouses(mats, houses.slice(0, NEIGHBOURS.length));
  const suburb = neighbourHouses(mats, houses.slice(NEIGHBOURS.length), { shadows: false });
  group.add(hood.group, suburb.group);
  // striped awnings on the house next door to the west, as in the show
  const next = houses.find((h) => h.id === 'n0');
  const stripes = mats.painted('awning', 64, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#fbf4ef' : '#d9607a';
      g.fillRect((i * w) / 8, 0, w / 8 + 1, h);
    }
    g.fillStyle = '#d9607a';
    g.fillRect(0, h - 6, w, 6);
  });
  for (const [x, y] of hood.designs[next.kind]?.awnings ?? []) b.add(BOX, stripes, at(next.x + x, y, next.z + 5.35, 0, 1.5, 0.06, 0.8, 0.55));
  // their driveways and mailboxes, and the Smiths' mailbox
  for (const d of drives) pad(d.x - 1.5, d.x + 1.5, d.s < 0 ? d.z - 4 : WALK, d.s < 0 ? -WALK : d.z + 4);
  const boxes = [...drives.filter((d) => Math.abs(d.x) < 70).map((d) => [d.x + 2.1, d.s * (WALK + 0.5), d.s]), [DRIVEWAY.x1 + 0.7, -(WALK + 0.5), -1]];
  const mailRed = mats.toon(0xc8352e);
  for (const [x, z, s] of boxes) {
    b.add(BOX, mats.wood, at(x, 0.55, z, 0, 0.1, 1.1, 0.1));
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 12, 1, false, -Math.PI / 2, Math.PI), m.metal, at(x, 1.12, z, 0, 1, 1, 1, -Math.PI / 2));
    b.add(BOX, m.metal, at(x, 1.04, z, 0, 0.34, 0.17, 0.5));
    b.add(BOX, mailRed, at(x + 0.19, 1.25, z - s * 0.05, 0, 0.03, 0.26, 0.06));
  }

  // ── fences: white pickets round the back yards ──
  const picket = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.045, 0);
    s.lineTo(0.045, 0);
    s.lineTo(0.045, 0.92);
    s.lineTo(0, 1.02);
    s.lineTo(-0.045, 0.92);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }).translate(0, 0, -0.0125);
  })();
  const spots = [];
  const white = m.white;
  for (const [x0, z0, x1, z1] of FENCES) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const turn = Math.atan2(-(z1 - z0), x1 - x0);
    const n = Math.max(1, Math.round(len / 0.17));
    for (let i = 0; i <= n; i++) spots.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, turn]);
    for (const y of [0.3, 0.75]) b.add(BOX, white, at((x0 + x1) / 2, y, (z0 + z1) / 2, turn, len, 0.07, 0.04));
    const posts = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i <= posts; i++) b.add(BOX, white, at(x0 + ((x1 - x0) * i) / posts, 0.58, z0 + ((z1 - z0) * i) / posts, turn, 0.1, 1.16, 0.1));
  }
  const pickets = new THREE.InstancedMesh(picket, white, spots.length);
  const tmp = new THREE.Matrix4();
  spots.forEach(([x, z, turn], i) => pickets.setMatrixAt(i, tmp.makeRotationY(turn).setPosition(x, 0, z)));
  pickets.castShadow = true;
  pickets.receiveShadow = true;
  group.add(pickets);

  // ── telephone poles along the south sidewalk, and their wires ──
  const poleXs = [];
  for (let x = -320; x <= 320; x += 32) poleXs.push(x + 20);
  const poleZ = WALK + 0.6;
  const poleWood = mats.toon(0x7b5a3d);
  for (const x of poleXs) {
    b.add(new THREE.CylinderGeometry(0.13, 0.17, 9, 8), poleWood, at(x, 4.5, poleZ));
    b.add(BOX, poleWood, at(x, 8.2, poleZ, 0, 0.12, 0.14, 2.4));
    for (const dz of [-1, 0, 1]) b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), m.white, at(x, 8.36, poleZ + dz));
  }
  const wirePts = [];
  for (let i = 0; i < poleXs.length - 1; i++)
    for (const dz of [-1, 0, 1])
      for (let k = 0; k < 8; k++) {
        const a = k / 8;
        const c = (k + 1) / 8;
        const sag = (u) => 8.42 - Math.sin(u * Math.PI) * 0.55;
        wirePts.push(poleXs[i] + (poleXs[i + 1] - poleXs[i]) * a, sag(a), poleZ + dz, poleXs[i] + (poleXs[i + 1] - poleXs[i]) * c, sag(c), poleZ + dz);
      }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  const wires = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x2a2630 }));
  group.add(wires);

  // a fire hydrant on the Smiths' side
  b.add(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 10), mats.toon(0xd6342c), at(-2.2, 0.35, -(WALK + 0.45)));
  b.add(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.toon(0xd6342c), at(-2.2, 0.7, -(WALK + 0.45)));
  b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), mats.toon(0xd6342c), at(-2.2, 0.48, -(WALK + 0.45), 0, 1, 1, 1, Math.PI / 2));

  // ── trees: round puffs in two greens on brown trunks ──
  const treeSpots = TREES.map((t) => ({ x: t.x, z: t.z, s: t.s, kind: t.kind, turn: t.turn }));
  // one more in front of the school (the rules' tree by its east wing is the other), and the suburb's trees past the street
  treeSpots.push({ x: SCHOOL.x - 12.5, z: front - 3.5, s: 1.05, kind: 0, turn: 1 });
  const away = Math.round(190 * many);
  for (let i = 0, tries = 0; i < away && tries < 6000; tries++) {
    const x = (r() * 2 - 1) * SUBURB;
    const z = (r() < 0.5 ? -1 : 1) * (12 + r() * SUBURB * 0.6);
    const inStreet = Math.abs(x) < AREAS.street.x1 + 2 && Math.abs(z) < AREAS.street.z1 + 1.5;
    if (inStreet) continue;
    if (houses.some((h) => Math.abs(h.x - x) < 8 && Math.abs(h.z - z) < 7.5) || drives.some((d) => Math.abs(d.x - x) < 2.5 && Math.abs(d.z - z) < 9)) continue;
    if (Math.abs(z) < WALK + 1.5) continue;
    treeSpots.push({ x, z, s: 0.8 + r() * 0.7, kind: Math.floor(r() * 3), turn: r() * 6.3 });
    i++;
  }
  const near = (t) => Math.abs(t.x) < AREAS.street.x1 + 3 && Math.abs(t.z) < AREAS.street.z1 + 3;
  for (let kind = 0; kind < 6; kind++) {
    const close = kind < 3;
    const list = treeSpots.filter((t) => t.kind === kind % 3 && near(t) === close);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(treeGeometry(kind % 3, close ? 2 : 1), mats.toon(0xffffff, { vertexColors: true }), list.length);
    const c = new THREE.Color();
    list.forEach((t, i) => {
      mesh.setMatrixAt(i, tmp.makeRotationY(t.turn).scale(new THREE.Vector3(t.s, t.s, t.s)).setPosition(t.x, 0, t.z));
      const k = Math.abs(Math.sin(t.x * 12.9898 + t.z * 78.233) * 43758.5453) % 1;
      mesh.setColorAt(i, c.setRGB(0.9 + k * 0.12, 1, 0.88 + (1 - k) * 0.1));
    });
    mesh.castShadow = close;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // ── bushes ──
  if (bushes.length) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geo, mats.toon(0xffffff), bushes.length);
    const c = new THREE.Color();
    bushes.forEach((u, i) => {
      mesh.setMatrixAt(i, tmp.makeScale(u.s * 1.15, u.s * 0.9, u.s).setPosition(u.x, u.y, u.z));
      mesh.setColorAt(i, c.set(i % 3 ? 0x4e9a3a : 0x3f8a33));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  b.build(group);
  return {
    group,
    sky,
    noInk: [sky.dome, wires],
    light: { sun: [0xfff3df, 2.4], hemi: [0xd6f0ff, 0x6a9a4a, 1.35], fog: [0xd2eef8, 90, 560] },
    update(t, dt, state, camera) {
      sky.update(t, camera);
      flag.update(t);
    },
  };
}

// One tree of a kind (0 round, 1 tall, 2 wide) at scale 1: its trunk and
// its puffs, darker green underneath and lighter on top, as one
// vertex-coloured geometry.
function treeGeometry(kind, detail = 1) {
  const DARK = 0x3d8a35;
  const LIGHT = 0x63b545;
  const TRUNK = 0x7a5232;
  const parts = [];
  const puff = (x, y, z, r, color) => parts.push({ geo: new THREE.IcosahedronGeometry(r, detail), color, matrix: at(x, y, z) });
  const trunkH = kind === 1 ? 3.0 : kind === 2 ? 2.7 : 3.2;
  parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.3, trunkH + 0.6, 7), color: TRUNK, matrix: at(0, (trunkH + 0.6) / 2, 0) });
  if (kind === 0) {
    puff(0, trunkH + 1.5, 0, 1.75, DARK);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      puff(Math.cos(a) * 1.25, trunkH + 1.2 + (i % 2) * 0.4, Math.sin(a) * 1.25, 1.05, DARK);
    }
    puff(0.3, trunkH + 2.6, 0.2, 1.15, LIGHT);
    puff(-0.6, trunkH + 2.2, -0.5, 0.95, LIGHT);
  } else if (kind === 1) {
    puff(0, trunkH + 1.2, 0, 1.45, DARK);
    puff(0.2, trunkH + 2.5, 0.1, 1.3, DARK);
    puff(-0.1, trunkH + 3.6, -0.1, 1.0, LIGHT);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      puff(Math.cos(a) * 0.95, trunkH + 1.8 + (i % 2) * 0.6, Math.sin(a) * 0.95, 0.8, i % 2 ? LIGHT : DARK);
    }
  } else {
    for (const [x, z] of [[1.3, 0], [-1.3, 0.2], [0, 1.1], [0.1, -1.1]]) puff(x, trunkH + 1.3, z, 1.35, DARK);
    puff(0, trunkH + 2.2, 0, 1.4, LIGHT);
    puff(0.9, trunkH + 2.0, -0.6, 0.9, LIGHT);
    parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.14, 1.6, 6), color: TRUNK, matrix: at(0.5, trunkH + 0.3, 0, 0, 1, 1, 1, 0, -0.7) });
  }
  return mergeParts(parts);
}
