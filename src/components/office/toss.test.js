import { describe, expect, it } from 'vitest';
import { TOSS, launch, layout, multiplier, newRound, predict, rng, solve, step, tryThrow, velocityFor } from './toss';

// Plays one throw to the end; returns every event it made.
const play = (s, aim) => {
  launch(s, aim);
  const ev = [];
  for (let i = 0; i < 4000 && s.phase === 'flying'; i++) ev.push(...step(s, 1 / 60));
  return ev;
};

describe('a round of paper toss', () => {
  it('starts aiming at a close bin with no wind', () => {
    const s = newRound({ seed: 3 });
    expect(s.phase).toBe('aim');
    expect(s.bin.z).toBeGreaterThan(2.3);
    expect(s.bin.z).toBeLessThan(3.5);
    expect(s.wind).toEqual({ x: 0, z: 0 });
    expect(s.desk).toBeNull();
  });

  it('is ten balls, then over', () => {
    const s = newRound({ seed: 5 });
    for (let i = 0; i < TOSS.balls; i++) {
      expect(s.phase).toBe('aim');
      play(s, { yaw: 0, power: 0 });
    }
    expect(s.phase).toBe('over');
    expect(launch(s, { yaw: 0, power: 0.5 })).toBe(false);
  });

  it('a throw with no power falls short and scores nothing', () => {
    const s = newRound({ seed: 2 });
    const ev = play(s, { yaw: 0, power: 0 });
    expect(ev.some((e) => e.type === 'miss')).toBe(true);
    expect(s.last.short).toBe(true);
    expect(s.score).toBe(0);
  });

  it('a good throw goes in, and the bin moves', () => {
    const s = newRound({ seed: 11 });
    const aim = solve(s);
    expect(aim).not.toBeNull();
    const before = { ...s.bin };
    const ev = play(s, aim);
    expect(ev.find((e) => e.type === 'in')).toBeTruthy();
    expect(s.made).toBe(1);
    expect(s.score).toBeGreaterThan(0);
    expect(s.bin).not.toEqual(before);
  });

  it('leaves the bin where it is after a miss', () => {
    const s = newRound({ seed: 4 });
    const before = { ...s.bin };
    play(s, { yaw: TOSS.maxYaw, power: 1 });
    expect(s.made).toBe(0);
    expect(s.bin).toEqual(before);
  });

  it('plays the same way from the same seed', () => {
    const a = newRound({ seed: 99 });
    const b = newRound({ seed: 99 });
    for (const aim of [{ yaw: 0.05, power: 0.3 }, { yaw: -0.1, power: 0.5 }, { yaw: 0, power: 0.42 }]) {
      play(a, aim);
      play(b, aim);
    }
    expect(a.score).toBe(b.score);
    expect(a.bin).toEqual(b.bin);
    expect(a.ball).toEqual(b.ball);
  });
});

describe('the throw', () => {
  it('goes faster with more power and turns with the aim', () => {
    const lo = velocityFor(0, 0);
    const hi = velocityFor(0, 1);
    expect(Math.hypot(hi.x, hi.y, hi.z)).toBeGreaterThan(Math.hypot(lo.x, lo.y, lo.z));
    expect(velocityFor(0.2, 0.5).x).toBeGreaterThan(0);
    expect(velocityFor(-0.2, 0.5).x).toBeLessThan(0);
    // aim is limited either side
    expect(velocityFor(5, 0.5).x).toBeCloseTo(velocityFor(TOSS.maxYaw, 0.5).x, 9);
  });

  it('is pushed by the fan’s wind', () => {
    const calm = newRound({ seed: 1 });
    const windy = newRound({ seed: 1 });
    windy.wind = { x: 2, z: 0 };
    const a = predict(calm, { yaw: 0, power: 0.5 });
    const b = predict(windy, { yaw: 0, power: 0.5 });
    expect(b[b.length - 1].x).toBeGreaterThan(a[a.length - 1].x + 0.2);
  });

  it('never goes through the floor or out of the room', () => {
    const s = newRound({ seed: 8 });
    launch(s, { yaw: 0.4, power: 1 });
    for (let i = 0; i < 3000 && s.phase === 'flying'; i++) {
      step(s, 1 / 120);
      expect(s.ball.y).toBeGreaterThanOrEqual(TOSS.r - 1e-9);
      expect(Math.abs(s.ball.x)).toBeLessThanOrEqual(TOSS.room.x);
      expect(s.ball.z).toBeLessThanOrEqual(TOSS.room.z);
    }
    expect(s.phase).not.toBe('flying');
  });

  it('bounces off a desk in the way', () => {
    const s = newRound({ seed: 6 });
    s.bin = { x: 0, z: 6 };
    s.desk = { x0: -0.75, x1: 0.75, z0: 1.2, z1: 1.9, top: 0.76 };
    const ev = play(s, { yaw: 0, power: 0 });
    expect(ev.some((e) => e.type === 'desk')).toBe(true);
    expect(s.made).toBe(0);
  });
});

describe('scoring', () => {
  it('pays streaks, up to three times', () => {
    expect(multiplier(1)).toBe(1);
    expect(multiplier(2)).toBe(1.5);
    expect(multiplier(5)).toBe(3);
    expect(multiplier(20)).toBe(3);
  });

  it('pays a swish more than the same basket off the rim', () => {
    // find a clean throw and a rim-in throw at the same bin
    const s = newRound({ seed: 21 });
    let swish = null;
    let rimIn = null;
    for (let i = 0; i <= 60 && !(swish && rimIn); i++)
      for (let j = 0; j <= 60 && !(swish && rimIn); j++) {
        const aim = { yaw: -0.15 + (0.3 * i) / 60, power: j / 60 };
        const c = newRound({ seed: 21 });
        const ev = play(c, aim);
        const hit = ev.find((e) => e.type === 'in');
        if (hit?.swish && !swish) swish = hit;
        if (hit && hit.rim && !rimIn) rimIn = hit;
      }
    expect(swish).toBeTruthy();
    expect(rimIn).toBeTruthy();
    expect(swish.points).toBeGreaterThan(rimIn.points);
    expect(s.score).toBe(0);
  });

  it('turns the fan on after two baskets', () => {
    const s = newRound({ seed: 12 });
    const fans = [];
    for (let k = 0; k < 3; k++) {
      const aim = solve(s);
      fans.push(...play(s, aim).filter((e) => e.type === 'fan'));
    }
    expect(s.made).toBe(3);
    expect(fans.length).toBe(1);
    expect(Math.hypot(s.wind.x, s.wind.z)).toBeGreaterThan(0.4);
  });
});

describe('fairness', () => {
  it('every bin it sets can be made, wind and desks included', { timeout: 30000 }, () => {
    let desks = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const rand = rng(seed);
      for (let made = 0; made <= 9; made += 2) {
        const s = { ...newRound({ seed }), ...layout(rand, made), made };
        if (s.desk) desks++;
        const aim = solve(s);
        expect(aim, `seed ${seed}, after ${made}`).not.toBeNull();
        expect(tryThrow(s, aim)).toBe(true);
      }
    }
    expect(desks).toBeGreaterThan(0);
  });

  it('a careful player makes most of a round', { timeout: 30000 }, () => {
    const s = newRound({ seed: 31 });
    while (s.phase === 'aim') {
      const aim = solve(s) || { yaw: 0, power: 0.5 };
      play(s, aim);
    }
    expect(s.made).toBeGreaterThanOrEqual(8);
  });
});
