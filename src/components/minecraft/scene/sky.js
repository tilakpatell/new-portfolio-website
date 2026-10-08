// Minecraft, the sky, by the hour (rules/time.js has the game's sums): the
// biome's sky colour over the fog's at the horizon, both dimming to near
// black at night; the orange glow low toward the sun at sunrise and sunset;
// the pack's square sun on its east-to-west arc and the moon opposite in
// its eight phases; the stars (1500 of them, as the game scatters them)
// fading in as the sky darkens; and the cloud layer at y = 128 from the
// pack's cloud map, a texel to a 12-block cell, drifting 0.03 blocks a tick
// and greying at night as the game's do. Everything follows the camera,
// drawn first, behind the terrain.

import * as THREE from 'three';
import { seeded } from '../../../lib/seeded.js';
import { moonPhase, skyColours, starBrightness, sunAngle, sunrise } from '../rules/time.js';

export const CLOUDS_Y = 128;
const CELL = 12;
const SUN_DISTANCE = 300;
const SUN_SIZE = 90; // the game's 30 at 100
const MOON_SIZE = 60; // the game's 20 at 100

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

const domeVertex = /* glsl */ `
out vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
const domeFragment = /* glsl */ `
layout(location = 0) out highp vec4 outColour;
uniform vec3 sky;
uniform vec3 fog;
uniform vec4 glow; // the sunrise's colour and strength
uniform vec3 sunDir;
in vec3 vDir;
void main() {
  float t = smoothstep(-0.02, 0.32, vDir.y);
  vec3 c = mix(fog, sky, t);
  // the glow: low in the sky, on the sun's side
  vec2 h = normalize(vDir.xz + 1e-5);
  vec2 s = normalize(sunDir.xz + 1e-5);
  float side = smoothstep(0.2, 1.0, dot(h, s));
  float low = 1.0 - smoothstep(-0.1, 0.45, abs(vDir.y - 0.05));
  c = mix(c, glow.rgb, glow.a * side * low);
  outColour = vec4(c, 1.0);
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
layout(location = 0) out highp vec4 outColour;
uniform sampler2D map;
uniform vec3 fog;
uniform vec3 tint;
uniform float far;
in vec2 vCell;
in float vDist;
void main() {
  vec4 t = texture(map, fract(vCell / 256.0));
  if (t.a < 0.5) discard;
  float fade = 1.0 - smoothstep(far * 0.6, far, vDist);
  outColour = vec4(mix(fog, tint, fade), 0.8 * fade);
}
`;
const spriteVertex = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const spriteFragment = /* glsl */ `
layout(location = 0) out highp vec4 outColour;
uniform sampler2D map;
uniform vec4 frame; // the part of the picture: u, v, width, height
uniform float strength;
in vec2 vUv;
void main() {
  vec2 uv = frame.xy + vec2(vUv.x, 1.0 - vUv.y) * frame.zw;
  outColour = vec4(texture(map, uv).rgb * strength, 1.0);
}
`;
const starVertex = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
  gl_PointSize = 2.0;
}
`;
const starFragment = /* glsl */ `
layout(location = 0) out highp vec4 outColour;
uniform float strength;
void main() {
  outColour = vec4(vec3(strength), 1.0);
}
`;

export function createSky(scene, { sun, moon, clouds }) {
  const sky = new THREE.Vector3(...skyColour());
  const fog = new THREE.Vector3();
  const group = new THREE.Group();
  group.name = 'sky';
  scene.add(group);
  let distance = 10;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(500, 24, 12),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      uniforms: { sky: { value: new THREE.Vector3() }, fog: { value: fog }, glow: { value: new THREE.Vector4() }, sunDir: { value: new THREE.Vector3(0, 1, 0) } },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  dome.renderOrder = -4;
  dome.frustumCulled = false;
  group.add(dome);

  // the stars: 1500 points on a sphere, a seeded scatter so they're the same each night
  const rand = seeded(10842);
  const pts = [];
  for (let i = 0; i < 1500; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pts.push(r * Math.cos(a) * 400, u * 400, r * Math.sin(a) * 400);
  }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: starVertex, fragmentShader: starFragment, uniforms: { strength: { value: 0 } }, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  stars.renderOrder = -3;
  stars.frustumCulled = false;
  group.add(stars);

  const sprite = (map, size) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: spriteVertex, fragmentShader: spriteFragment, uniforms: { map: { value: map }, frame: { value: new THREE.Vector4(0, 0, 1, 1) }, strength: { value: 1 } }, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }),
    );
    m.renderOrder = -2;
    m.frustumCulled = false;
    m.visible = Boolean(map);
    group.add(m);
    return m;
  };
  const sunMesh = sprite(sun, SUN_SIZE);
  const moonMesh = sprite(moon, MOON_SIZE);

  const cloudMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: cloudVertex,
    fragmentShader: cloudFragment,
    uniforms: { map: { value: clouds }, offset: { value: new THREE.Vector2() }, fog: { value: fog }, tint: { value: new THREE.Vector3(1, 1, 1) }, far: { value: 300 } },
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
  cloudPlane.visible = Boolean(clouds);
  group.add(cloudPlane);

  const dir = new THREE.Vector3();
  return {
    fog,
    // the time of day in ticks, the camera, the render distance in blocks, the ticks for the clouds' drift
    update(time, camera, far, ticks) {
      const c = skyColours(time, [sky.x, sky.y, sky.z], distance);
      dome.material.uniforms.sky.value.set(...c.sky);
      fog.set(...c.fog);
      const glow = sunrise(time);
      dome.material.uniforms.glow.value.set(...(glow ?? [0, 0, 0, 0]));
      dome.position.copy(camera.position);
      stars.position.copy(camera.position);
      stars.material.uniforms.strength.value = starBrightness(time);
      // the sky turns about the north–south axis: the sun up in the east, down in the west
      const a = sunAngle(time);
      dir.set(-Math.sin(a), Math.cos(a), 0);
      stars.rotation.z = a;
      dome.material.uniforms.sunDir.value.copy(dir);
      sunMesh.position.copy(camera.position).addScaledVector(dir, SUN_DISTANCE);
      sunMesh.lookAt(camera.position);
      moonMesh.position.copy(camera.position).addScaledVector(dir, -SUN_DISTANCE);
      moonMesh.lookAt(camera.position);
      // the moon's picture is four by two phases
      const phase = moonPhase(time);
      moonMesh.material.uniforms.frame.value.set((phase % 4) / 4, Math.floor(phase / 4) / 2, 0.25, 0.5);
      // clouds grey with the night, as the game's
      const f = Math.max(0, Math.min(1, Math.cos(a) * 2 + 0.5));
      cloudMaterial.uniforms.tint.value.set(f * 0.9 + 0.1, f * 0.9 + 0.1, f * 0.85 + 0.15);
      const size = Math.max(far * 2.2, 400);
      cloudPlane.scale.set(size, 1, size);
      cloudPlane.position.set(camera.position.x, CLOUDS_Y, camera.position.z);
      cloudMaterial.uniforms.offset.value.set(ticks * 0.03, 0);
      cloudMaterial.uniforms.far.value = size / 2;
    },
    setFog(n) {
      distance = n;
    },
    dispose() {
      scene.remove(group);
      for (const m of [dome, stars, sunMesh, moonMesh, cloudPlane]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  };
}
