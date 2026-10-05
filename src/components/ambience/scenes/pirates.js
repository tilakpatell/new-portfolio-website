// The Caribbean themes' background: the sea along the foot of the screen,
// rolling and catching the light, under a sky of each theme's own. Tortuga
// sails at sunset with gulls about; the Black Pearl at night under the
// moon, black sails and all; the Flying Dutchman comes up out of the sea in
// a green glow and goes back under. Every so often a ship crosses the
// horizon. The waves rise to meet the pointer near them, and a click on
// empty page throws up spray (or, on the Dutchman, a ghost-light).

import { ambience, backdrop, bursts, field, rand, rgb, silhouette } from '../kit';
import { mix } from '../../../lib/three/theme';

const VARIANT = { tortuga: 0, pearl: 1, dutchman: 2 };
const HORIZON = 0.16; // the sea's line, a share of the screen's height up

const SEA = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPointer;
uniform float uVariant;
uniform vec3 uSea;
uniform vec3 uFoam;
uniform vec3 uSky;
uniform vec3 uOrb;
uniform float uAlpha;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// the height of the sea's surface at x (px), in px above the horizon
float swell(float x, float t) {
  return sin(x * 0.012 + t * 0.9) * 5.0 + sin(x * 0.031 - t * 1.4) * 2.5 + noise(vec2(x * 0.02, t * 0.5)) * 4.0;
}
void main() {
  vec2 px = vUv * uRes;
  float h = ${HORIZON.toFixed(2)} * uRes.y;
  // the pointer lifts the sea under it when it comes down near the water
  vec2 pp = uPointer.xy + uRes * 0.5;
  float lift = uPointer.z * exp(-pow((px.x - pp.x) / 90.0, 2.0)) * smoothstep(h + 220.0, h, pp.y) * 18.0;
  float surf = h + swell(px.x, uTime) + lift;
  vec3 col = uSky;
  float a = 0.0;
  if (px.y < surf) {
    // under the surface: deeper further down, bands of light rolling in
    float depth = (surf - px.y) / h;
    float band = smoothstep(0.55, 1.0, noise(vec2(px.x * 0.008 + uTime * 0.05, px.y * 0.05 - uTime * 0.4)));
    col = mix(uFoam, uSea, smoothstep(0.0, 0.25, depth));
    col = mix(col, uFoam, band * 0.25 * (1.0 - depth));
    a = 0.85;
    // the light's road across the water, under the sun or the moon
    float road = exp(-pow((px.x - uRes.x * 0.72) / (40.0 + depth * 60.0), 2.0)) * step(0.5, noise(vec2(px.x * 0.05, px.y * 0.3 + uTime)));
    col = mix(col, uOrb, road * 0.6 * (1.0 - uVariant * 0.3));
  } else {
    // the crest's foam, then the sky's glow over the horizon
    float crest = smoothstep(2.0, 0.0, px.y - surf);
    float glow = smoothstep(uRes.y * 0.45, h, px.y) * (uVariant == 1.0 ? 0.25 : 0.6);
    col = mix(uSky, uFoam, crest);
    a = max(crest * 0.9, glow * 0.5);
    // the sun (Tortuga) setting on the horizon, or the moon (the Pearl) up high
    vec2 orb = uVariant == 1.0 ? vec2(0.8, 0.82) * uRes : vec2(0.72 * uRes.x, h + 10.0);
    float r = uVariant == 1.0 ? 34.0 : 46.0;
    float d = length(px - orb);
    float disc = smoothstep(r + 1.5, r, d) * (uVariant == 2.0 ? 0.0 : 1.0);
    col = mix(col, uOrb, max(disc, 0.0));
    a = max(a, disc * 0.95);
    a = max(a, exp(-d / (r * 1.6)) * 0.35 * (uVariant == 2.0 ? 0.0 : 1.0));
    // the Dutchman's sea-mist, low and green
    if (uVariant == 2.0) a = max(a, smoothstep(h + 90.0, h, px.y) * noise(vec2(px.x * 0.006 - uTime * 0.05, px.y * 0.02)) * 0.7);
  }
  // fade the sea out toward the middle a little: the text's above it
  gl_FragColor = vec4(col, a * uAlpha);
}
`;

// a ship side on, bow to the right, waterline at y = 0
const mast = (x, top) => [[x - 1.5, 10], [x + 1.5, 10], [x + 1.5, top], [x - 1.5, top]];
const sail = (x, y0, y1, w0, w1) => [[x - w0, y0], [x + w0, y0], [x + w1 + 2, (y0 + y1) / 2], [x + w1, y1], [x - w1, y1], [x - w1 - 2, (y0 + y1) / 2]];
const HULL = [
  [[-80, 12], [76, 12], [62, -10], [-66, -10]],
  [[-82, 12], [-82, 28], [-50, 28], [-46, 12]],
  [[68, 9], [114, 24], [114, 27], [66, 13]],
  mast(-40, 80),
  mast(2, 102),
  mast(42, 78),
];
const SAILS = [
  sail(-40, 22, 48, 22, 18),
  sail(-40, 52, 74, 16, 12),
  sail(2, 22, 52, 26, 22),
  sail(2, 56, 94, 20, 14),
  sail(42, 22, 48, 22, 18),
  sail(42, 52, 72, 15, 11),
  [[4, 104], [26, 100], [4, 96]],
];
// a gull, wings out: flapped by squashing it
const GULL = [[-13, 1], [-7, 5], [0, 0], [7, 5], [13, 1], [7, 7], [0, 2.5], [-7, 7]];

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const sea = backdrop(k, SEA, {
      uVariant: { value: VARIANT[k.theme] ?? 0 },
      uSea: { value: new THREE.Color() },
      uFoam: { value: new THREE.Color() },
      uSky: { value: new THREE.Color() },
      uOrb: { value: new THREE.Color() },
      uAlpha: { value: 0.6 },
    });
    // the sky's own: stars over the Pearl, ghost-lights rising round the Dutchman
    const stars = field(k, { count: 110, shape: 'dot', dir: [0, 0], speed: [0, 0], size: [1.5, 3.2], twinkle: 0.8, parallax: 0.03 });
    const wisps = field(k, { count: 50, shape: 'ember', dir: [0.1, 1], speed: [10, 26], size: [3, 7], sway: 30, twinkle: 0.4, repel: 50, parallax: 0.06 });
    const spray = bursts(k, { shape: 'dot', size: 8 });

    const hull = silhouette(HULL, [40, 28, 18], 1);
    const sails = silhouette(SAILS, [240, 230, 205], 1);
    const ship = new THREE.Group();
    ship.add(hull, sails);
    ship.visible = false;
    k.scene.add(ship);
    const gulls = Array.from({ length: Math.max(2, Math.round(6 * k.density)) }, () => {
      const g = silhouette(GULL, [40, 40, 40], 0.8);
      g.userData.fly = { x: 0, y: 0, vx: 0, phase: rand(0, 6), size: rand(0.8, 1.4) };
      k.scene.add(g);
      return g;
    });

    let variant = VARIANT[k.theme] ?? 0;
    const voyage = { on: false, t: 0, wait: rand(3, 6), dir: 1 };
    const start = () => {
      voyage.on = true;
      voyage.t = 0;
      voyage.dir = Math.random() < 0.5 ? 1 : -1;
      ship.scale.set(voyage.dir * 0.85, 0.85, 1);
      ship.visible = true;
    };
    const seaLevel = () => -k.size.h / 2 + HORIZON * k.size.h;
    let gullsPlaced = false;
    const placeGull = (g, anywhere) => {
      const f = g.userData.fly;
      f.vx = rand(30, 60) * (Math.random() < 0.5 ? 1 : -1);
      f.x = anywhere ? rand(-k.size.w / 2, k.size.w / 2) : (f.vx > 0 ? -1 : 1) * (k.size.w / 2 + 30);
      f.y = rand(seaLevel() + 60, k.size.h * 0.35);
    };

    const apply = () => {
      sea.uniforms.uVariant.value = variant;
      stars.points.visible = variant === 1;
      wisps.points.visible = variant === 2;
      for (const g of gulls) g.visible = variant === 0;
    };
    apply();

    return {
      step(dt, t) {
        sea.step(t);
        stars.step(t);
        wisps.step(t);
        spray.step(dt);
        if (!gullsPlaced) {
          for (const g of gulls) placeGull(g, true);
          gullsPlaced = true;
        }
        for (const g of gulls) {
          const f = g.userData.fly;
          f.x += f.vx * dt;
          f.y += Math.sin(t * 0.7 + f.phase) * 6 * dt;
          const flap = 0.45 + 0.55 * Math.abs(Math.sin(t * 4 + f.phase));
          g.position.set(f.x, f.y, 0);
          g.scale.set(f.size * Math.sign(f.vx), f.size * flap, 1);
          if (Math.abs(f.x) > k.size.w / 2 + 40) placeGull(g, false);
        }

        if (!voyage.on) {
          voyage.wait -= dt;
          if (voyage.wait <= 0 && dt > 0) start();
        } else {
          voyage.t += dt;
          const span = k.size.w + 320;
          const x = -voyage.dir * span / 2 + voyage.dir * voyage.t * 42;
          let y = seaLevel() + 2 + Math.sin(voyage.t * 1.3) * 3;
          // the Dutchman surfaces, sails a while, and goes back down
          if (variant === 2) {
            const life = span / 42;
            const up = Math.min(1, voyage.t / 6, (life - voyage.t) / 6);
            y -= (1 - Math.max(0, up)) * 110;
          }
          ship.position.set(x, y, 0);
          ship.rotation.z = Math.sin(voyage.t * 0.9) * 0.04;
          if (voyage.t * 42 > span) {
            voyage.on = false;
            ship.visible = false;
            voyage.wait = rand(10, 18);
          }
        }
        // reduced motion: one still frame with the ship on the horizon
        if (k.reduced && !voyage.on) {
          start();
          voyage.dir = 1;
          ship.scale.set(0.85, 0.85, 1);
          voyage.t = (k.size.w * 0.25 + 160) / 42;
          this.step(0, t);
        }
      },
      recolor(c) {
        const v = variant;
        const dark = c.dark;
        // the sea, its foam, the sky's glow and the sun or the moon
        const SEAS = [[dark ? [12, 52, 64] : [40, 112, 120], [214, 170, 80]], [dark ? [10, 12, 18] : [60, 66, 80], [240, 232, 210]], [dark ? [4, 40, 34] : [30, 110, 90], [93, 242, 192]]];
        const [deep, orb] = SEAS[v];
        rgb(deep, sea.uniforms.uSea.value);
        rgb(dark ? mix(deep, [255, 255, 255], 0.35) : mix(deep, [255, 255, 255], 0.55), sea.uniforms.uFoam.value);
        rgb(v === 0 ? [242, 176, 80] : v === 1 ? (dark ? [70, 80, 110] : [150, 160, 180]) : [93, 242, 192], sea.uniforms.uSky.value);
        rgb(orb, sea.uniforms.uOrb.value);
        sea.uniforms.uAlpha.value = dark ? 0.75 : 0.55;
        stars.colors(dark ? [240, 236, 220] : [90, 86, 76], dark ? [242, 196, 90] : [130, 110, 70]);
        stars.glow(dark);
        wisps.colors([93, 242, 192], [180, 255, 230]);
        wisps.glow(dark);
        wisps.uniforms.uOpacity.value = dark ? 0.9 : 0.6;
        spray.glow(dark);
        // the ships: Tortuga's in cream canvas, the Pearl's black, the Dutchman's a green ghost
        const wood = dark ? [70, 52, 34] : [60, 40, 24];
        rgb(v === 2 ? (dark ? [40, 140, 110] : [20, 90, 72]) : wood, hull.userData.material.color);
        rgb(v === 0 ? (dark ? [236, 222, 190] : [250, 244, 226]) : v === 1 ? (dark ? [52, 46, 38] : [30, 26, 20]) : [93, 242, 192], sails.userData.material.color);
        hull.userData.material.opacity = v === 2 ? 0.7 : 0.9;
        sails.userData.material.opacity = v === 2 ? 0.55 : v === 1 ? 0.95 : 0.9;
        const ghost = v === 2 && dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        hull.userData.material.blending = sails.userData.material.blending = ghost;
        hull.userData.material.needsUpdate = sails.userData.material.needsUpdate = true;
        for (const g of gulls) rgb(dark ? [210, 205, 190] : [60, 56, 50], g.userData.material.color);
        this.spray = v === 2 ? [[93, 242, 192], [200, 255, 235]] : [[255, 255, 255], mix(deep, [255, 255, 255], 0.6)];
      },
      retheme(theme) {
        variant = VARIANT[theme] ?? 0;
        apply();
        this.recolor(k.colors);
      },
      burst(x, y) {
        spray.emit(x, y, { count: 20, colors: this.spray, speed: [80, 240], gravity: variant === 2 ? 60 : -380, size: 8, angle: variant === 2 ? [0, Math.PI * 2] : [Math.PI * 0.15, Math.PI * 0.85] });
      },
    };
  });
}
