// "A day at Akshardham" in WebGL: the photo on screen, cover-cropped and
// drifting exactly like the <img> it sits over (so it can take over without
// a pop), and the cut between two photos done with light instead of
// opacity. The photos are from different viewpoints, so nothing lines up
// pixel to pixel; what carries the time of day is colour:
//   1. the photo on screen is graded toward the next one's light (its mean
//      colour and contrast, in linear light), as if the sun moved first;
//   2. then each pixel switches at a moment set by the next photo's own
//      brightness: going toward night, the dark sky and water settle first
//      and the lit stone and lamps arrive last, so the mandir lights up
//      (going back toward day, the bright parts come first);
//   3. the switching edge is an 8×8 ordered dither, so it reads as printed,
//      not as a soft blur.
// Dragging the time track shows the same cut at any fraction, a time-lapse
// under the finger. Ringing the bell sends one soft ring through the photo.
// Reduced motion: no drift, plain cuts, no ring.

import * as THREE from 'three';
import { clamp01, createRenderer } from '../../../lib/three/renderer';
import { CUT_MS, minutesOf, settleEase, settleMs } from './day';
import { lerpStats, measure, toneBetween } from './light';

const DRIFT_MS = 14000; // the CSS drift in extras.css: scale 1.08 → 1 over 14 s
const DRIFT = 0.08;
const GRADE_END = 0.42; // share of a cut spent grading toward the next light
const DISSOLVE_FROM = 0.34; // where the dissolve starts (a little overlap reads as one motion)
const BAND = 0.2; // width of the dithered edge, as a share of the photo's area
const CELL = 1; // CSS px per dither cell
const RING_MS = 1600;
const RING_AMP = 0.022; // how far the ring pushes the photo, as a share of its height (a few px at its peak)

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA;    // the photo on screen (or a frame frozen mid-cut)
uniform sampler2D tB;    // the photo arriving
uniform sampler2D tCdf;  // B's brightness → share of B that is darker
uniform vec4 uMapA;      // cover crop: photo uv = box * xy + zw
uniform vec4 uMapB;
uniform vec2 uZoom;      // each photo's drift
uniform float uSnap;     // A is a frozen frame, already in screen space
uniform float uGrade;    // 0..1: how far A is graded toward B's light
uniform vec3 uTone;      // exposure shift, A's middle brightness, contrast (logs)
uniform vec3 uTint;      // white balance toward B (log gain per channel)
uniform float uBlend;    // whether any of B shows yet
uniform float uFront;    // the dissolve, in shares of B's area
uniform float uDir;      // 1: toward night (dark first), -1: toward day
uniform float uBand;
uniform vec3 uRing;      // the bell: radius, strength, width (in heights)
uniform float uAspect;
uniform float uCell;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float EPS = 0.01;

// ordered (Bayer) thresholds, 2×2 → 4×4 → 8×8, in steps of 1/64. The cell
// is wrapped to its 8×8 tile first: the formula squares the coordinate, and
// at the top of a tall canvas that loses precision on some GPUs.
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 p) { vec2 a = mod(floor(p), 8.0); return bayer4(0.5 * a) * 0.25 + bayer2(a); }

vec2 photoUv(vec2 box, float zoom, vec4 map) {
  return (0.5 + (box - 0.5) / zoom) * map.xy + map.zw;
}

// exposure and contrast on brightness, then the tint, all as gains on linear
// light, so colours keep their relationships as the light changes
vec3 grade(vec3 c) {
  float ly = log(dot(c, LUMA) + EPS);
  float to = ly + uTone.x + (ly - uTone.y) * (uTone.z - 1.0);
  return max((c + EPS) * exp(uTint + (to - ly)) - EPS, 0.0);
}

