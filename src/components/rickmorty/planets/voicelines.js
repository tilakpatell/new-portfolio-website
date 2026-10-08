// The planets' spoken lines, each under a key for the desktop's voices job
// (scripts/voices/README.md: one recording a key, in the speaker's own
// voice): every line of ./lines.js, as `<planet>.<when>.<n>`, and each
// planet's quests' `intro` and `done` lines as its phase writes them
// (`<planet>.<quest>.<intro|done>.<n>`). Nothing here plays a recording:
// voiceFor(key) is what to make, and the page says a line in its speaker's
// voice by name (galaxy/surface/voicelines.js's voiceFor).

import { LINES } from './lines';
import { PLANET_SITES } from '.';

const said = (lines) => (Array.isArray(lines) ? lines.filter((l) => Array.isArray(l) && typeof l[1] === 'string') : []);

export function voicedLines(lines = LINES, sites = PLANET_SITES) {
  const out = {};
  for (const [id, by] of Object.entries(lines))
    for (const [when, crews] of Object.entries(by))
      said(crews?.cruiser).forEach(([who, text], n) => {
        out[`${id}.${when}.${n}`] = { who, text };
      });
  for (const [id, site] of Object.entries(sites))
    for (const q of site.quests ?? [])
      for (const when of ['intro', 'done'])
        said(q[when]).forEach(([who, text], n) => {
          out[`${id}.${q.id}.${when}.${n}`] = { who, text };
        });
  return out;
}

export const VOICED = voicedLines();
export const voiceFor = (key) => VOICED[key] ?? null;
