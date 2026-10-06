// A world's floor masks, made in the browser through the world's own scene
// (lib/three/grounding reads them). Only a world's development build loads
// this, for scripts/bake-floor-shadows.mjs, which drives it in headless
// Chromium and commits what it returns.
//
// A mask is how much of the sun reaches each point of the floor, at each
// named time of day, and how much of the sky does. It's rendered rather
// than traced: the floor is drawn once from straight above into a picture of
// where each of its points is, then for every direction a light can come
// from, the static world is drawn into a shadow map from that direction and
// one pass over the picture adds up which points it can see:
//
//   the sun   48 directions about where the sun is at each time, inside a
//             cone a few degrees across, so the edges of shadows are soft
//             (a penumbra), the softer the further from what casts them
//   the sky   64 directions over the whole sky, more of them high than low
//             (cosine-weighted): occlusion from the sky, the term that
//             darkens a wall's foot and the gap between two buildings
//
// bakeFloorMask(renderer, scene, { area, size, floor, casters, times, sunAt })
//   → { width, height, data } (RGBA bytes, top row first: R, G, B the sun
//   at the times whose channel is 0, 1, 2; A the sky)

import * as THREE from 'three';

const DEG = Math.PI / 180;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// Directions inside a cone of `half` radians about `axis` (a spiral over
// its disc, so they're even and the same every bake), none lower than `low`
// radians over the horizon.
export function coneDirections(axis, half, n, low = 2 * DEG) {
  const a = axis.clone().normalize();
  const t1 = new THREE.Vector3().crossVectors(a, Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const t2 = new THREE.Vector3().crossVectors(a, t1);
  const out = [];
  const minY = Math.sin(low);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n) * Math.tan(half);
    const p = i * GOLDEN;
    const d = a.clone().addScaledVector(t1, r * Math.cos(p)).addScaledVector(t2, r * Math.sin(p)).normalize();
    if (d.y < minY) {
      const h = Math.hypot(d.x, d.z) || 1;
      const k = Math.sqrt(1 - minY * minY) / h;
      d.set(d.x * k, minY, d.z * k);
    }
    out.push(d);
  }
  return out;
}

// A sun no lower than `deg` degrees over the horizon, facing the same way.
// A sun just risen throws every shadow a hundred metres and more, which on a
// floor mask is a town drowned in shade; baked as if it stood a little
// higher, the shadows still run long and the right way, and the street
// stays legible. (Only the mask's sun is lifted: the walls are still lit by
// the real one.) A new vector; `dir` is left alone.
export function liftSun(dir, deg = 0) {
  if (!(deg > 0)) return dir.clone();
  const out = dir.clone().normalize();
  const min = Math.sin(deg * DEG);
  if (out.y >= min) return out;
  const k = Math.sqrt(1 - min * min) / (Math.hypot(out.x, out.z) || 1);
  return out.set(out.x * k, min, out.z * k);
}

// Directions over the sky, cosine-weighted (Hammersley points), so their
// plain average is the sky's light on a level floor.
export function skyDirections(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let bits = i;
    let v = 0;
    let f = 0.5;
    while (bits) {
      if (bits & 1) v += f;
      bits >>= 1;
      f /= 2;
    }
    const u = (i + 0.5) / n;
    const r = Math.sqrt(u);
    const p = 2 * Math.PI * v;
    out.push(new THREE.Vector3(r * Math.cos(p), Math.sqrt(1 - u), r * Math.sin(p)));
  }
  return out;
}

const POS_VERT = /* glsl */ `
varying vec3 vP;
void main() {
  vec4 wp = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  wp = modelMatrix * wp;
  vP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const POS_FRAG = /* glsl */ `
varying vec3 vP;
void main() { gl_FragColor = vec4(vP, 1.0); }`;

const ADD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// one direction's light on every point of the floor, added in with its weight
const ADD_FRAG = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uDepth;
uniform mat4 uShadowMatrix;
uniform vec4 uWeight;
uniform float uBias;
varying vec2 vUv;
void main() {
  vec4 p = texture2D(uPos, vUv);
  float lit = 1.0;
  if (p.w > 0.5) {
    vec4 sc = uShadowMatrix * vec4(p.xyz, 1.0);
    vec3 s = sc.xyz / sc.w;
    if (s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0 && s.z < 1.0) lit = step(s.z - uBias, texture2D(uDepth, s.xy).r);
  }
  gl_FragColor = uWeight * lit;
}`;

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

