import { describe, expect, it } from 'vitest';
import { chain, checkpointOf, say, spawn, startStory, storyStep } from './story';

const BEGIN = { spot: 'a', hero: 'luke', armour: false, helmet: false, companions: ['han'], flags: [], gun: 'e11', items: [] };
const story = (beats, begin = BEGIN) => ({ id: 'test', station: 'ds1', side: 'rebel', hero: 'luke', title: 'A test', steps: chain(begin, beats) });
const FINISH = { id: 'finish', type: 'timer', text: 'Wait.', time: 1, end: [{ end: true }] };

const at = (room, spot = null, withYou = undefined) => ({ type: 'at', room, spot, ...(withYou && { with: withYou }) });
const tick = (dt) => ({ type: 'tick', dt });
const killed = (tag, kind = 'stormtrooper') => ({ type: 'killed', kind, tag });
const used = (tag) => ({ type: 'used', tag });
const died = { type: 'died' };
const caught = { type: 'caught' };
// a second of the game’s 30 steps
const second = Array.from({ length: 30 }, () => tick(1 / 30));

// Starts the story and hands it each event in turn, keeping every effect
// and the steps it stood at, in order.
function play(s, events, from) {
  let { progress, effects } = startStory(s, from);
  const all = [...effects];
  const steps = [progress.step];
  for (const e of events) {
    ({ progress, effects } = storyStep(progress, s, e));
    all.push(...effects);
    if (steps.at(-1) !== progress.step) steps.push(progress.step);
  }
  return { progress, effects, all, steps };
}

describe('starting a story', () => {
  it('begins at the first step, putting the state back to its checkpoint before the step’s start', () => {
    const s = story([[{ id: 'go', type: 'reach', text: 'Go.', target: { spot: 'b' }, start: [{ flag: 'x' }, { music: 'calm' }] }], [FINISH]]);
    const { progress, effects } = startStory(s);
    expect(progress).toMatchObject({ story: 'test', step: 'go', t: 0, n: 0, done: false });
    expect(effects).toEqual([{ checkpoint: { step: 'go', spot: 'a', hero: 'luke', armour: false, helmet: false, companions: ['han'], flags: [], gun: 'e11', items: [] } }, { flag: 'x' }, { music: 'calm' }]);
  });

  it('picks up a saved step at the start of its beat, and an unknown one from the beginning', () => {
    const s = story([
      [{ id: 'one', type: 'reach', text: 'One.', target: { spot: 'b' } }],
      [
        { id: 'two', type: 'reach', text: 'Two.', target: { spot: 'c' }, start: [{ flag: 'two' }] },
        { id: 'three', type: 'reach', text: 'Three.', target: { spot: 'd' } },
      ],
      [FINISH],
    ]);
    const { progress, effects } = startStory(s, 'three');
    expect(progress.step).toBe('two');
    expect(effects).toEqual([{ checkpoint: { ...BEGIN, step: 'two', spot: 'b' } }, { flag: 'two' }]);
    expect(startStory(s, 'nowhere').progress.step).toBe('one');
  });
});

