// The superlab, cooked to order: the rules of the game, kept apart from the
// drawing so they can be tested. Customers come to the door with an order;
// it is mixed, cooked, broken and bagged, and each step is scored against the
// ticket. Good work pays, the pay buys upgrades, and the days bring in new
// customers. It is the show's blue, so it is all make-believe: the stations
// are pours, a gauge, a hammer and a scale.

export const LAB = {
  topPurity: 99.1,
  // how full the flask should be for one, two or three trays
  baseFor: (trays) => [0.32, 0.56, 0.8][trays - 1],
  tints: {
    sky: { label: 'Sky blue', level: 0.3, color: '#9fdcf5' },
    blue: { label: 'Walt blue', level: 0.6, color: '#4fb8ea' },
    deep: { label: 'Deep blue', level: 0.86, color: '#1d78c4' },
  },
  cuts: {
    shards: { label: 'Big shards', cracks: 3 },
    rocks: { label: 'Rocks', cracks: 5 },
  },
  packs: {
    baggie: { label: 'Baggies', weight: 0.34 },
    box: { label: 'A Pollos box', weight: 0.6 },
    barrel: { label: 'A Madrigal drum', weight: 0.84 },
  },
  // pour, fill and sweep speeds (fractions of the gauge a second)
  pourRate: 0.3,
  tintRate: 0.36,
  fillRate: 0.42,
  sweepRate: 0.85,
  strikeWindow: 0.07,
  // the cook: seconds in the green per tray, and the green itself
  cookBase: 2.5,
  cookPerTray: 2,
  bandMid: 0.66,
  bandWide: 0.085,
  bandNarrow: 0.055,
  // a shift: who comes when
  firstCustomers: 3,
  maxCustomers: 7,
  arriveEvery: [16, 26], // seconds between arrivals, at random in this range
  patience: 75, // seconds a customer waits happily, before their own temper
  weights: { mix: 0.25, cook: 0.3, break: 0.15, bag: 0.2, wait: 0.1 },
  price: 18, // dollars a tray, before quality and tips
  ranks: [
    [0, 'Pinkman’s partner'],
    [40, 'Cap’n Cook'],
    [120, 'Mr. White'],
    [260, 'Heisenberg'],
    [460, 'The one who knocks'],
    [720, 'Empire business'],
  ],
};

// Who comes to the door. `from` is the first day they turn up; the rest
// shapes their orders and how they take the result.
export const CUSTOMERS = {
  jesse: {
    name: 'Jesse',
    from: 1,
    patience: 1.1,
    pay: 1,
    trays: [1, 2],
    purity: [88, 94],
    chili: 0.85,
    tints: ['sky', 'blue', 'deep'],
    packs: ['baggie'],
    cuts: ['rocks', 'shards'],
    lines: { great: 'Yeah, science!', good: 'Yeah, Mr. White. That’s legit.', okay: 'It’s… fine, yo. I guess.', bad: 'Yo, what is this?' },
  },
  badger: {
    name: 'Badger',
    from: 1,
    patience: 1.2,
    pay: 0.85,
    trays: [1],
    purity: [82, 90],
    chili: 1,
    tints: ['sky', 'blue'],
    packs: ['baggie'],
    cuts: ['rocks'],
    lines: { great: 'That is some Star Trek-level stuff, yo.', good: 'Not bad. Not bad at all.', okay: 'Dude. It’s okay.', bad: 'Dude. No.' },
  },
  pete: {
    name: 'Skinny Pete',
    from: 1,
    patience: 1.2,
    pay: 0.85,
    trays: [1, 2],
    purity: [82, 90],
    chili: 0.6,
    tints: ['blue', 'deep'],
    packs: ['baggie'],
    cuts: ['rocks', 'shards'],
    lines: { great: 'That is like Mozart, man.', good: 'Solid, yo.', okay: 'Eh. Could be bluer.', bad: 'Not cool, man. Not cool.' },
  },
  tuco: {
    name: 'Tuco',
    from: 2,
    patience: 0.6,
    pay: 1.2,
    trays: [2],
    purity: [90, 95],
    chili: 0.4,
    tints: ['blue', 'deep'],
    packs: ['baggie'],
    cuts: ['shards'],
    lines: { great: 'Tight, tight, tight!', good: 'Tight.', okay: 'You call this tight?', bad: 'You think this is a joke?' },
  },
  mike: {
    name: 'Mike',
    from: 3,
    patience: 1,
    pay: 1.2,
    trays: [1, 2],
    purity: [94, 97],
    chili: 0,
    tints: ['blue'],
    packs: ['baggie', 'box'],
    cuts: ['rocks'],
    lines: { great: 'No half measures. Good.', good: 'It’ll do.', okay: 'Half measures.', bad: 'We’re done here.' },
  },
  gus: {
    name: 'Gus',
    from: 4,
    patience: 0.9,
    pay: 1.8,
    trays: [2, 3],
    purity: [98, 99],
    chili: 0,
    tints: ['blue'],
    packs: ['box'],
    cuts: ['shards'],
    lines: { great: 'Thank you for your business.', good: 'Acceptable.', okay: 'I hide in plain sight. This doesn’t.', bad: 'Explain yourself.' },
  },
  lydia: {
    name: 'Lydia',
    from: 5,
    patience: 0.8,
    pay: 1.5,
    trays: [2, 3],
    purity: [96, 98],
    chili: 0,
    tints: ['blue', 'deep'],
    packs: ['barrel'],
    cuts: ['rocks', 'shards'],
    lines: { great: 'Fine. Fine. Good. The Czechs will love it.', good: 'Good enough for the Czech Republic.', okay: 'This isn’t the right blue.', bad: 'I can’t ship this. I can’t.' },
  },
  declan: {
    name: 'Declan',
    from: 5,
    patience: 1,
    pay: 1.4,
    trays: [3],
    purity: [90, 95],
    chili: 0,
    tints: ['blue', 'deep'],
    packs: ['barrel'],
    cuts: ['rocks'],
    lines: { great: 'Okay. Okay, chef.', good: 'That’s the product.', okay: 'You call this blue?', bad: 'Then we have a problem.' },
  },
  saul: {
    name: 'Saul',
    from: 6,
    patience: 1.3,
    pay: 1.3,
    trays: [1],
    purity: [85, 92],
    chili: 0.5,
    tints: ['sky', 'blue', 'deep'],
    packs: ['box', 'baggie'],
    cuts: ['rocks'],
    lines: { great: 'S’all good, man!', good: 'Better call Saul. Better buy from you.', okay: 'I’ve seen worse. I’ve represented worse.', bad: 'I know a guy. A better guy.' },
  },
};

