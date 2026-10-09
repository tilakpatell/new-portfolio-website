import { describe, expect, it } from 'vitest';
import { CALL_COUNT, CHILI, CONVOS, FIRE, HOOPS, QUESTS, SEAL, callOf, fireLeft, meterAt, newChili, newHoops, officeProgress, shoot, stepChili, stepHoops } from './story';

// walks Jim across the floor at `speed` m/s for `seconds`, turning `turn` rad/s
const carry = (c, { speed = 1, turn = 0, running = false, seconds = 1, dt = 1 / 60 } = {}) => {
  let face = 0;
  for (let t = 0; t < seconds; t += dt) {
    face += turn * dt;
    c = stepChili(c, { vx: Math.sin(face) * speed, vz: Math.cos(face) * speed, face, speed, running }, dt);
  }
  return c;
};

describe('the office’s week: the jobs', () => {
  it('names an award for every job, and opens the Dundies last', () => {
    for (const q of QUESTS) expect(SEAL[q.id], q.id).toBeTruthy();
    const dundies = QUESTS.find((q) => q.id === 'dundies');
    expect(new Set(dundies.needs)).toEqual(new Set(QUESTS.filter((q) => q.id !== 'dundies').map((q) => q.id)));
  });

  it('says what to do next, and that the week’s done when it is', () => {
    expect(officeProgress([]).objective).toBe(QUESTS.find((q) => q.id === officeProgress([]).next).go);
    const all = officeProgress(QUESTS.map((q) => q.id));
    expect(all.finished).toBe(true);
    expect(all.objective).toMatch(/week’s done/);
  });
});

describe('the phones', () => {
  it('reaches the end through the right desk every time, and back to the call from a wrong one', () => {
    const { start, nodes } = CONVOS.phones;
    let at = start;
    let calls = 0;
    for (let i = 0; i < 40 && !nodes[at].end; i++) {
      const n = nodes[at];
      if (n.choices) {
        calls++;
        const wrong = n.choices.find((c) => c.to.startsWith('miss'));
        expect(nodes[wrong.to].next).toBe(at);
        // the right desk: the one choice that doesn't miss
        const right = n.choices.filter((c) => !c.to.startsWith('miss'));
        expect(right).toHaveLength(1);
        at = right[0].to;
      } else at = n.next;
    }
    expect(nodes[at].end).toBe('won');
    expect(calls).toBe(CALL_COUNT);
  });

  it('knows which call a node is on', () => {
    expect(callOf('c0')).toBe(0);
    expect(callOf('ok2')).toBe(2);
    expect(callOf('miss3-toby')).toBe(3);
    expect(callOf('done')).toBe(CALL_COUNT);
    expect(callOf(null)).toBe(0);
  });

  it('leaves no node pointing nowhere, in either talk', () => {
    for (const [id, convo] of Object.entries(CONVOS))
      for (const [name, n] of Object.entries(convo.nodes)) {
        for (const to of [n.next, ...(n.choices ?? []).map((c) => c.to)].filter(Boolean)) expect(convo.nodes[to], `${id}: ${name} → ${to}`).toBeTruthy();
        expect(Boolean(n.end || n.next || n.choices), `${id}: ${name}`).toBe(true);
      }
  });
});

describe('Kevin’s chili', () => {
  it('stays in the pot at a steady walk', () => {
    expect(carry(newChili(), { speed: 1.5, seconds: 20 }).spilt).toBe(false);
  });

  it('slops over on a run', () => {
    const c = carry(newChili(), { speed: 4.4, running: true, seconds: 3 });
    expect(c.spilt).toBe(true);
    expect(c.slosh).toBeGreaterThanOrEqual(CHILI.brim);
  });

  it('sloshes more on a sharp turn than a straight line, and settles when he stops', () => {
    const straight = carry(newChili(), { speed: 2, seconds: 0.5 });
    const sharp = carry(newChili(), { speed: 2, turn: 6, seconds: 0.5 });
    expect(sharp.slosh).toBeGreaterThan(straight.slosh);
    const stopped = carry(sharp, { speed: 0, seconds: 3 });
    expect(stopped.slosh).toBeLessThan(sharp.slosh);
  });

  it('stays spilt once spilt, and a frame with no time changes nothing', () => {
    const spilt = { ...newChili(), spilt: true, slosh: 1 };
    expect(stepChili(spilt, { vx: 9, vz: 9, face: 1, speed: 9, running: true }, 1 / 60)).toBe(spilt);
    const c = newChili();
    expect(stepChili(c, { vx: 9, vz: 0, face: 0, speed: 9 }, 0)).toBe(c);
  });
});

describe('free throws', () => {
  it('swings the meter between 0 and 1', () => {
    const h = newHoops();
    for (let t = 0; t < 5; t += 0.05) {
      h.t = t;
      const m = meterAt(h);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    }
  });

  it('calls a shot at the sweet spot a swish and one far off a miss, and takes one shot at a time', () => {
    const at = (power) => {
      const h = newHoops();
      // (the meter climbs from 0 at HOOPS.speed a second on the first shot)
      h.t = power / HOOPS.speed;
      return { h, kind: shoot(h) };
    };
    expect(at(HOOPS.sweet).kind).toBe('swish');
    expect(at(HOOPS.sweet + (HOOPS.swish + HOOPS.rim) / 2).kind).toBe('rim');
    expect(at(0.1).kind).toBe('short');
    expect(at(0.99).kind).toBe('long');
    const { h } = at(HOOPS.sweet);
    expect(shoot(h)).toBe(null);
  });

  it('lands each ball after its flight, and ends at three made or too many missed', () => {
    const play = (power) => {
      const h = newHoops();
      const out = [];
      while (!h.over) {
        h.t = power / (HOOPS.speed * (1 + h.shots * 0.08));
        shoot(h);
        let r = null;
        while (!r) r = stepHoops(h, 0.1);
        out.push(r);
      }
      return { h, out };
    };
    const won = play(HOOPS.sweet);
    expect(won.out).toEqual(['in', 'in', 'in']);
    expect(won.h.made).toBe(HOOPS.need);
    const lost = play(0.05);
    expect(lost.out).toEqual(['out', 'out', 'out']);
    expect(lost.h.shots).toBe(HOOPS.shots - HOOPS.need + 1);
  });
});

describe('the fire drill', () => {
  it('counts down whole seconds to nothing', () => {
    expect(fireLeft(0)).toBe(FIRE.time);
    expect(fireLeft(FIRE.time - 0.5)).toBe(1);
    expect(fireLeft(FIRE.time + 10)).toBe(0);
  });
});
