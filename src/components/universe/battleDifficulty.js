// How hard the fight round you is: from how you're doing in it (your own
// kills, your deaths lately, your shields), and what that changes. Pure,
// tested. galaxy/warfront.js works it out from what's happened to you and
// hands it to the battle (battle.js's setDifficulty).
//
// It changes only what shoots at you, in your own dogfight: how many of the
// other side's fighters may be on you at once (a pool of tokens, squad.js's,
// the AI claims before it comes for you; it was four, and always two within
// seventy units whatever you did), how true their aim is at you, whether
// their ace comes looking for a duel, and how near the batteries'
// point-defence reaches for you. Never the battle every pilot shares: not
// the director's state, not a tally key, not the AI's pressure on the
// objectives (battleDirector.js) — a pilot who's struggling gets a fairer
// dogfight, not a different war.
//
// difficulty({ killsPerMin, deaths, shield }) → 0.6..1.6 (1 for a pilot
// downing two a minute, not dying, shields up); pressureOf(d) → { d, onYou,
// spread, aceDuels, flak }; statsOf({ kills, deaths, since, now, shield })
// → the stats, from the seconds of your kills and deaths (since: when you
// came, with a minute at par to start from; deaths count for five minutes).

export const DIFFICULTY = {
  range: [0.6, 1.6],
  par: 2, // kills a minute at difficulty 1
  kills: 0.15, // and how much each kill a minute more (or fewer) adds
  deaths: 0.3, // how much each death in the window takes off
  window: 300, // seconds a death counts for
  low: 35, // shields under this…
  lowCut: 0.2, // …take this much off
  pool: 2, // fighters on you at difficulty 1 (a token each)
  spread: 0.02, // their aim's spread at you at difficulty 1
  duel: 1.2, // from this difficulty their ace comes looking for you
  flak: 25, // how near point-defence reaches for you at difficulty 1 and up
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function difficulty({ killsPerMin = DIFFICULTY.par, deaths = 0, shield = 100 } = {}) {
  const d = 1 + DIFFICULTY.kills * (killsPerMin - DIFFICULTY.par) - DIFFICULTY.deaths * deaths - (shield < DIFFICULTY.low ? DIFFICULTY.lowCut : 0);
  return clamp(Number.isFinite(d) ? d : 1, ...DIFFICULTY.range);
}

export function pressureOf(d) {
  const x = clamp(Number.isFinite(d) ? d : 1, ...DIFFICULTY.range);
  return { d: x, onYou: clamp(Math.round(DIFFICULTY.pool * x), 1, 4), spread: DIFFICULTY.spread / x, aceDuels: x >= DIFFICULTY.duel, flak: DIFFICULTY.flak * Math.min(1, x) };
}

// (kills a minute counted with a minute at par to start from: a pilot just
// come in is flying at difficulty 1, not let off for having downed nobody yet,
// nor pressed for one lucky kill)
export function statsOf({ kills = [], deaths = [], since = 0, now = 0, shield = 100 }) {
  const minutes = Math.max(0, (now - since) / 60);
  return { killsPerMin: (kills.filter((t) => t >= since && t <= now).length + DIFFICULTY.par) / (minutes + 1), deaths: deaths.filter((t) => t <= now && now - t < DIFFICULTY.window).length, shield };
}
