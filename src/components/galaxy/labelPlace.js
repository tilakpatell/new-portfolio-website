// Where each system's name goes on the galaxy map (HoloMap.jsx), so none
// covers another or a dot: eight places round its dot, right first, then
// left, above, below and the corners; the names placed in priority order
// (where you are, the one picked, a battle on, the major order, the rest),
// each taking the place that overlaps least with the names already down,
// every other dot, the `blocks` (boxes { x0, y0, x1, y1 } of the controls drawn
// over the map: they cover a name as a dot does) and the box's edge. In screen pixels, at the map's zoom
// (the names keep their size while the map scales, so zoomed in they part).

export const PLACES = ['r', 'l', 't', 'b', 'tr', 'br', 'tl', 'bl'];
export const GAP = 9; // (the dot's radius, 7, and 2 more)
export const DOT = 7;

export function boxAt(place, x, y, w, h) {
  const c = GAP * 0.6;
  switch (place) {
    case 'l':
      return { x0: x - GAP - w, y0: y - h / 2, x1: x - GAP, y1: y + h / 2 };
    case 't':
      return { x0: x - w / 2, y0: y - GAP - h, x1: x + w / 2, y1: y - GAP };
    case 'b':
      return { x0: x - w / 2, y0: y + GAP, x1: x + w / 2, y1: y + GAP + h };
    case 'tr':
      return { x0: x + c, y0: y - c - h, x1: x + c + w, y1: y - c };
    case 'br':
      return { x0: x + c, y0: y + c, x1: x + c + w, y1: y + c + h };
    case 'tl':
      return { x0: x - c - w, y0: y - c - h, x1: x - c, y1: y - c };
    case 'bl':
      return { x0: x - c - w, y0: y + c, x1: x - c, y1: y + c + h };
    default:
      return { x0: x + GAP, y0: y - h / 2, x1: x + GAP + w, y1: y + h / 2 };
  }
}

const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const outside = (b, o) => (b.x1 - b.x0) * (b.y1 - b.y0) - area(b, o);

// a name's width before it's been measured: its letters at the map's size, and its marks
export const estimateWidth = (name, fontPx = 12.5, extras = 0) => Math.ceil(name.length * fontPx * 0.58 + 8 + extras);

// how much the boxes overlap, all pairs (for the tests and the check)
export function overlapArea(boxes) {
  let n = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) n += area(boxes[i], boxes[j]);
  return n;
}

export function placeLabels(items, { dot = DOT, bounds = null, blocks = [] } = {}) {
  const order = [...items].sort((a, b) => b.prio - a.prio || (a.id < b.id ? -1 : 1));
  const dots = items.map((i) => ({ id: i.id, x0: i.x - dot, y0: i.y - dot, x1: i.x + dot, y1: i.y + dot }));
  const placed = [];
  const out = {};
  for (const it of order) {
    let best = null;
    let cost = Infinity;
    PLACES.forEach((p, n) => {
      const b = boxAt(p, it.x, it.y, it.w, it.h);
      let c = n * 0.5; // (a tie keeps the earlier place: right, as the map always had it)
      for (const q of placed) c += area(b, q) * 10;
      for (const d of dots) if (d.id !== it.id) c += area(b, d) * 10;
      for (const k of blocks) c += area(b, k) * 10; // (a control that stays put over the map covers a name as a dot does)
      if (bounds) c += outside(b, bounds) * 10; // (a name cut off by the edge is as lost as one under another)
      if (c < cost) {
        cost = c;
        best = { p, b };
      }
    });
    out[it.id] = best.p;
    placed.push(best.b);
  }
  return out;
}
