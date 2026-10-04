// How the universe map is drawn, after the scene itself: into a
// multisampled HDR target (the canvas's own antialiasing doesn't reach an
// offscreen one), then bloom for what's brighter than lit paint (the sun,
// lit windows, engines, shots), then one last pass: the tone map, the sRGB
// encoding and a light grade (a touch of contrast and saturation, a
// vignette). The tone map is the shoulder of Khronos' neutral one without
// its toe: everything under 0.8 stays exactly as drawn (the faint Milky Way,
// the planets' night sides, the signs' colours) and only what's brighter is
// rounded off toward white. When frames run long the scene turns the post
// off and draws straight to the canvas, as before there was any.
//
// spaceEnvironment(renderer, sky) is what shiny things reflect: the Milky
// Way, brought up, with the key light's glow where the key light is and a
// cool fill opposite, so metal catches the same light the scene is lit by.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // the key light, upper left
export const FILL = new THREE.Vector3(0.7, -0.4, -0.3).normalize();

// bloom: only what's well past lit paint glows (lit surfaces top out near
// 2 under the key light; the sun, windows and engines are drawn hotter)
const BLOOM = { strength: 0.8, radius: 0.55, threshold: 1.7 };

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 0.07 },
    uSat: { value: 1.06 },
    uVignette: { value: 0.3 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSat, uVignette, uAspect;
    varying vec2 vUv;
    vec3 shoulder(vec3 c) {
      float peak = max(c.r, max(c.g, c.b));
      if (peak < 0.8) return c;
      float top = 1.0 - 0.04 / (peak - 0.6);
      c *= top / peak;
      return mix(c, vec3(top), 1.0 - 1.0 / (0.15 * (peak - top) + 1.0));
    }
    vec3 srgb(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    void main() {
      vec3 c = srgb(clamp(shoulder(max(texture2D(tDiffuse, vUv).rgb, 0.0)), 0.0, 1.0));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, uSat), 0.0);
      c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
      vec2 q = vUv - 0.5;
      q.x *= uAspect;
      c *= 1.0 - uVignette * smoothstep(0.35, 1.1, length(q) * 1.25);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { small = false } = {}) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 2 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  composer.addPass(bloom);
  const grade = new ShaderPass(FINAL);
  composer.addPass(grade);

  let on = true;
  const at = { w: 0, h: 0, ratio: 0 };
  return {
    get on() {
      return on;
    },
    // draw a frame (the renderer's pixel ratio can change under us, when the
    // watchdog trades sharpness for speed)
    render(w, h) {
      if (!on) {
        renderer.render(scene, camera);
        return;
      }
      const ratio = renderer.getPixelRatio();
      if (w !== at.w || h !== at.h || ratio !== at.ratio) {
        Object.assign(at, { w, h, ratio });
        composer.setPixelRatio(ratio);
        composer.setSize(w, h);
        grade.uniforms.uAspect.value = w / h;
      }
      composer.render();
    },
    // bloom's strength, for a moment's flare (a boost, an arrival)
    flare(k) {
      bloom.strength = BLOOM.strength * k;
    },
    off() {
      if (!on) return;
      on = false;
      composer.dispose();
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      grade.material.dispose();
    },
  };
}

export function spaceEnvironment(renderer, sky) {
  const env = new THREE.Scene();
  const made = [];
  const add = (geo, mat, pos) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    env.add(m);
    made.push(geo, mat);
  };
  add(
    new THREE.SphereGeometry(10, 48, 24),
    sky ? new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, color: new THREE.Color(3, 3, 3.4) }) : new THREE.MeshBasicMaterial({ color: '#0b0f1c', side: THREE.BackSide }),
  );
  add(new THREE.SphereGeometry(1.5, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 7.2) }), LIGHT.clone().multiplyScalar(7));
  add(new THREE.SphereGeometry(2.2, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.45, 1.1) }), FILL.clone().multiplyScalar(7));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  for (const thing of made) thing.dispose();
  return rt;
}
