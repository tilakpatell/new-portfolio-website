import { ABOUT } from '../../guide/abouts';
import { WORLDS, WORLD_MB } from '../../worlds/worlds';
import { ACHIEVEMENTS } from '../../Achievements';
import { worldStop } from './shared';

// The player's tour: what there is to play, in about seven minutes. The
// ship (the map's own basics, briefs.js's '/universe/fly'), the galaxy, the
// worlds, the games, playing together, the checklist and the colours.
// Chapter 1 is the shell (shared.js's SHELL_STOPS); these are 2 to 9, all on
// the map: the worlds are only offered (Go there), never loaded by the tour.

// Star Wars' worlds are the galaxy's chapter; every other world is a card in
// the worlds chapter, in the map's order. Each card is the guide's line on
// it (guide/abouts.js), so a world added to the map has its card once it
// has its basics.
const starWars = (w) => w.from === 'Star Wars';
// each world's row in the checklist (src/data/todo.js), where it has one
const ROW = {
  '/galaxy': 'galaxy',
  '/deathstar': 'deathstar',
  '/music': 'music',
  '/middle-earth': 'middle-earth',
  '/cybertron': 'cybertron',
  '/avengers': 'avengers',
  '/albuquerque': 'albuquerque',
  '/scranton': 'scranton',
  '/c-137': 'c-137',
  '/dot-matrix': 'dot-matrix',
  '/dot-matrix/64': 'mario-tribute',
  '/dot-matrix/minecraft': 'minecraft-tribute',
  '/earth': 'earth',
  '/caribbean': 'dead-mans-tide',
  '/invincible': 'invincible',
};
const card = (w, go) => worldStop(w, ABOUT[w.to], WORLD_MB[w.to], go, ROW[w.to]);
export const worldCards = () => WORLDS.filter((w) => !starWars(w)).map((w) => card(w));
const galaxyCards = () => WORLDS.filter(starWars).map((w) => card(w, w.to === '/galaxy' ? 'Fly to the galaxy' : 'Go there'));

// "Over 240": the count rounded down to the ten below it
const achievements = Math.floor((Object.keys(ACHIEVEMENTS).length - 1) / 10) * 10;

export const PLAYER = [
  {
    id: 'flying',
    title: 'Flying',
    path: '/universe',
    brief: '/universe/fly',
  },
  {
    id: 'galaxy',
    title: 'The galaxy',
    path: '/universe',
    stops: galaxyCards(),
  },
  {
    id: 'worlds',
    title: 'The worlds',
    path: '/universe',
    stops: [
      {
        id: 'worlds-hello',
        title: 'Thirteen more worlds',
        text: 'Each is its own game. Go there leaves the tour; when you’re back, the guide carries on where you left off.',
      },
      ...worldCards(),
    ],
  },
  {
    id: 'games',
    title: 'The games',
    path: '/universe',
    stops: [
      {
        id: 'games',
        title: 'Games all over',
        text: 'The Game Boy on the Home page has three. Dot Matrix has a giant one, Invincible a boss fight, C-137 a dimension of them.',
        actions: [{ label: 'Fly to Dot Matrix', to: '/dot-matrix' }],
      },
    ],
  },
  {
    id: 'together',
    title: 'Together',
    path: '/universe',
    stops: [
      {
        id: 'together',
        title: 'Better with friends',
        text: 'Multiplayer, bottom left, puts you in the universe with whoever else is here, in their own ships and paint. No account: pick a name and you’re in.',
        todo: 'go-online',
      },
      {
        id: 'together-play',
        title: 'Things to do together',
        text: 'Bring down the Citadel of Ricks together, cook in Middle-earth’s kitchens with a friend, or pick a side in the galaxy’s wars.',
        todo: 'shire-kitchen',
      },
    ],
  },
  {
    id: 'checklist',
    title: 'The checklist',
    path: '/universe',
    stops: [
      {
        id: 'checklist',
        at: 'guide',
        title: 'The checklist',
        text: ({ touch } = {}) => `The guide’s checklist lists what there is and ticks off what you’ve done; a row’s Show me takes you to it. ${touch ? 'Tap the ? button' : 'Try ? now'}.`,
        release: ['?'],
      },
      {
        id: 'achievements',
        title: `Over ${achievements} achievements`,
        text: 'Most are secrets, and many unlock something: paint or a part for your ship in the hangar, or a colour for the site.',
        actions: [{ label: 'See yours', to: '/terminal' }],
        todo: 'terminal-achievements',
      },
    ],
  },
  {
    id: 'colours',
    title: 'Colours and scripts',
    path: '/universe',
    stops: [
      {
        id: 'colours-fans',
        title: 'Colours to find',
        todo: 'site-colours',
        text: 'Each company I’ve worked at has its colours. Secrets unlock fan colours too: the Shire, Heisenberg, Optimus, the Black Pearl.',
      },
      {
        id: 'colours-scripts',
        title: 'And scripts to read',
        text: 'Some change the letters too: the site in Aurebesh, Cybertronian or dwarf runes. Read all three and you’re a Polyglot.',
      },
    ],
  },
  {
    id: 'player-end',
    title: 'That’s the tour',
    path: null,
    stops: [
      {
        id: 'player-end',
        title: 'Go and play',
        text: 'Fly somewhere and land. The guide’s checklist keeps what’s left, and the hiring tour shows the work behind the site.',
        actions: [{ label: 'Take the hiring tour', tour: 'recruiter' }],
      },
    ],
  },
];
