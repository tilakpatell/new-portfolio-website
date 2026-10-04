import { describe, expect, it } from 'vitest';
import { DUEL, block, crossingFor, newDuel, strike, stepDuel } from './duel';
import { WALK, newWalk, stepWalk } from './walk';

const seq = (vals) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};
const run = (d, secs, dt = 1 / 60) => {
  const ev = [];
  for (let t = 0; t < secs && (d.phase === 'drums' || d.phase === 'coming'); t += dt) ev.push(...stepDuel(d, dt));
  return ev;
};
// steps until the Balrog stands at x
const until = (d, x) => {
  for (let i = 0; i < 2000 && d.phase !== 'lost' && (d.phase === 'drums' || d.x < x); i++) stepDuel(d, 1 / 60);
};
const noWhips = (d) => {
  d.nextLash = 1e9;
};

describe('the Bridge of Khazad-dûm', () => {
  it('beats the drums first, then the Balrog comes across', () => {
    const d = newDuel({ rand: seq([0.5]) });
    expect(d.phase).toBe('drums');
    run(d, DUEL.drums + 0.1);
    expect(d.phase).toBe('coming');
    const x = d.x;
    run(d, 1);
    expect(d.x).toBeGreaterThan(x);
  });

  it('is lost if nobody stops it', () => {
    const d = newDuel({ rand: seq([0.5]) });
    noWhips(d);
    run(d, 30);
    expect(d.phase).toBe('lost');
  });

  it('grades a strike over the deepest part of the drop as perfect', () => {
    const d = newDuel({ rand: seq([0.5]) });
    noWhips(d);
    until(d, (DUEL.sweet[0] + DUEL.sweet[1]) / 2);
    const r = strike(d);
    expect(r.grade).toBe('perfect');
    expect(d.phase).toBe('won');
    expect(d.score).toBeGreaterThan(0);
  });

  it('grades a later strike lower', () => {
    const a = newDuel({ rand: seq([0.5]) });
    noWhips(a);
    until(a, (DUEL.sweet[0] + DUEL.sweet[1]) / 2);
    strike(a);
    const b = newDuel({ rand: seq([0.5]) });
    noWhips(b);
    until(b, DUEL.end - 20);
    expect(strike(b).grade).toBe('close');
    expect(b.score).toBeLessThan(a.score);
  });

  it('costs will to strike too soon, and the Balrog keeps coming', () => {
    const d = newDuel({ rand: seq([0.5]) });
    noWhips(d);
    run(d, DUEL.drums + 0.2);
    const r = strike(d);
    expect(r.grade).toBe('soon');
    expect(d.will).toBe(DUEL.will - 1);
    expect(d.phase).toBe('coming');
  });

  it('cracks its whip, and an unblocked lash costs will', () => {
    const d = newDuel({ rand: seq([0.5]) });
    run(d, DUEL.drums + 0.05);
    d.nextLash = 0;
    const ev = run(d, DUEL.windup + DUEL.blockAfter + 0.1);
    expect(ev.some((e) => e.type === 'windup')).toBe(true);
    expect(ev.some((e) => e.type === 'lashed')).toBe(true);
    expect(d.will).toBe(DUEL.will - 1);
  });

  it('lets the staff block a lash at the right moment', () => {
    const d = newDuel({ rand: seq([0.5]) });
    run(d, DUEL.drums + 0.05);
    d.nextLash = 0;
    run(d, DUEL.windup + 0.05);
    expect(block(d).ok).toBe(true);
    run(d, DUEL.blockAfter + 0.1);
    expect(d.will).toBe(DUEL.will);
    expect(d.blocks).toBe(1);
  });

  it('punishes a block thrown at nothing: the staff is down for a moment', () => {
    const d = newDuel({ rand: seq([0.5]) });
    run(d, DUEL.drums + 0.05);
    expect(block(d).ok).toBe(false);
    d.nextLash = 0;
    run(d, DUEL.windup + 0.05);
    expect(block(d).ok).toBe(false); // still recovering
  });

  it('beats Gandalf back when his will is gone', () => {
    const d = newDuel({ rand: seq([0.5]) });
    noWhips(d);
    run(d, DUEL.drums + 0.2);
    for (let i = 0; i < DUEL.will; i++) strike(d);
    expect(d.phase).toBe('lost');
  });

  it('comes faster each round, and Gandalf the White has more will', () => {
    expect(crossingFor(3)).toBeLessThan(crossingFor(0));
    expect(crossingFor(40)).toBeGreaterThanOrEqual(DUEL.fastest);
    expect(newDuel({ white: true }).will).toBe(DUEL.will + 1);
  });
});

