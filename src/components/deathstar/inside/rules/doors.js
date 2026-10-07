// The station’s doors as state: how open each leaf is, whether it wants
// to be, and who it opens for. A sliding door opens when someone it lets
// through comes within 2.2 m and shuts when nobody is left; an Imperial-
// only lock (`side:imperial`) lets through Imperials and anyone passing for
// one. A blast door works the same until a lockdown takes the section on
// either side of it: then it seals, for everyone, until the lockdown
// lifts. An arch is a doorway with no leaf, so it never closes. The walker
// asks `passable` before it lets a body through a doorway, and treats a
// shut one as wall; `clearDoorway` makes sure nobody is inside that wall
// when it shuts. Pure.
//
//   createDoors(layout) → doors      { [id]: { open: 0…1, want, sealed, locked, denied } }
//     denied: someone the door won’t open for is at it now (so “denied” is said once a visit)
//   stepDoors(doors, layout, dt, { near: [{ x, z, y?, side, disguised }], lockdown: Set<section> }) → events
//     events: [{ type: 'open' | 'close' | 'seal' | 'unseal' | 'denied', door }]; a seal shuts its door, so it brings no 'close'
//   passable(doors, id) → bool       open ≥ 0.8
//   clearDoorway(doors, layout, bodies: [{ x, z, r, y?, h? }]) → void
//     a door too shut to pass pushes anyone in its doorway straight out to the side of the wall their
//     centre is on (south or east when dead on the line), clear of the leaf; run it after stepDoors
//     and before the walker, which would otherwise find them inside a wall

const OPENS = 0.45; // seconds from shut to open, and back
const REACH = 2.2; // how near someone must come for a door to open
const PASS = 0.8; // how open a leaf must be to walk through
const LEAF = 0.05; // half a leaf’s thickness: a body pushed out ends this far past its radius
const SPARE = 0.01; // and a hair more, so rounding never leaves it touching
// The walker holds a body pressed against a shut door at its radius from
// the line; only one nearer than this is in the doorway, so pressing on a
// door doesn’t jostle you back and forth.
const SNUG = 0.01;
const TALL = 1.8; // a body’s height when it doesn’t say

export function createDoors(layout) {
  const doors = {};
  for (const door of layout.doors.values()) {
    const arch = door.kind === 'arch';
    doors[door.id] = { open: arch ? 1 : 0, want: arch, sealed: false, locked: !arch && door.lock !== undefined, denied: false };
  }
  return doors;
}

// Whether a door opens for someone: a sealed one for nobody; a door no
// lock holds for anyone; an Imperial-only one for Imperials and the
// disguised.
function mayPass(door, state, p) {
  if (state.sealed) return false;
  if (!state.locked) return true;
  return door.lock === 'side:imperial' && (p.side === 'imperial' || !!p.disguised);
}

const within = (door, p) => Math.hypot(p.x - door.x, p.z - door.z) <= REACH;

export function stepDoors(doors, layout, dt, { near = [], lockdown = new Set() } = {}) {
  const events = [];
  for (const door of layout.doors.values()) {
    const s = doors[door.id];
    if (!s || door.kind === 'arch') continue;
    if (door.kind === 'blast') {
      const seal = [door.a, door.b].some((id) => lockdown.has(layout.rooms.get(id)?.section));
      if (seal !== s.sealed) events.push({ type: seal ? 'seal' : 'unseal', door: door.id });
      s.sealed = seal;
    }
    let allowed = false;
    let refused = false;
    for (const p of near) {
      if (!within(door, p)) continue;
      if (mayPass(door, s, p)) allowed = true;
      else refused = true;
    }
    const want = allowed && !s.sealed;
    if (want && !s.want) events.push({ type: 'open', door: door.id });
    if (!want && s.want && !s.sealed) events.push({ type: 'close', door: door.id });
    s.want = want;
    const denied = refused && !want;
    if (denied && !s.denied) events.push({ type: 'denied', door: door.id });
    s.denied = denied;
    s.open = want ? Math.min(1, s.open + dt / OPENS) : Math.max(0, s.open - dt / OPENS);
  }
  return events;
}

export const passable = (doors, id) => (doors[id]?.open ?? 0) >= PASS;

export function clearDoorway(doors, layout, bodies) {
  for (const door of layout.doors.values()) {
    if (passable(doors, door.id)) continue;
    // `across` is the coordinate that crosses the wall, `along` the one that runs with it
    const [along, across] = door.axis === 'x' ? ['x', 'z'] : ['z', 'x'];
    for (const b of bodies) {
      // a body wholly over or under the doorway meets the wall there, which is the walker’s
      if (b.y !== undefined && (b.y >= door.y + door.h || b.y + (b.h ?? TALL) <= door.y)) continue;
      const off = b[across] - door[across];
      const past = Math.max(0, Math.abs(b[along] - door[along]) - door.w / 2);
      if (Math.hypot(off, past) >= b.r - SNUG) continue;
      b[across] = door[across] + (off < 0 ? -1 : 1) * (b.r + LEAF + SPARE);
    }
  }
}
