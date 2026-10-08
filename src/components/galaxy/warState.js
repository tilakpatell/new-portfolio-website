// The galaxy's war as this page knows it: the tally of what the players have
// done (universe/tally.js, keyed by gcw.js's pointsKey and winKey), kept in
// localStorage for the campaign and passed between pilots online (the scene
// hands it what comes in, warfront.js sends it). One for the page, so the
// holotable (HoloMap.jsx) and the scene read the same war.
//
// All three of the galaxy's wars are in the one tally (a key's side says
// which: gcw.js's pointsKey). It keeps a campaign's keys (KEYS), far more
// than a message holds, so it goes out a page at a time (tally.js), and
// every pilot's history comes to the same. You're known in it by a tally id
// made for the campaign and kept in tp-gcw with your shares, so a reload (a
// new peer id online) isn't counted as a second pilot with the same points.
//
// The war's worked out from a checkpoint (gcw.js's campaignRun): the war as
// it stood after the last whole step, kept, so each second's table works
// only the step that's on now, and a new step only that step. It's worked
// through from the start again only when what changed is behind it (points
// told of from steps back); your own, scored in the step that's on, aren't.
//
// warTally(now) → the campaign's tally (a new one when a campaign starts);
// addPoints(side, sys, step, points), addWin(side, sys, step) (nothing for
// nobody's side, or the Hutts'); receiveWar(peer, msg) → whether it learnt
// anything; warMessage(); onWar(fn) → off (told when it changes);
// warNow(now, war) → gcw.js's warTable for now, and `previous`, the campaign
// before's result for the first RECAP of the next (as this browser knew
// it), or null; mine(war, now) → { points,
// wins, battles, systems: [{ id, wins, losses, moved }], major }: your own
// record in a war this campaign (ranks.js names you by its points; moved is
// how much of a system's hold you moved), gone over once for each change to
// the tally.

import { TALLY, createTally } from '../universe/tally';
import { GCW, WAR_SYSTEMS, campaignAt, campaignResult, campaignRun, pointsKey, readKey, runAt, tableOf, winKey } from './gcw';
import { soft } from './gcwAI';
import { DEFAULT_WAR, SIDES, WAR_IDS, warOfSide } from './sides';

const KEY = 'tp-gcw';
const LAST_KEY = 'tp-gcw-last';
// how long into a campaign the one before's result is shown (the war table's `previous`)
export const RECAP = 12 * 3600e3;
export const CAP = 60; // the most one pilot can have done at one system in one step (four objectives, a sky full of fighters)
// the keys a campaign keeps, at most: a room of pilots, each in a battle every step of it, and winning it
export const KEYS = TALLY.pilots * 2 * (GCW.campaign / GCW.step);
let tally = null;
let version = 0;
let saveLater = null;
const subs = new Set();
let runs = {}; // war → { n, tally, low (the earliest step changed since it was last worked on), run }
// (something changed at a step: a run that's worked past it must start again)
const touch = (step) => {
  for (const r of Object.values(runs)) r.low = Math.min(r.low, step);
};

const newId = () => [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
const store = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};
const changed = () => {
  version += 1;
  for (const fn of subs) fn(version);
  if (saveLater) return;
  saveLater = setTimeout(() => {
    saveLater = null;
    try {
      store()?.setItem(KEY, JSON.stringify(tally.save()));
    } catch {
      // (private browsing: the war's still shared, just not kept)
    }
  }, 1500);
};

// The campaign before's result in each war, as this browser knew it: worked
// out once, when a campaign's tally gives way to the next one's (the page
// open across the change, or back with the last one's kept in tp-gcw), and
// kept in tp-gcw-last. Pilots online only ever tell each other the campaign
// that's on, so a newcomer can't know how the last one ended, and gets none.
let last = null; // { n, wars: { war: campaignResult } }
function keepLast(n, t) {
  last = { n, wars: Object.fromEntries(WAR_IDS.map((war) => [war, campaignResult(war, n, (k) => t.value(k))])) };
  try {
    store()?.setItem(LAST_KEY, JSON.stringify(last));
  } catch {
    // (private browsing: kept for this page only)
  }
}
// (what's read back is checked: anything else in tp-gcw-last is nothing)
const isResult = (r, n) => r && r.n === n && r.final === true && SIDES[r.winner] && r.vp && Object.values(r.vp).every(Number.isFinite) && (r.decisive === null || WAR_SYSTEMS.includes(r.decisive));
function previousOf(war, now) {
  const c = campaignAt(now);
  if (c.n < 1 || now - c.start >= RECAP) return null;
  if (last?.n !== c.n - 1) {
    try {
      last = JSON.parse(store()?.getItem(LAST_KEY) ?? 'null');
    } catch {
      last = null;
    }
  }
  const r = last?.n === c.n - 1 ? last.wars?.[war] : null;
  return isResult(r, c.n - 1) ? r : null;
}

