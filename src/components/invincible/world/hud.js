// Where the Invincible world's HUD puts things: rules only (./InvHud.jsx
// and ./InvWorld.jsx draw them), so that what overlapped before can't. The
// compass strip shows `span` of the heading round him; its labels keep
// `gap` px apart, stacking on a second row when they'd touch, and none is
// drawn in the `reserve` px at the strip's right end that the menu's
// buttons sit over. The title shrinks to a chip once he's flying. The
// objective line says how far, and the marker over a target never shrinks
// past being seen.

export const COMPASS = { span: Math.PI * 0.9, gap: 72, reserve: 220, markerMin: 24, markerMax: 72, fov: 64 };

// marks: [{ id, label, bearing }] nearest first, bearing in radians from
// straight ahead (+ to the right) → [{ id, label, x, row, clipped, side }]:
// x px along the strip; side 'left' or 'right' when it's off that end (x
// at the end) or under the buttons, 'crowd' when both rows are full there.
// `taken`: x of what's already on the first row (the headings, a letter
// each), which a name keeps half a gap clear of.
export function layoutCompass(marks, width, { span = COMPASS.span, gap = COMPASS.gap, reserve = COMPASS.reserve, taken = [] } = {}) {
  const rows = [[], []];
  const fixed = taken.map((x) => ({ x, gap: gap / 2 }));
  return marks.map((m) => {
    const x = width / 2 + (m.bearing / span) * width;
    const out = { id: m.id, label: m.label, x, row: 0, clipped: false, side: null };
    if (x < 0) return { ...out, x: 0, clipped: true, side: 'left' };
    if (x > width) return { ...out, x: width, clipped: true, side: 'right' };
    // (the buttons' corner: the menu sits over the strip's right end when the stage is narrow)
    if (reserve > 0 && reserve < width && x > width - reserve) return { ...out, clipped: true, side: 'right' };
    const clear = (r, i) => r.every((p) => Math.abs(p - x) >= gap) && (i > 0 || fixed.every((f) => Math.abs(f.x - x) >= f.gap));
    const row = rows.findIndex(clear);
    if (row < 0) return { ...out, clipped: true, side: 'crowd' };
    rows[row].push(x);
    return { ...out, row };
  });
}

// 'full' (the eyebrow and FLY, MARK.) until 2.5 s after he first moves, or
// at once when a mission starts: then 'chip', out of the compass's way.
export const titleMode = (t, movedAt, missionOn) => (missionOn || (movedAt != null && t - movedAt >= 2.5) ? 'chip' : 'full');

const far = (d) => (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);

// The objective line: the step's words and how far it is.
export function objectiveText(step, dist) {
  if (!step) return '';
  const parts = [step.text, dist == null || !Number.isFinite(dist) ? null : far(dist)].filter(Boolean);
  return parts.join(' · ');
}

// The marker's size on screen (px) for a target `dist` m off on a canvas
// `height` px tall: a 6 m chevron as the camera sees it, at least markerMin.
export function markerSize(dist, height, { min = COMPASS.markerMin, max = COMPASS.markerMax, fov = COMPASS.fov } = {}) {
  const px = (6 / (2 * Math.max(0.1, dist) * Math.tan((fov * Math.PI) / 360))) * height;
  return Math.round(Math.min(max, Math.max(min, px)));
}
