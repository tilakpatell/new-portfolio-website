// The hyperlanes themselves, drawn: each carriageway (hyperlanes.js) as a
// thin ribbon of pale blue light along the floor of its tube (R below the
// middle, along ride.js's frame's up, so a pilot riding the lane sees it
// streaming by underneath, not through the ships), a few pixels wide on the
// screen however far off it is (1.2 px far, up to 2.5 close to: the quads
// widened in screen space, as galaxy/skyStreaks.js's are). Brightness by
// tier: the express 0.9, a trunk 0.6, a local lane 0.35. Along it runs a
// pattern of soft dashes, bright at the front and trailing back, moving
// forward at half the lane's speed: at the full speed a pilot riding with
// the traffic would see it standing still; at half it flows on seen from
// afar, and streams back past a pilot in it. Seen from more than 16,000
// away it fades, and is gone at 20,000. All of it one mesh, one draw, made
// once: 48 segments a carriageway. Additive and not writing depth. No
// textures. The same on every tier: the ribbons are the cheap part.
//
// The clock: the wall's, about 1.8e9 seconds, too big for a float; so how
// far along the dashes have moved, `t × speed × 0.5` modulo a dash, is
// worked out here in doubles for each tier and handed to the shader.
//
// createLaneRibbons(parent, { lanes, reduced }) → { mesh, segments, update(t, camera, renderer?), dispose() }

import * as THREE from 'three';
import { LANES, R, TIERS } from './hyperlanes';
import { frame } from './ride';

export const SEGMENTS = 48; // a carriageway
export const DASH = 240; // map units, a dash and its gap
export const FLOW = 0.5; // of the lane's speed, the dashes
export const FADE = [16000, 20000]; // from the camera: all there, gone
export const BRIGHT = { local: 0.35, trunk: 0.6, express: 0.9 };
const ORDER = ['local', 'trunk', 'express']; // (the shader's tier index)
const WAYS = ['out', 'in'];
const COLOR = [0.75, 0.9, 1.3]; // pale hyperspace blue

// how far along the dashes have moved at t, each tier's, modulo a dash
export const shiftOf = (t, speed) => {
  const x = (t * speed * FLOW) % DASH;
  return x < 0 ? x + DASH : x;
};

