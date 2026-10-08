// A HUD's own canvas (a minimap, a compass strip) with as many pixels as the
// screen has under it, so it's sharp on a 2× screen and when a phone shows
// it smaller. Returns the box to draw in: CSS pixels (no `unit`), or `unit`
// across its width, the drawing's own coordinates at any size (a 150-unit
// map stays a 150-unit map); `s` is what to scale by (setTransform(s, 0, 0,
// s, 0, 0)). Null while it isn't shown. Grown from the Invincible world's.
export function fitCanvas(c, unit = null, ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1) {
  const w = c?.clientWidth;
  const h = c?.clientHeight;
  if (!w || !h) return null;
  const k = Math.min(3, ratio);
  const bw = Math.round(w * k);
  const bh = Math.round(h * k);
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  return unit ? { w: unit, h: (h * unit) / w, s: bw / unit } : { w, h, s: bw / w };
}
