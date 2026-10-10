// Wanted: the law's chase, after Red Dead Redemption 2 and GTA. Standing
// (standing.js) is what the universe makes of you over time; this is the
// chase happening now, and the bounty that outlives it.
// - A crime the law sees (one of its ships near, or the cops already on
//   you) counts at once: stars, and a price on your head. One only the
//   ordinary ships see starts a report: REPORT seconds while any of those
//   witnesses is still near (the scene says which are); shoot them or
//   leave them behind and the report dies with them. One nobody sees
//   doesn't count.
// - Stars (up to STARS) bring the space cops (RESPONSE: who comes, how
//   often, how many at once, how good, whether they hold your drive down,
//   and at five the Most Wanted boss). While they can see you it's a
//   pursuit; out of their sight LOSE_SIGHT seconds and they search where
//   they last saw you (SEARCH seconds by stars, twice as quick once you're
//   out of the SEARCH_ZONE round that spot); seen again, it's a pursuit
//   again; not, and the stars go.
// - The bounty stays when the stars go: it brings bounty hunters (by
//   bountyTier) until you pay it off out of the wallet (economy.js: what
//   you earn shooting down anyone who isn't the law), somewhere you land
//   with no stars on you. Going down clears the stars; the bounty stays.
// The bounty is kept per side (sides.js) in storage
// (get(key, fallback) and set(key, value): lib/hooks' `local`); the stars
// and the search are the visit's. Pure (no three.js, no DOM), so it's
// tested in Node; scene.js says what you did, who saw, and whether the cops
// can see you, and sends who RESPONSE says.
//
// createWanted({ storage, key }) → { side(id), crime(what, { seen, witnesses, at }) → events,
//   tick(dt, { seen, at, witnesses, search }) → events, payOff(credits) →
//   events (a 'paid' one's amount is for the scene to take from the wallet),
//   clear() → events, response(), stars, phase, bounty, lastSeen,
//   searchLeft, report, state() }
// Events: { type: 'wanted', stars, was }, { type: 'bounty', bounty, was },
// { type: 'witness', n, left }, { type: 'reported', stars }, { type:
// 'silenced' }, { type: 'search', left }, { type: 'resighted' }, { type:
// 'lost' } (you got away), { type: 'paid', amount }, { type: 'short',
// need }, { type: 'chased' } (no paying with the law on you).

export const STARS = 5;
// what each crime is worth: the bounty it adds, the stars it puts you at
// (at least), and how much of a star on top
export const CRIMES = {
  shotLaw: { bounty: 60, stars: 1 }, // fired on one of theirs
  ran: { bounty: 80, stars: 1 }, // ran from an inspector
  busted: { bounty: 0, stars: 2 }, // a scan found a price on your head
  killCop: { bounty: 150, stars: 1, add: 0.34 }, // one of those sent after you: every three, another star
  killPatrol: { bounty: 250, stars: 2, add: 0.5 }, // one of theirs in passing, that wasn't after you
  killCivil: { bounty: 200, stars: 2, add: 0.5 },
  capitalHurt: { bounty: 300, stars: 3 },
  capitalKill: { bounty: 2500, stars: 5 },
};
export const REPORT = 8; // seconds a witness takes to report you
export const LOSE_SIGHT = 3; // seconds out of their sight before they're searching
export const SEARCH = [0, 12, 18, 25, 32, 40]; // seconds they search, by stars
export const SEARCH_ZONE = 60; // map units round where they last saw you
// who comes, by stars: `units` (sides.js's police roles: cop, enforcer,
// heavy, medic) each time, every `every` seconds while fewer than `max` are
// after you, `skill` tiers better than the difficulty's, `interdict`: they
// hold your drive down, `boss`: the Most Wanted comes too
export const RESPONSE = [
  null,
  { every: 30, max: 2, skill: 0, units: ['cop', 'cop'] },
  { every: 24, max: 4, skill: 1, units: ['cop', 'cop', 'enforcer'] },
  { every: 20, max: 6, skill: 1, units: ['enforcer', 'cop', 'heavy'], interdict: true },
  { every: 16, max: 7, skill: 2, units: ['enforcer', 'enforcer', 'heavy', 'medic'], interdict: true },
  { every: 13, max: 9, skill: 2, units: ['enforcer', 'enforcer', 'heavy', 'heavy', 'medic'], interdict: true, boss: true },
];
// a bounty's tier: nobody (0), a bounty hunter now and then (1), more of
// them and tougher (2), the Most Wanted (3)
export const TIERS = [300, 1200, 3000];
export const bountyTier = (b) => TIERS.filter((t) => b >= t).length;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

