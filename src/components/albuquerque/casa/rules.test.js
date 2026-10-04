import { describe, expect, it } from 'vitest';
import { GUS_SECONDS, BOOM_SECONDS, ROWS, WORDS, newGame, ring, score, speed, stepGame } from './rules';

// a game with these words, at the start
const game = (words = ['TIO', 'GUS', 'DING']) => ({ ...newGame(() => 0), words });
// the finger moved on n times
const steps = (s, n) => {
  for (let i = 0; i < n; i++) s = stepGame(s, speed(s.w));
  return s;
};
// ring for this letter: wait for its row, ring, wait for it, ring
const spell = (s, letter) => {
  const r = ROWS.findIndex((x) => x.includes(letter));
  s = steps(s, (r - s.row + ROWS.length) % ROWS.length);
  ({ state: s } = ring(s));
  s = steps(s, ROWS[r].indexOf(letter));
  return ring(s);
};
const spellAll = (s) => {
  let event;
  for (const word of s.words) for (const letter of word) ({ state: s, event } = spell(s, letter));
  return { state: s, event };
};

describe('Face Off: the rules', () => {
  it('starts on the rows, with three of the words', () => {
    const s = newGame(Math.random);
    expect(s.phase).toBe('rows');
    expect(s.words).toHaveLength(3);
    for (const w of s.words) expect(WORDS).toContain(w);
    expect(new Set(s.words).size).toBe(3);
  });

  it('picks the lit row on a ring', () => {
    const s = steps(game(), 2);
    expect(s.row).toBe(2);
    const { state, event } = ring(s);
    expect(event).toBe('row');
    expect(state.phase).toBe('letters');
    expect(state.row).toBe(2);
    expect(state.col).toBe(0);
  });

  it('fills the word with the right letter', () => {
    const { state, event } = spell(game(), 'T');
    expect(event).toBe('letter');
    expect(state.typed).toBe('T');
    expect(state.phase).toBe('rows');
  });

  it('counts a wrong letter as a miss and goes back to the rows', () => {
    let s = steps(game(), 3); // STUVWX
    ({ state: s } = ring(s));
    const { state, event } = ring(s); // S, but the word wants T
    expect(event).toBe('miss');
    expect(state.misses).toBe(1);
    expect(state.typed).toBe('');
    expect(state.phase).toBe('rows');
    expect(state.row).toBe(0);
  });

  it('goes back to the rows after two silent passes along a row', () => {
    let s = steps(game(), 4); // YZ
    ({ state: s } = ring(s));
    s = steps(s, 3);
    expect(s.phase).toBe('letters');
    s = steps(s, 1);
    expect(s.phase).toBe('rows');
    expect(s.row).toBe(0);
  });

  it('moves the finger faster for each word', () => {
    expect(speed(1)).toBeLessThan(speed(0));
    expect(speed(2)).toBeLessThan(speed(1));
    expect(speed(9)).toBeGreaterThanOrEqual(0.38);
    let s = game();
    for (const letter of 'TIO') ({ state: s } = spell(s, letter));
    expect(s.w).toBe(1);
    expect(s.typed).toBe('');
  });

  it('sends Gus in once the last word is spelled, and a ring then is ignored', () => {
    const { state, event } = spellAll(game());
    expect(event).toBe('gus');
    expect(state.phase).toBe('gus');
    expect(ring(state).event).toBe('ignored');
    const later = stepGame(state, GUS_SECONDS + 0.01);
    expect(later.phase).toBe('bell');
  });

  it('booms on the third ring of the bell, then clears', () => {
    let s = stepGame(spellAll(game()).state, GUS_SECONDS + 0.01);
    const events = [];
    for (let i = 0; i < 3; i++) {
      const r = ring(s);
      s = r.state;
      events.push(r.event);
    }
    expect(events).toEqual(['bell', 'bell', 'boom']);
    expect(s.phase).toBe('boom');
    expect(stepGame(s, BOOM_SECONDS + 0.01).phase).toBe('after');
  });

  it('gives exactly one boom for ten rings in one frame', () => {
    let s = stepGame(spellAll(game()).state, GUS_SECONDS + 0.01);
    const events = [];
    for (let i = 0; i < 10; i++) {
      const r = ring(s);
      s = r.state;
      events.push(r.event);
    }
    expect(events.filter((e) => e === 'boom')).toHaveLength(1);
    expect(events.slice(3).every((e) => e === 'ignored')).toBe(true);
  });

  it('scores the seconds taken and five more a miss', () => {
    expect(score({ seconds: 20, misses: 2 })).toBe(30);
    expect(score({ seconds: 19.6, misses: 0 })).toBe(20);
  });

  it('stops the clock when the last word is spelled', () => {
    const { state } = spellAll(game());
    const at = state.seconds;
    expect(at).toBeGreaterThan(0);
    expect(stepGame(state, 1).seconds).toBe(at);
  });
});
