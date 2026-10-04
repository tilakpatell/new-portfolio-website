// Bose: the device log stream as a row of levels growing in at the back,
// every third one in the accent, feeding the three-phase analysis pipeline
// in front (ingest, analyze, report), with analysis lit. The same plan as the
// SVG (Motifs.jsx, Stream).

import { color } from '../../../lib/three/renderer';
import { mix } from '../../../lib/three/theme';
import { createStage, floorBox, phase } from './stage';

const BARS = 22;
const level = (i) => 20 + ((i * 37) % 44); // the SVG's bar heights
const BAR = { pitch: 0.45, w: 0.24, scale: 0.027 };
const ROW_Z = -1.25;
const PHASES = ['INGEST', 'ANALYZE', 'REPORT'];
const BOX = { w: 2.86, h: 0.3, d: 1.3, pitch: 3.54, z: 0.95 };
const LIT = 1; // the phase drawn in the accent

const barX = (i) => (i - (BARS - 1) / 2) * BAR.pitch;

export function create(canvas, ctx) {
  const halfX = BOX.pitch + BOX.w / 2;
  const tallest = Math.max(...Array.from({ length: BARS }, (_, i) => level(i))) * BAR.scale;
  const stage = createStage(canvas, ctx, {
    bounds: { min: [-halfX, 0, ROW_Z - BAR.w], max: [halfX, tallest, BOX.z + BOX.d / 2] },
    inset: { top: 0.14, right: 0.04, bottom: 0.05, left: 0.04 },
    az: -9,
    el: 34,
    duration: 1.4,
  });
  const { THREE, root, mats, label } = stage;

  // the stream: one bar per log level, every third in the accent, the rest a
  // neutral tinted toward the text colour
  const barMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
  const barGeo = floorBox(THREE, BAR.w, 1, BAR.w);
  const bars = Array.from({ length: BARS }, (_, i) => {
    const mesh = new THREE.Mesh(barGeo, i % 3 === 0 ? mats.accent : barMat);
    mesh.position.set(barX(i), 0, ROW_Z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return { mesh, h: level(i) * BAR.scale };
  });
  label('DEVICE LOG STREAM', [barX(0) - BAR.w / 2, tallest + 0.62, ROW_Z]);

  // the pipeline: three low boxes with drawn edges, analysis tinted and
  // edged in the accent
  const litMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  const boxGeo = floorBox(THREE, BOX.w, BOX.h, BOX.d);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const boxes = PHASES.map((name, i) => {
    const group = new THREE.Group();
    const lit = i === LIT;
    const mesh = new THREE.Mesh(boxGeo, lit ? litMat : mats.plate);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh, new THREE.LineSegments(edgeGeo, lit ? mats.lineAccent : mats.line));
    group.position.set((i - 1) * BOX.pitch, 0, BOX.z);
    root.add(group);
    const tag = label(name, [group.position.x, BOX.h, BOX.z], { anchor: 'middle', accent: lit, strong: !lit });
    return { group, tag };
  });

  // dashed connectors between the phases, drawn left to right
  const gap = BOX.pitch - BOX.w;
  const links = [0, 1].map((i) => {
    const x0 = (i - 1) * BOX.pitch + BOX.w / 2 + 0.06;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, BOX.h / 2, BOX.z), new THREE.Vector3(x0, BOX.h / 2, BOX.z)]);
    const line = new THREE.Line(geo, mats.dashStrong);
    root.add(line);
    return { line, x0, len: gap - 0.12 };
  });

  const recolor = (pal) => {
    color(mix(pal.neutral, pal.text, 0.42), barMat.color);
    color(mix(pal.plate, pal.accent, 0.3), litMat.color);
  };
  recolor(stage.palette);

  // the entrance: the levels grow in left to right, then each phase rises
  // and its connector draws on to the next
  stage.onStep((t) => {
    bars.forEach((b, i) => {
      b.mesh.scale.y = Math.max(0.001, b.h * phase(t, i * 0.03, 0.6));
    });
    boxes.forEach((b, i) => {
      const p = phase(t, 0.35 + i * 0.12, 0.5);
      b.group.scale.set(1, Math.max(0.001, p), 1);
      b.tag.opacity = p;
    });
    links.forEach((l, i) => {
      const p = phase(t, 0.55 + i * 0.12, 0.45);
      const pos = l.line.geometry.attributes.position;
      pos.setX(1, l.x0 + l.len * p);
      pos.needsUpdate = true;
      l.line.geometry.computeBoundingSphere();
      l.line.computeLineDistances();
      l.line.visible = p > 0.001;
    });
  });

  return stage.view({ setColors: recolor });
}
