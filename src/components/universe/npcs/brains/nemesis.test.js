import { describe, expect, it } from 'vitest';
import { NPC } from './common';
import { createBrains } from '../../npcRules';
import nemesis from './nemesis';
import { DT, apart, chase, foe, meet, seeded, you } from './harness';

describe('a nemesis on the toolkit', () => {
  it('weighs its moves: it passes, jinks and orbits as before, and never stops shooting', () => {
    const seen = meet({ ship: you({ speed: 8 }), steer: (s) => ({ ...s, heading: s.heading + 0.3 * DT }), seconds: 40 });
    expect(seen.modes.has('pass')).toBe(true);
    expect(seen.modes.has('orbit')).toBe(true);
    expect(seen.shots.length).toBeGreaterThan(15);
    expect(seen.says).toContain('hello');
  });

  it('baits an overshoot once you have sat on its tail a while, and says so', () => {
    let baitedAt = null;
    let slowest = Infinity;
    let me = null;
    const seen = meet({
      at: { x: 0, y: 0, z: -14 },
      seconds: 30,
      steer: (s, t) => (t < 2 ? s : chase(me, s, 14)),
      each: (m, s, out, t) => {
        me = m;
        if (!m) return;
        if (m.mind.mode === 'bait' && baitedAt === null) baitedAt = t;
        if (m.mind.mode === 'bait') slowest = Math.min(slowest, Math.hypot(m.vel.x, m.vel.y, m.vel.z));
      },
    });
    expect(baitedAt).not.toBeNull();
    expect(baitedAt).toBeGreaterThan(NPC.tail * 0.4);
    expect(slowest).toBeLessThan(26 * 0.6);
    expect(seen.says).toContain('bait');
  });

  it('breaks off your nose when a shot of yours is coming, and not twice in a breath', () => {
    const brokeAt = [];
    let headingBefore = null;
    let turned = 0;
    meet({
      at: { x: 0, y: 0, z: -12 },
      seconds: 12,
      each: (m, s, out, t) => {
        if (!m) return;
        if (m.mind.mode === 'break' && (brokeAt.length === 0 || t - brokeAt[brokeAt.length - 1] > NPC.break + 0.1)) brokeAt.push(t);
      },
      // (a stim every frame from 3 s to 3.3 s, and again at 3.6 s: aimed at it)
      steer: (s) => s,
    });
    // the stims need the nemesis's position: run it by hand
    const brains = createBrains({ rand: seeded(5) });
    brains.add(foe(), { x: 0, y: 0, z: -12 });
    const me = brains.live[0];
    const s = you();
    const breaks = [];
    for (let t = 0; t < 12; t += DT) {
      const firing = (t > 3 && t < 3.3) || (t > 3.6 && t < 3.9);
      const stims = firing ? [{ type: 'shot', at: { x: 0, y: 0, z: 0 }, aim: { ...me.pos }, radius: 120, from: 'you', loudness: 1 }] : [];
      brains.update(DT, { you: s, hunters: [], stations: [], stims });
      if (me.mind.mode === 'break' && (breaks.length === 0 || t - breaks[breaks.length - 1] > NPC.break + 0.1)) breaks.push(t);
      if (Math.abs(t - 3) < DT / 2) headingBefore = Math.atan2(me.vel.x, me.vel.z);
      if (Math.abs(t - 3.5) < DT / 2) turned = Math.abs(Math.atan2(Math.sin(Math.atan2(me.vel.x, me.vel.z) - headingBefore), Math.cos(Math.atan2(me.vel.x, me.vel.z) - headingBefore)));
    }
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toBeGreaterThan(3);
    expect(breaks[0]).toBeLessThan(3.1);
    expect(turned).toBeGreaterThan(0.4);
    expect(brokeAt).toHaveLength(0); // (nothing fired in the first run: no break)
  });

  it('the fury outranks the duel, and it does not fall back twice', () => {
    const fallbacks = [];
    let furyOrbits = 0;
    let furyFrames = 0;
    let was = null;
    meet({
      seconds: 60,
      each: (m, s, out, t) => {
        if (!m) return;
        if (Math.abs(t - 10) < DT / 2) m.hp = Math.round(m.hpMax * 0.5); // under NPC.summon
        if (Math.abs(t - 30) < DT / 2) m.hp = Math.round(m.hpMax * 0.3); // under NPC.fury
        if (m.mind.mode === 'fallback' && was !== 'fallback') fallbacks.push(t);
        was = m.mind.mode;
        if (t > 30.5 && t < 33) {
          furyFrames += 1;
          if (m.mind.mode === 'orbit') furyOrbits += 1;
        }
      },
    });
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toBeGreaterThan(10);
    expect(fallbacks[0]).toBeLessThan(11);
    // in a fury it's passing, jinking or breaking most of the time, not idling round you
    expect(furyOrbits / furyFrames).toBeLessThan(0.7);
  });

  it('says search when it loses you behind a moon and found when it has you back, and gives up a lost guess', () => {
    // you sit under its nose; at 5 s you're away behind a moon (a jump, for the test's sake); it chases its guess round the moon and finds you
    const moon = { at: [0, 0, -40], r: 25 };
    const seen = meet({ at: { x: 0, y: 0, z: -10 }, seconds: 30, world: (t) => ({ solids: t > 5 ? [moon] : [] }), steer: (s, t) => (t > 5 ? { ...s, x: 0, z: -80 } : s) });
    expect(seen.says).toContain('search');
    expect(seen.says).toContain('found');
    expect(seen.says.indexOf('search')).toBeLessThan(seen.says.indexOf('found'));
    // its guess gone (the brain alone, with no you and only where it last had you): it looks about a while, then breaks off
    const npc = foe();
    const me = { n: 1, npc, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, hp: 20, hpMax: 20, clock: 20, memory: { met: 1, grudge: 0 }, mind: {}, last: { x: 30, y: 0, z: 30 } };
    const intents = [];
    for (let t = 0; t < NPC.search + 1; t += DT) {
      me.clock += DT;
      intents.push(nemesis(npc, me, { you: null }, DT, seeded(1)));
    }
    expect(intents[1].say).toBe('search');
    expect(apart(intents[1].to, me.last)).toBeLessThan(NPC.orbit + 3);
    expect(intents[intents.length - 1]).toMatchObject({ leave: true, say: 'retreat' });
    expect(me.memory.last.how).toBe('retreat');
  });

  it('comes in from the other side next time, as its memory says', () => {
    const memory = { 'test-nemesis': { met: 1, shot: 0, grudge: 1, downed: 0, last: { how: 'retreat', from: 'right' } } };
    let firstSide = null;
    meet({
      memory,
      seconds: 3,
      ship: you({ speed: 6 }),
      each: (m, s) => {
        if (!m || firstSide !== null || m.clock < 1) return;
        // which side of your nose it circles on
        const rx = Math.cos(s.heading);
        const rz = -Math.sin(s.heading);
        firstSide = (m.pos.x - s.x) * rx + (m.pos.z - s.z) * rz > 0 ? 'right' : 'left';
      },
    });
    expect(firstSide).toBe('left');
  });
});
