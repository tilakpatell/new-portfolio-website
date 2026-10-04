// An engine's exhaust: a thin plume of light laid behind it as it flies,
// in its ship's colour with a white-hot core along its middle, soft at its
// edges, narrow at the nozzle, swelling a little, then thinning to nothing,
// longer the faster it goes, up to a flame's length (`length`, in map units:
// seen from behind and above, anything longer runs off the bottom of the
// screen). Rick's cruiser's ripples like portal plasma and
// sheds sparks of portal green when it boosts.
// It always turns its face to the camera (so it never shows as a flat strip
// edge-on or end-on) and is gone well before it reaches the camera (by
// four fifths of the way from its engine to the lens, so riding close
// behind, it never fills the screen). One draw a plume; a ship has one for
// each engine.
//
// createTrail({ width, life, length, wobble, sparks }) → { mesh, setColors(color, core),
//   update(dt, t, nozzle, amount, camera), clear(), dispose() }
// (mesh carries the sparks too, as a child)
// `nozzle` and `camera` are in the mesh's parent's space.

import * as THREE from 'three';

const POINTS = 36; // samples along the plume

const VERT = `
attribute float aFade;
attribute float aSide;
attribute float aAlong;
uniform vec3 uCam;
varying float vFade;
varying float vSide;
varying float vAlong;
varying float vDist;
void main() {
  vFade = aFade;
  vSide = aSide;
  vAlong = aAlong;
  vDist = distance(position, uCam);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uTime;
uniform float uWobble;
varying float vFade;
varying float vSide;
varying float vAlong;
varying float vDist;
void main() {
  float across = 1.0 - abs(vSide); // 1 down the middle, 0 at the edges
  float body = across * across * (3.0 - 2.0 * across);
  float core = pow(across, 7.0) * (1.0 - vAlong);
  // a flicker running back along it (busier for the plasma)
  float flick = 0.82 + 0.18 * sin(vAlong * (24.0 + 30.0 * uWobble) - uTime * (34.0 + 20.0 * uWobble));
  float near = smoothstep(0.45, 1.5, vDist); // gone before it reaches the camera
  vec3 c = (uColor * body + uCore * core) * vFade * vFade * flick * near;
  gl_FragColor = vec4(c, 1.0);
}`;

const SPARK_VERT = `
attribute float aLife;
uniform float uDpr;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(uDpr * (0.9 + aLife * 1.6) * (5.0 / -mv.z), 0.0, 6.0 * uDpr);
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = `
uniform vec3 uColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vLife * vLife;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

