// The second Death Star’s rooms (4 ABY, Return of the Jedi), as data for
// layout.js, in the same shape as ds1.js: rooms, the doors between them,
// the lifts, where each side starts and the named spots the DS2 stories
// and brains use.
//
//   DS2 → { id, name, era, sections, rooms, doors, lifts, starts, spots }
//
// Metres, +x east, +z south, +y up. Level 1 is at y 0: ST 321’s dock,
// Hangar 272, the command centre, the tower’s antechamber and the
// corridors that join them. Levels are 12 m apart and numbered downwards,
// so the superstructure’s walkways (Level 2) are at y −12 and the gallery
// on the reactor shaft (Level 3) at y −24. The Emperor’s Tower rises the
// other way: its lift climbs to the throne room at y +36, and the shaft
// under the throne room’s bridge falls past the gallery to the reactor at
// y −60. Both hangars open south onto space.
//
// Rooms may have a `window` (its centre in station coordinates and its
// size) that the scene cuts into the named wall: glass, not a doorway, so
// nothing walks or falls through it. `restricted` marks a room a disguised
// Rebel draws doubt in; `glow` names the light rising from below a void.

// A run of floor boxes (room-relative), each `rise` above the last (a
// negative rise steps down), so the walker takes it a step at a time (its
// step is 0.4 m). ds1.js has the same helper; stations are data files that
// don’t import one another.
function flight({ x, z, along, tread, width, rise, count, from = 0 }) {
  return Array.from({ length: count }, (_, k) => {
    const at = (k + 0.5) * tread;
    const y = from + rise * (k + 1);
    return along === 'x' ? { x: x + at, z, w: tread, d: width, y } : { x, z: z + at, w: width, d: tread, y };
  });
}

// The throne room: 30 m square, 14 m high, at the top of the tower. The
// throne stands on a dais 3.2 m up before the round window in the north
// wall; eight 0.4 m steps come down from the dais to the floor, and the
// lift is at the back. East of the stairs the reactor shaft opens in the
// floor, an 8 × 10 m hole crossed by a 2 m bridge to a ledge on the east
// wall; under the bridge there is nothing until the reactor.
// The tower stands just west of the command centre, not out at the corridor’s
// far end: carrying Vader from the throne to the escape shuttle has to fit
// the Rebel story’s 120 s at a walk with time to spare for the crowds and the
// quakes. Its antechamber, both lift landings and the throne room all hang
// off TOWER, and the gallery and its lift off SHAFT, so they move together.
const TOWER = 6; // the antechamber’s x: its east wall stops 2 m short of the command centre’s west wall
const THRONE = { x: TOWER, z: -70, y: 36 };
const DAIS = 3.2;
const STAIRS = flight({ x: 0, z: -8, along: 'z', tread: 0.6, width: 6, rise: -0.4, count: 7, from: DAIS });
const SHAFT = { x: THRONE.x + 9, z: THRONE.z + 5, w: 8, d: 10 };
// the gallery on Level 3, its opening on the shaft’s north side
const GALLERY = { x: SHAFT.x, z: SHAFT.z - SHAFT.d / 2 - 5, y: -24 };

// Lambda shuttles stand nose north in the dock, ramps down towards the
// corridor door: ST 321, Vader’s, on the west, and the one Luke leaves in
// on the east.
const ST321 = { x: 62, z: -14 };
const ESCAPE = { x: 80, z: -14 };
const RAMP = 7; // from a shuttle’s centre to the foot of its ramp