describe('each kind of step', () => {
  it('reach: done on arriving at its spot, not another; the step’s end runs before the next one’s start', () => {
    const s = story([
      [
        { id: 'go', type: 'reach', text: 'Go.', target: { spot: 'b' }, end: [{ say: { who: 'han', text: 'Here.' } }] },
        { id: 'room', type: 'reach', text: 'In.', target: { room: 'r2' }, start: [{ flag: 'in' }] },
      ],
      [FINISH],
    ]);
    const near = play(s, [at('r1', 'c'), at('r1')]);
    expect(near.progress.step).toBe('go');
    expect(near.all).not.toContainEqual({ say: { who: 'han', text: 'Here.' } });

    const there = play(s, [at('r1', 'b')]);
    expect(there.progress.step).toBe('room');
    expect(there.effects).toEqual([{ say: { who: 'han', text: 'Here.' } }, { flag: 'in' }]);
    expect(play(s, [at('r1', 'b'), at('r3'), at('r2', 'x')]).steps).toEqual(['go', 'room', 'finish']);
  });

  it('talk: done when its own talk closes, at the line it names if it names one', () => {
    const any = story([[{ id: 'call', type: 'talk', text: 'Answer.', need: { talk: 'ctl-officer' } }], [FINISH]]);
    expect(play(any, [{ type: 'talked', talk: 'technician', node: 'fault' }]).progress.step).toBe('call');
    expect(play(any, [{ type: 'talked', talk: 'ctl-officer', node: 'quiet' }]).progress.step).toBe('finish');

    const line = story([[{ id: 'call', type: 'talk', text: 'Answer.', need: { talk: 'han-intercom', node: 'boring' } }], [FINISH]]);
    expect(play(line, [{ type: 'talked', talk: 'han-intercom', node: 'blast' }]).progress.step).toBe('call');
    expect(play(line, [{ type: 'talked', talk: 'han-intercom', node: 'boring' }]).progress.step).toBe('finish');
  });

  it('choose: done on picking the choice it names in its talk', () => {
    const s = story([[{ id: 'tell', type: 'choose', text: 'Tell him.', need: { talk: 'aa23-officer', choice: 'transfer-1138' } }], [FINISH]]);
    const wrong = play(s, [
      { type: 'chose', talk: 'aa23-officer', node: 'orders', choice: 'orders' },
      { type: 'chose', talk: 'technician', node: 'transfer-1138', choice: 'transfer-1138' },
    ]);
    expect(wrong.progress.step).toBe('tell');
    expect(play(s, [{ type: 'chose', talk: 'aa23-officer', node: 'transfer-1138', choice: 'transfer-1138' }]).progress.step).toBe('finish');
  });

  it('use: done once its thing is used as often as it needs, once by default', () => {
    const once = story([[{ id: 'panel', type: 'use', text: 'Use it.', target: { tag: 'panel' } }], [FINISH]]);
    expect(play(once, [used('lever')]).progress.step).toBe('panel');
    expect(play(once, [used('panel')]).progress.step).toBe('finish');

    const mash = story([[{ id: 'struggle', type: 'use', text: 'Struggle.', target: { tag: 'dianoga' }, need: 3 }], [FINISH]]);
    const two = play(mash, [used('dianoga'), used('panel'), used('dianoga')]);
    expect(two.progress).toMatchObject({ step: 'struggle', n: 2 });
    expect(play(mash, [used('dianoga'), used('dianoga'), used('dianoga')]).progress.step).toBe('finish');
  });

  it('use with a code: done on dialling that code, not on a wrong one or on pressing use at the thing', () => {
    const s = story([[{ id: 'hatch', type: 'use', text: 'Dial.', target: { tag: 'hatch' }, need: { code: '3263827' } }], [FINISH]]);
    expect(play(s, [used('hatch'), { type: 'dialled', code: '3263828' }, { type: 'dialled', code: '326382' }]).progress.step).toBe('hatch');
    expect(play(s, [{ type: 'dialled', code: '3263827' }]).progress.step).toBe('finish');
    // doors.js takes the code dialled as a number too
    expect(play(s, [{ type: 'dialled', code: 3263827 }]).progress.step).toBe('finish');
  });

  it('fight: done once as many of its people are down as it needs, counting no one else', () => {
    const s = story([[{ id: 'fight', type: 'fight', text: 'Fight.', target: { tag: 'guard' }, need: 3 }], [FINISH]]);
    const two = play(s, [killed('guard'), killed('other'), killed('guard')]);
    expect(two.progress).toMatchObject({ step: 'fight', down: { guard: 2, other: 1 } });
    expect(play(s, [killed('guard'), killed('guard'), killed('guard')]).progress.step).toBe('finish');
  });

  it('fight: counts its people put down before it began, each one, and is over as it begins if they all are', () => {
    // spawned at the start of the beat, as the control room’s officer and aide are, and shot before the call
    const s = story([
      [
        { id: 'door', type: 'reach', text: 'To the door.', target: { spot: 'door' }, start: [...spawn('officer', 'in', 'crew'), ...spawn('officer', 'in', 'crew')] },
        { id: 'call', type: 'talk', text: 'Answer.', need: { talk: 'ctl-officer' } },
        { id: 'fight', type: 'fight', text: 'Down them.', target: { tag: 'crew' }, need: 2, end: [{ music: 'calm' }] },
      ],
      [FINISH],
    ]);
    const call = { type: 'talked', talk: 'ctl-officer', node: 'quiet' };
    const one = play(s, [killed('crew', 'officer'), at('bay', 'door'), call]);
    expect(one.progress).toMatchObject({ step: 'fight', down: { crew: 1 } });
    expect(play(s, [killed('crew', 'officer'), at('bay', 'door'), call, killed('crew', 'officer')]).progress.step).toBe('finish');

    const both = play(s, [at('bay', 'door'), killed('crew', 'officer'), killed('crew', 'officer'), call]);
    expect(both.steps).toEqual(['door', 'call', 'finish']);
    expect(both.effects).toEqual([{ music: 'calm' }]);
  });

  it('kill: counts each numbered thing once, and one put out of action before the step began', () => {
    const s = story([
      [{ id: 'fight', type: 'fight', text: 'Fight.', target: { tag: 'guard' } }],
      [{ id: 'cameras', type: 'kill', text: 'Shoot the cameras.', target: { tag: 'camera' }, need: 2 }],
      [FINISH],
    ]);
    // the same camera twice is still one camera, and a camera-man is not a camera
    const one = play(s, [killed('guard'), killed('camera-1', 'camera'), killed('camera-1', 'camera'), killed('cameraman')]);
    expect(one.progress.step).toBe('cameras');
    expect(play(s, [killed('guard'), killed('camera-1', 'camera'), killed('camera-2', 'camera')]).progress.step).toBe('finish');
    // both shot while the fight was still on: the step is over as it begins
    const early = play(s, [killed('camera-2', 'camera'), killed('camera-1', 'camera'), killed('guard')]);
    expect(early.steps).toEqual(['fight', 'finish']);
  });

  it('hide: done once its time passes, and failed if you are caught', () => {
    const s = story([[{ id: 'hide', type: 'hide', text: 'Hide.', target: { spot: 'hole' }, time: 2 }], [FINISH]]);
    expect(play(s, [...second]).progress).toMatchObject({ step: 'hide' });
    expect(play(s, [...second]).progress.t).toBeCloseTo(1, 6);
    expect(play(s, [...second, ...second]).progress.step).toBe('finish');
    const seen = play(s, [...second, caught]);
    expect(seen.progress).toMatchObject({ step: 'hide', t: 0 });
    expect(seen.effects[0]).toHaveProperty('checkpoint');
  });

  it('still: done on keeping still long enough, and failed if you are caught', () => {
    const s = story([[{ id: 'ranks', type: 'still', text: 'Stand still.', time: 10 }], [FINISH]]);
    expect(play(s, [{ type: 'still', seconds: 9.5 }]).progress.step).toBe('ranks');
    expect(play(s, [{ type: 'still', seconds: 10 }]).progress.step).toBe('finish');
    expect(play(s, [{ type: 'still', seconds: 9.5 }, caught]).effects[0]).toHaveProperty('checkpoint');
  });

  it('timer: done once its time passes, whatever happens meanwhile', () => {
    const s = story([[{ id: 'wait', type: 'timer', text: 'Wait.', time: 1.5 }], [FINISH]]);
    expect(play(s, [...second, caught, at('r1', 'b')]).progress.step).toBe('wait');
    expect(play(s, [...second, ...second.slice(0, 15)]).progress.step).toBe('finish');
  });

  it('scene: done when its own scene is over', () => {
    const s = story([[{ id: 'duel', type: 'scene', text: 'Watch.', need: { scene: 'duel' }, start: [{ scene: 'duel' }] }], [FINISH]]);
    expect(play(s, [{ type: 'sceneDone', id: 'swing' }]).progress.step).toBe('duel');
    expect(play(s, [{ type: 'sceneDone', id: 'duel' }]).progress.step).toBe('finish');
  });

  it('swap: runs straight through, its start and end at once, into the next step', () => {
    const s = story([
      [
        { id: 'swap', type: 'swap', text: 'As Ben.', start: [{ hero: 'obiwan' }, { to: 'core' }], end: [{ music: 'quiet' }] },
        { id: 'ledge', type: 'reach', text: 'The ledge.', target: { spot: 'ledge' }, start: [{ flag: 'ledge' }] },
      ],
      [FINISH],
    ]);
    const { progress, effects } = startStory(s);
    expect(progress.step).toBe('ledge');
    expect(effects.slice(1)).toEqual([{ hero: 'obiwan' }, { to: 'core' }, { music: 'quiet' }, { flag: 'ledge' }]);
  });

  it('escort: done on bringing them to the place, and failed if the one escorted is killed', () => {
    const s = story([[{ id: 'walk', type: 'escort', text: 'Walk him.', target: { spot: 'lift' }, need: 'chewie' }], [FINISH]]);
    expect(play(s, [killed('guard')]).progress.step).toBe('walk');
    expect(play(s, [killed('pal', 'chewie')]).effects[0]).toHaveProperty('checkpoint');
    expect(play(s, [at('lobby', 'lift', ['han', 'chewie'])]).progress.step).toBe('finish');
  });

  it('escort: not done arriving without them, nor on an arrival that doesn’t say who is with you', () => {
    const s = story([[{ id: 'walk', type: 'escort', text: 'Walk him.', target: { spot: 'lift' }, need: 'chewie' }], [FINISH]]);
    const alone = play(s, [at('lobby', 'lift', ['han']), at('lobby', 'lift', []), at('lobby', 'lift')]);
    expect(alone.progress.step).toBe('walk');
    expect(alone.all.filter((e) => e.checkpoint)).toHaveLength(1);
    // the one walked may be named by the tag they were spawned with as well as by kind
    const crew = story([[{ id: 'walk', type: 'escort', text: 'Walk them.', target: { spot: 'ramp' }, need: 'scan-crew' }], [FINISH]]);
    expect(play(crew, [at('bay', 'ramp', ['technician', 'scan-crew'])]).progress.step).toBe('finish');
    // a reach heeds nobody
    const reach = story([[{ id: 'go', type: 'reach', text: 'Go.', target: { spot: 'lift' } }], [FINISH]]);
    expect(play(reach, [at('lobby', 'lift', [])]).progress.step).toBe('finish');
  });
});

