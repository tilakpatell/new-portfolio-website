// The feel ratchet (docs/superpowers/specs/2026-10-08-game-feel-design.md §1):
// every game that still rolls its own shake, calls a hitstop nothing runs,
// drops a press made a moment early or late, eases its camera by the frame
// rather than by dt, or emits an event nobody answers, as the audit found
// them (docs/research/2026-10-08-game-feel-audit.md). Each list only shrinks:
// a lane that fixes a file takes it off its list, or this fails (the file no
// longer matches); a file that starts doing one of these anew fails too,
// where a sweep can tell (UNANSWERED is per file only: “nobody answers” has
// no one shape to look for).
//
// An entry is { file, pattern } (the old code is still there), or
// { file, lacks } (the answer is still missing); a dead hitstop is also
// { loop, without }: the loop file that would make it real, still without
// the call that does. Paths are under src/components/.

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, ROOT), 'utf8');
const dir = (file) => file.slice(0, file.lastIndexOf('/'));

// every game file under src/components, tests aside
function walk(at = '') {
  const out = [];
  for (const e of readdirSync(new URL(at || './', ROOT), { withFileTypes: true })) {
    const path = at + e.name;
    if (e.isDirectory()) out.push(...walk(`${path}/`));
    else if (/\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) out.push(path);
  }
  return out;
}

export const OWN_SHAKE = [
];

export const DEAD_HITSTOP = [
];

// each without createPress or createCooldownPress in the same file
export const NO_PRESS = [
];

// the walkers’ camera: at once on a cut, else `min(1, dt × k)` a frame
const CUT_EASE = /= jump\b[^;]*\? 1 : Math\.min\(1, dt \* \(/;

export const LINEAR_CAMERA = [
];

export const UNANSWERED = [
];

// The sweeps for a file that starts anew. A shake decaying by dt beside a
// camera; a hitstop with no scaled step in its folder (a `timeScale:` line
// is the scene offering one, not the loop taking it); a jump or hop flag
// read where no press is made, by folder (a game’s plumbing reads the flag
// on its way to the rule); the walkers’ cut-or-ease camera.
const DECAY = /\b(shake|trauma)\s*(=\s*Math\.max\(0,\s*[\w.]*(shake|trauma)\s*-|\*=\s*Math\.exp\(|-=)/;
const FLAG = /\b(input|inp|move|keys)\.(jump|hop)\b|jumpQueued/;
// faithful to their originals on purpose (the spec’s non-goals)
const FAITHFUL = /^(mario64|minecraft)\//;
// the map’s eruption shake on the Middle-earth map, not a game
const NOT_A_GAME = ['middleearth/mapDiorama.js'];

const FILES = walk();
const scaled = (folder) =>
  FILES.filter((f) => dir(f) === folder).some((f) =>
    read(f)
      .split('\n')
      .some((line) => !/timeScale:/.test(line) && /\btimeScale\(|feel\.(step|scale)\(/.test(line)),
  );

const sweeps = {
  OWN_SHAKE: () => FILES.filter((f) => !NOT_A_GAME.includes(f) && /\bcamera\b/.test(read(f)) && DECAY.test(read(f))),
  DEAD_HITSTOP: () => FILES.filter((f) => /\.hitstop\(/.test(read(f)) && !scaled(dir(f))),
  NO_PRESS: () => FILES.filter((f) => !FAITHFUL.test(f) && FLAG.test(read(f)) && !/createPress|createCooldownPress|coyote/.test(read(f))),
  LINEAR_CAMERA: () => FILES.filter((f) => CUT_EASE.test(read(f))),
};

const LISTS = { OWN_SHAKE, DEAD_HITSTOP, NO_PRESS, LINEAR_CAMERA, UNANSWERED };

describe('the feel ratchet', () => {
  for (const [name, list] of Object.entries(LISTS)) {
    describe(name, () => {
      it('names each file once', () => {
        expect(new Set(list.map((e) => e.file)).size).toBe(list.length);
      });

      it.each(list.map((e) => [e.file, e]))('%s still does it (fixed? take it off the list)', (file, e) => {
        const src = read(file);
        if (e.pattern) expect(src).toMatch(e.pattern);
        if (e.lacks) expect(src).not.toMatch(e.lacks);
        if (e.loop) expect(read(e.loop)).not.toMatch(e.without);
        if (name === 'NO_PRESS') expect(src).not.toMatch(/createPress|createCooldownPress/);
      });

      if (sweeps[name]) {
        it('has no file doing it that it doesn’t name', () => {
          const listed = list.map((e) => e.file);
          const found = sweeps[name]();
          // a press is looked for by game folder: the flag passes through a
          // game’s plumbing on its way to the rule that drops it
          const known = name === 'NO_PRESS' ? (f) => listed.some((l) => dir(l) === dir(f)) : (f) => listed.includes(f);
          expect(found.filter((f) => !known(f))).toEqual([]);
        });
      }
    });
  }

  // (at most: each lane takes its own off, so the counts only fall)
  it('holds no more than the audit’s counts', () => {
    expect(OWN_SHAKE.map((e) => e.file).filter((f) => !f.includes('/towns/')).length).toBeLessThanOrEqual(16);
    expect(DEAD_HITSTOP.length).toBeLessThanOrEqual(3);
    expect(NO_PRESS.length).toBeLessThanOrEqual(11);
    expect(UNANSWERED.length).toBeLessThanOrEqual(5);
  });
});
