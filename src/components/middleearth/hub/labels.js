// Which places’ names show at the current zoom. Zoomed out, the road’s
// names would pile on one another, so a crowded zoom shows dots: going down
// the road in order, a name shows only when no name already shown is within
// `min` px of it on screen. The earlier place keeps its name, so the Shire
// is always named before Bree. `points` are screen positions, `on` false for
// a place whose name is off for another reason (it then hides nothing).
export function cullLabels(points, min = 72) {
  const shown = [];
  for (const p of points) {
    if (!p.on) continue;
    if (shown.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= min)) shown.push(p);
  }
  return new Set(shown.map((p) => p.id));
}
