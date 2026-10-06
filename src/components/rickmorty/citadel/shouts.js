// What the Citadel's people call out as you go about it (the toasts), by who
// says it: all Ricks, so all in Rick's voice (lib/voiced.js's SAME_VOICE),
// made by scripts/voices from the quoted part of each line. Kept as data so
// the line exporter finds them (scripts/voices/export-lines.mjs).

export const SHOUTS = {
  foreman: { who: 'foreman', say: '“You’re on the line, new guy.” Drop each layer on the one below. Whatever hangs over gets cut off.' },
  foremanBack: { who: 'foreman', say: '“Back of the line.” The foreman Rick sends you to the back of the line. Try again.' },
  ad: { who: 'pa', say: '“Come home to the impossible flavor of your own completion. Come home to Simple Rick’s.”' },
  mutter: { who: 'councilc', say: 'Dismissed. On the way out, you hear one of them mutter “the Rickest Rick”. Not as a compliment.' },
  daycare: { who: 'daycare', say: 'The Day Care Rick looks up. “What’s going on out there?” They scatter again.' },
  daycareDone: { who: 'daycare', say: 'All six back in. The Day Care Rick turns a page. “Huh.” He never knew.' },
  copSeen: { who: 'cop', say: '“Hey! C-137!” A Cop Rick’s seen you! Run, and get out of his sight!' },
  copFreeze: { who: 'cop', say: '“Freeze, C-137!” Run, round the core or behind a kiosk!' },
  copGot: { who: 'cop', say: '“Got you.” He’s got you. Break his line of sight!' },
  copGrab: { who: 'cop', say: '“Come here, you.” A Cop Rick grabs your collar. You slip him, and end up back by the booth. Try again.' },
  copLost: { who: 'cop', say: '“Where’d he go?” He’s lost you.' },
  win: { who: 'pa', say: '“Candidate Morty wins in a landslide. His first order: arrest Rick C-137.” Get to your cruiser in the hangar, out of the Cop Ricks’ sight.' },
};
