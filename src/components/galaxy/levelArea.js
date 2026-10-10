// An area of its own for a space level that isn't fought in space (Kamino's
// Starfighter Assault, low over Tipoca City in the storm): a dome of the
// level's own sky round the battle, its sea under the city's stilts, and the
// storm's fog over everything in it while you're inside. The galaxy round it
// (the planet, the stars, the system's places) is shut out by the dome; from
// outside it's a ball of storm off the planet. Drawn by spaceLevel.js with
// the level's pack, laid where battles.js's layStarfighter puts the battle
// (`areaSpot`: well off the planet, away from its sun).
//
//   createLevelArea(scene, { at, radius, sea, sky, fog }) → { group, inside(position), update(camera, t), dispose() }
//   (all in the battle's units: `at` the dome's middle, `radius` its size,
//   `sea` the water's height; `sky`: { url, gain } the level's panorama,
//   horizon to zenith round the dome; `fog`: { color, density, sea, deep },
//   the storm's colour and how thick it is)

import * as THREE from 'three';

const DOME_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// (the panorama round the dome, horizon at its foot; below the horizon and
// at it, the storm's fog, so the sea runs into the sky with no seam)
const DOME_FRAG = `
uniform sampler2D uSky;
uniform float uGain, uHas;
uniform vec3 uFog;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float u = atan(d.x, d.z) / 6.2831853 + 0.5;
  float v = clamp(el / 1.5707963, 0.0, 1.0);
  vec3 sky = uHas > 0.5 ? texture2D(uSky, vec2(u, v)).rgb * uGain : uFog;
  vec3 c = mix(uFog, sky, smoothstep(0.0, 0.22, v));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const SEA_VERT = `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// (a dark, wind-torn sea: two layers of moving ripples for its normal, the
// storm's sky in it at a glance, the fog over it with distance)
const SEA_FRAG = `
uniform float uTime, uScale, uDensity;
uniform vec3 uDeep, uSea, uFog;
varying vec3 vWorld;
float h(vec2 p) {
  return sin(p.x * 1.7 + uTime * 1.1) * sin(p.y * 1.3 - uTime * 0.8) + 0.5 * sin(p.x * 3.9 - p.y * 2.7 + uTime * 1.9);
}
void main() {
  vec2 p = vWorld.xz * uScale;
  float e = 0.05;
  vec3 n = normalize(vec3(h(p) - h(p + vec2(e, 0.0)), 6.0 * e, h(p) - h(p + vec2(0.0, e))));
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  vec3 c = mix(uDeep, uSea, 0.35 + 0.65 * fres);
  float f = 1.0 - exp(-pow(uDensity * dist, 2.0));
  gl_FragColor = vec4(mix(c, uFog, clamp(f, 0.0, 1.0)), 1.0);
  #include <colorspace_fragment>
}`;

export function createLevelArea(scene, { at, radius, sea, sky = null, fog }) {
  const group = new THREE.Group();
  group.name = 'level-area';
  group.position.set(...at);
  scene.add(group);
  const fogColor = new THREE.Color(fog.color);

  const domeUniforms = { uSky: { value: null }, uGain: { value: sky?.gain ?? 1 }, uHas: { value: 0 }, uFog: { value: fogColor } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, uniforms: domeUniforms, side: THREE.DoubleSide, fog: false }));
  dome.name = 'level-area-sky';
  dome.frustumCulled = false;
  group.add(dome);
  let texture = null;
  if (sky?.url)
    new THREE.TextureLoader().load(sky.url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      texture = t;
      domeUniforms.uSky.value = t;
      domeUniforms.uHas.value = 1;
    });

  const seaUniforms = { uTime: { value: 0 }, uScale: { value: 0.9 }, uDensity: { value: fog.density }, uDeep: { value: new THREE.Color(fog.deep ?? '#16262e') }, uSea: { value: new THREE.Color(fog.sea ?? '#3e525c') }, uFog: { value: fogColor } };
  const water = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.995, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: seaUniforms, fog: false }));
  water.name = 'level-area-sea';
  water.position.y = sea - at[1];
  group.add(water);

  // the storm's fog over what's in it (the level's pack, the battle's ships), while you're inside
  const storm = new THREE.FogExp2(fogColor, fog.density);
  let held = undefined; // (the scene's own fog, kept while ours is on)
  const inside = (p) => Boolean(p) && Math.hypot(p.x - at[0], p.y - at[1], p.z - at[2]) < radius * 0.98;
  const setFog = (on) => {
    if (on && held === undefined) {
      held = scene.fog ?? null;
      scene.fog = storm;
    } else if (!on && held !== undefined) {
      scene.fog = held;
      held = undefined;
    }
  };

  return {
    group,
    inside,
    update(camera, t = 0) {
      seaUniforms.uTime.value = t;
      setFog(inside(camera?.position));
    },
    dispose() {
      setFog(false);
      scene.remove(group);
      dome.geometry.dispose();
      dome.material.dispose();
      water.geometry.dispose();
      water.material.dispose();
      texture?.dispose();
    },
  };
}
