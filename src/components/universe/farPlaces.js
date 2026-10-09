// Far places as light. The places are four times further apart than they
// were (scale.js’s SPREAD), and from across the map most of them are past
// the camera’s far plane (30,000) or a few dim pixels short of it. So past
// FAR_REAL a place isn’t drawn as itself: it’s a point of light on the sky,
// at SKY_FAR (deepspace.js, where the background galaxies ride) along its
// true direction, sized to keep its true angle, in its own colour, with a
// halo, and a little brighter when it’s where you’re going. Its real mesh is
// hidden out there (and its lights with it, which ride in its group); as you
// come in, over the last 2,000 before FAR_REAL, the light fades and the
// real thing takes over. At the drives’ speeds that’s a second or two.
//
// It stands in for a place too small to draw as well, however near: a body
// under six pixels tall isn't drawn (planetLod.js), and its light is all
// there instead, fading as it grows past that (`small`, how much it's light
// because it's small, the scene's). A planet hides itself for that
// (planets.js's setLod); the sun and the wonders this hides, as it does
// once they're far.
//
// The rules (blend, spriteSize, pointsFor and the list of places) are pure
// and tested; createFarPlaces draws them: one Points for the whole
// universe, so one draw call, no textures, on every tier.
//
// createFarPlaces(parent, { places: [{ id, at, r, color, group | hide(on) }], skyFar })
//   → { points, update(camera, dt, destinationId, small(id) → 0 … 1), dispose() }
// `at` is in the parent’s space (the map’s), and the points are added to it.
// Once it's all light a place's `group` is hidden, or, where it hides itself
// for more than one reason (a planet, planets.js's setFar), its `hide(on)`
// called, for its distance alone.

import * as THREE from 'three';
import { WONDERS } from './deep';
import { POSITIONS, SUN } from './layout';
import { MOONS, UNIVERSES } from './universes';

export const FAR_REAL = 24000; // past this from the camera, a place is its light
const FADE = 2000; // and over this much short of it, the two blend
const HALO = 4; // how far the halo reaches, in the core’s radii
const MIN_PX = 2; // the least a far place is across on screen (CSS px), so it’s always a speck
const BRIGHT = 1.6; // how much brighter the place you’re headed for is

// 0 at and inside far − fade (the real thing), 1 at far and beyond (the
// light), smoothstep between
export function blend(dist, { far = FAR_REAL, fade = FADE } = {}) {
  const t = Math.min(1, Math.max(0, (dist - (far - fade)) / fade));
  return t * t * (3 - 2 * t);
}

// the radius at skyFar that subtends the angle radius r does at dist (so
// the sprite is as big on screen as the place would be)
export const spriteSize = (r, dist, skyFar) => (r * skyFar) / Math.max(dist, 1e-6);

// each place as a point of light seen from cam: its direction (unit), its
// size at skyFar, its colour and how much it’s light rather than itself (by
// its distance, or as much as `small` says, if more)
export function pointsFor(places, cam, skyFar = FAR_REAL, small = null) {
  return places.map((p) => {
    const dx = p.at[0] - cam[0];
    const dy = p.at[1] - cam[1];
    const dz = p.at[2] - cam[2];
    const dist = Math.hypot(dx, dy, dz);
    // (a camera right on a place: any direction will do, it’s the real thing then)
    const dir = dist > 1e-6 ? [dx / dist, dy / dist, dz / dist] : [0, 0, 1];
    const far = blend(dist);
    return { id: p.id, dir, size: spriteSize(p.r, dist, skyFar), color: p.color, k: small ? Math.max(far, small(p.id) ?? 0) : far, far };
  });
}

