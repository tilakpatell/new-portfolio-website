// The Arcade theme's background: an eighties arcade cabinet's attract
// mode. A neon grid scrolls toward a striped sun along the bottom of the
// screen, pixel stars twinkle and scatter from the pointer, and every so
// often a row of space invaders marches across the top, two frames a step,
// with a UFO now and then. A click on empty page is an eight-bit
// explosion, and a hundred points.

import { ambience, backdrop, bursts, field, label, rand, rgb } from '../kit';
import { mix } from '../../../lib/three/theme';

const GRID = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uGrid;
uniform vec3 uSun;
uniform vec3 uSun2;
uniform float uAlpha;
void main() {
  float h = 0.2;  // the horizon
  float a = 0.0;
  vec3 col = uGrid;
  vec2 p = (vUv - vec2(0.5, h)) * vec2(uRes.x / uRes.y, 1.0);
  if (vUv.y < h) {
    float d = (h - vUv.y) / h;
    float z = 1.0 / max(d, 0.03);
    // grid coordinates, the lines drawn a pixel or so wide however far away
    vec2 g = vec2(p.x * z * 3.0, z * 0.6 + uTime * 0.6);
    vec2 w = fwidth(g);
    vec2 l = abs(fract(g - 0.5) - 0.5) / max(w, 1e-4);
    float lines = 1.0 - min(min(l.x, l.y), 1.0);
    // and gone where they'd crowd into a blur, near the horizon
    lines *= 1.0 - smoothstep(0.12, 0.45, max(w.x, w.y));
    a = lines * smoothstep(0.0, 0.5, d) + smoothstep(0.03, 0.0, d) * 0.5;
  } else {
    // the sun: a disc in two colours with stripes cut out of its lower half
    float r = length(p - vec2(0.0, 0.07));
    float disc = smoothstep(0.125, 0.12, r);
    float y = (p.y - 0.07) / 0.12;
    float stripes = step(0.0, y) + step(0.5, fract(y * 7.0 + uTime * 0.2)) * step(y, 0.0);
    a = disc * stripes;
    col = mix(uSun2, uSun, clamp(y * 0.5 + 0.5, 0.0, 1.0));
    // and the glow round it
    a += smoothstep(0.32, 0.12, r) * 0.18;
  }
  // scanlines over everything
  a *= 0.82 + 0.18 * step(0.5, fract(vUv.y * uRes.y / 3.0));
  gl_FragColor = vec4(col, a * uAlpha);
}
`;

// an invader, two frames, eight by eleven: 1 is a lit pixel
const CRAB = [
  ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
  ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
];
const SQUID = [
  ['00001100000', '00011110000', '00111111000', '01101101100', '01111111100', '00010010000', '00101101000', '01010010100'],
  ['00001100000', '00011110000', '00111111000', '01101101100', '01111111100', '00101101000', '01000000100', '00100001000'],
];
const UFO = ['0000111100000', '0011111111000', '0111111111100', '1101101101110', '1111111111111', '0011100111000', '0001000010000'];

const COLS = 7;
const PX = 4; // one invader pixel, in screen pixels

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const grid = backdrop(k, GRID, { uGrid: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSun2: { value: new THREE.Color() }, uAlpha: { value: 0.5 } });
    const stars = field(k, { count: 140, shape: 'pixel', dir: [0, -1], speed: [3, 10], size: [2, 4], twinkle: 0.8, repel: 60, parallax: 0.06 });
    const boom = bursts(k, { shape: 'pixel', size: 8 });

    // the invaders: every lit pixel of every invader is one instance
    const sprites = [CRAB, SQUID];
    const pix = [];
    for (let c = 0; c < COLS; c++) {
      const kind = c % 2;
      for (let f = 0; f < 2; f++) {
        sprites[kind][f].forEach((row, y) => [...row].forEach((on, x) => on === '1' && pix.push({ c, f, x: x - 5, y: 3.5 - y })));
      }
    }
    const cell = new THREE.PlaneGeometry(PX, PX);
    const invMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    const invaders = new THREE.InstancedMesh(cell, invMat, pix.length);
    invaders.frustumCulled = false;
    invaders.visible = false;
    k.scene.add(invaders);
    const ufoPix = [];
    UFO.forEach((row, y) => [...row].forEach((on, x) => on === '1' && ufoPix.push([x - 6, 3 - y])));
    const ufoMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    const ufo = new THREE.InstancedMesh(cell, ufoMat, ufoPix.length);
    ufo.frustumCulled = false;
    const m = new THREE.Matrix4();
    ufoPix.forEach(([x, y], i) => ufo.setMatrixAt(i, m.makeTranslation(x * PX, y * PX, 0)));
    ufo.visible = false;
    k.scene.add(ufo);

    const march = { on: false, t: 0, wait: rand(3, 6), x: 0, y: 0, dir: 1, frame: 0, beat: 0, gone: new Set() };
    const fly = { on: false, t: 0, dir: 1 };
    const gap = 64;
    const start = () => {
      march.on = true;
      march.t = 0;
      march.dir = Math.random() < 0.5 ? 1 : -1;
      march.x = -march.dir * (k.size.w / 2 + COLS * gap);
      march.y = k.size.h / 2 - 120;
      march.gone.clear();
      invaders.visible = true;
      if (Math.random() < 0.5) {
        fly.on = true;
        fly.t = 0;
        fly.dir = -march.dir;
        ufo.visible = true;
      }
    };
    const draw = () => {
      let i = 0;
      for (const p of pix) {
        const show = p.f === march.frame && !march.gone.has(p.c);
        const s = show ? 1 : 0;
        m.makeScale(s, s, 1).setPosition(march.x + p.c * gap + p.x * PX, march.y + p.y * PX, 0);
        invaders.setMatrixAt(i++, m);
      }
      invaders.instanceMatrix.needsUpdate = true;
    };
    const points = [];

    return {
      step(dt, t) {
        grid.step(t);
        stars.step(t);
        boom.step(dt);
        if (!march.on) {
          march.wait -= dt;
          if (march.wait <= 0 && dt > 0) start();
        } else {
          march.t += dt;
          march.beat += dt;
          // a step every half a second, the way the cabinet does it
          if (march.beat > 0.5) {
            march.beat = 0;
            march.frame ^= 1;
            march.x += march.dir * 22;
          }
          // an invader the pointer touches is shot down
          if (k.pointer.near > 0.5) {
            for (let c = 0; c < COLS; c++) {
              if (march.gone.has(c)) continue;
              const cx = march.x + c * gap;
              if (Math.abs(cx - k.pointer.x) < 24 && Math.abs(march.y - k.pointer.y) < 22) {
                march.gone.add(c);
                boom.emit(cx, march.y, { count: 14, colors: [this.alien, [255, 255, 255]], speed: [60, 200], gravity: -200, size: 7 });
              }
            }
          }
          draw();
          const across = march.dir > 0 ? march.x > k.size.w / 2 + 40 : march.x + COLS * gap < -k.size.w / 2 - 40;
          if (across || march.gone.size === COLS) {
            march.on = false;
            invaders.visible = false;
            march.wait = rand(10, 15);
          }
        }
        if (fly.on) {
          fly.t += dt;
          ufo.position.set(-fly.dir * (k.size.w / 2 + 60) + fly.dir * fly.t * 120, k.size.h / 2 - 70, 0);
          if (fly.t * 120 > k.size.w + 120) {
            fly.on = false;
            ufo.visible = false;
          }
        }
        for (let i = points.length - 1; i >= 0; i--) {
          const p = points[i];
          p.t += dt;
          p.mesh.position.y += dt * 50;
          p.mesh.material.opacity = Math.max(0, 1 - p.t / 1.2) * (Math.floor(p.t * 10) % 2 ? 0.6 : 1);
          if (p.t > 1.2) {
            p.mesh.parent.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.map.dispose();
            p.mesh.material.dispose();
            points.splice(i, 1);
          }
        }
        // reduced motion: one still frame with the invaders in it
        if (k.reduced && !march.on) {
          start();
          march.x = k.size.w * 0.08;
          draw();
        }
      },
      recolor(c) {
        // neon on the dark, pink and violet ink on the light
        this.alien = c.dark ? c.saber : mix(c.accent, c.text, 0.15);
        rgb(this.alien, invMat.color);
        invMat.opacity = c.dark ? 0.9 : 0.75;
        rgb(c.dark ? [255, 90, 160] : c.accent, ufoMat.color);
        ufoMat.opacity = c.dark ? 0.9 : 0.75;
        rgb(c.dark ? [255, 70, 160] : mix(c.accent, c.bg, 0.25), grid.uniforms.uGrid.value);
        rgb([255, 214, 90], grid.uniforms.uSun.value);
        rgb([214, 36, 110], grid.uniforms.uSun2.value);
        grid.uniforms.uAlpha.value = c.dark ? 0.62 : 0.34;
        stars.colors(c.dark ? [255, 255, 255] : mix(c.text, c.bg, 0.5), c.dark ? c.saber : c.accent);
        stars.glow(c.dark);
        boom.glow(c.dark);
        const blend = c.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        invMat.blending = ufoMat.blending = blend;
        invMat.needsUpdate = ufoMat.needsUpdate = true;
        this.dark = c.dark;
        this.accent = c.accent;
      },
      burst(x, y) {
        boom.emit(x, y, { count: 24, colors: [this.alien, this.accent, [255, 214, 90]], speed: [80, 260], gravity: -240, size: 9 });
        const tag = label('+100', { font: '700 22px "Press Start 2P", ui-monospace, monospace', color: this.dark ? '#ffd65a' : '#b81d5d' });
        const half = tag.geometry.parameters.width / 2;
        tag.position.set(Math.max(-k.size.w / 2 + half, Math.min(k.size.w / 2 - half, x)), y + 26, 0);
        tag.renderOrder = 12;
        k.scene.add(tag);
        points.push({ mesh: tag, t: 0 });
      },
      dispose() {
        for (const p of points) p.mesh.material.map.dispose();
      },
    };
  });
}
