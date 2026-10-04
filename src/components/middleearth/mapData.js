// Middle-earth's map, as data: what the drawn map (./Map.jsx) and the painted
// one behind the page (./mapPaint.js) both draw from. Everything is placed on
// an 800×560 sheet.

export const SHEET = { w: 800, h: 560 };

export const PLACES = [
  ['The Grey Havens', 92, 200],
  ['Isengard', 378, 362],
  ['Edoras', 418, 410],
  ['Helm’s Deep', 380, 398],
  ['Minas Tirith', 520, 444],
  ['Osgiliath', 548, 436],
  ['Barad-dûr', 712, 392],
  ['Erebor', 590, 62],
  ['Dol Guldur', 520, 252],
];

export const REGIONS = [
  ['ERIADOR', 230, 120],
  ['THE SHIRE', 168, 222],
  ['RHOVANION', 620, 170],
  ['ROHAN', 452, 384],
  ['GONDOR', 470, 492],
  ['MORDOR', 680, 470],
];

// the sea to the west and the bay in the south
export const SEAS = ['M0 0 H118 C108 78 66 118 98 170 C128 218 58 262 80 330 C100 398 40 462 62 560 H0 Z', 'M350 560 C372 524 424 504 468 520 C498 532 516 560 516 560 Z'];

// the Anduin from the north to the sea, the Brandywine, the Isen: [path, thin]
export const RIVERS = [
  ['M470 50 C478 110 462 180 472 240 C482 290 476 330 488 360 C500 400 476 440 470 470 C462 500 444 512 430 524', false],
  ['M210 120 C216 170 206 214 222 250 C232 280 218 320 228 360', true],
  ['M372 360 C366 392 360 420 342 452', true],
];

// the Misty Mountains, the White Mountains, the Grey Mountains, and Mordor's
// walls: [x0, y0, x1, y1, dark]
export const RANGES = [
  [372, 52, 396, 334, false],
  [334, 432, 512, 432, false],
  [400, 36, 566, 36, false],
  [586, 362, 772, 362, true],
  [578, 384, 578, 520, true],
  [586, 520, 770, 520, true],
];

// the Old Forest, Lothlórien, Fangorn, Mirkwood: [cx, cy, rx, ry, seed, count, kind]
export const FORESTS = [
  [282, 222, 18, 12, 7, 18, ''],
  [440, 282, 20, 16, 11, 26, 'gold'],
  [412, 334, 22, 14, 13, 26, ''],
  [540, 160, 52, 92, 17, 120, 'dark'],
];

// the little peaks along a line: [x, y, size]
export function peaks(x0, y0, x1, y1, every = 13, size = 9) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / every));
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n + (i % 2 ? 3 : -3), y0 + ((y1 - y0) * i) / n, size]);
}

// a run of little peaks along a line, as a path
export function range(x0, y0, x1, y1, every = 13, size = 9) {
  return peaks(x0, y0, x1, y1, every, size)
    .map(([x, y]) => `M${x - size / 2} ${y + size / 3} L${x} ${y - size / 2} L${x + size / 2} ${y + size / 3} `)
    .join('');
}

// a patch of trees: [x, y, r]
export function wood(cx, cy, rx, ry, seed, count = 40) {
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 3 + r() * 2.5];
  });
}
