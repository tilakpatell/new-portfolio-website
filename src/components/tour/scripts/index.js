import { asScript } from '../../../lib/tour';

// The tours by mode, loaded with the runner the first time one starts
// (TourHost). The shell's two (steps.js) run where you are; a world's basics
// (briefs.js) the same, as kind 'brief'. The tours across pages (recruiter,
// player, mixed) come here as scripts of their own, one file each, and MODES
// lists the ones the picker offers.

export const MODES = [];

// the id a tour's outcome is kept under in tp-tour (lib/tour's tourStatus):
// the shell's two share one, since they're the same tour in two views
const SHELL = { status: 'shell', shell: true, achievement: 'tour' };

export async function loadScript(mode) {
  if (mode === 'classic' || mode === 'universe') {
    const { TOURS } = await import('../steps');
    return asScript(mode, TOURS[mode], { title: 'The site', ...SHELL });
  }
  return null;
}

export async function loadBrief(name) {
  const { BRIEFS } = await import('../briefs');
  return BRIEFS[name] ? asScript(name, BRIEFS[name], { title: 'The basics' }) : null;
}
