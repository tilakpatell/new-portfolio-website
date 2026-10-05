// The houses on the Smiths' street and Harry Herpson High, for ./street.js.
// The Smith house and the school are Meshy models (public/models/c137/),
// fitted over the footprints in ./rules.js; each has a stand-in built here
// to the same elevation, so the street looks right without them. The
// neighbours are two house designs, instanced and tinted. Code draws what the
// models leave out: the school's name on its entrance block, its flag and its
// "H.H.H.S." marquee.

import * as THREE from 'three';
import { GARAGE, HOUSE, HOUSE_GARAGE, SCHOOL } from './rules';
import { at, bricks, fitModel, gablePrism, gableSlabs, hipRoof, mergeParts, rng, speckle } from './kit';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const UP = Math.PI / 2;

// A face of a wall: a point on it and the way it faces (its turn: 0 south,
// pi north, pi/2 east, -pi/2 west). on(u, y, out) is the point u along it (to
// the right, seen from outside), y up and `out` metres proud of it.
const face = (x, z, turn) => {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return { turn, on: (u, y, out = 0) => [x + u * c + out * s, y, z - u * s + out * c] };
};

// The materials the buildings share, painted where they need it. `tile` is
// metres per repeat for the batch's world-space uvs.
export function buildingMaterials(mats) {
  const tiled = (m, tile) => {
    m.userData.tile = tile;
    return m;
  };
  return {
    cream: mats.wall(0xf0e1b6),
    trim: mats.toon(0x5c3a22),
    white: mats.toon(0xf4f0e6),
    concrete: tiled(mats.painted('concrete', 128, 128, (g, w, h) => speckle(g, w, h, { base: '#d8d4cb', specks: ['#c9c4ba', '#e4e1da', '#bfb9ae'], n: 900, size: 2, seed: 9 })), 2),
    brick: tiled(mats.painted('brick', 256, 128, (g, w, h) => bricks(g, w, h, { base: '#7f2a22', mortar: '#4f1712', rows: 8, cols: 4 })), 1.4),
    schoolBrick: tiled(mats.painted('schoolbrick', 256, 128, (g, w, h) => bricks(g, w, h, { base: '#8e3c2b', mortar: '#6b2c20', rows: 8, cols: 4, seed: 5 })), 1.6),
    shingle: tiled(
      mats.painted('shingle', 128, 128, (g, w, h) => {
        const r = rng(4);
        g.fillStyle = '#6f452b';
        g.fillRect(0, 0, w, h);
        for (let y = 0; y < 8; y++)
          for (let x = -1; x < 6; x++) {
            g.fillStyle = r() < 0.15 ? '#5a3721' : r() < 0.3 ? '#7b4f33' : '#6f452b';
            g.fillRect(x * 24 + (y % 2) * 12 + 1, y * 16 + 1, 22, 14);
            g.fillStyle = '#4b2d1a';
            g.fillRect(x * 24 + (y % 2) * 12, y * 16 + 13, 24, 3);
          }
      }),
      1.8,
    ),
    pane: mats.painted('pane', 64, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#cfeefa');
      gr.addColorStop(1, '#8cc4dc');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.moveTo(w * 0.15, h);
      g.lineTo(w * 0.4, h);
      g.lineTo(w * 0.85, 0);
      g.lineTo(w * 0.6, 0);
      g.fill();
      g.fillStyle = '#5c3a22';
      g.fillRect(w / 2 - 2, 0, 4, h);
      g.fillRect(0, h / 2 - 2, w, 4);
    }),
    roofGrey: mats.toon(0x8b8d8e),
    leaf: mats.toon(0x4f9c3c),
    metal: mats.metal,
    dark: mats.toon(0x3a3d42),
  };
}

