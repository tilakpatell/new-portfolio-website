// Rivendell's games, as rules with no drawing, so they can be tested: the
// shards of Narsil laid back in order, the Council's argument and the
// moment to stand, Bilbo's hand and the Ring, and the Nine falling in
// behind you. ./RivendellWorld.jsx steps them; ./scene.js draws them.

// a small seeded random, so a shuffle or a lunge is the same each test
export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── The blade that was broken ──
// Six pieces (the hilt and five lengths of blade), scattered. Pick one up
// and put it in a place, and the piece there goes where yours was. Solved
// when every piece is in its own place, hilt first.
export const SHARDS = 6;

export function newShards(seed = 7) {
  const rand = seeded(seed);
  let order;
  do {
    order = Array.from({ length: SHARDS }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.filter((p, i) => p === i).length > 1);
  return { order, held: null, moves: 0, solved: false };
}

// Pick up the piece in place `i`, or put the one held down in place `i`
// (swapping). Returns 'held', 'swapped', 'solved' or null.
export function tapShard(s, i) {
  if (s.solved || i < 0 || i >= SHARDS) return null;
  if (s.held == null) {
    s.held = i;
    return 'held';
  }
  const a = s.held;
  s.held = null;
  if (a === i) return 'held';
  [s.order[a], s.order[i]] = [s.order[i], s.order[a]];
  s.moves += 1;
  s.solved = s.order.every((p, k) => p === k);
  return s.solved ? 'solved' : 'swapped';
}
// how many are in their own place
export const placed = (s) => s.order.filter((p, k) => p === k).length;

// ── The Council of Elrond ──
// The Free Peoples argue, louder and louder (`heat`); at a third of the way
// Gimli takes his axe to the Ring. Stand too soon and Elrond bids you
// wait. Once it's at its height, say it: the first time no one hears you
// over the noise, the second they do. Leave it too long and the Ring's
// voice is all there is, and it begins again.
export const COUNCIL = { rise: 0.055, axe: 0.3, ready: 0.62, drown: 5 };

export const newCouncil = () => ({ t: 0, heat: 0, axed: false, spoken: 0, over: 0, state: 'on' });

// Events: 'axe' (Gimli swings), 'height' (the argument's at its height:
// time to stand), 'drowned' (left too long).
export function stepCouncil(c, dt) {
  const ev = [];
  if (c.state !== 'on') return ev;
  c.t += dt;
  const was = c.heat;
  c.heat = Math.min(1, c.heat + COUNCIL.rise * dt);
  if (!c.axed && c.heat >= COUNCIL.axe) {
    c.axed = true;
    ev.push({ type: 'axe' });
  }
  if (was < COUNCIL.ready && c.heat >= COUNCIL.ready) ev.push({ type: 'height' });
  if (c.heat >= 1) {
    c.over += dt;
    if (c.over >= COUNCIL.drown) {
      c.state = 'drowned';
      ev.push({ type: 'drowned' });
    }
  }
  return ev;
}

// Stand up and say it: 'wait' (too soon), 'unheard' (the first time, over
// the noise), 'heard' (the second: done).
export function speak(c) {
  if (c.state !== 'on') return null;
  if (c.heat < COUNCIL.ready) return 'wait';
  c.spoken += 1;
  if (c.spoken < 2) return 'unheard';
  c.state = 'heard';
  return 'heard';
}

// ── My old ring ──
// Bilbo's hand comes slowly towards the Ring in yours; then his face
// changes and he lunges. Close your hand on it as he lunges, not before
// (he only wanted to hold it) and not after (too late).
export const REACH = { creep: 0.16, lunge: 1.25, from: 2.6, spread: 2.2, near: 0.5 };

export function newReach(seed = 3) {
  const rand = seeded(seed);
  return { t: 0, hand: 0, lungeAt: REACH.from + rand() * REACH.spread, state: 'creep' };
}

// Events: 'lunge' as his face changes, 'late' if his hand reaches it.
export function stepReach(r, dt) {
  const ev = [];
  if (r.state !== 'creep' && r.state !== 'lunge') return ev;
  r.t += dt;
  if (r.state === 'creep') {
    r.hand = Math.min(REACH.near, r.hand + REACH.creep * dt);
    if (r.t >= r.lungeAt) {
      r.state = 'lunge';
      ev.push({ type: 'lunge' });
    }
  } else {
    r.hand = Math.min(1, r.hand + REACH.lunge * dt);
    if (r.hand >= 1) {
      r.state = 'late';
      ev.push({ type: 'late' });
    }
  }
  return ev;
}
// Close your hand: 'early', 'won', or null if it's over.
export function closeHand(r) {
  if (r.state === 'creep') {
    r.state = 'early';
    return 'early';
  }
  if (r.state === 'lunge') {
    r.state = 'won';
    return 'won';
  }
  return null;
}

// ── The Fellowship sets out ──
// The eight who go with you, gathered one by one; then they walk behind
// you in a line, each on the path you took, a few steps apart.
export const FOLLOW = { gap: 1.5, keep: 200 };

export const newParty = () => ({ joined: [], trail: [] });

// One of them falls in: true if they weren't already with you.
export function join(p, id) {
  if (p.joined.includes(id)) return false;
  p.joined.push(id);
  return true;
}
export const gathered = (p, all) => all.every((c) => p.joined.includes(c.id ?? c));

// The leader's step: a crumb every so far along.
export function lead(p, x, z) {
  const last = p.trail[0];
  if (!last || Math.hypot(x - last.x, z - last.z) >= 0.25) {
    p.trail.unshift({ x, z });
    if (p.trail.length > FOLLOW.keep) p.trail.length = FOLLOW.keep;
  }
}
// Where the n-th to have joined walks: `gap` metres apart along the trail
// (or as far back as it goes), and which way they face.
export function followAt(p, n) {
  const want = (n + 1) * FOLLOW.gap;
  let run = 0;
  for (let i = 1; i < p.trail.length; i++) {
    const a = p.trail[i - 1];
    const b = p.trail[i];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (run + d >= want) {
      const k = (want - run) / d;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, face: Math.atan2(-(a.z - b.z), a.x - b.x) };
    }
    run += d;
  }
  const end = p.trail.at(-1);
  return end ? { x: end.x, z: end.z, face: 0 } : null;
}
