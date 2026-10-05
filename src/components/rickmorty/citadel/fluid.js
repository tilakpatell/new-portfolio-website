// Portal fluid, as the Citadel keeps it in its core and the Council's
// tank: the portals' greens, dark in the depths and lime where it churns,
// lightning crackling through it and bubbles of it rising. Its own light
// (it isn't lit, and isn't tone mapped), so it glows through the bloom.
//
// fluidMaterial({ dark, scale }) → ShaderMaterial; set uniforms.uTime each
// frame, and uAgitate (0…1) to stir it up (red alert).

import * as THREE from 'three';
import { SWIRL_GLSL } from '../swirl';

export function fluidMaterial({ dark = 0.6, scale = [7, 3] } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDark: { value: dark }, uAgitate: { value: 0 }, uScale: { value: new THREE.Vector2(...scale) } },
    toneMapped: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
      uniform float uTime, uDark, uAgitate;
      uniform vec2 uScale;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      ${SWIRL_GLSL}
      void main() {
        float t = uTime * (1.0 + uAgitate * 1.5);
        vec2 p = vUv * uScale;
        // the fluid turning over on itself, as a portal's swirl does
        vec2 q = vec2(sw_fbm(p + vec2(0.0, -t * 0.3)), sw_fbm(p * 1.3 + vec2(t * 0.12, 4.0)));
        float flow = sw_fbm(p + q * 1.6 + vec2(0.0, -t * 0.22));
        vec3 deep = vec3(0.0, 0.04, 0.01);
        vec3 mid = vec3(0.01, 0.22, 0.035);
        vec3 lime = vec3(0.32, 0.88, 0.16);
        vec3 c = mix(deep, mid, smoothstep(0.32, 0.7, flow));
        c = mix(c, lime, smoothstep(0.76, 0.95, flow) * (1.0 - uDark * 0.5));
        c *= mix(1.5, 1.0, uDark);
        // lightning: thin bright veins where the noise crosses a level
        float v1 = 1.0 - smoothstep(0.0, 0.03, abs(sw_fbm(p * 1.2 + q + vec2(t * 0.25, t * 0.1)) - 0.5));
        float v2 = 1.0 - smoothstep(0.0, 0.025, abs(sw_fbm(p * 2.2 - vec2(t * 0.45, 0.0)) - 0.52));
        float flash = 0.6 + 0.4 * sin(t * 9.0 + p.y * 2.0) * (0.5 + uAgitate);
        c += vec3(0.5, 1.0, 0.4) * (v1 + v2 * 0.6) * mix(1.4, 0.9, uDark) * flash;
        // bubbles of it, drifting up
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 o = vec2(fract(fi * 0.37 + 0.11), fract(t * 0.045 + fi * 0.29));
          vec2 d = (vUv - o) * uScale;
          float r = length(d);
          c += vec3(0.4, 0.9, 0.3) * (smoothstep(0.42, 0.3, r) * 0.25 + smoothstep(0.3, 0.0, r) * 0.45);
        }
        // brighter where the glass curves away from you
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        c += vec3(0.1, 0.55, 0.15) * rim * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
