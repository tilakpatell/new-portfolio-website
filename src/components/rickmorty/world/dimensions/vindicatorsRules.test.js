import { describe, expect, it } from 'vitest';
import { ROOMS, newTrial, pick, retry } from './vindicatorsRules';

const right = (room) => room.choices.find((c) => c.right).id;
const wrong = (room) => room.choices.find((c) => !c.right).id;

describe('Rick’s rooms', () => {
  it('are three, in order, each with one right choice', () => {
    expect(ROOMS.map((r) => r.id)).toEqual(['levers', 'riddle', 'button']);
    for (const r of ROOMS) {
      expect(r.prompt.length).toBeGreaterThan(10);
      expect(r.choices.filter((c) => c.right)).toHaveLength(1);
      expect(new Set(r.choices.map((c) => c.id)).size).toBe(r.choices.length);
    }
    // (the last one: the only one of them Rick likes)
    expect(right(ROOMS[2])).toBe('noobnoob');
  });

  it('start in the first room', () => {
    expect(newTrial()).toEqual({ room: 0, state: 'on', picks: [] });
  });

  it('go on to the next room on a right pick, and are won on the third', () => {
    const t = newTrial();
    expect(pick(t, right(ROOMS[0]))).toBe('next');
    expect(t.room).toBe(1);
    expect(pick(t, right(ROOMS[1]))).toBe('next');
    expect(pick(t, right(ROOMS[2]))).toBe('won');
    expect(t.state).toBe('won');
    expect(t.picks).toEqual(ROOMS.map(right));
  });

  it('are lost on a wrong pick, in any room', () => {
    for (let at = 0; at < ROOMS.length; at++) {
      const t = newTrial();
      for (let i = 0; i < at; i++) pick(t, right(ROOMS[i]));
      expect(pick(t, wrong(ROOMS[at]))).toBe('lost');
      expect(t.state).toBe('lost');
      expect(t.room).toBe(at);
    }
  });

  it('take nothing once they’re over, and nothing that isn’t a choice', () => {
    const won = newTrial();
    for (const r of ROOMS) pick(won, right(r));
    expect(pick(won, 'noobnoob')).toBe(null);
    const lost = newTrial();
    pick(lost, wrong(ROOMS[0]));
    expect(pick(lost, right(ROOMS[0]))).toBe(null);
    const t = newTrial();
    expect(pick(t, 'nope')).toBe(null);
    expect(t).toEqual(newTrial());
  });

  it('start again from the first room on a retry', () => {
    const t = newTrial();
    pick(t, right(ROOMS[0]));
    pick(t, wrong(ROOMS[1]));
    expect(retry(t)).toEqual(newTrial());
    expect(t).toEqual(newTrial());
  });
});
