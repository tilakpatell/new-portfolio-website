// Your standing: what the universe makes of you, from what you've done.
// Three measures a side (sides.js), each −RANGE…RANGE, starting at nought:
// - law: the Empire, the Federation, the DEA (the side's `law` faction).
//   Shoot their fighters and it falls; shoot their patrols' traffic, run
//   from their inspectors or let them find you wanted and it falls faster;
//   kill a capital ship and it crashes. Low enough and you're a `suspect`
//   (their inspectors look harder at you, their patrols going past call you
//   in) and then `wanted` (every scan finds you, and the director sends more
//   of them); high enough and you're `trusted`.
// - civil: the ordinary ships. Rescue someone and it rises (a `hero`, high
//   enough: the merchants are glad to see you); shoot a freighter down and
//   it falls (`feared`, low enough: the ordinary ships run from you on
//   sight, and the merchants want nothing to do with you).
// - outlaw: the pirates. Shoot pirates and it falls; shoot civilians, pay a
//   toll, or kill a capital ship and it rises (a `friend`, high enough:
//   Hondo waves you through).
// It all fades: a point every FADE seconds back toward nought, so nothing
// is forever. Kept per side in storage (createStanding's `storage`, with
// get(key, fallback) and set(key, value): lib/hooks' `local`), so it's
// yours for the visit and the next. Pure (no three.js, no DOM), so it's
// tested in Node; scene.js notes what you do and asks what you are.
//
// createStanding({ storage, key }) → { side(id), note(what, n) → events,
//   tick(dt), value(axis), level(axis), wanted, suspect, trusted, feared,
//   hero, friend, state() }
// Events: { type: 'standing', axis, level, was } when a level changes.

export const AXES = ['law', 'civil', 'outlaw'];
export const RANGE = 6;
export const FADE = 600; // seconds a point takes to fade back toward nought
// what each thing you do is worth: { axis: change }
export const DEEDS = {
  killHunter: { law: -0.5, outlaw: 0.2 }, // one of the law's fighters, after you
  killPatrol: { law: -0.8, outlaw: 0.25 }, // one of their ships in passing, that wasn't
  killCivil: { civil: -1.5, law: -1, outlaw: 0.6 },
  killPirate: { outlaw: -1, civil: 0.4, law: 0.25 },
  rescued: { civil: 1.5, law: 0.4 }, // someone in distress, saved
  helped: { civil: 0.6 }, // someone else's fight, won with your help
  busted: { law: -1.2 }, // an inspector's scan found you wanted
  ran: { law: -1.5 }, // you ran from an inspector
  shotLaw: { law: -2 }, // you fired on one
  clean: { law: 0.3 }, // you stopped, and were clean
  paidToll: { outlaw: 0.6 }, // you held still for a pirate
  angeredPirates: { outlaw: -1 },
  capitalKill: { law: -3, outlaw: 1.2 },
  capitalHurt: { law: -1 }, // a shield part off one
};
// the levels, by threshold: at or past the number, in its direction
export const LEVELS = {
  law: [
    [-4, 'wanted'],
    [-2, 'suspect'],
    [3, 'trusted'],
  ],
  civil: [
    [-3, 'feared'],
    [3, 'hero'],
  ],
  outlaw: [[3, 'friend']],
};

const clamp = (v) => (v < -RANGE ? -RANGE : v > RANGE ? RANGE : v);
// the level a value is at: the furthest threshold passed on its side of nought, or null
export function levelOf(axis, value) {
  let found = null;
  for (const [at, name] of LEVELS[axis] ?? []) {
    if ((at < 0 && value <= at && (found === null || at < found.at)) || (at > 0 && value >= at && (found === null || at > found.at))) found = { at, name };
  }
  return found?.name ?? null;
}

export function createStanding({ storage = null, key = 'tp:universe-standing' } = {}) {
  const all = (storage?.get(key, null) && typeof storage.get(key, null) === 'object' ? storage.get(key, null) : {}) ?? {};
  let sideId = null;
  let cur = null; // { law, civil, outlaw }
  const save = () => {
    if (!storage || !sideId) return;
    all[sideId] = { ...cur, at: Date.now() };
    storage.set(key, all);
  };
  const fresh = () => ({ law: 0, civil: 0, outlaw: 0 });
  const read = (id) => {
    const got = all[id];
    if (!got || typeof got !== 'object') return fresh();
    const out = fresh();
    for (const a of AXES) out[a] = clamp(typeof got[a] === 'number' && Number.isFinite(got[a]) ? got[a] : 0);
    // (what's faded while the page was closed)
    if (typeof got.at === 'number' && Number.isFinite(got.at)) {
      const gone = Math.max(0, (Date.now() - got.at) / 1000) / FADE;
      for (const a of AXES) out[a] = Math.abs(out[a]) <= gone ? 0 : out[a] - Math.sign(out[a]) * gone;
    }
    return out;
  };
  const levels = () => Object.fromEntries(AXES.map((a) => [a, levelOf(a, cur[a])]));
  const changed = (was) => {
    const out = [];
    const now = levels();
    for (const a of AXES) if (now[a] !== was[a]) out.push({ type: 'standing', axis: a, level: now[a], was: was[a] });
    return out;
  };

  return {
    // whose universe you fly in now (null: nobody's, and nothing counts)
    side(id) {
      if (id === sideId) return;
      sideId = id ?? null;
      cur = sideId ? read(sideId) : null;
    },
    get sideId() {
      return sideId;
    },
    // something you did, `n` times over: what levels it changed
    note(what, n = 1) {
      const deed = DEEDS[what];
      if (!deed || !cur) return [];
      const was = levels();
      for (const [a, d] of Object.entries(deed)) cur[a] = clamp(cur[a] + d * n);
      save();
      return changed(was);
    },
    // it all fades, a little a second
    tick(dt) {
      if (!cur) return [];
      const was = levels();
      let any = false;
      for (const a of AXES) {
        if (cur[a] === 0) continue;
        const k = dt / FADE;
        cur[a] = Math.abs(cur[a]) <= k ? 0 : cur[a] - Math.sign(cur[a]) * k;
        any = true;
      }
      if (any && Math.random() < dt / 20) save(); // (now and then)
      return changed(was);
    },
    value: (axis) => cur?.[axis] ?? 0,
    level: (axis) => (cur ? levelOf(axis, cur[axis]) : null),
    get wanted() {
      return this.level('law') === 'wanted';
    },
    get suspect() {
      const l = this.level('law');
      return l === 'suspect' || l === 'wanted';
    },
    get trusted() {
      return this.level('law') === 'trusted';
    },
    get feared() {
      return this.level('civil') === 'feared';
    },
    get hero() {
      return this.level('civil') === 'hero';
    },
    get friend() {
      return this.level('outlaw') === 'friend';
    },
    state() {
      return cur ? { side: sideId, ...cur, levels: levels() } : null;
    },
  };
}
