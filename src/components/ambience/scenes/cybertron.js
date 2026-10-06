// The Transformers themes' background: Cybertron's metal. A hex grid lines
// the sides of the screen with energon pulses running through it (and
// gathering where the pointer is), energon motes drift up, and every so
// often the faction's insignia is scanned in large at one side and fades.
// Each bot adds his own: Optimus splits the grid red and blue; Bumblebee
// runs hazard stripes along the bottom; Megatron's fusion cannon charges in
// a corner; Shockwave's one eye watches the pointer; Soundwave's waveform
// runs along the foot of the screen and jumps when the pointer moves. A
// click on empty page throws sparks.

import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { ambience, backdrop, bursts, field, rand, rgb } from '../kit';
import { mix } from '../../../lib/three/theme';
import { AUTOBOT_PATH, AUTOBOT_VIEWBOX, DECEPTICON_PATH, DECEPTICON_VIEWBOX } from '../../marks';

const BOTS = { optimus: 0, megatron: 1, bumblebee: 2, shockwave: 3, soundwave: 4 };
const AUTOBOTS = new Set(['optimus', 'bumblebee']);

const GRID = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPointer;
uniform vec3 uLine;
uniform vec3 uLine2;
uniform vec3 uPulse;
uniform float uSplit;    // Optimus: red on the left, blue on the right
uniform float uHazard;   // Bumblebee: stripes along the bottom
uniform float uAlpha;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// distance to the nearest hex edge, and the cell's id
vec3 hex(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  vec4 hh = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
  vec2 q = abs(hh.xy);
  float edge = 0.5 - max(dot(q, s * 0.5), q.x);
  return vec3(edge, hh.zw);
}
void main() {
  vec2 px = (vUv - 0.5) * uRes;
  vec3 hx = hex(px / 46.0);
  float line = smoothstep(0.035, 0.0, hx.x);
  // a pulse of energon running out through the cells, each on its own beat
  float beat = fract(uTime * 0.25 + hash(hx.yz) * 3.0);
  float pulse = smoothstep(0.06, 0.0, abs(hx.x - 0.02)) * smoothstep(0.9, 1.0, beat) * 2.0;
  // and more of it where the pointer is
  float near = uPointer.z * smoothstep(220.0, 0.0, length(px - uPointer.xy));
  float side = smoothstep(0.26, 0.04, vUv.x) + smoothstep(0.74, 0.96, vUv.x);
  float a = line * (side * 0.7 + near * 0.8) + (pulse * side + near * line * 1.5);
  vec3 col = mix(uLine, uLine2, uSplit * smoothstep(0.35, 0.65, vUv.x));
  col = mix(col, uPulse, clamp(pulse + near * line, 0.0, 1.0));
  // hazard stripes along the bottom edge
  float stripe = step(0.5, fract((px.x + px.y) / 28.0 - uTime * 0.2)) * step(vUv.y * uRes.y, 12.0) * uHazard;
  col = mix(col, uPulse, stripe);
  a = max(a, stripe * 0.9);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uAlpha);
}
`;

// a mark scanned in: drawn up to the scan line, brightest along it
const SCAN_VERT = /* glsl */ `
varying float vY;
void main() {
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SCAN_FRAG = /* glsl */ `
varying float vY;
uniform float uScan;
uniform vec3 uColor;
uniform vec3 uEdge;
uniform float uAlpha;
void main() {
  float shown = step(vY, uScan);
  float edge = smoothstep(14.0, 0.0, abs(vY - uScan));
  gl_FragColor = vec4(mix(uColor, uEdge, edge), max(shown * uAlpha, edge * 0.9 * step(0.001, uAlpha)));
}
`;

function insignia(THREE, path, viewBox, size) {
  const [x, y, w, h] = viewBox.split(' ').map(Number);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill-rule="evenodd" d="${path}"/></svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap((p) => p.toShapes());
  const geo = new THREE.ShapeGeometry(shapes, 4);
  // centred, y up, `size` px tall
  const s = size / h;
  geo.translate(-(x + w / 2), -(y + h / 2), 0);
  geo.scale(s, -s, 1);
  return geo;
}

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    const grid = backdrop(k, GRID, {
      uLine: { value: new THREE.Color() },
      uLine2: { value: new THREE.Color() },
      uPulse: { value: new THREE.Color() },
      uSplit: { value: 0 },
      uHazard: { value: 0 },
      uAlpha: { value: 0.4 },
    });
    const motes = field(k, { count: 90, shape: 'spark', dir: [0, 1], speed: [8, 22], size: [3, 7], twinkle: 0.6, repel: 50, sway: 14, parallax: 0.06 });
    const sparks = bursts(k, { shape: 'spark', size: 11 });

    const SIZE = 280;
    const marks = { autobot: insignia(THREE, AUTOBOT_PATH, AUTOBOT_VIEWBOX, SIZE), decepticon: insignia(THREE, DECEPTICON_PATH, DECEPTICON_VIEWBOX, SIZE) };
    const scanMat = new THREE.ShaderMaterial({
      vertexShader: SCAN_VERT,
      fragmentShader: SCAN_FRAG,
      uniforms: { uScan: { value: -999 }, uColor: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() }, uAlpha: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mark = new THREE.Mesh(marks.autobot, scanMat);
    mark.visible = false;
    k.scene.add(mark);

    // Shockwave's eye: a socket and a glowing slit that looks at the pointer
    const eye = new THREE.Group();
    const socket = new THREE.Mesh(new THREE.CircleGeometry(34, 32), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(18, 24), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    iris.scale.set(1, 0.7, 1);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, depthTest: false, depthWrite: false }));
    eye.add(glow, socket, iris);
    k.scene.add(eye);

    // Megatron's cannon: a charge that swells and lets go
    const charge = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    k.scene.add(charge);

    // Soundwave's waveform along the bottom
    const N = 160;
    const wavePos = new Float32Array(N * 3);
    const waveGeo = new THREE.BufferGeometry();
    waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePos, 3));
    const wave = new THREE.Line(waveGeo, new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    wave.frustumCulled = false;
    k.scene.add(wave);
    let energy = 0;
    let last = [0, 0];

    let bot = BOTS[k.theme] ?? 0;
    const show = { on: false, t: 0, wait: rand(3, 6) };
    const apply = () => {
      mark.geometry = AUTOBOTS.has(k.theme) ? marks.autobot : marks.decepticon;
      eye.visible = bot === 3;
      charge.visible = bot === 1;
      wave.visible = bot === 4;
      grid.uniforms.uSplit.value = bot === 0 ? 1 : 0;
      grid.uniforms.uHazard.value = bot === 2 ? 1 : 0;
    };
    apply();

    return {
      resize(w, h) {
        eye.position.set(w / 2 - 90, h / 2 - 150, 0);
        charge.position.set(-w / 2 + 70, h / 2 - 140, 0);
      },
      step(dt, t) {
        grid.step(t);
        motes.step(t);
        sparks.step(dt);

        // the insignia, scanned in at one side and let fade
        if (!show.on) {
          show.wait -= dt;
          if (show.wait <= 0 && dt > 0) {
            show.on = true;
            show.t = 0;
            const side = Math.random() < 0.5 ? -1 : 1;
            mark.position.set(side * (k.size.w / 2 - Math.min(220, k.size.w * 0.2)), rand(-0.15, 0.15) * k.size.h, 0);
            mark.visible = true;
          }
        } else {
          show.t += dt;
          scanMat.uniforms.uScan.value = -SIZE / 2 + Math.min(1, show.t / 2.2) * (SIZE + 20);
          scanMat.uniforms.uAlpha.value = this.markAlpha * Math.min(1, (7 - show.t) / 2);
          if (show.t > 7) {
            show.on = false;
            mark.visible = false;
            show.wait = rand(10, 16);
          }
        }

        if (bot === 3) {
          // the eye looks at the pointer (or straight ahead without one)
          const dx = k.pointer.x - eye.position.x;
          const dy = k.pointer.y - eye.position.y;
          const d = Math.hypot(dx, dy) || 1;
          const reach = 12 * k.pointer.near;
          iris.position.set((dx / d) * reach, (dy / d) * reach * 0.7, 0);
          glow.material.opacity = (0.14 + 0.06 * Math.sin(t * 2)) * this.glowAlpha;
        }
        if (bot === 1) {
          const c = (t % 6) / 6;
          const s = c < 0.85 ? 0.3 + c : 1.6 - (c - 0.85) * 8;
          charge.scale.setScalar(Math.max(0.2, s));
          charge.material.opacity = Math.max(0, Math.min(1, s)) * this.glowAlpha * 0.7;
        }
        if (bot === 4) {
          const moved = Math.hypot(k.pointer.x - last[0], k.pointer.y - last[1]);
          last = [k.pointer.x, k.pointer.y];
          energy = Math.min(1, energy * Math.exp(-dt * 2) + moved * 0.004);
          const y0 = -k.size.h / 2 + 46;
          for (let i = 0; i < N; i++) {
            const x = -k.size.w / 2 + (i / (N - 1)) * k.size.w;
            const env = Math.sin((i / (N - 1)) * Math.PI);
            const y = y0 + env * (Math.sin(i * 0.35 + t * 6) * 6 + Math.sin(i * 0.11 - t * 3) * 8) * (0.4 + energy * 2.2);
            wavePos.set([x, y, 0], i * 3);
          }
          waveGeo.attributes.position.needsUpdate = true;
        }
        // reduced motion: one still frame with the insignia scanned in
        if (k.reduced && !show.on) {
          show.on = true;
          show.t = 3;
          mark.position.set(-k.size.w / 2 + Math.min(200, k.size.w * 0.2), -k.size.h * 0.12, 0);
          mark.visible = true;
          this.step(0, t);
        }
      },
      recolor(c) {
        const dark = c.dark;
        const glowOn = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        // Optimus's grid is red on one side and blue on the other
        const red = dark ? c.saber : c.accent;
        rgb(dark ? mix(c.saber, c.bg, 0.45) : mix(c.accent, c.bg, 0.45), grid.uniforms.uLine.value);
        rgb(bot === 0 ? (dark ? [80, 140, 255] : [40, 80, 170]) : dark ? mix(c.saber, c.bg, 0.45) : mix(c.accent, c.bg, 0.45), grid.uniforms.uLine2.value);
        rgb(dark ? c.saber : c.accent, grid.uniforms.uPulse.value);
        grid.uniforms.uAlpha.value = dark ? 0.42 : 0.3;
        motes.colors(dark ? c.saber : c.accent, dark ? [255, 255, 255] : mix(c.accent, c.text, 0.4));
        motes.glow(dark);
        sparks.glow(dark);
        rgb(dark ? mix(c.accent, c.bg, 0.2) : mix(c.accent, c.bg, 0.55), scanMat.uniforms.uColor.value);
        rgb(dark ? c.saber : c.accent, scanMat.uniforms.uEdge.value);
        scanMat.blending = glowOn;
        scanMat.needsUpdate = true;
        this.markAlpha = dark ? 0.35 : 0.28;
        // Shockwave's eye is the one red thing about him; Megatron's charge is his purple
        rgb(dark ? [24, 20, 34] : [70, 60, 90], socket.material.color);
        socket.material.opacity = dark ? 0.9 : 0.5;
        rgb([255, 60, 40], iris.material.color);
        rgb([255, 60, 40], glow.material.color);
        rgb(dark ? c.saber : c.accent, charge.material.color);
        glow.material.blending = charge.material.blending = glowOn;
        glow.material.needsUpdate = charge.material.needsUpdate = true;
        this.glowAlpha = dark ? 1 : 0.7;
        rgb(dark ? c.saber : c.accent, wave.material.color);
        wave.material.opacity = dark ? 0.8 : 0.6;
        this.spark = [red, dark ? [255, 255, 255] : mix(c.accent, c.text, 0.3)];
      },
      retheme(theme) {
        bot = BOTS[theme] ?? 0;
        apply();
        this.recolor(k.colors);
      },
      burst(x, y) {
        sparks.emit(x, y, { count: 22, colors: this.spark, speed: [100, 320], gravity: -300 });
      },
      dispose() {
        // the insignia not on show isn't in the scene for disposeTree to find
        marks.autobot.dispose();
        marks.decepticon.dispose();
      },
    };
  });
}