describe('failing a step', () => {
  const beats = [
    [{ id: 'first', type: 'reach', text: 'First.', target: { spot: 'b' }, end: [{ give: 'armour' }] }],
    [
      { id: 'guard', type: 'reach', text: 'To the guards.', target: { spot: 'c' }, start: [{ spawn: { kind: 'stormtrooper', spot: 'c', role: 'post', tag: 'g' } }] },
      {
        id: 'fight',
        type: 'fight',
        text: 'Fight.',
        target: { tag: 'g' },
        need: 2,
        start: [{ spawn: { kind: 'officer', spot: 'd', role: 'post', tag: 'h' } }],
        fail: [{ say: { who: 'han', text: 'Again.' } }],
      },
    ],
    [FINISH],
  ];
  const s = story(beats);

  it('goes back to the start of its beat, undoing the beat’s people and putting the state back to the checkpoint', () => {
    const { progress, effects } = play(s, [at('r', 'b'), at('r', 'c'), killed('g'), died]);
    expect(progress).toMatchObject({ step: 'guard', t: 0, n: 0, done: false });
    expect(effects).toEqual([
      { say: { who: 'han', text: 'Again.' } },
      { despawn: 'g' },
      { despawn: 'h' },
      { checkpoint: { step: 'guard', spot: 'b', hero: 'luke', armour: true, helmet: false, companions: ['han'], flags: [], gun: 'e11', items: [] } },
      { spawn: { kind: 'stormtrooper', spot: 'c', role: 'post', tag: 'g' } },
    ]);
  });

  it('starts the count again, so the fight is won only by downing them all afresh', () => {
    const failed = play(s, [at('r', 'b'), at('r', 'c'), killed('g'), killed('h', 'officer'), died]);
    expect(failed.progress).toMatchObject({ step: 'guard', down: {} });
    const again = play(s, [at('r', 'b'), at('r', 'c'), killed('g'), died, at('r', 'c'), killed('g')]);
    expect(again.progress).toMatchObject({ step: 'fight', down: { g: 1 } });
  });

  it('is failed by dying on any step, but not by being caught where sneaking isn’t asked', () => {
    expect(play(s, [died]).progress.step).toBe('first');
    expect(play(s, [died]).effects).toContainEqual({ checkpoint: { ...BEGIN, step: 'first' } });
    expect(play(s, [caught]).effects).toEqual([]);
    const sneak = story([[{ id: 'past', type: 'reach', text: 'Past them.', target: { spot: 'ledge' }, need: 'unseen' }], [FINISH]]);
    expect(play(sneak, [caught]).effects[0]).toEqual({ checkpoint: { ...BEGIN, step: 'past' } });
  });

  it('runs out of time on a step with a deadline', () => {
    const run = story([[{ id: 'run', type: 'reach', text: 'Run.', target: { spot: 'ship' }, time: 1, fail: [{ say: { who: 'han', text: 'Too slow.' } }] }], [FINISH]]);
    expect(play(run, second.slice(0, 29)).effects).toEqual([]);
    expect(play(run, second).effects).toEqual([{ say: { who: 'han', text: 'Too slow.' } }, { checkpoint: { ...BEGIN, step: 'run' } }]);
    expect(play(run, [...second.slice(0, 29), at('hangar', 'ship')]).progress.step).toBe('finish');
  });

  it('keeps things put out of action earlier, and forgets the beat’s people, who come back', () => {
    const cams = story([
      [{ id: 'cams', type: 'kill', text: 'Cameras.', target: { tag: 'cam' }, need: 2 }],
      [
        { id: 'spawn', type: 'reach', text: 'Go.', target: { spot: 'x' }, start: [{ spawn: { kind: 'officer', spot: 'x', role: 'post', tag: 'boss' } }] },
        { id: 'boss', type: 'kill', text: 'The boss.', target: { npc: 'boss' }, need: 1 },
      ],
      [FINISH],
    ]);
    const r = play(cams, [killed('cam-1', 'camera'), killed('cam-2', 'camera'), killed('boss', 'officer'), died]);
    expect(r.progress.step).toBe('spawn');
    expect(r.progress.down).toEqual({ 'cam-1': 1, 'cam-2': 1 });
  });
});

