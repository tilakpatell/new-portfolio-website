import { useEffect, useRef } from 'react';
import { GLOBE } from '../../data/globe';
import { CODE_ALPHABET, fibonacciPoint } from '../../data/globe-lattice';
import { HOME, PLACES } from '../../data/places';
import { prefersReducedMotion } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';

// A dotted globe on a plain 2D canvas: no WebGL, so it runs the same with
// hardware acceleration off. Land is the Fibonacci lattice from
// scripts/build-globe.mjs; visited countries are lit in the theme's accent, and
// a route arcs from home to every place. Drag to spin, click to fly somewhere.

const RAD = Math.PI / 180;
const MIN_SCALE = 1;
const MAX_SCALE = 2.6;

const toVec = (lon, lat) => {
  const l = lon * RAD;
  const p = lat * RAD;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};

// Points along the great circle from a to b, lifted off the surface in the
// middle so long routes read as flights.
function arc(a, b, steps = 72) {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(d);
  const s = Math.sin(omega) || 1;
  const lift = 0.03 + 0.2 * (omega / Math.PI);
  const pts = new Float32Array((steps + 1) * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wa = Math.sin((1 - t) * omega) / s;
    const wb = Math.sin(t * omega) / s;
    const h = 1 + lift * Math.sin(Math.PI * t);
    pts[i * 3] = (wa * a[0] + wb * b[0]) * h;
    pts[i * 3 + 1] = (wa * a[1] + wb * b[1]) * h;
    pts[i * 3 + 2] = (wa * a[2] + wb * b[2]) * h;
  }
  return pts;
}

let cache = null;
function globeData() {
  if (cache) return cache;
  const lookup = new Uint8Array(128);
  for (let i = 0; i < CODE_ALPHABET.length; i++) lookup[CODE_ALPHABET.charCodeAt(i)] = i;
  const bits = atob(GLOBE.land);
  const count = GLOBE.owner.length / 2;
  const xyz = new Float32Array(count * 3);
  const owner = new Int16Array(count);
  let k = 0;
  for (let i = 0; i < GLOBE.n && k < count; i++) {
    if (!(bits.charCodeAt(i >> 3) & (1 << (i & 7)))) continue;
    const v = toVec(...fibonacciPoint(i, GLOBE.n));
    xyz[k * 3] = v[0];
    xyz[k * 3 + 1] = v[1];
    xyz[k * 3 + 2] = v[2];
    owner[k] = lookup[GLOBE.owner.charCodeAt(2 * k)] * 64 + lookup[GLOBE.owner.charCodeAt(2 * k + 1)];
    k++;
  }
  // Country index -> place index, for the countries that are lit.
  const placeOf = new Int16Array(GLOBE.names.length).fill(-1);
  PLACES.forEach((p, i) => {
    const c = GLOBE.placeCountry[p.id];
    if (c != null) placeOf[c] = i;
  });
  // Whether each dot sits in a lit country never changes, so it is worked out
  // here once instead of for every dot in every frame.
  const lit = new Uint8Array(count);
  for (let i = 0; i < count; i++) lit[i] = placeOf[owner[i]] >= 0 ? 1 : 0;
  const home = toVec(...HOME.at);
  const markers = PLACES.map((p) => toVec(...p.at));
  const arcs = PLACES.map((p, i) => (p.home ? null : arc(home, markers[i])));
  cache = { count, xyz, owner, lit, placeOf, markers, arcs };
  return cache;
}

