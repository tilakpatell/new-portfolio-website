// The station’s doors as state: how open each leaf is, whether it wants
// to be, and who it opens for. A sliding door opens when someone it lets
// through comes within 2.2 m and shuts when nobody is left; an Imperial-
// only lock (`side:imperial`) lets through Imperials and anyone passing for
// one. The walker asks `passable` before it lets a body through a doorway.
// Pure.
//
//   createDoors(layout) → doors      { [id]: { open: 0…1, want, sealed, locked, denied } }
//     denied: someone the door won’t open for is at it now (so “denied” is said once a visit)
//   stepDoors(doors, layout, dt, { near: [{ x, z, y?, side, disguised }] }) → events
//     events: [{ type: 'open' | 'close' | 'denied', door }]
//   passable(doors, id) → bool       open ≥ 0.8

const OPENS = 0.45; // seconds from shut to open, and back
const REACH = 2.2; // how near someone must come for a door to open
const PASS = 0.8; // how open a leaf must be to walk through

export function createDoors(layout) {
  const doors = {};
  for (const door of layout.doors.values()) doors[door.id] = { open: 0, want: false, sealed: false, locked: door.lock !== undefined, denied: false };
  return doors;
}

// Whether a door opens for someone: a door no lock holds opens for anyone;
// an Imperial-only one for Imperials and the disguised.
function mayPass(door, state, p) {
  if (!state.locked) return true;
  return door.lock === 'side:imperial' && (p.side === 'imperial' || !!p.disguised);
}

const within = (door, p) => Math.hypot(p.x - door.x, p.z - door.z) <= REACH;

export function stepDoors(doors, layout, dt, { near = [] } = {}) {
  const events = [];
  for (const door of layout.doors.values()) {
    const s = doors[door.id];
    if (!s) continue;
    let allowed = false;
    let refused = false;
    for (const p of near) {
      if (!within(door, p)) continue;
      if (mayPass(door, s, p)) allowed = true;
      else refused = true;
    }
    const want = allowed;
    if (want !== s.want) events.push({ type: want ? 'open' : 'close', door: door.id });
    s.want = want;
    const denied = refused && !want;
    if (denied && !s.denied) events.push({ type: 'denied', door: door.id });
    s.denied = denied;
    s.open = want ? Math.min(1, s.open + dt / OPENS) : Math.max(0, s.open - dt / OPENS);
  }
  return events;
}

export const passable = (doors, id) => (doors[id]?.open ?? 0) >= PASS;
