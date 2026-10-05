// The Middle-earth themes' background. The Shire: green hills rolling along
// the foot of the screen (moving a little with the pointer, the near ones
// most), a round green door in the nearest with its window lit at times,
// fireflies and falling leaves, and now and then one of Gandalf's
// fireworks, or the dragon. Mordor: black mountains against a red sky,
// embers rising and ash coming down, Barad-dûr at the side with the Eye on
// top, which follows the pointer and every so often sweeps its beam across.
// A click on empty page is a firework's sparkle (in Mordor, embers).

import { ambience, backdrop, bursts, field, pick, rand, rgb, silhouette } from '../kit';

const LANDS = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPointer;
uniform float uMordor;
uniform vec3 uFar;
uniform vec3 uMid;
uniform vec3 uNear;
uniform vec3 uGlow;
uniform vec3 uDoor;
uniform vec3 uBrass;
uniform float uLit;
uniform vec2 uLook;      // where the Eye looks, -1..1
uniform vec2 uBeam;      // its beam: angle, strength
uniform float uAlpha;
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float vnoise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
// a line of hills (soft) or mountains (jagged), height in px at x
float hills(float x, float base, float amp, float f, float seed) {
  return base + amp * (0.55 * sin(x * f + seed) + 0.3 * sin(x * f * 2.3 + seed * 1.7) + 0.15 * sin(x * f * 5.1 + seed * 0.3));
}
float crags(float x, float base, float amp, float f, float seed) {
  float t = abs(fract(x * f + seed) - 0.5) * 2.0;
  return base + amp * (1.0 - t) * (0.6 + 0.4 * vnoise(x * f * 3.0 + seed)) + amp * 0.25 * vnoise(x * f * 9.0);
}
void main() {
  vec2 px = vUv * uRes;
  float H = uRes.y;
  // the pointer moves the eye a little: near ridges further than far ones
  float look = (uPointer.x / uRes.x) * uPointer.z * 40.0;
  vec4 col = vec4(0.0);
  if (uMordor < 0.5) {
    float far = hills(px.x + look * 0.3, H * 0.17, H * 0.025, 0.004, 1.0);
    float mid = hills(px.x + look * 0.6, H * 0.11, H * 0.03, 0.005, 4.0);
    float near = hills(px.x + look, H * 0.055, H * 0.03, 0.0035, 7.0);
    // a warm haze over the hills
    col = vec4(uGlow, smoothstep(H * 0.42, H * 0.12, px.y) * 0.25);
    if (px.y < far) col = vec4(uFar, 0.85);
    if (px.y < mid) col = vec4(uMid, 0.9);
    if (px.y < near) col = vec4(uNear, 0.95);
    // the round door in the nearest hill, its brass knob, and a lit window
    float dx = uRes.x * 0.06;
    vec2 door = vec2(dx, max(18.0, hills(dx + look, H * 0.055, H * 0.03, 0.0035, 7.0) * 0.5));
    float d = length(px - door);
    if (d < 15.0) col = vec4(uDoor, 1.0);
    if (abs(d - 15.0) < 1.6) col = vec4(uBrass, 1.0);
    if (length(px - door - vec2(1.0, 0.0)) < 2.2) col = vec4(uBrass, 1.0);
    float win = length((px - door - vec2(30.0, 4.0)) / vec2(1.0, 1.0));
    if (win < 7.0) col = mix(col, vec4(uGlow, 1.0), uLit);
    col.a = max(col.a, exp(-win / 16.0) * uLit * 0.5);
  } else {
    float far = crags(px.x + look * 0.3, H * 0.13, H * 0.09, 0.0026, 0.3);
    float near = crags(px.x + look * 0.8, H * 0.05, H * 0.07, 0.004, 0.7);
    // the sky burns red behind the mountains
    col = vec4(uGlow, smoothstep(H * 0.5, far, px.y) * 0.55);
    if (px.y < far) col = vec4(uFar, 0.9);
    if (px.y < near) col = vec4(uNear, 0.95);
    // Barad-dûr at the left, the Eye on top
    float tx = uRes.x * 0.065;
    float top = H * 0.6;
    float w = mix(18.0, 9.0, px.y / top);
    if (abs(px.x - tx) < w && px.y < top) col = vec4(uNear, 1.0);
    // its two horns
    float hy = px.y - top;
    if (hy > 0.0 && hy < 34.0 && abs(abs(px.x - tx) - 9.0 + hy * 0.05) < 3.0 - hy * 0.07) col = vec4(uNear, 1.0);
    vec2 eye = vec2(tx, top + 16.0);
    vec2 e = (px - eye) / vec2(22.0, 11.0);
    float el = length(e);
    float pupil = length((px - eye - uLook * vec2(8.0, 3.0)) / vec2(2.6, 9.5));
    float fire = 0.5 + 0.5 * sin(uTime * 3.0 + el * 10.0);
    if (el < 1.0) col = vec4(mix(vec3(1.0, 0.85, 0.4), uGlow, el * 0.8 + fire * 0.15), 1.0);
    if (el < 1.0 && pupil < 1.0) col = vec4(0.02, 0.0, 0.0, 1.0);
    col.a = max(col.a, exp(-el * 1.4) * 0.45);
    // the beam
    if (uBeam.y > 0.0) {
      vec2 v = px - eye;
      float ang = atan(v.y, v.x);
      float off = abs(ang - uBeam.x);
      float beam = smoothstep(0.07, 0.0, off) * smoothstep(40.0, 120.0, length(v)) * uBeam.y;
      col = vec4(mix(col.rgb, uGlow, beam), max(col.a, beam * 0.45));
    }
  }
  gl_FragColor = vec4(col.rgb, col.a * uAlpha);
}
`;

// a dragon, wings up, for the fireworks
const DRAGON = [[64, 2], [48, 8], [30, 6], [18, 30], [-6, 46], [4, 12], [-18, 8], [-50, 14], [-80, 4], [-52, 0], [-20, -4], [-2, -10], [-16, -26], [10, -10], [30, -4], [50, -4]];

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const lands = backdrop(k, LANDS, {
      uMordor: { value: k.theme === 'mordor' ? 1 : 0 },
      uFar: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uNear: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uDoor: { value: new THREE.Color() },
      uBrass: { value: new THREE.Color() },
      uLit: { value: 0 },
      uLook: { value: new THREE.Vector2() },
      uBeam: { value: new THREE.Vector2() },
      uAlpha: { value: 0.8 },
    });
    // the Shire's fireflies and leaves; Mordor's embers and ash
    const flies = field(k, { count: 60, shape: 'dot', dir: [0.2, 0.3], speed: [4, 12], size: [3, 7], sway: 30, twinkle: 0.9, repel: 50, parallax: 0.05 });
    const leaves = field(k, { count: 26, shape: 'leaf', dir: [0.4, -1], speed: [14, 28], size: [9, 15], sway: 50, spin: 1.2, repel: 60, parallax: 0.1 });
    const embers = field(k, { count: 90, shape: 'ember', dir: [0.15, 1], speed: [16, 40], size: [2, 6], sway: 24, twinkle: 0.5, repel: 40, parallax: 0.06 });
    const ash = field(k, { count: 60, shape: 'dot', dir: [-0.2, -1], speed: [8, 18], size: [2, 4], sway: 30, parallax: 0.08 });
    const sparks = bursts(k, { shape: 'spark', size: 10, max: 260 });

    const dragon = silhouette(DRAGON, [200, 60, 30], 0.9);
    dragon.visible = false;
    k.scene.add(dragon);

    let mordor = k.theme === 'mordor';
    const apply = () => {
      lands.uniforms.uMordor.value = mordor ? 1 : 0;
      flies.points.visible = leaves.points.visible = !mordor;
      embers.points.visible = ash.points.visible = mordor;
    };
    apply();

    // the Shire's fireworks: a rocket goes up, and bursts
    const COLORS = [[255, 210, 90], [120, 220, 255], [255, 120, 160], [160, 255, 140], [255, 255, 255]];
    const rockets = [];
    const show = { wait: rand(3, 6), dragon: 0, t: 0 };
    const beam = { on: false, t: 0, wait: rand(4, 8), from: 0, to: 0 };
    let litT = 0;

    return {
      step(dt, t) {
        lands.step(t);
        flies.step(t);
        leaves.step(t);
        embers.step(t);
        ash.step(t);
        sparks.step(dt);
        if (!mordor) {
          // the window at the door, lit for a while now and then
          litT += dt;
          lands.uniforms.uLit.value = k.reduced ? 1 : Math.max(0, Math.min(1, Math.sin(litT * 0.25) * 3));
          show.wait -= dt;
          if (show.wait <= 0 && dt > 0) {
            if (show.dragon++ % 3 === 2) {
              show.t = 0;
              dragon.visible = true;
            } else {
              const side = Math.random() < 0.5 ? -1 : 1;
              rockets.push({ x: side * k.size.w * rand(0.3, 0.45), y: -k.size.h / 2, vy: rand(320, 420), top: rand(0.05, 0.35) * k.size.h, color: pick(COLORS) });
            }
            show.wait = rand(5, 9);
          }
          for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];
            r.y += r.vy * dt;
            sparks.emit(r.x, r.y, { count: 1, speed: [0, 20], life: [0.3, 0.5], colors: [[255, 220, 160]], gravity: -60, size: 6 });
            if (r.y >= r.top) {
              sparks.emit(r.x, r.y, { count: 46, speed: [80, 230], life: [0.9, 1.6], colors: [r.color, [255, 255, 255]], gravity: -90, size: 9 });
              rockets.splice(i, 1);
            }
          }
          if (dragon.visible) {
            show.t += dt;
            const span = k.size.w + 300;
            const x = span / 2 - show.t * 260;
            const y = k.size.h * 0.28 + Math.sin(show.t * 2) * 30;
            dragon.position.set(x, y, 0);
            dragon.scale.set(-1, 1 + Math.sin(show.t * 9) * 0.15, 1);
            if (Math.random() < dt * 30) sparks.emit(x + 60, y, { count: 2, speed: [10, 50], life: [0.4, 0.8], colors: [[255, 140, 40], [255, 210, 90]], gravity: -40, size: 8 });
            if (show.t * 260 > span) dragon.visible = false;
          }
        } else {
          // the Eye: it looks at the pointer, and sweeps its beam across now and then
          const ex = -k.size.w / 2 + k.size.w * 0.065;
          const ey = -k.size.h / 2 + k.size.h * 0.6 + 16;
          const dx = k.pointer.x - ex;
          const dy = k.pointer.y - ey;
          const d = Math.hypot(dx, dy) || 1;
          const want = k.pointer.near > 0.1 ? [dx / d, dy / d] : [Math.sin(t * 0.4), 0];
          const look = lands.uniforms.uLook.value;
          look.x += (want[0] - look.x) * Math.min(1, dt * 3);
          look.y += (want[1] - look.y) * Math.min(1, dt * 3);
          if (!beam.on) {
            beam.wait -= dt;
            lands.uniforms.uBeam.value.y = 0;
            if (beam.wait <= 0 && dt > 0) Object.assign(beam, { on: true, t: 0, from: rand(-0.3, 0.1), to: rand(0.3, 0.7) });
          } else {
            beam.t += dt;
            const p = beam.t / 6;
            lands.uniforms.uBeam.value.set(beam.from + (beam.to - beam.from) * p, Math.sin(Math.PI * Math.min(1, p)) * 0.9);
            if (p >= 1) Object.assign(beam, { on: false, wait: rand(10, 16) });
          }
          if (k.reduced) lands.uniforms.uBeam.value.set(0.25, 0.7);
        }
        // reduced motion: the Shire's still frame has a firework open over it
        if (k.reduced && !mordor && !this.stilled) {
          this.stilled = true;
          sparks.emit(k.size.w * 0.38, k.size.h * 0.2, { count: 46, speed: [80, 230], life: [1, 1], colors: [[255, 210, 90], [255, 255, 255]], gravity: 0, size: 9 });
          sparks.step(0.35);
        }
      },
      recolor(c) {
        const dark = c.dark;
        const u = lands.uniforms;
        if (!mordor) {
          // watercolour greens on cream; deep night greens in the dark
          rgb(dark ? [36, 56, 30] : [196, 214, 160], u.uFar.value);
          rgb(dark ? [32, 52, 26] : [160, 192, 112], u.uMid.value);
          rgb(dark ? [42, 70, 30] : [120, 164, 80], u.uNear.value);
          rgb(dark ? [255, 214, 120] : [244, 214, 140], u.uGlow.value);
          rgb([61, 107, 42], u.uDoor.value);
          rgb([201, 162, 39], u.uBrass.value);
          u.uAlpha.value = dark ? 0.85 : 0.8;
        } else {
          // charcoal and ember on a pale page; black and fire in the dark
          rgb(dark ? [24, 12, 10] : [120, 100, 96], u.uFar.value);
          rgb(dark ? [12, 6, 5] : [60, 44, 40], u.uNear.value);
          rgb(dark ? [255, 106, 26] : [234, 120, 60], u.uGlow.value);
          u.uAlpha.value = dark ? 0.9 : 0.75;
        }
        flies.colors(dark ? [255, 230, 120] : [214, 168, 40], dark ? [190, 255, 140] : [140, 170, 60]);
        flies.glow(dark);
        leaves.colors(dark ? [90, 130, 50] : [110, 150, 60], dark ? [170, 130, 50] : [196, 150, 60]);
        leaves.uniforms.uOpacity.value = dark ? 0.7 : 0.85;
        embers.colors([255, 120, 30], [255, 200, 80]);
        embers.glow(dark);
        ash.colors(dark ? [110, 100, 96] : [120, 110, 104], dark ? [70, 64, 60] : [160, 150, 144]);
        ash.uniforms.uOpacity.value = dark ? 0.5 : 0.6;
        sparks.glow(dark);
        rgb(dark ? [210, 70, 30] : [170, 50, 24], dragon.userData.material.color);
        this.accent = c.accent;
      },
      retheme(theme) {
        mordor = theme === 'mordor';
        apply();
        this.recolor(k.colors);
      },
      burst(x, y) {
        if (mordor) sparks.emit(x, y, { count: 24, speed: [60, 200], colors: [[255, 120, 30], [255, 210, 90]], gravity: 120, size: 8 });
        else sparks.emit(x, y, { count: 36, speed: [80, 240], colors: [pick(COLORS), [255, 255, 255]], gravity: -90, size: 9 });
      },
    };
  });
}
