// The traffic in every hyperlane, far off, drawn: each flow ship of
// laneFlow.js (every ship of every carriageway, a convoy's each counted) as
// a streak of pale hyperspace blue-white light, its head at the ship and its
// tail back along the lane by its speed over 300 (1 to 8 map units), so a
// lane seen from across the map reads as a thread of moving light. All of
// them in one mesh, one draw: an instanced quad a ship, laid out once (the
// flow is a sum of the clock and each slot's numbers, so nothing about a
// ship changes but where it is), and the GPU works out where: each instance
// carries its carriageway's three Bézier points, its place across the tube,
// its rate (laps a second) and the lap it was at when the clock was last
// set, and the vertex shader does `s = fract(phase0 + rate × (t − t0))` and
// ride.js's frame() from there. The CPU does nothing a frame for a ship.
//
// The clock: the wall's (laneFlow.js), about 1.8e9 seconds, far past what a
// float on the GPU holds to a lap's thousandth; so the lap each ship is on
// at an epoch t0 is worked out here in doubles (laneFlow.js's lapAt), only
// how far round it is goes up, and the shader is handed t − t0. Every five
// minutes it starts again from a new t0.
//
// Each streak is at least 1.5 px across and 1.5 px long on the screen however
// far off it is (the quad widened in screen space, as galaxy/skyStreaks.js's
// are, and out past each end by as much), so a lane 20,000 units off still
// shows; it fades out between 22,000 and 29,000 from the camera (the far
// plane's 30,000), and over the first and last hundredth of its lane, so the
// wrap from the end back to the start doesn't pop. Express ships (the
// sides' capital ships) are bigger and brighter; a convoy's civilians, and
// civilians anywhere, are warmer. Additive and not writing depth; it does
// test it, so a planet hides the lane behind it. No textures.
//
// A ship shot down (laneFlow.js's kill, the scene's `dead` Map) is hidden
// until it's back: update walks only the dead, and touches the GPU's copy
// only when one goes or comes back.
//
// createLaneStreaks(parent, { lanes, level: 'high' | 'low' | 'small', side })
//   → { mesh, count, update(t, camera, dead, renderer?), setSide(id), dispose() }
//   level: 'low' draws every second ship, 'small' every fourth (the same
//   ones every time); side: the crew's side's id, for the lanes no side
//   holds (which ships are civilians, so which are warm)

import * as THREE from 'three';
import { LANES, TIERS, carriageway } from './hyperlanes';
import { countFor, isDead, lapAt, slotOf } from './laneFlow';
import { SIDES } from './sides';

export const REBASE = 300; // seconds before the epoch's set again
export const FADE = [22000, 29000]; // from the camera: all there, gone
export const EDGE = 0.01; // of the lane, faded in at the start and out at the end
export const STEP = { high: 1, mid: 1, low: 2, small: 4 }; // every how many ships drawn
export const tailOf = (speed) => Math.min(8, Math.max(1, speed / 300));

const WAYS = ['out', 'in'];
const BLUE = [1.6, 1.8, 2.4]; // the site's hyperspace colour (galaxy/skyStreaks.js)
const WARM = [2.4, 1.9, 1.3];
const BRIGHT = { local: 0.5, trunk: 0.7, express: 1 }; // by tier
const SIZE = { local: 1, trunk: 1, express: 1.6 }; // across, by tier
const CIVIL = new Set(Object.values(SIDES).flatMap((s) => s.civil));

