// The page's colours, for anything drawn outside CSS (WebGL, 2D canvas).
// A theme is only CSS custom properties on <html>, so this reads them through
// a hidden probe element (which resolves var(), color-mix() and the dark-mode
// saber swap to a real colour) and calls back when the theme or mode changes.
// No React: a scene asks once and then listens, so a theme switch costs a
// re-colour and a redraw, never a re-render.

const TOKENS = {
  accent: '--accent',
  text: '--text',
  body: '--text-body',
  muted: '--muted',
  bg: '--bg',
  bgDeep: '--bg-deep',
  surface: '--surface',
  surface2: '--surface-2',
  border: '--border',
  borderStrong: '--border-strong',
};

const FALLBACK = {
  accent: [255, 153, 0],
  text: [15, 17, 17],
  body: [55, 65, 81],
  muted: [107, 114, 128],
  bg: [255, 255, 255],
  bgDeep: [250, 250, 250],
  surface: [255, 255, 255],
  surface2: [242, 243, 243],
  border: [229, 231, 235],
  borderStrong: [135, 149, 150],
};

// '#f90', '#ff9900', 'rgb(255, 153, 0)', 'rgba(…)', 'color(srgb 1 0.6 0)' → [r, g, b] in 0-255
export function parseColor(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith('#')) {
    const hex = v.length === 4 || v.length === 5 ? [...v.slice(1, 4)].map((c) => c + c).join('') : v.slice(1, 7);
    if (!/^[0-9a-f]{6}$/.test(hex)) return null;
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const nums = v.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [];
  if (v.startsWith('color(srgb') && nums.length >= 3) return nums.slice(0, 3).map((n) => Math.round(Math.min(1, Math.max(0, n)) * 255));
  if (v.startsWith('rgb') && nums.length >= 3) return nums.slice(0, 3).map((n) => Math.round(n));
  return null;
}

// One probe per scope: a scene inside a `.dark-scope` island (or any element
// that sets its own tokens) reads the colours it's actually drawn in.
const probes = new WeakMap();
let pixel = null;
function probeEl(scope) {
  const host = scope?.isConnected ? scope : document.body;
  let probe = probes.get(host);
  if (probe?.isConnected) return probe;
  probe = document.createElement('i');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  host.appendChild(probe);
  probes.set(host, probe);
  return probe;
}

// Anything the probe can't hand back as sRGB (oklch, lab, a colour space the
// parser doesn't know) is painted on a 1×1 canvas and read back.
function viaCanvas(css) {
  try {
    pixel ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!pixel) return null;
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = '#000';
    pixel.fillStyle = css;
    pixel.fillRect(0, 0, 1, 1);
    const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  } catch {
    return null;
  }
}

function resolve(token, scope) {
  const el = probeEl(scope);
  el.style.color = `var(${token})`;
  const css = getComputedStyle(el).color;
  return parseColor(css) ?? viaCanvas(css);
}

// { accent, text, …: [r, g, b], dark, theme }, as seen inside `scope`
// (default: the page)
export function readTheme(scope) {
  if (typeof document === 'undefined') return { ...FALLBACK, dark: false, theme: 'aws' };
  const out = {};
  for (const [key, token] of Object.entries(TOKENS)) out[key] = resolve(token, scope) ?? FALLBACK[key];
  const root = document.documentElement;
  out.dark = root.dataset.mode === 'dark' || !!scope?.closest?.('.dark-scope');
  out.theme = root.dataset.theme || 'aws';
  return out;
}

// Calls `cb(readTheme(scope))` whenever <html>'s theme, mode or custom
// colour changes the colours seen in `scope` (at most once a frame).
// Returns the unsubscribe.
const listeners = new Map(); // cb → { scope, last }
let observer = null;
let queued = 0;

function flush() {
  queued = 0;
  for (const [cb, entry] of listeners) {
    const colors = readTheme(entry.scope);
    const key = JSON.stringify(colors);
    if (key === entry.last) continue;
    entry.last = key;
    cb(colors);
  }
}

export function watchTheme(cb, scope) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  listeners.set(cb, { scope, last: JSON.stringify(readTheme(scope)) });
  if (!observer) {
    observer = new MutationObserver(() => {
      queued ||= requestAnimationFrame(flush);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode', 'style'] });
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      observer?.disconnect();
      observer = null;
      cancelAnimationFrame(queued);
      queued = 0;
    }
  };
}

// Mix two [r, g, b] colours: t = 0 is a, 1 is b.
export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
