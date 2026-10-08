import { describe, expect, it } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { FAILED, RUNNING } from '../../../../lib/ai/tree';
import { ROLES, resetRoutine, routineFor, runRoutine } from './routines';

// A stand-in for the body a routine drives: `go` takes `legs` ticks to get
// anywhere, and everything asked of it is written down in order.
function fakeBody({ legs = 2, near = () => false, rand = seeded(7) } = {}) {
  const log = [];
  let walking = null;
  const bb = {
    clock: 0,
    rand,
    timers: {},
    pose: (anim) => {
      bb.anim = anim;
    },
    face: (target) => log.push(['face', target]),
    say: (key, text) => log.push(['say', key, text]),
    near: (who, m) => near(who, m),
    go: (where, opts) => {
      const key = JSON.stringify(where);
      if (walking?.key !== key) {
        walking = { key, left: legs };
        log.push(['go', where, opts ?? null]);
      }
      bb.anim = 'walk';
      if (--walking.left > 0) return 'running';
      walking = null;
      return 'done';
    },
  };
  return { bb, log };
}

// Ticks a routine for `seconds` at `dt`, keeping the blackboard’s clock;
// stops at a failure, as the brain does, since the next tick starts over.
function run(node, bb, seconds, dt = 0.1) {
  let status = null;
  for (let t = 0; t < seconds && status !== FAILED; t += dt) {
    bb.clock += dt;
    status = runRoutine(node, bb, dt);
  }
  return status;
}

const goes = (log) => log.filter(([what]) => what === 'go').map(([, where]) => where);

describe('routines', () => {
  it('knows every role the brief names', () => {
    expect(ROLES).toEqual(expect.arrayContaining(['patrol', 'post', 'work', 'chat', 'march', 'droid', 'scripted']));
  });

  it('refuses a role it doesn’t know, so a typo in a story fails its test', () => {
    expect(() => routineFor({ type: 'dance' })).toThrow(/dance/);
  });

  it('walks a patrol’s round in order and round again, pausing at each spot', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'patrol', spots: ['a', 'b', 'c'] });
    run(node, bb, 40);
    expect(goes(log).slice(0, 7)).toEqual(['a', 'b', 'c', 'a', 'b', 'c', 'a']);
    // between arriving and leaving it stood: the pose was idle at some point
    expect(log.some(([what, target]) => what === 'face' && target === 'b')).toBe(true);
  });

  it('stands a pause of at least two seconds at each patrol spot', () => {
    const { bb, log } = fakeBody({ legs: 1 });
    const node = routineFor({ type: 'patrol', spots: ['a', 'b'] });
    const times = [];
    let seen = 0;
    for (let t = 0; t < 30; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      const n = goes(log).length;
      if (n > seen) times.push(bb.clock);
      seen = n;
    }
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(2);
  });

  it('goes to its post once, then stands to attention there, glancing about', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'post', spot: 'door' });
    run(node, bb, 30);
    expect(goes(log)).toEqual(['door']);
    expect(bb.anim).toBe('attention');
    const faces = log.filter(([what]) => what === 'face').map(([, target]) => target);
    expect(faces[0]).toBe('door');
    expect(faces.some((f) => typeof f === 'object' && f.spot === 'door' && f.turn !== 0)).toBe(true);
  });

  it('works at its console, with a breather now and then', () => {
    const { bb } = fakeBody();
    const node = routineFor({ type: 'work', spot: 'console' });
    const poses = new Set();
    for (let t = 0; t < 40; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      poses.add(bb.anim);
    }
    expect(poses).toContain('work');
    expect(poses).toContain('idle');
  });

  it('walks over to whoever it chats with, then faces them and talks', () => {
    let close = false;
    const { bb, log } = fakeBody({ near: () => close });
    const node = routineFor({ type: 'chat', with: 'officer-2' });
    run(node, bb, 0.5);
    expect(goes(log)[0]).toEqual({ who: 'officer-2' });
    close = true;
    const poses = new Set();
    for (let t = 0; t < 10; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      poses.add(bb.anim);
    }
    expect(poses).toContain('talk');
    expect(log.some(([what, target]) => what === 'face' && target?.who === 'officer-2')).toBe(true);
  });

  it('marches its spots without a pause', () => {
    const { bb, log } = fakeBody({ legs: 3 });
    const node = routineFor({ type: 'march', spots: ['a', 'b'] });
    const poses = new Set();
    for (let t = 0; t < 2.4; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      poses.add(bb.anim);
    }
    expect(goes(log).slice(0, 6)).toEqual(['a', 'b', 'a', 'b', 'a', 'b']);
    expect([...poses]).toEqual(['walk']);
  });

  it('sends a droid off to wander, room to room, with short stops', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'droid' });
    run(node, bb, 20);
    const ways = goes(log);
    expect(ways.length).toBeGreaterThan(3);
    expect(ways.every((w) => w.wander === true)).toBe(true);
  });

  it('keeps up with whoever it follows and waits when close', () => {
    let close = false;
    const { bb, log } = fakeBody({ near: () => close });
    const node = routineFor({ type: 'follow', who: 'you' });
    run(node, bb, 0.3);
    expect(goes(log)[0]).toEqual({ who: 'you' });
    close = true;
    const before = goes(log).length;
    run(node, bb, 3);
    expect(goes(log).length).toBe(before);
    expect(bb.anim).toBe('idle');
  });

  it('plays a script once, step by step, and then stands as it was left', () => {
    const { bb, log } = fakeBody({ legs: 2 });
    const node = routineFor({ type: 'scripted' }, [
      { to: 'dais' },
      { face: 'window' },
      { say: 'Everything is proceeding as I have foreseen.', key: 'foreseen' },
      { anim: 'kneel', s: 1 },
      { wait: 1 },
      { anim: 'attention' },
    ]);
    const status = run(node, bb, 6);
    expect(status).toBe(RUNNING);
    expect(log.map(([what]) => what)).toEqual(['go', 'face', 'say']);
    expect(log[2]).toEqual(['say', 'foreseen', 'Everything is proceeding as I have foreseen.']);
    expect(bb.anim).toBe('attention');
  });

  it('holds a kneel for as long as the script says before going on', () => {
    const { bb } = fakeBody();
    const node = routineFor({ type: 'scripted' }, [{ anim: 'kneel', s: 2 }, { anim: 'idle' }]);
    run(node, bb, 1);
    expect(bb.anim).toBe('kneel');
    run(node, bb, 1.5);
    expect(bb.anim).toBe('idle');
  });

  it('stands still when it has no script at all', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'scripted' });
    run(node, bb, 3);
    expect(log).toEqual([]);
    expect(bb.anim).toBe('idle');
  });

  it('fails when the way to a spot is gone, and starts its round afresh once reset', () => {
    const { bb, log } = fakeBody({ legs: 1 });
    const go = bb.go;
    // the way to b is cut once the patrol has stood its time at a
    bb.go = (where, opts) => (where === 'b' ? 'failed' : go(where, opts));
    const node = routineFor({ type: 'patrol', spots: ['a', 'b'] });
    expect(run(node, bb, 8)).toBe(FAILED);
    bb.go = go;
    resetRoutine(node, bb);
    run(node, bb, 0.2);
    expect(goes(log)).toEqual(['a', 'a']);
  });
});
