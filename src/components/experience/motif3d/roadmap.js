// RTX: the modernization value stream. The roadmap rail draws in at the
// back with its milestones, then the workloads lift off the on-prem plate one
// by one and set down on Xeta Cloud; the middle one stays behind. The same
// plan as the SVG (Motifs.jsx, Roadmap).

import { color } from '../../../lib/three/renderer';
import { mix } from '../../../lib/three/theme';
import { createStage, floorBox, phase } from './stage';

const S = 0.034; // world units per SVG unit
const X = (x) => (x - 160) * S;

const STOPS = [
  { x: 30, label: 'DISCOVER' },
  { x: 115, label: 'ASSESS' },
  { x: 200, label: 'MIGRATE' },
  { x: 288, label: '2028' },
];
const PLATE = { x0: X(14), x1: X(306), d: 1.6 };
const Z = { rail: -2.45, onprem: -0.9, cloud: 0.9 };
const RAIL = { x0: X(30), x1: X(288), t: 0.1 };
const BLOCK = { w: 30 * S, h: 0.55, d: 0.8 };
const STAY = 2; // the workload that stays on-prem
const LIFT = 0.55;

// when the rail (drawn with phase over `len`) reaches fraction f of its length
const reach = (f, len) => len * Math.min(1, Math.log2(1 / (1 - f * 0.98)) / 10);

// a rectangle's outline on a plate, as one line (dashable)
function outline(THREE, x0, z0, x1, z1, material) {
  const pts = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
    [x0, z0],
  ].map(([x, z]) => new THREE.Vector3(x, 0.003, z));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
  line.computeLineDistances();
  return line;
}

export function create(canvas, ctx) {
  const stage = createStage(canvas, ctx, {
    bounds: { min: [PLATE.x0, 0, Z.rail - 0.3], max: [PLATE.x1, RAIL.t + 0.42, Z.cloud + PLATE.d / 2] },
    inset: { top: 0.1, right: 0.03, bottom: 0.04, left: 0.03 },
    az: -9,
    el: 46,
    duration: 1.8,
  });
  const { THREE, root, mats, label } = stage;

  // on-prem is only a dashed outline on the floor (on its way out); the
  // cloud is a solid plate with a drawn edge
  const half = PLATE.d / 2;
  root.add(outline(THREE, PLATE.x0, Z.onprem - half, PLATE.x1, Z.onprem + half, mats.dash));
  const plateGeo = new THREE.BoxGeometry(PLATE.x1 - PLATE.x0, 0.1, PLATE.d);
  plateGeo.translate((PLATE.x0 + PLATE.x1) / 2, -0.05, Z.cloud);
  const cloud = new THREE.Mesh(plateGeo, mats.plate);
  cloud.receiveShadow = true;
  root.add(cloud, outline(THREE, PLATE.x0, Z.cloud - half, PLATE.x1, Z.cloud + half, mats.line));
  label('ON-PREM', [X(20), 0, Z.onprem - half + 0.3]);
  label('XETA CLOUD', [X(20), 0, Z.cloud - half + 0.3]);

  // the rail, drawn from its left end, and the milestones riding on it
  const railGeo = new THREE.BoxGeometry(RAIL.x1 - RAIL.x0, RAIL.t, RAIL.t);
  railGeo.translate((RAIL.x1 - RAIL.x0) / 2, RAIL.t / 2, 0);
  const rail = new THREE.Mesh(railGeo, mats.accent);
  rail.position.set(RAIL.x0, 0, Z.rail);
  rail.castShadow = true;
  root.add(rail);

  const markerGeo = new THREE.ConeGeometry(0.21, 0.4, 4);
  markerGeo.rotateY(Math.PI / 4);
  markerGeo.translate(0, 0.2, 0);
  const markers = STOPS.map((s, i) => {
    const last = i === STOPS.length - 1;
    const mesh = new THREE.Mesh(markerGeo, last ? mats.accent : mats.text);
    mesh.position.set(X(s.x), RAIL.t, Z.rail);
    mesh.castShadow = true;
    root.add(mesh);
    const at = reach((s.x - 30) / (288 - 30), 1.1);
    const tag = label(s.label, [X(s.x), RAIL.t + 0.72, Z.rail], { anchor: 'middle', accent: last });
    return { mesh, tag, at };
  });

  // the workloads: the ones that move are drawn strong, the one left behind dim
  const blockMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  const blockGeo = floorBox(THREE, BLOCK.w, BLOCK.h, BLOCK.d);
  const blocks = [0, 1, 2, 3, 4].map((a) => {
    const mesh = new THREE.Mesh(blockGeo, a === STAY ? mats.neutral : blockMat);
    mesh.position.set(X(92 + a * 40 + 15), 0, Z.onprem);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  });
  const recolor = (pal) => color(mix(pal.neutralDeep, pal.text, 0.5), blockMat.color);
  recolor(stage.palette);

  // the entrance: the rail draws in and its milestones rise as it reaches
  // them; then each workload lifts, glides forward and settles on the cloud
  stage.onStep((t) => {
    rail.scale.x = Math.max(0.001, phase(t, 0, 1.1));
    for (const m of markers) {
      const p = phase(t, m.at, 0.4);
      m.mesh.scale.setScalar(Math.max(0.001, p));
      m.mesh.visible = p > 0.001;
      m.tag.opacity = p;
    }
    blocks.forEach((mesh, a) => {
      if (a === STAY) return;
      const at = 0.5 + a * 0.1;
      const up = phase(t, at, 0.4);
      const down = phase(t, at + 0.35, 0.45);
      const move = phase(t, at + 0.12, 0.6);
      mesh.position.y = LIFT * (up - down);
      mesh.position.z = Z.onprem + (Z.cloud - Z.onprem) * move;
    });
  });

  return stage.view({ setColors: recolor });
}