const VERT = /* glsl */ `
attribute vec3 aA; // the carriageway's Bézier points
attribute vec3 aB;
attribute vec3 aC;
attribute vec4 aFlow; // u, v (across the tube: right and up), laps a second, the lap at t0
attribute vec4 aLook; // colour, and how wide
attribute float aTail; // map units back along the lane
attribute float aAlive;
uniform float uT; // seconds since t0
uniform vec2 uHalf; // half the picture, in pixels
uniform float uPx; // the pixel ratio
uniform vec2 uFar; // fade out from, to (from the camera)
uniform vec2 uNear; // and in, close to
varying vec3 vColor;
varying float vAlong;
varying float vSide;
void main() {
  vAlong = position.x;
  vSide = position.y;
  float s = fract(aFlow.w + aFlow.z * uT);
  float u = 1.0 - s;
  // where on the lane, and ride.js's frame() there
  vec3 at = u * u * aA + 2.0 * u * s * aB + s * s * aC;
  vec3 along = normalize(2.0 * u * (aB - aA) + 2.0 * s * (aC - aB));
  vec3 right = normalize(vec3(-along.z, 0.0, along.x));
  vec3 up = cross(right, along);
  vec3 head = at + right * aFlow.x + up * aFlow.y;
  vec4 h = modelViewMatrix * vec4(head, 1.0);
  vec4 t = modelViewMatrix * vec4(head - along * aTail, 1.0);
  float dist = length(h.xyz);
  float fade = aAlive * smoothstep(0.0, ${EDGE}, s) * (1.0 - smoothstep(${1 - EDGE}, 1.0, s));
  fade *= (1.0 - smoothstep(uFar.x, uFar.y, dist)) * smoothstep(uNear.x, uNear.y, dist);
  vColor = aLook.rgb * fade;
  // (behind the camera: none of it; part behind: cut off at the near side)
  const float NEAR = -0.2;
  if (fade <= 0.0 || (h.z > NEAR && t.z > NEAR)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (h.z > NEAR) h.xyz = mix(t.xyz, h.xyz, (NEAR - t.z) / (h.z - t.z));
  if (t.z > NEAR) t.xyz = mix(h.xyz, t.xyz, (NEAR - h.z) / (t.z - h.z));
  vec4 ch = projectionMatrix * h;
  vec4 ct = projectionMatrix * t;
  vec2 d = (ch.xy / ch.w - ct.xy / ct.w) * uHalf;
  float l = length(d);
  vec2 dir = l > 1e-4 ? d / l : vec2(1.0, 0.0);
  vec2 across = vec2(-dir.y, dir.x);
  vec4 c = mix(ct, ch, position.x);
  // half a width at least 0.9 px however far (so 1.8 px across, and as long
  // with the ends), more close to; out past each end by as much
  float w = uPx * aLook.w * clamp(900.0 / max(-mix(t.z, h.z, position.x), 1.0), 0.9, 2.5);
  c.xy += (across * position.y + dir * (position.x * 2.0 - 1.0)) * w / uHalf * c.w;
  gl_Position = c;
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlong;
varying float vSide;
void main() {
  float core = 1.0 - vSide * vSide;
  core *= core * core;
  float tail = 0.25 + 0.75 * vAlong * vAlong;
  float head = smoothstep(0.8, 1.0, vAlong);
  gl_FragColor = vec4(vColor * core * (tail + 0.8 * head), 1.0);
}`;

// a ship's colour and width: by tier, warm for a civilian, a little
// brighter or dimmer each by its slot's phase
function lookOf(lane, slot, m) {
  const kind = slot.kinds[m];
  const warm = lane.tier !== 'express' && CIVIL.has(kind);
  const c = warm ? WARM : BLUE;
  const k = BRIGHT[lane.tier] * (0.85 + 0.3 * ((slot.phase * 7.31) % 1));
  return [c[0] * k, c[1] * k, c[2] * k, SIZE[lane.tier]];
}

