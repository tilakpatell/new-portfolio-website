import { asScript } from '../../../lib/tour';

// The tours by mode, loaded with the runner the first time one starts
// (TourHost). The shell's two (steps.js) run where you are; a world's basics
// (briefs.js) the same, as kind 'brief'. The tours across pages (recruiter,
// player, mixed) come here as scripts of their own, one file each, and MODES
// lists the ones the picker offers.

// the tours across pages, as the picker offers them (TourPicker)
export const MODES = [
  { id: 'recruiter', title: 'For recruiters', text: 'Who I am, where I’ve worked, what I’ve built, how to reach me. About two minutes.' },
  { id: 'player', title: 'For players', text: 'The universe, the galaxy, the worlds and what to do in each, the games. About five minutes; skip any world.' },
  { id: 'mixed', title: 'Both', text: 'The work, then a taste of the worlds and games. About three minutes.' },
];

// the id a tour's outcome is kept under in tp-tour (lib/tour's tourStatus):
// the shell's two share one, since they're the same tour in two views
const SHELL = { status: 'shell', shell: true, achievement: 'tour' };

export async function loadScript(mode) {
  if (mode === 'classic' || mode === 'universe') {
    const { TOURS } = await import('../steps');
    return asScript(mode, TOURS[mode], { title: 'The site', ...SHELL });
  }
  if (mode === 'recruiter') return (await import('./recruiter')).RECRUITER;
  if (mode === 'player') return (await import('./player')).PLAYER;
  if (mode === 'mixed') return (await import('./mixed')).MIXED;
  return null;
}

export async function loadBrief(name) {
  const { BRIEFS } = await import('../briefs');
  return BRIEFS[name] ? asScript(name, BRIEFS[name], { title: 'The basics' }) : null;
}
