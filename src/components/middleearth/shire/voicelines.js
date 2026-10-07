// What Hobbiton's people say aloud, for scripts/voices to make in their own
// voices (its README, "Whose lines"): each line as ShireWorld says it. Not
// the ones the films' own recordings play (SPOKEN), nor the narration.
import { CAST, GANDALF_LINES, INSIDE_TEXT, LOBELIA_LINES, SAYS, SPOKEN } from './rules';

const own = (who, lines) => lines.filter((text) => !SPOKEN[text]).map((text) => ({ who, text }));

export const VOICELINES = [
  ...CAST.flatMap((c) => own(c.id, c.lines)),
  ...own('gandalf', GANDALF_LINES),
  ...own('lobelia', [...LOBELIA_LINES.before, ...LOBELIA_LINES.after]),
  ...Object.values(SAYS),
  ...Object.values(INSIDE_TEXT)
    .filter((t) => t.who)
    .map((t) => ({ who: t.who, text: t.say })),
];