// sparks: a few motes shed at the nozzle, drifting and dying (in the parent's space)
function sparkCloud(count) {
  const pos = new Float32Array(count * 3);
  const lifeAttr = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLife', new THREE.BufferAttribute(lifeAttr, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    uniforms: { uColor: { value: new THREE.Color() }, uDpr: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const motes = Array.from({ length: count }, () => ({ v: [0, 0, 0], age: 1, max: 1 }));
  let next = 0;
  let owed = 0;
  return {
    points,
    update(dt, nozzle, rate, color) {
      mat.uniforms.uColor.value.copy(color);
      owed += rate * dt;
      while (owed >= 1) {
        owed -= 1;
        const i = next;
        next = (next + 1) % count;
        const m = motes[i];
        m.age = 0;
        m.max = 0.25 + Math.random() * 0.35;
        m.v = [(Math.random() - 0.5) * 0.5, (Math.random() - 0.3) * 0.4, (Math.random() - 0.5) * 0.5];
        pos.set([nozzle.x, nozzle.y, nozzle.z], i * 3);
      }
      let any = false;
      motes.forEach((m, i) => {
        m.age += dt;
        const k = Math.max(0, 1 - m.age / m.max);
        if (k > 0) any = true;
        pos[i * 3] += m.v[0] * dt;
        pos[i * 3 + 1] += m.v[1] * dt;
        pos[i * 3 + 2] += m.v[2] * dt;
        lifeAttr[i] = k;
      });
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      points.visible = any;
    },
    clear() {
      for (const m of motes) m.age = m.max;
      lifeAttr.fill(0);
      points.visible = false;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createTrail({ width = 0.026, life = 0.5, length = 0.35, wobble = 0, sparks = 0 } = {}) {
  const pos = new Float32Array(POINTS * 2 * 3);
  const fade = new Float32Array(POINTS * 2);
  const along = new Float32Array(POINTS * 2);
  const side = new Float32Array(POINTS * 2);
  const index = [];
  for (let i = 0; i < POINTS; i++) {
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < POINTS - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new THREE.Color() },
      uCore: { value: new THREE.Color() },
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uWobble: { value: wobble },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  // the sparks ride alongside the plume, not inside it (so they show while it's hidden)
  const cloud = sparks ? sparkCloud(sparks) : null;
  const holder = new THREE.Group();
  holder.add(mesh);
  if (cloud) holder.add(cloud.points);
  const sparkColour = new THREE.Color();
  const colour = new THREE.Color();
  const hot = new THREE.Color();
  const path = []; // newest first: { x, y, z, age }
  const dir = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const across = new THREE.Vector3();
  const lift = new THREE.Vector3(0, 1, 0);
  let since = 0;
  let level = 0;
  const phase = Math.random() * 6.28;

  return {
    mesh: holder,
    // its colour, and the white-hot core's (both brighter than white, so they bloom a little)
    setColors(color, core = '#ffffff') {
      colour.set(color).multiplyScalar(1.5);
      hot.set(core).multiplyScalar(1.9);
      sparkColour.set(color).lerp(new THREE.Color(core), 0.35).multiplyScalar(2.2);
    },
    // amount: 0 (engines idle) … 1 (full boost)
    update(dt, t, nozzle, amount, camera) {
      level += (amount - level) * Math.min(1, dt * 5);
      for (const p of path) p.age += dt;
      while (path.length && path[path.length - 1].age > life) path.pop();
      since += dt;
      if (level > 0.02 && since > life / POINTS) {
        since = 0;
        path.unshift({ x: nozzle.x, y: nozzle.y, z: nozzle.z, age: 0 });
        if (path.length > POINTS) path.length = POINTS;
      } else if (path.length) {
        // the newest point rides with the nozzle between samples
        path[0].x = nozzle.x;
        path[0].y = nozzle.y;
        path[0].z = nozzle.z;
      }
      // sparks only past cruising, more the harder it boosts
      if (cloud) cloud.update(dt, nozzle, Math.max(0, level - 0.55) * 90, sparkColour);
      mesh.visible = path.length > 1 && level > 0.01;
      if (!mesh.visible) return;
      const u = mat.uniforms;
      u.uColor.value.copy(colour).multiplyScalar(level);
      u.uCore.value.copy(hot).multiplyScalar(level);
      u.uCam.value.copy(camera);
      u.uTime.value = t;
      const reach = Math.hypot(camera.x - nozzle.x, camera.y - nozzle.y, camera.z - nozzle.z); // engine to lens
      // no longer than a flame: the samples past `length` along it go
      let run = 0;
      for (let i = 1; i < path.length; i++) {
        run += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z);
        path[i].run = run;
        if (run > length) {
          path.length = i + 1;
          break;
        }
      }
      path[0].run = 0;
      const n = path.length;
      for (let i = 0; i < POINTS; i++) {
        const at = Math.min(i, n - 1);
        const p = path[at];
        const q = path[at + 1 < n ? at + 1 : Math.max(0, at - 1)]; // a neighbour, for the plume's direction
        dir.set(q.x - p.x, q.y - p.y, q.z - p.z);
        toCam.set(camera.x - p.x, camera.y - p.y, camera.z - p.z);
        across.crossVectors(dir, toCam);
        if (across.lengthSq() < 1e-12) across.crossVectors(dir.lengthSq() > 1e-12 ? dir : lift, lift);
        across.normalize();
        // 0 at the nozzle, 1 where it's gone: by age, or by coming too near the lens
        const lens = Math.hypot(camera.x - p.x, camera.y - p.y, camera.z - p.z) / reach;
        const k = i < n ? Math.min(1, Math.max(p.age / life, p.run / length, 1 - Math.min(1, Math.max(0, (lens - 0.2) / 0.3)))) : 1;
        // a flame's shape: a little narrow right at the nozzle, swelling,
        // then thinning away (faster than it fades)
        const w = width * (0.6 + 0.4 * Math.sin(Math.min(1, k * 5) * Math.PI * 0.5)) * (1 - k) ** 1.6 * (0.5 + 0.5 * level);
        // the plasma's ripple: the middle line weaving side to side, more as it goes
        const weave = wobble ? Math.sin(p.age * 26 + phase) * width * wobble * k : 0;
        const cx = p.x + across.x * weave;
        const cy = p.y + across.y * weave;
        const cz = p.z + across.z * weave;
        pos.set([cx - across.x * w, cy - across.y * w, cz - across.z * w, cx + across.x * w, cy + across.y * w, cz + across.z * w], i * 6);
        fade[i * 2] = fade[i * 2 + 1] = i < n ? 1 - k : 0;
        along[i * 2] = along[i * 2 + 1] = Math.min(1, k);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aFade.needsUpdate = true;
      geo.attributes.aAlong.needsUpdate = true;
    },
    clear() {
      path.length = 0;
      level = 0;
      mesh.visible = false;
      cloud?.clear();
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      cloud?.dispose();
    },
  };
}
