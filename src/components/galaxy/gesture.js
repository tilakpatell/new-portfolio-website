// The galaxy map's hands (useMapView.js): a press that moves less than
// DRAG px is a click on what's under it; one that moves more is a pan (by
// the share of the box it moved) and the click it ends in is swallowed;
// two fingers are a pinch, zoomed by how far apart they've gone, about
// where they started between them. Pure: the hook feeds it pointer events.
export const DRAG = 5;

export function createGesture() {
  const ptrs = new Map(); // id → { x, y }
  let press = null; // { x, y }
  let pinch = null; // { d, u, w }
  let dragging = false;
  let swallow = false;
  return {
    down(id, x, y, rect) {
      ptrs.set(id, { x, y });
      if (ptrs.size === 1) {
        press = { x, y };
        dragging = false;
        swallow = false;
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, u: ((a.x + b.x) / 2 - rect.left) / rect.width, w: ((a.y + b.y) / 2 - rect.top) / rect.height };
        swallow = true;
      }
    },
    move(id, x, y, rect) {
      const p = ptrs.get(id);
      if (!p) return null;
      const dx = x - p.x;
      const dy = y - p.y;
      p.x = x;
      p.y = y;
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const f = d / pinch.d;
        pinch.d = d;
        return { zoom: f, u: pinch.u, w: pinch.w };
      }
      if (!press) return null;
      if (!dragging && Math.hypot(x - press.x, y - press.y) < DRAG) return null;
      if (!dragging) {
        dragging = true;
        swallow = true;
        // (the first move past DRAG pans by all of it, from the press)
        return { pan: [(x - press.x) / rect.width, (y - press.y) / rect.height] };
      }
      return { pan: [dx / rect.width, dy / rect.height] };
    },
    up(id) {
      ptrs.delete(id);
      if (ptrs.size < 2) pinch = null;
      if (!ptrs.size) press = null;
      // (the finger left after a pinch pans from where it is now, not from its first press)
      else if (ptrs.size === 1) press = { ...[...ptrs.values()][0] };
    },
    cancel(id) {
      ptrs.delete(id);
      pinch = null;
      press = null;
      dragging = false;
    },
    takeClick() {
      const s = swallow;
      swallow = false;
      return s;
    },
    get dragging() {
      return dragging;
    },
  };
}
