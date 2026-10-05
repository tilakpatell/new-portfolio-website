// The Jedi and Sith themes' background: stars at three depths that part
// round the pointer, a nebula in the theme's saber colour at the edges, and
// every so often a dogfight crossing the screen (for the Jedi, an X-wing
// chasing a TIE fighter; for the Sith, the other way round), the one behind
// firing. A click on empty page throws saber sparks.

import { ambience, backdrop, bursts, field, rand, rgb, silhouette } from '../kit';
import { mix } from '../../../lib/three/theme';

const NEBULA = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPointer;
uniform vec3 uTint;
uniform float uAlpha;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 p = vUv * uRes / 420.0;
  float n = noise(p + vec2(uTime * 0.02, 0.0)) * 0.6 + noise(p * 2.3 - vec2(0.0, uTime * 0.015)) * 0.4;
  // the clouds gather at the sides, away from the text
  float side = smoothstep(0.18, 0.0, vUv.x) + smoothstep(0.82, 1.0, vUv.x);
  float a = side * smoothstep(0.35, 0.9, n);
  // and a little light where the pointer is
  vec2 px = (vUv - 0.5) * uRes;
  a += uPointer.z * 0.35 * exp(-dot(px - uPointer.xy, px - uPointer.xy) / 26000.0);
  gl_FragColor = vec4(uTint, a * uAlpha);
}
`;

// Front-on, as they come across: the X-wing's four wings and cannons round
// its nose, the TIE's two hexagonal wings either side of its ball.
const XWING = [
  [[-6, -6], [6, -6], [6, 6], [-6, 6]],
  [[2, 3], [48, 30], [46, 34], [-1, 7]],
  [[-2, 3], [-48, 30], [-46, 34], [1, 7]],
  [[2, -3], [48, -30], [46, -34], [-1, -7]],
  [[-2, -3], [-48, -30], [-46, -34], [1, -7]],
  [[44, 27], [52, 27], [52, 37], [44, 37]],
  [[-44, 27], [-52, 27], [-52, 37], [-44, 37]],
  [[44, -27], [52, -27], [52, -37], [44, -37]],
  [[-44, -27], [-52, -27], [-52, -37], [-44, -37]],
];
const hexagon = (cx, w, h) => [[cx - w, 0], [cx - w * 0.55, h], [cx + w * 0.55, h], [cx + w, 0], [cx + w * 0.55, -h], [cx - w * 0.55, -h]];
const circle = (r, n = 14) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r]);
const TIE = [hexagon(-38, 5, 42), hexagon(38, 5, 42), [[-34, -4], [34, -4], [34, 4], [-34, 4]], circle(15, 18)];

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const sky = backdrop(k, NEBULA, { uTint: { value: new THREE.Color() }, uAlpha: { value: 0.3 } });
    const far = field(k, { count: 220, shape: 'dot', dir: [-1, 0], speed: [2, 6], size: [1.5, 3], twinkle: 0.6, repel: 26, parallax: 0.04, glow: true });
    const near = field(k, { count: 60, shape: 'spark', dir: [-1, 0], speed: [6, 14], size: [5, 11], twinkle: 0.4, repel: 40, parallax: 0.12, glow: true });
    const sparks = bursts(k, { shape: 'spark', size: 12 });

    const light = k.dark ? [235, 240, 255] : [40, 40, 52];
    const xwing = silhouette(XWING, light, 0.9);
    const tie = silhouette(TIE, light, 0.9);
    // engines and lasers: little glowing dashes
    const boltGeo = new THREE.PlaneGeometry(26, 2.6);
    const red = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, depthTest: false, depthWrite: false });
    const green = new THREE.MeshBasicMaterial({ color: 0x4dff6a, transparent: true, depthTest: false, depthWrite: false });
    const bolts = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(boltGeo, red);
      m.visible = false;
      m.userData = { vx: 0, life: 0 };
      k.scene.add(m);
      return m;
    });
    for (const s of [xwing, tie]) {
      s.visible = false;
      k.scene.add(s);
    }

    // the dogfight: who leads and who chases depends on the side you're on
    const fight = { on: false, t: 0, wait: rand(4, 7), dir: 1, y: 0, lead: null, chase: null, shot: 0 };
    const start = () => {
      const jedi = k.theme !== 'sith';
      fight.lead = jedi ? tie : xwing;
      fight.chase = jedi ? xwing : tie;
      fight.dir = Math.random() < 0.5 ? 1 : -1;
      fight.y = rand(0.15, 0.38) * k.size.h * (Math.random() < 0.5 ? 1 : -1);
      fight.t = 0;
      fight.shot = 0.6;
      fight.on = true;
      fight.lead.visible = fight.chase.visible = true;
    };
    const place = (ship, x, y, t, wobble) => {
      ship.position.set(x, y + Math.sin(t * 1.7 + wobble) * 26, 0);
      ship.rotation.z = Math.sin(t * 1.3 + wobble) * 0.35;
      const s = 0.75 + 0.25 * Math.sin(Math.min(1, t / 6) * Math.PI);
      ship.scale.setScalar(s);
    };
    const fire = () => {
      const b = bolts.find((m) => !m.visible);
      if (!b) return;
      const from = fight.chase;
      b.material = from === xwing ? red : green;
      b.position.copy(from.position);
      b.position.y += rand(-8, 8);
      b.userData.vx = fight.dir * 900;
      b.userData.life = 1;
      b.visible = true;
    };

    return {
      step(dt, t) {
        sky.step(t);
        far.step(t);
        near.step(t);
        sparks.step(dt);
        if (!fight.on) {
          fight.wait -= dt;
          if (fight.wait <= 0 && dt > 0) start();
        } else {
          fight.t += dt;
          const span = k.size.w + 400;
          const x = -fight.dir * (span / 2) + fight.dir * fight.t * 260;
          place(fight.lead, x, fight.y, fight.t, 0);
          place(fight.chase, x - fight.dir * 170, fight.y, fight.t - 0.35, 0.6);
          fight.shot -= dt;
          if (fight.shot <= 0) {
            fire();
            fight.shot = rand(0.25, 0.7);
          }
          if (fight.t * 260 > span + 200) {
            fight.on = false;
            fight.lead.visible = fight.chase.visible = false;
            fight.wait = rand(12, 20);
          }
        }
        for (const b of bolts) {
          if (!b.visible) continue;
          b.position.x += b.userData.vx * dt;
          b.userData.life -= dt * 1.4;
          b.material.opacity = Math.max(0, b.userData.life);
          if (b.userData.life <= 0) b.visible = false;
        }
        // reduced motion: one still frame, with the fight in it
        if (k.reduced && !fight.on) {
          start();
          fight.t = 3.2;
          this.step(0, t);
        }
      },
      recolor(c) {
        const saber = c.dark ? c.accent : mix(c.accent, c.bg, 0.15);
        rgb(saber, sky.uniforms.uTint.value);
        sky.uniforms.uAlpha.value = c.dark ? 0.32 : 0.16;
        const star = c.dark ? [236, 240, 255] : mix(c.text, c.bg, 0.45);
        far.colors(star, c.dark ? mix(star, c.accent, 0.4) : mix(star, c.accent, 0.3));
        near.colors(c.dark ? [255, 255, 255] : mix(c.text, c.bg, 0.35), c.dark ? c.accent : mix(c.accent, c.text, 0.2));
        far.glow(c.dark);
        near.glow(c.dark);
        sparks.glow(c.dark);
        const hull = c.dark ? mix(c.text, c.bg, 0.25) : mix(c.text, c.bg, 0.4);
        for (const s of [xwing, tie]) {
          rgb(hull, s.userData.material.color);
          s.userData.material.opacity = c.dark ? 0.85 : 0.75;
        }
        red.blending = green.blending = c.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        red.needsUpdate = green.needsUpdate = true;
        this.saber = c.accent;
      },
      retheme() {
        // the side changed: the next fight follows it
        if (fight.on) fight.t = 1e6;
      },
      burst(x, y) {
        sparks.emit(x, y, { count: 22, colors: [this.saber ?? [80, 160, 255], [255, 255, 255]], speed: [80, 320], gravity: -260 });
      },
      dispose() {
        boltGeo.dispose();
        red.dispose();
        green.dispose();
      },
    };
  });
}
