// The galactic assaults (kind 'assault': ./assault.js runs one), a map a
// world: the two sides, the command posts on its flats, the attackers' way
// in by phases, and the words. Merged into MISSIONS by ./index.js.
//
//   sides      { attack, defend }: { id, name, short, colour, side
//              (galaxy/sides.js: the war's side it is), kinds
//              ([[kind, weight]…]: what their soldiers are) }
//   posts      [{ id, name, at: [x, z], r, fixed? ('attack' | 'defend': a
//              side's own, never taken, where it falls back to) }]
//   phases     [{ name, posts: [ids], tickets }]: the attackers take every
//              post of one and the next begins, their tickets topped up to it
//   tickets    { attack, defend } at the start
//   hideLife   the site's life kinds kept out of the way while it's fought
//   start      where you stand (and `yaw`) while choosing a side
//   lines      what your crew say: start, won, lost (by ship's crew)
//   barks      what the two sides shout, now and then: { attack, defend }
//   ends       the card: won, lost, why: { posts, tickets }

// (side: which of the war's sides each is, in galaxy/sides.js: the side you take here is your oath, galaxy/allegiance.js)
const EMPIRE = { id: 'empire', name: 'The Galactic Empire', short: 'Empire', colour: '#9fd0ff', side: 'empire', kinds: [['snowtrooper', 1]] };
const REBELS = { id: 'rebels', name: 'The Rebel Alliance', short: 'Rebellion', colour: '#ff8a5a', side: 'rebel', kinds: [['hothtrooper', 1]] };
const REPUBLIC = { id: 'republic', name: 'The Grand Army of the Republic', short: 'Republic', colour: '#9fd0ff', side: 'republic', kinds: [['clone', 1]] };
const SEPARATISTS = { id: 'separatists', name: 'The Separatist droid army', short: 'Separatists', colour: '#ffb060', side: 'separatists', kinds: [['battledroid', 3], ['superdroid', 1]] };

