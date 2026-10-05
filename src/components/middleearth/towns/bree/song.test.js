import { describe, expect, it } from 'vitest';
import { LENGTH, NOTES, QUAVER, SONG, VERSE, newSong, press, score, stepSong } from './song';

// play the song through: `when(n)` is when you hit note n (or null to let
// it go by), every frame at 60 a second
function play(when) {
  const song = newSong();
  const hits = NOTES.map((n, i) => ({ at: when(n, i), lane: n.lane })).filter((h) => h.at != null).sort((a, b) => a.at - b.at);
  const types = [];
  let k = 0;
  for (let t = 0; t <= LENGTH + 0.1 && song.state === 'on'; t += 1 / 60) {
    while (k < hits.length && hits[k].at <= t) press(song, hits[k++].lane, t);
    types.push(...stepSong(song, t).map((e) => e.type));
  }
  return { song, types };
}

describe('a song on the table', () => {
  it('has a verse of five lines, sixteen quavers each, with something to hit in every line', () => {
    expect(VERSE).toHaveLength(5);
    for (const v of VERSE) {
      expect(v.chart).toHaveLength(16);
      expect(v.tune).toHaveLength(16);
      expect(v.chart).toMatch(/^[sc.]+$/);
    }
    for (let line = 0; line < VERSE.length; line++) expect(NOTES.some((n) => n.line === line)).toBe(true);
    // in time order, after the count-in, and before the end
    expect(NOTES[0].t).toBeCloseTo(SONG.count * QUAVER);
    for (let i = 1; i < NOTES.length; i++) expect(NOTES[i].t).toBeGreaterThanOrEqual(NOTES[i - 1].t);
    expect(NOTES[NOTES.length - 1].t).toBeLessThan(LENGTH);
  });

  it('brings the house down when every beat is on time', () => {
    const { song, types } = play((n) => n.t);
    expect(song.state).toBe('won');
    expect(score(song)).toBe(1);
    expect(types.filter((x) => x === 'line')).toHaveLength(VERSE.length);
    expect(types).not.toContain('miss');
  });

  it('counts near enough as half, and a little late is still near enough', () => {
    const song = newSong();
    const n = NOTES[0];
    expect(press(song, n.lane, n.t + SONG.good * 0.5).how).toBe('good');
    const m = NOTES[1];
    expect(press(song, m.lane, m.t + (SONG.good + SONG.ok) / 2).how).toBe('ok');
    expect(press(song, 0, 0.1).how).toBe('stray');
  });

  it('only takes a note in its own lane', () => {
    const song = newSong();
    const n = NOTES[0];
    expect(press(song, 1 - n.lane, n.t).how).toBe('stray');
    expect(song.hit[0]).toBe(null);
  });

  it('goes flat if too many are missed, but you keep your feet', () => {
    // let every third one go by, and hit the rest spot on
    const { song, types } = play((n, i) => (i % 3 === 0 ? null : n.t));
    expect(song.state).toBe('flat');
    expect(types[types.length - 1]).toBe('flat');
  });

  it('puts you off the table if you lose the room', () => {
    const { song, types } = play(() => null);
    expect(song.state).toBe('fell');
    expect(types[types.length - 1]).toBe('fell');
    expect(song.t).toBeLessThan(LENGTH);
  });

  it('lets a hobbit off a few, and still wins', () => {
    const { song } = play((n, i) => (i % 9 === 4 ? null : n.t + (i % 2 ? 0.05 : -0.05)));
    expect(song.state).toBe('won');
  });
});
