import { describe, expect, it } from 'vitest';
import { ageOf, beatMorty, epitaph, MORTY_BEST, newLife, OLD_AGE, rand, STAGE_INFO, STAGES, stageTitle, stepLife } from './rules';

const DT = 1 / 60;
const idle = () => ({});
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SEEDS_20 = Array.from({ length: 20 }, (_, i) => i + 1);

// a tackler or a roll that is close and in Roy's lane: step aside (one key is one lane)
function dodge(items, lane) {
  const next = items.filter((o) => o.z > 0).sort((a, b) => a.z - b.z)[0];
  if (next && next.lane === lane && next.z < 5) return lane === 0 ? { right: true } : { left: true };
  return {};
}

// a kid who throws once per window, except the first `misses` throws, which go when the tire is far out
function kid(misses = 0) {
  let was = false;
  return (life) => {
    const want = life.s.throws < misses ? Math.abs(life.s.phase) > 0.9 : Math.abs(life.s.phase) < 0.28;
    const act = want && !was;
    was = want;
    return { act };
  };
}

// a seller who picks the wrong lane for the first `misses` customers
function seller(misses = 0) {
  return (life) => {
    const { s } = life;
    if (s.choice || !s.customer) return {};
    const want = s.served < misses ? (s.customer.want + 1) % 3 : s.customer.want;
    if (s.pointer < want) return { right: true };
    if (s.pointer > want) return { left: true };
    return { act: true };
  };
}

// the perfect player: reads only life.s, one stage after another. `fumble` names a stage it sits out.
function perfect(fumble) {
  const kidBrain = kid();
  const sellerBrain = seller();
  let beatsSeen = 0;
  return (life) => {
    const { s } = life;
    if (life.stage === fumble) return {};
    if (life.stage === 'kid') return kidBrain(life);
    if (life.stage === 'football') return dodge(s.tacklers, life.lane);
    if (life.stage === 'carpet') return sellerBrain(life);
    if (life.stage === 'cancer') {
      const act = s.elapsed > beatsSeen; // a beat has just sounded
      beatsSeen = s.elapsed;
      return { act };
    }
    return dodge(s.rolls, life.lane);
  };
}

function play(life, brain, stop, max = 100000) {
  const events = [];
  let n = 0;
  while (n < max && !stop(life)) {
    life = stepLife(life, brain(life), DT);
    events.push(...life.events);
    n++;
  }
  return { life, events, n };
}

// the perfect player's life, up to the first step of `stage`
const playTo = (stage, life = newLife(), fumble) => play(life, perfect(fumble), (l) => l.stage === stage).life;
const count = (events, name) => events.filter((e) => e === name).length;

function deepFreeze(o) {
  Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
}

describe('a new life', () => {
  it('starts as a boy, on the job route unless told otherwise', () => {
    expect(newLife()).toMatchObject({
      stage: 'kid',
      age: 0,
      t: 0,
      lane: 1,
      route: 'job',
      over: false,
      cause: null,
      grit: 0,
      stats: { dream: 0, touchdown: false, tackles: 0, sales: 0, beats: 0 },
      s: { throws: 0, hits: 0 },
      events: [],
    });
    expect(newLife({ offgrid: true }).route).toBe('offgrid');
  });

  it('knows its stages', () => {
    expect(MORTY_BEST).toBe(55);
    expect(OLD_AGE).toBe(100);
    expect(STAGES).toEqual(['kid', 'football', 'carpet', 'cancer', 'finale']);
    expect(STAGE_INFO.kid).toMatchObject({ title: 'Growing up', from: 0, to: 12 });
    expect(STAGE_INFO.football).toMatchObject({ title: 'Friday nights', from: 13, to: 18 });
    expect(STAGE_INFO.carpet).toMatchObject({ title: 'The carpet store', from: 19, to: 44 });
    expect(STAGE_INFO.cancer).toMatchObject({ title: 'The diagnosis', from: 45, to: 45 });
    expect(STAGE_INFO.finale).toMatchObject({ title: 'Back to work', from: 46 });
    expect(stageTitle({ stage: 'carpet', route: 'offgrid' })).toBe('Off the grid');
    expect(stageTitle({ stage: 'finale', route: 'offgrid' })).toBe('The woods');
    expect(stageTitle({ stage: 'finale', route: 'job' })).toBe('Back to work');
    expect(stageTitle({ stage: 'kid', route: 'offgrid' })).toBe('Growing up');
  });
});

