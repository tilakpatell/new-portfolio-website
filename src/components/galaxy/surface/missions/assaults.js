// The galactic assaults (kind 'assault': ./assault.js runs one), a map a
// world: the two sides, the command posts on its flats, the attackers' way
// in by phases, and the words. Merged into MISSIONS by ./index.js.
//
//   sides      { attack, defend }: { id, name, short, colour, kinds
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

const EMPIRE = { id: 'empire', name: 'The Galactic Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['snowtrooper', 1]] };
const REBELS = { id: 'rebels', name: 'The Rebel Alliance', short: 'Rebellion', colour: '#ff8a5a', kinds: [['hothtrooper', 1]] };
const REPUBLIC = { id: 'republic', name: 'The Grand Army of the Republic', short: 'Republic', colour: '#9fd0ff', kinds: [['clone', 1]] };
const SEPARATISTS = { id: 'separatists', name: 'The Separatist droid army', short: 'Separatists', colour: '#ffb060', kinds: [['battledroid', 3], ['superdroid', 1]] };

// ── the three worlds' battles (docs/superpowers/specs/2026-10-07-three-worlds-design.md) ──
const STORMTROOPERS = { id: 'empire', name: 'The Galactic Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['stormtrooper', 1]] };
const REBELTROOPERS = { id: 'rebels', name: 'The Rebel Alliance', short: 'Rebellion', colour: '#ff8a5a', kinds: [['rebel', 1]] };
const NEWREPUBLIC = { id: 'newrepublic', name: 'The New Republic', short: 'New Republic', colour: '#ff8a5a', kinds: [['rebel', 1]] };
const REMNANT = { id: 'remnant', name: 'The Imperial Remnant', short: 'Remnant', colour: '#9fd0ff', kinds: [['stormtrooper', 1]] };

// the two sides of each war (sides.js's WARS), as the three worlds' maps
// take them: the raider attacks, the liberator defends, except where a
// map says the other way round
export const WAR_SIDES = {
  clone: { light: REPUBLIC, dark: SEPARATISTS },
  gcw: { light: REBELTROOPERS, dark: STORMTROOPERS },
  remnant: { light: NEWREPUBLIC, dark: REMNANT },
};
export const sidesFor = (war, { attack = 'dark' } = {}) => {
  const w = WAR_SIDES[war] ?? WAR_SIDES.gcw;
  return attack === 'light' ? { attack: w.light, defend: w.dark } : { attack: w.dark, defend: w.light };
};


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

  coruscant: {
    id: 'assault',
    system: 'coruscant',
    kind: 'assault',
    name: 'The Battle of the Temple',
    line: 'Droids on the landing platform and up the Processional Way, and the Temple’s doors held by the clones and the Jedi. The Republic’s own capital, fought for on its steps.',
    ride: null,
    start: [0, 60],
    yaw: Math.PI,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: sidesFor('clone'),
    posts: [
      { id: 'platform', name: 'The landing platform', at: [0, -6], r: 22, fixed: 'attack' },
      { id: 'processional', name: 'The Processional Way', at: [0, 150], r: 12 },
      { id: 'templedoor', name: 'The Temple’s doors', at: [0, 290], r: 22 },
      { id: 'temple', name: 'The Temple steps', at: [0, 400], r: 24, fixed: 'defend' },
    ],
    phases: [
      { name: 'The Processional Way', posts: ['processional'], tickets: 80 },
      { name: 'The Temple’s doors', posts: ['templedoor'], tickets: 70 },
    ],
    tickets: { attack: 90, defend: 120 },
    hideLife: ['clone', 'jedi', 'yoda', 'villager', 'senateguard'],
    ends: {
      won: 'The Temple holds',
      lost: 'The Temple is lost',
      why: { posts: 'The doors fell, and the Temple behind them.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'Droids, on Coruscant. Ben never told me it got this far.'], ['r2', '(A grim, descending whistle.)']],
        falcon: [['han', 'A thousand steps and every one of them a firing line. Terrific.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'It’s a staircase, Morty. The whole battle is a staircase.'], ['morty', 'Th-they’re coming up it, Rick!']],
        rv: [['walt', 'High ground, Jesse. Take it and hold it.'], ['jesse', 'It’s a lot of stairs, Mr. White!']],
      },
      won: {
        xwing: [['luke', 'The doors held.'], ['r2', '(A triumphant trill.)']],
        falcon: [['han', 'Temple’s still standing. Don’t thank me.']],
        cruiser: [['rick', 'Steps are ours, Morty. Nobody’s ever been so proud of stairs.']],
        rv: [['walt', 'We held the high ground.'], ['jesse', 'Yeah, science!']],
      },
      lost: {
        xwing: [['luke', 'They’re in. Fall back through the doors.']],
        falcon: [['han', 'That’s it. Everybody out.']],
        cruiser: [['morty', 'We lost the Temple, Rick.'], ['rick', 'It was always going to burn, Morty.']],
        rv: [['walt', 'We lost the steps. Not the war.']],
      },
    },
    barks: {
      attack: [['Battle droid', 'Roger roger. Up the steps.'], ['Battle droid', 'Clones on the Processional, sir.'], ['Super battle droid', 'Take the doors.']],
      defend: [['Clone trooper', 'Hold the doors! Nothing gets past the steps!'], ['Clone trooper', 'Droids on the platform, lots of them!'], ['Clone trooper', 'Where are the Jedi?']],
    },
  },
  yavin: {
    id: 'assault',
    system: 'yavin',
    kind: 'assault',
    name: 'The Battle of Yavin 4',
    line: 'The Empire comes in across the field for the hangar and the temple, and the Rebellion holds the steps as long as it can. The base, fought for on the ground.',
    ride: null,
    start: [0, -150],
    yaw: Math.PI,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: sidesFor('gcw'),
    posts: [
      { id: 'field', name: 'The landing field', at: [0, -112], r: 26, fixed: 'attack' },
      { id: 'hangar', name: 'The hangar mouth', at: [0, -196], r: 20 },
      { id: 'summit', name: 'The temple steps', at: [0, -240], r: 24 },
      { id: 'throne', name: 'The throne room', at: [0, -256], r: 10, fixed: 'defend' },
    ],
    phases: [
      { name: 'The hangar', posts: ['hangar'], tickets: 80 },
      { name: 'The temple steps', posts: ['summit'], tickets: 70 },
    ],
    tickets: { attack: 90, defend: 120 },
    hideLife: ['rebel', 'rebeltech', 'rebelpilot', 'pilot'],
    ends: {
      won: 'The temple holds',
      lost: 'The temple is lost',
      why: { posts: 'The steps fell, and the base behind them.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'They found the base. Everyone to the hangar!'], ['r2', '(An alarmed whistle.)']],
        falcon: [['han', 'Stormtroopers in the jungle. I told them to move the base.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'Pick a side, Morty. The pyramid’s gonna lose either way.'], ['morty', 'Rick, that’s not—']],
        rv: [['walt', 'Hold the hangar, Jesse.'], ['jesse', 'With what, Mr. White?!']],
      },
      won: {
        xwing: [['luke', 'We held the temple.'], ['r2', '(A tumbling trill.)']],
        falcon: [['han', 'Would you look at that. The kid’s base is still standing.']],
        cruiser: [['rick', 'Pyramid’s ours, Morty.']],
        rv: [['walt', 'We held.'], ['jesse', 'Yeah!']],
      },
      lost: {
        xwing: [['luke', 'Fall back to the transports. Go!']],
        falcon: [['han', 'That’s it. Everybody out.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'Everybody loses a moon, Morty.']],
        rv: [['walt', 'We lost the base. Not the war.']],
      },
    },
    barks: {
      attack: [['Stormtrooper', 'Forward! The hangar’s in range!'], ['Stormtrooper', 'Rebels on the steps, sir.'], ['Stormtrooper', 'Take the temple.']],
      defend: [['Rebel trooper', 'Here they come! Hold the hangar!'], ['Rebel trooper', 'Don’t let them up the steps!'], ['Rebel trooper', 'Where are the fighters?']],
    },
  },
  bespin: {
    id: 'assault',
    system: 'bespin',
    kind: 'assault',
    name: 'The Battle of Cloud City',
    line: 'The Rebellion comes in over Platform 327 to take the city back, and the Empire holds the walkway, the plaza and the tower. Cloud City, fought for on its decks.',
    ride: null,
    start: [0, -200],
    yaw: 0,
    stars: [360, 540],
    achievement: 'galacticassault',
    sides: sidesFor('gcw', { attack: 'light' }),
    posts: [
      { id: 'platform327', name: 'Platform 327', at: [0, -236], r: 24, fixed: 'attack' },
      { id: 'walkway', name: 'The south walkway', at: [0, -150], r: 16 },
      { id: 'plaza', name: 'The plaza', at: [0, 20], r: 26 },
      { id: 'tower', name: 'The tower’s foot', at: [0, 120], r: 22, fixed: 'defend' },
    ],
    phases: [
      { name: 'The south walkway', posts: ['walkway'], tickets: 80 },
      { name: 'The plaza', posts: ['plaza'], tickets: 70 },
    ],
    tickets: { attack: 90, defend: 120 },
    hideLife: ['stormtrooper', 'wingguard', 'ugnaught', 'villager'],
    ends: {
      won: 'The city is ours',
      lost: 'The city is lost',
      why: { posts: 'The plaza fell, and the city with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'Lando’s people are with us. Take the plaza.'], ['r2', '(A determined whistle.)']],
        falcon: [['han', 'Taking Lando’s city back for him. He’d better be grateful.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'It’s a city on a stick, Morty. Don’t fall off.'], ['morty', 'Rick, there are no railings!']],
        rv: [['walt', 'Mind the edge, Jesse.'], ['jesse', 'There’s nothing under us, Mr. White!']],
      },
      won: {
        xwing: [['luke', 'The city’s free.'], ['r2', '(A triumphant trill.)']],
        falcon: [['han', 'Lando owes me. Again.']],
        cruiser: [['rick', 'City’s ours, Morty. Still on a stick.']],
        rv: [['walt', 'We took it.'], ['jesse', 'Yeah, science!']],
      },
      lost: {
        xwing: [['luke', 'Fall back to the platform. Go!']],
        falcon: [['han', 'That’s it. Back to the Falcon.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'Clouds, Morty. Nobody holds clouds.']],
        rv: [['walt', 'We lost the city. Not the war.']],
      },
    },
    barks: {
      attack: [['Rebel trooper', 'Forward! Take the walkway!'], ['Rebel trooper', 'Troopers on the plaza, sir.'], ['Rebel trooper', 'For Lando!']],
      defend: [['Stormtrooper', 'Hold the walkway! Nothing reaches the plaza!'], ['Stormtrooper', 'Rebels on 327, lots of them!'], ['Stormtrooper', 'Lord Vader will hear of this.']],
    },
  },
};