export function createLaneStreaks(parent, { lanes = LANES, level = 'high', side = null } = {}) {
  const step = STEP[level] ?? 1;
  // every ship, in the same order every time, every `step`th kept
  const ships = [];
  let g = 0;
  for (const lane of lanes)
    for (const way of WAYS) {
      const pts = carriageway(lane, way);
      const n = countFor(lane);
      for (let i = 0; i < n; i++) {
        const slot = slotOf(lane, way, i, side);
        for (let m = 0; m < slot.column; m++) if (g++ % step === 0) ships.push({ lane, way, i, m, pts, slot, key: `${lane.id}|${way}|${i}|${m}` });
      }
    }
  const count = ships.length;
  const byKey = new Map(ships.map((s, k) => [s.key, k]));

  const geo = new THREE.InstancedBufferGeometry();
  // the quad's corners: x 0 at the tail, 1 at the head; y −1 or 1 across
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0]), 3));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  const A = new Float32Array(count * 3);
  const B = new Float32Array(count * 3);
  const C = new Float32Array(count * 3);
  const flow = new Float32Array(count * 4);
  const look = new Float32Array(count * 4);
  const tail = new Float32Array(count);
  const alive = new Float32Array(count).fill(1);
  ships.forEach((s, k) => {
    A.set(s.pts[0], k * 3);
    B.set(s.pts[1], k * 3);
    C.set(s.pts[2], k * 3);
    const speed = s.slot.v * TIERS[s.lane.tier].speed;
    flow.set([s.slot.off[0], s.slot.off[1], speed / s.lane.length, 0], k * 4);
    look.set(lookOf(s.lane, s.slot, s.m), k * 4);
    tail[k] = tailOf(speed);
  });
  const attr = (name, array, size) => {
    const a = new THREE.InstancedBufferAttribute(array, size);
    geo.setAttribute(name, a);
    return a;
  };
  attr('aA', A, 3);
  attr('aB', B, 3);
  attr('aC', C, 3);
  const flowAttr = attr('aFlow', flow, 4);
  const lookAttr = attr('aLook', look, 4);
  attr('aTail', tail, 1);
  const aliveAttr = attr('aAlive', alive, 1).setUsage(THREE.DynamicDrawUsage);
  geo.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uT: { value: 0 },
      uHalf: { value: new THREE.Vector2(960, 540) }, // (until a renderer says: at 1 × 1, every streak would fill the screen)
      uPx: { value: 1 },
      uFar: { value: new THREE.Vector2(FADE[0], FADE[1]) },
      uNear: { value: new THREE.Vector2(2, 12) },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'laneStreaks';
  mesh.frustumCulled = false; // (the quads are placed in the shader; the box three would test is meaningless)
  mesh.renderOrder = 2; // (after the ribbons, laneRibbons.js)
  parent.add(mesh);

  // the epoch, and each ship's lap then, in doubles
  let t0 = null;
  const rebase = (t) => {
    t0 = t;
    ships.forEach((s, k) => {
      const x = lapAt(s.lane, s.way, s.i, s.m, t);
      flow[k * 4 + 3] = x - Math.floor(x);
    });
    flowAttr.needsUpdate = true;
  };

  // the dead now hidden, by laneFlow.js's key
  const hidden = new Set();
  const show = (key, on) => {
    alive[byKey.get(key)] = on ? 1 : 0;
    if (on) hidden.delete(key);
    else hidden.add(key);
  };
  const walkDead = (t, dead) => {
    let changed = false;
    if (dead?.size)
      for (const key of dead.keys()) {
        const k = byKey.get(key);
        if (k === undefined) continue; // (a ship this level doesn't draw)
        const s = ships[k];
        // (isDead forgets one that's come back round, so the loop below shows it)
        if (isDead(dead, s.lane, s.way, s.i, s.m, t) && !hidden.has(key)) {
          show(key, false);
          changed = true;
        }
      }
    for (const key of hidden)
      if (!dead?.has(key)) {
        show(key, true);
        changed = true;
      }
    if (changed) aliveAttr.needsUpdate = true;
  };

  const px = new THREE.Vector2();
  return {
    mesh,
    count,
    // t: the wall's clock in seconds (laneFlow.js's); dead: the scene's Map
    update(t, camera, dead = null, renderer = null) {
      if (t0 === null || t - t0 > REBASE || t < t0) rebase(t);
      mat.uniforms.uT.value = t - t0;
      if (renderer) {
        renderer.getDrawingBufferSize(px);
        mat.uniforms.uHalf.value.set(Math.max(1, px.x / 2), Math.max(1, px.y / 2));
        mat.uniforms.uPx.value = renderer.getPixelRatio();
      }
      if (dead?.size || hidden.size) walkDead(t, dead);
    },
    // the crew's side changed: which ships are civilians, on the lanes no side holds
    setSide(id) {
      ships.forEach((s, k) => {
        s.slot = slotOf(s.lane, s.way, s.i, id);
        look.set(lookOf(s.lane, s.slot, s.m), k * 4);
      });
      lookAttr.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