void main() {
  vec2 box = vec2(vUv.x, 1.0 - vUv.y); // top-down, like CSS
  if (uRing.y > 0.0) {
    // one ring travelling out from the centre: a push just outside its
    // radius and a pull just inside
    vec2 d = (box - 0.5) * vec2(uAspect, 1.0);
    float r = length(d);
    float x = (r - uRing.x) / uRing.z;
    box -= d / max(r, 1e-4) * (uRing.y * x * exp(-x * x)) / vec2(uAspect, 1.0);
  }
  vec3 c = uSnap > 0.5 ? texture2D(tA, vec2(box.x, 1.0 - box.y)).rgb : texture2D(tA, photoUv(box, uZoom.x, uMapA)).rgb;
  if (uGrade > 0.0) c = mix(c, grade(c), uGrade);
  if (uBlend > 0.0) {
    vec2 uv = photoUv(box, uZoom.y, uMapB);
    vec3 b = texture2D(tB, uv).rgb;
    // brightness mostly from a soft B (four taps on a small mip), so areas
    // switch together, with enough of the sharp one that small lamps still
    // arrive late
    vec2 o = 0.006 * uMapB.xy;
    float soft = dot(texture2D(tB, uv + vec2(o.x, o.y), 2.0).rgb + texture2D(tB, uv + vec2(-o.x, o.y), 2.0).rgb
      + texture2D(tB, uv + vec2(o.x, -o.y), 2.0).rgb + texture2D(tB, uv - o, 2.0).rgb, LUMA) * 0.25;
    float y = mix(soft, dot(b, LUMA), 0.35);
    float rank = texture2D(tCdf, vec2(pow(clamp(y, 0.0, 1.0), 1.0 / 2.2) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).r;
    if (uDir < 0.0) rank = 1.0 - rank;
    float k = clamp((uFront - rank) / uBand + 0.5, 0.0, 1.0);
    c = mix(c, b, step(bayer8(gl_FragCoord.xy / uCell) + 0.5 / 64.0, k));
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

// CSS's ease-out, cubic-bezier(0, 0, 0.58, 1), so the drift matches the
// <img>'s animation frame for frame
const bez = (t, p1, p2) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
function cssEaseOut(x) {
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 24; i++) {
    const v = bez(t, 0, 0.58);
    if (Math.abs(v - x) < 1e-5) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return bez(t, 0, 1);
}
const zoomAt = (elapsed) => 1 + DRIFT * (1 - cssEaseOut(clamp01(elapsed / DRIFT_MS)));

// '50% 18%' → [0.5, 0.18]
function parsePos(pos) {
  const [x = '50%', y = '50%'] = String(pos ?? '').trim().split(/\s+/);
  const f = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n / 100 : 0.5;
  };
  return [f(x), f(y)];
}

// object-fit: cover with object-position, as a scale and offset in the
// photo's own uv (ratio is its height over its width)
function cover(w, h, ratio, pos, out) {
  const k = Math.max(w, h / ratio);
  const sx = w / k;
  const sy = h / (k * ratio);
  return out.set(sx, sy, (1 - sx) * pos[0], (1 - sy) * pos[1]);
}

// decoded off the main thread where the browser can, so nothing stutters
async function decode(url) {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return createImageBitmap(await res.blob());
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

// the light in a photo, from a copy 96 px wide
function sample(src) {
  const w = 96;
  const h = Math.max(1, Math.round((w * src.height) / src.width));
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, h);
  return measure(g.getImageData(0, 0, w, h).data);
}

function cdfTexture(cdf) {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) data[i * 4] = cdf[i];
  const t = new THREE.DataTexture(data, 256, 1);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function look(p, eased) {
  const g = clamp01(p / GRADE_END);
  const q = clamp01((p - DISSOLVE_FROM) / (1 - DISSOLVE_FROM));
  // a cut eases out exponentially: most of the photo turns over quickly and
  // the brightest (or darkest) last few lights take their time; dragging
  // the track is linear, so the finger stays in charge
  const e = eased ? (1 - 2 ** (-5 * q)) / (1 - 2 ** -5) : q;
  return { grade: eased ? g * g * (3 - 2 * g) : g, front: -BAND / 2 + (1 + BAND) * e };
}

export function create(canvas, ctx) {
  const gl = createRenderer(canvas, { antialias: false, ratio: 2, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  // A photo costs one quad to draw, and it replaces an <img> the browser
  // draws at full sharpness, so it doesn't take the lower phone start that
  // heavier scenes do (the slow-frame watchdog still steps it down)
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (dpr > renderer.getPixelRatio()) renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geo = new THREE.BufferGeometry();
  // one triangle that covers the screen
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const uniforms = {
    tA: { value: null },
    tB: { value: null },
    tCdf: { value: null },
    uMapA: { value: new THREE.Vector4(1, 1, 0, 0) },
    uMapB: { value: new THREE.Vector4(1, 1, 0, 0) },
    uZoom: { value: new THREE.Vector2(1, 1) },
    uSnap: { value: 0 },
    uGrade: { value: 0 },
    uTone: { value: new THREE.Vector3(0, 0, 1) },
    uTint: { value: new THREE.Vector3() },
    uBlend: { value: 0 },
    uFront: { value: 0 },
    uDir: { value: 1 },
    uBand: { value: BAND },
    uRing: { value: new THREE.Vector3(0, 0, 0.05) },
    uAspect: { value: 16 / 9 },
    uCell: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  scene.add(quad);

  const box = ctx.el.getBoundingClientRect();
  const size = { w: Math.max(1, box.width), h: Math.max(1, box.height) };

  let props = { place: ctx.place, photos: ctx.photos ?? [], index: ctx.index ?? 0, scrub: ctx.scrub ?? null, rang: ctx.rang ?? 0 };
  const meta = new Map(); // id → { pos, ratio, widths }
  const learn = (photos) => {
    for (const ph of photos) if (ph.widths?.length) meta.set(ph.id, { pos: parsePos(ph.pos), ratio: ph.ratio, widths: ph.widths });
  };
  learn(props.photos);

  // ─── photos, as textures ───
  // id → { state: 'loading' | 'ready' | 'failed', width, tex, cdf, stats }
  const store = new Map();
  const flying = new Set(); // being fetched (a sharper copy can be, while the old one shows)
  let queue = [];
  let dead = false;
  let broken = null;

  // the srcset width that covers the stage at this sharpness
  const fit = (id) => {
    const m = meta.get(id);
    const need = Math.max(size.w, size.h / m.ratio) * renderer.getPixelRatio();
    return m.widths.find((w) => w >= need) ?? m.widths[m.widths.length - 1];
  };
  const isReady = (id) => store.get(id)?.state === 'ready';

  function want(id, first = false) {
    if (!id || !meta.has(id) || flying.has(id)) return;
    const e = store.get(id);
    if (e?.state === 'loading' || e?.state === 'failed') return;
    if (e?.state === 'ready' && e.width >= fit(id)) return;
    queue = queue.filter((q) => q !== id);
    if (first) queue.unshift(id);
    else queue.push(id);
    pump();
  }
  // the photo wanted now first, then its neighbours, then the rest of the day
  function wantAround(id) {
    const list = props.photos;
    const k = list.findIndex((ph) => ph.id === id);
    want(id, true);
    if (k < 0) return;
    for (let d = 1; d < list.length; d++) {
      if (list[k + d]) want(list[k + d].id);
      if (list[k - d]) want(list[k - d].id);
    }
  }
  function pump() {
    while (flying.size < 2 && queue.length) {
      const id = queue.shift();
      flying.add(id);
      fetchPhoto(id).finally(() => {
        flying.delete(id);
        if (!dead) pump();
      });
    }
  }
  // on screen, on its way, or part of the temple being shown
  const wanted = (id) => id === a?.id || id === b?.id || id === pending || props.photos.some((ph) => ph.id === id);
  async function fetchPhoto(id) {
    const width = fit(id);
    const prev = store.get(id);
    // a sharper copy replaces a ready one only once it has arrived
    if (prev?.state !== 'ready') store.set(id, { state: 'loading', width });
    try {
      const img = await decode(`/photos/${id}-${width}.webp`);
      if (dead) {
        img.close?.();
        return;
      }
      const stats = sample(img);
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace; // sampled as linear light
      tex.flipY = false; // rows top-down, as the shader reads them
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true; // the blurred brightness reads a small mip
      tex.needsUpdate = true;
      // upload now, so a cut never waits on it
      renderer.initTexture(tex);
      img.close?.();
      const cdf = cdfTexture(stats.cdf);
      renderer.initTexture(cdf);
      const old = store.get(id);
      if (old?.state === 'ready') {
        old.tex.dispose();
        old.cdf.dispose();
      }
      // the other temple was picked while this one was on its way
      if (!wanted(id)) {
        tex.dispose();
        cdf.dispose();
        store.delete(id);
        return;
      }
      store.set(id, { state: 'ready', width, tex, cdf, stats });
      landed();
    } catch (err) {
      if (dead) return;
      if (prev?.state === 'ready') store.set(id, prev);
      else store.set(id, { state: 'failed', width });
      if (import.meta.env.DEV) console.warn('[akd] photo failed to load', id, err);
      landed();
    }
  }

  // ─── what's on screen ───
  // a: the photo on screen ({ id, clock }) or a frame frozen mid-cut
  // ({ snap, stats, clock }); b: the photo arriving; p: how far, 0 to 1
  let a = null;
  let b = null;
  let p = 0;
  let dir = 1;
  let eased = true;
  let anim = null; // { from, to, start, dur }: p on its way
  let pending = null; // the photo to cut to once it has loaded
  let goal = null; // the photo the page wants on screen
  let ringAt = -1;
  let drawn = false;
  const drift = new Map(); // id → when its drift began
  let seen = new Set(); // ids in the last frame drawn
  const snaps = [];
  let snapNext = 0;

  const layer = (id) => ({ id, clock: minutesOf(id) });
  const statsOf = (l) => (l.snap ? l.stats : store.get(l.id).stats);
  const zoomOf = (id, now) => {
    const start = drift.get(id);
    return ctx.reduced || start == null ? 1 : zoomAt(now - start);
  };
  // a photo starts its drift when it comes on screen, and one already on
  // screen keeps going through a cut
  const begin = (id, now) => {
    if (!seen.has(id)) drift.set(id, now);
  };
  const drifting = (l, now) => !ctx.reduced && !!l && !l.snap && now - (drift.get(l.id) ?? -Infinity) < DRIFT_MS;

  function landed() {
    if (props.scrub != null) scrubTo(props.scrub);
    else tryStart();
    ctx.invalidate();
  }

  function tryStart() {
    if (!pending) return;
    const e = store.get(pending);
    // the photo that should be on screen can't be had: let the <img>s show it
    if (e?.state === 'failed') {
      broken = new Error(`photo ${pending} failed to load`);
      return;
    }
    if (e?.state !== 'ready') return;
    const id = pending;
    pending = null;
    const now = performance.now();
    if (!a) {
      // the first frame: the same zoom as the <img> under it
      const t = ctx.elapsed?.(ctx.el);
      drift.set(id, typeof t === 'number' ? now - t : -Infinity);
      a = layer(id);
      return;
    }
    if (ctx.reduced) {
      a = layer(id);
      b = null;
      p = 0;
      tidy();
      return;
    }
    if (!a.snap && a.id === id) return;
    b = layer(id);
    p = 0;
    eased = true;
    dir = a.clock != null && b.clock != null && b.clock < a.clock ? -1 : 1;
    anim = { from: 0, to: 1, start: now, dur: CUT_MS };
    begin(id, now);
  }

  // freeze the frame on screen (mid-cut) into a picture, so a new cut can
  // start from exactly what's showing
  function freeze(now) {
    const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    // two, used in turn, so a cut interrupted twice never reads the picture
    // it is drawing into
    let rt = snaps[snapNext];
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(v.x, v.y, { colorSpace: THREE.SRGBColorSpace, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      snaps[snapNext] = rt;
    } else if (rt.width !== v.x || rt.height !== v.y) rt.setSize(v.x, v.y);
    snapNext = 1 - snapNext;
    prepare(now, false);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const L = look(p, eased);
    const sb = statsOf(b);
    const stats = lerpStats(lerpStats(statsOf(a), sb, L.grade), sb, clamp01(L.front));
    a = { snap: rt, stats, clock: p < 0.5 ? a.clock : b.clock };
    b = null;
    p = 0;
    anim = null;
  }

  // cut to a photo (a time-of-day button, an arrow, a swipe, play, the other temple)
  function go(id) {
    goal = id;
    wantAround(id);
    if (b) {
      if (p >= 1) {
        a = b;
        b = null;
        p = 0;
      } else if (p <= 0 || ctx.reduced) b = null;
      else freeze(performance.now());
    }
    anim = null;
    if (a && !a.snap && a.id === id) {
      pending = null;
      return;
    }
    pending = id;
    tryStart();
  }

  // the track being dragged: the cut between the stops either side, at the
  // fraction between them (reduced motion: the nearest stop)
  function scrubTo(t) {
    const list = props.photos;
    const n = list.length;
    if (!n) return;
    const v = Math.min(n - 1, Math.max(0, t));
    let k0 = Math.floor(v);
    let f = v - k0;
    if (k0 >= n - 1 || ctx.reduced) {
      k0 = Math.round(v);
      f = 0;
    }
    const ida = list[k0].id;
    const idb = f > 0 ? list[k0 + 1].id : null;
    goal = list[Math.round(v)].id;
    want(ida, true);
    if (idb) want(idb, true);
    // hold the last frame until both photos are here
    if (!isReady(ida) || (idb && !isReady(idb))) return;
    const now = performance.now();
    pending = null;
    anim = null;
    eased = false;
    dir = 1;
    if (!a || a.snap || a.id !== ida) {
      begin(ida, now);
      a = layer(ida);
    }
    if (idb) {
      if (!b || b.id !== idb) {
        begin(idb, now);
        b = layer(idb);
      }
      p = f;
    } else {
      b = null;
      p = 0;
    }
    if (snaps.length) tidy(); // a frozen frame the drag replaced
  }

  // letting go of the track: finish or undo the cut toward the nearest stop
  function settle(id) {
    goal = id;
    const now = performance.now();
    if (b && b.id === id) anim = { from: p, to: 1, start: now, dur: settleMs(1 - p) };
    else if (a && !a.snap && a.id === id) {
      if (b) anim = { from: p, to: 0, start: now, dur: settleMs(p) };
    } else go(id);
  }

  // let go of what's no longer needed: the other temple's photos, frozen frames
  function tidy() {
    const keep = new Set(props.photos.map((ph) => ph.id));
    if (a?.id) keep.add(a.id);
    if (b?.id) keep.add(b.id);
    if (pending) keep.add(pending);
    for (const [id, e] of store) {
      if (keep.has(id) || e.state !== 'ready') continue;
      e.tex.dispose();
      e.cdf.dispose();
      store.delete(id);
    }
    if (!a?.snap) {
      for (const rt of snaps) rt?.dispose();
      snaps.length = 0;
      snapNext = 0;
    }
  }

  function advance(now) {
    if (!anim) return;
    const k = clamp01((now - anim.start) / anim.dur);
    p = anim.from + (anim.to - anim.from) * (eased ? k : settleEase(k));
    if (k < 1) return;
    anim = null;
    if (p >= 1) {
      a = b;
      b = null;
      p = 0;
    } else if (p <= 0) {
      b = null;
      p = 0;
    }
    tidy();
  }

  function prepare(now, withRing = true) {
    // (the slow-frame watchdog may have lowered the sharpness since the last resize)
    uniforms.uCell.value = renderer.getPixelRatio() * CELL;
    if (a.snap) {
      uniforms.tA.value = a.snap.texture;
      uniforms.uSnap.value = 1;
    } else {
      const m = meta.get(a.id);
      uniforms.tA.value = store.get(a.id).tex;
      uniforms.uSnap.value = 0;
      cover(size.w, size.h, m.ratio, m.pos, uniforms.uMapA.value);
      uniforms.uZoom.value.x = zoomOf(a.id, now);
    }
    if (b && p > 0) {
      const e = store.get(b.id);
      const m = meta.get(b.id);
      const t = toneBetween(statsOf(a), e.stats);
      const L = look(p, eased);
      uniforms.tB.value = e.tex;
      uniforms.tCdf.value = e.cdf;
      cover(size.w, size.h, m.ratio, m.pos, uniforms.uMapB.value);
      uniforms.uZoom.value.y = zoomOf(b.id, now);
      uniforms.uTone.value.set(t.exposure, t.pivot, t.contrast);
      uniforms.uTint.value.set(t.tint[0], t.tint[1], t.tint[2]);
      uniforms.uGrade.value = L.grade;
      uniforms.uFront.value = L.front;
      uniforms.uBlend.value = L.front > -BAND / 2 ? 1 : 0;
      uniforms.uDir.value = dir;
    } else {
      uniforms.uGrade.value = 0;
      uniforms.uBlend.value = 0;
    }
    const r = (now - ringAt) / RING_MS;
    if (withRing && ringAt >= 0 && r < 1) {
      const reach = Math.hypot(uniforms.uAspect.value / 2, 0.5) + 0.12;
      // it spreads and softens as it travels, and fades out by the edges
      uniforms.uRing.value.set(0.02 + reach * (1 - (1 - r) ** 2), RING_AMP * (1 - r) ** 1.5 * Math.min(1, r / 0.1), 0.05 + 0.06 * r);
    } else {
      uniforms.uRing.value.y = 0;
      if (ringAt >= 0 && r >= 1) ringAt = -1;
    }
  }

  // the first photo
  goal = props.photos[props.index]?.id ?? null;
  pending = goal;
  wantAround(goal);

  return {
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      gl.setSize(size.w, size.h);
      uniforms.uAspect.value = size.w / size.h;
      // bigger now: fetch sharper copies of what's on screen
      if (a?.id) want(a.id, true);
      if (b?.id) want(b.id, true);
    },
    update(next) {
      if (!next) return;
      const prev = props;
      props = { ...props, ...next };
      if (props.photos !== prev.photos) learn(props.photos);
      if (props.rang && props.rang !== prev.rang && !ctx.reduced) ringAt = performance.now();
      const id = props.photos[props.index]?.id;
      if (props.scrub != null) scrubTo(props.scrub);
      else if (prev.scrub != null) settle(id);
      else if (id && id !== goal) go(id);
    },
    render(ms, now) {
      if (gl.lost) return false;
      if (broken) throw broken; // the page falls back to the <img>s
      gl.watch(now);
      if (!a) return false; // nothing to show yet: the <img> stays in view
      advance(now);
      prepare(now);
      renderer.render(scene, camera);
      seen = new Set();
      if (a.id) seen.add(a.id);
      if (b && p > 0) seen.add(b.id);
      if (!drawn) {
        // a real frame is up, the same as the <img>: it can step aside
        drawn = true;
        ctx.el.dataset.drawn = '';
      }
      return !!anim || ringAt >= 0 || drifting(a, now) || (!!b && p > 0 && drifting(b, now));
    },
    dispose() {
      dead = true;
      delete ctx.el.dataset.drawn;
      for (const e of store.values()) {
        e.tex?.dispose();
        e.cdf?.dispose();
      }
      store.clear();
      for (const rt of snaps) rt?.dispose();
      geo.dispose();
      mat.dispose();
      gl.dispose();
    },
  };
}
