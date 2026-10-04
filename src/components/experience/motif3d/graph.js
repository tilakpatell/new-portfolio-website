// SRC: a knowledge graph of extracted triplets floating over a radar scope.
// The rings spread out on the floor and the sweep turns into place, then the
// nodes rise off the scope and the edges draw in between them. The same plan
// as the SVG (Motifs.jsx, Graph), with the graph lifted off the floor.

import { color } from '../../../lib/three/renderer';
import { createStage, phase } from './stage';

const S = 0.044; // world units per SVG unit
const RINGS = [30, 58, 86].map((r) => r * S);
const SWEEP = Math.atan2(40 - 84, 236 - 160); // toward the SVG's (236, 40)

// [x, y] in the SVG, height above the scope, label
const NODES = [
  [160, 84, 1.25, 'subject'],
  [96, 50, 0.8],
  [226, 46, 1.05, 'object'],
  [236, 120, 0.65],
  [106, 128, 0.95],
  [60, 92, 0.55],
  [272, 82, 0.85],
  [168, 140, 0.6],
];
const EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 6], [3, 6], [4, 7], [3, 7],
];
const OUTLINE = 0.028;

export function create(canvas, ctx) {
  const stage = createStage(canvas, ctx, {
    bounds: { min: [(60 - 160) * S + 0.3, 0, -RINGS[2] * 0.85], max: [(272 - 160) * S - 0.2, 1.2, RINGS[2] * 0.9] },
    inset: { top: 0.1, right: 0.03, bottom: 0.02, left: 0.03 },
    az: -10,
    el: 27,
    duration: 1.5,
  });
  const { THREE, root, mats, label } = stage;
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  // the scope: three rings on the floor and the sweep line
  const circle = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 97 }, (_, i) => v(Math.cos((i / 96) * Math.PI * 2), 0.003, Math.sin((i / 96) * Math.PI * 2))));
  const rings = RINGS.map((r) => {
    const ring = new THREE.Line(circle, mats.line);
    ring.userData.r = r;
    root.add(ring);
    return ring;
  });
  const sweep = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v(0, 0.004, 0), v(RINGS[2], 0.004, 0)]), mats.lineAccent);
  root.add(sweep);

  // the nodes: subject and object in the accent, the rest neutral, each with
  // an outline in the text colour as the SVG draws them
  const inkMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  const nodes = NODES.map(([sx, sy, h, name], i) => {
    const r = i === 0 ? 0.25 : 0.16;
    const ball = new THREE.Group();
    const geo = new THREE.SphereGeometry(r, 32, 16);
    const body = new THREE.Mesh(geo, name ? mats.accent : mats.neutral);
    body.castShadow = true;
    const ink = new THREE.Mesh(geo, inkMat);
    ink.scale.setScalar((r + OUTLINE) / r);
    ball.add(body, ink);
    root.add(ball);
    const x = (sx - 160) * S;
    const z = (sy - 84) * S;
    const tag = name ? label(name, [x, h + r + 0.28, z], { anchor: 'middle', strong: true }) : null;
    return { ball, x, z, h, tag, at: 0.15 + i * 0.06 };
  });

  // a dashed stalk down from each node to its place on the scope
  const stalkGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NODES.length * 6), 3));
  const stalks = new THREE.LineSegments(stalkGeo, mats.dash);
  stalks.frustumCulled = false;
  root.add(stalks);

  // the edges, each drawn from its first node toward its second
  const edgeGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(EDGES.length * 6), 3));
  const edges = new THREE.LineSegments(edgeGeo, mats.lineStrong);
  edges.frustumCulled = false;
  root.add(edges);
  const mid = nodes[0].ball.position;
  const relation = label('relation', [0, 0, 0], { anchor: 'middle' });

  const recolor = (pal) => {
    color(pal.text, inkMat.color);
  };
  recolor(stage.palette);

  // the entrance
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  stage.onStep((t) => {
    rings.forEach((ring, i) => {
      const s = Math.max(0.001, phase(t, i * 0.08, 0.7) * ring.userData.r);
      ring.scale.set(s, 1, s);
    });
    const turn = SWEEP - (1 - phase(t, 0, 1.1)) * Math.PI * 0.6;
    sweep.rotation.y = -turn;

    const sp = stalkGeo.attributes.position;
    nodes.forEach((n, i) => {
      const p = phase(t, n.at, 0.55);
      n.ball.position.set(n.x, n.h * p, n.z);
      n.ball.scale.setScalar(Math.max(0.001, p));
      n.ball.visible = p > 0.001;
      sp.setXYZ(i * 2, n.x, 0.004, n.z);
      sp.setXYZ(i * 2 + 1, n.x, n.h * p, n.z);
      if (n.tag) n.tag.opacity = p;
    });
    sp.needsUpdate = true;
    stalks.computeLineDistances();

    const ep = edgeGeo.attributes.position;
    EDGES.forEach(([i, j], k) => {
      const p = phase(t, 0.45 + k * 0.06, 0.5);
      a.copy(nodes[i].ball.position);
      b.copy(nodes[j].ball.position).sub(a).multiplyScalar(p).add(a);
      ep.setXYZ(k * 2, a.x, a.y, a.z);
      ep.setXYZ(k * 2 + 1, b.x, b.y, b.z);
      if (k === 1) {
        relation.pos.copy(mid).lerp(nodes[j].ball.position, 0.65);
        relation.pos.y -= 0.42;
        relation.opacity = p;
      }
    });
    ep.needsUpdate = true;
  });

  return stage.view({ setColors: recolor });
}
