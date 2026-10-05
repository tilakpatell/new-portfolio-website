// Rain, for a town on a wet night: streaks falling in a box that follows the
// camera (one draw, moved in its shader, so thousands cost nothing to
// animate), slanted by the wind, and splashes ringing out on the ground
// round where you stand.

import * as THREE from 'three';

export function makeRain({ count = 4000, size = [36, 22, 36], speed = 14, len = 0.6, splashes = 220, height = () => 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'rain';

  // ── the streaks ──
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 2 * 4);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let e = 0; e < 2; e++) {
      seed.set(s, (i * 2 + e) * 4);
      end[i * 2 + e] = e;
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('end', new THREE.BufferAttribute(end, 1));
  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uSize: { value: new THREE.Vector3(...size) },
    uSpeed: { value: speed },
    uLen: { value: len },
    uWind: { value: new THREE.Vector2(1.6, 0.7) },
    uAmount: { value: 1 },
    uColor: { value: new THREE.Color(0.75, 0.8, 0.9) },
    uOpacity: { value: 0.32 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform vec3 uCam, uSize;
      uniform float uTime, uSpeed, uLen, uAmount;
      uniform vec2 uWind;
      attribute vec4 seed;
      attribute float end;
      varying float vAlpha;
      void main() {
        float pace = 0.85 + seed.w * 0.3;
        vec3 q = seed.xyz * uSize;
        q.y -= uTime * uSpeed * pace;
        q.xz += uWind * uTime * pace;
        vec3 rel = mod(q - uCam + uSize * 0.5, uSize) - uSize * 0.5;
        vec3 wp = uCam + rel;
        vec3 dir = normalize(vec3(uWind.x, -uSpeed, uWind.y));
        wp -= dir * uLen * pace * end;
        // thinner far off, none past how hard it's raining
        float fade = 1.0 - smoothstep(uSize.x * 0.28, uSize.x * 0.5, length(rel.xz));
        vAlpha = step(seed.w, uAmount) * fade * (0.15 + 0.85 * end);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const streaks = new THREE.LineSegments(geo, material);
  streaks.frustumCulled = false;
  streaks.renderOrder = 3;
  group.add(streaks);

  // ── the splashes: little rings on the ground, each living a moment, then
  // starting again somewhere else near you ──
  const n = Math.max(0, splashes);
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(n * 3);
  const born = new Float32Array(n);
  const life = new Float32Array(n);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('born', new THREE.BufferAttribute(born, 1));
  sGeo.setAttribute('life', new THREE.BufferAttribute(life, 1));
  const sUniforms = { uTime: { value: 0 }, uAmount: uniforms.uAmount, uColor: uniforms.uColor, uScale: { value: 300 } };
  const sMat = new THREE.ShaderMaterial({
    uniforms: sUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime, uScale;
      attribute float born, life;
      varying float vK;
      void main() {
        vK = clamp((uTime - born) / life, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (0.08 + vK * 0.32) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uAmount;
      varying float vK;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        p.y *= 2.6; // flattened: rings lying on the ground, seen at a slant
        float r = length(p);
        float ring = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.8, 1.0, r));
        gl_FragColor = vec4(uColor, ring * (1.0 - vK) * 0.5 * uAmount);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const splash = new THREE.Points(sGeo, sMat);
  splash.frustumCulled = false;
  splash.renderOrder = 3;
  if (n) group.add(splash);
  for (let i = 0; i < n; i++) born[i] = -Math.random();

  // each frame: follow the camera; `focus` is where the splashes ring out
  // (the walker), `amount` 0…1 how hard it rains
  const update = (camera, t, amount = 1, focus = camera.position) => {
    uniforms.uCam.value.copy(camera.position);
    uniforms.uTime.value = t;
    uniforms.uAmount.value = amount;
    sUniforms.uTime.value = t;
    group.visible = amount > 0.01;
    if (!n || !group.visible) return;
    let moved = false;
    for (let i = 0; i < n; i++) {
      if (t - born[i] < life[i]) continue;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 9;
      const x = focus.x + Math.cos(a) * r;
      const z = focus.z + Math.sin(a) * r;
      sPos[i * 3] = x;
      sPos[i * 3 + 1] = height(x, z) + 0.03;
      sPos[i * 3 + 2] = z;
      born[i] = t + Math.random() * 0.3;
      life[i] = 0.32 + Math.random() * 0.2;
      moved = true;
    }
    if (moved) {
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.born.needsUpdate = true;
      sGeo.attributes.life.needsUpdate = true;
    }
  };

  // how bright: the rain catches the light it falls through
  const tint = (r, g, b, opacity) => {
    uniforms.uColor.value.setRGB(r, g, b);
    if (opacity != null) uniforms.uOpacity.value = opacity;
  };

  return { group, update, tint, uniforms };
}
