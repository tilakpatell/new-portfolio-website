// A war's front: who holds which of its sectors, who attacks next, and the
// save. Pure, tested (front.js plays it out on the map).
//
// A war's sectors are a line from the first side's home (0) to the second's
// (n − 1). The first side holds 0 … front − 1 and the second front … n − 1.
// The side that won the last battle attacks the next (the first side, to
// begin with), over the defender's sector on the front line: `front` when
// the first side attacks, `front − 1` when the second does. The attacker
// takes it if it wins. Holding all of them wins the war (`won`: the side),
// and then it starts again (newWar).
//
// newWar(war) → state; contested(state) → sector index; owner(state, i) →
// 0 | 1; resolve(state, war, winner) → the next state; holders(war, state)
// → { [sector id]: 0 | 1 }; loadWar(storage, war) → state (a missing or
// bad save is a new war); saveWar(storage, war, state).

export function newWar(war) {
  return { front: Math.floor(war.sectors.length / 2), attacker: 0, wins: [0, 0], battles: 0, won: null };
}

export const contested = (s) => (s.attacker === 0 ? s.front : s.front - 1);
export const owner = (s, i) => (i < s.front ? 0 : 1);

export function resolve(s, war, winner) {
  if (s.won !== null || (winner !== 0 && winner !== 1)) return s;
  const n = war.sectors.length;
  const front = winner === s.attacker ? s.front + (s.attacker === 0 ? 1 : -1) : s.front;
  const wins = [...s.wins];
  wins[winner] += 1;
  return { front, attacker: winner, wins, battles: s.battles + 1, won: front >= n ? 0 : front <= 0 ? 1 : null };
}

export const holders = (war, s) => Object.fromEntries(war.sectors.map((sec, i) => [sec.id, owner(s, i)]));

const key = (war) => `tp-war-${war.id}`;
const isCount = (v) => Number.isInteger(v) && v >= 0;

// a save as it was written, or null if it isn't one this war could be in
function parse(text, war) {
  let s;
  try {
    s = JSON.parse(text);
  } catch {
    return null;
  }
  const n = war.sectors.length;
  if (!s || typeof s !== 'object') return null;
  if (!Number.isInteger(s.front) || s.front < 0 || s.front > n) return null;
  if (s.attacker !== 0 && s.attacker !== 1) return null;
  if (!Array.isArray(s.wins) || s.wins.length !== 2 || !s.wins.every(isCount) || !isCount(s.battles)) return null;
  if (s.won !== null && s.won !== 0 && s.won !== 1) return null;
  return { front: s.front, attacker: s.attacker, wins: [s.wins[0], s.wins[1]], battles: s.battles, won: s.won };
}

export function loadWar(storage, war) {
  try {
    const text = storage?.getItem(key(war));
    return (text && parse(text, war)) || newWar(war);
  } catch {
    return newWar(war); // (storage blocked: a war that's only this visit's)
  }
}

export function saveWar(storage, war, s) {
  try {
    storage?.setItem(key(war), JSON.stringify(s));
  } catch {
    // (storage blocked or full: the war goes on, unsaved)
  }
}