// every place that can be far off: the fandoms’ worlds (their swatch), the
// Rick and Morty sector’s, every wonder (its colour, or its first) and the
// home sun. (The home system’s stations aren’t here: they’re specks beside
// the sun from anywhere it’s light.) A nebula is soft all through, so its
// light is a smaller core than its whole width; the Maw is its disc.
const wonderR = (w) => (w.kind === 'nebula' ? w.r * 0.4 : (w.disk ?? w.r));
export const FAR_PLACES = [
  { id: 'sun', at: SUN.at, r: SUN.r, color: '#ffcf6a' },
  ...[...UNIVERSES.filter((u) => u.kind !== 'core'), ...MOONS].map((u) => ({ id: u.id, at: POSITIONS[u.id], r: u.size, color: u.swatch })),
  ...WONDERS.map((w) => ({ id: w.id, at: w.at, r: wonderR(w), color: w.color ?? w.colors?.[0] ?? '#ffb47a' })),
];

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aK;
  uniform float uScale;
  uniform float uMin;
  varying vec3 vColor;
  varying float vK;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float core = max(aSize * uScale / max(-mv.z, 1.0), uMin * 0.5); // the core's radius, px
    gl_PointSize = core * 2.0 * ${HALO.toFixed(1)};
    vColor = aColor;
    vK = aK;
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vK;
  void main() {
    float d = length(gl_PointCoord * 2.0 - 1.0) * ${HALO.toFixed(1)}; // in the core's radii
    if (d > ${HALO.toFixed(1)} || vK <= 0.0) discard;
    float core = 1.0 - smoothstep(0.6, 1.0, d);
    float edge = 1.0 - d / ${HALO.toFixed(1)};
    float halo = 0.45 * edge * edge * exp(-0.9 * max(d - 1.0, 0.0));
    gl_FragColor = vec4(vColor * (core + halo) * vK, 1.0);
  }
`;

export function createFarPlaces(parent, { places, skyFar }) {
  const n = places.length;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const col = new Float32Array(n * 3);
  const kk = new Float32Array(n);
  const base = places.map((p) => new THREE.Color(p.color));
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  const kAttr = new THREE.BufferAttribute(kk, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aColor', colAttr);
  geo.setAttribute('aK', kAttr);
  // Additive, and in the opaque list (transparent false) just after the
  // sky’s glow (skyShader.js, −10, which paints over whatever’s under it)
  // and before anything else there: with the depth test off a speck never
  // hides behind the far plane or the sky, and anything solid drawn after
  // it (a near planet in front of a far one) still covers it, where in the
  // transparent list it would be drawn over them. The galaxies and the
  // stars add on top, as light does.
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uScale: { value: 500 }, uMin: { value: MIN_PX } },
    blending: THREE.AdditiveBlending,
    transparent: false,
    depthTest: false,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'far-places';
  points.renderOrder = -9;
  points.frustumCulled = false;
  // (a point's size is in pixels: how many a unit is at a distance of one,
  // and the least a speck is, in the frame as drawn)
  const px = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    const target = renderer.getRenderTarget();
    const h = target ? target.height : renderer.getDrawingBufferSize(px).y;
    mat.uniforms.uScale.value = (h / 2) * (camera.projectionMatrix.elements[5] || 1);
    mat.uniforms.uMin.value = MIN_PX * (h / (renderer.domElement.clientHeight || h / renderer.getPixelRatio()));
  };
  parent.add(points);

  const hidden = places.map(() => false); // (what this has done to each group, so it only ever undoes its own)
  const show = (p, on) => {
    if (p.hide) p.hide(!on);
    else if (p.group) p.group.visible = on;
  };
  const glow = places.map(() => 1); // the destination's brightening, eased
  const camAt = new THREE.Vector3();
  const cam = [0, 0, 0];
  return {
    points,
    update(camera, dt = 1 / 60, destinationId = null, small = null) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
      cam[0] = camAt.x;
      cam[1] = camAt.y;
      cam[2] = camAt.z;
      const pts = pointsFor(places, cam, skyFar, small);
      const ease = Math.min(1, dt * 3);
      pts.forEach((p, i) => {
        pos[i * 3] = cam[0] + p.dir[0] * skyFar;
        pos[i * 3 + 1] = cam[1] + p.dir[1] * skyFar;
        pos[i * 3 + 2] = cam[2] + p.dir[2] * skyFar;
        size[i] = p.size;
        glow[i] += ((p.id === destinationId ? BRIGHT : 1) - glow[i]) * ease;
        col[i * 3] = base[i].r * glow[i];
        col[i * 3 + 1] = base[i].g * glow[i];
        col[i * 3 + 2] = base[i].b * glow[i];
        kk[i] = p.k;
        // the real thing hidden once it's all light (its lights ride in its
        // group); a place that hides itself is told only of its distance
        const hide = (places[i].hide ? p.far : p.k) >= 1;
        if (hide !== hidden[i]) show(places[i], !hide);
        hidden[i] = hide;
      });
      posAttr.needsUpdate = sizeAttr.needsUpdate = colAttr.needsUpdate = kAttr.needsUpdate = true;
    },
    dispose() {
      places.forEach((p, i) => {
        if (hidden[i]) show(p, true);
      });
      parent.remove(points);
      geo.dispose();
      mat.dispose();
    },
  };
}