describe('the end', () => {
  it('comes after the last step’s end, and the story then hears nothing', () => {
    const s = story([[{ id: 'go', type: 'reach', text: 'Go.', target: { spot: 'b' } }], [FINISH]]);
    const r = play(s, [at('r', 'b'), ...second]);
    expect(r.progress.done).toBe(true);
    expect(r.effects).toEqual([{ end: true }]);
    const after = storyStep(r.progress, s, died);
    expect(after).toEqual({ progress: r.progress, effects: [] });
  });
});

describe('checkpoints', () => {
  it('carry the state each beat begins with, folded through every effect and arrival before it', () => {
    const steps = chain(BEGIN, [
      [
        { id: 'arm', type: 'use', text: 'Arm.', target: { tag: 'locker' }, start: [{ flag: 'x' }], end: [{ give: 'armour' }, { give: 'helmet' }, { give: 'gun:dl44' }] },
        { id: 'walk', type: 'reach', text: 'Walk.', target: { spot: 'door' }, end: [{ companion: 'chewie', follow: true }, { companion: 'han', follow: false }] },
      ],
      [
        { id: 'swap', type: 'swap', text: 'Swap.', start: [{ hero: 'obiwan' }, { take: 'helmet' }, { take: 'gun:dl44' }, { to: 'core' }, { unflag: 'x' }, { bridge: true }] },
        { id: 'room', type: 'reach', text: 'Room.', target: { room: 'r9' } },
      ],
      [FINISH],
    ]);
    expect(steps.map((s) => s.checkpoint.step)).toEqual(['arm', 'arm', 'swap', 'swap', 'finish']);
    expect(steps[2].checkpoint).toEqual({ step: 'swap', spot: 'door', hero: 'luke', armour: true, helmet: true, companions: ['chewie'], flags: ['x'], gun: 'dl44', items: [] });
    expect(steps[4].checkpoint).toEqual({ step: 'finish', spot: 'core', hero: 'obiwan', armour: true, helmet: false, companions: ['chewie'], flags: ['bridge'], gun: null, items: [] });
    expect(steps[0]).toMatchObject({ start: [{ flag: 'x' }], end: [{ give: 'armour' }, { give: 'helmet' }, { give: 'gun:dl44' }] });
    expect(steps[1]).toMatchObject({ start: [] });
  });

  it('keep what you carry: a thing given in one beat is still yours from the next one’s checkpoint, till it is taken', () => {
    const steps = chain(BEGIN, [
      [{ id: 'get', type: 'use', text: 'Get.', target: { tag: 'locker' }, end: [{ give: 'comlink' }, { give: 'beacon' }] }],
      [{ id: 'call', type: 'use', text: 'Call.', target: { tag: 'comlink' }, end: [{ take: 'beacon' }] }],
      [FINISH],
    ]);
    expect(steps[0].checkpoint.items).toEqual([]);
    expect(steps[1].checkpoint.items).toEqual(['comlink', 'beacon']);
    expect(steps[2].checkpoint.items).toEqual(['comlink']);
  });

  it('are read for the step under way, as a copy, and there is none once the story is over', () => {
    const s = story([[{ id: 'go', type: 'reach', text: 'Go.', target: { spot: 'b' } }], [FINISH]]);
    const { progress } = startStory(s);
    const cp = checkpointOf(s, progress);
    expect(cp).toEqual({ ...BEGIN, step: 'go' });
    cp.flags.push('tampered');
    expect(checkpointOf(s, progress).flags).toEqual([]);
    expect(checkpointOf(s, play(s, [at('r', 'b'), ...second]).progress)).toBeNull();
  });
});

