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
//   forward?   the attackers' staging distance, metres short of their objective (RULES.forward unless said)
//   hideLife   the site's life kinds kept out of the way while it's fought
//   start      where you stand (and `yaw`) while choosing a side
//   lines      what your crew say: start, won, lost (by ship's crew)
//   barks      what the two sides shout, now and then: { attack, defend }
//   ends       the card: won, lost, why: { posts, tickets }

const EMPIRE = { id: 'empire', name: 'The Galactic Empire', short: 'Empire', colour: '#9fd0ff', kinds: [['snowtrooper', 1]] };
const REBELS = { id: 'rebels', name: 'The Rebel Alliance', short: 'Rebellion', colour: '#ff8a5a', kinds: [['hothtrooper', 1]] };
// (the Empire's garrison on Scarif: shoretroopers, and the death troopers of Krennic's guard)
const SCARIF_EMPIRE = { ...EMPIRE, kinds: [['shoretrooper', 3], ['deathtrooper', 1]] };
// (Rogue One's Pathfinders, off the U-wings into the palms)
const PATHFINDERS = { ...REBELS, kinds: [['rebel', 1]] };
// (the Endor garrison: stormtroopers, and the scouts off their bikes)
const ENDOR_EMPIRE = { ...EMPIRE, kinds: [['stormtrooper', 2], ['scouttrooper', 1]] };
// (General Solo's strike team, and the Ewoks who came out of the trees with them)
const STRIKE_TEAM = { ...REBELS, kinds: [['rebel', 3], ['ewok', 1]] };
const REPUBLIC = { id: 'republic', name: 'The Grand Army of the Republic', short: 'Republic', colour: '#9fd0ff', kinds: [['clone', 1]] };
const SEPARATISTS = { id: 'separatists', name: 'The Separatist droid army', short: 'Separatists', colour: '#ffb060', kinds: [['battledroid', 3], ['superdroid', 1]] };

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
    tickets: { attack: 100, defend: 160 },
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
    tickets: { attack: 100, defend: 165 },
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
  scarif: {
    id: 'assault',
    system: 'scarif',
    kind: 'assault',
    name: 'The Battle of Scarif',
    line: 'The Pathfinders are off the U-wings and into the palms, and the beach is a crossfire between the bunkers and the walkers. The plans go out through the master switch, or they don’t go out at all.',
    ride: null,
    start: [-300, 185],
    yaw: 2.4,
    stars: [420, 600],
    achievement: 'galacticassault',
    sides: { attack: PATHFINDERS, defend: SCARIF_EMPIRE },
    posts: [
      { id: 'landing', name: 'The rebel landing', at: [-320, 200], r: 22, fixed: 'attack' },
      { id: 'beach', name: 'The beach', at: [-290, -180], r: 24 },
      { id: 'bunkers', name: 'The bunker line', at: [-130, -60], r: 20 },
      { id: 'pad9', name: 'Landing Pad Nine', at: [-110, 90], r: 24 },
      { id: 'switch', name: 'The master switch', at: [140, 150], r: 20 },
      { id: 'citadel', name: 'The Citadel’s pad', at: [90, 516], r: 20, fixed: 'defend' },
    ],
    phases: [
      { name: 'The beach', posts: ['beach', 'bunkers'], tickets: 100 },
      { name: 'The landing pads', posts: ['pad9'], tickets: 80 },
      { name: 'The master switch', posts: ['switch'], tickets: 70 },
    ],
    tickets: { attack: 100, defend: 165 },
    hideLife: ['shoretrooper', 'deathtrooper', 'rebel'],
    ends: {
      won: 'The transmission is through',
      lost: 'The beach is lost',
      why: { posts: 'The last post fell, and the switch with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'This is the beach they held. Every one of them knew they weren’t coming back.'], ['r2', '(A low, steady whistle.)']],
        falcon: [['han', 'A beach fight against walkers and the Empire’s best. Pick a side, and pick it quick.'], ['chewie', '(A battle roar.)']],
        cruiser: [['rick', 'Rebels on a beach with no way out, Morty. Classic. Pick the side with the better tan.'], ['morty', 'Th-that’s the Empire, Rick!']],
        rv: [['walt', 'Hold the beach, or hold the switch. Either way you hold something.'], ['jesse', 'Yo, we don’t even have sunscreen.']],
      },
      won: {
        xwing: [['luke', 'The plans are away. It was worth it. All of it.'], ['r2', '(A quiet, proud trill.)']],
        falcon: [['han', 'Didn’t think we’d pull that off. Don’t tell anyone I said so.'], ['chewie', '(A long, victorious howl.)']],
        cruiser: [['rick', 'We won the one where everybody dies, Morty. Enjoy it while it lasts.']],
        rv: [['walt', 'The field is ours.'], ['jesse', 'Beach party! …Too soon?']],
      },
      lost: {
        xwing: [['luke', 'We’re pulling back. The Death Star’s in the sky.']],
        falcon: [['han', 'That’s it. Everybody to the ships, now!']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'It’s Scarif, Morty. Look up.']],
        rv: [['walt', 'We lost the beach. We did not lose the war.']],
      },
    },
    barks: {
      attack: [['Pathfinder', 'Rogue One, we’re with you! Move up the beach!'], ['Pathfinder', 'Walkers! Get to the trees!'], ['Pathfinder', 'Hold the pad! Bodhi needs that gate open!'], ['Pathfinder', 'The switch is out in the open. Cover whoever goes for it.']],
      defend: [['Shoretrooper', 'Rebels on the beach! Get to the bunkers!'], ['Shoretrooper', 'Keep them off the pads. Nobody reaches the tower.'], ['Death trooper', '(A burst of distorted comms chatter.)'], ['Shoretrooper', 'Walkers are coming down the beach. Hold your fire till they’re past.']],
    },
  },
  endor: {
    id: 'assault',
    system: 'endor',
    kind: 'assault',
    name: 'The Battle of Endor',
    line: 'The strike team is out of the village with every Ewok that can carry a spear, and between them and the shield generator there’s a legion of the Emperor’s best troops.',
    ride: null,
    start: [-190, 150],
    yaw: 1.3,
    stars: [420, 600],
    achievement: 'galacticassault',
    sides: { attack: STRIKE_TEAM, defend: ENDOR_EMPIRE },
    posts: [
      { id: 'village', name: 'Bright Tree Village', at: [-210, 150], r: 24, fixed: 'attack' },
      { id: 'scoutcamp', name: 'The scouts’ camp', at: [60, 250], r: 18 },
      { id: 'logtrap', name: 'The log trap', at: [140, 110], r: 18 },
      { id: 'bunker', name: 'The bunker', at: [250, -40], r: 22 },
      { id: 'generator', name: 'The shield generator', at: [400, -230], r: 24 },
      { id: 'platform', name: 'The landing platform', at: [390, -188], r: 14, fixed: 'defend' },
    ],
    phases: [
      { name: 'The forest', posts: ['scoutcamp', 'logtrap'], tickets: 100 },
      { name: 'The bunker', posts: ['bunker'], tickets: 80 },
      { name: 'The shield generator', posts: ['generator'], tickets: 70 },
    ],
    tickets: { attack: 110, defend: 175 },
    // (the staging line nearer than the rule's 100 m: the posts are far
    // apart here and the walk between is through the trees, so with the
    // rule's distance the first minute of the battle was all walking)
    forward: 80,
    hideLife: ['stormtrooper', 'scouttrooper', 'rebel'],
    ends: {
      won: 'The shield is down',
      lost: 'The forest is lost',
      why: { posts: 'The last post fell, and the generator with it.', tickets: 'Your side ran out of reinforcements.' },
    },
    lines: {
      start: {
        xwing: [['luke', 'The fleet’s counting on us. That shield has to come down.'], ['r2', '(A determined beep.)']],
        falcon: [['han', 'Stormtroopers, scouts, walkers, and us and a bunch of teddy bears. Pick a side.'], ['chewie', '(A roar, already moving.)']],
        cruiser: [['rick', 'Space marines versus bears with rocks, Morty. Bet on the bears.'], ['morty', 'Why, Rick?'], ['rick', 'Because they always win, Morty. It’s their planet.']],
        rv: [['walt', 'Through the forest, to the bunker, to the generator. One at a time.'], ['jesse', 'Yo, the little bear guys are coming with us? Sick.']],
      },
      won: {
        xwing: [['luke', 'The shield’s down. Now it’s up to the fleet.'], ['r2', '(A triumphant, tumbling trill.)']],
        falcon: [['han', 'Shield’s down! Lando, you’d better be where you said you’d be.'], ['chewie', '(A long, victorious howl.)']],
        cruiser: [['rick', 'Told you, Morty. The bears.']],
        rv: [['walt', 'Decisively.'], ['jesse', 'Yub nub, Mr. White! Yub nub!']],
      },
      lost: {
        xwing: [['luke', 'Fall back to the village. The fleet’s on its own.']],
        falcon: [['han', 'That’s it, we’re done here. Everybody out.']],
        cruiser: [['morty', 'We lost, Rick.'], ['rick', 'Even the bears have off days, Morty.']],
        rv: [['walt', 'We lost the forest. Regroup.']],
      },
    },
    barks: {
      attack: [['Rebel commando', 'Move up! Get to the bunker!'], ['Rebel commando', 'Scouts on the ridge, keep your heads down!'], ['Ewok', 'Yub nub! Yub nub!'], ['Rebel commando', 'The generator’s behind the bunker. Keep going!']],
      defend: [['Stormtrooper', 'Rebels in the trees! Hold the bunker!'], ['Scout trooper', 'They’re coming through the camp. Fall back to the walkers.'], ['Stormtrooper', 'The shield must stay up. Lord Vader’s orders.'], ['Stormtrooper', 'Watch the ferns. The natives are in them.']],
    },
  },
};
