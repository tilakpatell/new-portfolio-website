// Walt's Metherria: the rules, apart from the drawing, so they can be tested.
// A Papa's Freezeria for the show's blue. Customers come to the door with an
// order; you build it (the batch size, the base poured to the line, mix-ins
// counted in), cook it, break it and pack it (the right pack, filled to the
// mark, stickers where the ticket shows), and serve. Every station is scored
// against the ticket, and the wait too. Points raise your title, and titles
// unlock new mix-ins, cuts and stickers. It's all make-believe: pours, a
// gauge, a hammer, a scale and some stickers.

export const M = {
  topPurity: 99.1,
  sizes: {
    small: { label: 'Small', trays: 1, base: 0.34 },
    medium: { label: 'Medium', trays: 2, base: 0.58 },
    large: { label: 'Large', trays: 3, base: 0.82 },
  },
  // mix-ins, counted in; `rank` is the title they unlock at
  mixins: {
    blue: { label: 'Blue', max: 3, rank: 0 },
    chili: { label: 'Chili P', max: 2, rank: 0 },
    seeds: { label: 'Crystal seeds', max: 2, rank: 1 },
    spice: { label: 'Pollos spice', max: 2, rank: 3 },
  },
  cuts: {
    shards: { label: 'Big shards', cracks: 3, rank: 0 },
    rocks: { label: 'Rocks', cracks: 5, rank: 0 },
    dust: { label: 'Fine', cracks: 7, rank: 2 },
  },
  packs: {
    baggie: { label: 'Baggies', weight: 0.34 },
    box: { label: 'A Pollos box', weight: 0.6 },
    barrel: { label: 'A Madrigal drum', weight: 0.84 },
  },
  stickers: {
    hat: { label: 'Heisenberg hat', rank: 2 },
    bluesky: { label: 'Blue Sky seal', rank: 2 },
    pollos: { label: 'Los Pollos logo', rank: 3 },
    madrigal: { label: 'Madrigal mark', rank: 4 },
  },
  shades: ['Sky blue', 'Walt blue', 'Deep blue'], // one, two or three scoops of blue
  pourRate: 0.3,
  fillRate: 0.42,
  sweepRate: 0.85,
  strikeWindow: 0.07,
  cookBase: 2.5,
  cookPerTray: 2,
  bandMid: 0.66,
  bandWide: 0.085,
  bandNarrow: 0.055,
  firstCustomers: 3,
  maxCustomers: 7,
  arriveEvery: [16, 26],
  patience: 85,
  weights: { build: 0.25, cook: 0.25, break: 0.15, pack: 0.25, wait: 0.1 },
  price: 18,
  ranks: [
    [0, 'Pinkman’s partner'],
    [40, 'Cap’n Cook'],
    [120, 'Mr. White'],
    [260, 'Heisenberg'],
    [460, 'The one who knocks'],
    [720, 'Empire business'],
  ],
};

