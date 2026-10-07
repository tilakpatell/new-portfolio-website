// Minecraft, the sky: the game's colours (a plains sky, 0x78a7ff, from its
// temperature as the game works it out; the fog's colour at the horizon,
// drawn toward the sky's the further the render distance), the pack's
// square sun on its east-to-west arc, and the cloud layer at y = 128 from
// the pack's cloud map, a texel to a 12-block cell, drifting 0.03 blocks a
// tick as the game's do. Phase 1 holds noon; Phase 3 turns the day.
// Everything here follows the camera, drawn first, behind the terrain.

import * as THREE from 'three';

export const CLOUDS_Y = 128;
const CELL = 12;
const SUN_DISTANCE = 300;
const SUN_SIZE = 90; // the game's 30 at 100

// The game's sky colour for a biome's temperature (0.8 for plains), as an
// [r, g, b] in 0–1.
export function skyColour(temperature = 0.8) {
  const f = Math.max(-1, Math.min(1, temperature / 3));
  return hsb(0.6222222 - f * 0.05, 0.5 + f * 0.1, 1);
}
function hsb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
}
// The fog's colour: the game's pale blue, drawn toward the sky's by the render distance.
export function fogColour(sky, distance, daylight = 1) {
  const base = [0.7529412 * daylight, 0.84705883 * daylight, 1 * daylight];
  const f = 1 - Math.pow(0.25 + (0.75 * distance) / 32, 0.25);
  return base.map((c, i) => c + (sky[i] * daylight - c) * f);
}

const domeVertex = /* glsl */ `
out vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
const domeFragment = /* glsl */ `
uniform vec3 sky;
uniform vec3 fog;
in vec3 vDir;
void main() {
  float t = smoothstep(-0.02, 0.32, vDir.y);
  gl_FragColor = vec4(mix(fog, sky, t), 1.0);
}
`;
const cloudVertex = /* glsl */ `
uniform vec2 offset;
out vec2 vCell;
out float vDist;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vCell = (world.xz + offset) / ${CELL.toFixed(1)};
  vDist = length(world.xz - cameraPosition.xz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
const cloudFragment = /* glsl */ `
uniform sampler2D map;
uniform vec3 fog;
uniform float far;
in vec2 vCell;
in float vDist;
void main() {
  vec4 t = texture(map, fract(vCell / 256.0));
  if (t.a < 0.5) discard;
  float fade = 1.0 - smoothstep(far * 0.6, far, vDist);
  gl_FragColor = vec4(mix(fog, vec3(1.0), fade), 0.8 * fade);
}
`;
const sunFragment = /* glsl */ `
uniform sampler2D map;
in vec2 vUv;
void main() {
  gl_FragColor = vec4(texture(map, vec2(vUv.x, 1.0 - vUv.y)).rgb, 1.0);
}
`;
const sunVertex = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export function createSky(scene, { sun, clouds }) {
  const sky = new THREE.Vector3(...skyColour());
  const fog = new THREE.Vector3(...fogColour(skyColour(), 10));
  const group = new THREE.Group();
  group.name = 'sky';
  scene.add(group);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(500, 24, 12),
    new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: domeVertex, fragmentShader: domeFragment, uniforms: { sky: { value: sky }, fog: { value: fog } }, side: THREE.BackSide, depthWrite: false, depthTest: false }),
  );
  dome.renderOrder = -3;
  dome.frustumCulled = false;
  group.add(dome);

  const sunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SUN_SIZE, SUN_SIZE),
    new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: sunVertex, fragmentShader: sunFragment, uniforms: { map: { value: sun } }, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }),
  );
  sunMesh.renderOrder = -2;
  sunMesh.frustumCulled = false;
  group.add(sunMesh);

  const cloudMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: cloudVertex,
    fragmentShader: cloudFragment,
    uniforms: { map: { value: clouds }, offset: { value: new THREE.Vector2() }, fog: { value: fog }, far: { value: 300 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  if (clouds) {
    clouds.wrapS = clouds.wrapT = THREE.RepeatWrapping;
    clouds.needsUpdate = true;
  }
  const cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), cloudMaterial);
  cloudPlane.renderOrder = 3;
  cloudPlane.frustumCulled = false;
  group.add(cloudPlane);

  return {
    sky,
    fog,
    // the time of day in ticks (noon 6000), the camera, the render distance in blocks
    update(time, camera, far, ticks) {
      dome.position.copy(camera.position);
      // the sun's arc: up at noon, set in the west at 12000, round the x axis as the game turns it
      const angle = ((time - 6000) / 24000) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0);
      sunMesh.position.copy(camera.position).addScaledVector(dir, SUN_DISTANCE);
      sunMesh.lookAt(camera.position);
      const size = Math.max(far * 2.2, 400);
      cloudPlane.scale.set(size, 1, size);
      cloudPlane.position.set(camera.position.x, CLOUDS_Y, camera.position.z);
      cloudMaterial.uniforms.offset.value.set(ticks * 0.03, 0);
      cloudMaterial.uniforms.far.value = size / 2;
    },
    setFog(distance) {
      fog.set(...fogColour(skyColour(), distance));
    },
    dispose() {
      scene.remove(group);
      for (const m of [dome, sunMesh, cloudPlane]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  };
}
