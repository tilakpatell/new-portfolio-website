// The portal, as the show draws it: an opaque green swirl you can't see
// through. A lumpy oval of goo with a bright lime lip, mid-green streaks
// sheared into a spiral that winds down to a deep green eye, flecks of light
// drifting in, and a soft green haze round the outside. One GLSL function,
// `portal()`, shared by the raw WebGL canvases on the site (the hero, the
// card, the theme change) and by Portal panic's Three.js material.
//
// portal(o, t, open, seed): o is the point in portal space (the rim sits
// near length 1), t seconds, open 0…1 (it grows from a point, winding
// faster as it opens), seed varies the goo. Returns premultiplied colour and
// alpha.

export const SWIRL_GLSL = `
float sw_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sw_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sw_hash(i), sw_hash(i + vec2(1.0, 0.0)), f.x), mix(sw_hash(i + vec2(0.0, 1.0)), sw_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sw_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * sw_noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return s;
}
vec2 sw_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
vec4 portal(vec2 o, float t, float open, float seed) {
  float e = max(open, 0.001);
  vec2 q = o / e;
  float r = length(q);
  float a = atan(q.y, q.x);
  // the goo's edge: slow lumps that wander round the rim, a faster ripple on them
  vec2 ring = vec2(cos(a), sin(a));
  float lump = (sw_fbm(ring * 1.3 + vec2(seed * 3.1, t * 0.28)) - 0.5) * 0.15 + 0.014 * sin(a * 13.0 + t * 2.6);
  float edge = 1.0 + lump;
  float d = r / edge; // 0 at the eye, 1 at the lip
  // the swirl: everything turns, the middle faster, so blobs of noise shear
  // into streaks that spiral down; opening winds it up harder
  float spin = t * 0.85 + (1.0 - e) * 5.0;
  float twist = 4.2 * (1.0 - d) * (1.0 - d) + 1.1 * (1.0 - d);
  vec2 w = sw_rot(q, twist + spin);
  float n1 = sw_fbm(w * 2.3 + seed);
  float n2 = sw_fbm(sw_rot(q, twist * 1.35 + spin * 1.3) * 3.4 - seed);
  float s = n1 * 0.7 + n2 * 0.3;
  // the show's greens: a lime body, darker arms, a pale yellow-green lip, and
  // light coming up through the middle
  vec3 arm = vec3(0.11, 0.42, 0.07);
  vec3 body = vec3(0.42, 0.78, 0.16);
  vec3 lime = vec3(0.64, 0.92, 0.24);
  vec3 lip = vec3(0.86, 1.0, 0.46);
  vec3 core = vec3(0.90, 0.95, 0.36);
  vec3 c = mix(body, lime, smoothstep(0.55, 0.95, d) * 0.6);
  // dark arms and light arms wound into the spiral, in a few flat tones like a cel
  c = mix(arm, c, smoothstep(0.40, 0.48, s));
  c = mix(c, lime * 1.06, smoothstep(0.60, 0.67, s) * 0.8);
  // the glow at the eye
  c = mix(c, core, smoothstep(0.42, 0.0, d) * (0.55 + 0.45 * smoothstep(0.35, 0.6, s)));
  // a brushed highlight that rides round with the swirl
  c += vec3(0.10, 0.16, 0.05) * smoothstep(0.55, 1.0, sin(atan(w.y, w.x) * 2.0 + d * 6.0) * 0.5 + 0.5) * d;
  // the lip: a bright band just inside the edge, brightest at the very rim
  c = mix(c, lip, smoothstep(0.80, 0.95, d));
  c = mix(c, vec3(0.96, 1.0, 0.78), smoothstep(0.955, 0.995, d) * 0.8);
  // flecks of light, drifting inward with the swirl
  vec2 g = sw_rot(q, twist * 0.7 + spin * 0.6) * 11.0;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5 - (vec2(sw_hash(id + 3.1), sw_hash(id + 7.7)) - 0.5) * 0.6;
  float fleck = smoothstep(0.17, 0.07, length(f)) * step(0.64, sw_hash(id + seed)) * smoothstep(0.5, 0.93, d);
  c = mix(c, vec3(0.97, 1.0, 0.88), fleck);
  // solid inside, a short soft edge, then a green haze outside
  float inside = smoothstep(1.02, 0.985, d);
  float haze = exp(-max(d - 1.0, 0.0) * 7.0) * 0.55 * (1.0 - inside) * smoothstep(0.0, 0.3, open) * smoothstep(1.32, 1.04, d * e);
  vec3 glow = vec3(0.45, 0.95, 0.25);
  return vec4(c * inside + glow * haze, max(inside, haze));
}
`;

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `
precision highp float;
uniform vec2 res;
uniform vec2 size; // the oval's half width and half height, as shares of the canvas height
uniform float t, open, seed;
${SWIRL_GLSL}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  gl_FragColor = portal(uv / size, t, open, seed);
}`;