export const ASSAULTS = {
  hoth: {
    id: 'assault',
    system: 'hoth',
    kind: 'assault',
    name: 'The Battle of Hoth',
    line: 'The walkers are on the plain and the Empire’s troops are coming in behind them. The trench line holds, or Echo Base falls.',
    ride: null,
    start: [120, 300],
    yaw: 0.3,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: { attack: EMPIRE, defend: REBELS },
    posts: [
      { id: 'walkers', name: 'The walkers’ line', at: [240, 330], r: 22, fixed: 'attack' },
      { id: 'trenches', name: 'The trenches', at: [100, 370], r: 24 },
      { id: 'shieldgen', name: 'The shield generator', at: [90, 240], r: 20 },
      { id: 'ioncannon', name: 'The ion cannon', at: [-30, 340], r: 20 },
      { id: 'echobase', name: 'Echo Base’s door', at: [-128, 171], r: 22 },
      { id: 'transports', name: 'The transports', at: [-248, 70], r: 14, fixed: 'defend' },
    ],
    phases: [
      { name: 'The trench line', posts: ['trenches', 'shieldgen'], tickets: 90 },
      { name: 'The ion cannon', posts: ['ioncannon'], tickets: 70 },
      { name: 'Echo Base', posts: ['echobase'], tickets: 60 },
    ],
    tickets: { attack: 90, defend: 140 },
    hideLife: ['snowtrooper', 'hothtrooper'],
    ends: {
      won: 'The field is yours',
      lost: 'The field is lost',
      why: { posts: 'The last post fell, and the base with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'This is it. Everyone to the trenches, or the walkers walk right in.'], ['r2', '(A long, worried whistle.)']],
        falcon: [['han', 'Holding a trench against walkers. Great plan. Whose was it?'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'Pick a side, Morty. Either one, they both lose eventually.'], ['morty', 'Th-that’s not helpful, Rick!']],
        rv: [['walt', 'Pick your ground, Jesse. Then hold it.'], ['jesse', 'Hold it against what, the giant camels?!']],
      },
      won: {
        xwing: [['luke', 'We held. Nobody thought we could.'], ['r2', '(A triumphant, tumbling trill.)']],
        falcon: [['han', 'Well. Would you look at that.'], ['chewie', '(A long, victorious howl.)']],
        cruiser: [['rick', 'Field’s ours, Morty. Don’t get used to it.']],
        rv: [['walt', 'We won. Decisively.'], ['jesse', 'Yeah! Yeah, science!']],
      },
      lost: {
        xwing: [['luke', 'Fall back. Fall back to the transports.']],
        falcon: [['han', 'That’s it, we’re done here. Everybody out.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'It’s Hoth, Morty. Everybody loses on Hoth.']],
        rv: [['walt', 'We lost the field. Not the war.']],
      },
    },
    barks: {
      attack: [['Snowtrooper', 'Forward! The walkers have the trench line in range!'], ['Snowtrooper', 'Take the generator. Then the cannon.'], ['Snowtrooper', 'Rebels in the trenches, sir. Lots of them.']],
      defend: [['Rebel trooper', 'Here they come! Hold your positions!'], ['Rebel trooper', 'Don’t let them get to the generator!'], ['Rebel trooper', 'Where are those snowspeeders?']],
    },
  },
  geonosis: {
    id: 'assault',
    system: 'geonosis',
    kind: 'assault',
    name: 'The Battle of Geonosis',
    line: 'Gunships on the plain, droids pouring out of the foundries, and the arena where it all began. The Clone Wars start here.',
    ride: null,
    start: [160, 230],
    yaw: -1.4,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: { attack: REPUBLIC, defend: SEPARATISTS },
    posts: [
      { id: 'landing', name: 'The landing zone', at: [260, 170], r: 24, fixed: 'attack' },
      { id: 'command', name: 'The forward command post', at: [120, 330], r: 18 },
      { id: 'ridge', name: 'The ridge', at: [100, 150], r: 18 },
      { id: 'gate', name: 'The arena gate', at: [-170, 150], r: 20 },
      { id: 'arena', name: 'The arena floor', at: [-260, 200], r: 26 },
      { id: 'flank', name: 'The arena’s flank', at: [-190, 215], r: 14, fixed: 'defend' },
    ],
    phases: [
      { name: 'The plain', posts: ['command', 'ridge'], tickets: 100 },
      { name: 'The arena gate', posts: ['gate'], tickets: 80 },
      { name: 'The arena', posts: ['arena'], tickets: 70 },
    ],
    tickets: { attack: 100, defend: 150 },
    hideLife: ['clone', 'battledroid', 'superdroid'],
    ends: {
      won: 'The arena is yours',
      lost: 'The arena is lost',
      why: { posts: 'The last post fell, and the arena with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'This is where the Clone Wars began. Ben told me about it.'], ['r2', '(A grim, remembering beep: Artoo was here.)']],
        falcon: [['han', 'Clones against droids. Pick whichever side you think wins.'], ['chewie', '(A doubtful growl.)']],
        cruiser: [['rick', 'Robots versus clones, Morty. The most expensive argument in the galaxy.'], ['morty', 'Which side are we on?'], ['rick', 'Whichever one you pick, Morty.']],
        rv: [['jesse', 'Yo, it’s like a million robots out there.'], ['walt', 'Then we don’t miss.']],
      },
      won: {
        xwing: [['luke', 'The arena’s ours. Begun, the Clone War has.'], ['r2', '(A proud whistle.)']],
        falcon: [['han', 'Not bad for a bunch of toy soldiers.'], ['chewie', '(A satisfied rumble.)']],
        cruiser: [['rick', 'We won a war that lasts three more years, Morty. Congratulations.']],
        rv: [['walt', 'That’s how it’s done.'], ['jesse', 'We’re like, actual soldiers now!']],
      },
      lost: {
        xwing: [['luke', 'We’re pulling back. There’ll be another day.']],
        falcon: [['han', 'That’s it. Fall back to the ships.']],
        cruiser: [['morty', 'We lost, Rick!'], ['rick', 'Everybody loses the Clone Wars, Morty. That’s the point of them.']],
        rv: [['walt', 'Regroup. We go again.']],
      },
    },
    barks: {
      attack: [['Clone trooper', 'Move up! Move up!'], ['Clone trooper', 'Droids on the ridge, keep your heads down!'], ['Clone commander', 'Take the gate. The arena’s behind it.']],
      defend: [['Battle droid', 'Roger, roger.'], ['Battle droid', 'Hold the command post! Hold it!'], ['Super battle droid', 'Halt. Identify.']],
    },
  },
};