// Who comes to the door, from which day, and how they like it.
export const CUSTOMERS = {
  jesse: {
    name: 'Jesse', from: 1, patience: 1.1, pay: 1,
    sizes: ['small', 'medium'], purity: [88, 94], blue: [1, 3], chili: [1, 2], seeds: 0.4,
    cuts: ['rocks', 'shards', 'dust'], packs: ['baggie'], stickers: ['hat', 'bluesky'],
    lines: { great: 'Yeah, science!', good: 'Yeah, Mr. White. That’s legit.', okay: 'It’s… fine, yo. I guess.', bad: 'Yo, what is this?' },
  },
  badger: {
    name: 'Badger', from: 1, patience: 1.2, pay: 0.85,
    sizes: ['small'], purity: [82, 90], blue: [1, 2], chili: [1, 2], seeds: 0.2,
    cuts: ['rocks'], packs: ['baggie'], stickers: ['bluesky'],
    lines: { great: 'That is some Star Trek-level stuff, yo.', good: 'Not bad. Not bad at all.', okay: 'Dude. It’s okay.', bad: 'Dude. No.' },
  },
  pete: {
    name: 'Skinny Pete', from: 1, patience: 1.2, pay: 0.85,
    sizes: ['small', 'medium'], purity: [82, 90], blue: [2, 3], chili: [0, 1], seeds: 0.3,
    cuts: ['rocks', 'shards'], packs: ['baggie'], stickers: ['bluesky', 'hat'],
    lines: { great: 'That is like Mozart, man.', good: 'Solid, yo.', okay: 'Eh. Could be bluer.', bad: 'Not cool, man. Not cool.' },
  },
  tuco: {
    name: 'Tuco', from: 2, patience: 0.6, pay: 1.2,
    sizes: ['medium'], purity: [90, 95], blue: [3, 3], chili: [1, 2], seeds: 0.5,
    cuts: ['shards'], packs: ['baggie'], stickers: ['hat'],
    lines: { great: 'Tight, tight, tight!', good: 'Tight.', okay: 'You call this tight?', bad: 'You think this is a joke?' },
  },
  mike: {
    name: 'Mike', from: 3, patience: 1, pay: 1.2,
    sizes: ['small', 'medium'], purity: [94, 97], blue: [2, 2], chili: [0, 0], seeds: 0.3,
    cuts: ['rocks', 'dust'], packs: ['baggie', 'box'], stickers: ['bluesky'],
    lines: { great: 'No half measures. Good.', good: 'It’ll do.', okay: 'Half measures.', bad: 'We’re done here.' },
  },
  gus: {
    name: 'Gus', from: 4, patience: 0.9, pay: 1.8,
    sizes: ['medium', 'large'], purity: [98, 99], blue: [2, 2], chili: [0, 0], seeds: 0.6, spice: [1, 2],
    cuts: ['shards', 'dust'], packs: ['box'], stickers: ['pollos'],
    lines: { great: 'Thank you for your business.', good: 'Acceptable.', okay: 'I hide in plain sight. This doesn’t.', bad: 'Explain yourself.' },
  },
  lydia: {
    name: 'Lydia', from: 5, patience: 0.8, pay: 1.5,
    sizes: ['medium', 'large'], purity: [96, 98], blue: [2, 3], chili: [0, 0], seeds: 0.4,
    cuts: ['rocks', 'shards', 'dust'], packs: ['barrel'], stickers: ['madrigal'],
    lines: { great: 'Fine. Fine. Good. The Czechs will love it.', good: 'Good enough for the Czech Republic.', okay: 'This isn’t the right blue.', bad: 'I can’t ship this. I can’t.' },
  },
  declan: {
    name: 'Declan', from: 5, patience: 1, pay: 1.4,
    sizes: ['large'], purity: [90, 95], blue: [2, 3], chili: [0, 0], seeds: 0.5,
    cuts: ['rocks'], packs: ['barrel'], stickers: ['madrigal', 'hat'],
    lines: { great: 'Okay. Okay, chef.', good: 'That’s the product.', okay: 'You call this blue?', bad: 'Then we have a problem.' },
  },
  saul: {
    name: 'Saul', from: 6, patience: 1.3, pay: 1.3,
    sizes: ['small'], purity: [85, 92], blue: [1, 3], chili: [0, 1], seeds: 0.3, spice: [0, 1],
    cuts: ['rocks'], packs: ['box', 'baggie'], stickers: ['bluesky', 'hat'],
    lines: { great: 'S’all good, man!', good: 'Better call Saul. Better buy from you.', okay: 'I’ve seen worse. I’ve represented worse.', bad: 'I know a guy. A better guy.' },
  },
};

// Hank at the laundry, once a shift from day three: what he says as he
// comes in, and as he goes if the batch is hidden. The quotes are his, in
// his own voice where it's been made (lib/voiced.js; ../voicelines.js).
export const HANK = {
  raid: '“Mind if I take a look around?” Hide the batch.',
  hidden: '“Huh. Smells like… soap.” He heads out.',
};

export const UPGRADES = [
  { id: 'burner', name: 'A better burner', cost: 40, text: 'The green on the gauge is a third wider.' },
  { id: 'notes', name: 'Gale’s lab notes', cost: 60, text: 'Pours and the scale forgive a little more, the fill line lights up when you’re on it, and the hammer’s window is wider.' },
  { id: 'huell', name: 'Huell at the door', cost: 55, text: 'Customers wait a third longer before they get restless.' },
  { id: 'billboard', name: 'Saul’s billboard', cost: 80, text: 'A quarter more on every sale.' },
  { id: 'superlab', name: 'The superlab', cost: 150, text: 'Out of the RV, under the laundry: every cook is a quarter quicker.' },
];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const between = ([a, b], rand) => a + Math.floor(rand() * (b - a + 1));
const has = (upgrades, id) => !!upgrades?.includes(id);

// What a title has unlocked.
export function unlocked(rank) {
  const ok = (table) => Object.keys(table).filter((k) => table[k].rank <= rank);
  return { mixins: ok(M.mixins), cuts: ok(M.cuts), stickers: ok(M.stickers) };
}

export const rosterFor = (day) => Object.keys(CUSTOMERS).filter((id) => CUSTOMERS[id].from <= day);
export const traysFor = (order) => M.sizes[order.size].trays;

// Where stickers go: on the pack's face (0 to 1 across and down), apart.
function spots(n, rand) {
  const out = [];
  for (let tries = 0; out.length < n && tries < 40; tries++) {
    const p = { x: 0.22 + rand() * 0.56, y: 0.28 + rand() * 0.44 };
    if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 0.3)) out.push(p);
  }
  return out;
}

