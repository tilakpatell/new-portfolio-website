// Rivendell's games, as rules with no drawing, so they can be tested: the
// shards of Narsil laid back in order, the Council's argument and the
// moment to stand, Bilbo's hand and the Ring, and the Nine falling in
// behind you; and on the side, riddles with Bilbo. ./RivendellWorld.jsx
// steps them; ./scene.js draws them.

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

// ── On the side: riddles with Bilbo ──
// Bilbo, by the fire in his pavilion, has a riddle or two left over from a
// game he once played in the dark under the Misty Mountains (he tells them
// his own way now). Answer each before his candle burns down: a wrong
// answer, or the candle out, counts against you, and two of those and he's
// won. Get through five with no more than one against you and you've beaten
// him. It's on the side: the story never waits on it.
export const RIDDLE = { ask: 5, lose: 2, candle: 16 };
// the task, for the list
export const SIDE = { id: 'riddles', name: 'Riddles in the dark', where: 'Bilbo’s pavilion', blurb: 'Bilbo has a riddle or two left over from the Misty Mountains. Answer five before his candle burns down.', seal: 'riddlesinthedark' };
// each with its answer first, then three it isn't
export const RIDDLES = [
  { id: 'mountain', q: 'My roots are hidden under the land, I’m taller than the trees that stand; I climb for ever into the sky, and never grow an inch. What am I?', a: ['A mountain', 'An oak', 'A tower', 'A cloud'] },
  { id: 'teeth', q: 'Thirty white horses on a red hill: first they champ, then they stamp, then they stand still.', a: ['Teeth', 'Snowflakes', 'Sheep on a hillside', 'Candles on a cake'] },
  { id: 'wind', q: 'I’ve no mouth, and yet I howl; no wings, and yet I fly; no teeth, and yet I bite. What am I?', a: ['The wind', 'A ghost', 'A wolf', 'A bat'] },
  { id: 'dark', q: 'The more of me there is, the less you see. I fill a cave to the brim, and I run from a single candle.', a: ['The dark', 'Smoke', 'Fog', 'Water'] },
  { id: 'egg', q: 'No hinge, no lid, no key, no seam; and yet inside, a golden gleam.', a: ['An egg', 'A dragon’s hoard', 'A locked chest', 'An acorn'] },
  { id: 'fish', q: 'It wears a coat of mail but never goes to war; it drinks all day and never thirsts; it lives, and never draws a breath.', a: ['A fish', 'A knight', 'A frog', 'A river'] },
  { id: 'time', q: 'It eats the iron and gnaws the stone, wears the mountain down to the bone, brings down kings and ruins towns, and no one ever sees it come.', a: ['Time', 'Rust', 'A dragon', 'Rain'] },
  { id: 'hole', q: 'A round green door, a garden gate, a pantry full, and never late for second breakfast. Where am I?', a: ['In a hobbit-hole', 'In an inn', 'In a mill', 'In a barn'] },
];

// A game of riddles: which ones, in what order, and each one's answers
// shuffled, all from `seed`.
const shuffle = (list, rand) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};
export function newRiddles(seed = 11) {
  const rand = seeded(seed);
  const order = shuffle(RIDDLES.map((_, i) => i), rand).slice(0, RIDDLE.ask);
  const game = { rand, order, at: 0, right: 0, wrong: 0, candle: 1, opts: [], state: 'ask' };
  shuffleOpts(game);
  return game;
}
function shuffleOpts(g) {
  g.opts = shuffle([0, 1, 2, 3], g.rand);
}
// the riddle being asked, and its answers in the order they're shown
export function asked(g) {
  const r = RIDDLES[g.order[g.at]];
  return r ? { ...r, shown: g.opts.map((i) => r.a[i]) } : null;
}
function settle(g, ok) {
  if (ok) g.right += 1;
  else g.wrong += 1;
  if (g.wrong >= RIDDLE.lose) g.state = 'lost';
  else if (g.at + 1 >= g.order.length) g.state = 'won';
  else {
    g.at += 1;
    g.candle = 1;
    shuffleOpts(g);
  }
}
// Answer with the i-th of the answers shown: 'right' or 'wrong', or null
// if the game's over.
export function answer(g, i) {
  if (g.state !== 'ask') return null;
  const ok = g.opts[i] === 0;
  settle(g, ok);
  return ok ? 'right' : 'wrong';
}
// The candle burns: an event { type: 'out' } if it goes out on a riddle
// (that counts against you), then 'won' or 'lost' if that ends it.
export function stepRiddles(g, dt) {
  if (g.state !== 'ask') return [];
  g.candle = Math.max(0, g.candle - dt / RIDDLE.candle);
  if (g.candle > 0) return [];
  settle(g, false);
  const ev = [{ type: 'out' }];
  if (g.state !== 'ask') ev.push({ type: g.state });
  return ev;
}
