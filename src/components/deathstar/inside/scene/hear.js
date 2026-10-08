// What the game’s events sound like: each one as the calls it makes on the
// station’s sounds (sounds.js), so the module only plays them. A door is
// heard where it is by its kind, a shot where it left the muzzle, a hit
// where it struck; the klaxon and the music follow the alarm of the
// section you are in, and the hum the kind of room you walk into. Pure.
//
//   heardOf(event, g) → [[name, ...args]]   sounds[name](...args) for each, in order; a place the
//     event doesn’t give is left undefined, which sounds.js hears at the listener

const DOOR_EAR = 1.2; // metres up a door’s middle is heard from
const UP = new Set(['alert', 'lockdown', 'hunt']);

// where a thing happened, or undefined (heard at your own ear) when the event gives nowhere real:
// a non-finite place would throw in the audio graph and stop the frame
const finite = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) ? p : undefined);
const point = (e) => finite({ x: e.x, y: e.y, z: e.z });

export function heardOf(e, g) {
  switch (e.type) {
    case 'door': {
      const door = g.layout.doors.get(e.door);
      if (!door || (e.what !== 'open' && e.what !== 'close' && e.what !== 'seal')) return [];
      return [['door', door.kind, { x: door.x, y: door.y + DOOR_EAR, z: door.z }]];
    }
    case 'lift':
      return [['lift', e.what === 'leave']];
    case 'shot':
      return [['blaster', e.weapon, finite(e.at)]];
    case 'impact':
      return [['hit', point(e)]];
    case 'hit':
      return [[e.by === 'blade' ? 'clash' : 'hit', point(e)]];
    case 'deflect':
      return [['clash', point(e)]];
    case 'alert': {
      const here = g.layout.rooms.get(g.you.room)?.section;
      if (e.section !== here) return [];
      return [
        ['alarm', e.level],
        ['music', UP.has(e.level) ? 'alert' : 'calm'],
      ];
    }
    case 'room': {
      const room = g.layout.rooms.get(e.to);
      return room ? [['hum', room.kind]] : [];
    }
    case 'say':
      return e.text ? [['say', e.who, e.text]] : [];
    case 'music':
      return [['music', e.mood]];
    default:
      return [];
  }
}
