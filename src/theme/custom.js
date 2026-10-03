// The visitor's own colour. Whatever they pick, the text drawn in it and on
// it stays readable: links are darkened until they reach 4.5:1 on the light
// page, the dark-mode accent is lightened until it does on the dark one, and
// button labels go black or white, whichever reads better on the colour.

export const CUSTOM_KEY = 'tp-custom-color';
export const CUSTOM_DEFAULT = '#7c3aed';
export const CUSTOM_PRESETS = [
  ['#7c3aed', 'Violet'],
  ['#0ea5e9', 'Sky'],
  ['#16a34a', 'Green'],
  ['#e11d48', 'Rose'],
  ['#f59e0b', 'Amber'],
  ['#14b8a6', 'Teal'],
  ['#db2777', 'Pink'],
  ['#4f46e5', 'Indigo'],
];

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
// mix toward black (t < 0) or white (t > 0)
const shade = (hex, t) => {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.map((v) => (t < 0 ? v * (1 + t) : v + (255 - v) * t)));
};
const until = (hex, against, dir) => {
  for (let i = 0; i <= 20; i++) {
    const c = shade(hex, dir * i * 0.05);
    if (contrast(c, against) >= 4.5) return c;
  }
  return dir < 0 ? '#000000' : '#ffffff';
};

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function customTokens(hex) {
  const c = isHex(hex) ? hex.toLowerCase() : CUSTOM_DEFAULT;
  return {
    '--custom-accent': c,
    '--custom-accent-text': until(c, '#fdfdfc', -1),
    '--custom-btn-ink': contrast(c, '#ffffff') >= contrast(c, '#0b0b0b') ? '#ffffff' : '#0b0b0b',
    '--custom-saber': until(c, '#121215', 1),
    '--custom-soft': shade(c, 0.86),
  };
}
