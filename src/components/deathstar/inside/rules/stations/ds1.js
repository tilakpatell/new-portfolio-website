// The first Death Star’s rooms (0 BBY, A New Hope), as data for
// layout.js: rooms, the doors between them, the lifts, the jumps, where
// each side starts and the named spots stories and brains use. It holds
// every room both DS1 stories walk through, from Docking Bay 327 to the
// cell bay, the compactor, the chasm and the tractor beam’s terminal, and
// the officers’ deck that free roam opens.
//
//   DS1 → { id, name, era, sections, rooms, doors, lifts, jumps, starts, spots }
//
// Metres, +x east, +z south, +y up. The bay’s deck is Level 2 at y 0;
// levels are 12 m apart and numbered downwards into the station, so the
// officers’ deck is Level 1 at y +12, Level 5 (the detention block) is at
// y −36 and Level 6 (the core shaft, the tractor beam, the maintenance
// corridors, the compactor and the chasm) at y −48. The bay and the TIE
// launch bay beside it open south onto space. Lift 1 joins Levels 2, 5
// and 6; lift 2 the officers’ deck, Level 2 and the chasm’s far side.
//
// `restricted` marks a room a disguised Rebel draws doubt in; `dark` one
// lit only by its consoles. A floor tagged `bridge` is there only while
// the flag `bridge` is set (layout.offTags gives floorAt its `off`). A jump moves whoever
// uses it to a spot and never back: down the garbage chute, across the
// chasm on the grapple.

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

const L1 = 12;
const L5 = -36;
const L6 = -48;

// The cell bay runs north from AA-23 and bends west at its end, a curve
// drawn as two straight rooms. Cells 2180–2186 open off its east wall,
// 2187–2190 off the north wall past the bend; each is 3 m square.
const CELLBAY = { x: 60, z: -101, w: 4, d: 24 };
const BEND = { x: 50, z: -115, w: 24, d: 4 };
const CELLS = [
  ...Array.from({ length: 7 }, (_, k) => ({ n: 2180 + k, x: CELLBAY.x + CELLBAY.w / 2 + 1.5, z: CELLBAY.z + CELLBAY.d / 2 - 4.5 - 3 * k, wall: 'east' })),
  ...Array.from({ length: 4 }, (_, k) => ({ n: 2187 + k, x: BEND.x + BEND.w / 2 - 2.5 - 3 * k, z: BEND.z - BEND.d / 2 - 1.5, wall: 'north' })),
];

// Garbage compactor 3263827: 10 × 4 m and 4 m high. The water stands a
// metre deep over a floor 0.9 m under the walkway along its east end,
// with two 0.3 m steps of rubbish to climb out by; the hatch is in the
// north wall over the walkway.
const COMPACTOR = { x: 11, z: -106.4, w: 10, d: 4 };

// The chasm in the central core shaft: a 3 m ledge either side of a 12 m
// void, the bridge between them, and an upper ledge on the north wall 5 m
// up that a gantry stair climbs to from the maintenance corridor.
const CHASM = { x: 33.7, z: -99.6, w: 18, d: 8 };
const UPPER = 5;
const GANTRY = flight({ x: -5, z: 0, along: 'x', tread: 0.4, width: 3.2, rise: UPPER / 20, count: 20 });

// The tractor beam’s power terminal: a 1.2 m ledge from the Level 6
// corridor’s door out over a 20 m shaft to a 3 m platform at the controls.
const TRACTOR = { x: -24, z: -121.6, w: 20, d: 20 };

