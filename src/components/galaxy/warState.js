// The galaxy's war as this page knows it: the tally of what the players have
// done (universe/tally.js, keyed by gcw.js's pointsKey and winKey), kept in
// localStorage for the campaign and passed between pilots online (the scene
// hands it what comes in, warfront.js sends it). One for the page, so the
// holotable (HoloMap.jsx) and the scene read the same war.
//
// warTally(now) → the campaign's tally (a new one when a campaign starts);
// addPoints(sys, step, points), addWin(sys, step); receiveWar(peer, msg) →
// whether it learnt anything; warMessage(); onWar(fn) → off (told when it
// changes); warNow(now) → gcw.js's warTable for now.

import { createTally } from '../universe/tally';
import { campaignAt, pointsKey, warTable, winKey } from './gcw';

const KEY = 'tp-gcw';
export const CAP = 60; // the most one pilot can have done at one system in one step (four objectives, a sky full of fighters)
let tally = null;
let version = 0;
let saveLater = null;
const subs = new Set();

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
    tally = createTally(epoch, { cap: CAP });
    try {
      tally.load(JSON.parse(store()?.getItem(KEY) ?? 'null'));
    } catch {
      // (nothing kept, or nothing readable: a fresh campaign)
    }
    version += 1;
  }
  return tally;
}

export function addPoints(sys, step, points, now = Date.now()) {
  if (!(points > 0)) return;
  warTally(now).add(pointsKey(sys, step), points);
  changed();
}
export function addWin(sys, step, now = Date.now()) {
  const t = warTally(now);
  if (t.mine(winKey(sys, step)) >= 1) return;
  t.add(winKey(sys, step), 1);
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

// the war table for now (worked out at most once a second, or when the tally changes)
let cached = null;
export function warNow(now = Date.now()) {
  const t = warTally(now);
  const second = Math.floor(now / 1000);
  if (!cached || cached.second !== second || cached.version !== version) cached = { second, version, table: warTable(now, (k) => t.value(k)) };
  return cached.table;
}

// (for the tests: forget the page's war)
export function resetWar() {
  tally = null;
  cached = null;
  clearTimeout(saveLater);
  saveLater = null;
}