describe('growing up', () => {
  it('scores five hits for a throw in every window, and is twelve when it ends', () => {
    for (const seed of SEEDS) {
      const { life, events } = play(newLife({ seed }), perfect(), (l) => l.stage !== 'kid');
      expect(count(events, 'throw'), `seed ${seed}`).toBe(5);
      expect(count(events, 'hit'), `seed ${seed}`).toBe(5);
      expect(count(events, 'miss'), `seed ${seed}`).toBe(0);
      expect(life.stats.dream).toBe(5);
      expect(life.stage).toBe('football');
      expect(events).toContain('stage');
      expect(ageOf(life)).toBe(12);
    }
  });

  it('starts the tire off the middle, so the first throw is no free hit', () => {
    let life = newLife();
    expect(Math.abs(life.s.phase)).toBeGreaterThan(0.9);
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['throw', 'miss']);
    while (Math.abs(life.s.phase) >= 0.28) life = stepLife(life, {}, DT);
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['throw', 'hit']);
    expect(life.s).toMatchObject({ throws: 2, hits: 1 });
    expect(life.age).toBeCloseTo((12 * 2) / 5);
  });

  it('waits for the throws', () => {
    const { life } = play(newLife(), idle, (l) => l.t > 20);
    expect(life.stage).toBe('kid');
    expect(life.s.throws).toBe(0);
  });

  it('earns grit for four hits or more, and not for three', () => {
    for (const [misses, grit] of [[0, 1], [1, 1], [2, 0]]) {
      const { life } = play(newLife(), kid(misses), (l) => l.stage !== 'kid');
      expect(life.stats.dream).toBe(5 - misses);
      expect(life.grit).toBe(grit);
    }
  });
});

describe('Friday nights', () => {
  it('ends by 16 seconds with no input, and Roy is 18; a quiet player scores on fewer than half the seeds', () => {
    let scored = 0;
    let timedOut = 0;
    for (const seed of SEEDS_20) {
      const start = playTo('football', newLife({ seed }));
      const { life, events, n } = play(start, idle, (l) => l.stage !== 'football');
      expect(life.stage, `seed ${seed}`).toBe('carpet');
      expect(n, `seed ${seed}`).toBeLessThanOrEqual(16 * 60 + 1);
      expect(ageOf(life)).toBe(18);
      expect(count(events, 'tackle')).toBe(life.stats.tackles);
      expect(life.grit).toBe(start.grit + (life.stats.touchdown ? 1 : 0));
      if (life.stats.touchdown) scored++;
      else timedOut++;
    }
    expect(scored).toBeLessThan(10);
    expect(timedOut).toBeGreaterThan(0);
  });

  it('gives no forward progress while stunned', () => {
    let { life } = play(playTo('football'), idle, (l) => l.events.includes('tackle'), 16 * 60);
    expect(life.events).toContain('tackle');
    expect(life.s.stun).toBeCloseTo(1.5);
    while (life.s.stun > 0) {
      const before = life.s.dist;
      life = stepLife(life, {}, DT);
      expect(life.s.dist).toBe(before);
    }
    const before = life.s.dist;
    life = stepLife(life, {}, DT);
    expect(life.s.dist).toBeGreaterThan(before);
  });

  it('is a touchdown for a player who steps out of the way, on every seed', () => {
    for (const seed of SEEDS_20) {
      const { life, events } = play(playTo('football', newLife({ seed })), perfect(), (l) => l.stage !== 'football');
      expect(count(events, 'touchdown'), `seed ${seed}`).toBe(1);
      expect(count(events, 'tackle'), `seed ${seed}`).toBe(0);
      expect(life.stats).toMatchObject({ touchdown: true, tackles: 0 });
      expect(ageOf(life)).toBe(18);
      expect(life.grit).toBe(2);
    }
  });

  it('keeps Roy in the three lanes', () => {
    let life = playTo('football');
    for (let i = 0; i < 4; i++) life = stepLife(life, { left: true }, DT);
    expect(life.lane).toBe(0);
    for (let i = 0; i < 5; i++) life = stepLife(life, { right: true }, DT);
    expect(life.lane).toBe(2);
  });
});

