// The ship's engine trail: a ribbon of light laid behind it as it flies,
// in its crew's colour, bright where it leaves the engines (bright enough to
// bloom) and thinning and fading behind, longer the faster it goes. One
// draw; the ribbon is rebuilt from the last second of the ship's path each
// frame.
//
// createTrail() → { mesh, setColor(color), update(dt, tail, amount), clear(), dispose() }
// `tail` is where the engines are, in the mesh's parent's space.

import * as THREE from 'three';

const POINTS = 40; // samples along the trail
const LIFE = 0.9; // seconds a sample lasts
const WIDTH = 0.05;

const VERT = `
attribute float aFade;
varying float vFade;
void main() {
  vFade = aFade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = `
uniform vec3 uColor;
varying float vFade;
void main() {
  gl_FragColor = vec4(uColor * vFade * vFade, 1.0);
}`;

export function createTrail() {
  const pos = new Float32Array(POINTS * 2 * 3);
  const fade = new Float32Array(POINTS * 2);
  const index = [];
  for (let i = 0; i < POINTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uColor: { value: new THREE.Color(1, 1, 1) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  const hot = new THREE.Color();
  // the path: newest first, each { x, y, z, age }
  const path = [];
  let since = 0;
  let level = 0;

  return {
    mesh,
    setColor(color) {
      hot.set(color).multiplyScalar(3.2);
    },
    // amount: 0 (engines idle) … 1 (full boost)
    update(dt, tail, amount) {
      level += (amount - level) * Math.min(1, dt * 4);
      for (const p of path) p.age += dt;
      while (path.length && path[path.length - 1].age > LIFE) path.pop();
      since += dt;
      if (level > 0.02 && since > LIFE / POINTS) {
        since = 0;
        path.unshift({ x: tail.x, y: tail.y, z: tail.z, age: 0 });
        if (path.length > POINTS) path.length = POINTS;
      } else if (path.length) {
        // the newest point rides with the engines between samples
        path[0].x = tail.x;
        path[0].y = tail.y;
        path[0].z = tail.z;
      }
      mesh.visible = path.length > 1 && level > 0.01;
      if (!mesh.visible) return;
      mat.uniforms.uColor.value.copy(hot).multiplyScalar(level);
      const n = path.length;
      for (let i = 0; i < POINTS; i++) {
        const at = Math.min(i, n - 1);
        const p = path[at];
        const q = path[at + 1 < n ? at + 1 : Math.max(0, at - 1)]; // a neighbour, for the path's direction
        // across the path, flat (it's seen from a little above)
        let dx = q.x - p.x;
        let dz = q.z - p.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const k = i < n ? 1 - p.age / LIFE : 0;
        const w = WIDTH * k * (0.4 + 0.6 * level);
        pos.set([p.x - dz * w, p.y, p.z + dx * w, p.x + dz * w, p.y, p.z - dx * w], i * 6);
        fade[i * 2] = fade[i * 2 + 1] = Math.max(0, k);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aFade.needsUpdate = true;
    },
    clear() {
      path.length = 0;
      level = 0;
      mesh.visible = false;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