export const UPGRADES = [
  { id: 'burner', name: 'A better burner', cost: 40, text: 'The green on the gauge is a third wider.' },
  { id: 'notes', name: 'Gale’s lab notes', cost: 60, text: 'Pours and the scale forgive a little more, and the hammer’s window is wider.' },
  { id: 'huell', name: 'Huell at the door', cost: 55, text: 'Customers wait a third longer before they get restless.' },
  { id: 'billboard', name: 'Saul’s billboard', cost: 80, text: 'A quarter more on every sale.' },
  { id: 'superlab', name: 'The superlab', cost: 150, text: 'Out of the RV, under the laundry: every cook is a quarter quicker.' },
];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const has = (upgrades, id) => !!upgrades?.includes(id);

// Who can turn up on a given day.
export const rosterFor = (day) => Object.keys(CUSTOMERS).filter((id) => CUSTOMERS[id].from <= day);

// One order, in the customer's taste. Later days ask for a little more.
export function makeOrder(id, day, rand = Math.random) {
  const c = CUSTOMERS[id];
  const [lo, hi] = c.purity;
  const lean = Math.min(1, (day - c.from) / 6); // regulars get pickier
  const purity = Math.round(clamp(lo + (hi - lo) * (rand() * 0.6 + lean * 0.4), 80, 99));
  return {
    customer: id,
    trays: pick(c.trays, rand),
    tint: pick(c.tints, rand),
    chili: rand() < c.chili,
    purity,
    cut: pick(c.cuts, rand),
    pack: pick(c.packs, rand),
  };
}

// A shift: who comes and when (seconds into the shift). Newcomers on the day
// they unlock are sure to turn up.
export function newDay(career, rand = Math.random) {
  const day = career.day;
  const count = Math.min(LAB.maxCustomers, LAB.firstCustomers + Math.floor((day - 1) / 2));
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
  // newcomers don't all bunch up at the start
  for (let i = who.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [who[i], who[j]] = [who[j], who[i]];
  }
  let t = 0;
  const [a, b] = LAB.arriveEvery;
  const queue = who.map((id, i) => {
    if (i) t += a + rand() * (b - a);
    return { id: `${day}-${i}`, customer: id, arrive: Math.round(t * 10) / 10, order: makeOrder(id, day, rand) };
  });
  return { day, queue, t: 0 };
}