// One WebGL context for every portal on the page. Making a context (and
// linking the swirl's shader in it) waits on the GPU, and the page has a
// portal in the hero, one in each crack the cruiser flies through (they come
// and go as you scroll) and one in the theme change: a context each was a
// stall each, and another letting each one go. So the swirl is drawn in one
// hidden canvas and copied onto each portal's own plain 2D canvas. The
// context outlives its last portal by KEEP, for the next crack along.
const KEEP = 10000; // ms
let shared = null;
let users = 0;
let letGo = 0;

function sharedGL() {
  if (shared?.state === 'broken') return null;
  if (shared && !shared.gl.isContextLost()) return shared;
  shared = null;
  const canvas = document.createElement('canvas');
  let gl = null;
  try {
    // a full-screen triangle has no edges to smooth: no multisampling
    gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  // the link goes on in the background where the GPU can (asked after on each
  // draw, without waiting); elsewhere the first draw waits for it, as before
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  shared = { canvas, gl, prog, parallel, state: 'linking', u: null };
  return shared;
}

// whether the shared program can draw yet (set up the first time it can)
function linked(sw) {
  if (sw.state !== 'linking') return sw.state === 'ok';
  const { gl, prog } = sw;
  if (sw.parallel && !gl.getProgramParameter(prog, sw.parallel.COMPLETION_STATUS_KHR)) return false;
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    sw.state = 'broken';
    return false;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  sw.u = Object.fromEntries(['res', 'size', 't', 'open', 'seed'].map((k) => [k, gl.getUniformLocation(prog, k)]));
  sw.state = 'ok';
  return true;
}

const hold = () => {
  users += 1;
  clearTimeout(letGo);
};
const release = () => {
  users = Math.max(0, users - 1);
  if (users) return;
  clearTimeout(letGo);
  letGo = setTimeout(() => {
    if (users || !shared) return;
    const { gl } = shared;
    shared = null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }, KEEP);
};

// A portal on a plain canvas (no Three.js): draw(t, open) paints one frame.
// Returns null where WebGL isn't there, so the caller can show its CSS one;
// `onFail` hears if the shader turns out not to link after all.
export function createSwirl(canvas, { size = [0.34, 0.45], seed = 0, onFail } = {}) {
  if (!sharedGL()) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  hold();
  let gone = false;
  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  const draw = (t, open = 1) => {
    if (gone) return;
    const sw = sharedGL(); // a fresh one, should the last have been lost
    if (!sw || !linked(sw)) {
      if (!sw || sw.state === 'broken') onFail?.();
      return;
    }
    fit();
    const { gl, u, canvas: src } = sw;
    const w = canvas.width;
    const h = canvas.height;
    // the hidden canvas grows to the biggest portal; each is drawn in its corner
    if (src.width < w || src.height < h) {
      src.width = Math.max(src.width, w);
      src.height = Math.max(src.height, h);
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.size, size[0], size[1]);
    gl.uniform1f(u.t, t);
    gl.uniform1f(u.open, open);
    gl.uniform1f(u.seed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // and copied over this one's last frame (WebGL's corner is the bottom left)
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(src, 0, src.height - h, w, h, 0, 0, w, h);
  };
  const dispose = () => {
    if (gone) return;
    gone = true;
    release();
  };
  return { draw, dispose };
}

// Run a portal on a canvas until stop(): only while it's on screen and the
// tab is showing, one still frame for reduced motion. `open()` gives the
// opening (0…1) for a frame, so a caller can snap it shut and swirl it open.
export function runSwirl(canvas, { size, seed, open = () => 1, calm = false, onFail } = {}) {
  const s = createSwirl(canvas, { size, seed, onFail });
  if (!s) return null;
  let raf = 0;
  let visible = true;
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
  io?.observe(canvas);
  const t0 = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const k = open(now);
    s.draw(calm ? 3 : (now - t0) / 1000, k);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      io?.disconnect();
      s.dispose();
    },
  };
}