// a window: a frame proud of the wall and the glass a little in from it
function windowOn(b, m, f, u, y, w, h, frame = m.trim) {
  b.add(BOX, frame, at(...f.on(u, y, 0.06), f.turn, w + 0.22, h + 0.22, 0.12));
  b.add(BOX, m.pane, at(...f.on(u, y, 0.06), f.turn, w, h, 0.14));
  b.add(BOX, m.white, at(...f.on(u, y - h / 2 - 0.13, 0.12), f.turn, w + 0.36, 0.08, 0.22));
}
// a block of wall on the ground (x0..x1, z0..z1, h high) with a brick base
function block(b, m, x0, x1, z0, z1, h, wall = m.cream, base = m.brick, baseH = 0.6) {
  b.add(BOX, wall, at((x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0, x1 - x0, h, z1 - z0));
  if (base) b.add(BOX, base, at((x0 + x1) / 2, baseH / 2, (z0 + z1) / 2, 0, x1 - x0 + 0.08, baseH, z1 - z0 + 0.08));
}
// a gable roof on a block: its ridge along x (or z), its eaves `over` out
// at the sides and `rake` out at the ends
function gable(b, m, x, y, z, len, across, rise, alongZ, { over = 0.45, rake = 0.3, roof = m.shingle, wall = m.cream } = {}) {
  const turn = alongZ ? UP : 0;
  b.add(gablePrism(len, across, rise), wall, at(x, y, z, turn));
  const base = at(x, y, z, turn);
  for (const [g, mm] of gableSlabs(len - over * 2 + rake * 2, across, rise, { over })) b.add(g, roof, base.clone().multiply(mm));
}

// ── the Smith house ──

// The stand-in, to the show's elevation on the rules' footprints: the garage
// wing on the west a metre forward, the porch-gabled middle, the two-storey
// east wing with its balcony.
function smithStandIn(b, m, mats, bushes) {
  const front = HOUSE.z + HOUSE.d / 2; // -15
  const gFront = GARAGE.z + GARAGE.d / 2; // -14
  const gx0 = GARAGE.x - GARAGE.w / 2;
  const gx1 = GARAGE.x + GARAGE.w / 2;
  const hx0 = HOUSE.x - HOUSE.w / 2;
  const hx1 = HOUSE.x + HOUSE.w / 2;
  const back = HOUSE.z - HOUSE.d / 2;
  const tall = hx1 - 8; // the two-storey wing's west wall
  // the garage: walls, steep front gable, the door, the backboard and hoop
  block(b, m, gx0, gx1, GARAGE.z - GARAGE.d / 2, gFront, GARAGE.h);
  gable(b, m, GARAGE.x, GARAGE.h, GARAGE.z, GARAGE.d, GARAGE.w, GARAGE.roof - GARAGE.h, true);
  const gf = face(GARAGE.x, gFront, 0);
  const door = mats.painted('garagedoor', 256, 128, (g, w, h) => {
    g.fillStyle = '#cdb58b';
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 2; c++) {
        g.fillStyle = '#b89c70';
        g.fillRect(c * (w / 2) + 10, r * (h / 4) + 5, w / 2 - 20, h / 4 - 10);
        g.fillStyle = '#d9c39c';
        g.fillRect(c * (w / 2) + 14, r * (h / 4) + 8, w / 2 - 28, h / 4 - 17);
      }
    g.fillStyle = '#8f7652';
    for (let r = 1; r < 4; r++) g.fillRect(0, r * (h / 4) - 1, w, 2);
  });
  b.add(BOX, m.trim, at(...gf.on(0, 1.35, 0.02), 0, 5.9, 2.85, 0.06));
  b.add(BOX, door, at(...gf.on(0, 1.3, 0.05), 0, 5.6, 2.6, 0.06));
  const board = mats.painted('backboard', 128, 96, (g, w, h) => {
    g.fillStyle = '#f7f7f2';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c0282d';
    g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.strokeRect(w * 0.34, h * 0.42, w * 0.32, h * 0.4);
  });
  b.add(BOX, board, at(...gf.on(0, 4.45, 0.12), 0, 1.6, 1.05, 0.06));
  b.add(BOX, m.metal, at(...gf.on(0, 3.86, 0.25), 0, 0.12, 0.08, 0.3));
  b.add(new THREE.TorusGeometry(0.24, 0.028, 6, 18), mats.toon(0xe0522a), at(...gf.on(0, 3.82, 0.62), 0, 1, 1, 1, UP));
  b.add(new THREE.CylinderGeometry(0.24, 0.15, 0.38, 12, 1, true), mats.toon(0xf2f2ee, { side: THREE.DoubleSide }), at(...gf.on(0, 3.62, 0.62)));
  windowOn(b, m, face(gx0, GARAGE.z, -UP), 0, 1.9, 1.2, 1.0);
  // the middle: wide window, the door under its pointed porch, the dish on the roof
  block(b, m, hx0, tall, back, front, HOUSE.h);
  gable(b, m, (hx0 + tall) / 2, HOUSE.h, HOUSE.z, tall - hx0, HOUSE.d, 2.4, false, { rake: 0 });
  const mf = face(0, front, 0);
  windowOn(b, m, mf, -11.1, 1.8, 2.8, 1.4);
  const doorMat = mats.painted('frontdoor', 64, 128, (g, w, h) => {
    g.fillStyle = '#6b3f22';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a321a';
    for (const [x, y, ww, hh] of [[8, 8, 20, 46], [36, 8, 20, 46], [8, 66, 20, 54], [36, 66, 20, 54]]) g.fillRect(x, y, ww, hh);
    g.fillStyle = '#e8c24a';
    g.fillRect(50, 66, 6, 6);
  });
  b.add(BOX, m.trim, at(...mf.on(-8, 1.15, 0.02), 0, 1.35, 2.4, 0.06));
  b.add(BOX, doorMat, at(...mf.on(-8, 1.1, 0.05), 0, 1.05, 2.2, 0.06));
  for (const x of [-9.05, -6.95]) b.add(CYL, m.white, at(x, 1.4, front + 1.05, 0, 0.14, 2.8, 0.14));
  gable(b, m, -8, 2.8, front + 0.6, 1.4, 2.5, 0.85, true, { over: 0.15, rake: 0.1 });
  b.add(BOX, m.concrete, at(-8, 0.08, front + 0.65, 0, 2.5, 0.16, 1.3));
  // the dish, on the front slope
  const dishAt = [hx0 + 3.2, HOUSE.h + 2.4 * (1 - 2.6 / (HOUSE.d / 2)), front - 2.6];
  b.add(CYL, m.metal, at(dishAt[0], dishAt[1] + 0.25, dishAt[2], 0, 0.08, 0.6, 0.08));
  b.add(new THREE.SphereGeometry(0.5, 14, 6, 0, Math.PI * 2, 0, 0.95), mats.toon(0xd9dcdf, { side: THREE.DoubleSide }), at(dishAt[0], dishAt[1] + 0.75, dishAt[2] + 0.1, 0.4, 1, 0.55, 1, -2.2));
  // a potted plant left of the door, the hose reel right of it
  b.add(new THREE.CylinderGeometry(0.24, 0.17, 0.46, 10), mats.toon(0xc8643a), at(-9.7, 0.23, front + 0.55));
  for (let i = 0; i < 6; i++) b.add(new THREE.ConeGeometry(0.07, 0.6, 5), m.leaf, at(-9.7 + Math.cos(i) * 0.08, 0.72, front + 0.55 + Math.sin(i) * 0.08, i, 1, 1, 1, Math.cos(i * 2.1) * 0.35, Math.sin(i * 2.1) * 0.35));
  b.add(new THREE.TorusGeometry(0.26, 0.08, 6, 14), mats.toon(0x3f8a3a), at(-6.3, 0.52, front + 0.35));
  b.add(BOX, m.metal, at(-6.3, 0.3, front + 0.35, 0, 0.6, 0.6, 0.06));
  // the two-storey wing: hipped roof, wide windows, the balcony over its lean-to, the planter
  block(b, m, tall, hx1, back, front, 6.2);
  b.add(BOX, m.trim, at((tall + hx1) / 2, 6.18, HOUSE.z, 0, 8.9, 0.14, HOUSE.d + 0.9));
  b.add(hipRoof(8.9, HOUSE.d + 0.9, HOUSE.roof - 6.25), m.shingle, at((tall + hx1) / 2, 6.24, HOUSE.z));
  const wx = (tall + hx1) / 2;
  windowOn(b, m, mf, wx, 1.65, 3.6, 1.4);
  windowOn(b, m, mf, wx, 4.4, 3.2, 1.5);
  b.add(BOX, m.shingle, at(wx, 3.02, front + 0.55, 0, 8.3, 0.12, 1.25, 0.42));
  b.add(BOX, mats.wood, at(wx, 3.38, front + 0.38, 0, 8.0, 0.1, 0.75));
  const rail = mats.toon(0x7a4a2a);
  for (let x = tall + 0.2; x <= hx1 - 0.15; x += 0.5) b.add(BOX, rail, at(x, 3.85, front + 0.7, 0, 0.07, 0.9, 0.07));
  for (const y of [3.55, 4.28]) b.add(BOX, rail, at(wx, y, front + 0.7, 0, 7.8, 0.08, 0.09));
  b.add(BOX, m.brick, at(wx, 0.3, front + 0.45, 0, 5, 0.6, 0.9));
  for (let i = 0; i < 6; i++) bushes.push({ x: wx - 2.1 + i * 0.84, y: 0.7, z: front + 0.45, s: 0.42 + (i % 2) * 0.08 });
  // round the sides and back
  for (const z of [-18.5, -24.5]) for (const y of [1.7, 4.4]) windowOn(b, m, face(hx1, z, UP), 0, y, 1.3, 1.2);
  for (const x of [-12, -6, -0.5, 3]) windowOn(b, m, face(x, back, Math.PI), 0, 1.7, 1.4, 1.2);
  windowOn(b, m, face(1, back, Math.PI), 0, 4.4, 1.4, 1.2);
}