describe('the carpet store', () => {
  it('serves eight customers for eight sales, and Roy is 44', () => {
    for (const seed of SEEDS) {
      const { life, events } = play(playTo('carpet', newLife({ seed })), perfect(), (l) => l.stage !== 'carpet');
      expect(count(events, 'sale'), `seed ${seed}`).toBe(8);
      expect(count(events, 'lost'), `seed ${seed}`).toBe(0);
      expect(life.stats.sales).toBe(8);
      expect(life.stage).toBe('cancer');
      expect(ageOf(life)).toBe(44);
      expect(life.grit).toBe(3);
    }
  });

  it('gets a year older as the line goes, from 19 to 44', () => {
    let life = playTo('carpet');
    const brain = perfect();
    let served = 0;
    while (life.stage === 'carpet') {
      life = stepLife(life, brain(life), DT);
      if (life.events.includes('sale')) {
        served++;
        expect(life.age).toBeCloseTo(19 + (25 * served) / 8);
      }
    }
    expect(served).toBe(8);
    expect(life.age).toBe(44);
  });

  it('is the same eight customers off the grid', () => {
    const { life, events } = play(playTo('carpet', newLife({ offgrid: true })), perfect(), (l) => l.stage !== 'carpet');
    expect(count(events, 'sale')).toBe(8);
    expect(life.route).toBe('offgrid');
    expect(life.grit).toBe(3);
  });

  it('earns grit for six sales or more, and not for five', () => {
    for (const [misses, sales, grit] of [[2, 6, 1], [3, 5, 0]]) {
      const start = playTo('carpet');
      const { life, events } = play(start, seller(misses), (l) => l.stage !== 'carpet');
      expect(count(events, 'lost')).toBe(misses);
      expect(life.stats.sales).toBe(sales);
      expect(life.grit).toBe(start.grit + grit);
    }
  });

  it('loses a customer who is picked wrong, and one who runs out of patience', () => {
    let life = playTo('carpet');
    while (!life.s.customer) life = stepLife(life, {}, DT);
    const wrong = (life.s.customer.want + 1) % 3;
    while (life.s.pointer !== wrong) life = stepLife(life, { [life.s.pointer < wrong ? 'right' : 'left']: true }, DT);
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['lost']);
    expect(life.s).toMatchObject({ served: 1, customer: null });
    expect(life.stats.sales).toBe(0);

    const { life: done, events } = play(life, idle, (l) => l.stage !== 'carpet');
    expect(count(events, 'lost')).toBe(7);
    expect(done.stats.sales).toBe(0);
    expect(done.stage).toBe('cancer');
  });

  it('goes straight in when no choice is offered', () => {
    let life = playTo('carpet');
    life = stepLife(life, {}, DT);
    expect(life.s.choice).toBe(false);
    const { life: later } = play(life, idle, (l) => l.s.customer);
    expect(later.s.customer).toMatchObject({ patience: expect.any(Number) });
    expect([0, 1, 2]).toContain(later.s.customer.want);
  });

  it('waits at the fork when a choice is offered, and takes the route it is given', () => {
    let life = playTo('carpet', newLife({ offerChoice: true }));
    for (let i = 0; i < 300; i++) life = stepLife(life, { act: true, left: true }, DT);
    expect(life.s).toMatchObject({ choice: true, customer: null, served: 0 });
    life = stepLife(life, { choose: 'banana' }, DT);
    expect(life.s.choice).toBe(true);
    life = stepLife(life, { choose: 'offgrid' }, DT);
    expect(life).toMatchObject({ route: 'offgrid' });
    expect(life.s.choice).toBe(false);
    expect(stageTitle(life)).toBe('Off the grid');
    const { life: after, events } = play(life, perfect(), (l) => l.stage !== 'carpet');
    expect(count(events, 'sale')).toBe(8);
    expect(after.route).toBe('offgrid');
  });
});

describe('the diagnosis', () => {
  it('kills Roy at 45 when he does nothing', () => {
    const { life, events } = play(playTo('cancer'), idle, (l) => l.over);
    expect(life).toMatchObject({ over: true, cause: 'cancer', stage: 'cancer', endAge: 45 });
    expect(ageOf(life)).toBe(45);
    expect(count(events, 'death')).toBe(1);
  });

  it('kills Roy at 45 when he keeps missing the beat', () => {
    const { life, events } = play(playTo('cancer'), () => ({ act: true }), (l) => l.over);
    expect(count(events, 'offbeat')).toBe(6);
    expect(life).toMatchObject({ over: true, cause: 'cancer', endAge: 45 });
  });

  it('is beaten by twelve beats on time, which is the finale', () => {
    for (const seed of SEEDS) {
      const { life, events } = play(playTo('cancer', newLife({ seed })), perfect(), (l) => l.stage !== 'cancer');
      expect(count(events, 'beat'), `seed ${seed}`).toBe(12);
      expect(count(events, 'offbeat'), `seed ${seed}`).toBe(0);
      expect(life).toMatchObject({ stage: 'finale', over: false });
      expect(life.stats.beats).toBe(12);
    }
  });

  it('counts a beat once, so mashing around it is an offbeat', () => {
    let life = playTo('cancer');
    while (life.s.elapsed < 1) life = stepLife(life, {}, DT);
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['beat']);
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['offbeat']);
    expect(life.s).toMatchObject({ beats: 1, offbeats: 1 });
  });

  it('counts a press just before the beat, and not the beat itself again', () => {
    let life = playTo('cancer');
    while (life.s.beatT < 0.62) life = stepLife(life, {}, DT); // 0.1 s early, inside the 0.16 s window
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['beat']);
    while (life.s.elapsed < 1) life = stepLife(life, {}, DT);
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['offbeat']);
  });

  it('calls a press 0.3 s from the beat an offbeat', () => {
    let life = playTo('cancer');
    while (life.s.beatT < 0.3) life = stepLife(life, {}, DT);
    life = stepLife(life, { act: true }, DT);
    expect(life.events).toEqual(['offbeat']);
    expect(life.s).toMatchObject({ beats: 0, offbeats: 1 });
  });
});

