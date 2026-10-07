// The cockpits the site opens in, after the opening crawl: you're in the
// pilot's seat (the driver's, in the RV) and look about with the mouse, or
// a drag on a touch screen, then go: the Falcon and the X-wing jump to
// lightspeed, Rick opens a portal ahead of the cruiser, and the RV takes the
// long drive into the night. Each comes out at the front door's choice, over
// the universe. Pure data: the overlay offers them and the scene builds the
// one picked (./vehicles/<id>.js).
//
// `seat` says who you are; `go` is the button that launches; `lines` are
// said in the cockpit, [speaker, text, clip?] as in the universe's crews
// (lib/clips.js): `board` one after another once you're sat down, `launch`
// as you go, and the RV's `wings`, `lift` and `chase` on the long drive, as
// its wings come out, as it leaves the road and as Hank comes after it
// (vehicles/rv.js says those). `ship` is the universe map's ship it is
// (universe/crews.js): the launch comes out in the universe, flying it,
// and `arrive` the sector it comes out in, when it isn't home (Rick's
// portal opens on his dimension).

export const VEHICLES = [
  {
    id: 'falcon',
    name: 'The Millennium Falcon',
    short: 'Falcon',
    seat: 'You’re in Han’s seat',
    crew: 'with Chewie',
    face: 'chewie',
    go: 'Punch it',
    going: 'Jumping to lightspeed',
    ship: 'falcon',
    lines: {
      board: [['chewie', '[a low, impatient growl: they’re ready when you are]']],
      launch: [['chewie', '[a roar: punch it]', 'chewieRoar']],
    },
  },
  {
    id: 'xwing',
    name: 'Red Five, an X-wing',
    short: 'X-wing',
    seat: 'You’re Luke',
    crew: 'with Artoo',
    face: 'r2',
    go: 'Lightspeed',
    going: 'Jumping to lightspeed',
    ship: 'xwing',
    lines: {
      board: [['r2', '[a cheerful whistle: systems are go]']],
      launch: [['r2', '[an excited warble: hold on]', 'r2Whistle']],
    },
  },
  {
    id: 'cruiser',
    name: 'Rick’s space cruiser',
    short: 'Cruiser',
    seat: 'You’re Rick',
    crew: 'with Morty',
    face: 'morty',
    go: 'Portal',
    going: 'Through the portal',
    ship: 'cruiser',
    arrive: 'rickmorty', // (Rick's portal opens on his dimension, the Central Finite Curve: lib/arrival.js)
    lines: {
      board: [['morty', 'Aw geez, Rick, you’re driving? You’ve been drinking all day!']],
      launch: [['rick', 'Wubba lubba dub dub!', 'wubba']],
    },
  },
  {
    id: 'rv',
    name: 'The RV',
    short: 'RV',
    seat: 'You’re at the wheel',
    crew: 'with Jesse and Mr. White',
    face: 'jesse',
    go: 'Hit the road',
    going: 'The long drive',
    ship: 'rv',
    lines: {
      board: [
        ['jesse', 'Yo, you’re driving? Okay. Just stay off the main roads.'],
        ['walt', 'And leave the switch under the dash alone. That’s for emergencies.'],
      ],
      launch: [['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience']],
      wings: [
        ['jesse', 'Yo… Mr. White? Why are there wings coming out of the RV?!'],
        ['walt', 'Because I built them, Jesse. Hold on to something.'],
      ],
      lift: [['jesse', 'We’re flying! Mr. White, we’re actually flying!']],
      chase: [
        ['jesse', 'Yo, Mr. White! It’s Hank! How is Hank flying?!'],
        ['hank', 'Pull over, Heisenberg! I know it’s you in there!'],
        ['walt', 'Say my name.', 'sayMyName'],
      ],
    },
  },
];

const BY_ID = new Map(VEHICLES.map((v) => [v.id, v]));
export const vehicleById = (id) => BY_ID.get(id) ?? null;
export const parseVehicle = (id) => (typeof id === 'string' && BY_ID.has(id) ? id : null);

// The one you sit in when the cockpit opens: the Falcon the first time (the
// crawl before it is Star Wars), and after that a different one from last
// time, so a replay is somewhere new.
export function firstVehicle(last, rand = Math.random) {
  const was = parseVehicle(last);
  if (!was) return VEHICLES[0].id;
  const others = VEHICLES.filter((v) => v.id !== was);
  return others[Math.min(others.length - 1, Math.floor(rand() * others.length))].id;
}

// The next one along, for the number keys and the arrows on the picker.
export function stepVehicle(id, by) {
  const i = Math.max(0, VEHICLES.findIndex((v) => v.id === id));
  return VEHICLES[(i + by + VEHICLES.length) % VEHICLES.length].id;
}
