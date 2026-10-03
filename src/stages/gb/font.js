// Shared bits for the Game Boy games: screen size, a 3×5 pixel font and palettes.
export const W = 160;
export const H = 144;

const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '-': '000000111000000', x: '000101010101000', '.': '000000000000010', '!': '010010010000010',
  ':': '000010000010000', '?': '110001010000010', '>': '100010001010100', '<': '001010100010001', '/': '001001010100100',
  "'": '010010000000000', ',': '000000000010100', ' ': '000000000000000',
};

export function text(ctx, str, x, y, color, s = 1, shadow = null) {
  if (shadow) text(ctx, str, x + s, y + s, shadow, s);
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of String(str)) {
    const g = FONT[ch] || FONT[ch.toUpperCase()] || FONT[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
    cx += 4 * s;
  }
}

export const textWidth = (str, s = 1) => String(str).length * 4 * s - s;
export const centerText = (ctx, str, y, color, s = 1, shadow = null) => text(ctx, str, Math.round((W - textWidth(str, s)) / 2), y, color, s, shadow);

export const DMG = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f']; // lightest → darkest

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