describe('back to work', () => {
  it('ends under a roll of carpet for a player who stands still', () => {
    const { life, events } = play(playTo('finale'), idle, (l) => l.over);
    expect(life).toMatchObject({ over: true, cause: 'carpet', stage: 'finale' });
    expect(count(events, 'death')).toBe(1);
    expect(ageOf(life)).toBeGreaterThanOrEqual(46);
    expect(life.endAge).toBe(ageOf(life));
  });

  it('ends under a log for one who went off the grid', () => {
    const { life } = play(playTo('finale', newLife({ offgrid: true })), idle, (l) => l.over);
    expect(life).toMatchObject({ over: true, cause: 'log' });
  });

  it('gives a year for every one dodged', () => {
    let life = playTo('finale');
    const brain = perfect();
    let years = 0;
    for (let i = 0; i < 2000 && years < 3; i++) {
      const before = life.age;
      life = stepLife(life, brain(life), DT);
      if (life.events.includes('dodge')) {
        years++;
        expect(life.age).toBe(before + 1);
      }
    }
    expect(years).toBe(3);
    expect(ageOf(life)).toBe(49);
  });

  it('comes faster and quicker the older Roy gets', () => {
    const firstRoll = (age) => {
      const start = { ...playTo('finale'), age };
      const { life } = play(start, idle, (l) => l.s.rolls.length > 0);
      return { v: life.s.rolls[0].v, next: life.s.next };
    };
    const young = firstRoll(46);
    const old = firstRoll(80);
    expect(young.v).toBe(10);
    expect(old.v).toBe(10 + 34 * 0.25);
    expect(young.next).toBeCloseTo(1.3, 1);
    expect(old.next).toBeCloseTo(1.3 - 34 * 0.02, 1);
    expect(old.v).toBeGreaterThan(young.v);
    expect(old.next).toBeLessThan(young.next);
  });

  it('shrugs off a roll for each grit, then the next one kills', () => {
    for (const grit of [0, 1, 2]) {
      let life = { ...playTo('finale'), grit };
      let shrugs = 0;
      while (!life.over) {
        const age = life.age;
        const next = stepLife(life, {}, DT);
        if (next.events.includes('shrug')) {
          shrugs++;
          expect(next.events).not.toContain('dodge');
          expect(next.events).not.toContain('death');
          expect(next.age).toBe(age);
          expect(next.grit).toBe(grit - shrugs);
          expect(next.s.rolls.some((r) => r.z <= 0 && r.lane === next.lane)).toBe(false);
        }
        life = next;
      }
      expect(shrugs).toBe(grit);
      expect(life).toMatchObject({ cause: 'carpet', grit: 0 });
    }
  });

  it('lets a perfect dodger live to 100, a whole life in five stages', () => {
    for (const seed of SEEDS) {
      const { life, events, n } = play(newLife({ seed }), perfect(), (l) => l.over);
      expect(n, `seed ${seed}`).toBeLessThan(100000);
      expect(life).toMatchObject({ over: true, cause: 'old', endAge: OLD_AGE, grit: 3 });
      expect(ageOf(life)).toBe(OLD_AGE);
      expect(count(events, 'stage')).toBe(4);
      expect(count(events, 'death')).toBe(1);
      expect(count(events, 'dodge')).toBe(OLD_AGE - 46);
      expect(count(events, 'shrug')).toBe(0);
      expect(beatMorty(life)).toBe(true);
    }
  });

  it('leaves an over life alone, apart from clearing the events it ended with', () => {
    const { life: over } = play(playTo('finale'), idle, (l) => l.over);
    expect(over.events).toContain('death');
    const after = stepLife(over, { act: true, left: true }, DT);
    expect(after).toEqual({ ...over, events: [] });
    expect(stepLife(after, { act: true }, DT)).toBe(after);
  });
});

