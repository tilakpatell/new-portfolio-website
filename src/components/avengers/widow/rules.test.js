import { describe, expect, it } from 'vitest';
import { BITE, LEVELS, act, biteTargets, camAngle, laserOn, newLevel, parseLevel, solveLevel, spotted, visibleTiles, VISION, angleOf } from './rules';

const move = (dir) => ({ type: 'move', dir });
const WAIT = { type: 'wait' };
const play = (s, actions) => actions.flatMap((a) => act(s, a));
// a level from a map, for testing one thing at a time
let custom = 100;
const level = (def) => {
  const i = custom++;
  LEVELS[i] = { name: 't', tip: '', ...def };
  return newLevel(i);
};

describe('Infiltration: a level', () => {
  it('starts with Natasha on the start, the file in place and the guards on their posts', () => {
    const s = newLevel(0);
    const def = parseLevel(0);
    expect([s.px, s.py]).toEqual(def.start);
    expect(s.phase).toBe('play');
    expect(s.file).toBe(false);
    expect(s.guards).toHaveLength(def.guards.length);
    expect(newLevel(4).charges).toBe(1);
  });

  it('catches her when she ends her turn where a guard can see, and starts again fresh', () => {
    // a guard at the end of a corridor looking down it
    const s = level({ map: ['########', '#S....G#', '#F####E#', '########'], guards: [{ dir: 'W', route: 'w' }] });
    expect(spotted(s)).toBeNull(); // five tiles away: out of his torch's reach
    const ev = act(s, move('E'));
    expect(s.phase).toBe('caught');
    expect(ev.at(-1)).toMatchObject({ type: 'caught', by: 'guard', id: 0, when: 'move' });
    expect(act(s, WAIT)).toEqual([]); // nothing happens after
    const again = newLevel(s.index);
    expect([again.px, again.py, again.t, again.turns, again.phase]).toEqual([1, 1, 0, 0, 'play']);
  });

  it('lets walls block sight, and never sees beside or behind a guard', () => {
    const s = level({ map: ['#########', '#...#...#', '#S..G..F#', '#...#..E#', '#########'], guards: [{ dir: 'E', route: 'e' }] });
    const seen = visibleTiles(s.def, 4, 2, angleOf('E'), VISION);
    expect(seen.has('5,2')).toBe(true);
    expect(seen.has('7,2')).toBe(true);
    expect(seen.has('3,2')).toBe(false); // behind
    expect(seen.has('4,1')).toBe(false); // beside
  });

  it('takes a guard down from behind or the side, but not from the front', () => {
    const s = level({ map: ['#######', '#S.G.F#', '#....E#', '#######'], guards: [{ dir: 'E', route: 'e' }] });
    play(s, [move('E')]);
    const ev = act(s, move('E'));
    expect(ev[0]).toMatchObject({ type: 'takedown', id: 0 });
    expect(s.guards[0].down).toBe(true);
    expect([s.px, s.py]).toEqual([2, 1]); // she stays put; he drops
    // facing her: a bump, and no turn taken
    const f = level({ map: ['#######', '#S.G.F#', '#....E#', '#######'], guards: [{ dir: 'W', route: 'w' }] });
    f.px = 2;
    expect(act(f, move('E'))[0]).toMatchObject({ type: 'bump', why: 'face' });
    expect(f.turns).toBe(0);
  });

  it('spends a Bite charge to stun a guard two tiles away in a line, for three of her turns', () => {
    const s = level({ map: ['########', '#S..G.F#', '#.....E#', '########'], charges: 1, guards: [{ dir: 'E', route: 'e' }] });
    s.px = 2;
    expect(biteTargets(s).map((b) => b.dir)).toEqual(['E']);
    const ev = act(s, { type: 'bite', dir: 'E' });
    expect(ev[0]).toMatchObject({ type: 'bite', id: 0 });
    expect(s.charges).toBe(0);
    expect(s.guards[0].stun).toBe(BITE.stun - 1);
    // out for three turns, awake again after
    play(s, [WAIT, WAIT]);
    expect(s.guards[0].stun).toBe(1);
    const wake = act(s, WAIT);
    expect(wake.some((e) => e.type === 'wake')).toBe(true);
    // no charges left: a bump
    expect(act(s, { type: 'bite', dir: 'E' })[0]).toMatchObject({ type: 'bump', why: 'charges' });
  });

  it('switches lasers on their cycle, and catches her on a live one', () => {
    const s = level({ map: ['#######', '#S.F.E#', '#######'], lasers: [{ a: [2, 1], b: [2, 1], cycle: 'XX..' }] });
    expect([0, 1, 2, 3, 4].map((t) => laserOn(s.def, 0, t))).toEqual([true, true, false, false, true]);
    act(s, move('E'));
    expect(s.caught).toMatchObject({ by: 'laser', when: 'move' });
    // timed: wait for it to go off, then cross
    const t = level({ map: ['#######', '#S.F.E#', '#######'], lasers: [{ a: [2, 1], b: [2, 1], cycle: 'XX..' }] });
    play(t, [WAIT, WAIT, move('E'), move('E'), move('E'), move('E')]);
    expect(t.phase).toBe('won');
  });

  it('sweeps cameras a step a turn until the terminal switches them off', () => {
    const s = level({ map: ['########', '#K.....#', '#......#', '#T.S.FE#', '########'], cameras: [{ wall: 'N', sweep: [0, 10, 20] }] });
    expect(camAngle(s.def, s, 0)).toBe(0);
    act(s, WAIT);
    expect(camAngle(s.def, s, 0)).toBe(10);
    play(s, [move('W')]);
    const ev = act(s, move('W'));
    expect(ev[0]).toMatchObject({ type: 'hack', cams: [0] });
    expect(s.cams[0].off).toBe(true);
    const i = s.cams[0].i;
    act(s, WAIT);
    expect(s.cams[0].i).toBe(i); // a dead camera doesn't sweep
  });

  it('needs the file before the exit opens', () => {
    const s = level({ map: ['######', '#S.EF#', '######'] });
    const ev = play(s, [move('E'), move('E')]);
    expect(ev.some((e) => e.type === 'locked')).toBe(true);
    expect(s.phase).toBe('play');
    play(s, [move('E'), move('W')]);
    expect(s.phase).toBe('won');
  });

  it('never wins by waiting', () => {
    for (let i = 0; i < LEVELS.length && i < 8; i++) {
      const s = newLevel(i);
      for (let k = 0; k < 120 && s.phase === 'play'; k++) act(s, WAIT);
      expect(s.phase).not.toBe('won');
    }
  });
});