export function warTally(now = Date.now()) {
  const { epoch, n } = campaignAt(now);
  if (!tally || tally.epoch !== epoch) {
    let saved = null;
    try {
      saved = JSON.parse(store()?.getItem(KEY) ?? 'null');
    } catch {
      // (nothing kept, or nothing readable: a fresh campaign)
    }
    // the campaign before's, if this page or the save was there for it
    const before = `c${n - 1}`;
    let was = tally?.epoch === before ? tally : null;
    if (!was && saved?.e === before) {
      was = createTally(before, { keys: KEYS, cap: CAP });
      was.load(saved);
    }
    if (was) keepLast(n - 1, was);
    // (a new id, unless the save has the campaign's: its shares were told under that one)
    tally = createTally(epoch, { keys: KEYS, cap: CAP, id: newId() });
    tally.load(saved);
    // (kept at once, even with nothing in it: back after the campaign's over, this browser knows it was here)
    try {
      store()?.setItem(KEY, JSON.stringify(tally.save()));
    } catch {
      // (private browsing: the war's still shared, just not kept)
    }
    version += 1;
  }
  return tally;
}

export function addPoints(side, sys, step, points, now = Date.now()) {
  if (!(points > 0) || !warOfSide(side)) return;
  warTally(now).add(pointsKey(side, sys, step), points);
  touch(step);
  changed();
}
export function addWin(side, sys, step, now = Date.now()) {
  if (!warOfSide(side)) return;
  const t = warTally(now);
  if (t.mine(winKey(side, sys, step)) >= 1) return;
  t.add(winKey(side, sys, step), 1);
  touch(step);
  changed();
}
export function receiveWar(peer, msg, now = Date.now()) {
  const learnt = warTally(now).receive(peer, msg);
  // (what it learnt could be from any step)
  if (learnt) (touch(0), changed());
  return learnt;
}
export const warMessage = (now = Date.now()) => warTally(now).message();
export const warVersion = () => version;
export function onWar(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// a war's history for now, from its run: worked on from where it got to, or
// from the start when it's a new campaign or tally, it's been asked about an
// earlier moment, or a change is behind where it got to
function stateNow(war, now) {
  const t = warTally(now);
  const n = campaignAt(now).n;
  let r = runs[war];
  if (!r || r.n !== n || r.tally !== t || r.low < r.run.s.k) runs[war] = r = { n, tally: t, low: Infinity, run: campaignRun(war, n, (k) => t.value(k)) };
  const s = runAt(r.run, now);
  r.low = Infinity;
  return s;
}

// a war's table for now (worked out at most once a second, or when the tally changes)
let cached = {};
export function warNow(now = Date.now(), war = DEFAULT_WAR) {
  warTally(now);
  const second = Math.floor(now / 1000);
  const c = cached[war];
  if (!c || c.second !== second || c.version !== version) cached[war] = { second, version, table: { ...tableOf(war, now, stateNow(war, now)), previous: previousOf(war, now) } };
  return cached[war].table;
}

// your own record in a war this campaign: the points you scored (your share
// of each key, not anyone else's), the battles you were in, those your side
// won and those the other side did, whether one you won was the major
// order's (in the war as it went, players and all: its every step's major),
// and how much of each system's hold you moved: your share of what your
// side's points and win did there, as the war counts them (softly)
let records = {}; // war → { n, version, record }
export function mine(war, now = Date.now()) {
  const t = warTally(now);
  const n = campaignAt(now).n;
  const kept = records[war];
  if (kept && kept.n === n && kept.version === version) return kept.record;
  let points = 0;
  const fought = new Map(); // `${sys}:${step}` → { sys, step, side }
  const won = new Set();
  const winners = new Map(); // `${sys}:${step}` → the sides anyone's told won there
  for (const key of t.keys()) {
    const k = readKey(key);
    if (!k || k.war !== war) continue;
    const at = `${k.sys}:${k.step}`;
    if (k.win && t.value(key) >= 1) winners.set(at, (winners.get(at) ?? new Set()).add(k.side));
    if (!(t.mine(key) > 0)) continue;
    if (!fought.has(at)) fought.set(at, { sys: k.sys, step: k.step, side: k.side });
    if (k.win) won.add(at);
    else points += t.mine(key);
  }
  const bySys = new Map();
  let major = false;
  let majors = null;
  for (const [at, b] of fought) {
    const row = bySys.get(b.sys) ?? { id: b.sys, wins: 0, losses: 0, moved: 0 };
    bySys.set(b.sys, row);
    // (what the side did there, and your part of it, in hundredths of the hold: its points, and its win counted once)
    const pk = pointsKey(b.side, b.sys, b.step);
    const wk = winKey(b.side, b.sys, b.step);
    const win = t.value(wk) >= 1 ? GCW.points.win : 0;
    const all = t.value(pk) + win;
    const yours = t.mine(pk) + (win ? (win * t.mine(wk)) / t.value(wk) : 0);
    if (all > 0) row.moved += (soft(all / 100) * yours) / all;
    if (won.has(at)) {
      row.wins += 1;
      majors ??= stateNow(war, now).majors;
      if (majors[b.step] === b.sys) major = true;
    } else if ([...(winners.get(at) ?? [])].some((side) => side !== b.side)) row.losses += 1;
  }
  const systems = [...bySys.values()].map((x) => ({ ...x, moved: +x.moved.toFixed(4) })).sort((a, b) => a.id.localeCompare(b.id));
  const record = { points: +points.toFixed(2), wins: won.size, battles: fought.size, systems, major };
  records[war] = { n, version, record };
  return record;
}

// (for the tests: forget the page's war)
export function resetWar() {
  tally = null;
  last = null;
  cached = {};
  runs = {};
  records = {};
  clearTimeout(saveLater);
  saveLater = null;
}