// Theme colours from the CSS custom properties, as [r, g, b].
function parseColor(value) {
  const v = value.trim();
  if (v.startsWith('#')) {
    const hex = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join('') : v.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const nums = v.match(/[\d.]+/g)?.map(Number) ?? [];
  if (v.startsWith('color(')) return nums.slice(0, 3).map((n) => Math.round(n * 255));
  return nums.length >= 3 ? nums.slice(0, 3) : null;
}
function readColors(el) {
  const cs = getComputedStyle(el);
  const get = (name, fallback) => parseColor(cs.getPropertyValue(name)) ?? fallback;
  return {
    accent: get('--accent', [255, 153, 0]),
    text: get('--text', [15, 17, 17]),
    surface: get('--surface', [255, 255, 255]),
    surface2: get('--surface-2', [242, 243, 243]),
    border: get('--border-strong', [135, 149, 150]),
    dark: document.documentElement.dataset.mode === 'dark',
  };
}
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

// Land dots are filled in 16 buckets, 4 kinds (plain, hovered, lit, selected)
// by 4 depth bands, so each bucket is one path and one fill.
const BUCKETS = 16;
const HIDDEN = 255; // a dot on the far side of the globe
const BAND_ALPHA = [0.3, 0.55, 0.8, 1];
const KIND_SIZE = [1, 1.1, 1.15, 1.45];
const TAU = Math.PI * 2;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

export default function Globe({ selected, onSelect, onHover, label }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const tipRef = useRef(null);
  const pinRef = useRef(null);
  const api = useRef({});
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const data = globeData();
    const reduced = prefersReducedMotion();

    const view = { lon: -38, lat: 24, scale: 1 };
    const size = { w: 0, h: 0, dpr: 1 };
    const state = {
      colors: readColors(wrap),
      inView: false,
      dragging: null, // { id, x, y, lon, lat, moved, t }
      velocity: { lon: 0, lat: 0 },
      fly: null, // { from, to, start, dur }
      idleSince: performance.now(),
      introStart: null,
      hoverCountry: -1,
      hoverPoint: null,
      selected: -1,
      tipUntil: 0,
      lastDraw: 0,
    };
    const n = data.count;
    // One frame of land: where each dot lands on screen and which bucket it is
    // in, then the same coordinates again packed in bucket order, so a bucket
    // is drawn from one run of memory instead of a search through every dot.
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    const bucketOf = new Uint8Array(n);
    const bx = new Float32Array(n);
    const by = new Float32Array(n);
    const ends = new Int32Array(BUCKETS);

    // Rotation that brings (view.lon, view.lat) to the middle of the disc.
    let cosT = 1;
    let sinT = 0;
    let cosA = 1;
    let sinA = 0;
    const setRotation = () => {
      const t = -view.lon * RAD;
      const a = view.lat * RAD;
      cosT = Math.cos(t);
      sinT = Math.sin(t);
      cosA = Math.cos(a);
      sinA = Math.sin(a);
    };
    const out = [0, 0, 0];
    const rotate = (x, y, z) => {
      const x1 = x * cosT + z * sinT;
      const z1 = -x * sinT + z * cosT;
      out[0] = x1;
      out[1] = y * cosA - z1 * sinA;
      out[2] = y * sinA + z1 * cosA;
      return out;
    };
    const unrotate = (x2, y2, z2) => {
      const y1 = y2 * cosA + z2 * sinA;
      const z1 = -y2 * sinA + z2 * cosA;
      return [x2 * cosT - z1 * sinT, y1, x2 * sinT + z1 * cosT];
    };
    const radius = () => (Math.min(size.w, size.h) / 2) * 0.84 * view.scale;

    // Screen point -> unit vector on the globe, or null off the disc.
    const pickVector = (px, py) => {
      const R = radius();
      const x = (px - size.w / 2) / R;
      const y = -(py - size.h / 2) / R;
      const d = x * x + y * y;
      if (d > 1) return null;
      return unrotate(x, y, Math.sqrt(1 - d));
    };
    const nearestLand = (v) => {
      let best = -1;
      let bestDot = Math.cos(1.6 * RAD);
      const { xyz } = data;
      for (let i = 0; i < n; i++) {
        const d = xyz[i * 3] * v[0] + xyz[i * 3 + 1] * v[1] + xyz[i * 3 + 2] * v[2];
        if (d > bestDot) {
          bestDot = d;
          best = i;
        }
      }
      return best < 0 ? -1 : data.owner[best];
    };
    // A marker within reach of the pointer wins over the land under it, so the
    // Caribbean and Malta stay easy to hit.
    const nearestMarker = (px, py) => {
      const R = radius();
      let best = -1;
      let bestD = 14 * 14;
      data.markers.forEach((m, i) => {
        const [x, y, z] = rotate(m[0], m[1], m[2]);
        if (z <= 0) return;
        const dx = size.w / 2 + x * R - px;
        const dy = size.h / 2 - y * R - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    };
    const placeAt = (px, py) => {
      const m = nearestMarker(px, py);
      if (m >= 0) return { place: m, country: GLOBE.placeCountry[PLACES[m].id] ?? -1 };
      const v = pickVector(px, py);
      if (!v) return null;
      const country = nearestLand(v);
      return { place: country >= 0 ? data.placeOf[country] : -1, country };
    };

    const flyTo = (lon, lat, scale) => {
      const from = { ...view };
      const to = { lon: from.lon + wrap180(lon - from.lon), lat: Math.max(-60, Math.min(70, lat)), scale };
      if (reduced) {
        Object.assign(view, to);
        wake();
        return;
      }
      const dist = Math.hypot(to.lon - from.lon, to.lat - from.lat);
      state.fly = { from, to, start: performance.now(), dur: Math.min(1400, 500 + dist * 6) };
      state.velocity = { lon: 0, lat: 0 };
      wake();
    };

    // ── Drawing ────────────────────────────────────────────────────────────
    // Colour strings are the same from one frame to the next, so they are built
    // when the theme or the selection changes, not 30 times a second.
    let paint = null;
    const paintFor = (hasSelection) => {
      const { colors } = state;
      if (paint && paint.colors === colors && paint.hasSelection === hasSelection) return paint;
      const land = [];
      for (let b = 0; b < BUCKETS; b++) {
        const kind = b >> 2;
        const a = BAND_ALPHA[b & 3];
        land.push(
          kind === 3
            ? rgba(colors.accent, a)
            : kind === 2
              ? rgba(colors.accent, a * (hasSelection ? 0.55 : 0.9))
              : kind === 1
                ? rgba(colors.text, a * 0.75)
                : rgba(colors.text, a * (colors.dark ? 0.32 : 0.26)),
        );
      }
      const sparks = [];
      for (let tail = 0; tail < 6; tail++) sparks.push(rgba(colors.accent, 1 - tail / 6));
      paint = {
        colors,
        hasSelection,
        land,
        sparks,
        glow: [rgba(colors.accent, colors.dark ? 0.22 : 0.14), rgba(colors.accent, 0)],
        body: [rgba(colors.surface, 1), rgba(colors.surface2, 1)],
        border: rgba(colors.border, 0.45),
        accent: rgba(colors.accent, 1),
        surface: rgba(colors.surface, 1),
        route: rgba(colors.accent, 0.55),
        routeDim: rgba(colors.accent, 0.18),
      };
      return paint;
    };
    // The two gradients of the sphere only change with its size or the theme,
    // so the last pair is kept: while the globe just spins they are reused.
    let sphere = null;
    const sphereFor = (c, p, cx, cy, R) => {
      if (sphere && sphere.c === c && sphere.p === p && sphere.cx === cx && sphere.cy === cy && sphere.R === R) return sphere;
      const glow = c.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.16);
      glow.addColorStop(0, p.glow[0]);
      glow.addColorStop(1, p.glow[1]);
      const body = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      body.addColorStop(0, p.body[0]);
      body.addColorStop(1, p.body[1]);
      sphere = { c, p, cx, cy, R, glow, body };
      return sphere;
    };

    // The sphere and its land: everything that only moves when the globe turns.
    const drawLand = (c, p) => {
      const { w, h, dpr } = size;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const R = radius();
      const cx = w / 2;
      const cy = h / 2;

      // Atmosphere and the sphere itself
      const { glow, body } = sphereFor(c, p, cx, cy, R);
      c.fillStyle = glow;
      c.beginPath();
      c.arc(cx, cy, R * 1.16, 0, TAU);
      c.fill();
      c.fillStyle = body;
      c.beginPath();
      c.arc(cx, cy, R, 0, TAU);
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = p.border;
      c.stroke();

      // One pass turns every dot and notes its bucket. The rotation is written
      // out in place: a helper that hands back [x, y, z] made an array iterator
      // for each of the 6,316 dots, which is where the garbage came from.
      const { xyz, owner, lit } = data;
      const selectedCountry = state.selected >= 0 ? (GLOBE.placeCountry[PLACES[state.selected].id] ?? -2) : -2;
      const hoverCountry = state.hoverCountry;
      ends.fill(0);
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        const x = xyz[j];
        const y = xyz[j + 1];
        const z = xyz[j + 2];
        const z1 = -x * sinT + z * cosT;
        const depth = y * sinA + z1 * cosA;
        if (depth <= 0.02) {
          bucketOf[i] = HIDDEN;
          continue;
        }
        sx[i] = cx + (x * cosT + z * sinT) * R;
        sy[i] = cy - (y * cosA - z1 * sinA) * R;
        const country = owner[i];
        const kind = country === selectedCountry ? 3 : lit[i] ? 2 : country === hoverCountry ? 1 : 0;
        const b = kind * 4 + (depth < 0.3 ? 0 : depth < 0.55 ? 1 : depth < 0.8 ? 2 : 3);
        bucketOf[i] = b;
        ends[b]++;
      }
      // Counting sort: turn the bucket sizes into where each bucket starts,
      // then drop every visible dot into its bucket's run.
      let total = 0;
      for (let b = 0; b < BUCKETS; b++) {
        const count = ends[b];
        ends[b] = total;
        total += count;
      }
      for (let i = 0; i < n; i++) {
        const b = bucketOf[i];
        if (b === HIDDEN) continue;
        const at = ends[b]++;
        bx[at] = sx[i];
        by[at] = sy[i];
      }
      // ends[b] now is where bucket b stops; each bucket is still one fill, so
      // dots that overlap near the rim do not darken each other.
      const dot = R * 0.0072;
      let from = 0;
      for (let b = 0; b < BUCKETS; b++) {
        const to = ends[b];
        if (to === from) continue;
        const r = dot * KIND_SIZE[b >> 2] * (0.7 + 0.3 * ((b & 3) / 3));
        c.beginPath();
        for (let k = from; k < to; k++) {
          const x = bx[k];
          const y = by[k];
          c.moveTo(x + r, y);
          c.arc(x, y, r, 0, TAU);
        }
        c.fillStyle = p.land[b];
        c.fill();
        from = to;
      }
    };

    // While nothing turns the globe (a place is selected, or the visitor has
    // just let go) every frame would draw the same 3,000 dots again under the
    // moving sparks. The second frame in a row with the same land keeps a copy
    // of it, and later frames paste that copy instead of drawing the dots.
    const kept = { canvas: null, ctx: null, fresh: false };
    const shown = { lon: NaN, lat: NaN, scale: NaN, hover: -1, selected: -1, colors: null, w: 0, h: 0, dpr: 0 };
    const landUnchanged = () =>
      shown.lon === view.lon &&
      shown.lat === view.lat &&
      shown.scale === view.scale &&
      shown.hover === state.hoverCountry &&
      shown.selected === state.selected &&
      shown.colors === state.colors &&
      shown.w === size.w &&
      shown.h === size.h &&
      shown.dpr === size.dpr;
    const keepLand = (p) => {
      if (!kept.canvas) {
        kept.canvas = document.createElement('canvas');
        kept.ctx = kept.canvas.getContext('2d');
        if (kept.ctx) kept.ctx.lineCap = 'round';
      }
      if (!kept.ctx) return;
      if (kept.canvas.width !== canvas.width || kept.canvas.height !== canvas.height) {
        kept.canvas.width = canvas.width;
        kept.canvas.height = canvas.height;
        kept.ctx.lineCap = 'round'; // resizing a canvas resets its state
      }
      drawLand(kept.ctx, p);
      kept.fresh = true;
    };

    // What the label and the tooltip were last set to, so a frame that leaves
    // them where they are does not touch the DOM.
    const dom = { pinOpacity: '', pinX: NaN, pinY: NaN, tipOpacity: '' };

    const draw = (now) => {
      const { w, h, dpr } = size;
      if (!w || !h) return;
      const { colors } = state;
      const p = paintFor(state.selected >= 0);
      setRotation();
      const R = radius();
      const cx = w / 2;
      const cy = h / 2;

      if (!landUnchanged()) {
        shown.lon = view.lon;
        shown.lat = view.lat;
        shown.scale = view.scale;
        shown.hover = state.hoverCountry;
        shown.selected = state.selected;
        shown.colors = colors;
        shown.w = w;
        shown.h = h;
        shown.dpr = dpr;
        kept.fresh = false;
      } else if (!kept.fresh) keepLand(p);
      if (kept.fresh) {
        // Pasted pixel for pixel, so it is exactly what drawLand would paint.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(kept.canvas, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else drawLand(ctx, p);

      // Routes from home
      const intro = state.introStart == null ? 0 : reduced ? 1 : Math.min(1, (now - state.introStart) / 1800);
      const { arcs, markers } = data;
      for (let i = 0; i < arcs.length; i++) {
        const pts = arcs[i];
        if (!pts) continue;
        const steps = pts.length / 3 - 1;
        const local = reduced ? 1 : easeOut(Math.max(0, Math.min(1, intro * 1.6 - i * 0.04)));
        const upto = Math.floor(local * steps);
        if (upto < 1) continue;
        const isSel = state.selected === i;
        ctx.strokeStyle = isSel ? p.accent : state.selected >= 0 ? p.routeDim : p.route;
        ctx.lineWidth = isSel ? 2 : 1.2;
        ctx.beginPath();
        let pen = false;
        for (let k = 0, j = 0; k <= upto; k++, j += 3) {
          const px = pts[j];
          const py = pts[j + 1];
          const pz = pts[j + 2];
          const x = px * cosT + pz * sinT;
          const z1 = -px * sinT + pz * cosT;
          const y = py * cosA - z1 * sinA;
          const z = py * sinA + z1 * cosA;
          const visible = z > 0 || x * x + y * y > 1;
          if (!visible) {
            pen = false;
            continue;
          }
          if (pen) ctx.lineTo(cx + x * R, cy - y * R);
          else ctx.moveTo(cx + x * R, cy - y * R);
          pen = true;
        }
        ctx.stroke();

        // A spark that keeps flying the route
        if (!reduced && local >= 1 && (state.selected < 0 || isSel)) {
          const t = (now / 3200 + i * 0.137) % 1;
          for (let tail = 0; tail < 6; tail++) {
            const tt = t - tail * 0.012;
            if (tt < 0) break;
            const f = tt * steps;
            const k = Math.floor(f);
            const u = f - k;
            const a = k * 3;
            const bx0 = pts[a] + (pts[a + 3] - pts[a]) * u;
            const by0 = pts[a + 1] + (pts[a + 4] - pts[a + 1]) * u;
            const bz0 = pts[a + 2] + (pts[a + 5] - pts[a + 2]) * u;
            const x = bx0 * cosT + bz0 * sinT;
            const z1 = -bx0 * sinT + bz0 * cosT;
            const y = by0 * cosA - z1 * sinA;
            const z = by0 * sinA + z1 * cosA;
            if (!(z > 0 || x * x + y * y > 1)) break;
            ctx.fillStyle = p.sparks[tail];
            ctx.beginPath();
            ctx.arc(cx + x * R, cy - y * R, (isSel ? 2.6 : 2) * (1 - tail / 8), 0, TAU);
            ctx.fill();
          }
        }
      }

      // Markers
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const x = m[0] * cosT + m[2] * sinT;
        const z1 = -m[0] * sinT + m[2] * cosT;
        const y = m[1] * cosA - z1 * sinA;
        const z = m[1] * sinA + z1 * cosA;
        if (z <= 0.05) continue;
        const px = cx + x * R;
        const py = cy - y * R;
        const isSel = state.selected === i;
        const home = PLACES[i].home;
        if ((home || isSel) && !reduced) {
          const t = (now % 2400) / 2400;
          ctx.strokeStyle = rgba(colors.accent, (1 - t) * 0.8);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(px, py, 4 + t * 12, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = p.surface;
        const ring = 0.4 + z;
        ctx.strokeStyle = ring >= 1 ? p.accent : rgba(colors.accent, ring);
        ctx.lineWidth = isSel || home ? 2 : 1.4;
        ctx.beginPath();
        ctx.arc(px, py, isSel ? 5 : home ? 4.2 : 3.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (isSel || home) {
          ctx.fillStyle = p.accent;
          ctx.beginPath();
          ctx.arc(px, py, isSel ? 2.2 : 1.8, 0, TAU);
          ctx.fill();
        }
      }

      // The selected place's label follows its marker
      const pin = pinRef.current;
      if (pin) {
        let opacity = '0';
        if (state.selected >= 0) {
          const m = markers[state.selected];
          const x = m[0] * cosT + m[2] * sinT;
          const z1 = -m[0] * sinT + m[2] * cosT;
          const y = m[1] * cosA - z1 * sinA;
          const z = m[1] * sinA + z1 * cosA;
          opacity = z > 0.1 ? '1' : '0';
          const px = cx + x * R;
          const py = cy - y * R;
          if (px !== dom.pinX || py !== dom.pinY) {
            dom.pinX = px;
            dom.pinY = py;
            pin.style.transform = `translate(${px}px, ${py}px)`;
          }
        }
        if (opacity !== dom.pinOpacity) {
          dom.pinOpacity = opacity;
          pin.style.opacity = opacity;
        }
      }
      const tip = tipRef.current;
      if (tip) {
        const opacity = state.hoverPoint && (state.hoverCountry >= 0 || now < state.tipUntil) ? '1' : '0';
        if (opacity !== dom.tipOpacity) {
          dom.tipOpacity = opacity;
          tip.style.opacity = opacity;
        }
      }
      state.lastDraw = now;
    };

    // ── Animation ──────────────────────────────────────────────────────────
    let raf = 0;
    let last = 0;
    let dirty = true;
    const animating = (now) =>
      !!state.dragging ||
      !!state.fly ||
      Math.abs(state.velocity.lon) + Math.abs(state.velocity.lat) > 0.002 ||
      (!reduced && (state.introStart == null || now - state.introStart < 2200)) ||
      (!reduced && state.inView); // idle spin, sparks and the home pulse

    const step = (dt, now) => {
      if (state.fly) {
        const t = Math.min(1, (now - state.fly.start) / state.fly.dur);
        const e = easeInOut(t);
        const { from, to } = state.fly;
        view.lon = from.lon + (to.lon - from.lon) * e;
        view.lat = from.lat + (to.lat - from.lat) * e;
        view.scale = from.scale + (to.scale - from.scale) * e;
        if (t >= 1) state.fly = null;
        dirty = true;
      } else if (!state.dragging && Math.abs(state.velocity.lon) + Math.abs(state.velocity.lat) > 0.002) {
        view.lon += state.velocity.lon * dt;
        view.lat = Math.max(-60, Math.min(70, view.lat + state.velocity.lat * dt));
        const decay = Math.pow(0.94, dt / 16);
        state.velocity.lon *= decay;
        state.velocity.lat *= decay;
        dirty = true;
      } else if (!reduced && !state.dragging && state.selected < 0 && now - state.idleSince > 2500) {
        // about 6° a second. Not marked dirty: the idle spin is drawn on the
        // 30fps beat in frame(), and dirty would redraw it on every frame the
        // screen has (60 a second, 120 on a ProMotion display).
        view.lon += 0.006 * dt;
      }
    };

    // While the page scrolls past, the idle spin holds still: the scroll gets
    // the frames, and the globe picks up again a moment after it stops.
    let scrolledAt = -1e9;
    const onPageScroll = () => {
      scrolledAt = performance.now();
    };
    window.addEventListener('scroll', onPageScroll, { passive: true });

    const frame = (now) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const interactive = state.dragging || state.fly;
      const idleHold = !interactive && now - scrolledAt < 220;
      if (!idleHold) step(dt, now);
      const busy = animating(now);
      // Idle spinning is drawn at 30fps; anything the visitor is doing gets 60.
      if (dirty || (busy && !idleHold && (interactive || now - state.lastDraw > 31))) {
        draw(now);
        dirty = false;
      }
      if (busy && state.inView && !document.hidden) raf = requestAnimationFrame(frame);
    };
    function wake() {
      dirty = true;
      if (!raf && state.inView && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    // ── Sizing, visibility, theme ──────────────────────────────────────────
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      size.dpr = Math.min(2, window.devicePixelRatio || 1);
      size.w = rect.width;
      size.h = rect.height;
      canvas.width = Math.round(rect.width * size.dpr);
      canvas.height = Math.round(rect.height * size.dpr);
      ctx.lineCap = 'round'; // for the routes; resizing a canvas resets its state
      // Resizing clears the canvas; repaint now so it never shows blank.
      draw(performance.now());
      wake();
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    resize();

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            state.inView = e.isIntersecting;
            if (state.inView && state.introStart == null) state.introStart = performance.now();
            if (state.inView) wake();
          })
        : null;
    if (io) io.observe(wrap);
    else {
      state.inView = true;
      state.introStart = performance.now();
    }

    const mo = new MutationObserver(() => {
      state.colors = readColors(wrap);
      wake();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    const onVisibility = () => !document.hidden && wake();
    document.addEventListener('visibilitychange', onVisibility);

    // ── Pointer and keyboard ───────────────────────────────────────────────
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    let tipText = '';
    const setTip = (text, px, py) => {
      const tip = tipRef.current;
      if (!tip) return;
      // the same words written again would still cost a layout on every pointer move
      if (text !== tipText) {
        tipText = text;
        tip.textContent = text;
      }
      tip.style.transform = `translate(${px}px, ${py}px)`;
    };
    const describe = (hit) => {
      if (!hit || hit.country < 0) return null;
      if (hit.place >= 0) return PLACES[hit.place].name;
      return `${GLOBE.names[hit.country]}: not yet`;
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      const [px, py] = local(e);
      state.dragging = { id: e.pointerId, x: px, y: py, lon: view.lon, lat: view.lat, moved: 0, t: performance.now(), lastX: px, lastY: py };
      state.fly = null;
      state.velocity = { lon: 0, lat: 0 };
      state.idleSince = performance.now();
      capturePointer(e, canvas);
      wake();
    };
    const onMove = (e) => {
      const [px, py] = local(e);
      const d = state.dragging;
      if (d && d.id === e.pointerId) {
        const R = radius();
        const dx = px - d.x;
        const dy = py - d.y;
        d.moved = Math.max(d.moved, Math.hypot(dx, dy));
        view.lon = d.lon - (dx / R) * (180 / Math.PI) * 0.9;
        view.lat = Math.max(-60, Math.min(70, d.lat + (dy / R) * (180 / Math.PI) * 0.9));
        const now = performance.now();
        const dt = Math.max(1, now - d.t);
        state.velocity = {
          lon: (-(px - d.lastX) / R) * (180 / Math.PI) * 0.9 / dt,
          lat: ((py - d.lastY) / R) * (180 / Math.PI) * 0.9 / dt,
        };
        d.t = now;
        d.lastX = px;
        d.lastY = py;
        state.idleSince = now;
        canvas.style.cursor = 'grabbing';
        dirty = true;
        return;
      }
      if (e.pointerType !== 'mouse') return;
      const hit = placeAt(px, py);
      const country = hit?.country ?? -1;
      state.hoverPoint = hit ? [px, py] : null;
      canvas.style.cursor = hit && hit.place >= 0 ? 'pointer' : 'grab';
      if (country !== state.hoverCountry) {
        state.hoverCountry = country;
        onHoverRef.current?.(hit && hit.place >= 0 ? PLACES[hit.place].id : null);
        wake();
      }
      const text = describe(hit);
      if (text) setTip(text, px, py);
    };
    // The browser took over (a touch scroll): end the drag, never treat it as a tap.
    const onCancel = (e) => {
      if (state.dragging?.id !== e.pointerId) return;
      state.dragging = null;
      state.velocity = { lon: 0, lat: 0 };
      canvas.style.cursor = 'grab';
      wake();
    };
    const onUp = (e) => {
      const d = state.dragging;
      if (!d || d.id !== e.pointerId) return;
      state.dragging = null;
      canvas.style.cursor = 'grab';
      state.idleSince = performance.now();
      if (performance.now() - d.t > 80) state.velocity = { lon: 0, lat: 0 }; // released after holding still
      if (d.moved < 6) {
        state.velocity = { lon: 0, lat: 0 };
        const [px, py] = local(e);
        const hit = placeAt(px, py);
        if (hit && hit.place >= 0) onSelectRef.current?.(PLACES[hit.place].id);
        else if (hit && hit.country >= 0) {
          setTip(`${GLOBE.names[hit.country]}: not yet`, px, py);
          state.hoverPoint = [px, py];
          state.tipUntil = performance.now() + 1600;
          setTimeout(wake, 1650);
        } else onSelectRef.current?.(null);
      }
      wake();
    };
    const onLeave = () => {
      state.hoverPoint = null;
      if (state.hoverCountry !== -1) {
        state.hoverCountry = -1;
        onHoverRef.current?.(null);
      }
      wake();
    };
    const onKey = (e) => {
      const stepDeg = e.shiftKey ? 30 : 10;
      const moves = {
        ArrowLeft: () => flyTo(view.lon - stepDeg, view.lat, view.scale),
        ArrowRight: () => flyTo(view.lon + stepDeg, view.lat, view.scale),
        ArrowUp: () => flyTo(view.lon, view.lat + stepDeg, view.scale),
        ArrowDown: () => flyTo(view.lon, view.lat - stepDeg, view.scale),
        '+': () => api.current.zoom(1),
        '=': () => api.current.zoom(1),
        '-': () => api.current.zoom(-1),
        Escape: () => onSelectRef.current?.(null),
      };
      const fn = moves[e.key];
      if (!fn) return;
      e.preventDefault();
      state.idleSince = performance.now();
      fn();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('keydown', onKey);

    api.current = {
      select(id) {
        const i = PLACES.findIndex((p) => p.id === id);
        state.selected = i;
        state.idleSince = performance.now();
        if (i >= 0) {
          const [lon, lat] = PLACES[i].at;
          flyTo(lon, lat - 6, Math.max(view.scale, 1.35));
        } else if (view.scale > 1) {
          flyTo(view.lon, view.lat, 1);
        } else wake();
      },
      zoom(dir) {
        state.idleSince = performance.now();
        flyTo(view.lon, view.lat, Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * (dir > 0 ? 1.35 : 1 / 1.35))));
      },
      reset() {
        state.idleSince = performance.now();
        flyTo(-38, 24, 1);
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onPageScroll);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    api.current.select?.(selected);
  }, [selected]);

  const selectedPlace = PLACES.find((p) => p.id === selected);

  return (
    <div ref={wrapRef} className="globe relative aspect-square w-full">
      <canvas
        ref={canvasRef}
        className="globe-canvas absolute inset-0 h-full w-full"
        tabIndex={0}
        aria-label={label}
      />
      <span ref={tipRef} className="globe-tip" aria-hidden="true" />
      <span ref={pinRef} className="globe-pin" aria-hidden="true">
        {selectedPlace?.name}
      </span>
      <div className="globe-controls">
        <button type="button" className="globe-btn" onClick={() => api.current.zoom(1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="globe-btn" onClick={() => api.current.zoom(-1)} aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          className="globe-btn globe-btn-wide"
          onClick={() => {
            onSelectRef.current?.(null);
            api.current.reset();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
