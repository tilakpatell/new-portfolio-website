// The Rick and Morty themes' background: cartoon space. Stars twinkle, and
// the show's junk drifts through it, inked like the cartoon: ringed planets,
// a moon, a Plumbus, Meeseeks boxes, a portal gun, a pickle with a face.
// Every twelve seconds or so a portal opens near an edge, spits something out
// or swallows something, and closes. Rest the pointer for a second and a
// little portal opens under it and pulls the junk nearby in; a click on empty
// page pops a tiny portal that sprays goo. The portal is always portal green;
// the planets, the stars and the glow take the theme's colour (Rick's green,
// Morty's yellow, Summer's pink, Beth's wine).

import { ambience, backdrop, bursts, field, lift, rand } from '../kit';
import { mix } from '../../../lib/three/theme';
import { sharpen } from '../../../lib/three/textures';

// each theme's own colour, a second one the junk is painted in, and the
// colour it glows in the dark (Beth's wine is too deep to glow as it is)
const THEMES = {
  portal: { tint: [151, 206, 76], second: [69, 197, 232], glow: [151, 206, 76] },
  morty: { tint: [243, 216, 75], second: [59, 101, 184], glow: [243, 216, 75] },
  summer: { tint: [226, 85, 127], second: [226, 115, 58], glow: [255, 143, 177] },
  beth: { tint: [142, 43, 72], second: [241, 207, 106], glow: [214, 86, 124] },
};
const GREEN = [151, 206, 76];
const INK = [27, 20, 36];
const NIGHT = [9, 9, 11];
const WHITE = [255, 255, 255];
const GOO_LIGHT = [[110, 180, 40], [63, 138, 31], [151, 206, 76]];
const GOO_DARK = [[151, 206, 76], [201, 239, 106], [230, 242, 122]];

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => {
  const v = clamp01(x);
  return v * v * (3 - 2 * v);
};
// grows a touch past 1 and settles back: a portal popping open
const backOut = (x) => {
  const v = clamp01(x) - 1;
  return 1 + 2.7 * v * v * v + 1.7 * v * v;
};

// The kit's particles are lifted (kit.js's `lift`) to come out as themselves,
// and this scene's own shaders take their colours just as they're written
const raw = (c, target) => target.setRGB(c[0] / 255, c[1] / 255, c[2] / 255);

// Space: clouds of the theme's colour at the sides, with portal-green wisps
// through them. In light mode they're printed as a comic's halftone dots.
const SPACE = /* glsl */ `
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;
uniform vec3 uTint;
uniform vec3 uGreen;
uniform float uAlpha;
uniform float uDots;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 px = vUv * uRes;
  vec2 p = (px - vec2(0.0, uScroll * 0.04)) / 360.0;
  float n1 = noise(p + vec2(uTime * 0.018, 0.0));
  float n2 = noise(p * 2.4 - vec2(0.0, uTime * 0.014));
  float n = n1 * 0.62 + n2 * 0.38;
  // the clouds keep to the sides, away from the text
  float side = smoothstep(0.27, 0.0, vUv.x) + smoothstep(0.73, 1.0, vUv.x);
  float cloud = side * smoothstep(0.32, 0.85, n);
  vec3 col = mix(uTint, uGreen, smoothstep(0.55, 0.8, n2) * 0.7);
  // halftone: a tilted grid of dots that swell where the cloud is thick
  vec2 g = mat2(0.966, -0.259, 0.259, 0.966) * px / 9.0;
  float rad = sqrt(cloud) * 0.52;
  float dots = smoothstep(rad + 0.07, rad - 0.07, length(fract(g) - 0.5)) * step(0.03, cloud);
  gl_FragColor = vec4(col, mix(cloud, dots, uDots) * uAlpha);
}
`;

