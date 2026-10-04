// A plucked string with a jawari bridge, modelled: the string's length
// shortens while it presses on the curved bridge, which moves energy into the
// overtones the way the real bridge does (the tanpura's shimmer, the sitar's
// buzz). Used where a recording can't be: the tanpura's fallback and the
// sitar's sympathetic strings. Returns the samples, normalised.

export function jawariString(sr, freq, seconds, seed) {
  const n = Math.floor(sr * seconds);
  const y = new Float32Array(n);
  const period = sr / freq;
  const len = Math.ceil(period);
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
  // the string's shape as it is released by the fingertip: a soft triangle
  const at = 0.15;
  for (let i = 0; i < len + 2; i++) {
    const u = (i % len) / len;
    y[i] = (u < at ? u / at : (1 - u) / (1 - at)) - 0.5 + 0.05 * rand();
  }
  let a0 = 0;
  for (let i = 0; i < len + 2; i++) a0 = Math.max(a0, Math.abs(y[i]));
  const loss = Math.pow(10, -3 / (10 * freq)); // T60 of ten seconds
  const m = 0.2; // how much the bridge shortens the string
  const bright = 0.05;
  let dc = 0;
  for (let i = len + 2; i < n; i++) {
    const press = Math.max(0, y[i - 1] - dc) / a0;
    const pos = i - period * (1 - m * press);
    const k = Math.floor(pos);
    if (k < 1) continue;
    const f = pos - k;
    const a = y[k] * (1 - f) + y[k + 1] * f;
    const b = y[k - 1] * (1 - f) + y[k] * f;
    const v = loss * ((1 - bright) * a + bright * b);
    dc = dc * 0.9995 + v * 0.0005;
    y[i] = v;
  }
  // remove what DC is left, normalise, and fade the tail so the buffer ends silently
  let h = 0;
  let pk = 0;
  for (let i = 0; i < n; i++) {
    h = h * 0.999 + y[i] * 0.001;
    y[i] -= h;
    pk = Math.max(pk, Math.abs(y[i]));
  }
  const fade = Math.floor(sr * 1.2);
  for (let i = 0; i < n; i++) {
    const tail = i > n - fade ? (n - i) / fade : 1;
    y[i] = (y[i] / (pk || 1)) * tail;
  }
  return y;
}
