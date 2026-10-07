// The player's tour: the universe and its ships, the galaxy, the worlds
// worth landing on first and what to do in each, the games, the terminal,
// what there is to find. About five minutes; every world's leg can be
// skipped. A leg is a page (lib/tour.js); a world's leg waits for its 3D
// (or its light version, on a phone that kept it) before its first card. A
// stop lights the thing marked data-tour="name", or sits in the middle: in
// a world, mostly the middle, since the world itself is the thing.

const world = (id, path, title, stops, extra = {}) => ({ id, path, ready: 'world', title, skippable: true, stops, ...extra });

export const PLAYER = {
  id: 'player',
  title: 'For players',
  minutes: 5,
  achievement: 'tour-player',
  legs: [
    {
      id: 'universe',
      path: '/universe',
      ready: 'map',
      title: 'The universe',
      stops: [
        {
          id: 'hello',
          title: 'Every planet is a place',
          text: 'The site is a universe: the stations round the sun are my pages, and every planet out past them is a world you can walk, fly or play. This tour lands on the best of them. Next or → goes on; Esc ends it; skip any world you like.',
          tags: ['taste'],
        },
        {
          id: 'ships',
          at: 'ships',
          title: 'Pick a ship',
          text: 'The Falcon, an X-wing, Rick’s cruiser or the RV: fly it yourself, and the first flight shows you the stick. The nav map (M) has a guided flight past everything.',
        },
        {
          id: 'map',
          at: 'panel',
          title: 'Out there',
          text: 'The hangar (H) has paint and parts. Bounty hunters come after you now and then; shoot at the pip ahead of them. And when the Citadel siege is on, everyone online fights it together.',
        },
      ],
    },
    {
      id: 'galaxy',
      path: '/galaxy/hoth',
      ready: 'world',
      title: 'A galaxy far, far away',
      skippable: true,
      stops: [
        {
          id: 'systems',
          at: 'galaxy-panel',
          title: 'Eighteen systems, three wars',
          text: 'Jump from Tatooine to Hoth to Endor (J jumps, M is the holotable). Swear to a side and your battles count for it: ranks, major orders, and an Interdictor ambush every ten jumps or so.',
        },
        {
          id: 'missions',
          at: 'galaxy-mission',
          title: 'Missions and surfaces',
          text: 'Each system has a briefing. Some are playable: the trench run, the Endor speeder chase, Galactic Assault. Land on a world and walk it as Luke, Leia, Han, Chewie, Ahsoka or Boba, lightsaber or blaster in hand.',
        },
      ],
    },
    world('avengers', '/avengers', 'Avengers HQ', [
      {
        id: 'hq',
        title: 'The compound',
        text: 'You’re Spider-Man: swing, zip, perch. Each building is a game that wins an Infinity Stone, and six Stones open a portal to Titan. Twelve backpacks and a ring course are hidden round the grounds.',
        tags: ['taste'],
      },
    ]),
    world('middleearth', '/middle-earth', 'Middle-earth', [
      {
        id: 'road',
        at: 'me-map',
        title: 'The road to Mount Doom',
        text: 'A map of chapters from Hobbiton to Doom. Every stop has a walk as Frodo, a co-op kitchen with a room code for a friend, and a side game: the Doors of Durin, the Balrog’s bridge, Gorgoroth in the dark. Wax seals mark the ones you’ve won.',
      },
    ]),
    world('scranton', '/scranton', 'Scranton', [
      {
        id: 'office',
        title: 'A week at Dunder Mifflin',
        text: 'Seven jobs as Jim: reception, the stapler in Jell-O, the chili, paper toss, the fire drill, a Dundie. Find the eggs round the office and the awards board fills up.',
      },
    ]),
    world('invincible', '/invincible', 'Invincible', [
      {
        id: 'city',
        title: 'Six kilometres of city',
        text: 'Fly it as Mark: Dad’s ten rings, eight hidden title cards, rescues, the Flaxan portal, the airliner, and up through the air to the Moon and Mars. Think, Mark! is a game of its own in four chapters.',
      },
    ]),
    world('c137', '/c-137', 'Dimension C-137', [
      {
        id: 'dial',
        title: 'The portal gun',
        text: 'The Smiths’ street as Morty, with Rick’s cruiser outside. The dial has thirty-six destinations, each with a micro-quest, and the games are Portal Panic, Total Rickall, the Meeseeks box, interdimensional cable and Roy. The Citadel is down the lift.',
      },
    ]),
    world('albuquerque', '/albuquerque', 'Albuquerque', [
      {
        id: 'aztek',
        at: 'hud',
        title: 'Walt’s Aztek',
        text: 'Drive it (handbrake drifts), make deliveries with Hank’s SUV on your tail, cook to order in Metherria. Places unlock as the career grows. Twelve Blue Sky crystals are out in the desert.',
      },
    ]),
    world('dotmatrix', '/dot-matrix', 'Dot Matrix', [
      {
        id: 'cartridges',
        at: 'cartridges',
        title: 'The games',
        text: 'An island of cartridges, each a real project of mine, and coins to collect. The giant Game Boy, the N64 and the crafting table are doors: Super Mario 64 and Minecraft are through them.',
        tags: ['taste'],
      },
    ]),
    {
      id: 'terminal',
      path: '/terminal',
      ready: 'feed',
      title: 'The terminal',
      stops: [
        {
          id: 'prompt',
          at: 'prompt',
          title: 'The command line',
          text: 'The whole site from a prompt: help, worlds, fly <place>, order66. Typed words work anywhere on the site too, and the Konami code jumps to lightspeed.',
          tags: ['taste'],
        },
        {
          id: 'achievements',
          title: 'What there is to find',
          text: 'About two hundred achievements across the worlds, from the trench run to every ring round the compound; Explorer counts the pages, Seen it all the map. Colour schemes unlock with some of them.',
        },
        {
          id: 'online',
          title: 'You’re not alone',
          text: 'Multiplayer runs over Nostr with no server of mine: the Citadel siege, holograms at HQ, ghost Azteks on the roads, lamps in the music room. The worlds this tour skipped (the Caribbean, Cybertron, the Death Star, Earth, the music room) are on the map.',
        },
      ],
    },
  ],
  end: {
    id: 'done',
    title: 'Go play',
    text: ({ key }) => `That’s the lot. Take it again from ${key} or the guide’s “The site” tab, where the recruiter’s two-minute version lives too.`,
  },
};