// A portal, on a quad PAD times its radius: a lumpy oval of goo whose edge
// wobbles, green arms wound into a spiral that turns (the middle faster), a
// pale eye and a bright lip, in the flat tones of a cel. Light mode inks an
// outline round it; dark mode gives it a green haze.
const PAD = 1.5;
const PORTAL = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uOpen;
uniform float uSeed;
uniform float uPx;
uniform float uInk;
uniform vec3 uInkCol;
uniform float uHaze;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 q = (vUv - 0.5) * ${(PAD * 2).toFixed(1)};
  float r = length(q);
  float a = atan(q.y, q.x);
  // gooey: two ripples running round the edge opposite ways
  float edge = 1.0 + 0.05 * sin(a * 5.0 + uTime * 2.3 + uSeed) + 0.028 * sin(a * 9.0 - uTime * 3.6 + uSeed * 2.0);
  float d = r / edge;
  // the swirl: it all turns, the middle fastest, and opening winds it up
  float tw = 4.0 * (1.0 - d) * (1.0 - d) + 1.4 * (1.0 - d) + uTime * 1.9 + (1.0 - uOpen) * 5.0;
  float arms = 0.5 + 0.5 * sin((a + tw) * 3.0 + d * 2.0);
  float cs = cos(tw), sn = sin(tw);
  float n = noise(mat2(cs, sn, -sn, cs) * q * 2.6 + uSeed * 3.7);
  float s = arms * 0.62 + n * 0.5 - 0.06;
  vec3 c = mix(vec3(0.14, 0.47, 0.09), vec3(0.42, 0.76, 0.17), smoothstep(0.40, 0.46, s));
  c = mix(c, vec3(0.64, 0.88, 0.27), smoothstep(0.70, 0.76, s));
  c = mix(c, vec3(0.92, 0.97, 0.56), smoothstep(0.30, 0.12, d));
  c = mix(c, vec3(0.80, 0.95, 0.43), smoothstep(0.78, 0.84, d));
  c = mix(c, vec3(0.97, 1.0, 0.80), smoothstep(0.90, 0.95, d) * 0.75);
  float aa = uPx * 1.5;
  float inside = smoothstep(1.0, 1.0 - aa, d);
  float ring = uInk * smoothstep(1.0 + uPx * 3.5 + aa, 1.0 + uPx * 3.5, d);
  float haze = uHaze * exp(-max(d - 1.0, 0.0) * 4.5) * smoothstep(${PAD.toFixed(1)}, ${(PAD * 0.8).toFixed(2)}, r) * uOpen;
  vec3 col = mix(vec3(0.55, 0.95, 0.3), uInkCol, ring);
  float alpha = max(haze, ring);
  gl_FragColor = vec4(mix(col, c, inside), mix(alpha, 1.0, inside));
}
`;

// ─── The junk, painted once on a canvas like a cel ──────────────────────────
// Eight drawings in a 4 × 2 sheet, each in a 256 px cell with room round it
// for the dark mode's glow. Repainted when the theme or the mode changes.
const CELL = 256;
const KINDS = ['ringed', 'moon', 'giant', 'plumbus', 'box', 'gun', 'pickle', 'rock'];
// how big each is, against the others
const SCALE = { ringed: 1.25, moon: 0.85, giant: 1, plumbus: 1, box: 0.9, gun: 1, pickle: 0.95, rock: 0.7 };

const css = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const circle = (x, y, r) => {
  const p = new Path2D();
  p.arc(x, y, r, 0, TAU);
  return p;
};
const oval = (x, y, rx, ry) => {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, 0, 0, TAU);
  return p;
};
const poly = (pts, close = true) => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
};
const rounded = (x, y, w, h, r) => {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
};

// The colours one painting uses: in the light, flat fills and thick dark ink;
// in the dark, the fills dimmed and the outlines glowing in the theme's colour.
function palette(dark, th) {
  return {
    dark,
    tint: th.tint,
    second: th.second,
    line: css(dark ? th.glow : INK),
    glow: dark ? css(th.glow, 0.8) : null,
    detail: dark ? css(th.glow, 0.6) : css(INK),
    shine: dark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.9)',
    fill: (c, a = 1) => css(dark ? mix(c, NIGHT, 0.18) : c, a),
    shade: (c) => css(dark ? mix(c, NIGHT, 0.62) : mix(c, INK, 0.28)),
  };
}

// A cartoonist's pens for one painting.
function pens(g, p) {
  return {
    // a flat colour, with a cel shade on the side away from the light (low right)
    fill(path, c, shaded = true) {
      g.save();
      g.clip(path);
      g.fillStyle = shaded ? p.shade(c) : p.fill(c);
      g.fill(path);
      if (shaded) {
        g.translate(-9, -8);
        g.fillStyle = p.fill(c);
        g.fill(path);
      }
      g.restore();
    },
    // the outline: thick ink, or a glowing line in the dark
    line(path, w = 8) {
      g.save();
      g.lineWidth = w;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = p.line;
      if (p.glow) {
        g.shadowColor = p.glow;
        g.shadowBlur = 10;
      }
      g.stroke(path);
      g.restore();
    },
    // the lines inside: folds, craters, edges
    detail(path, w = 4.5) {
      g.save();
      g.lineWidth = w;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = p.detail;
      g.stroke(path);
      g.restore();
    },
    // a curl of highlight on the lit side
    shine(x, y, r, from = 3.7, to = 4.4) {
      g.save();
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.strokeStyle = p.shine;
      g.beginPath();
      g.arc(x, y, r, from, to);
      g.stroke();
      g.restore();
    },
  };
}

const DRAW = {
  // a planet with a ring round it, the ring's back half behind it
  ringed(g, p, d) {
    const planet = circle(0, 0, 50);
    const ring = new Path2D();
    ring.ellipse(0, 0, 102, 30, 0, 0, TAU);
    ring.ellipse(0, 0, 74, 17, 0, 0, TAU);
    const half = (top) => {
      g.save();
      g.rotate(-0.38);
      g.beginPath();
      g.rect(-120, top ? -50 : 0, 240, 50);
      g.clip();
      g.fillStyle = p.fill(p.second);
      g.fill(ring, 'evenodd');
      d.line(ring, 6);
      g.restore();
    };
    half(true);
    d.fill(planet, p.tint);
    g.save();
    g.clip(planet);
    g.rotate(-0.38);
    g.fillStyle = p.fill(mix(p.tint, p.second, 0.5), 0.55);
    g.fillRect(-60, -26, 120, 11);
    g.restore();
    d.line(planet);
    d.shine(0, 0, 36);
    half(false);
  },
  // a moon, cratered
  moon(g, p, d) {
    const m = circle(0, 0, 56);
    d.fill(m, p.second);
    for (const [x, y, rx, ry] of [[-18, -12, 14, 11], [20, 16, 10, 8], [-4, 30, 7, 5], [24, -24, 6, 5]]) {
      const c = oval(x, y, rx, ry);
      g.fillStyle = p.shade(p.second);
      g.fill(c);
      d.detail(c, 4);
    }
    d.line(m);
    d.shine(0, 0, 42);
  },
  // a gas giant, banded, with a storm in it
  giant(g, p, d) {
    const R = 54;
    const b = circle(0, 0, R);
    d.fill(b, p.dark ? p.tint : mix(p.tint, WHITE, 0.3));
    g.save();
    g.clip(b);
    g.lineCap = 'round';
    for (const [y, w, c] of [[-26, 9, p.second], [-2, 13, mix(p.tint, p.second, 0.5)], [26, 8, p.second]]) {
      g.strokeStyle = p.fill(c, 0.75);
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(-R, y);
      g.bezierCurveTo(-20, y - 9, 20, y + 9, R, y);
      g.stroke();
    }
    g.restore();
    const spot = oval(18, 12, 12, 7);
    g.fillStyle = p.shade(p.second);
    g.fill(spot);
    d.detail(spot, 3.5);
    d.line(b);
    d.shine(0, 0, 40);
  },
  // a Plumbus: a pink, fleshy blob with a stalk and a knob, a grip off one side
  plumbus(g, p, d) {
    const PINK = [242, 162, 182];
    const PEACH = [246, 204, 172];
    g.translate(0, 12);
    const limb = (path) => {
      d.line(path, 24);
      g.save();
      g.lineWidth = 13;
      g.lineCap = 'round';
      g.strokeStyle = p.fill(PEACH);
      g.stroke(path);
      g.restore();
    };
    const stalk = new Path2D();
    stalk.moveTo(8, -14);
    stalk.quadraticCurveTo(34, -48, 22, -80);
    const grip = new Path2D();
    grip.moveTo(-40, 4);
    grip.quadraticCurveTo(-70, -6, -80, -34);
    limb(stalk);
    limb(grip);
    for (const [x, y, r, c] of [[22, -88, 17, PINK], [-82, -40, 11, PINK], [4, 62, 11, PEACH]]) {
      const ball = circle(x, y, r);
      d.fill(ball, c);
      d.line(ball);
    }
    const blob = new Path2D();
    blob.moveTo(-58, 10);
    blob.bezierCurveTo(-66, -34, -16, -40, 4, -22);
    blob.bezierCurveTo(30, -44, 74, -20, 62, 16);
    blob.bezierCurveTo(56, 52, 16, 64, -6, 54);
    blob.bezierCurveTo(-36, 64, -54, 44, -58, 10);
    blob.closePath();
    d.fill(blob, PINK);
    d.line(blob);
    // its folds
    const folds = new Path2D();
    folds.moveTo(-30, 20);
    folds.quadraticCurveTo(-18, 30, -6, 22);
    folds.moveTo(14, 10);
    folds.quadraticCurveTo(28, 2, 40, 12);
    folds.moveTo(-6, 40);
    folds.quadraticCurveTo(6, 46, 18, 38);
    d.detail(folds);
    d.shine(-18, -2, 24);
  },
  // a Meeseeks box: a blue cube with a big button on top
  box(g, p, d) {
    g.fillStyle = p.fill([168, 222, 246]);
    g.fill(poly([[0, -66], [66, -34], [0, -2], [-66, -34]]));
    g.fillStyle = p.fill([104, 190, 236]);
    g.fill(poly([[-66, -34], [0, -2], [0, 74], [-66, 42]]));
    g.fillStyle = p.fill([66, 148, 206]);
    g.fill(poly([[0, -2], [66, -34], [66, 42], [0, 74]]));
    d.detail(poly([[-66, -34], [0, -2], [66, -34]], false), 5);
    d.detail(poly([[0, -2], [0, 74]], false), 5);
    d.line(poly([[0, -66], [66, -34], [66, 42], [0, 74], [-66, 42], [-66, -34]]));
    // the button: a short cylinder
    const base = oval(0, -30, 24, 12);
    g.fillStyle = p.fill([150, 164, 180]);
    g.fill(base);
    d.line(base, 5);
    g.fillRect(-24, -42, 48, 12);
    d.detail(poly([[-24, -42], [-24, -30]], false), 5);
    d.detail(poly([[24, -42], [24, -30]], false), 5);
    const top = oval(0, -42, 24, 12);
    g.fillStyle = p.fill([236, 242, 248]);
    g.fill(top);
    d.line(top, 5);
  },
  // the portal gun: a grey body, a green glass tube on top, a nozzle
  gun(g, p, d) {
    g.rotate(-0.2);
    const grip = poly([[-50, 16], [-20, 16], [-12, 66], [-42, 66]]);
    d.fill(grip, [178, 186, 198]);
    d.line(grip);
    const nose = poly([[38, -16], [80, -10], [80, 14], [38, 20]]);
    d.fill(nose, [150, 160, 174]);
    d.line(nose);
    const body = rounded(-76, -24, 120, 46, 16);
    d.fill(body, [226, 230, 236]);
    d.line(body);
    // the glass tube glows green in either mode
    const tube = rounded(-56, -54, 72, 28, 14);
    g.fillStyle = css(GREEN);
    g.fill(tube);
    g.save();
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(236, 248, 170, 0.95)';
    g.beginPath();
    g.moveTo(-44, -45);
    g.lineTo(2, -45);
    g.stroke();
    g.restore();
    d.line(tube);
    const tip = oval(82, 2, 7, 14);
    g.fillStyle = p.fill([200, 208, 218]);
    g.fill(tip);
    d.line(tip, 6);
    const dial = circle(-48, 0, 9);
    g.fillStyle = css(GREEN);
    g.fill(dial);
    d.detail(dial, 4);
  },
  // a pickle with a face (you know the one)
  pickle(g, p, d) {
    const SKIN = [124, 176, 68];
    g.rotate(0.5);
    const body = oval(0, 0, 40, 88);
    d.fill(body, SKIN);
    g.fillStyle = p.shade(SKIN);
    for (const [x, y] of [[16, 34], [-18, 52], [20, -2], [-24, 14], [4, 70]]) {
      g.beginPath();
      g.arc(x, y, 4.5, 0, TAU);
      g.fill();
    }
    d.line(body);
    for (const x of [-14, 13]) {
      const eye = circle(x, -46, 11);
      g.fillStyle = p.fill([250, 250, 244]);
      g.fill(eye);
      d.detail(eye, 4);
      g.fillStyle = css(p.dark ? [16, 16, 20] : INK);
      g.beginPath();
      g.arc(x + 2, -45, 4.5, 0, TAU);
      g.fill();
    }
    const brow = new Path2D();
    brow.moveTo(-28, -62);
    brow.quadraticCurveTo(0, -72, 26, -62);
    d.detail(brow, 5);
    const grin = new Path2D();
    grin.moveTo(-20, -26);
    grin.quadraticCurveTo(0, -2, 20, -26);
    grin.quadraticCurveTo(0, -18, -20, -26);
    g.fillStyle = p.fill([250, 250, 244]);
    g.fill(grin);
    d.detail(grin, 4);
  },
  // a lumpy rock
  rock(g, p, d) {
    const R = [52, 60, 50, 58, 47, 56, 52, 61, 49];
    const rock = poly(R.map((r, i) => [Math.cos((i / R.length) * TAU) * r, Math.sin((i / R.length) * TAU) * r * 0.85]));
    const grey = mix([186, 180, 170], p.tint, 0.12);
    d.fill(rock, grey);
    for (const [x, y, rx, ry] of [[-14, -10, 11, 8], [18, 14, 8, 6]]) {
      const c = oval(x, y, rx, ry);
      g.fillStyle = p.shade(grey);
      g.fill(c);
      d.detail(c, 4);
    }
    d.line(rock);
  },
};

function paint(g, pal) {
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  const d = pens(g, pal);
  KINDS.forEach((kind, i) => {
    g.save();
    g.translate((i % 4) * CELL + CELL / 2, Math.floor(i / 4) * CELL + CELL / 2);
    DRAW[kind](g, pal, d);
    g.restore();
  });
}

export function create(canvas, ctx) {
  return ambience(canvas, ctx, (k) => {
    const { THREE } = k;
    let th = THEMES[k.theme] ?? THEMES.portal;
    let cur = k.colors;

    const sky = backdrop(k, SPACE, {
      uTint: { value: new THREE.Color() },
      uGreen: { value: new THREE.Color() },
      uAlpha: { value: 0.2 },
      uDots: { value: 0 },
    });
    const dust = field(k, { count: 170, shape: 'dot', dir: [-1, 0.15], speed: [1.5, 5], size: [1.5, 3.2], twinkle: 0.7, parallax: 0.05, glow: true });
    const stars = field(k, { count: 70, shape: 'spark', dir: [-1, 0.1], speed: [3, 9], size: [6, 14], twinkle: 0.55, parallax: 0.1, glow: true });
    const goo = bursts(k, { max: 120, shape: 'dot', size: 11 });
    let gooColors = GOO_LIGHT.map(lift);

    // the sheet of drawings, and a quad for each, cut to its cell
    const sheet = document.createElement('canvas');
    sheet.width = CELL * 4;
    sheet.height = CELL * 2;
    const g2 = sheet.getContext('2d');
    const tex = new THREE.CanvasTexture(sheet);
    sharpen(tex);
    tex.colorSpace = THREE.SRGBColorSpace;
    const quads = KINDS.map((kind, i) => {
      const geo = new THREE.PlaneGeometry(1, 1);
      const uv = geo.attributes.uv;
      const u0 = (i % 4) / 4;
      const v0 = 1 - (Math.floor(i / 4) + 1) / 2;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) / 4, v0 + uv.getY(j) / 2);
      return geo;
    });
    const nearMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const farMat = nearMat.clone();

    // the junk: the near ones big and at the sides, the far ones small and
    // faint, and two kept back to come out of the first portals (the pickle
    // only ever arrives that way)
    const NEAR = ['ringed', 'plumbus', 'box', 'gun', 'moon', 'giant', 'ringed'];
    const FAR = ['rock', 'moon', 'rock', 'giant', 'box'];
    const junk = [];
    const add = (kind, far, kept = false) => {
      const mesh = new THREE.Mesh(quads[KINDS.indexOf(kind)], far ? farMat : nearMat);
      mesh.renderOrder = far ? 1 : 3;
      mesh.visible = !kept;
      k.scene.add(mesh);
      const up = Math.random() < 0.5 ? 1 : -1;
      const d = {
        mesh,
        kind,
        far,
        base: (far ? rand(44, 60) : rand(84, 116)) * SCALE[kind],
        size: 1,
        x: 0,
        y: 0,
        dvx: rand(-5, 5),
        dvy: up * (far ? rand(5, 10) : rand(9, 18)),
        dspin: rand(-0.25, 0.25),
        rot: rand(0, TAU),
        shrink: 1,
        // seconds until it comes back (Infinity: only through a portal)
        gone: kept ? Infinity : 0,
        busy: null,
      };
      d.vx = d.dvx;
      d.vy = d.dvy;
      d.spin = d.dspin;
      junk.push(d);
      return d;
    };
    NEAR.slice(0, Math.max(3, Math.round(NEAR.length * k.density))).forEach((kind) => add(kind, false));
    FAR.slice(0, Math.max(2, Math.round(FAR.length * k.density))).forEach((kind) => add(kind, true));
    add('box', false, true);
    add('pickle', false, true);

    // somewhere in the bands at the sides, away from the text
    const band = (w) => (Math.random() < 0.5 ? -1 : 1) * w * rand(0.26, 0.46);
    const fit = (w) => Math.min(1, Math.max(0.6, w / 1200));
    let placed = false;
    let lastW = 1;
    let lastH = 1;
    const place = () => {
      const { w, h } = k.size;
      lastW = w;
      lastH = h;
      const near = junk.filter((d) => !d.far);
      junk.forEach((d) => {
        d.size = d.base * fit(w);
      });
      near.forEach((d, i) => {
        d.x = (i % 2 ? 1 : -1) * w * rand(0.27, 0.45);
        d.y = ((i + rand(0.15, 0.85)) / near.length - 0.5) * h;
      });
      junk.filter((d) => d.far).forEach((d) => {
        d.x = rand(-0.48, 0.48) * w;
        d.y = rand(-0.5, 0.5) * h;
      });
      placed = true;
    };

    // ─── portals ──────────────────────────────────────────────────────────
    const quad = new THREE.PlaneGeometry(2, 2);
    const portalMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: PORTAL,
      uniforms: {
        uTime: { value: 0 },
        uOpen: { value: 1 },
        uSeed: { value: 0 },
        uPx: { value: 0.01 },
        uInk: { value: 1 },
        uInkCol: { value: new THREE.Color() },
        uHaze: { value: 0.2 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const portal = () => {
      const mesh = new THREE.Mesh(quad, portalMat.clone());
      mesh.renderOrder = 2;
      mesh.visible = false;
      k.scene.add(mesh);
      return { mesh, u: mesh.material.uniforms, seed: rand(0, 10) };
    };
    // a portal `r` px tall (a little narrower across), `open` 0..1
    const show = (p, x, y, r, open, t) => {
      const s = Math.max(0.001, open);
      p.mesh.visible = open > 0.01;
      p.mesh.position.set(x, y, 0);
      p.mesh.scale.set(r * PAD * 0.86 * s, r * PAD * s, 1);
      p.u.uTime.value = t + p.seed;
      p.u.uOpen.value = Math.min(1, open);
      p.u.uSeed.value = p.seed;
      // (a nearly shut portal would be all edge: its edges stop growing)
      p.u.uPx.value = Math.min(0.08, 1 / (r * s));
    };
    const big = portal();
    const hole = { ...portal(), open: 0, v: 0, x: 0, y: 0, ax: 0, ay: 0, still: 0, want: 0 };
    const minis = Array.from({ length: 3 }, () => ({ ...portal(), t: 1, x: 0, y: 0 }));
    let nextMini = 0;
    const portals = [big, hole, ...minis];
    const HOLE_R = 44;
    const MINI_R = 32;

    const splash = (x, y, count, speed = [70, 240], size = 12) => !k.reduced && goo.emit(x, y, { count, colors: gooColors, speed, gravity: -380, life: [0.5, 1.1], size });
    const swallow = (d, x, y) => {
      d.busy = null;
      d.mesh.visible = false;
      d.mesh.renderOrder = d.far ? 1 : 3;
      d.gone = rand(6, 10);
      splash(x, y, 8, [40, 160]);
    };

    // ─── the big one: opens near an edge, something comes or goes, it shuts
    const OPEN = 0.7;
    const HOLD = 3.1;
    const SHUT = 0.55;
    const POP_AT = 0.55;
    const POP = 1.6;
    const SUCK_AT = 0.25;
    const SUCK = 2.5;
    const ev = { on: false, t: 0, wait: rand(2.5, 4), x: 0, y: 0, r: 100, mode: 'pop', who: null, dx: 0, dy: 0, rad: 0, ang: 0, rot: 0 };
    let popNext = true;
    const start = (at) => {
      const { w, h } = k.size;
      const side = Math.random() < 0.5 ? -1 : 1;
      ev.r = Math.min(96, Math.max(56, Math.min(w, h) * 0.12));
      // at a side (sometimes half off it), or up in a corner, or down in one
      if (at) [ev.x, ev.y] = at;
      else if (Math.random() < 0.7) {
        ev.x = side * w * rand(0.38, 0.47);
        ev.y = h * rand(-0.32, 0.32);
      } else {
        ev.x = side * w * rand(0.28, 0.44);
        ev.y = (Math.random() < 0.5 ? -1 : 1) * h * rand(0.34, 0.42);
      }
      ev.t = 0;
      ev.on = true;
      ev.who = null;
      // out, in, out, in, but only in when there's something to take
      ev.mode = popNext || !junk.some((d) => !d.gone && !d.busy) ? 'pop' : 'suck';
      popNext = ev.mode !== 'pop';
      big.seed = rand(0, 10);
      splash(ev.x, ev.y, 16);
    };
    // what comes out: something swallowed earlier if there is one
    const choosePop = () => {
      const gone = junk.filter((d) => d.gone && !d.busy);
      const free = junk.filter((d) => !d.busy);
      const d = gone.length ? gone[k.reduced ? 0 : (Math.random() * gone.length) | 0] : free[(Math.random() * free.length) | 0];
      if (!d) return null;
      d.gone = 0;
      d.busy = 'pop';
      d.mesh.visible = true;
      d.mesh.renderOrder = 4;
      // out toward the page and away from the nearer edge
      const dx = -Math.sign(ev.x || 1) * rand(0.3, 0.8);
      const dy = -Math.sign(ev.y || 1) * rand(0.3, 0.9);
      const len = Math.hypot(dx, dy);
      ev.dx = dx / len;
      ev.dy = dy / len;
      ev.rot = rand(0, TAU);
      splash(ev.x, ev.y, 10);
      return d;
    };
    // what goes in: the nearest thing drifting by
    const chooseSuck = () => {
      let best = null;
      let bestD = Infinity;
      for (const d of junk) {
        if (d.gone || d.busy) continue;
        const dist = Math.hypot(d.x - ev.x, d.y - ev.y);
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      }
      if (!best) return null;
      best.busy = 'suck';
      best.mesh.renderOrder = 4;
      ev.rad = Math.max(bestD, 1);
      ev.ang = Math.atan2(best.y - ev.y, best.x - ev.x);
      return best;
    };
    // the one being carried, worked out from the time (so a still frame can show it)
    const carry = (d, dt) => {
      if (d.busy === 'pop') {
        const u = ev.t - POP_AT;
        const f = 1 - Math.pow(1 - clamp01(u / POP), 3);
        const reach = ev.r + 190;
        d.x = ev.x + ev.dx * f * reach;
        d.y = ev.y + ev.dy * f * reach;
        d.shrink = backOut(u / 0.5);
        d.rot = ev.rot + u * 4 * (1 - f * 0.6);
        if (u >= POP) {
          // free again, still drifting the way it came out
          d.busy = null;
          d.mesh.renderOrder = d.far ? 1 : 3;
          d.vx = ev.dx * 30;
          d.vy = ev.dy * 30;
          d.spin = 1.2;
        }
      } else {
        const u = ev.t - SUCK_AT;
        const f = clamp01(u / SUCK);
        const e = smooth(f);
        const rad = ev.rad * (1 - e);
        const ang = ev.ang + u * 1.2 + e * e * 5;
        d.x = ev.x + Math.cos(ang) * rad * 0.86;
        d.y = ev.y + Math.sin(ang) * rad;
        d.shrink = Math.min(1, rad / Math.min(ev.rad, ev.r * 1.4));
        d.rot += dt * (1.5 + e * 7);
        if (f >= 1) swallow(d, ev.x, ev.y);
      }
    };
    const runEvent = (dt, t) => {
      ev.t += dt;
      const end = OPEN + HOLD + SHUT;
      const o = ev.t < OPEN ? backOut(ev.t / OPEN) : ev.t < OPEN + HOLD ? 1 : 1 - smooth((ev.t - OPEN - HOLD) / SHUT);
      show(big, ev.x, ev.y, ev.r * (1 + 0.02 * Math.sin(t * 3)), o, t);
      if (!ev.who && ev.mode === 'pop' && ev.t >= POP_AT) ev.who = choosePop() ?? false;
      if (!ev.who && ev.mode === 'suck' && ev.t >= SUCK_AT) ev.who = chooseSuck() ?? false;
      if (ev.who?.busy) carry(ev.who, dt);
      if (ev.t >= OPEN + HOLD && ev.t - dt < OPEN + HOLD) splash(ev.x, ev.y, 10);
      if (ev.t >= end) {
        ev.on = false;
        big.mesh.visible = false;
        ev.wait = rand(7, 9.5);
        // anything still on its way finishes now
        if (ev.who?.busy === 'suck') swallow(ev.who, ev.x, ev.y);
        else if (ev.who?.busy === 'pop') {
          ev.who.busy = null;
          ev.who.mesh.renderOrder = ev.who.far ? 1 : 3;
        }
      }
    };

    // ─── the junk drifting, pulled, wrapping round ─────────────────────────
    let lastScroll = k.scroll.y;
    const drift = (d, dt, ds) => {
      const { w, h } = k.size;
      if (d.gone) {
        d.gone -= dt;
        if (d.gone > 0) return;
        // back in from the top or the bottom, the way it drifts
        d.gone = 0;
        d.x = band(w);
        d.y = (d.dvy > 0 ? -1 : 1) * (h / 2 + d.size * 0.6);
        d.vx = d.dvx;
        d.vy = d.dvy;
        d.shrink = 1;
        d.mesh.visible = true;
      }
      // back to its own slow drift after a push or a pull
      const e = 1 - Math.exp(-dt * 0.7);
      d.vx += (d.dvx - d.vx) * e;
      d.vy += (d.dvy - d.vy) * e;
      d.spin += (d.dspin - d.spin) * e;
      let shrink = 1;
      // the pointer's portal pulls things in and round
      if (hole.open > 0.05) {
        const dx = hole.x - d.x;
        const dy = hole.y - d.y;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = 320;
        if (dist < reach) {
          const f = hole.open * Math.pow(1 - dist / reach, 1.5);
          const nx = dx / dist;
          const ny = dy / dist;
          d.vx += (nx * 340 - ny * 260) * f * dt;
          d.vy += (ny * 340 + nx * 260) * f * dt;
          d.spin += 3 * f * dt;
          shrink = 1 - Math.min(1, hole.open) * (1 - smooth((dist - 16) / 100));
          if (dist < 22 && hole.open > 0.7) {
            swallow(d, hole.x, hole.y);
            return;
          }
        }
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt + ds * (d.far ? 0.04 : 0.1);
      d.rot += d.spin * dt;
      d.shrink += (shrink - d.shrink) * Math.min(1, dt * 10);
      const mx = w / 2 + d.size * 0.6;
      const my = h / 2 + d.size * 0.6;
      if (d.y > my || d.y < -my) {
        d.y = d.y > my ? -my + 1 : my - 1;
        d.x = d.far ? rand(-0.48, 0.48) * w : band(w);
      }
      if (d.x > mx) d.x -= mx * 2;
      else if (d.x < -mx) d.x += mx * 2;
    };

    const apply = () => {
      const dark = cur.dark;
      const tint = dark ? th.glow : th.tint;
      raw(tint, sky.uniforms.uTint.value);
      raw(GREEN, sky.uniforms.uGreen.value);
      sky.uniforms.uAlpha.value = dark ? 0.24 : 0.2;
      sky.uniforms.uDots.value = dark ? 0 : 1;
      if (dark) {
        dust.colors(lift([225, 235, 255]), lift(mix([225, 235, 255], tint, 0.5)));
        stars.colors(lift(GREEN), lift(mix(tint, WHITE, 0.2)));
      } else {
        dust.colors(lift(mix(INK, cur.bg, 0.55)), lift(mix(th.tint, INK, 0.35)));
        stars.colors(lift(mix(INK, cur.bg, 0.12)), lift(mix(th.tint, INK, 0.15)));
      }
      dust.glow(dark);
      stars.glow(dark);
      goo.glow(dark);
      gooColors = [...(dark ? GOO_DARK : GOO_LIGHT), tint].map(lift);
      paint(g2, palette(dark, th));
      tex.needsUpdate = true;
      nearMat.opacity = dark ? 0.92 : 0.95;
      farMat.opacity = dark ? 0.5 : 0.55;
      for (const p of portals) {
        p.u.uInk.value = dark ? 0 : 1;
        raw(INK, p.u.uInkCol.value);
        p.u.uHaze.value = dark ? 0.75 : 0.22;
      }
    };

    return {
      step(dt, t) {
        sky.step(t);
        dust.step(t);
        stars.step(t);
        goo.step(dt);
        if (!placed) place();
        const ds = k.scroll.y - lastScroll;
        lastScroll = k.scroll.y;

        // rest the pointer for a second and a portal opens under it; move it
        // and the portal snaps shut
        const px = k.pointer.tx ?? k.pointer.x;
        const py = k.pointer.ty ?? k.pointer.y;
        if (Math.hypot(px - hole.ax, py - hole.ay) > 6) {
          hole.ax = px;
          hole.ay = py;
          hole.still = 0;
        } else hole.still += dt;
        const want = hole.still > 1 && k.pointer.near > 0.6 ? 1 : 0;
        if (want && hole.open < 0.05) {
          hole.x = hole.ax;
          hole.y = hole.ay;
        }
        if (want && !hole.want) splash(hole.x, hole.y, 8, [40, 160]);
        hole.want = want;
        // a spring, so it pops open past its size and settles
        hole.v += ((want - hole.open) * 70 - hole.v * (want ? 8 : 14)) * Math.min(dt, 1 / 20);
        hole.open = Math.max(0, hole.open + hole.v * Math.min(dt, 1 / 20));
        if (!want && hole.open < 0.01) hole.open = hole.v = 0;
        show(hole, hole.x, hole.y, HOLE_R * (1 + 0.04 * Math.sin(t * 3.2)), hole.open, t);

        if (ev.on) runEvent(dt, t);
        else {
          ev.wait -= dt;
          if (ev.wait <= 0 && dt > 0) start();
        }

        // the clicks' little portals: pop, a moment, gone
        for (const m of minis) {
          if (!m.mesh.visible && m.t >= 1) continue;
          m.t += dt;
          if (m.t >= 1) {
            m.mesh.visible = false;
            continue;
          }
          const o = m.t < 0.22 ? backOut(m.t / 0.22) : m.t < 0.65 ? 1 : 1 - smooth((m.t - 0.65) / 0.35);
          show(m, m.x, m.y, MINI_R, o, t);
        }

        for (const d of junk) {
          if (!d.busy) drift(d, dt, ds);
          if (d.gone) continue;
          d.mesh.position.set(d.x, d.y, 0);
          d.mesh.rotation.z = d.rot;
          d.mesh.scale.setScalar(Math.max(0.001, d.size * d.shrink));
        }

        // reduced motion: one still frame, a portal open at the left edge
        // with a Meeseeks box tumbling up out of it
        if (k.reduced && !ev.on) {
          popNext = true;
          start([-k.size.w * 0.45, k.size.h * 0.05]);
          ev.t = POP_AT + 0.01;
          runEvent(0, t);
          ev.dx = 0.15;
          ev.dy = 0.99;
          ev.t = POP_AT + 0.5;
          runEvent(0, t);
          for (const d of junk) {
            if (d.gone) continue;
            d.mesh.position.set(d.x, d.y, 0);
            d.mesh.rotation.z = d.rot;
            d.mesh.scale.setScalar(Math.max(0.001, d.size * d.shrink));
          }
        }
      },
      recolor(c) {
        cur = c;
        apply();
      },
      retheme(theme) {
        th = THEMES[theme] ?? THEMES.portal;
        apply();
      },
      resize(w, h) {
        // the junk keeps its place on the screen, in proportion
        if (!placed) return;
        for (const d of junk) {
          d.x *= w / lastW;
          d.y *= h / lastH;
          d.size = d.base * fit(w);
        }
        lastW = w;
        lastH = h;
      },
      burst(x, y) {
        const m = minis[nextMini];
        nextMini = (nextMini + 1) % minis.length;
        m.t = 0;
        m.x = x;
        m.y = y;
        m.seed = rand(0, 10);
        show(m, x, y, MINI_R, 0.02, 0);
        splash(x, y, 24, [90, 300], 15);
        // and nudges the junk nearby away
        for (const d of junk) {
          if (d.busy || d.gone) continue;
          const dx = d.x - x;
          const dy = d.y - y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist > 220) continue;
          const f = 1 - dist / 220;
          d.vx += (dx / dist) * 160 * f;
          d.vy += (dy / dist) * 160 * f;
          d.spin += rand(-2, 2) * f;
        }
      },
      dispose() {
        for (const geo of quads) geo.dispose();
        portalMat.dispose();
        tex.dispose();
      },
    };
  });
}
