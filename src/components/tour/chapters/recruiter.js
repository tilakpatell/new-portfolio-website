import { CONTACT_ACTIONS } from './shared';

// The hiring tour (`recruiter`): the work, in about five minutes. The pages,
// the projects, the résumé, and the engineering under the site, every stop
// on a light route; chapter 1 is the shell (shared.js's SHELL_STOPS), these
// are 2 to 8. The engineering lines come from the research's shortlist
// (docs/research/2026-10-07-tours-and-ui-audit/things-to-do.md), each
// checked against the code.

// the button that offers the universe on a phone, with its download
const openUniverse = ({ mb } = {}) => (mb?.['/universe'] ? `Open the universe map · ${mb['/universe']} MB` : 'Open the universe map');

export const RECRUITER = [
  {
    id: 'home',
    title: 'Home',
    path: '/home',
    stops: [
      {
        id: 'home-open',
        at: 'home-open',
        title: 'What I’m looking for',
        text: 'Technical program manager and software engineer roles, from May 2027. Everything after this is the evidence.',
      },
      {
        id: 'home-gameboy',
        at: 'home-gameboy',
        title: 'A Game Boy, playable',
        text: 'A Game Boy you can play here, with three games I wrote for it: a platformer of four worlds, Block Drop and Snake.',
        todo: 'gameboy-home',
      },
      {
        id: 'home-github',
        at: 'home-github',
        title: 'Live from GitHub',
        text: 'A year of contributions, the repositories and their languages, read live from GitHub, with a saved copy if GitHub is down.',
        todo: 'github-live',
      },
    ],
  },
  {
    id: 'experience',
    title: 'Experience',
    path: '/experience',
    stops: [
      {
        id: 'experience-roles',
        at: 'experience-roles',
        wait: true, // the title fades in
        title: 'Six roles, AWS first',
        text: 'Every role, newest first, each with a diagram drawn from the work, and the site in its company’s colours as you scroll.',
        todo: 'experience',
      },
      {
        id: 'experience-track',
        at: 'experience-track',
        title: 'Program management or engineering',
        text: 'Hiring for one or the other? This dims the roles on the other track, and the address keeps it, so the link opens that way.',
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    path: '/projects',
    stops: [
      {
        id: 'projects-featured',
        at: 'projects-featured',
        title: 'Four, each with a live demo',
        text: 'A Game Boy emulator in C++ that passes all eleven of Blargg’s CPU tests, a translator, a cloud IDE and a merged Copilot pull request.',
        actions: [{ label: 'Boot the Game Boy emulator', to: '/projects/gameboy-emulator' }],
        todo: 'gameboy-emulator',
      },
      {
        id: 'projects-table',
        at: 'projects-table',
        title: 'What they’re made of',
        text: 'The projects as a periodic table of what they’re built with. Pick an element, CUDA say, to see the projects that use it.',
        todo: 'projects',
      },
    ],
  },
  {
    id: 'resume',
    title: 'The résumé',
    path: '/resume',
    stops: [
      {
        id: 'resume-skills',
        at: 'resume-skills',
        title: 'Filter it by skill',
        text: 'Click a skill, Python or MCP say, and every line that uses it lights up. The address keeps the pick, so you can send it.',
        todo: 'resume',
      },
      {
        id: 'resume-pdf',
        at: 'resume-pdf',
        title: 'Or take the PDF',
        text: 'The same résumé on one page. Download the PDF here, or from the contact page.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    path: '/contact',
    stops: [
      {
        id: 'contact-copy',
        at: 'contact-copy',
        title: 'The address, copied',
        text: 'One click puts my email address on your clipboard, to write from wherever you like.',
        todo: 'contact',
      },
      {
        id: 'contact-form',
        at: 'contact-form',
        title: 'Or send a memo',
        text: 'Write to me as a Dunder Mifflin memo. It opens your own email app with the memo filled in; nothing is sent from the page.',
      },
    ],
  },
  {
    id: 'hood',
    title: 'Under the hood',
    path: '/universe',
    // the universe is a big download on a phone: there, these chapters take
    // its place (lib/tour's planFor, on a coarse pointer), told from the
    // ship's log and the terminal, and the universe is offered
    heavy: true,
    phone: [
      {
        id: 'hood-changes',
        title: 'Under the hood',
        path: '/changes',
        stops: [
          {
            id: 'hood-changes-log',
            at: 'changes-log',
            title: 'A site that improves itself',
            text: 'A scheduled Claude session makes one change at a time, checks it in a browser, merges it, and writes it here in the ship’s log.',
            todo: 'changes',
          },
        ],
      },
      {
        id: 'hood-terminal',
        title: 'Under the hood',
        path: '/terminal',
        stops: [
          {
            id: 'hood-terminal-input',
            at: 'terminal-input',
            title: 'The terminal',
            text: 'The whole site from a command line, every command reading the same data as the pages. The universe adds a flight model and multiplayer, a bigger download.',
            actions: [{ label: openUniverse, to: '/universe' }],
            todo: 'terminal',
          },
        ],
      },
    ],
    stops: [
      {
        id: 'hood-map',
        title: 'The universe, in Three.js',
        text: 'The universe is the same site in Three.js, with a flight model and planets mostly made in code, on a static host.',
        todo: 'universe',
      },
      {
        id: 'hood-ships',
        at: 'ships',
        wait: true, // the map's panel and buttons come after its first frames
        title: 'Ships with real numbers',
        text: ({ ship } = {}) =>
          `${ship ? 'Your ship' : 'Pick a ship'}: hangar parts draw on a power budget, and their mass and thrust feed the flight model. A heavier ship turns slower.`,
        todo: 'hangar',
      },
      {
        id: 'hood-online',
        at: 'online',
        wait: true, // the map's panel and buttons come after its first frames
        title: 'Multiplayer, with no back end',
        text: 'Players online fly beside you, with no server of my own: every message is signed and sent over public Nostr relays.',
        todo: 'go-online',
      },
      {
        id: 'hood-navmap',
        at: 'navmap',
        wait: true, // the map's panel and buttons come after its first frames
        title: 'Routing, tested',
        text: 'The nav map’s routes and trip times are plain data, tested in Node like the site’s other rules: over five hundred test files.',
        todo: 'nav-map',
      },
      {
        id: 'hood-under',
        title: 'And under all of it',
        text: 'A scheduled Claude session improves the site one checked change at a time, logged in the ship’s log; the terminal reads the same data as the pages.',
        actions: [
          { label: 'See the ship’s log', to: '/changes' },
          { label: 'Open the terminal', to: '/terminal' },
        ],
        todo: 'changes',
      },
    ],
  },
  {
    id: 'recruiter-end',
    title: 'That’s the tour',
    path: null,
    stops: [
      {
        id: 'recruiter-end',
        title: 'That’s the work',
        text: 'Thanks for looking. The PDF, my email and LinkedIn are here; the guide’s “The site” tab has this tour again, and the player’s.',
        actions: [...CONTACT_ACTIONS, { label: 'Take the player’s tour', tour: 'player' }],
      },
    ],
  },
];