describe('the epitaph and the score to beat', () => {
  it('beats Morty only past 55', () => {
    expect(beatMorty({ ...newLife(), age: 56 })).toBe(true);
    expect(beatMorty({ ...newLife(), age: 55 })).toBe(false);
    expect(beatMorty({ ...newLife(), age: 55.9 })).toBe(false);
    expect(beatMorty({ ...newLife(), age: 56.2 })).toBe(true);
  });

  it('says the age range and how it ended', () => {
    const cancer = play(playTo('cancer'), idle, (l) => l.over).life;
    expect(epitaph(cancer)).toBe('Roy, 0–45. Dreamed of the NFL, scored a touchdown, sold carpet. Not ready to die.');

    const carpet = play(playTo('finale'), idle, (l) => l.over).life;
    expect(epitaph(carpet)).toContain(`Roy, 0–${ageOf(carpet)}. Dreamed of the NFL, scored a touchdown, sold carpet, beat cancer. A roll of carpet came loose.`);

    const log = play(playTo('finale', newLife({ offgrid: true })), idle, (l) => l.over).life;
    expect(epitaph(log)).toContain('lived off the grid in the woods, beat cancer. A log came down.');
    expect(epitaph(log)).not.toContain('carpet');

    const old = play(newLife(), perfect(), (l) => l.over).life;
    expect(epitaph(old)).toBe('Roy, 0–100. Dreamed of the NFL, scored a touchdown, sold carpet, beat cancer. A life well lived, all the way to 100.');
  });

  it('varies with how the life went', () => {
    const { life } = play(playTo('cancer'), idle, (l) => l.over);
    const poor = { ...life, stats: { ...life.stats, touchdown: false, sales: 1 } };
    expect(epitaph(poor)).toBe('Roy, 0–45. Dreamed of the NFL, sold hardly any carpet. Not ready to die.');
    expect(epitaph({ ...poor, route: 'offgrid' })).toContain('lived off the grid in the woods.');
  });
});

describe('purity and determinism', () => {
  it('never touches what it is given', () => {
    const brain = perfect();
    let life = newLife({ offerChoice: true });
    for (let i = 0; i < 6000 && !life.over; i++) {
      deepFreeze(life);
      const input = Object.freeze({ ...brain(life), choose: i % 2 ? 'job' : undefined });
      life = stepLife(life, input, DT);
    }
    expect(life.stage).not.toBe('kid');
    const frozen = deepFreeze(newLife());
    const before = JSON.stringify(frozen);
    stepLife(frozen, { act: true, left: true }, DT);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('never touches an idle life in the finale with grit to spend', () => {
    let life = { ...playTo('finale'), grit: 1 };
    for (let i = 0; i < 3000 && !life.over; i++) {
      deepFreeze(life);
      life = stepLife(life, {}, DT);
    }
    expect(life.over).toBe(true);
  });

  it('gives a fresh events array every step', () => {
    let life = newLife();
    life = stepLife(life, { act: true }, DT);
    const first = life.events;
    expect(first).toEqual(['throw', 'miss']);
    life = stepLife(life, {}, DT);
    expect(life.events).not.toBe(first);
    expect(life.events).toEqual([]);
    expect(first).toEqual(['throw', 'miss']);
  });

  it('takes no more than a tenth of a second at a time, and never goes back', () => {
    const big = stepLife(newLife(), {}, 5);
    expect(big.t).toBeCloseTo(0.1);
    expect(stepLife(newLife(), {}, -1).t).toBe(0);
    expect(stepLife(newLife(), {}, DT).t).toBeCloseTo(DT);
  });

  it('plays the same life from the same seed and the same keys', () => {
    const a = play(newLife({ seed: 7 }), perfect('football'), (l) => l.over);
    const b = play(newLife({ seed: 7 }), perfect('football'), (l) => l.over);
    expect(a.life).toEqual(b.life);
    expect(a.events).toEqual(b.events);
  });

  it('plays differently from another seed', () => {
    const seen = [1, 2, 3, 4, 5].map((seed) => JSON.stringify(play(playTo('football', newLife({ seed })), idle, (l) => l.stage !== 'football').life.stats));
    expect(new Set(seen).size).toBeGreaterThan(1);
  });

  it('draws the same numbers from the same state, and carries the next one on', () => {
    const [v, next] = rand(1);
    expect(rand(1)).toEqual([v, next]);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    expect(Number.isInteger(next) && next >= 0 && next < 2 ** 32).toBe(true);
    expect(rand(next)[0]).not.toBe(v);
  });
});