describe('writing a story', () => {
  it('says a line as an effect, and spawns people alike as effects of their own, posted unless told otherwise', () => {
    expect(say('han', 'Here.')).toEqual({ say: { who: 'han', text: 'Here.' } });
    const two = spawn('stormtrooper', 'ramp', 'guard', { squad: 'ramp', hostile: true }, 2);
    const guard = { spawn: { kind: 'stormtrooper', spot: 'ramp', role: 'post', squad: 'ramp', hostile: true, tag: 'guard' } };
    expect(two).toEqual([guard, guard]);
    expect(two[0]).not.toBe(two[1]);
    expect(spawn('leia', 'cell', 'leia', { role: 'scripted' })).toEqual([{ spawn: { kind: 'leia', spot: 'cell', role: 'scripted', tag: 'leia' } }]);
    // a script is each one’s own as well, so walking one never moves the other
    const walk = [{ to: 'ramp' }, { to: 'panel' }];
    const pair = spawn('stormtrooper', 'foot', 'ramp', { role: 'scripted', script: walk }, 2);
    expect(pair[0].spawn.script).toEqual(walk);
    expect(pair[0].spawn.script).not.toBe(pair[1].spawn.script);
    expect(pair[0].spawn.script[0]).not.toBe(walk[0]);
  });
});