// Pours: the base to its line, the tint to its shade, Chili P as ordered.
export function mixScore(order, { base, blue, chili }, upgrades = []) {
  const ease = has(upgrades, 'notes') ? 0.7 : 1;
  const baseErr = Math.abs(base - LAB.baseFor(order.trays)) * ease;
  const blueErr = Math.abs(blue - LAB.tints[order.tint].level) * ease;
  const pour = clamp(100 - Math.max(0, baseErr - 0.015) * 320);
  const tint = clamp(100 - Math.max(0, blueErr - 0.015) * 300);
  const spice = order.chili ? (chili > 0 ? 100 : 0) : chili > 0 ? 0 : 100;
  return Math.round(pour * 0.42 + tint * 0.42 + spice * 0.16);
}

// The cook: full marks at the top purity, gentle above the order, steep below it.
export function cookScore(order, purity) {
  const above = Math.max(0, LAB.topPurity - Math.max(purity, order.purity));
  const below = Math.max(0, order.purity - purity);
  return Math.round(clamp(100 - above * 3 - below * 12));
}

// The break: each strike's accuracy (0 to 1) for the cracks that broke; a
// crack never struck counts as nothing, and a wild swing costs a little.
export function breakScore(hits, cracks, wild = 0) {
  const got = hits.slice(0, cracks).reduce((a, b) => a + b, 0);
  return Math.round(clamp((got / cracks) * 100 - wild * 6));
}

// Bagging: one bag a tray, each weighed against the pack's mark.
export function bagScore(order, weights, upgrades = []) {
  const ease = has(upgrades, 'notes') ? 0.7 : 1;
  const target = LAB.packs[order.pack].weight;
  let sum = 0;
  for (let i = 0; i < order.trays; i++) {
    const w = weights[i];
    if (w == null) continue;
    const err = (w > target ? (w - target) * 1.6 : target - w) * ease;
    sum += clamp(100 - Math.max(0, err - 0.01) * 380);
  }
  return Math.round(sum / order.trays);
}

// How long they waited, against how long they're willing to.
export function waitScore(seconds, id, upgrades = []) {
  const patience = LAB.patience * (CUSTOMERS[id]?.patience ?? 1) * (has(upgrades, 'huell') ? 1.33 : 1);
  if (seconds <= patience) return 100;
  return Math.round(clamp(100 - ((seconds - patience) / patience) * 60, 30));
}

export function grade(scores) {
  const w = LAB.weights;
  const total = Math.round(Object.keys(w).reduce((sum, k) => sum + (scores[k] ?? 0) * w[k], 0));
  const mood = total >= 90 ? 'great' : total >= 75 ? 'good' : total >= 55 ? 'okay' : 'bad';
  return { total, mood };
}

// What a finished order brings in: a base price a tray, scaled hard by quality.
export function payFor(order, total, upgrades = []) {
  const c = CUSTOMERS[order.customer];
  const quality = 0.25 + 0.95 * (total / 100) ** 2;
  return Math.round(LAB.price * order.trays * quality * (c?.pay ?? 1) * (has(upgrades, 'billboard') ? 1.25 : 1));
}

export const pointsFor = (total) => Math.round(total / 10) + (total >= 90 ? 4 : 0);

export function rankFor(points) {
  let i = 0;
  while (i + 1 < LAB.ranks.length && points >= LAB.ranks[i + 1][0]) i += 1;
  const next = LAB.ranks[i + 1]?.[0] ?? null;
  return { index: i, title: LAB.ranks[i][1], from: LAB.ranks[i][0], next };
}

const UPGRADE_IDS = new Set(UPGRADES.map((u) => u.id));

// A career from whatever was saved (or nothing), cleaned up.
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

// The cook's green band at a point in the cook (0 to 1), wider with the burner.
export function bandAt(k, upgrades = []) {
  const half = (LAB.bandWide - (LAB.bandWide - LAB.bandNarrow) * Math.min(1, k)) * (has(upgrades, 'burner') ? 1.35 : 1);
  return [LAB.bandMid - half, LAB.bandMid + half];
}

export const cookSeconds = (trays, upgrades = []) => (LAB.cookBase + LAB.cookPerTray * trays) * (has(upgrades, 'superlab') ? 0.75 : 1);
export const strikeWindow = (upgrades = []) => LAB.strikeWindow * (has(upgrades, 'notes') ? 1.35 : 1);

// Where the cracks fall on a tray: spread out, never bunched.
export function cracksFor(cut, rand = Math.random) {
  const n = LAB.cuts[cut].cracks;
  const out = [];
  for (let i = 0; i < n; i++) {
    const lo = 0.1 + (0.8 * i) / n;
    const hi = 0.1 + (0.8 * (i + 1)) / n;
    out.push(lo + (hi - lo) * (0.25 + rand() * 0.5));
  }
  return out;
}
