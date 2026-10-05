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
// (lib/clips.js); `ship` is the universe map's ship it is
// (universe/crews.js), if any.

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
    face: null,
    go: 'Hit the road',
    going: 'The long drive',
    ship: null,
    lines: {
      board: [['jesse', 'Yo, you’re driving? Okay. Just stay off the main roads.']],
      launch: [['jesse', 'Yeah, Mr. White! Yeah, science!', 'yeahScience']],
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