// `area` { x0, z0, w, d } in metres; `size` the mask's width and height in
// texels; `floor` the meshes (or groups) that are the floor, drawn from above;
// `casters` the static world that shadows it (everything else is left out,
// so hide what moves first); `times` [{ tod, channel }]; `sunAt(tod)` the
// direction to the sun; a time with `lift` (degrees) is baked with its sun at
// least that high (liftSun). `top` is as high as anything casting stands.
export async function bakeFloorMask(renderer, scene, { area, size = 1024, floor, casters, times, sunAt, sunSamples = 48, skySamples = 64, cone = 4 * DEG, top = 90, shadowSize = 4096, onProgress = null } = {}) {
  const { x0, z0, w, d } = area;
  const cx = x0 + w / 2;
  const cz = z0 + d / 2;
  const kept = {
    target: renderer.getRenderTarget(),
    autoClear: renderer.autoClear,
    shadows: renderer.shadowMap.enabled,
    type: renderer.shadowMap.type,
    autoUpdate: renderer.shadowMap.autoUpdate,
    override: scene.overrideMaterial,
    clear: renderer.getClearColor(new THREE.Color()),
    alpha: renderer.getClearAlpha(),
  };
  const undo = [];
  const set = (o, k, v) => {
    undo.push([o, k, o[k]]);
    o[k] = v;
  };
  const LAYER = 31;
  const floorMeshes = [];
  for (const root of floor) root.traverse((o) => (o.isMesh ? floorMeshes.push(o) : null));
  for (const m of floorMeshes) {
    m.layers.enable(LAYER);
    set(m, 'castShadow', false);
  }
  for (const root of casters) root.traverse((o) => o.isMesh && o.visible && !floorMeshes.includes(o) && set(o, 'castShadow', true));
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const sceneKept = { background: scene.background, fog: scene.fog };
  let light = null;
  try {
    scene.updateMatrixWorld(true);
    // ── where each point of the floor is, seen from straight above ──
    // (screen right is +x and screen up is −z, so the rows read back top
    // first are the image's, and v = 0 is the area's z0 edge)
    const pos = own(new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true }));
    const above = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 1, 2000);
    above.up.set(0, 0, -1);
    above.position.set(cx, 1000, cz);
    above.lookAt(cx, 0, cz);
    above.updateMatrixWorld(true);
    above.layers.set(LAYER);
    const posMat = own(new THREE.ShaderMaterial({ vertexShader: POS_VERT, fragmentShader: POS_FRAG, side: THREE.DoubleSide }));
    renderer.shadowMap.enabled = false;
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = posMat;
    renderer.setRenderTarget(pos);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(scene, above);
    scene.overrideMaterial = kept.override;
    scene.background = bg;

    // ── the light, and what adds up what it sees ──
    light = new THREE.DirectionalLight(0xffffff, 1);
    light.castShadow = true;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.bias = 0;
    light.shadow.normalBias = 0;
    const centre = new THREE.Vector3(cx, 0, cz);
    light.target.position.copy(centre);
    light.target.updateMatrixWorld(true);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    const acc = own(new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false }));
    renderer.setRenderTarget(acc);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    const add = own(
      new THREE.ShaderMaterial({
        vertexShader: ADD_VERT,
        fragmentShader: ADD_FRAG,
        uniforms: { uPos: { value: pos.texture }, uDepth: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uWeight: { value: new THREE.Vector4() }, uBias: { value: 0 } },
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendEquation: THREE.AddEquation,
        depthTest: false,
        depthWrite: false,
      }),
    );
    const quadGeo = own(new THREE.PlaneGeometry(2, 2));
    const quad = new THREE.Mesh(quadGeo, add);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // (three draws a shadow map only inside a render of the scene: one into a
    // single pixel, from a camera looking away at nothing, with the cheapest
    // material there is for what isn't culled, sets it off)
    scene.add(light, light.target);
    const pixel = own(new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }));
    const nowhere = new THREE.OrthographicCamera(-0.001, 0.001, 0.001, -0.001, 0.1, 0.2);
    nowhere.position.set(0, -1e5, 0);
    nowhere.lookAt(0, -2e5, 0);
    nowhere.updateMatrixWorld(true);
    const cheap = own(new THREE.MeshBasicMaterial({ colorWrite: false }));
    const background = scene.background;
    const fog = scene.fog;

    // the corners of everything that can shadow the area from `dir`: the
    // area up to `top`, and as far toward the light as something that tall
    // throws its shadow
    const corners = (dir) => {
      const up = Math.max(0.05, dir.y);
      const reach = Math.min(400, top / up);
      const ex = (dir.x / Math.hypot(dir.x, dir.z) || 0) * reach * Math.sqrt(1 - up * up);
      const ez = (dir.z / Math.hypot(dir.x, dir.z) || 0) * reach * Math.sqrt(1 - up * up);
      const pts = [];
      for (const [x, z] of [
        [x0, z0],
        [x0 + w, z0],
        [x0, z0 + d],
        [x0 + w, z0 + d],
      ])
        for (const y of [-1, top]) {
          pts.push(new THREE.Vector3(x, y, z));
          pts.push(new THREE.Vector3(x + ex, y, z + ez));
        }
      return pts;
    };
    const cam = light.shadow.camera;
    const v = new THREE.Vector3();
    const pass = (dir, weight) => {
      light.position.copy(centre).addScaledVector(dir, 1500);
      light.updateMatrixWorld(true);
      // the shadow camera as the shadow pass will place it, fitted round the corners
      cam.position.copy(light.position);
      cam.lookAt(centre);
      cam.updateMatrixWorld(true);
      let [l, r, b, t, n, f] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
      for (const p of corners(dir)) {
        v.copy(p).applyMatrix4(cam.matrixWorldInverse);
        l = Math.min(l, v.x);
        r = Math.max(r, v.x);
        b = Math.min(b, v.y);
        t = Math.max(t, v.y);
        n = Math.min(n, -v.z);
        f = Math.max(f, -v.z);
      }
      Object.assign(cam, { left: l - 1, right: r + 1, bottom: b - 1, top: t + 1, near: Math.max(0.5, n - 20), far: f + 20 });
      cam.updateProjectionMatrix();
      scene.overrideMaterial = cheap;
      scene.background = null;
      scene.fog = null;
      renderer.setRenderTarget(pixel);
      renderer.autoClear = true;
      renderer.render(scene, nowhere);
      scene.overrideMaterial = kept.override;
      scene.background = background;
      scene.fog = fog;
      add.uniforms.uDepth.value = light.shadow.map.depthTexture;
      add.uniforms.uShadowMatrix.value.copy(light.shadow.matrix);
      add.uniforms.uWeight.value.copy(weight);
      add.uniforms.uBias.value = 0.05 / (cam.far - cam.near);
      renderer.setRenderTarget(acc);
      renderer.autoClear = false;
      renderer.render(quadScene, quadCam);
    };

    const jobs = [];
    const named = times.filter((x) => x.channel >= 0 && x.channel <= 2);
    for (const tm of named) {
      const weight = new THREE.Vector4();
      weight.setComponent(tm.channel, 1 / sunSamples);
      // (a time may ask for its sun to be baked higher than it stands: `lift`, in degrees)
      for (const dir of coneDirections(liftSun(sunAt(tm.tod), tm.lift), cone, sunSamples)) jobs.push([dir, weight]);
    }
    const sky = new THREE.Vector4(0, 0, 0, 1 / skySamples);
    for (const dir of skyDirections(skySamples)) jobs.push([dir, sky]);
    const t0 = performance.now();
    for (let i = 0; i < jobs.length; i++) {
      pass(jobs[i][0], jobs[i][1]);
      if (i % 4 === 3) {
        // (a finish now and then, so the time per pass is real and the page answers)
        renderer.getContext().finish();
        onProgress?.({ done: i + 1, of: jobs.length, ms: performance.now() - t0 });
        await nextFrame();
      }
    }

    // ── read back, as bytes ──
    const raw = new Float32Array(size * size * 4);
    renderer.readRenderTargetPixels(acc, 0, 0, size, size, raw);
    const data = new Uint8Array(size * size * 4);
    const has = [0, 1, 2].map((c) => named.some((x) => x.channel === c));
    for (let i = 0; i < size * size; i++) {
      for (let c = 0; c < 3; c++) data[i * 4 + c] = has[c] ? Math.round(Math.min(1, Math.max(0, raw[i * 4 + c])) * 255) : 255;
      data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, raw[i * 4 + 3])) * 255);
    }
    scene.remove(light, light.target);
    light.shadow.map?.depthTexture?.dispose();
    light.shadow.map?.dispose();
    light.dispose();
    return { width: size, height: size, data, ms: performance.now() - t0, passes: jobs.length };
  } finally {
    if (light?.parent) scene.remove(light, light.target);
    Object.assign(scene, sceneKept);
    for (let i = undo.length - 1; i >= 0; i--) undo[i][0][undo[i][1]] = undo[i][2];
    for (const m of floorMeshes) m.layers.disable(LAYER);
    for (const o of owned) o.dispose?.();
    scene.overrideMaterial = kept.override;
    renderer.shadowMap.enabled = kept.shadows;
    renderer.shadowMap.type = kept.type;
    renderer.shadowMap.autoUpdate = kept.autoUpdate;
    renderer.autoClear = kept.autoClear;
    renderer.setClearColor(kept.clear, kept.alpha);
    renderer.setRenderTarget(kept.target);
  }
}

// The bytes as a data URL (what a script reads back through the page).
export function bytesToDataUrl(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return `data:application/octet-stream;base64,${btoa(s)}`;
}
