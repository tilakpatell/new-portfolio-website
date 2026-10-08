// The first Death Star’s rooms (0 BBY, A New Hope), as data for
// layout.js: rooms, the doors between them, the lift, where each side
// starts and the named spots stories and brains use. This phase holds the
// way in, Docking Bay 327 and the rooms round it; Phase 3 adds the rest.
//
//   DS1 → { id, name, era, sections, rooms, doors, lifts, starts, spots }
//
// Metres, +x east, +z south, +y up. The bay’s deck is Level 2 at y 0;
// levels are 12 m apart and numbered downwards into the station, so
// Level 5 (the detention block) is at y −36 and Level 6 (the core shaft
// and the tractor beam) at y −48. The bay opens south onto space.

// A run of floor boxes (room-relative), each `rise` above the last (a
// negative rise steps down), so the walker takes it a step at a time (its
// step is 0.4 m).
function flight({ x, z, along, tread, width, rise, count, from = 0 }) {
  return Array.from({ length: count }, (_, k) => {
    const at = (k + 0.5) * tread;
    const y = from + rise * (k + 1);
    return along === 'x' ? { x: x + at, z, w: tread, d: width, y } : { x, z: z + at, w: width, d: tread, y };
  });
}

// The Falcon (34.75 m long, about 25 m wide) stands north of the bay’s
// centre with her nose to the field, her deck 1.6 m up; the ramp drops
// from the hold’s hatch to the deck in seven 0.2 m steps.
const FALCON = { x: -8, z: -2, deck: 1.6 };
const HOLD = { x: -12, z: -8, w: 6, d: 4 };
const RAMP = flight({ x: HOLD.x, z: HOLD.z + HOLD.d / 2, along: 'z', tread: 0.8, width: 2, rise: -0.2, count: 7, from: FALCON.deck });

// Docking Control 327 sits 6 m up behind the bay’s north wall; a stair
// against that wall climbs east from the deck (twenty 0.3 m steps) to a
// landing at its door.
const CONTROL = { x: 22, z: -27.5, y: 6 };
const STAIR = flight({ x: 12, z: -22.8, along: 'x', tread: 0.4, width: 2.4, rise: 0.3, count: 20 });
const LANDING = { x: CONTROL.x, z: -22.8, w: 4, d: 2.4, y: CONTROL.y };

export const DS1 = {
  id: 'ds1',
  name: 'The Death Star',
  era: 'anh',
  sections: {
    bay327: 'Docking Bay 327',
    level2: 'Level 2',
    level5: 'Level 5',
    level6: 'Level 6',
  },
  rooms: [
    { id: 'hold', kind: 'ship', name: 'Smuggling hold', section: 'bay327', inside: 'bay327', ...HOLD, y: FALCON.deck, h: 2, dark: true },
    {
      id: 'bay327',
      kind: 'hangar',
      name: 'Docking Bay 327',
      section: 'bay327',
      x: 0,
      z: 0,
      w: 64,
      d: 48,
      y: 0,
      h: 26,
      floors: [{ x: 0, z: 0, w: 64, d: 48, y: 0 }, ...RAMP, ...STAIR, LANDING],
    },
    // the strip beyond the bay’s mouth: space, so nothing to stand on
    { id: 'field327', kind: 'field', name: 'Magnetic field', section: 'bay327', x: 0, z: 26, w: 64, d: 4, y: 0, h: 26, floors: [] },
    { id: 'ctl327', kind: 'control', name: 'Docking Control 327', section: 'bay327', ...CONTROL, w: 10, d: 7, h: 3 },
    { id: 'corr327', kind: 'corridor', name: 'Bay 327 access corridor', section: 'level2', x: 10, z: -32, w: 3.2, d: 16, y: 0, h: 3.2 },
    { id: 'lobby1', kind: 'lobby', name: 'Lift lobby, Level 2', section: 'level2', x: 10, z: -44, w: 10, d: 8, y: 0, h: 4 },
    { id: 'ring2', kind: 'corridor', name: 'Level 2 ring corridor', section: 'level2', x: -4.5, z: -44, w: 19, d: 3.2, y: 0, h: 3.2 },
    // The lift’s landings are rooms of their own, each by its own lobby;
    // a ride moves whoever is in the car from one to the next.
    { id: 'lift1-l2', kind: 'lift', name: 'Lift 1, Level 2', section: 'level2', x: 10, z: -49.5, w: 3, d: 3, y: 0, h: 3 },
    { id: 'lift1-l5', kind: 'lift', name: 'Lift 1, Level 5', section: 'level5', x: 40, z: -90, w: 3, d: 3, y: -36, h: 3 },
    { id: 'lift1-l6', kind: 'lift', name: 'Lift 1, Level 6', section: 'level6', x: -40, z: -110, w: 3, d: 3, y: -48, h: 3 },
  ],
  doors: [
    // shut until the story (or free roam) lowers the ramp
    { id: 'hold-hatch', a: 'hold', b: 'bay327', x: HOLD.x, z: HOLD.z + HOLD.d / 2, axis: 'x', w: 1.6, h: 1.9, kind: 'hatch', lock: 'flag:ramp' },
    // the magnetic field: open to look through and fall through
    { id: 'bay327-field', a: 'bay327', b: 'field327', x: 0, z: 24, axis: 'x', w: 56, h: 20, kind: 'arch' },
    // low enough for a trooper to knock his helmet on
    { id: 'bay327-ctl', a: 'bay327', b: 'ctl327', x: CONTROL.x, z: -24, axis: 'x', w: 1.4, h: 2, kind: 'slide' },
    { id: 'bay327-corr', a: 'bay327', b: 'corr327', x: 10, z: -24, axis: 'x', w: 2.4, h: 2.6, kind: 'blast', lock: 'side:imperial' },
    { id: 'corr327-lobby1', a: 'corr327', b: 'lobby1', x: 10, z: -40, axis: 'x', w: 2.4, h: 2.6, kind: 'slide' },
    { id: 'lobby1-lift', a: 'lobby1', b: 'lift1-l2', x: 10, z: -48, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    { id: 'lobby1-ring2', a: 'lobby1', b: 'ring2', x: 5, z: -44, axis: 'z', w: 2.4, h: 2.6, kind: 'slide' },
  ],
  lifts: [{ id: 'lift1', stops: ['lift1-l2', 'lift1-l5', 'lift1-l6'] }],
  starts: {
    rebel: { room: 'hold', x: HOLD.x, z: HOLD.z - 1, yaw: Math.PI },
    // on the deck by the foot of the control room’s stair, facing the corridor door
    imperial: { room: 'bay327', x: 10, z: -19.5, yaw: 0 },
  },
  spots: {
    falcon: { room: 'bay327', x: FALCON.x, z: FALCON.z, yaw: Math.PI },
    ramp: { room: 'bay327', x: HOLD.x, z: 0.6, yaw: 0 },
    stairs327: { room: 'bay327', x: 11.4, z: -22.8, yaw: Math.PI / 2 },
    window327: { room: 'ctl327', x: 20, z: -24.8, yaw: Math.PI },
    scomp327: { room: 'ctl327', x: 25, z: -30.4, yaw: 0 },
    lift1: { room: 'lobby1', x: 10, z: -46.6, yaw: 0 },
  },
};
