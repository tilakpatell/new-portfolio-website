// The galaxy's war as this page knows it: the tally of what the players have
// done (universe/tally.js, keyed by gcw.js's pointsKey and winKey), kept in
// localStorage for the campaign and passed between pilots online (the scene
// hands it what comes in, warfront.js sends it). One for the page, so the
// holotable (HoloMap.jsx) and the scene read the same war.
//
// All three of the galaxy's wars are in the one tally (a key's side says
// which: gcw.js's pointsKey). You're known in it by a tally id made for the
// campaign and kept in tp-gcw with your shares, so a reload (a new peer id
// online) isn't counted as a second pilot with the same points.
//
// warTally(now) → the campaign's tally (a new one when a campaign starts);
// addPoints(side, sys, step, points), addWin(side, sys, step) (nothing for
// nobody's side, or the Hutts'); receiveWar(peer, msg) → whether it learnt
// anything; warMessage(); onWar(fn) → off (told when it changes);
// warNow(now, war) → gcw.js's warTable for now; mine(war, now) → { points,
// wins, battles, systems: [{ id, wins, losses }], major }: your own record
// in a war this campaign (ranks.js names you by its points).

import { createTally } from '../universe/tally';
import { GCW, campaignAt, history, pointsKey, readKey, warTable, winKey } from './gcw';
import { DEFAULT_WAR, warOfSide } from './sides';

const KEY = 'tp-gcw';
export const CAP = 60; // the most one pilot can have done at one system in one step (four objectives, a sky full of fighters)
let tally = null;
let version = 0;
let saveLater = null;
const subs = new Set();

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

export function warTally(now = Date.now()) {
  const { epoch } = campaignAt(now);
  if (!tally || tally.epoch !== epoch) {
    // (a new id, unless the save has the campaign's: its shares were told under that one)
    tally = createTally(epoch, { cap: CAP, id: newId() });
    try {
      tally.load(JSON.parse(store()?.getItem(KEY) ?? 'null'));
    } catch {
      // (nothing kept, or nothing readable: a fresh campaign)
    }
    version += 1;
  }
  return tally;
}

export function addPoints(side, sys, step, points, now = Date.now()) {
  if (!(points > 0) || !warOfSide(side)) return;
  warTally(now).add(pointsKey(side, sys, step), points);
  changed();
}
export function addWin(side, sys, step, now = Date.now()) {
  if (!warOfSide(side)) return;
  const t = warTally(now);
  if (t.mine(winKey(side, sys, step)) >= 1) return;
  t.add(winKey(side, sys, step), 1);
  changed();
}
export function receiveWar(peer, msg, now = Date.now()) {
  const learnt = warTally(now).receive(peer, msg);
  if (learnt) changed();
  return learnt;
}
export const warMessage = (now = Date.now()) => warTally(now).message();
export const warVersion = () => version;
export function onWar(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// a war's table for now (worked out at most once a second, or when the tally changes)
let cached = {};
export function warNow(now = Date.now(), war = DEFAULT_WAR) {
  const t = warTally(now);
  const second = Math.floor(now / 1000);
  const c = cached[war];
  if (!c || c.second !== second || c.version !== version) cached[war] = { second, version, table: warTable(war, now, (k) => t.value(k)) };
  return cached[war].table;
}

// your own record in a war this campaign: the points you scored (your share
// of each key, not anyone else's), the battles you were in, those your side
// won and those the other side did, and whether one you won was the major
// order's
export function mine(war, now = Date.now()) {
  const t = warTally(now);
  let points = 0;
  const fought = new Map(); // `${sys}:${step}` → { sys, step, side }
  const won = new Set();
  for (const key of t.keys()) {
    const k = readKey(key);
    if (!k || k.war !== war || !(t.mine(key) > 0)) continue;
    const at = `${k.sys}:${k.step}`;
    if (!fought.has(at)) fought.set(at, { sys: k.sys, step: k.step, side: k.side });
    if (k.win) won.add(at);
    else points += t.mine(key);
  }
  const bySys = new Map();
  let major = false;
  const n = campaignAt(now).n;
  for (const [at, b] of fought) {
    const row = bySys.get(b.sys) ?? { id: b.sys, wins: 0, losses: 0 };
    bySys.set(b.sys, row);
    if (won.has(at)) {
      row.wins += 1;
      if (!major && history(war, n, GCW.start + n * GCW.campaign + b.step * GCW.step).major === b.sys) major = true;
    } else if (t.keys().some((key) => {
      const o = readKey(key);
      return o?.win && o.war === war && o.side !== b.side && o.sys === b.sys && o.step === b.step && t.value(key) >= 1;
    }))
      row.losses += 1;
  }
  const systems = [...bySys.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { points: +points.toFixed(2), wins: won.size, battles: fought.size, systems, major };
}

// (for the tests: forget the page's war)
export function resetWar() {
  tally = null;
  cached = {};
  clearTimeout(saveLater);
  saveLater = null;
}
