// What the tour says at each stop (components/tour/Tour.jsx). `at` names the
// thing it lights, marked in the page with data-tour="name"; a stop without
// one is a card in the middle. A stop whose thing isn't on this screen is
// left out (lib/tour's resolveSteps): on a phone the nav's links, search and
// colours are in the menu, so the menu's stop shows instead. `text` is a
// string, or a function of { key } (⌘K or Ctrl K, whichever this device uses).
//
// The audience tours (the hiring tour, `recruiter`; the player's; and the
// whole tour, the two folded together) are chapters, not stops:
// chapters/*.js, and shared.js says how they fit.

import { compose } from '../../lib/tour';
import { END } from './chapters/shared';
import { RECRUITER } from './chapters/recruiter';
import { PLAYER } from './chapters/player';

const search = {
  id: 'search',
  at: 'search',
  title: 'Go anywhere',
  release: ['palette'], // an audience tour lets the palette's shortcut through here, to try it
  text: ({ key }) => `${key} searches every page, project, world and shortcut on the site. Type a few letters and press Enter.`,
};
const menu = {
  id: 'menu',
  at: 'menu',
  title: 'The menu',
  text: 'Every page, search, the site’s colours and Start over are in here.',
};
const colours = {
  id: 'colours',
  at: 'colours',
  title: 'A colour for each company',
  text: 'Every company I’ve worked at has its colours. On Auto the site follows the page you’re on; pick one to keep it.',
};
const guide = {
  id: 'guide',
  at: 'guide',
  title: 'Stuck? Press ?',
  release: ['?'],
  text: 'The guide has every page’s controls, for the keyboard or touch, and its tips. Press ? on any page.',
};
const resume = {
  id: 'resume',
  at: 'resume',
  title: 'In a hurry?',
  text: 'My résumé is one click away, from every page.',
};
const done = (where) => ({
  id: 'done',
  title: 'That’s the tour',
  text: ({ key }) => `${where} Take the tour again from ${key} or the guide’s “The site” tab.`,
});

export const TOURS = {
  universe: [
    {
      id: 'hello',
      title: 'A quick look round',
      text: 'My whole site is laid out as a universe. Here’s how to get about, in under a minute. Use the arrow keys or Next; Esc ends it.',
    },
    {
      id: 'panel',
      at: 'panel',
      title: 'Where you are',
      text: 'This panel says what you’re looking at and where it goes. Pick a place on it, or click one on the map, and the camera takes you there.',
    },
    {
      id: 'ships',
      at: 'ships',
      title: 'Pick a ship',
      text: 'Fly it yourself. The stations round the sun are my pages: experience, projects, résumé and contact. The planets further out are worlds I love, and your crew has a word about each.',
    },
    {
      id: 'navmap',
      at: 'navmap',
      title: 'The nav map',
      text: 'Every place by name, with a guided flight past the lot. M opens it while you fly.',
    },
    {
      id: 'view',
      at: 'view',
      title: 'Universe or Classic',
      text: 'Rather read than fly? The classic site is the same site, as pages. The switch is at the top of every page, both ways.',
    },
    search,
    menu,
    colours,
    guide,
    resume,
    done('Fly somewhere: a station is a page, a planet is a world.'),
  ],
  classic: [
    {
      id: 'hello',
      title: 'A quick look round',
      text: 'Here’s how to get about my site, in under a minute. Use the arrow keys or Next; Esc ends it.',
    },
    {
      id: 'pages',
      at: 'pages',
      title: 'The pages',
      text: 'Experience, projects, travel and contact run on as one long page: reach the end of one and the next begins. Music is a room of its own.',
    },
    {
      id: 'view',
      at: 'view',
      title: 'Classic or Universe',
      text: 'The same site, laid out as a universe you fly a ship through. Try it any time: the switch is at the top of every page, both ways.',
    },
    search,
    menu,
    colours,
    {
      id: 'terminal',
      at: 'terminal',
      title: 'The terminal',
      text: 'The whole site from a command line. Type help, and look round: there’s more to find in there.',
    },
    guide,
    resume,
    done('Scroll on, or open a page from the top.'),
  ],
  recruiter: RECRUITER,
  player: PLAYER,
};
// the whole tour: the hiring tour's chapters to Under the hood (which has
// toured the panel, the ship and the nav map, so the player's Flying is
// left out), the player's from the galaxy to the colours, and one end
TOURS.mixed = compose(TOURS, [['recruiter', 'home', 'hood'], ['player', 'galaxy', 'colours'], END]);

// TourHost reads the shell's stops and each audience's hello from here
export { HELLO, SHELL_STOPS } from './chapters/shared';

export const textOf = (step, ctx) => (typeof step.text === 'function' ? step.text(ctx) : step.text);