// The Smith house: the model fitted over the house and garage's footprint
// (front south, as it was made), or the stand-in.
export function smithHouse(b, m, mats, model, bushes) {
  if (!model) {
    smithStandIn(b, m, mats, bushes);
    return { group: null, porch: { x: -8, z: HOUSE.z + HOUSE.d / 2 } };
  }
  // its height to the depth's scale, so its rooflines stay under the cruiser's floor
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const depth = HOUSE_GARAGE.z1 - HOUSE_GARAGE.z0;
  const fit = fitModel(model, HOUSE_GARAGE, { h: (size.y * depth) / size.z });
  fit.holder.updateMatrixWorld(true);
  // where its porch step is (the model's own units: the door is 0.15 east of its middle)
  const porch = new THREE.Vector3(0.148, fit.box.min.y, 0.23).applyMatrix4(model.matrixWorld);
  return { group: fit.holder, porch: { x: porch.x, z: porch.z }, fit };
}

// ── Harry Herpson High ──

// The name in raised serif capitals, two lines, on a clear canvas.
function lettering(mats) {
  return mats.painted(
    'hhhs-name',
    1024,
    300,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `700 ${h * 0.36}px Georgia, 'Times New Roman', serif`;
      for (const [text, y] of [['HARRY HERPSON', h * 0.28], ['HIGH SCHOOL', h * 0.74]]) {
        g.fillStyle = '#4a2116';
        g.fillText(text, w / 2 + 5, y + 6);
        g.fillStyle = '#f1e4c2';
        g.fillText(text, w / 2, y);
      }
    },
    { transparent: true, repeat: [1, 1] },
  );
}