describe('Infiltration: the eight levels', () => {
  it('has eight', () => {
    expect(LEVELS.slice(0, 8).every((l) => l.name && l.map && l.tip)).toBe(true);
    expect(LEVELS.filter((l, i) => i < 8)).toHaveLength(8);
  });

  it('every level can be won (breadth-first over every state)', () => {
    for (let i = 0; i < 8; i++) {
      const stats = {};
      const sol = solveLevel(i, { stats });
      expect(stats.capped ?? false, `level ${i + 1} search capped`).toBe(false);
      expect(sol, `level ${i + 1}`).not.toBeNull();
      // and the solution replays to a win, the same way every time
      for (let n = 0; n < 2; n++) {
        const s = newLevel(i);
        play(s, sol.actions);
        expect(s.phase).toBe('won');
      }
    }
  });

  it('teaches what it says: the takedown, the Bite and the pair need them', () => {
    expect(solveLevel(2, { allow: { takedown: false } })).toBeNull();
    expect(solveLevel(4, { allow: { bite: false } })).toBeNull();
    expect(solveLevel(6, { allow: { bite: false } })).toBeNull();
  });

  it('gives Natasha’s half of the Soul Stone for clearing the last level, and only that one', () => {
    const last = solveLevel(7);
    const s = newLevel(7);
    const ev = play(s, last.actions);
    expect(ev.find((e) => e.type === 'won')).toMatchObject({ index: 7 });
    expect(ev.find((e) => e.type === 'reward')).toMatchObject({ stone: 'soul-natasha' });
    const first = newLevel(0);
    expect(play(first, solveLevel(0).actions).some((e) => e.type === 'reward')).toBe(false);
  });

  it('starts a level fresh after a win', () => {
    const s = newLevel(4);
    play(s, solveLevel(4).actions);
    expect(s.phase).toBe('won');
    const again = newLevel(4);
    expect(again).toMatchObject({ phase: 'play', t: 0, turns: 0, file: false, charges: 1, takedowns: 0, bites: 0 });
    expect(again.guards.every((g) => !g.down && g.stun === 0 && g.step === 0)).toBe(true);
  });
});
