// The missions you can play down on a world, by system: what each one is
// and the numbers it runs on (./chase.js runs a chase). The galaxy's
// briefing for the system (systems.js, its game) sends you here once one
// is live: /galaxy/<system>/surface?mission=<id>.
//
//   kind       'chase'
//   start      where you start, on the bike, and `yaw`, which way you face
//   waypoints  the scouts' way, from their camp to where they're going
//   scouts     how many; `gaps` (metres along the way at the off), `lanes`
//              (metres to the right of it, negative left), `speeds` (m/s)
//   hp         hits to bring one down
//   stars      seconds: three stars under the first, two under the second
//   lines      what your crew say, by ship's crew: at the off, at the first
//              one down, when one's near the end, and at the end either way
//   ends       how it ended, for the card: `won` and `lost` (its titles),
//              and `why` (a line for each way to lose: `lost` for a chase)
//
// Or kind 'quest': the surface's quest engine (../quests.js) runs it, from
// `start` on `ride` to the end of `quest` (won) or a fail or going down
// (lost: `why` 'time' or 'down'); `stars` are on the whole run, and
// `lines` are `start`, `won` and `lost`.

import { starsFor } from './chase';

export const MISSIONS = {
  endor: {
    chase: {
      id: 'chase',
      system: 'endor',
      kind: 'chase',
      name: 'The speeder bike chase',
      ride: 'speederbike',
      start: [50, 262],
      yaw: -0.92, // (toward the first bend)
      // the scouts' camp, out west through the redwoods and round to the bunker's door
      waypoints: [[60, 250], [-40, 330], [-210, 250], [-300, 70], [-220, -120], [-40, -230], [120, -170], [236, -28]],
      scouts: 4,
      gaps: [70, 95, 120, 150],
      lanes: [-1.3, 1.1, -0.4, 0.8],
      speeds: [31, 32.5, 30, 33.5],
      hp: 4,
      stars: [20, 35],
      achievement: 'speederchase',
      ends: { won: 'Every scout down', lost: 'One got through', why: { lost: 'A scout reached the bunker and raised the alarm.' } },
      lines: {
        start: {
          xwing: [['luke', 'Four of them, and they’re heading for the bunker. After them!'], ['r2', '(An urgent, rising whistle.)']],
          falcon: [['han', 'If they get to that bunker, the whole plan’s blown. Go, go!'], ['chewie', '(A roar, already moving.)']],
          cruiser: [['rick', 'Space cops on hover bikes, Morty. Stop them before they snitch.'], ['morty', 'Why is it always a chase, Rick?']],
          rv: [['jesse', 'Yo, they’re gonna rat us out! Floor it!'], ['walt', 'Lean into the turns, Jesse. Lean.']],
        },
        first: {
          xwing: [['luke', 'One down. Keep on the others!']],
          falcon: [['han', 'That’s one. Don’t get cocky.']],
          cruiser: [['rick', 'One down, Morty. Trees: undefeated.']],
          rv: [['walt', 'One. Stay on them.']],
        },
        close: {
          xwing: [['luke', 'He’s nearly at the bunker!'], ['r2', '(A frantic run of beeps.)']],
          falcon: [['han', 'He’s almost there. Punch it!']],
          cruiser: [['morty', 'Rick, he’s almost at the bunker!'], ['rick', 'I can see that, Morty!']],
          rv: [['jesse', 'He’s almost there, Mr. White!']],
        },
        won: {
          xwing: [['luke', 'That’s all of them. The bunker doesn’t know we’re here.'], ['r2', '(A happy, warbling trill.)']],
          falcon: [['han', 'Nobody’s calling anybody. Nice flying, kid.'], ['chewie', '(A pleased rumble.)']],
          cruiser: [['rick', 'And that’s how you handle a neighbourhood watch, Morty.']],
          rv: [['walt', 'Clean. Not one of them made it.'], ['jesse', 'Yeah, science!']],
        },
        lost: {
          xwing: [['luke', 'He made it. They know we’re here now.']],
          falcon: [['han', 'Great. Now the whole garrison knows.']],
          cruiser: [['morty', 'He got there, Rick. They know.'], ['rick', 'Eh, plan B, Morty: there’s always a plan B.']],
          rv: [['walt', 'One got through. We go again.']],
        },
      },
    },
  },
  lothal: {
    starmap: {
      id: 'starmap',
      system: 'lothal',
      kind: 'quest',
      name: 'The Star Map',
      ride: 'speederbike',
      start: [-16, 10],
      yaw: -0.95, // (toward the first gate)
      stars: [60, 90],
      achievement: 'starmapride',
      ends: {
        won: 'The map is safe',
        lost: 'Shin Hati has the map',
        why: { time: 'Too slow between the spires: Shin Hati reached the tower first.', down: 'Knocked down at the tower, and the map went with her.' },
      },
      lines: {
        start: {
          xwing: [['luke', 'The tower’s out past the spires. Go!'], ['r2', '(A quick, eager whistle.)']],
          falcon: [['han', 'Skip the speeches. Get to that tower.'], ['chewie', '(An impatient bark.)']],
          cruiser: [['rick', 'A space map in a space tower, Morty. Drive.'], ['morty', 'Why does everything have to be a race?']],
          rv: [['walt', 'The tower. Before anyone else gets there.'], ['jesse', 'Through the rocks? Yo, okay.']],
        },
        won: {
          xwing: [['luke', 'The map’s ours, and so’s the tower.'], ['r2', '(A triumphant trill.)']],
          falcon: [['han', 'Not bad. Not bad at all.'], ['chewie', '(A pleased rumble.)']],
          cruiser: [['rick', 'Lightsaber lady, down. Map, ours. Easy.']],
          rv: [['walt', 'We have the map. Now we know where to go.']],
        },
        lost: {
          xwing: [['luke', 'She’s got it. We go again.']],
          falcon: [['han', 'Great. Now somebody else knows the way.']],
          cruiser: [['morty', 'She took it, Rick!'], ['rick', 'So we take it back, Morty.']],
          rv: [['jesse', 'She took it, Mr. White.'], ['walt', 'Then we go again.']],
        },
      },
      quest: {
        id: 'mission-starmap',
        name: 'The Star Map',
        steps: [
          {
            type: 'race',
            ride: 'speederbike',
            // six gates out west between the spires, the last at the tower
            gates: [[-30, 20], [-80, 50], [-140, 40], [-195, 75], [-250, 55], [-295, 62]],
            r: 9,
            time: 40,
            text: 'Race between the spires to the old tower',
          },
          { type: 'use', id: 'map', at: [-311, 63], r: 6, prompt: 'Fit the map together', text: 'Get off the bike, and fit the map together at the tower', end: [{ shake: 0.4 }, { say: [[null, '(Lines of light spill up the tower: a way out past the edge of the galaxy.)']] }] },
          {
            type: 'shoot',
            tag: 'mercs',
            n: 6,
            text: 'Hold the tower: bring down Shin Hati’s mercenaries',
            lines: [[null, '(Engines over the grass. Mercenaries, and they want the map.)']],
            spawn: { kind: 'mercenary', n: 6, at: [-290, 30], spread: 22, roam: 6, speed: 1.4, hp: 2, tag: 'mercs', hostile: { range: 42, every: 2.4, damage: 6, spread: 0.06, chase: 2, delay: 2 } },
          },
          {
            type: 'shoot',
            tag: 'shin',
            n: 1,
            text: 'Bring down Shin Hati',
            lines: [['Shin Hati', 'Give me the map, and walk away.']],
            spawn: { kind: 'shin', at: [-300, 82], hp: 8, leash: 45, roam: 3, tag: 'shin', hostile: { range: 40, chase: 3.2, melee: true, reach: 2.4, every: 1.4, damage: 16, delay: 1 } },
          },
        ],
      },
    },
  },
};

export const missionOf = (system, id) => MISSIONS[system]?.[id] ?? null;

// How a quest mission went, from what the quest engine said: done is won,
// a fail is lost, anything else is still going.
export const outcomeOf = (events) => (events.some((e) => e.type === 'done') ? 'won' : events.some((e) => e.type === 'fail') ? 'lost' : null);

// A quest mission's run: its clock, until it's won or lost (then it holds).
export const newRun = () => ({ phase: 'run', t: 0, result: null });
export const tickRun = (run, dt) => (run.result ? run : { ...run, t: run.t + dt });
export const endRun = (run, mission, how, why) => (run.result ? run : { ...run, result: how === 'won' ? { won: true, t: run.t, stars: starsFor(mission, run.t) } : { won: false, t: run.t, why } });