function schoolStandIn(b, m, mats, bushes) {
  const front = SCHOOL.z - SCHOOL.d / 2; // 15, facing north
  const x0 = SCHOOL.x - SCHOOL.w / 2;
  const x1 = SCHOOL.x + SCHOOL.w / 2;
  const back = SCHOOL.z + SCHOOL.d / 2;
  const ex0 = SCHOOL.x - 4.5;
  const ex1 = SCHOOL.x + 4.5;
  const band = (bx0, bx1, z0, z1, h) => {
    block(b, m, bx0, bx1, z0, z1, h, m.schoolBrick, null);
    b.add(BOX, mats.wall(0xe7d9b2), at((bx0 + bx1) / 2, h + 0.22, (z0 + z1) / 2, 0, bx1 - bx0 + 0.2, 0.44, z1 - z0 + 0.2));
    b.add(BOX, m.roofGrey, at((bx0 + bx1) / 2, h + 0.3, (z0 + z1) / 2, 0, bx1 - bx0 - 0.4, 0.44, z1 - z0 - 0.4));
  };
  // the entrance block, the single-storey wing on the left (east, seen from
  // the street) and the two-storey wing on the right (west, running back)
  band(ex0, ex1, front, front + 8, SCHOOL.h);
  band(ex1, x1, front + 0.8, front + 9, 4.6);
  band(x0, ex0, front + 0.8, back, 7.2);
  const f = face(0, front, Math.PI);
  const at2 = (x, y, out = 0) => f.on(-x, y, out);
  b.add(BOX, mats.wall(0xe7d9b2), at(...at2(SCHOOL.x, 3.5, 0.8), Math.PI, 6.2, 0.26, 1.6));
  for (const dx of [-2.8, 2.8]) b.add(CYL, mats.wall(0xe7d9b2), at(...at2(SCHOOL.x + dx, 1.7, 1.45), 0, 0.16, 3.4, 0.16));
  const doors = mats.painted('schooldoors', 256, 160, (g, w, h) => {
    g.fillStyle = '#6f7478';
    g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#bfe6f4');
    gr.addColorStop(1, '#86bcd2');
    g.fillStyle = gr;
    for (const [x, ww] of [[8, 40], [58, 66], [132, 66], [208, 40]]) g.fillRect(x, 10, ww, h - 14);
    g.fillStyle = '#c9ccd0';
    g.fillRect(120, 70, 4, 18);
    g.fillRect(134, 70, 4, 18);
  });
  b.add(BOX, doors, at(...at2(SCHOOL.x, 1.45, 0.04), Math.PI, 4.4, 2.9, 0.08));
  const many = mats.painted('bigpanes', 256, 96, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#c8ecf7');
    gr.addColorStop(1, '#8dc0d6');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e6dc';
    for (let x = 0; x <= w; x += w / 8) g.fillRect(x - 2, 0, 4, h);
    g.fillRect(0, h * 0.3 - 2, w, 4);
    g.fillRect(0, 0, w, 4);
    g.fillRect(0, h - 4, w, 4);
  });
  b.add(BOX, many, at(...at2((ex1 + x1) / 2, 2.3, 0.85), Math.PI, x1 - ex1 - 1.6, 2.5, 0.1));
  b.add(BOX, m.white, at(...at2((ex1 + x1) / 2, 0.98, 0.95), Math.PI, x1 - ex1 - 1.4, 0.1, 0.25));
  for (let i = 0; i < 4; i++) for (const y of [1.9, 5.1]) windowOn(b, m, face(0, front + 0.8, Math.PI), -(x0 + 1.6 + i * 2.45), y, 1.3, 1.25, m.white);
  // air conditioners on the roofs
  for (const [x, y, z] of [[SCHOOL.x - 1.5, SCHOOL.h + 0.5, front + 4], [SCHOOL.x + 2, SCHOOL.h + 0.5, front + 5.5], [x1 - 3, 5.1, front + 5], [x0 + 3, 7.7, front + 6]]) {
    b.add(BOX, m.metal, at(x, y + 0.45, z, 0, 1.6, 0.9, 1.2));
    b.add(CYL, m.dark, at(x, y + 0.92, z, 0, 0.8, 0.06, 0.8));
  }
  for (let x = x0 + 0.8; x < x1 - 0.5; x += 0.95) if (Math.abs(x - SCHOOL.x) > 5.4) bushes.push({ x, y: 0.45, z: front + (Math.abs(x - SCHOOL.x) < 4.6 ? -0.4 : 0.4), s: 0.55 + ((x * 7) % 1) * 0.15 });
  return { name: { x: SCHOOL.x, y: 5.9, z: front - 0.03, w: 8.2, h: 2.4 } };
}

