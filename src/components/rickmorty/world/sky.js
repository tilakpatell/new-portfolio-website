// The sky over the Smiths' street, as the show paints it: a clean pale cyan
// afternoon going deeper blue overhead, a soft sun, and flat white cartoon
// clouds with crisp edges and a cool lavender shade underneath. One dome,
// drawn behind everything (no ink), that follows the camera. setLook() gives
// another area its own colours (the annex's purple, two moons).

import * as THREE from 'three';

export const STREET_SKY = { top: 0x3f9be0, mid: 0x86cbf2, low: 0xd8f3fb, sun: 0xfff6d8, clouds: 1, moons: 0 };

export function makeSky(radius = 520, look = STREET_SKY) {
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.55).normalize();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(look.top) },
      mid: { value: new THREE.Color(look.mid) },
      low: { value: new THREE.Color(look.low) },
      sunCol: { value: new THREE.Color(look.sun) },
      sunDir: { value: sunDir },
      clouds: { value: look.clouds },
      moons: { value: look.moons },
      t: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 top, mid, low, sunCol, sunDir;
      uniform float clouds, moons, t;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
      // puffy cumulus: big round lumps (low octaves) with small bumps on their edges
      float cloud(vec2 p) {
        float big = noise(p * 0.55) * 0.62 + noise(p * 1.1 + 7.3) * 0.38;
        return big + (fbm(p * 2.6) - 0.5) * 0.22;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(low, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, top, smoothstep(0.18, 0.9, h));
        if (h < 0.0) c = low;
        float s = dot(d, sunDir);
        c += sunCol * (pow(max(s, 0.0), 220.0) * 1.4 + pow(max(s, 0.0), 12.0) * 0.12);
        c = mix(c, sunCol * 1.5, smoothstep(0.9993, 0.9996, s));
        if (clouds > 0.0 && h > 0.0) {
          // a layer of cloud overhead, seen in perspective down to the horizon
          vec2 p = d.xz / (h + 0.06) * 1.25 + vec2(t * 0.012, t * 0.004);
          float n = cloud(p);
          float edge = 0.6 - clouds * 0.04;
          float body = smoothstep(edge, edge + 0.012, n);
          // shaded underneath: the same cloud a little nearer the horizon
          float lit = smoothstep(edge + 0.02, edge + 0.035, cloud(p + vec2(0.0, 0.0) + normalize(sunDir.xz) * 0.16));
          vec3 shade = mix(vec3(0.78, 0.83, 0.95), vec3(1.0), lit);
          float fade = smoothstep(0.015, 0.09, h);
          c = mix(c, mix(low, shade, fade * 0.9 + 0.1), body * fade);
        }
        if (moons > 0.0) {
          vec3 m1 = normalize(vec3(0.55, 0.32, -0.75));
          vec3 m2 = normalize(vec3(-0.32, 0.46, -0.83));
          c = mix(c, vec3(0.93, 0.88, 0.75), smoothstep(0.9975, 0.998, dot(d, m1)));
          c = mix(c, vec3(0.72, 0.95, 0.85), smoothstep(0.9988, 0.999, dot(d, m2)));
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  const u = material.uniforms;
  return {
    dome,
    sunDir,
    setLook(l) {
      u.top.value.set(l.top);
      u.mid.value.set(l.mid);
      u.low.value.set(l.low);
      u.sunCol.value.set(l.sun);
      u.clouds.value = l.clouds ?? 0;
      u.moons.value = l.moons ?? 0;
    },
    update(t, camera) {
      u.t.value = t;
      dome.position.copy(camera.position);
    },
  };
}
