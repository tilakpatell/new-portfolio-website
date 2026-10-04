// Pendar: a spectrum waterfall. Earlier acquisitions stand in rows behind,
// fainter the older they are, and the newest spectrum, the SVG's own line,
// draws in left to right at the front in the accent. The same plan as the SVG
// (Motifs.jsx, Spectrum), with time as depth.

import { color } from '../../../lib/three/renderer';
import { mix } from '../../../lib/three/theme';
import { createStage, phase } from './stage';

// the SVG's spectrum (x, y in its viewBox; the baseline is y = 146)
const PATH = [
  [20, 140], [40, 138], [55, 135], [66, 120], [72, 72], [78, 124], [92, 132], [110, 130],
  [124, 118], [131, 92], [138, 120], [156, 128], [178, 126], [190, 104], [196, 40], [202, 108],
  [214, 124], [236, 128], [252, 120], [260, 96], [268, 122], [286, 134], [304, 137],
];
const SX = 0.034;
const SY = 0.033;
const X = (x) => (x - 162) * SX;
const OLDER = 4;
const ROW = 0.78; // depth between acquisitions
const FRONT = 1.2;
const AXIS = { x: X(14), y: 3.7, z: FRONT + 0.32, back: FRONT - OLDER * ROW - 0.32 };
const SEGMENTS = 240;
const RADIAL = 8;

// an older run: the same peaks, at intensities that drift from run to run
const intensity = (x, y, k) => (146 - y) * (k ? 0.6 + 0.28 * Math.sin(x * 0.045 + k * 2.1) : 1);

// a vertical sheet from the floor up to the curve, ordered left to right
// along the curve, so a draw range reveals it as the line draws
function curtain(THREE, curve) {
  const pos = new Float32Array((SEGMENTS + 1) * 6);
  const nor = new Float32Array((SEGMENTS + 1) * 6);
  const index = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= SEGMENTS; j++) {
    curve.getPointAt(j / SEGMENTS, p);
    pos.set([p.x, 0, p.z, p.x, p.y, p.z], j * 6);
    nor.set([0, 0, 1, 0, 0, 1], j * 6);
    if (j < SEGMENTS) index.push(j * 2, j * 2 + 2, j * 2 + 1, j * 2 + 1, j * 2 + 2, j * 2 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(index);
  return g;
}

export function create(canvas, ctx) {
  const stage = createStage(canvas, ctx, {
    bounds: { min: [AXIS.x, 0, AXIS.back], max: [X(304), 2.8, AXIS.z] },
    inset: { top: 0.06, right: 0.03, bottom: 0.1, left: 0.03 },
    az: -12,
    el: 26,
    duration: 1.6,
  });
  const { THREE, root, mats, label } = stage;

  // the floor the runs stand on
  const plateGeo = new THREE.BoxGeometry(X(304) - AXIS.x + 0.2, 0.04, AXIS.z - AXIS.back);
  plateGeo.translate((X(304) + AXIS.x) / 2 + 0.1, -0.02, (AXIS.z + AXIS.back) / 2);
  const plate = new THREE.Mesh(plateGeo, mats.plate);
  plate.receiveShadow = true;
  root.add(plate);

  // the axes along the plate's front and left edges, ticks as in the SVG
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const axisPts = [v(AXIS.x, 0.002, AXIS.z), v(X(304), 0.002, AXIS.z), v(AXIS.x, 0, AXIS.z), v(AXIS.x, AXIS.y, AXIS.z), v(AXIS.x, 0.002, AXIS.z), v(AXIS.x, 0.002, AXIS.back)];
  for (const x of [60, 100, 140, 180, 220, 260, 300]) axisPts.push(v(X(x), 0.002, AXIS.z), v(X(x), 0.002, AXIS.z + 0.14));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(axisPts), mats.line));
  label('INTENSITY', [AXIS.x + 0.12, AXIS.y + 0.2, AXIS.z]);
  label('WAVENUMBER', [X(304), 0, AXIS.z + 0.62], { anchor: 'end' });

  // the runs: a sheet under each line so nearer runs hide the ones behind
  const runs = [];
  for (let k = OLDER; k >= 0; k--) {
    const z = FRONT - k * ROW;
    const pts = PATH.map(([x, y]) => v(X(x), intensity(x, y, k) * SY, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const sheetMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    const lineMat = k ? new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }) : mats.accent;
    const sheet = new THREE.Mesh(curtain(THREE, curve), sheetMat);
    const line = new THREE.Mesh(new THREE.TubeGeometry(curve, SEGMENTS, k ? 0.016 : 0.034, RADIAL, false), lineMat);
    sheet.castShadow = true; // onto the floor; the runs don't shade each other
    line.castShadow = true;
    const group = new THREE.Group();
    group.add(sheet, line);
    root.add(group);
    runs.push({ k, group, sheet, line, sheetMat, lineMat });
  }
  const front = runs[runs.length - 1];

  // older runs fade toward the floor colour, the newest is tinted by the accent
  const recolor = (pal) => {
    for (const r of runs) {
      if (!r.k) {
        color(mix(pal.plate, pal.accent, 0.16), r.sheetMat.color);
        continue;
      }
      const age = (r.k - 1) / (OLDER - 1);
      color(mix(pal.neutral, pal.plate, 0.3 + age * 0.45), r.sheetMat.color);
      color(mix(pal.neutralDeep, pal.plate, 0.1 + age * 0.5), r.lineMat.color);
    }
  };
  recolor(stage.palette);

  // the entrance: the older runs rise from the back forward, then the newest
  // draws in left to right
  stage.onStep((t) => {
    for (const r of runs) {
      if (!r.k) continue;
      const p = phase(t, (OLDER - r.k) * 0.08, 0.6);
      r.group.scale.y = Math.max(0.001, p);
    }
    const n = Math.round(phase(t, 0.3, 1.3) * SEGMENTS);
    front.line.geometry.setDrawRange(0, n * RADIAL * 6);
    front.sheet.geometry.setDrawRange(0, n * 6);
    front.group.visible = n > 0;
  });

  return stage.view({ setColors: recolor });
}