const VERT = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec4 aInfo; // arclength at the start and at the end, the tier (0 local, 1 trunk, 2 express), how bright
attribute float aS; // s at this end
uniform vec2 uHalf; // half the picture, in pixels
uniform float uPx; // the pixel ratio
uniform vec2 uFar; // fade out from, to (from the camera)
varying float vSide;
varying float vArc;
varying float vTier;
varying float vFade;
void main() {
  vSide = position.y;
  vTier = aInfo.z;
  vec4 a = modelViewMatrix * vec4(aStart, 1.0);
  vec4 b = modelViewMatrix * vec4(aEnd, 1.0);
  float fa = 1.0 - smoothstep(uFar.x, uFar.y, length(a.xyz));
  float fb = 1.0 - smoothstep(uFar.x, uFar.y, length(b.xyz));
  vFade = aInfo.w * mix(fa, fb, position.x) * smoothstep(0.0, 0.01, aS) * (1.0 - smoothstep(0.99, 1.0, aS));
  // (both ends too far, or behind the camera: none of it; part behind: cut
  // off at the near side; decided from both ends, so a quad's corners agree)
  const float NEAR = -0.2;
  if (max(fa, fb) <= 0.0 || (a.z > NEAR && b.z > NEAR)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  // (and how far along the segment each end now is, so the dashes keep
  // their places on the segment the camera's in: a rider's, right under it)
  float ka = 0.0;
  float kb = 1.0;
  if (b.z > NEAR) {
    kb = (NEAR - a.z) / (b.z - a.z);
    b.xyz = mix(a.xyz, b.xyz, kb);
  }
  if (a.z > NEAR) {
    ka = 1.0 - (NEAR - b.z) / (a.z - b.z);
    a.xyz = mix(a.xyz, b.xyz, ka);
  }
  vArc = mix(aInfo.x, aInfo.y, mix(ka, kb, position.x));
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uHalf;
  float l = length(d);
  vec2 dir = l > 1e-4 ? d / l : vec2(1.0, 0.0);
  vec4 c = mix(ca, cb, position.x);
  // half a width: 0.6 px far (1.2 across), up to 1.25 close to
  float w = uPx * clamp(1500.0 / max(-mix(a.z, b.z, position.x), 1.0), 0.6, 1.25);
  c.xy += vec2(-dir.y, dir.x) * position.y * w / uHalf * c.w;
  gl_Position = c;
}`;

const FRAG = /* glsl */ `
uniform vec3 uShift; // each tier's, local, trunk, express
uniform float uDash;
uniform vec3 uColor;
varying float vSide;
varying float vArc;
varying float vTier;
varying float vFade;
void main() {
  float core = 1.0 - vSide * vSide;
  core *= core;
  float shift = vTier < 0.5 ? uShift.x : vTier < 1.5 ? uShift.y : uShift.z;
  // a soft dash, brightest just behind its front, which moves forward
  float f = fract((vArc - shift) / uDash);
  float dash = f * f * f * (1.0 - smoothstep(0.94, 1.0, f));
  gl_FragColor = vec4(uColor * vFade * core * (0.3 + 0.9 * dash), 1.0);
}`;

// (`level` is taken and changes nothing: the ribbons stay on every tier)
export function createLaneRibbons(parent, { lanes = LANES, reduced = false } = {}) {
  const ways = lanes.flatMap((lane) => WAYS.map((way) => ({ lane, way })));
  const segments = ways.length * SEGMENTS;
  const quads = 4 * segments;
  const corner = new Float32Array(quads * 3);
  const start = new Float32Array(quads * 3);
  const end = new Float32Array(quads * 3);
  const info = new Float32Array(quads * 4);
  const along = new Float32Array(quads);
  const index = new Uint32Array(segments * 6);
  let q = 0;
  for (const { lane, way } of ways) {
    // the tube's floor, sampled, and how far along it each sample is
    const pts = [];
    const arc = [0];
    for (let k = 0; k <= SEGMENTS; k++) {
      const f = frame(lane, way, k / SEGMENTS);
      pts.push([f.at[0] - f.up[0] * R, f.at[1] - f.up[1] * R, f.at[2] - f.up[2] * R]);
      if (k) arc.push(arc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]));
    }
    const tier = ORDER.indexOf(lane.tier);
    const bright = BRIGHT[lane.tier];
    for (let k = 0; k < SEGMENTS; k++) {
      const o = q * 4;
      [
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 1],
      ].forEach(([e, side], j) => {
        const v = o + j;
        corner.set([e, side, 0], v * 3);
        start.set(pts[k], v * 3);
        end.set(pts[k + 1], v * 3);
        info.set([arc[k], arc[k + 1], tier, bright], v * 4);
        along[v] = (k + e) / SEGMENTS;
      });
      index.set([o, o + 2, o + 1, o + 1, o + 2, o + 3], q * 6);
      q++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(corner, 3)); // (the corners: x which end, y which side)
  geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 3));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  geo.setAttribute('aS', new THREE.BufferAttribute(along, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uHalf: { value: new THREE.Vector2(960, 540) }, // (until a renderer says)
      uPx: { value: 1 },
      uFar: { value: new THREE.Vector2(FADE[0], FADE[1]) },
      uShift: { value: new THREE.Vector3() },
      uDash: { value: DASH },
      uColor: { value: new THREE.Color(...COLOR) },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'laneRibbons';
  mesh.frustumCulled = false; // (placed in the shader, from the ends)
  mesh.renderOrder = 1; // (before the streaks, laneStreaks.js)
  parent.add(mesh);

  const px = new THREE.Vector2();
  return {
    mesh,
    segments,
    // t: the wall's clock in seconds (laneFlow.js's)
    update(t, camera, renderer = null) {
      if (reduced) t = 0; // (with reduced motion the dashes hold still)
      mat.uniforms.uShift.value.set(shiftOf(t, TIERS.local.speed), shiftOf(t, TIERS.trunk.speed), shiftOf(t, TIERS.express.speed));
      if (renderer) {
        renderer.getDrawingBufferSize(px);
        mat.uniforms.uHalf.value.set(Math.max(1, px.x / 2), Math.max(1, px.y / 2));
        mat.uniforms.uPx.value = renderer.getPixelRatio();
      }
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
