// The Raga theme's background: a dusk courtyard for a concert. Marigold
// petals drift down, a row of diyas flickers along the foot of the screen,
// and the tanpura's drone spreads out from the lower corners as slow rings.
// The pointer leaves ripples where it moves; every so often a lantern lifts
// off from the row and floats up out of sight. A click on empty page is a
// ring of sound and a shower of petals.

import { ambience, backdrop, bursts, field, rand, rgb } from '../kit';
import { mix } from '../../../lib/three/theme';

const RIPPLES = 5;

const DRONE = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uTint;
uniform float uAlpha;
uniform vec4 uRip[${RIPPLES}]; // x, y (px from the middle), age (s), strength
float ring(float d, float r, float w) { return smoothstep(w, 0.0, abs(d - r)); }
void main() {
  vec2 px = (vUv - 0.5) * uRes;
  float a = 0.0;
  // the drone: rings rolling out of both lower corners, fading with distance
  for (int s = 0; s < 2; s++) {
    vec2 o = vec2(s == 0 ? -0.5 : 0.5, -0.5) * uRes;
    float d = length(px - o);
    float wave = 0.5 + 0.5 * sin(d * 0.045 - uTime * 1.3);
    a += smoothstep(0.82, 1.0, wave) * smoothstep(uRes.y * 0.9, 0.0, d) * 0.55;
  }
  // the pointer's ripples and the clicks' rings
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    float d = length(px - r.xy);
    float rad = r.z * 140.0;
    float fade = max(0.0, 1.0 - r.z / 1.8);
    a += (ring(d, rad, 2.5) + ring(d, rad * 0.7, 2.0) * 0.6) * fade * r.w;
  }
  gl_FragColor = vec4(uTint, clamp(a, 0.0, 1.0) * uAlpha);
}
`;

// a flame's glow: brightest in a teardrop, flickering on its own clock
const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = modelMatrix[3].x * 0.013 + modelMatrix[3].y * 0.007;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vSeed;
uniform float uTime;
uniform vec3 uFlame;
uniform vec3 uHalo;
uniform float uHaloAlpha;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float flick = 0.85 + 0.15 * sin(uTime * 9.0 + vSeed * 40.0) * sin(uTime * 5.3 + vSeed * 17.0);
  // the flame: a teardrop pointing up, its tip swaying
  vec2 q = p * vec2(3.2, 2.2) - vec2(sin(uTime * 3.0 + vSeed * 9.0) * 0.25 * (p.y + 0.3), -0.2);
  float drop = length(vec2(q.x / (1.0 - clamp(q.y, -0.2, 0.95) * 0.85), q.y + 0.1));
  float flame = smoothstep(0.75, 0.45, drop) * flick;
  float halo = exp(-dot(p, p) * 3.5) * flick;
  vec3 col = mix(uHalo, uFlame, flame);
  gl_FragColor = vec4(col, max(flame, halo * uHaloAlpha));
}
`;

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const rip = Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, 9, 0));
    const drone = backdrop(k, DRONE, { uTint: { value: new THREE.Color() }, uAlpha: { value: 0.3 }, uRip: { value: rip } });
    const petals = field(k, { count: 70, shape: 'petal', dir: [0.25, -1], speed: [12, 28], size: [8, 15], sway: 44, spin: 1.1, repel: 70, parallax: 0.1 });
    const shower = bursts(k, { shape: 'dot', size: 9 });

    const glowMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uTime: { value: 0 }, uFlame: { value: new THREE.Color() }, uHalo: { value: new THREE.Color() }, uHaloAlpha: { value: 0.5 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const clay = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    // a diya: a shallow clay bowl with a lip, the flame over its spout
    const bowl = new THREE.Shape();
    bowl.moveTo(-16, 4);
    bowl.quadraticCurveTo(-14, -9, 0, -10);
    bowl.quadraticCurveTo(14, -9, 18, 3);
    bowl.lineTo(24, 6);
    bowl.lineTo(14, 6);
    bowl.lineTo(-16, 6);
    const bowlGeo = new THREE.ShapeGeometry(bowl);
    const flameGeo = new THREE.PlaneGeometry(46, 46);
    const diya = () => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(bowlGeo, clay);
      const f = new THREE.Mesh(flameGeo, glowMat);
      f.position.set(16, 20, 0);
      f.renderOrder = 3;
      g.add(f, b);
      return g;
    };
    const row = [];
    const lamps = new THREE.Group();
    k.scene.add(lamps);
    // a paper lantern for the sky: the same flame inside a tapered shade
    const shade = new THREE.Shape([[-14, -16], [14, -16], [18, 14], [-18, 14]].map(([x, y]) => new THREE.Vector2(x, y)));
    const paper = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    const lantern = new THREE.Group();
    const lf = new THREE.Mesh(flameGeo, glowMat);
    lf.scale.setScalar(1.4);
    lf.renderOrder = 4;
    lantern.add(new THREE.Mesh(new THREE.ShapeGeometry(shade), paper), lf);
    lantern.visible = false;
    k.scene.add(lantern);
    const sky = { on: false, t: 0, wait: rand(4, 7), x: 0 };

    let lastRip = [0, 0];
    let ripAge = 0;
    let nextRip = 0;
    const ripple = (x, y, strength) => {
      const r = rip[nextRip];
      nextRip = (nextRip + 1) % RIPPLES;
      r.set(x, y, 0, strength);
    };

    return {
      resize(w, h) {
        // a diya every 150px or so along the bottom, the middle left clear
        for (const d of row) lamps.remove(d);
        row.length = 0;
        const n = Math.max(2, Math.round((w / 150) * (k.density > 0.9 ? 1 : 0.6)));
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + ((i + 0.5) / n) * w;
          if (Math.abs(x) < w * 0.18) continue;
          const d = diya();
          d.position.set(x, -h / 2 + 22 + Math.sin(i * 2.1) * 4, 0);
          d.scale.setScalar(0.9 + ((i * 37) % 5) * 0.06);
          lamps.add(d);
          row.push(d);
        }
      },
      step(dt, t) {
        drone.step(t);
        petals.step(t);
        shower.step(dt);
        glowMat.uniforms.uTime.value = t;
        // ripples where the pointer moves, one every half second at most
        ripAge += dt;
        const moved = Math.hypot(k.pointer.x - lastRip[0], k.pointer.y - lastRip[1]);
        if (k.pointer.near > 0.5 && moved > 50 && ripAge > 0.5) {
          ripple(k.pointer.x, k.pointer.y, 0.6);
          lastRip = [k.pointer.x, k.pointer.y];
          ripAge = 0;
        }
        for (const r of rip) {
          r.z += dt;
          if (r.z > 1.8) r.w = 0;
        }
        // a lantern lifts off now and then
        if (!sky.on) {
          sky.wait -= dt;
          if (sky.wait <= 0 && dt > 0) {
            sky.on = true;
            sky.t = 0;
            sky.x = (Math.random() < 0.5 ? -1 : 1) * k.size.w * rand(0.3, 0.44);
            lantern.visible = true;
          }
        } else {
          sky.t += dt;
          lantern.position.set(sky.x + Math.sin(sky.t * 0.8) * 40, -k.size.h / 2 + 40 + sky.t * 34, 0);
          lantern.rotation.z = Math.sin(sky.t * 0.8 + 1) * 0.12;
          const fade = Math.min(1, sky.t / 2, (k.size.h + 60 - sky.t * 34) / 200);
          lantern.scale.setScalar(Math.max(0.3, 1 - sky.t * 0.02));
          paper.opacity = Math.max(0, fade) * this.paperAlpha;
          if (sky.t * 34 > k.size.h + 80) {
            sky.on = false;
            lantern.visible = false;
            sky.wait = rand(9, 14);
          }
        }
        // reduced motion: one still frame with a lantern on its way up
        if (k.reduced && !sky.on) {
          sky.on = true;
          sky.t = 7;
          sky.x = -k.size.w * 0.44;
          lantern.visible = true;
          this.step(0, t);
        }
      },
      recolor(c) {
        const saffron = c.dark ? c.saber : c.accent;
        rgb(saffron, drone.uniforms.uTint.value);
        drone.uniforms.uAlpha.value = c.dark ? 0.22 : 0.26;
        petals.colors(c.dark ? [255, 170, 40] : [240, 128, 10], c.dark ? [255, 210, 70] : [232, 168, 20]);
        petals.uniforms.uOpacity.value = c.dark ? 0.8 : 0.85;
        rgb(c.dark ? [255, 236, 190] : [255, 214, 120], glowMat.uniforms.uFlame.value);
        rgb(c.dark ? [255, 150, 50] : [255, 170, 60], glowMat.uniforms.uHalo.value);
        glowMat.uniforms.uHaloAlpha.value = c.dark ? 0.55 : 0.35;
        glowMat.blending = c.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        glowMat.needsUpdate = true;
        rgb(c.dark ? [150, 80, 50] : [176, 92, 52], clay.color);
        clay.opacity = c.dark ? 0.85 : 0.9;
        rgb(c.dark ? [240, 140, 60] : mix(c.accent, c.bg, 0.25), paper.color);
        this.paperAlpha = c.dark ? 0.55 : 0.6;
        shower.glow(c.dark);
        this.saffron = saffron;
      },
      burst(x, y) {
        ripple(x, y, 1);
        shower.emit(x, y, { count: 22, colors: [this.saffron, [255, 205, 60], [255, 120, 30]], speed: [70, 230], gravity: -140, size: 10 });
      },
    };
  });
}
