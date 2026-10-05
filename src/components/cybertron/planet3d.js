// Cybertron in WebGL: a world plated in metal, drawn by one shader with no
// images to download. Plates in three sizes laid in bands round the globe (so
// they don't pinch at the poles), seams between them, energon running along
// the edges of some, great rings of light where the cities are, trenches
// along the latitudes, the lights of the night side, and the war's fires.
// Round it, a glow of its own colour, two moons, and a ring of wreckage.
//
// Drag to turn it. `side` (autobot or decepticon) is the energon's colour,
// and how much of the planet is burning; changing it cross-fades.
//
// A lib/three/useScene scene: create(canvas, ctx) → { resize, render, update, dispose }.

import * as THREE from 'three';
import { noiseAtlas } from '../../lib/texture';
import { createRenderer, disposeTree, precompile } from '../../lib/three/renderer';

const SIDES = {
  autobot: { energon: new THREE.Color(0x4fd8ff), gold: new THREE.Color(0xffc446), war: 0.55 },
  decepticon: { energon: new THREE.Color(0xb478ff), gold: new THREE.Color(0xff465a), war: 1 },
};

const PLANET_VERT = /* glsl */ `
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vP = normalize(position);
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const PLANET_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uWar;
  uniform vec3 uLight;
  uniform vec3 uEnergon;
  uniform vec3 uGold;
  uniform sampler2D uNoise;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vView;

  float hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  // Plates in bands of latitude: each band has as many plates as fit round
  // it at that latitude. Gives the plate's id, and how far in from its edge.
  void plates(vec2 ll, float rows, out float id, out float edge, out vec2 cell) {
    float r = floor(ll.y * rows);
    float lat = ((r + 0.5) / rows - 0.5) * 3.14159265;
    float n = max(3.0, floor(rows * 2.0 * cos(lat) * (0.75 + 0.5 * hash(vec2(r, rows)))));
    float x = fract(ll.x + hash(vec2(r, 7.0))) * n;
    float c = floor(x);
    id = hash(vec2(c + r * 57.0, rows));
    vec2 f = vec2(fract(x), fract(ll.y * rows));
    cell = f;
    // edge distance, in the same units both ways (plates are wider than tall)
    edge = min(min(f.x, 1.0 - f.x) * (2.0 * rows * cos(lat) / n) * 1.4, min(f.y, 1.0 - f.y));
  }
  // great rings round a point on the globe
  float rings(vec3 p, vec3 c, float reach, float count) {
    float d = acos(clamp(dot(p, c), -1.0, 1.0));
    float band = abs(fract(d / reach * count) - 0.5);
    return smoothstep(0.16, 0.02, band) * step(d, reach) * (0.4 + 0.6 * (1.0 - d / reach));
  }
  float blob(vec3 p, vec3 c, float reach) {
    return smoothstep(reach, 0.0, acos(clamp(dot(p, c), -1.0, 1.0)));
  }

  void main() {
    vec3 p = normalize(vP);
    vec2 ll = vec2(atan(p.z, p.x) / 6.2831853 + 0.5, asin(clamp(p.y, -1.0, 1.0)) / 3.14159265 + 0.5);
    vec3 nz = texture2D(uNoise, ll * vec2(4.0, 2.0)).rgb;
    vec3 fine = texture2D(uNoise, ll * vec2(22.0, 11.0)).rgb;

    float idA, edgeA, idB, edgeB, idC, edgeC;
    vec2 cA, cB, cC;
    plates(ll, 9.0, idA, edgeA, cA);
    plates(ll + nz.rg * 0.004, 26.0, idB, edgeB, cB);
    plates(ll, 78.0, idC, edgeC, cC);

    // the metal: steel, some plates bluer, some bronze, all of it worn
    vec3 steel = mix(vec3(0.09, 0.105, 0.135), vec3(0.34, 0.37, 0.42), idB * 0.75 + idA * 0.25);
    steel = mix(steel, vec3(0.20, 0.27, 0.40), step(0.78, idA) * 0.6);
    steel = mix(steel, vec3(0.40, 0.31, 0.20), step(0.9, idB) * 0.7);
    steel *= 0.8 + 0.4 * fine.r;
    steel *= 0.9 + 0.2 * idC;
    // seams: wide between the great plates, hair-thin between the small
    float seam = smoothstep(0.0, 0.035, edgeA) * (0.55 + 0.45 * smoothstep(0.0, 0.05, edgeB)) * (0.8 + 0.2 * smoothstep(0.0, 0.08, edgeC));
    // trenches along the latitudes
    float trench = smoothstep(0.012, 0.0, abs(fract(ll.y * 7.0 + nz.g * 0.08) - 0.5) - 0.006);
    vec3 albedo = steel * seam * (1.0 - 0.75 * trench);

    // the war: where it burns, the plates are scorched
    vec3 f1 = normalize(vec3(0.62, 0.30, 0.72));
    vec3 f2 = normalize(vec3(-0.45, -0.25, 0.86));
    vec3 f3 = normalize(vec3(-0.8, 0.42, -0.42));
    vec3 f4 = normalize(vec3(0.3, -0.6, -0.74));
    vec3 f5 = normalize(vec3(0.05, 0.75, 0.66));
    float burn = blob(p, f1, 0.26) + blob(p, f2, 0.2) * uWar + blob(p, f3, 0.3) + blob(p, f4, 0.24) * uWar + blob(p, f5, 0.16) * uWar;
    burn *= 0.55 + 0.45 * uWar;
    float ember = burn * (0.35 + 0.65 * fine.g) * (0.7 + 0.3 * sin(uTime * 3.1 + nz.r * 20.0));
    albedo *= 1.0 - 0.6 * clamp(burn, 0.0, 1.0);

    // light
    vec3 N = normalize(vN);
    vec3 L = normalize(uLight);
    float diff = max(dot(N, L), 0.0);
    float night = smoothstep(0.25, -0.15, dot(N, L));
    vec3 H = normalize(L + vView);
    float spec = pow(max(dot(N, H), 0.0), mix(18.0, 70.0, idB)) * (0.2 + 0.9 * idB) * seam;
    vec3 col = albedo * (0.05 + 1.25 * diff) + vec3(0.9, 0.95, 1.0) * spec * diff * 0.9;

    // energon: along the edges of chosen plates, pulsing as it runs
    float lineB = smoothstep(0.06, 0.0, edgeB) * step(0.8, idB);
    float lineA = smoothstep(0.03, 0.0, edgeA) * step(0.45, idA);
    float pulse = 0.55 + 0.45 * sin(uTime * 1.4 + idB * 40.0 + (cB.x + cB.y) * 6.2831853);
    vec3 glow = uEnergon * (lineB * pulse * 1.5 + lineA * 0.9);
    // the cities' rings
    float ring = rings(p, normalize(vec3(0.2, 0.25, 0.95)), 0.24, 3.0) + rings(p, normalize(vec3(-0.75, 0.1, 0.65)), 0.2, 3.0) + rings(p, normalize(vec3(0.7, -0.45, 0.55)), 0.17, 2.0)
      + rings(p, normalize(vec3(-0.2, -0.6, -0.77)), 0.26, 4.0) + rings(p, normalize(vec3(0.6, 0.6, -0.52)), 0.2, 3.0) + rings(p, normalize(vec3(-0.85, -0.3, -0.42)), 0.16, 2.0);
    glow += mix(uGold, uEnergon, step(0.5, fract(ring * 3.7))) * ring * 1.3;
    glow += uGold * trench * 0.55;
    // windows, most on the night side
    float win = step(0.72, idC) * smoothstep(0.1, 0.3, edgeC) * step(0.35, fine.b);
    glow += mix(uEnergon, uGold, step(0.8, hash(cC + idC))) * win * (0.1 + 1.3 * night);
    // fire
    glow += mix(vec3(1.0, 0.28, 0.03), vec3(1.0, 0.85, 0.5), ember) * ember * 3.4;

    // the air at the limb
    float rim = pow(1.0 - max(dot(N, vView), 0.0), 3.0);
    col += glow + uEnergon * rim * (0.35 + 0.5 * diff);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// the glow round the planet: a card behind it, brightest on the lit side
const HALO_FRAG = /* glsl */ `
  uniform vec3 uEnergon;
  uniform vec2 uLight;
  varying vec2 vUv;
  void main() {
    vec2 q = (vUv - 0.5) * 2.0 * 1.7; // in planet radii
    float r = length(q);
    float lit = 0.6 + 0.4 * dot(normalize(q + 1e-5), normalize(uLight));
    float a = smoothstep(1.7, 0.98, r);
    a = a * a * a * lit;
    gl_FragColor = vec4(uEnergon * a * 0.9, a * 0.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function create(canvas, ctx) {
  const stage = createRenderer(canvas, { alpha: true, toneMapping: THREE.ACESFilmicToneMapping, exposure: 1.05, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 5.3);

  const noise = new THREE.DataTexture(noiseAtlas(256, 1984), 256, 256, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.generateMipmaps = true;
  noise.needsUpdate = true;

  const light = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();
  const from = SIDES[ctx.side] ?? SIDES.autobot;
  const uniforms = {
    uTime: { value: 0 },
    uWar: { value: from.war },
    uLight: { value: light },
    uEnergon: { value: from.energon.clone() },
    uGold: { value: from.gold.clone() },
    uNoise: { value: noise },
  };
  const tilt = new THREE.Group();
  tilt.rotation.set(0.32, 0, -0.2);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 80), new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG }));
  tilt.add(planet);
  scene.add(tilt);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.ShaderMaterial({
      uniforms: { uEnergon: uniforms.uEnergon, uLight: { value: new THREE.Vector2(light.x, light.y) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: HALO_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.renderOrder = -1;
  scene.add(halo);

  // the moons, lit by the same sun
  scene.add(new THREE.AmbientLight(0x223044, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.copy(light);
  scene.add(sun);
  const moonMat = new THREE.MeshStandardMaterial({ color: 0x8b93a1, roughness: 0.95, metalness: 0.1, bumpMap: noise, bumpScale: 3 });
  const moons = [
    { r: 0.085, orbit: 1.62, speed: 0.11, phase: 0.6, incl: 0.3 },
    { r: 0.05, orbit: 1.92, speed: -0.07, phase: 3.4, incl: -0.55 },
  ].map((m) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(m.r, 24, 16), moonMat);
    scene.add(mesh);
    return { ...m, mesh };
  });

  // wreckage in orbit: a thin, tilted ring of glints
  const N = 900;
  const pos = new Float32Array(N * 3);
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.34 + rand() ** 1.6 * 0.32;
    pos.set([Math.cos(a) * r, (rand() - 0.5) * 0.03, Math.sin(a) * r], i * 3);
  }
  const debrisGeo = new THREE.BufferGeometry();
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const debrisMat = new THREE.PointsMaterial({ color: uniforms.uGold.value, size: 0.014, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
  const debris = new THREE.Points(debrisGeo, debrisMat);
  const ringTilt = new THREE.Group();
  ringTilt.rotation.set(0.42, 0, 0.3);
  ringTilt.add(debris);
  scene.add(ringTilt);

  // turning it by hand
  let spin = 0.6;
  let vel = 0.05; // radians a second
  let drag = null;
  const el = ctx.el;
  const down = (e) => {
    drag = { x: e.clientX, id: e.pointerId, at: performance.now() };
    el.setPointerCapture?.(e.pointerId);
    ctx.invalidate();
  };
  const move = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const now = performance.now();
    const dx = e.clientX - drag.x;
    const turn = (dx / Math.max(160, el.clientWidth)) * Math.PI * 1.4;
    spin += turn;
    vel = turn / Math.max(0.008, (now - drag.at) / 1000);
    drag.x = e.clientX;
    drag.at = now;
    ctx.invalidate();
  };
  const up = (e) => {
    if (drag?.id === e.pointerId) drag = null;
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.style.touchAction = 'pan-y';
  el.style.cursor = 'grab';

  let want = from;
  let visible = true;
  let clock = 0;
  const idle = ctx.reduced ? 0 : 0.05;

  return {
    // its shaders, linked in the background: useScene holds the first frame for this
    ready: precompile(renderer, scene, camera),
    resize(w, h) {
      stage.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    setVisible(on) {
      visible = on;
    },
    update({ side }) {
      want = SIDES[side] ?? SIDES.autobot;
    },
    render(ms, now) {
      if (stage.lost) return false;
      const dt = Math.min(0.05, ms / 1000);
      clock += ctx.reduced ? 0 : dt;
      // the side's colours, eased across
      const k = Math.min(1, dt * 2.5);
      uniforms.uEnergon.value.lerp(want.energon, k);
      uniforms.uGold.value.lerp(want.gold, k);
      uniforms.uWar.value += (want.war - uniforms.uWar.value) * k;
      const settling = Math.abs(want.war - uniforms.uWar.value) > 0.004;
      // a flick of the wrist coasts down to the planet's own slow turn
      if (!drag) {
        vel += (idle - vel) * Math.min(1, dt * 1.2);
        spin += vel * dt;
      }
      planet.rotation.y = spin;
      uniforms.uTime.value = clock;
      for (const m of moons) {
        const a = m.phase + clock * m.speed;
        m.mesh.position.set(Math.cos(a) * m.orbit, Math.sin(a) * m.orbit * Math.sin(m.incl), Math.sin(a) * m.orbit * Math.cos(m.incl));
        m.mesh.rotation.y = a;
      }
      debris.rotation.y = clock * 0.03;
      debrisMat.color.copy(uniforms.uGold.value);
      renderer.render(scene, camera);
      stage.watch(now);
      return visible && (!ctx.reduced || !!drag || settling || Math.abs(vel) > 0.01);
    },
    dispose() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.style.cursor = '';
      el.style.touchAction = '';
      disposeTree(scene);
      noise.dispose();
      stage.dispose();
    },
  };
}
