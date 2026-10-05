// Which background (components/ambience) a theme gets, and where it shows.
// Plain data, tested in kinds.test.js.

// Each fan theme's family: one scene module per family (scenes/<family>.js),
// the theme itself passed along so a family can tell its members apart.
export const FAMILY = {
  jedi: 'starwars',
  sith: 'starwars',
  heisenberg: 'heisenberg',
  stark: 'stark',
  dunder: 'dunder',
  arcade: 'arcade',
  raga: 'raga',
  tortuga: 'pirates',
  pearl: 'pirates',
  dutchman: 'pirates',
  optimus: 'cybertron',
  megatron: 'cybertron',
  bumblebee: 'cybertron',
  shockwave: 'cybertron',
  soundwave: 'cybertron',
  shire: 'middleearth',
  mordor: 'middleearth',
  portal: 'rickmorty',
  morty: 'rickmorty',
  summer: 'rickmorty',
  beth: 'rickmorty',
};

export const familyFor = (theme) => FAMILY[theme] ?? null;

// The company themes get a quiet motif in CSS (company.css), not a scene.
export const COMPANIES = ['aws', 'rtx', 'bose', 'pendar', 'empowerreg', 'src'];
export const companyFor = (theme) => (COMPANIES.includes(theme) ? theme : null);

// The portfolio's own pages. The worlds, the universe map, the galaxy and
// the Death Star draw their own 3D and get nothing behind them; neither does
// the terminal, which is a screen of its own.
const PAGES = /^\/(home|experience|projects|resume|contact|travel)(\/|$)/;
export const showsOn = (pathname) => PAGES.test(String(pathname || ''));
