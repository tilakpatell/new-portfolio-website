// The ship's log: every change the autopilot (.claude/skills/autopilot) has
// made to the site, newest first. One file per entry in ./changes/, so two
// runs never fight over one file; scripts/autopilot-log.mjs writes them and
// changes.test.js checks every one. The /changes page reads this.
//
//   id        the entry's number (its file is changes/<id, four digits>.json)
//   date      the day it merged, ISO
//   title     one line, as the pull request was titled
//   kind      one of KINDS
//   summary   two or three sentences: what changed and why it's better
//   routes    the pages it touched, to link to
//   pr        the pull request's number
//   shots     screenshots under /changes/, 960 × 600 WebP, at most two; one
//             named <id>-before.webp is the same view before the change
//   measured  { js: total JS shipped after it, in bytes; note: a number worth saying }
//   session   the Claude session that made it
//   reverted  null, or { date, why } once it has been taken out again

export const KINDS = {
  feature: 'Feature',
  graphics: 'Graphics',
  performance: 'Performance',
  fix: 'Fix',
  content: 'Content',
  infra: 'Under the hood',
};
export const KIND_ORDER = Object.keys(KINDS);

export const REPO = 'https://github.com/tilakpatell/new-portfolio-website';
export const prUrl = (n) => `${REPO}/pull/${n}`;

const files = import.meta.glob('./changes/*.json', { eager: true, import: 'default' });
export const CHANGES = Object.values(files).sort((a, b) => b.id - a.id);

export const pad = (id) => String(id).padStart(4, '0');
export const changeById = (id) => CHANGES.find((c) => c.id === Number(id)) ?? null;

// What to say to any Claude session to undo an entry (the autopilot skill's
// "Undoing a change" is what it then follows).
export const revertPhrase = (c) => `Revert change ${c.id}`;

export const isBefore = (shot) => /-before\.webp$/.test(shot);

export const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// The numbers over the list: how many, since when, how many of each kind,
// how many taken out again.
export function tally(list = CHANGES) {
  const kinds = Object.fromEntries(KIND_ORDER.map((k) => [k, 0]));
  let reverted = 0;
  for (const c of list) {
    kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
    if (c.reverted) reverted++;
  }
  const since = list.length ? list[list.length - 1].date : null;
  return { count: list.length, since, kinds, reverted };
}