describe('Gorgoroth', () => {
  const quiet = (s) => {
    s.patrols = [];
    s.patrolAt = 1e9;
  };

  it('walks while held and stands still otherwise', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.phase = 0; // the beam far away
    s.beamAt = () => 1000;
    stepWalk(s, 1, true);
    const x = s.x;
    expect(x).toBeGreaterThan(WALK.x0);
    stepWalk(s, 1, false);
    expect(s.x).toBe(x);
  });

  it('is seen when walking in the Eye’s light', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.beamAt = () => s.x;
    const ev = [];
    for (let i = 0; i < 30; i++) ev.push(...stepWalk(s, 1 / 60, true));
    expect(s.state).toBe('seen');
    expect(ev.some((e) => e.type === 'seen')).toBe(true);
  });

  it('hides from the light while standing still', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.beamAt = () => s.x;
    for (let i = 0; i < 120; i++) stepWalk(s, 1 / 60, false);
    expect(s.state).toBe('walking');
  });

  it('puts the Ring on if Frodo walks too long without a rest', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.beamAt = () => 1000;
    for (let i = 0; i < 60 * 30 && s.state === 'walking' && s.x < WALK.x1 * 0.7; i++) stepWalk(s, 1 / 60, true);
    expect(s.state).toBe('ring');
  });

  it('lets the burden ease while they rest', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.burden = 0.6;
    s.beamAt = () => 1000;
    stepWalk(s, 2, false);
    expect(s.burden).toBeLessThan(0.6);
  });

  it('is caught by an orc patrol it walks into', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.beamAt = () => 1000;
    s.patrols.push({ x: s.x + 30 });
    for (let i = 0; i < 120 && s.state === 'walking'; i++) stepWalk(s, 1 / 60, true);
    expect(s.state).toBe('caught');
  });

  it('lets a patrol march past hobbits hiding under their cloaks', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.beamAt = () => 1000;
    s.patrols.push({ x: s.x + 30 });
    for (let i = 0; i < 240; i++) stepWalk(s, 1 / 60, false);
    expect(s.state).toBe('walking');
    expect(s.passed).toBe(1);
  });

  it('has Sam carry Frodo for the last stretch, the burden held', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.beamAt = () => 1000;
    s.x = WALK.x0 + (WALK.x1 - WALK.x0) * WALK.carryAt + 1;
    s.burden = 0.5;
    const ev = stepWalk(s, 0.5, true);
    expect(ev.some((e) => e.type === 'carry')).toBe(true);
    expect(s.carried).toBe(true);
    const b = s.burden;
    stepWalk(s, 1, true);
    expect(s.burden).toBeLessThanOrEqual(b);
  });

  it('arrives at Mount Doom', () => {
    const s = newWalk({ rand: seq([0.5]) });
    quiet(s);
    s.beamAt = () => 1000;
    s.x = WALK.x1 - 2;
    stepWalk(s, 1, true);
    expect(s.state).toBe('there');
  });
});

describe('Gorgoroth can be crossed', () => {
  it('by a walker who rests when the light, a patrol or the Ring comes close', () => {
    let made = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let a = seed;
      const rand = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
      const s = newWalk({ rand });
      for (let i = 0; i < 60 * 120 && s.state === 'walking'; i++) {
        const light = Math.abs(265 + Math.sin(s.phase) * 215 - s.x) < 70;
        const orcs = s.patrols.some((p) => !p.past && p.x - s.x < 60);
        const walk = !light && !orcs && (s.burden < 0.85 || s.carried);
        stepWalk(s, 1 / 60, walk);
      }
      if (s.state === 'there') made += 1;
    }
    expect(made).toBeGreaterThanOrEqual(18);
  });
});
