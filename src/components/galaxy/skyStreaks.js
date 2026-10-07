// Hyperspace traffic in the sky, drawn: skyTraffic.js's streaks (ships
// jumping out along the lanes' courses and dropping in along them) as
// lines of pale blue-white light, the site's hyperspace colour, bright at
// the head and fading back along the tail. All of them in one mesh, one draw:
// a quad a streak, its four corners worked out in the vertex shader from
// the head and the tail, a few pixels wide on the screen however far off it
// is (wider close to), so a ship leaving from the planet and one out by the
// sky both read. Additive and not writing depth; it does test it, so the
// planet hides a ship behind it until it's out past the limb. The sky's
// drawn on the far plane and writes no depth, so it never hides them.
// No textures: the glow's worked out in the fragment shader.
//
// createSkyStreaks({ renderer, rand }) → { group, setSystem(links, r), update(dt), live, dispose() }
//   setSystem: the lanes' links from here (skyTraffic.js laneLinks) and the
//   planet's radius; none with no links (the group draws nothing then)

import * as THREE from 'three';
import { STREAKS, createSkyTraffic, streakAt } from './skyTraffic';

const VERT = /* glsl */ `
attribute vec3 aHead;
attribute vec3 aTail;
attribute vec3 aCorner; // x: 0 the tail, 1 the head; y: -1 or 1 across; z: how bright
uniform vec2 uHalf; // half the picture, in pixels
uniform float uWidth; // half the line's width, in pixels, far off
varying float vAlong;
varying float vSide;
varying float vFade;
void main() {
  vec4 h = modelViewMatrix * vec4(aHead, 1.0);
  vec4 t = modelViewMatrix * vec4(aTail, 1.0);
  vFade = aCorner.z;
  vAlong = aCorner.x;
  vSide = aCorner.y;
  // (behind the camera: none of it; part behind: cut off at the near side)
  const float NEAR = -0.2;
  if ((h.z > NEAR && t.z > NEAR) || aCorner.z <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (h.z > NEAR) h.xyz = mix(t.xyz, h.xyz, (NEAR - t.z) / (h.z - t.z));
  if (t.z > NEAR) t.xyz = mix(h.xyz, t.xyz, (NEAR - h.z) / (t.z - h.z));
  vec4 ch = projectionMatrix * h;
  vec4 ct = projectionMatrix * t;
  vec2 d = (ch.xy / ch.w - ct.xy / ct.w) * uHalf;
  float l = length(d);
  vec2 along = l > 1e-4 ? d / l : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  vec4 c = mix(ct, ch, aCorner.x);
  // a few pixels wide, more close to; and out past each end by as much, so a
  // streak seen end on is a spark, not nothing
  float w = uWidth * clamp(160.0 / max(-mix(t.z, h.z, aCorner.x), 1.0), 1.0, 2.6);
  c.xy += (across * aCorner.y + along * (aCorner.x * 2.0 - 1.0)) * w / uHalf * c.w;
  gl_Position = c;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlong;
varying float vSide;
varying float vFade;
void main() {
  float core = 1.0 - vSide * vSide;
  core *= core * core;
  float tail = vAlong * vAlong;
  float head = smoothstep(0.8, 1.0, vAlong);
  vec3 c = uColor * core * tail + vec3(1.6) * core * head;
  gl_FragColor = vec4(c * vFade, 1.0);
}`;

export function createSkyStreaks({ renderer, rand = Math.random } = {}) {
  const group = new THREE.Group();
  const n = STREAKS.max;
  const geo = new THREE.BufferGeometry();
  const head = new Float32Array(n * 4 * 3);
  const tail = new Float32Array(n * 4 * 3);
  const corner = new Float32Array(n * 4 * 3);
  const index = [];
  for (let i = 0; i < n; i++) {
    [
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 1],
    ].forEach(([a, s], j) => corner.set([a, s, 0], (i * 4 + j) * 3));
    const o = i * 4;
    index.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  }
  geo.setIndex(index);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3)); // (unused: the corners are worked out from the ends)
  geo.setAttribute('aHead', new THREE.BufferAttribute(head, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aTail', new THREE.BufferAttribute(tail, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uHalf: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 1.3 }, uColor: { value: new THREE.Color(1.6, 1.8, 2.4) } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // (left visible with nothing to draw, not hidden: three draws nothing for
  // an empty range, and the scene's warm-up compiles only what's visible, so
  // the first ship out doesn't stall a frame compiling it)
  geo.setDrawRange(0, 0);
  group.add(mesh);

  let traffic = createSkyTraffic({ links: [], rand });
  let radius = 1;
  const px = new THREE.Vector2();
  return {
    group,
    get live() {
      return traffic.live.length;
    },
    setSystem(links, r) {
      traffic = createSkyTraffic({ links, rand });
      radius = r;
    },
    update(dt) {
      const live = traffic.update(dt);
      if (!live.length) {
        geo.setDrawRange(0, 0);
        return;
      }
      renderer?.getDrawingBufferSize(px);
      mat.uniforms.uHalf.value.set(Math.max(1, px.x / 2), Math.max(1, px.y / 2));
      mat.uniforms.uWidth.value = 1.3 * (renderer?.getPixelRatio() ?? 1);
      for (let i = 0; i < n; i++) {
        const s = live[i] ? streakAt(live[i], { r: radius }) : null;
        for (let j = 0; j < 4; j++) {
          const v = (i * 4 + j) * 3;
          if (s) {
            head.set(s.head, v);
            tail.set(s.tail, v);
          }
          corner[v + 2] = s ? s.fade : 0;
        }
      }
      geo.setDrawRange(0, Math.min(live.length, n) * 6);
      geo.attributes.aHead.needsUpdate = true;
      geo.attributes.aTail.needsUpdate = true;
      geo.attributes.aCorner.needsUpdate = true;
    },
    dispose() {
      group.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