export const DS2 = {
  id: 'ds2',
  name: 'The second Death Star',
  era: 'rotj',
  sections: {
    dock: 'Shuttle dock',
    hangar272: 'Hangar 272',
    level1: 'Level 1',
    command: 'Command centre',
    tower: 'The Emperor’s Tower',
    works: 'Superstructure, Level 2',
    core: 'Reactor core, Level 3',
  },
  rooms: [
    { id: 'dock', kind: 'dock', name: 'Shuttle dock', section: 'dock', x: 70, z: -15, w: 40, d: 30, y: 0, h: 18 },
    // the dock’s open side: space, so nothing to stand on
    { id: 'dockfield', kind: 'field', name: 'Magnetic field', section: 'dock', x: 70, z: 2, w: 40, d: 4, y: 0, h: 18, floors: [] },
    { id: 'hangar272', kind: 'hangar', name: 'Hangar 272', section: 'hangar272', x: 0, z: 0, w: 80, d: 60, y: 0, h: 30 },
    { id: 'field272', kind: 'field', name: 'Magnetic field', section: 'hangar272', x: 0, z: 32, w: 80, d: 4, y: 0, h: 30, floors: [] },
    // one corridor behind the hangars with every Level 1 room off it, from the tower’s antechamber to the dock
    { id: 'corridors2', kind: 'corridor', name: 'Level 1 corridor', section: 'level1', x: (TOWER - 12 + 80) / 2, z: -31.6, w: 80 - (TOWER - 12), d: 3.2, y: 0, h: 3.2 },
    {
      id: 'command',
      kind: 'command',
      name: 'Command centre',
      section: 'command',
      x: 30,
      z: -42.2,
      w: 24,
      d: 18,
      y: 0,
      h: 6,
      // on the equatorial trench, looking out on the fleet
      window: { wall: 'north', x: 30, y: 3, w: 18, h: 3.6 },
    },
    { id: 'holding', kind: 'holding', name: 'Tower antechamber', section: 'tower', x: TOWER, z: -41.2, w: 20, d: 16, y: 0, h: 6 },
    // the tower lift’s landings, at its foot and in the throne room
    { id: 'towerlift', kind: 'lift', name: 'Tower lift', section: 'tower', x: TOWER, z: -50.7, w: 3, d: 3, y: 0, h: 3 },
    { id: 'towerlift-top', kind: 'lift', name: 'Tower lift, throne room', section: 'tower', x: TOWER, z: -53.5, w: 3, d: 3, y: THRONE.y, h: 3 },
    {
      id: 'throne',
      kind: 'throne',
      name: 'Throne room',
      section: 'tower',
      ...THRONE,
      w: 30,
      d: 30,
      h: 14,
      restricted: true,
      window: { wall: 'north', round: true, x: THRONE.x, y: THRONE.y + 8, r: 5 },
      floors: [
        { x: 0, z: -11.5, w: 30, d: 7, y: DAIS },
        ...STAIRS,
        // the floor in four pieces round the shaft, the ledge past it and the bridge across it
        { x: -5, z: 3.5, w: 20, d: 23, y: 0 },
        { x: 10, z: -4, w: 10, d: 8, y: 0 },
        { x: 10, z: 12.5, w: 10, d: 5, y: 0 },
        { x: 14, z: 5, w: 2, d: 10, y: 0 },
        { x: 9, z: 5, w: 8, d: 2, y: 0 },
      ],
    },
    // under the throne room’s floor: nothing to stand on all the way down to the reactor
    { id: 'reactorshaft', kind: 'shaft', name: 'Reactor shaft', section: 'core', x: SHAFT.x, z: SHAFT.z, w: SHAFT.w, d: SHAFT.d, y: -60, h: THRONE.y + 60, floors: [] },
    { id: 'gallery', kind: 'gallery', name: 'Reactor shaft gallery', section: 'core', x: GALLERY.x, z: GALLERY.z, w: 20, d: 10, y: GALLERY.y, h: 6 },
    {
      id: 'superstructure',
      kind: 'superstructure',
      name: 'Superstructure',
      section: 'works',
      x: 40,
      z: -100,
      w: 60,
      d: 40,
      y: -12,
      h: 30,
      // unfinished: girders, and walkways over the reactor chamber’s glow
      glow: 'reactor',
      floors: [
        { x: 0, z: -18.5, w: 8, d: 3, y: 0 },
        { x: 0, z: 0, w: 1.6, d: 34, y: 0 },
        { x: 0, z: 0, w: 56, d: 1.6, y: 0 },
        { x: -26, z: 0, w: 4, d: 6, y: 0 },
        { x: 26, z: 0, w: 4, d: 6, y: 0 },
        { x: 0, z: 18.5, w: 8, d: 3, y: 0 },
      ],
    },
    { id: 'lift2-l1', kind: 'lift', name: 'Lift 2, Level 1', section: 'level1', x: 60, z: -34.7, w: 3, d: 3, y: 0, h: 3 },
    { id: 'lift2-l2', kind: 'lift', name: 'Lift 2, Level 2', section: 'works', x: 40, z: -78.5, w: 3, d: 3, y: -12, h: 3 },
    { id: 'lift2-l3', kind: 'lift', name: 'Lift 2, Level 3', section: 'core', x: GALLERY.x, z: GALLERY.z - 6.5, w: 3, d: 3, y: GALLERY.y, h: 3 },
  ],
  doors: [
    { id: 'dock-field', a: 'dock', b: 'dockfield', x: 70, z: 0, axis: 'x', w: 34, h: 14, kind: 'arch' },
    { id: 'dock-corr', a: 'dock', b: 'corridors2', x: 60, z: -30, axis: 'x', w: 4, h: 3, kind: 'blast' },
    { id: 'hangar272-field', a: 'hangar272', b: 'field272', x: 0, z: 30, axis: 'x', w: 72, h: 24, kind: 'arch' },
    { id: 'hangar272-corr', a: 'hangar272', b: 'corridors2', x: 0, z: -30, axis: 'x', w: 4, h: 3, kind: 'blast' },
    { id: 'command-corr', a: 'command', b: 'corridors2', x: 30, z: -33.2, axis: 'x', w: 2.4, h: 2.6, kind: 'slide' },
    { id: 'holding-corr', a: 'holding', b: 'corridors2', x: TOWER, z: -33.2, axis: 'x', w: 3, h: 3, kind: 'blast' },
    { id: 'holding-lift', a: 'holding', b: 'towerlift', x: TOWER, z: -49.2, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    { id: 'throne-lift', a: 'throne', b: 'towerlift-top', x: THRONE.x, z: -55, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    // the gallery’s rail-less opening onto the shaft, where the reactor’s glow comes up
    { id: 'gallery-shaft', a: 'gallery', b: 'reactorshaft', x: SHAFT.x, z: GALLERY.z + 5, axis: 'x', w: 6, h: 4, kind: 'arch' },
    { id: 'corr-lift2', a: 'corridors2', b: 'lift2-l1', x: 60, z: -33.2, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    { id: 'super-lift2', a: 'superstructure', b: 'lift2-l2', x: 40, z: -80, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
    { id: 'gallery-lift2', a: 'gallery', b: 'lift2-l3', x: GALLERY.x, z: GALLERY.z - 5, axis: 'x', w: 2, h: 2.4, kind: 'slide' },
  ],
  lifts: [
    { id: 'tower', stops: ['towerlift', 'towerlift-top'] },
    { id: 'lift2', stops: ['lift2-l1', 'lift2-l2', 'lift2-l3'] },
  ],
  starts: {
    // beside ST 321, just down its ramp
    rebel: { room: 'dock', x: ST321.x - 4, z: ST321.z - RAMP, yaw: 0 },
    imperial: { room: 'command', x: 30, z: -37, yaw: 0 },
  },
  spots: {
    'dock-ramp': { room: 'dock', x: ST321.x, z: ST321.z - RAMP, yaw: 0 },
    // where Jerjerrod meets Vader, between the ramp and the corridor door
    'vader-arrive': { room: 'dock', x: ST321.x, z: ST321.z - RAMP - 3, yaw: 0 },
    'escape-shuttle': { room: 'dock', x: ESCAPE.x, z: ESCAPE.z, yaw: Math.PI },
    // where you board it: the foot of its hull by the ramp (the Lambda on escape-shuttle is solid round it)
    'escape-board': { room: 'dock', x: ESCAPE.x, z: -18.1, yaw: Math.PI },
    'shuttle-ramp': { room: 'dock', x: ESCAPE.x, z: ESCAPE.z - RAMP, yaw: Math.PI },
    // where Vader is set down for the mask: at the foot of the ramp (which meets the deck a metre
    // short of shuttle-ramp), his back to it, facing out under the shuttle's nose
    'mask-seat': { room: 'dock', x: ESCAPE.x, z: ESCAPE.z - RAMP, yaw: 0 },
    // and where Luke kneels in front of him, facing him
    'mask-kneel': { room: 'dock', x: ESCAPE.x, z: ESCAPE.z - RAMP - 1.2, yaw: Math.PI },
    'st321-console': { room: 'command', x: 22, z: -47, yaw: 0 },
    'firing-switch': { room: 'command', x: 30, z: -49, yaw: 0 },
    // in the ranks west of the aisle the Emperor walks up, facing it
    ranks272: { room: 'hangar272', x: -6, z: -6, yaw: Math.PI / 2 },
    'emperor-ramp': { room: 'hangar272', x: 0, z: 4, yaw: 0 },
    // the foot of the aisle the Emperor walks down between the ranks, Vader at his side and his
    // guards behind
    'aisle-end': { room: 'hangar272', x: 0, z: -18, yaw: 0 },
    'aisle-vader': { room: 'hangar272', x: 1.3, z: -17.4, yaw: 0 },
    'aisle-guard-l': { room: 'hangar272', x: -1.6, z: -14.5, yaw: 0 },
    'aisle-guard-r': { room: 'hangar272', x: 1.6, z: -14.5, yaw: 0 },
    'holding-lift': { room: 'holding', x: TOWER, z: -47.4, yaw: 0 },
    // the seat itself, named apart from the room so ?at= and teleport() can find it
    'throne-seat': { room: 'throne', x: THRONE.x, z: THRONE.z - 12, yaw: Math.PI },
    'throne-armrest': { room: 'throne', x: THRONE.x + 0.7, z: THRONE.z - 12, yaw: Math.PI },
    // on the floor beside the stairs, in the dais’s shadow
    'under-stairs': { room: 'throne', x: THRONE.x - 4.5, z: THRONE.z - 6, yaw: Math.PI },
    // the middle of the bridge over the shaft
    'shaft-edge': { room: 'throne', x: SHAFT.x, z: SHAFT.z, yaw: 0 },
  },
};
