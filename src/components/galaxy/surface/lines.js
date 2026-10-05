// What the crew say on the ground (over the comms: universe/Comms.jsx):
// climbing out, getting on something to ride, getting back in to leave,
// and finding each place, where a site's place has lines of its own
// (place.lines[crew]) or the world has its own for getting out
// (site.lines.out[crew]).

const GENERIC = {
  xwing: {
    out: [
      ['luke', 'Come on, Artoo. Let’s take a look around.'],
      ['r2', '(A doubtful warble.)'],
    ],
    ride: [['luke', 'Hang on, Artoo. I’ve always wanted to try one of these.']],
    leave: [
      ['luke', 'Back to the ship, Artoo. We’ve seen enough.'],
      ['r2', '(A relieved whistle.)'],
    ],
  },
  falcon: {
    out: [
      ['han', 'Stay close, Chewie. Never know who’s watching.'],
      ['chewie', '(A low growl.)'],
    ],
    ride: [['han', 'Not exactly the Falcon, but she’ll do.']],
    leave: [
      ['han', 'That’s enough sightseeing. Let’s get out of here.'],
      ['chewie', '(An agreeing roar.)'],
    ],
  },
  cruiser: {
    out: [
      ['rick', 'Alright Morty, a galaxy far, far away. Try not to touch anything.'],
      ['morty', 'Rick, is— is that a real lightsaber guy over there?'],
    ],
    ride: [['rick', 'Hover tech, Morty. Primitive, but it’s got a certain charm.']],
    leave: [
      ['rick', 'Back in the ship, Morty. This place is a franchise, not a planet.'],
      ['morty', 'Aw, I wanted to see more…'],
    ],
  },
  rv: {
    out: [
      ['jesse', 'Yo, Mr. White. Are we… are we in Star Wars right now?'],
      ['walt', 'Keep your voice down, Jesse. And don’t touch anything.'],
    ],
    ride: [['jesse', 'Yeah, science! It floats, bitch!']],
    leave: [
      ['walt', 'We’re done here. Get in the RV.'],
      ['jesse', 'Five more minutes, man!'],
    ],
  },
};

export const crewLines = (crewId) => GENERIC[crewId] ?? GENERIC.xwing;

// a crew (galaxy/lines.js's galaxyCrew) with its lines for this world
export function surfaceCrew(crew, site) {
  const g = crewLines(crew.id);
  const events = { ...crew.events };
  events['surface:out'] = site.lines?.out?.[crew.id] ?? g.out;
  events['surface:ride'] = g.ride;
  events['surface:leave'] = site.lines?.leave?.[crew.id] ?? g.leave;
  for (const p of site.places) if (p.lines?.[crew.id]) events[`surface:${p.id}`] = p.lines[crew.id];
  return { ...crew, events };
}
