// The way shown on the screen, worked out for ui/Marker.jsx (waymark.js, apart from Marker.jsx: a disk that ignores case can't tell marker.js from Marker.jsx's import): a diamond over
// the next door, lift or the story's target, with how far the whole way
// is; past the screen's edge, or behind you, on the edge with an arrow
// round to it. Placed every frame from the world's 'marker' event straight
// onto the element (no render), since a marker that lagged the camera would
// swim.
//
//   markerStyle(m) → { hidden, left, top, turn, text, kind, off }   pure: m is the event's
//     ({ x, y, off, angle, kind, metres, goal } | null); left and top in % of the stage
//   placeMarker(el, m)   the element as markerStyle has it

const WHAT = { door: 'Door', lift: 'Lift', jump: 'Way on', goal: 'Objective' };

export function markerStyle(m) {
  if (!m) return { hidden: true };
  return {
    hidden: false,
    left: `${(((m.x + 1) / 2) * 100).toFixed(2)}%`,
    top: `${(((1 - m.y) / 2) * 100).toFixed(2)}%`,
    turn: m.off && Number.isFinite(m.angle) ? `${m.angle.toFixed(3)}rad` : '0rad',
    text: `${WHAT[m.kind] ?? 'Objective'} · ${Math.max(0, Math.round(m.metres ?? 0))} m`,
    kind: m.kind ?? 'goal',
    off: Boolean(m.off),
  };
}

export function placeMarker(el, m) {
  if (!el) return;
  const s = markerStyle(m);
  el.hidden = s.hidden;
  if (s.hidden) return;
  el.style.left = s.left;
  el.style.top = s.top;
  el.style.setProperty('--turn', s.turn);
  el.dataset.kind = s.kind;
  el.dataset.off = s.off ? 'true' : 'false';
  const label = el.querySelector('.ds-marker-text');
  if (label && label.textContent !== s.text) label.textContent = s.text;
}