export const DS1 = {
  id: 'ds1',
  name: 'The Death Star',
  era: 'anh',
  sections: {
    bay327: 'Docking Bay 327',
    level2: 'Level 2',
    level5: 'Level 5',
    level6: 'Level 6',
    level1: 'Level 1, officers’ deck',
    tiebay: 'TIE launch bay',
    aa23: 'Detention Block AA-23',
    maint: 'Level 6 maintenance',
    core: 'Central core shaft',
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

    // Level 2, wall to wall with the bay on its west: the TIE launch bay, with lift 2 at its back
    // and its launch doors onto space at its south end
    { id: 'tiebay', kind: 'tiebay', name: 'TIE launch bay', section: 'tiebay', x: -50, z: -18, w: 36, d: 36, y: 0, h: 16 },
    { id: 'field-tie', kind: 'field', name: 'Launch field', section: 'tiebay', x: -50, z: 2, w: 36, d: 4, y: 0, h: 16, floors: [] },
    { id: 'lift2-l2', kind: 'lift', name: 'Lift 2, Level 2', section: 'tiebay', x: -60, z: -37.5, w: 3, d: 3, y: 0, h: 3 },

    // Level 1, the officers’ deck, over the corridors behind the bay
    { id: 'lift2-l1', kind: 'lift', name: 'Lift 2, Level 1', section: 'level1', x: -6, z: -67.1, w: 3, d: 3, y: L1, h: 3 },
    { id: 'deck1', kind: 'corridor', name: 'Officers’ deck corridor', section: 'level1', x: 10, z: -64, w: 40, d: 3.2, y: L1, h: 3.2, restricted: true },
    { id: 'conference', kind: 'conference', name: 'Conference room', section: 'level1', x: 7, z: -57.4, w: 14, d: 10, y: L1, h: 4, restricted: true },
    { id: 'archive', kind: 'archive', name: 'Records archive', section: 'level1', x: -5, z: -58.4, w: 10, d: 8, y: L1, h: 4, restricted: true },
    // the overbridge’s north wall is the window onto space
    { id: 'overbridge', kind: 'overbridge', name: 'Overbridge', section: 'level1', x: 18, z: -72.6, w: 24, d: 14, y: L1, h: 6, restricted: true },
    { id: 'meditation', kind: 'meditation', name: 'Meditation chamber (inspired)', section: 'level1', x: 1, z: -69.6, w: 8, round: true, y: L1, h: 4, restricted: true },
    { id: 'firecontrol', kind: 'firecontrol', name: 'Superlaser fire control', section: 'level1', x: 37, z: -64, w: 14, d: 12, y: L1, h: 5, restricted: true },

    // Level 5: the lift lobby, the corridors and Detention Block AA-23
    { id: 'lobby5', kind: 'lobby', name: 'Lift lobby, Level 5', section: 'level5', x: 40, z: -84.5, w: 10, d: 8, y: L5, h: 4 },
    { id: 'ring5', kind: 'corridor', name: 'Level 5 ring corridor', section: 'level5', x: 27, z: -84.5, w: 16, d: 3.2, y: L5, h: 3.2 },
    { id: 'corr5', kind: 'corridor', name: 'Detention block approach', section: 'level5', x: 50, z: -84.5, w: 10, d: 3.2, y: L5, h: 3.2 },
    { id: 'aa23', kind: 'detention', name: 'Detention Block AA-23 control', section: 'aa23', x: 60, z: -84.5, w: 10, d: 9, y: L5, h: 3.2 },
    { id: 'cellbay', kind: 'cellbay', name: 'Cell bay', section: 'aa23', ...CELLBAY, y: L5, h: 3.2 },
    { id: 'cellbay2', kind: 'cellbay', name: 'Cell bay, past the bend', section: 'aa23', ...BEND, y: L5, h: 3.2 },
    ...CELLS.map((c) => ({ id: `cell${c.n}`, kind: 'cell', name: `Cell ${c.n}`, section: 'aa23', x: c.x, z: c.z, w: 3, d: 3, y: L5, h: 2.6 })),
    { id: 'chute', kind: 'chute', name: 'Garbage chute', section: 'aa23', x: 42, z: -111, w: 4, d: 4, y: L5, h: 3 },

    // Level 6: the core shaft corridor, the tractor beam’s terminal, the maintenance corridors, the compactor and the chasm
    { id: 'core6', kind: 'corridor', name: 'Level 6 core shaft corridor', section: 'level6', x: -18.5, z: -110, w: 40, d: 3.2, y: L6, h: 3.2 },
    {
      id: 'tractor',
      kind: 'shaft',
      name: 'Tractor beam power terminal',
      section: 'level6',
      ...TRACTOR,
      y: L6,
      h: 24,
      dark: true,
      floors: [
        { x: 0, z: 6.5, w: 1.2, d: 7, y: 0 },
        { x: 0, z: 1.5, w: 3, d: 3, y: 0 },
      ],
    },
    { id: 'maint', kind: 'maintenance', name: 'Maintenance corridor', section: 'maint', x: 11.5, z: -110, w: 20, d: 3.2, y: L6, h: 3 },
    { id: 'maint2', kind: 'maintenance', name: 'Maintenance corridor, east', section: 'maint', x: 23.1, z: -103.6, w: 3.2, d: 16, y: L6, h: 3 },
    {
      id: 'compactor',
      kind: 'compactor',
      name: 'Garbage compactor 3263827',
      section: 'maint',
      ...COMPACTOR,
      y: L6,
      h: 4,
      floors: [
        { x: 0, z: 0, w: 10, d: 4, y: -0.9, tag: 'water' },
        { x: 0.5, z: -1.5, w: 1, d: 1, y: -0.6 },
        { x: 1.5, z: -1.5, w: 1, d: 1, y: -0.3 },
        { x: 3.5, z: 0, w: 3, d: 4, y: 0 },
      ],
    },
    {
      id: 'gantry',
      kind: 'corridor',
      name: 'Gantry stair',
      section: 'core',
      x: 31.7,
      z: -105.2,
      w: 14,
      d: 3.2,
      y: L6,
      h: UPPER + 3.2,
      floors: [{ x: -6, z: 0, w: 2, d: 3.2, y: 0 }, ...GANTRY, { x: 5, z: 0, w: 4, d: 3.2, y: UPPER }],
    },
    {
      id: 'chasm',
      kind: 'chasm',
      name: 'Central core shaft chasm',
      section: 'core',
      ...CHASM,
      y: L6,
      h: 12,
      dark: true,
      floors: [
        { x: -7.5, z: 0, w: 3, d: 8, y: 0 },
        { x: 0, z: 0, w: 12, d: 2, y: 0, tag: 'bridge' },
        { x: 7.5, z: 0, w: 3, d: 8, y: 0 },
        { x: 0, z: -3.25, w: 6, d: 1.5, y: UPPER },
      ],
    },
    { id: 'chasmway', kind: 'corridor', name: 'Core shaft corridor, far side', section: 'core', x: 50.7, z: -99.6, w: 16, d: 3.2, y: L6, h: 3.2 },
    { id: 'lift2-l6', kind: 'lift', name: 'Lift 2, Level 6', section: 'level6', x: 60.2, z: -99.6, w: 3, d: 3, y: L6, h: 3 },
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

    { id: 'bay327-tiebay', a: 'bay327', b: 'tiebay', x: -32, z: -10, axis: 'z', w: 3, h: 3, kind: 'blast' },
    { id: 'tiebay-lift2', a: 'tiebay', b: 'lift2-l2', x: -60, z: -36, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    // the launch doors: shut on space until a fighter goes out
    { id: 'tiebay-field', a: 'tiebay', b: 'field-tie', x: -50, z: 0, axis: 'x', w: 30, h: 12, kind: 'blast', lock: 'flag:launch' },

    { id: 'deck1-lift2', a: 'deck1', b: 'lift2-l1', x: -6, z: -65.6, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    { id: 'deck1-conference', a: 'deck1', b: 'conference', x: 7, z: -62.4, axis: 'x', w: 2, h: 2.6, kind: 'slide' },
    { id: 'deck1-archive', a: 'deck1', b: 'archive', x: -5, z: -62.4, axis: 'x', w: 1.6, h: 2.4, kind: 'slide' },
    { id: 'deck1-overbridge', a: 'deck1', b: 'overbridge', x: 18, z: -65.6, axis: 'x', w: 3, h: 2.8, kind: 'blast' },
    { id: 'deck1-meditation', a: 'deck1', b: 'meditation', x: 1, z: -65.6, axis: 'x', w: 1.6, h: 2.4, kind: 'slide' },
    { id: 'deck1-firecontrol', a: 'deck1', b: 'firecontrol', x: 30, z: -64, axis: 'z', w: 2, h: 2.6, kind: 'blast', lock: 'side:imperial' },

    { id: 'lobby5-lift', a: 'lobby5', b: 'lift1-l5', x: 40, z: -88.5, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    { id: 'lobby5-ring5', a: 'lobby5', b: 'ring5', x: 35, z: -84.5, axis: 'z', w: 2.4, h: 2.6, kind: 'slide' },
    { id: 'lobby5-corr5', a: 'lobby5', b: 'corr5', x: 45, z: -84.5, axis: 'z', w: 2.4, h: 2.6, kind: 'slide' },
    { id: 'corr5-aa23', a: 'corr5', b: 'aa23', x: 55, z: -84.5, axis: 'z', w: 2.4, h: 2.6, kind: 'slide' },
    { id: 'aa23-cellbay', a: 'aa23', b: 'cellbay', x: 60, z: -89, axis: 'x', w: 2.4, h: 2.6, kind: 'slide' },
    // a bulkhead at the bend, sliding rather than blast so a lockdown can’t shut Leia’s cell off
    { id: 'cellbay-bend', a: 'cellbay', b: 'cellbay2', x: 60, z: -113, axis: 'x', w: 3.6, h: 3, kind: 'slide' },
    // a cell opens for an Imperial, or anyone passing for one, at the panel by its door
    ...CELLS.map((c) => {
      const east = c.wall === 'east';
      return { id: `cell${c.n}-door`, a: east ? 'cellbay' : 'cellbay2', b: `cell${c.n}`, x: east ? c.x - 1.5 : c.x, z: east ? c.z : c.z + 1.5, axis: east ? 'z' : 'x', w: 1.2, h: 2.2, kind: 'slide', lock: 'side:imperial' };
    }),
    // the chute’s grate, shut until it is blasted open
    { id: 'cellbay-chute', a: 'cellbay2', b: 'chute', x: 42, z: -113, axis: 'x', w: 1.4, h: 2, kind: 'hatch', lock: 'flag:grate' },

    { id: 'lift6-core6', a: 'lift1-l6', b: 'core6', x: -38.5, z: -110, axis: 'z', w: 2, h: 2.4, kind: 'slide' },
    { id: 'core6-tractor', a: 'core6', b: 'tractor', x: TRACTOR.x, z: TRACTOR.z + TRACTOR.d / 2, axis: 'x', w: 1.6, h: 2.4, kind: 'slide' },
    { id: 'core6-maint', a: 'core6', b: 'maint', x: 1.5, z: -110, axis: 'z', w: 2.4, h: 2.6, kind: 'blast', lock: 'side:imperial' },
    { id: 'compactor-hatch', a: 'compactor', b: 'maint', x: 14.5, z: COMPACTOR.z - COMPACTOR.d / 2, axis: 'x', w: 1.2, h: 1.8, kind: 'hatch', lock: 'code:3263827' },
    { id: 'maint-maint2', a: 'maint', b: 'maint2', x: 21.5, z: -110, axis: 'z', w: 2.4, h: 2.6, kind: 'slide' },
    // the blast door that shuts behind you on the chasm’s near ledge
    { id: 'maint2-chasm', a: 'maint2', b: 'chasm', x: CHASM.x - CHASM.w / 2, z: CHASM.z, axis: 'z', w: 2, h: 2.6, kind: 'blast' },
    { id: 'maint2-gantry', a: 'maint2', b: 'gantry', x: 24.7, z: -105.2, axis: 'z', w: 2.4, h: 2.6, kind: 'slide' },
    { id: 'gantry-chasm', a: 'gantry', b: 'chasm', x: 35.5, z: CHASM.z - CHASM.d / 2, axis: 'x', w: 1.4, h: 2.4, kind: 'slide' },
    { id: 'chasm-chasmway', a: 'chasm', b: 'chasmway', x: CHASM.x + CHASM.w / 2, z: CHASM.z, axis: 'z', w: 2, h: 2.6, kind: 'slide' },
    { id: 'chasmway-lift2', a: 'chasmway', b: 'lift2-l6', x: 58.7, z: -99.6, axis: 'z', w: 2, h: 2.4, kind: 'slide' },
  ],
  lifts: [
    { id: 'lift1', stops: ['lift1-l2', 'lift1-l5', 'lift1-l6'] },
    { id: 'lift2', stops: ['lift2-l1', 'lift2-l2', 'lift2-l6'] },
  ],
  jumps: [
    { id: 'chute-drop', from: 'chute', x: 42, z: -110, r: 1.2, to: 'compactor-drop', prompt: 'Dive down the chute' },
    { id: 'swing', from: 'chasm', x: CHASM.x - CHASM.w / 2 + 2.5, z: CHASM.z, r: 1.2, to: 'chasm-far', prompt: 'Swing across', lock: 'flag:grapple' },
  ],
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

    // Docking Bay 327 and the Falcon
    'scan-hide': { room: 'hold', x: -14.2, z: -9.3, yaw: Math.PI / 2 },
    'scan-crew': { room: 'bay327', x: 8, z: -18, yaw: Math.PI },
    'ambush-panel': { room: 'hold', x: -9.4, z: -7.4, yaw: Math.PI / 2 },
    'ambush-trooper-1': { room: 'bay327', x: -13, z: 2.5, yaw: 0 },
    'ambush-trooper-2': { room: 'bay327', x: -11, z: 2.5, yaw: 0 },
    'falcon-ramp': { room: 'bay327', x: HOLD.x, z: 0.8, yaw: 0 },
    ranks: { room: 'bay327', x: 16, z: 2, yaw: -Math.PI / 2 },
    'vader-bay': { room: 'bay327', x: 12, z: -14, yaw: -Math.PI / 2 },
    beacon: { room: 'bay327', x: 5.2, z: 0, yaw: -Math.PI / 2 },
    duel: { room: 'bay327', x: -4, z: -22, yaw: Math.PI / 2 },
    // where the way back from the chasm (lift 2, the TIE bay) comes into Docking Bay 327
    'bay-door': { room: 'tiebay', x: -33.5, z: -10, yaw: Math.PI / 2 },
    'ctl-door': { room: 'bay327', x: CONTROL.x, z: -23.2, yaw: 0 },
    'ctl-officer': { room: 'ctl327', x: 23.5, z: -27, yaw: Math.PI },
    'ctl-aide': { room: 'ctl327', x: 19, z: -28.5, yaw: Math.PI },
    'ctl-intercom': { room: 'ctl327', x: 21, z: -30.4, yaw: 0 },
    'ctl-closet': { room: 'ctl327', x: 17.8, z: -30.2, yaw: Math.PI / 2 },
    scomp: { room: 'ctl327', x: 25, z: -30.4, yaw: 0 },
    'lift2-call': { room: 'tiebay', x: -60, z: -34.5, yaw: 0 },
    'tie-start': { room: 'tiebay', x: -50, z: -20, yaw: Math.PI },

    // the officers’ deck
    'deck1-lift': { room: 'deck1', x: -6, z: -64, yaw: Math.PI / 2 },
    'conference-table': { room: 'conference', x: 7, z: -57.4, yaw: 0 },
    'krennic-chair': { room: 'conference', x: 7, z: -53.4, yaw: 0 },
    'overbridge-window': { room: 'overbridge', x: 18, z: -78.6, yaw: 0 },
    'fire-control': { room: 'firecontrol', x: 37, z: -66, yaw: 0 },
    librarian: { room: 'archive', x: -5, z: -56, yaw: 0 },
    'meditation-pod': { room: 'meditation', x: 1, z: -69.6, yaw: Math.PI },

    // the tractor beam, as Obi-Wan
    'core6-start': { room: 'core6', x: -36.5, z: -110, yaw: Math.PI / 2 },
    'core6-guards': { room: 'core6', x: -22, z: -109.4, yaw: -Math.PI / 2 },
    'tractor-ledge': { room: 'tractor', x: TRACTOR.x, z: -114.5, yaw: 0 },
    'tractor-terminal': { room: 'tractor', x: TRACTOR.x, z: -120.6, yaw: 0 },
    'tractor-power-1': { room: 'tractor', x: TRACTOR.x - 1.2, z: -121, yaw: 0 },
    'tractor-power-2': { room: 'tractor', x: TRACTOR.x + 1.2, z: -121, yaw: 0 },

    // Detention Block AA-23
    lift5: { room: 'lobby5', x: 40, z: -86.6, yaw: Math.PI },
    'aa23-desk': { room: 'aa23', x: 60, z: -84.5, yaw: -Math.PI / 2 },
    'aa23-guards': { room: 'aa23', x: 62, z: -82, yaw: -Math.PI / 2 },
    'aa23-camera-1': { room: 'aa23', x: 55.6, z: -88.4, yaw: Math.PI / 2 },
    'aa23-camera-2': { room: 'aa23', x: 64.4, z: -80.6, yaw: -Math.PI / 2 },
    'aa23-intercom': { room: 'aa23', x: 63.6, z: -86.8, yaw: Math.PI / 2 },
    'cellbay-squad': { room: 'cellbay', x: 60, z: -90.5, yaw: 0 },
    'cell2187-door': { room: 'cellbay2', x: 59.5, z: -116.3, yaw: 0 },
    leia: { room: 'cell2187', x: 59.5, z: -119, yaw: Math.PI },
    'chute-grate': { room: 'cellbay2', x: 42, z: -113.8, yaw: Math.PI },
    'chute-slide': { room: 'chute', x: 42, z: -110.4, yaw: Math.PI },

    // the compactor, the maintenance corridors and the chasm
    'compactor-drop': { room: 'compactor', x: 8, z: -106.4, yaw: Math.PI / 2 },
    dianoga: { room: 'compactor', x: 7, z: -105.4, yaw: Math.PI / 2 },
    'compactor-hatch': { room: 'compactor', x: 14.5, z: -107.8, yaw: 0 },
    'maint-sweep': { room: 'maint', x: 11.5, z: -110, yaw: Math.PI / 2 },
    'maint-squad': { room: 'maint2', x: 23.1, z: -102, yaw: 0 },
    'chasm-door': { room: 'chasm', x: 25.4, z: CHASM.z, yaw: Math.PI / 2 },
    'bridge-control': { room: 'chasm', x: 25.4, z: -101.8, yaw: Math.PI / 2 },
    'chasm-ledge': { room: 'chasm', x: CHASM.x - CHASM.w / 2 + 2.5, z: CHASM.z, yaw: Math.PI / 2 },
    'chasm-far': { room: 'chasm', x: CHASM.x + CHASM.w / 2 - 1.5, z: CHASM.z, yaw: Math.PI / 2 },
    'chasm-upper': { room: 'chasm', x: CHASM.x, z: -102.8, yaw: Math.PI },
    'chasmway-lift': { room: 'chasmway', x: 56.5, z: CHASM.z, yaw: Math.PI / 2 },
  },
};