// One order, in the customer's taste, using only what the rank has unlocked.
export function makeOrder(id, day, rand = Math.random, rank = 0) {
  const c = CUSTOMERS[id];
  const open = unlocked(rank);
  const [lo, hi] = c.purity;
  const lean = Math.min(1, (day - c.from) / 6); // regulars get pickier
  const purity = Math.round(clamp(lo + (hi - lo) * (rand() * 0.6 + lean * 0.4), 80, 99));
  const mix = { blue: between(c.blue, rand) };
  const chili = between(c.chili, rand);
  if (chili) mix.chili = chili;
  if (open.mixins.includes('seeds') && rand() < c.seeds) mix.seeds = 1 + Math.floor(rand() * M.mixins.seeds.max);
  if (open.mixins.includes('spice') && c.spice) {
    const n = between(c.spice, rand);
    if (n) mix.spice = n;
  }
  const cuts = c.cuts.filter((k) => open.cuts.includes(k));
  const kinds = c.stickers.filter((k) => open.stickers.includes(k));
  let stickers = [];
  if (kinds.length && rand() < 0.8) {
    const n = rank >= 4 && rand() < 0.5 ? 2 : 1;
    stickers = spots(n, rand).map((p) => ({ kind: pick(kinds, rand), ...p }));
  }
  return { customer: id, size: pick(c.sizes, rand), mix, purity, cut: pick(cuts.length ? cuts : ['rocks'], rand), pack: pick(c.packs, rand), stickers };
}

// A shift: who comes and when. Newcomers turn up on the day they unlock.
export function newDay(career, rand = Math.random) {
  const day = career.day;
  const rank = rankFor(career.points).index;
  const count = Math.min(M.maxCustomers, M.firstCustomers + Math.floor((day - 1) / 2));
  const roster = rosterFor(day);
  const fresh = roster.filter((id) => CUSTOMERS[id].from === day && day > 1);
  const who = [];
  for (let i = 0; i < count; i++) {
    if (fresh[i]) who.push(fresh[i]);
    else {
      let id = pick(roster, rand);
      if (who.length && id === who[who.length - 1] && roster.length > 1) id = pick(roster.filter((r) => r !== id), rand);
      who.push(id);
    }
  }
  for (let i = who.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [who[i], who[j]] = [who[j], who[i]];
  }
  let t = 0;
  const [a, b] = M.arriveEvery;
  const queue = who.map((id, i) => {
    if (i) t += a + rand() * (b - a);
    return { id: `${day}-${i}`, customer: id, arrive: Math.round(t * 10) / 10, order: makeOrder(id, day, rand, rank) };
  });
  return { day, queue };
}

const counted = (want, got) => {
  const d = Math.abs((want ?? 0) - (got ?? 0));
  return d === 0 ? 100 : d === 1 ? 45 : 0;
};

// The build: the right size, the base poured to its line, the mix-ins counted.
export function buildScore(order, made, upgrades = []) {
  const ease = has(upgrades, 'notes') ? 0.7 : 1;
  const size = made.size === order.size ? 100 : 0;
  const err = Math.abs(made.base - M.sizes[order.size].base) * ease;
  const pour = clamp(100 - Math.max(0, err - 0.015) * 320);
  const keys = Object.keys(M.mixins).filter((k) => (order.mix[k] ?? 0) > 0 || (made.mix?.[k] ?? 0) > 0);
  const mix = keys.length ? keys.reduce((s, k) => s + counted(order.mix[k], made.mix?.[k]), 0) / keys.length : 100;
  return Math.round(size * 0.2 + pour * 0.3 + mix * 0.5);
}

export function cookScore(order, purity) {
  const above = Math.max(0, M.topPurity - Math.max(purity, order.purity));
  const below = Math.max(0, order.purity - purity);
  return Math.round(clamp(100 - above * 3 - below * 12));
}

export function breakScore(hits, cracks, wild = 0) {
  const got = hits.slice(0, cracks).reduce((a, b) => a + b, 0);
  return Math.round(clamp((got / cracks) * 100 - wild * 6));
}

