// Empowerreg: complaint severity by device class as a field of bars, each
// as tall and as far toward the accent as its severity, with the hot cluster
// standing out in the third row. Grows in from the back corner diagonally.
// The same plan as the SVG (Motifs.jsx, Heatmap).

import { color } from '../../../lib/three/renderer';
import { mix } from '../../../lib/three/theme';
import { createStage, floorBox, phase } from './stage';

const ROWS = 6;
const COLS = 16;
const PITCH_X = 0.62;
const PITCH_Z = 0.64;
const CELL = 0.5;
const LOW = 0.06; // height of a cell with no complaints
const TALL = 1.5; // added height at full severity

// the SVG's severity, 0 to 0.95
const v = (r, c) => {
  const x = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
  const base = x - Math.floor(x);
  return r === 2 && c > 8 && c < 13 ? 0.95 : base * (0.35 + (c / COLS) * 0.55);
};

const cell = (i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  return { r, c, x: (c - (COLS - 1) / 2) * PITCH_X, z: (r - (ROWS - 1) / 2) * PITCH_Z, s: v(r, c) };
};

export function create(canvas, ctx) {
  const halfX = ((COLS - 1) / 2) * PITCH_X + CELL / 2 + 0.12;
  const halfZ = ((ROWS - 1) / 2) * PITCH_Z + CELL / 2 + 0.12;
  const stage = createStage(canvas, ctx, {
    bounds: { min: [-halfX, 0, -halfZ], max: [halfX, LOW + TALL * 0.95, halfZ] },
    inset: { top: 0.04, right: 0.03, bottom: 0.08, left: 0.03 },
    az: -16,
    el: 40,
    duration: 1.5,
  });
  const { THREE, root, mats, label } = stage;

  // the board the cells stand on
  const boardGeo = new THREE.BoxGeometry(halfX * 2, 0.04, halfZ * 2);
  boardGeo.translate(0, -0.02, 0);
  const board = new THREE.Mesh(boardGeo, mats.plate);
  board.receiveShadow = true;
  root.add(board);
  label('SEVERITY BY DEVICE CLASS', [-halfX, 0, halfZ + 0.5]);

  // one instanced bar per cell, coloured per instance
  const cells = Array.from({ length: ROWS * COLS }, (_, i) => cell(i));
  const barMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 });
  const bars = new THREE.InstancedMesh(floorBox(THREE, CELL, 1, CELL), barMat, cells.length);
  bars.castShadow = true;
  bars.receiveShadow = true;
  root.add(bars);

  // Height carries the severity; colour marks the hot spots. Ordinary cells
  // are greys that gain contrast with severity, and only the hottest take
  // the accent. (A straight blend toward the accent, as the SVG does, goes
  // olive with a lime accent on navy, in any colour space.)
  const HOT = 0.75;
  const tint = new THREE.Color();
  const recolor = (pal) => {
    cells.forEach((k, i) => {
      const rgb = k.s >= HOT ? pal.accent : mix(pal.surface2, pal.text, 0.1 + 0.3 * (k.s / HOT));
      bars.setColorAt(i, color(rgb, tint));
    });
    bars.instanceColor.needsUpdate = true;
  };
  recolor(stage.palette);

  // the entrance: each bar rises to its severity, along the diagonals
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  stage.onStep((t) => {
    cells.forEach((k, i) => {
      const p = phase(t, (k.r + k.c) * 0.04, 0.6);
      pos.set(k.x, 0, k.z);
      scl.set(1, Math.max(0.001, (LOW + TALL * k.s) * p), 1);
      m.compose(pos, q, scl);
      bars.setMatrixAt(i, m);
    });
    bars.instanceMatrix.needsUpdate = true;
  });

  return stage.view({ setColors: recolor });
}
