// What the station's consoles, banks, terminals and intercoms say when you
// work one that no story or free-roam use claims. Each line is about the
// room it stands in: a bay's traffic, a detention block's cells, the
// command centre's fleet, the Emperor's throne room. A room's lines come in
// turn, one each time E is pressed, and the section's security is told
// when it isn't calm. So E answers at every console aboard, as it does at
// the things that do more. Pure apart from the turn it keeps on the game.
//
//   READS → Set<kind>   the furnished kinds that read out
//   readoutOf(g, prop, roomId) → { who, text }   who: 'console' | 'intercom'

import { levelOf } from '../alarm';

export const READS = new Set(['console', 'bank', 'terminal', 'button-bank', 'fire-console', 'pentagon-screen', 'desk', 'intercom', 'door-panel', 'station', 'screen', 'junction-box']);

// by the room's kind; a kind not here reads its room's name and that all is well
const LINES = {
  control: ['Bay 327: one YT-1300 light freighter, drawn in on the tractor beam and impounded.', 'Scan crew to Bay 327. The freighter is registered to no owner the records know.', 'Docking clearance: none issued. Bay 327 is closed to traffic.'],
  hangar: ['Bay status: magnetic field holding, atmosphere nominal.', 'Fuel lines locked off. Cargo lifters idle on their pads.', 'Traffic control: no departures cleared.'],
  dock: ['Dock status: two Lambda shuttles on their pads, field holding.', 'Shuttle traffic: inbound flights hold for clearance from command.'],
  tiebay: ['Launch racks: six fighters cycled and ready.', 'Launch sequence on hold. Pilots on standby.'],
  detention: ['Detention Block AA-23: eleven cells, two of them held.', 'Cell 2187: one prisoner, held for interrogation. Priority one.', 'Interrogation droid recalled to the block.'],
  cellbay: ['Cell row: every door locked, every lock reporting.', 'Prisoner count: two. Transfers by order of the block’s officer only.'],
  cell: ['Cell door: locked from the block.'],
  firecontrol: ['Superlaser: primary ignition charged.', 'Target acquisition: holding until ordered.', 'Focusing array aligned. Tributary beams at rest.'],
  overbridge: ['Hyperspace course: holding position.', 'Sensor sweep: no ships within range.'],
  conference: ['Briefing schedule: section commanders at the change of watch.', 'Fleet dispositions: a squadron moved to the outer rim.'],
  archive: ['Records: technical readouts for every section aboard.', 'Access logged by name, rank and section.'],
  command: ['Shield generator on the forest moon: holding.', 'Main reactor: construction ahead of schedule, by order of the Emperor.', 'Shuttle traffic: one inbound, holding for clearance.', 'Fleet: the Rebel fleet has not been sighted.'],
  throne: ['Throne room: by the Emperor’s leave only.'],
  holding: ['Tower lift: held for the Emperor’s guard.'],
  gallery: ['Construction in this sector continues on schedule.'],
  superstructure: ['Construction in this sector continues on schedule.'],
  meditation: ['Do not disturb.'],
  maintenance: ['Power junction: carrying the detention level’s load.', 'Waste disposal: the compactors on their cycle.', 'Magnetically sealed. Maintenance crews only.'],
};

function securityOf(g, roomId) {
  const room = g.layout.rooms.get(roomId);
  const level = room ? levelOf(g.alarm, room.section) : null;
  if (!level || level === 'calm') return null;
  const name = g.layout.station.sections?.[room.section] ?? room?.name;
  return `${name}: security ${level}.`;
}

export function readoutOf(g, prop, roomId) {
  const room = g.layout.rooms.get(roomId);
  const alarm = securityOf(g, roomId);
  if (prop.kind === 'intercom') return { who: 'intercom', text: alarm ?? `${g.layout.station.sections?.[room?.section] ?? room?.name}: all quiet. Stay at your posts.` };
  if (prop.kind === 'door-panel') return { who: 'console', text: g.you.side === 'imperial' || (g.you.armour && g.you.helmet) ? 'Cell door: open to the block’s own.' : 'Cell door: locked from the block.' };
  if (alarm) return { who: 'console', text: alarm };
  const lines = LINES[room?.kind] ?? [`${room?.name ?? 'This section'}: all systems nominal.`];
  g.readouts ??= new Map();
  const k = g.readouts.get(roomId) ?? 0;
  g.readouts.set(roomId, k + 1);
  return { who: 'console', text: lines[k % lines.length] };
}