export function createWanted({ storage = null, key = 'tp:universe-wanted' } = {}) {
  const stored = storage?.get(key, null);
  const all = stored && typeof stored === 'object' ? stored : {};
  let sideId = null;
  let bounty = 0;
  let level = 0; // stars, and the part-stars on top
  let phase = 'clear';
  let unseen = 0;
  let searchLeft = 0;
  let lastSeen = null;
  let report = null; // { crimes, ids, left }
  const stars = () => Math.min(STARS, Math.floor(level + 1e-9));
  const save = () => {
    if (!storage || !sideId) return;
    all[sideId] = { bounty };
    storage.set(key, all);
  };
  // a crime counted: the stars and the bounty it brings
  const commit = (what, where, out) => {
    const c = CRIMES[what];
    const was = stars();
    const wasBounty = bounty;
    level = Math.min(STARS, Math.max(level, c.stars) + (c.add ?? 0));
    bounty += c.bounty;
    if (where) lastSeen = { x: where.x, y: where.y, z: where.z };
    phase = 'pursuit';
    unseen = 0;
    if (stars() !== was) out.push({ type: 'wanted', stars: stars(), was });
    if (bounty !== wasBounty) out.push({ type: 'bounty', bounty, was: wasBounty });
  };

  return {
    // whose law (null: nobody's, and nothing counts): a side's own bounty
    side(id) {
      if ((id ?? null) === sideId) return;
      sideId = id ?? null;
      const got = sideId ? all[sideId] : null;
      bounty = num(got?.bounty);
      level = 0;
      phase = 'clear';
      report = null;
      lastSeen = null;
    },
    // something you did: seen by the law (`seen`), or by these witnesses
    // (anything that tells them apart: the scene's own ships), or nobody
    crime(what, { seen = false, witnesses = [], at = null } = {}) {
      if (!sideId || !CRIMES[what]) return [];
      const out = [];
      if (seen) {
        commit(what, at, out);
        save();
      } else if (witnesses.length) {
        if (report) {
          report.crimes.push(what);
          for (const w of witnesses) report.ids.add(w);
        } else report = { crimes: [what], ids: new Set(witnesses), left: REPORT, at };
        out.push({ type: 'witness', n: report.ids.size, left: report.left });
      }
      return out;
    },
    // a moment on: whether the cops can see you, where you are, which of
    // a report's witnesses are still near, how long the law searches (of
    // SEARCH: difficulty.js's)
    tick(dt, { seen = false, at = null, witnesses = null, search = 1 } = {}) {
      if (!sideId) return [];
      const out = [];
      if (report) {
        if (witnesses) for (const id of [...report.ids]) if (!witnesses.includes(id)) report.ids.delete(id);
        if (!report.ids.size) {
          report = null;
          out.push({ type: 'silenced' });
        } else if ((report.left -= dt) <= 0) {
          const { crimes, at: where } = report;
          report = null;
          for (const what of crimes) commit(what, where ?? at, out);
          save();
          out.push({ type: 'reported', stars: stars() });
        }
      }
      if (phase === 'pursuit') {
        if (seen) {
          unseen = 0;
          if (at) lastSeen = { x: at.x, y: at.y, z: at.z };
        } else if ((unseen += dt) >= LOSE_SIGHT) {
          phase = 'search';
          searchLeft = SEARCH[stars()] * search;
          out.push({ type: 'search', left: searchLeft });
        }
      } else if (phase === 'search') {
        if (seen) {
          phase = 'pursuit';
          unseen = 0;
          if (at) lastSeen = { x: at.x, y: at.y, z: at.z };
          out.push({ type: 'resighted' });
        } else {
          // (out of the zone they're searching, the trail goes cold twice as fast)
          const away = at && lastSeen && dist(at, lastSeen) > SEARCH_ZONE;
          searchLeft -= dt * (away ? 2 : 1);
          if (searchLeft <= 0) {
            const was = stars();
            level = 0;
            phase = 'clear';
            searchLeft = 0;
            out.push({ type: 'lost' });
            if (was) out.push({ type: 'wanted', stars: 0, was });
          }
        }
      }
      return out;
    },
    // the bounty paid off, if there's one, `credits` (the wallet's) cover
    // it, and the law isn't on you
    payOff(credits = 0) {
      if (!sideId || !bounty) return [];
      if (stars() > 0) return [{ type: 'chased' }];
      if (!(credits >= bounty)) return [{ type: 'short', need: bounty - Math.max(0, credits || 0) }];
      const amount = bounty;
      bounty = 0;
      save();
      return [{ type: 'paid', amount }, { type: 'bounty', bounty: 0, was: amount }];
    },
    // shot down: the chase is over (the bounty isn't)
    clear() {
      const was = stars();
      level = 0;
      phase = 'clear';
      report = null;
      unseen = 0;
      searchLeft = 0;
      return was ? [{ type: 'wanted', stars: 0, was }] : [];
    },
    response() {
      return RESPONSE[stars()] ?? null;
    },
    get sideId() {
      return sideId;
    },
    get stars() {
      return stars();
    },
    get phase() {
      return phase;
    },
    get bounty() {
      return bounty;
    },
    get lastSeen() {
      return lastSeen;
    },
    get searchLeft() {
      return searchLeft;
    },
    get report() {
      return report ? { left: report.left, n: report.ids.size } : null;
    },
    state() {
      return { side: sideId, stars: stars(), level, phase, bounty, searchLeft, lastSeen, report: this.report };
    },
  };
}