// Packing: the right pack, each bag filled to the mark, stickers in place.
export function packScore(order, made, upgrades = []) {
  const ease = has(upgrades, 'notes') ? 0.7 : 1;
  const type = made.pack === order.pack ? 100 : 0;
  const target = M.packs[order.pack].weight;
  const trays = traysFor(order);
  let fill = 0;
  for (let i = 0; i < trays; i++) {
    const w = made.weights?.[i];
    if (w == null) continue;
    const e = (w > target ? (w - target) * 1.6 : target - w) * ease;
    fill += clamp(100 - Math.max(0, e - 0.01) * 380);
  }
  fill /= trays;
  const want = order.stickers ?? [];
  const placed = [...(made.stickers ?? [])];
  if (!want.length && !placed.length) return Math.round(type * 0.35 + fill * 0.65);
  let sum = 0;
  for (const s of want) {
    let best = -1;
    let d = Infinity;
    placed.forEach((p, i) => {
      if (p && p.kind === s.kind && Math.hypot(p.x - s.x, p.y - s.y) < d) {
        d = Math.hypot(p.x - s.x, p.y - s.y);
        best = i;
      }
    });
    if (best >= 0) {
      sum += clamp(100 - Math.max(0, d - 0.03) * 300);
      placed[best] = null;
    }
  }
  const extras = placed.filter(Boolean).length;
  const stickers = clamp((want.length ? sum / want.length : 100) - extras * 15);
  return Math.round(type * 0.25 + fill * 0.35 + stickers * 0.4);
}

export function waitScore(seconds, id, upgrades = []) {
  const patience = M.patience * (CUSTOMERS[id]?.patience ?? 1) * (has(upgrades, 'huell') ? 1.33 : 1);
  if (seconds <= patience) return 100;
  return Math.round(clamp(100 - ((seconds - patience) / patience) * 60, 30));
}

export function grade(scores) {
  const w = M.weights;
  const total = Math.round(Object.keys(w).reduce((sum, k) => sum + (scores[k] ?? 0) * w[k], 0));
  const mood = total >= 90 ? 'great' : total >= 75 ? 'good' : total >= 55 ? 'okay' : 'bad';
  return { total, mood };
}

export function payFor(order, total, upgrades = []) {
  const c = CUSTOMERS[order.customer];
  const quality = 0.25 + 0.95 * (total / 100) ** 2;
  return Math.round(M.price * traysFor(order) * quality * (c?.pay ?? 1) * (has(upgrades, 'billboard') ? 1.25 : 1));
}

export const pointsFor = (total) => Math.round(total / 10) + (total >= 90 ? 4 : 0);

export function rankFor(points) {
  let i = 0;
  while (i + 1 < M.ranks.length && points >= M.ranks[i + 1][0]) i += 1;
  return { index: i, title: M.ranks[i][1], from: M.ranks[i][0], next: M.ranks[i + 1]?.[0] ?? null };
}

// What a new title brings, for the rank-up card.
export function newAt(rank) {
  const label = (table) => Object.keys(table).filter((k) => table[k].rank === rank).map((k) => table[k].label);
  return [...label(M.mixins), ...label(M.cuts).map((l) => `${l} cut`), ...label(M.stickers).map((l) => `${l} stickers`)];
}

const UPGRADE_IDS = new Set(UPGRADES.map((u) => u.id));

export function newCareer(saved = null) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const num = (v, min, fallback) => (Number.isFinite(v) && v >= min ? Math.floor(v) : fallback);
  return {
    day: num(s.day, 1, 1),
    money: num(s.money, 0, 0),
    points: num(s.points, 0, 0),
    served: num(s.served, 0, 0),
    upgrades: Array.isArray(s.upgrades) ? [...new Set(s.upgrades.filter((id) => UPGRADE_IDS.has(id)))] : [],
    bestOrder: num(s.bestOrder, 0, 0),
    bestDay: num(s.bestDay, 0, 0),
  };
}

export function buy(career, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || career.upgrades.includes(id) || career.money < u.cost) return career;
  return { ...career, money: career.money - u.cost, upgrades: [...career.upgrades, id] };
}

export function bandAt(k, upgrades = []) {
  const half = (M.bandWide - (M.bandWide - M.bandNarrow) * Math.min(1, k)) * (has(upgrades, 'burner') ? 1.35 : 1);
  return [M.bandMid - half, M.bandMid + half];
}

export const cookSeconds = (trays, upgrades = []) => (M.cookBase + M.cookPerTray * trays) * (has(upgrades, 'superlab') ? 0.75 : 1);
export const strikeWindow = (upgrades = []) => M.strikeWindow * (has(upgrades, 'notes') ? 1.35 : 1);

export function cracksFor(cut, rand = Math.random) {
  const n = M.cuts[cut].cracks;
  const out = [];
  for (let i = 0; i < n; i++) {
    const lo = 0.08 + (0.84 * i) / n;
    const hi = 0.08 + (0.84 * (i + 1)) / n;
    out.push(lo + (hi - lo) * (0.25 + rand() * 0.5));
  }
  return out;
}

// The shade a number of scoops of blue makes, from pale to deep.
export const shadeOf = (scoops) => Math.max(0, Math.min(1, scoops / M.mixins.blue.max));
