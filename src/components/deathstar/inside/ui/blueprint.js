// The station’s blueprint as the map draws it: the rooms you have seen on
// the deck you are on, seen from above with north up, and the doorways in
// their walls. The game keeps which rooms you have seen (the save’s `seen`);
// this only picks and shapes them from the layout, so the map is plain SVG
// and this is tested in Node. Pure.
//
//   blueprint(layout, { seen, here }) → { rooms, doors, bounds }
//     rooms: [{ id, name, kind, x0, z0, x1, z1, round, here }]   a room nested in another comes after it
//     doors: [{ id, kind, x0, z0, x1, z1 }]   each doorway of a room drawn, as a line across its wall
//     bounds: { x0, z0, x1, z1 } round everything drawn with a margin, or null when nothing is

// Levels are 12 m apart; a room whose floor is within this of yours is on
// your sheet, so a control room 6 m up over its bay is drawn with it.
const SHEET = 9;
const MARGIN = 4; // metres of blank round the rooms, so a wall never touches the frame

function depthOf(layout, room) {
  let n = 0;
  for (let r = room; r?.inside !== undefined && n <= layout.rooms.size; r = layout.rooms.get(r.inside)) n++;
  return n;
}

export function blueprint(layout, { seen = [], here = null } = {}) {
  const at = layout.rooms.get(here) ?? null;
  const wanted = new Set(seen);
  if (at) wanted.add(at.id);
  const level = at?.y ?? null;
  const rooms = [...wanted]
    .map((id) => layout.rooms.get(id))
    .filter((r) => r && (level === null || Math.abs(r.y - level) < SHEET))
    .sort((a, b) => depthOf(layout, a) - depthOf(layout, b))
    .map((r) => ({ id: r.id, name: r.name, kind: r.kind, ...r.box, round: Boolean(r.round), here: r.id === here }));
  if (!rooms.length) return { rooms: [], doors: [], bounds: null };

  const drawn = new Set(rooms.map((r) => r.id));
  const doors = [];
  for (const d of layout.doors.values()) {
    if (!drawn.has(d.a) && !drawn.has(d.b)) continue;
    const half = d.w / 2;
    const [x0, x1, z0, z1] = d.axis === 'x' ? [d.x - half, d.x + half, d.z, d.z] : [d.x, d.x, d.z - half, d.z + half];
    doors.push({ id: d.id, kind: d.kind, x0, z0, x1, z1 });
  }

  const bounds = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const r of rooms) {
    bounds.x0 = Math.min(bounds.x0, r.x0 - MARGIN);
    bounds.z0 = Math.min(bounds.z0, r.z0 - MARGIN);
    bounds.x1 = Math.max(bounds.x1, r.x1 + MARGIN);
    bounds.z1 = Math.max(bounds.z1, r.z1 + MARGIN);
  }
  return { rooms, doors, bounds };
}
