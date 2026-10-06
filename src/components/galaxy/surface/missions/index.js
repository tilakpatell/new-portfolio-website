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
};

export const missionOf = (system, id) => MISSIONS[system]?.[id] ?? null;
