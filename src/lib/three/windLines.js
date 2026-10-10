// Wind lines, Bruno Simon's (folio-2025's WindLines.js and
// WindLineGeometry.js; research note Part 2 §4): a pool of four ribbons,
// each a Catmull-Rom through four handles over 10 m zigzagging half a
// metre; a short white streak slides along it (its thickness a bell along
// the curve, times a window round the streak's place), 2 m up, turned to
// the wind and drifting a metre downwind while it plays, one spawned round
// the focus every 0.3 to 2 s. Unlit, no fog, no shadow.
//
//   windLineCurve(seed) → THREE.Vector3[31] (pure: the curve, along +x)
//   createWindLines({ wind, count = 4, radius = 20 }) → { group,
//     update(dt, focus), shift(sx, sz), dispose() }

import * as THREE from 'three';
import { seeded } from '../seeded';

const DIVISIONS = 30;

export function windLineCurve(seed = 1) {
  const rand = seeded(seed);
  const handles = [0, 1, 2, 3].map((i) => new THREE.Vector3((i / 3) * 10, 0, (rand() * 2 - 1) * 0.5));
  return new THREE.CatmullRomCurve3(handles).getPoints(DIVISIONS);
}

const VS = /* glsl */ `
attribute float aRatio;
uniform float uProgress;
varying float vAlpha;
void main() {
  // his streak: a bell along the line, times a window round where it is now
  float bell = sin(aRatio * 3.14159265);
  float window = 1.0 - smoothstep(0.0, 0.35, abs(aRatio - (uProgress * 3.0 - 1.0)));
  float thick = 0.1 * bell * window;
  vec3 p = position + normalize(vec3(0.0, 1.0, -1.0)) * thick * (normal.x);
  vAlpha = window;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const FS = /* glsl */ `
varying float vAlpha;
void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 0.7 * vAlpha); }
`;

function lineGeometry(seed) {
  const pts = windLineCurve(seed);
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3);
  const side = new Float32Array(n * 2 * 3);
  const ratio = new Float32Array(n * 2);
  pts.forEach((p, i) => {
    for (let k = 0; k < 2; k++) {
      pos.set([p.x - 5, p.y, p.z], (i * 2 + k) * 3);
      side[(i * 2 + k) * 3] = k ? -1 : 1;
      ratio[i * 2 + k] = i / (n - 1);
    }
  });
  const index = [];
  for (let i = 0; i + 1 < n; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(side, 3));
  g.setAttribute('aRatio', new THREE.BufferAttribute(ratio, 1));
  g.setIndex(index);
  return g;
}

export function createWindLines({ wind, count = 4, radius = 20, seed = 1 } = {}) {
  const rand = seeded(seed);
  const group = new THREE.Group();
  group.name = 'wind lines';
  const lines = [];
  for (let i = 0; i < count; i++) {
    const material = new THREE.ShaderMaterial({ uniforms: { uProgress: { value: 0 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(lineGeometry(seed + i), material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    lines.push({ mesh, material, age: 0, duration: 1, from: new THREE.Vector3(), dir: new THREE.Vector3() });
  }
  let next = 0.3;
  return {
    group,
    update(dt, focus) {
      const d = wind.uniforms.uWindDir.value;
      const strength = wind.uniforms.uWindStrength.value;
      next -= dt;
      if (next <= 0) {
        next = 0.3 + rand() * 1.7;
        const l = lines.find((x) => !x.mesh.visible);
        if (l) {
          l.age = 0;
          // his: 8 s in a breath, 2 s in a gale
          l.duration = 8 - 6 * Math.min(1, Math.max(0, strength));
          l.from.set(focus.x + (rand() - 0.5) * radius, 2, focus.z + (rand() - 0.5) * radius);
          l.dir.set(d.x, 0, d.y);
          l.mesh.rotation.set(0, -Math.atan2(d.y, d.x), 0);
          l.mesh.visible = true;
        }
      }
      for (const l of lines) {
        if (!l.mesh.visible) continue;
        l.age += dt;
        const k = l.age / l.duration;
        if (k >= 1) {
          l.mesh.visible = false;
          continue;
        }
        l.material.uniforms.uProgress.value = k;
        l.mesh.position.copy(l.from).addScaledVector(l.dir, k);
      }
    },
    shift(sx, sz) {
      for (const l of lines) {
        l.from.x -= sx;
        l.from.z -= sz;
        l.mesh.position.x -= sx;
        l.mesh.position.z -= sz;
      }
    },
    dispose() {
      for (const l of lines) {
        l.mesh.geometry.dispose();
        l.material.dispose();
      }
    },
  };
}
