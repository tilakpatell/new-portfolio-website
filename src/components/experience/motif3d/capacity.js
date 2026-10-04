// AWS: four data-center rows of racks rising into place, the GPU capacity in
// the accent colour, open slots as dashed outlines, and one stale record
// flagged. The same plan as the SVG (Motifs.jsx, Capacity).

import { createStage, dashedBox, floorBox, phase } from './stage';

const ROWS = 4;
const COLS = 13;
const GPU = new Set([3, 4, 9, 17, 18, 22, 30, 31, 36, 44, 45]);
const EMPTY = new Set([12, 25, 38, 50, 51]);
const STALE = 28;
const PITCH_X = 0.84;
const PITCH_Z = 1.75;
const RACK = { w: 0.68, h: 1.05, d: 0.92 };

const slot = (i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  return { r, c, x: (c - (COLS - 1) / 2) * PITCH_X, z: (r - (ROWS - 1) / 2) * PITCH_Z };
};

export function create(canvas, ctx) {
  const halfX = ((COLS - 1) / 2) * PITCH_X + 0.6;
  const halfZ = ((ROWS - 1) / 2) * PITCH_Z + 0.6;
  const stage = createStage(canvas, ctx, {
    bounds: { min: [-halfX, 0, -halfZ], max: [halfX, RACK.h + 0.5, halfZ] },
    inset: { left: 0.12, bottom: 0.17, top: 0.03, right: 0.03 },
    az: -17,
    el: 34,
    duration: 1.6,
    legend: [
      ['fill', 'GPU capacity'],
      ['dash', 'Open slot'],
      ['flag', 'Stale record'],
    ],
  });
  const { THREE, root, mats, label } = stage;

  // the floor of each row
  const rowGeo = new THREE.BoxGeometry(COLS * PITCH_X + 0.3, 0.04, RACK.d + 0.3);
  rowGeo.translate(0, -0.02, 0);
  for (let r = 0; r < ROWS; r++) {
    const row = new THREE.Mesh(rowGeo, mats.plate);
    row.position.z = (r - (ROWS - 1) / 2) * PITCH_Z;
    row.receiveShadow = true;
    root.add(row);
    label(`ROW ${String.fromCharCode(65 + r)}`, [-halfX - 0.1, RACK.h * 0.45, row.position.z + RACK.d / 2], { anchor: 'end' });
  }

  // racks: every cabinet the same grey; a GPU rack's door and top are lit in
  // the accent, an ordinary rack's door is a darker grey
  const rackGeo = floorBox(THREE, RACK.w, RACK.h, RACK.d);
  const doorGeo = floorBox(THREE, RACK.w * 0.78, RACK.h * 0.86, 0.02);
  const capGeo = floorBox(THREE, RACK.w * 0.78, 0.02, RACK.d * 0.82);
  const placed = [];
  for (let i = 0; i < ROWS * COLS; i++) if (!EMPTY.has(i) && i !== STALE) placed.push(i);
  const gpuSlots = placed.filter((i) => GPU.has(i));
  const plainSlots = placed.filter((i) => !GPU.has(i));
  const glow = mats.accent.clone();
  glow.emissive = glow.color.clone();
  glow.emissiveIntensity = 0.28;
  const rackMesh = new THREE.InstancedMesh(rackGeo, mats.neutral, placed.length);
  rackMesh.castShadow = true;
  rackMesh.receiveShadow = true;
  const doorMesh = new THREE.InstancedMesh(doorGeo, mats.neutralDeep, plainSlots.length);
  const gpuDoorMesh = new THREE.InstancedMesh(doorGeo, glow, gpuSlots.length);
  const capMesh = new THREE.InstancedMesh(capGeo, glow, gpuSlots.length);
  root.add(rackMesh, doorMesh, gpuDoorMesh, capMesh);

  // open slots and the stale record: outlines only
  for (const i of EMPTY) {
    const s = slot(i);
    const box = dashedBox(THREE, RACK.w, RACK.h, RACK.d, mats.dash);
    box.position.set(s.x, 0, s.z);
    root.add(box);
  }
  const stale = slot(STALE);
  const staleBox = dashedBox(THREE, RACK.w, RACK.h, RACK.d, mats.dashAccent);
  staleBox.position.set(stale.x, 0, stale.z);
  root.add(staleBox);

  // the flag on the stale record
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8), mats.accent);
  pole.position.y = 0.31;
  pole.castShadow = true;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.36, -0.1);
  shape.lineTo(0, -0.2);
  shape.closePath();
  const cloth = new THREE.Mesh(new THREE.ShapeGeometry(shape), mats.accent);
  cloth.material = mats.accent.clone();
  cloth.material.side = THREE.DoubleSide;
  cloth.position.set(0.018, 0.62, 0);
  cloth.castShadow = true;
  flag.add(pole, cloth);
  flag.position.set(stale.x, RACK.h, stale.z);
  root.add(flag);
  const staleLabel = label('stale', [stale.x - 0.12, RACK.h + 0.5, stale.z], { anchor: 'end', accent: true });

  // the entrance: racks rise row by row, left to right, as the SVG fills
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const delay = (i) => {
    const { r, c } = slot(i);
    return (c + r * 3) * 0.028;
  };
  const pose = (mesh, slots, t, part) => {
    slots.forEach((i, k) => {
      const s = slot(i);
      const p = phase(t, delay(i), 0.55);
      const h = Math.max(0.001, p);
      pos.set(s.x, 0, s.z);
      if (part === 'door') {
        pos.z += RACK.d / 2 + 0.006;
        pos.y = RACK.h * 0.07 * h;
      } else if (part === 'cap') {
        pos.y = RACK.h * h;
      }
      scl.set(1, part === 'cap' ? 1 : h, 1);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(k, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  stage.onStep((t) => {
    pose(rackMesh, placed, t);
    pose(doorMesh, plainSlots, t, 'door');
    pose(gpuDoorMesh, gpuSlots, t, 'door');
    pose(capMesh, gpuSlots, t, 'cap');
    const f = phase(t, 0.95, 0.45);
    flag.scale.setScalar(Math.max(0.001, f));
    flag.visible = f > 0.001;
    staleLabel.opacity = f;
  });

  return stage.view({
    setColors() {
      cloth.material.color.copy(mats.accent.color);
      glow.color.copy(mats.accent.color);
      glow.emissive.copy(mats.accent.color);
    },
  });
}
