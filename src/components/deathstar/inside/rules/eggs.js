// The station’s Easter eggs: twenty small things a fan might do aboard,
// each worth a `ds-` achievement. The game never checks for an egg
// itself; it emits plain events as things happen and hands each one to
// `eggsOn`, which says which eggs that event finds. The rolls behind an
// event (the trooper who bumps his head does so 1 in 3 squads) belong to
// the game, so the eggs stay a pure lookup. A found egg stays found: the
// save keeps the set and hands it back, so nothing is found twice. Pure.
//
//   EGGS: [{ id, achievement: 'ds-<id>', title, line, link?, when(event, g) → bool }]
//     title: the achievement’s name; line: what you did, said when it is found;
//     link: a page to go on to (the plans link to the readout on the Death Star page)
//   eggsOn(found: Set<id>, event, g) → [id]   the eggs this event finds now; adds them to `found`
//
// EVENTS: the shapes the game emits, and the eggs that listen for each.
//   { type: 'saw', what, seconds }     looked at a tagged thing this long (seconds so far, so it may come again, longer)
//     what: 'bonk' (a trooper hits his head) · 'eyestalk' · 'robe' · 'librarian' · 'nameplate'
//   { type: 'took', item }             'tk421-armour'
//   { type: 'kept-up', with, lap }     with: 'g7'; lap: true once you have stayed with it a whole lap
//   { type: 'fled', kind, from }       kind: 'mouse', from: 'roar'
//   { type: 'chose', talk, node }      talk ids from rules/talks: 'aa23-officer' → 'transfer-1138',
//                                      'han-intercom' → 'boring', 'conference' → 'faith'
//   { type: 'opened', door, helmet }   door: 'cell2187'; helmet: whether yours was on
//   { type: 'sat', tag }               'krennic-chair'
//   { type: 'dialled', code }          '3263827' (a string, so leading digits survive)
//   { type: 'pulled', tag }            'armrest-saber'
//   { type: 'heard', line }            'trap'
//   { type: 'read', tag }              'exhaust-note' · 'plans'
//   { type: 'charge' }                 chased a squad down a corridor and met the platoon coming back
//   { type: 'trick', count }           how many guards the mind trick took at once; two make them say the line
//   `g` is the game’s state, passed through for eggs that need more than their event; none does yet.

// How long a look must last before it counts. A bonk is over in a moment,
// so a glimpse will do; the eyestalk only counts once it has stared back.
const LOOK = { bonk: 0.25, eyestalk: 2, robe: 1, librarian: 1, nameplate: 1 };

const saw = (what) => (e) => e.type === 'saw' && e.what === what && e.seconds >= LOOK[what];
const chose = (talk, node) => (e) => e.type === 'chose' && e.talk === talk && e.node === node;

export const EGGS = [
  { id: 'bonk', title: 'Mind your head', line: 'Watched a stormtrooper bang his head on a door frame in Docking Control 327.', when: saw('bonk') },
  { id: 'tk421', title: 'Not at his post', line: 'Took TK-421’s armour.', when: (e) => e.type === 'took' && e.item === 'tk421-armour' },
  { id: 'g7', title: 'Fastest in the fleet', line: 'Kept up with G7 for a whole lap of the Level 5 corridors.', when: (e) => e.type === 'kept-up' && e.with === 'g7' && e.lap === true },
  { id: 'roar', title: 'Scaredy droid', line: 'Sent a mouse droid fleeing with a roar.', when: (e) => e.type === 'fled' && e.kind === 'mouse' && e.from === 'roar' },
  { id: '1138', title: 'Prisoner transfer', line: 'Brought a prisoner across from cell block 1138.', when: chose('aa23-officer', 'transfer-1138') },
  { id: '3263827', title: 'Mashers off', line: 'Dialled 3263827 on the compactor’s hatch.', when: (e) => e.type === 'dialled' && e.code === '3263827' },
  { id: 'boring', title: 'Boring conversation anyway', line: 'Saw Han’s chat on the intercom through to the end.', when: chose('han-intercom', 'boring') },
  { id: 'short', title: 'A little short', line: 'Opened cell 2187 with your helmet on.', when: (e) => e.type === 'opened' && e.door === 'cell2187' && e.helmet === true },
  { id: 'krennic', title: 'Seat’s free', line: 'Sat in Krennic’s empty chair at the conference table.', when: (e) => e.type === 'sat' && e.tag === 'krennic-chair' },
  { id: 'faith', title: 'Lack of faith', line: 'Talked back to Vader in the conference room and got off with a choke.', when: chose('conference', 'faith') },
  { id: 'eyestalk', title: 'Something’s alive in here', line: 'Stared down the dianoga’s eyestalk.', when: saw('eyestalk') },
  { id: 'librarian', title: 'Overdue', line: 'Caught the librarian on the archive’s security feed.', when: saw('librarian') },
  { id: 'robe', title: 'Nothing but the robe', line: 'Found the robe on the floor of Bay 327.', when: saw('robe') },
  { id: 'armrest', title: 'Within arm’s reach', line: 'Pulled Luke’s lightsaber from the throne’s armrest.', when: (e) => e.type === 'pulled' && e.tag === 'armrest-saber' },
  { id: 'trap', title: 'Admiral’s hunch', line: 'Heard “It’s a trap!” in the command centre’s chatter.', when: (e) => e.type === 'heard' && e.line === 'trap' },
  { id: 'moff', title: 'Moff by rank', line: 'Read Jerjerrod’s nameplate, which calls him Moff.', when: saw('nameplate') },
  { id: 'charge', title: 'Han’s charge', line: 'Chased a squad down a corridor and met the rest of the platoon coming back.', when: (e) => e.type === 'charge' },
  { id: 'port', title: 'Two metres wide', line: 'Read the maintenance note on the thermal exhaust port.', when: (e) => e.type === 'read' && e.tag === 'exhaust-note' },
  { id: 'plans', title: 'Technical readout', line: 'Opened the Death Star plans at a terminal.', link: '/deathstar#readout', when: (e) => e.type === 'read' && e.tag === 'plans' },
  { id: 'droids', title: 'Not the droids', line: 'Talked two guards into saying these aren’t the droids you’re looking for.', when: (e) => e.type === 'trick' && e.count >= 2 },
].map((egg) => ({ ...egg, achievement: `ds-${egg.id}` }));

export function eggsOn(found, event, g) {
  const now = [];
  for (const egg of EGGS) {
    if (found.has(egg.id) || !egg.when(event, g)) continue;
    found.add(egg.id);
    now.push(egg.id);
  }
  return now;
}