// Harry Herpson High: the model, turned to face the street (north) and
// fitted over the rules' footprint, or the stand-in; then its name.
export function school(b, m, mats, model, bushes) {
  let name;
  let group = null;
  if (model) {
    // its height kept under the cruiser's floor over it (two metres over its roof)
    const fit = fitModel(model, { x0: SCHOOL.x - SCHOOL.w / 2, x1: SCHOOL.x + SCHOOL.w / 2, z0: SCHOOL.z - SCHOOL.d / 2, z1: SCHOOL.z + SCHOOL.d / 2 }, { turn: Math.PI, h: SCHOOL.roof + 0.2 });
    fit.holder.updateMatrixWorld(true);
    group = fit.holder;
    // the entrance block's face, over its canopy (the model's own units)
    const c = new THREE.Vector3(0.01, 0.12, 0.815).applyMatrix4(model.matrixWorld);
    name = { x: c.x, y: c.y, z: c.z - 0.04, w: 0.52 * fit.sx, h: 0.2 * fit.sy };
  } else name = schoolStandIn(b, m, mats, bushes).name;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(name.w, name.h), lettering(mats));
  plate.position.set(name.x, name.y, name.z);
  plate.rotation.y = Math.PI;
  return { group, plate };
}

// The flag: a pole, and the Stars and Stripes on a plane waved on the CPU
// (so the ink sees the same shape the picture does). update(t) waves it.
export function flagpole(b, m, mats, x, z) {
  b.add(CYL, mats.toon(0xd9dcdf), at(x, 4.6, z, 0, 0.13, 9.2, 0.13));
  b.add(new THREE.SphereGeometry(0.14, 10, 6), mats.toon(0xe8c04a), at(x, 9.25, z));
  b.add(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 14), m.concrete, at(x, 0.15, z));
  const W = 2.3;
  const H = 1.25;
  const geo = new THREE.PlaneGeometry(W, H, 14, 6);
  geo.translate(W / 2, 0, 0);
  const rest = geo.attributes.position.array.slice();
  const mat = mats.painted('usflag', 380, 200, (g, w, h) => {
    for (let i = 0; i < 13; i++) {
      g.fillStyle = i % 2 ? '#f6f3ee' : '#c3263a';
      g.fillRect(0, (i * h) / 13, w, h / 13 + 1);
    }
    g.fillStyle = '#26336e';
    g.fillRect(0, 0, w * 0.4, (h * 7) / 13);
    g.fillStyle = '#f6f3ee';
    for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) g.fillRect(8 + c * 24 + (r % 2) * 12, 6 + r * 11.5, 4, 4);
  });
  mat.side = THREE.DoubleSide;
  const flag = new THREE.Mesh(geo, mat);
  flag.position.set(x + 0.08, 8.45, z);
  flag.castShadow = true;
  const pos = geo.attributes.position;
  return {
    flag,
    update(t) {
      for (let i = 0; i < pos.count; i++) {
        const u = rest[i * 3] / W;
        const y = rest[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(u * 5.5 - t * 4.2 + y * 0.8) * 0.16 * u + Math.sin(u * 11 - t * 7) * 0.03 * u;
        pos.array[i * 3 + 1] = y - u * u * 0.08;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

// The "H.H.H.S." marquee on its brick base; `turn` faces it.
export function marquee(b, m, mats, x, z, turn) {
  const sign = mats.painted('marquee', 256, 128, (g, w, h) => {
    g.fillStyle = '#f7f4ea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d1f24';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${h * 0.36}px Georgia, 'Times New Roman', serif`;
    g.fillText('H.H.H.S.', w / 2, h * 0.32);
    g.fillStyle = '#1d1d24';
    g.font = `700 ${h * 0.15}px Arial, sans-serif`;
    g.fillText('WELCOME BACK', w / 2, h * 0.64);
    g.fillText('STUDENTS', w / 2, h * 0.82);
  });
  const p = (u, y, out = 0) => [x + u * Math.cos(turn) + out * Math.sin(turn), y, z - u * Math.sin(turn) + out * Math.cos(turn)];
  b.add(BOX, m.schoolBrick, at(...p(0, 0.55, 0), turn, 3.4, 1.1, 0.8));
  b.add(BOX, mats.wall(0xe7d9b2), at(...p(0, 1.14, 0), turn, 3.6, 0.1, 0.9));
  b.add(BOX, m.dark, at(...p(0, 1.95, 0), turn, 3.2, 1.6, 0.36));
  b.add(BOX, sign, at(...p(0, 1.95, 0.01), turn, 3.0, 1.42, 0.37));
  b.add(BOX, mats.wall(0xe7d9b2), at(...p(0, 2.8, 0), turn, 3.4, 0.12, 0.5));
}

// ── the neighbours ──

// Two designs, front to +z on a 12 × 10 footprint: a two-storey colonial
// with a side gable, a porch on columns and shutters; a one-storey ranch
// under a hipped roof with a porch along half its front and a picture
// window. Each is three instanced meshes: the walls (tinted per house), the
// roof (a colour per house) and the rest (doors, windows, trim; its own colours).
const GLASS = 0x9fd0e4;
const WHITE = 0xf4f1ea;
function colonial() {
  const walls = [
    { geo: BOX, color: 0xffffff, matrix: at(0, 2.75, 0, 0, 12, 5.5, 10) },
    { geo: gablePrism(12, 10, 2.5), color: 0xffffff, matrix: at(0, 5.5, 0) },
  ];
  const roof = gableSlabs(11.2, 10, 2.5, { over: 0.4 }).map(([geo, mm]) => ({ geo, color: 0xffffff, matrix: at(0, 5.5, 0).multiply(mm) }));
  const rest = [
    { geo: BOX, color: 0x857368, matrix: at(0, 0.25, 0, 0, 12.06, 0.5, 10.06) },
    { geo: BOX, color: 0xffffff, matrix: at(0, 1.3, 5.02, 0, 1.15, 2.3, 0.08) },
    { geo: BOX, color: 0x2f4f6e, matrix: at(0, 1.25, 5.05, 0, 0.95, 2.1, 0.06) },
    { geo: BOX, color: 0xd4d0c8, matrix: at(0, 0.1, 5.7, 0, 2.6, 0.2, 1.4) },
    { geo: BOX, color: 0x8a5a4a, matrix: at(4.6, 6.6, -2, 0, 1.0, 4.4, 0.9) },
  ];
  for (const x of [-1.1, 1.1]) rest.push({ geo: CYL, color: WHITE, matrix: at(x, 1.45, 6.1, 0, 0.18, 2.9, 0.18) });
  rest.push({ geo: gablePrism(1.6, 2.8, 0.8), color: WHITE, matrix: at(0, 2.9, 5.6, UP) });
  for (const [g, mm] of gableSlabs(1.6, 2.8, 0.8, { over: 0.12, thick: 0.12 })) rest.push({ geo: g, color: 0x56524e, matrix: at(0, 2.9, 5.6, UP).multiply(mm) });
  const win = (x, y, z, turn, w = 1.1, h = 1.4, shutters = true) => {
    const f = face(x, z, turn);
    rest.push({ geo: BOX, color: WHITE, matrix: at(...f.on(0, y, 0.06), turn, w + 0.2, h + 0.2, 0.12) });
    rest.push({ geo: BOX, color: GLASS, matrix: at(...f.on(0, y, 0.06), turn, w, h, 0.14) });
    if (shutters) for (const s of [-1, 1]) rest.push({ geo: BOX, color: 0x2e5940, matrix: at(...f.on(s * (w / 2 + 0.3), y, 0.06), turn, 0.38, h + 0.1, 0.1) });
  };
  for (const x of [-4.4, -2.4, 2.4, 4.4]) win(x, 1.9, 5, 0);
  for (const x of [-4.4, -2.2, 0, 2.2, 4.4]) win(x, 4.2, 5, 0);
  for (const s of [-1, 1]) for (const z of [-2.2, 2.2]) for (const y of [1.9, 4.2]) win(s * 6, y, z, s * UP, 1.0, 1.2, false);
  for (const x of [-3.5, 0, 3.5]) win(x, 4.2, -5, Math.PI, 1.0, 1.2, false);
  // where its front windows are, for awnings
  const awnings = [-4.4, -2.4, 2.4, 4.4].map((x) => [x, 2.8]).concat([-4.4, -2.2, 0, 2.2, 4.4].map((x) => [x, 5.1]));
  return { walls, roof, rest, awnings };
}
function ranch() {
  const walls = [{ geo: BOX, color: 0xffffff, matrix: at(0, 1.8, -0.7, 0, 12, 3.6, 8.6) }];
  const roof = [{ geo: hipRoof(12.9, 9.5, 2.6), color: 0xffffff, matrix: at(0, 3.6, -0.7) }];
  const rest = [
    { geo: BOX, color: 0x7d6f66, matrix: at(0, 0.25, -0.7, 0, 12.06, 0.5, 8.66) },
    { geo: BOX, color: 0x5a4636, matrix: at(0, 3.62, -0.7, 0, 12.9, 0.1, 9.5) },
    // the porch: a slab on posts along the east half
    { geo: BOX, color: 0x5d5853, matrix: at(2.6, 2.95, 4.35, 0, 6.6, 0.14, 1.7, 0.18) },
    { geo: BOX, color: 0xd4d0c8, matrix: at(2.6, 0.1, 4.3, 0, 6.6, 0.2, 1.4) },
    { geo: BOX, color: 0xffffff, matrix: at(1.2, 1.25, 3.62, 0, 1.15, 2.3, 0.08) },
    { geo: BOX, color: 0xb03a2e, matrix: at(1.2, 1.2, 3.65, 0, 0.95, 2.1, 0.06) },
  ];
  for (const x of [-0.5, 2.6, 5.7]) rest.push({ geo: BOX, color: WHITE, matrix: at(x, 1.45, 4.95, 0, 0.16, 2.9, 0.16) });
  const win = (x, y, z, turn, w, h) => {
    const f = face(x, z, turn);
    rest.push({ geo: BOX, color: WHITE, matrix: at(...f.on(0, y, 0.06), turn, w + 0.2, h + 0.2, 0.12) });
    rest.push({ geo: BOX, color: GLASS, matrix: at(...f.on(0, y, 0.06), turn, w, h, 0.14) });
  };
  win(-3.4, 1.9, 3.6, 0, 3.6, 1.5);
  win(3.6, 1.9, 3.6, 0, 1.2, 1.3);
  for (const s of [-1, 1]) for (const z of [-3, 1.2]) win(s * 6, 1.9, z, s * UP, 1.1, 1.2);
  for (const x of [-3.5, 0, 3.5]) win(x, 1.9, -5, Math.PI, 1.1, 1.2);
  return { walls, roof, rest, awnings: [[-3.4, 2.9], [3.6, 2.8]] };
}
const DESIGNS = [colonial, ranch];

// The houses (each { x, z, turn, kind, tint, roof }) as instanced meshes.
export function neighbourHouses(mats, houses, { shadows = true } = {}) {
  const group = new THREE.Group();
  const tmp = new THREE.Matrix4();
  const designs = [];
  DESIGNS.forEach((design, kind) => {
    const list = houses.filter((h) => h.kind === kind);
    if (!list.length) return;
    const d = design();
    designs[kind] = d;
    const parts = [
      [mergeParts(d.walls), mats.toon(0xffffff), (h) => h.tint],
      [mergeParts(d.roof), mats.toon(0xffffff), (h) => h.roof],
      [mergeParts(d.rest), mats.toon(0xffffff, { vertexColors: true }), null],
    ];
    for (const [geo, mat, colour] of parts) {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((h, i) => {
        mesh.setMatrixAt(i, tmp.makeRotationY(h.turn).setPosition(h.x, 0, h.z));
        if (colour) mesh.setColorAt(i, new THREE.Color(colour(h)));
      });
      if (colour) {
        // instance colours multiply vertex colours; these parts have none
        geo.deleteAttribute('color');
      }
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  });
  return { group, designs };
}
