import { describe, expect, it } from 'vitest';
import { createAlarm, raise } from '../alarm';
import { CAST } from '../cast';
import { WEAPONS } from '../combat';
import { EGGS } from '../eggs';
import { DS1 } from '../stations/ds1';
import { DS2 } from '../stations/ds2';
import { MOODS, SCENES, TYPES, checkpointOf, startStory, storyStep } from '../story';
import { TALKS, WHO, choose, openTalk } from '../talk';
import { STORIES, storyFor } from './index';

// Both stations by id, built into the game or not yet, so the second
// station’s stories are checked against its rooms as soon as they come.
const STATION = { ds1: DS1, ds2: DS2 };
// the routines a spawned person may be given (rules/brains.js’s role types)
const ROLES = ['patrol', 'post', 'work', 'chat', 'march', 'droid', 'scripted'];
const ITEMS = ['armour', 'helmet', 'comlink', 'beacon', 'saber', ...Object.keys(WEAPONS).map((id) => `gun:${id}`)];
const EFFECTS = ['flag', 'unflag', 'unlock', 'lock', 'spawn', 'despawn', 'alarm', 'say', 'intercom', 'scene', 'hero', 'give', 'take', 'companion', 'to', 'achievement', 'music', 'walls', 'bridge', 'end'];

const all = Object.values(STORIES);
const effectsOf = (step) => [...step.start, ...step.end, ...(step.fail ?? [])];
const each = (fn) => {
  for (const story of all) for (const step of story.steps) fn(story, step, `${story.id}/${step.id}`);
};
const eachEffect = (fn) => each((story, step, where) => effectsOf(step).forEach((e) => fn(e, story, `${where}`)));

// ── the scripts ──

const at = (room, spot = null) => ({ type: 'at', room, spot });
const used = (tag) => ({ type: 'used', tag });
const killed = (tag, kind = 'stormtrooper') => ({ type: 'killed', kind, tag });
const done = (id) => ({ type: 'sceneDone', id });
const wait = (seconds) => Array.from({ length: Math.round(seconds * 30) }, () => ({ type: 'tick', dt: 1 / 30 }));
const times = (n, event) => Array.from({ length: n }, () => event);

// A conversation played through talk.js, picking each line by how it
// starts, with you as the story has made you so far: so a script only
// gets through if the story set the flags (and handed you the helmet) the
// talk asks for.
const talk = (id, ...picks) => (me) => {
  const ctx = { station: me.station, side: me.side, disguise: me.armour, helmet: me.helmet, flags: me.flags, story: me.story, hero: me.hero, tk: null };
  let t = openTalk(id, ctx);
  if (!t) throw new Error(`${id} won’t open`);
  const events = [];
  const queue = [...picks];
  while (t) {
    let i = 0;
    if (t.choices.length) {
      const want = queue.shift();
      i = t.choices.findIndex((say) => say.startsWith(want));
      if (i < 0) throw new Error(`no “${want}…” in ${id}/${t.node}: ${t.choices.join(' | ')}`);
    }
    const r = choose(t, i, ctx);
    for (const fx of r.effects) if (fx.event) events.push(fx.event);
    t = r.talk;
  }
  return events;
};

// Plays a story by a script of events (or of talks, which make their own),
// keeping the steps it stood at and every effect, and what the effects
// make of you, for the talks; `at` hears of each step as the story comes to it.
function playThrough(story, script, at = () => {}) {
  const me = { station: story.station, side: story.side, story: story.id, hero: story.hero, armour: false, helmet: false, flags: new Set() };
  const effects = [];
  const note = (fx) => {
    for (const e of fx) {
      effects.push(e);
      if (e.checkpoint) Object.assign(me, { hero: e.checkpoint.hero, armour: e.checkpoint.armour, helmet: e.checkpoint.helmet, flags: new Set(e.checkpoint.flags) });
      if (e.flag) me.flags.add(e.flag);
      if (e.unflag) me.flags.delete(e.unflag);
      if (e.hero) me.hero = e.hero;
      if (e.give === 'armour' || e.give === 'helmet') me[e.give] = true;
      if (e.take === 'armour' || e.take === 'helmet') me[e.take] = false;
    }
  };
  let { progress, effects: first } = startStory(story);
  note(first);
  const steps = [progress.step];
  at(progress);
  for (const entry of script) {
    for (const event of typeof entry === 'function' ? entry(me) : [entry]) {
      const r = storyStep(progress, story, event);
      progress = r.progress;
      note(r.effects);
      if (steps.at(-1) === progress.step || progress.done) continue;
      steps.push(progress.step);
      at(progress);
    }
  }
  return { progress, steps, effects };
}

const REBEL = [
  ...wait(25), // the scan, kept still in the smuggling hold
  used('ambush-panel'),
  killed('ambush'),
  killed('ambush'),
  at('bay327', 'ctl-door'),
  talk('ctl-officer', '(Tap'),
  killed('ctl-crew', 'officer'),
  killed('ctl-crew', 'officer'),
  used('scomp'),
  at('tractor', 'tractor-ledge'),
  used('tractor-power-1'),
  used('tractor-power-2'),
  at('lobby5', 'lift5'),
  at('aa23', 'aa23-desk'),
  talk('aa23-officer', 'Prisoner transfer'),
  ...times(3, killed('aa23-guard')),
  killed('aa23-camera-1', 'camera'),
  killed('aa23-camera-2', 'camera'),
  talk('han-intercom', 'Uh, everything', 'We had a slight', 'We’re fine', 'Negative', 'Uh'),
  at('cellbay2', 'cell2187-door'),
  talk('leia-2187', 'Huh?', 'I’ve got your R2', 'Come on'),
  ...times(3, killed('cellbay-squad')),
  at('chute', 'chute-slide'),
  at('compactor', 'compactor-drop'),
  ...times(9, used('dianoga')),
  talk('threepio-comlink', 'Shut down'),
  used('compactor-hatch'),
  at('chasm', 'chasm-door'),
  at('chasm', 'chasm-ledge'),
  used('swing'),
  done('swing'),
  at('tiebay', 'bay-door'),
  done('duel'),
  at('bay327', 'falcon-ramp'),
  done('escape'),
];

const IMPERIAL = [
  at('bay327', 'ranks'),
  done('tractor'),
  at('bay327', 'falcon-ramp'),
  at('bay327', 'scan-crew'),
  at('bay327', 'vader-bay'),
  ...wait(5),
  at('bay327', 'ctl-door'),
  used('ctl-door'),
  at('ctl327', 'ctl-closet'),
  at('aa23'),
  at('cellbay2', 'chute-grate'),
  at('maint', 'maint-sweep'),
  at('chasm', 'chasm-upper'),
  ...wait(10),
  done('swing'),
  used('beacon'),
  done('escape'),
];

const SCRIPTS = { 'ds1-rebel': REBEL, 'ds1-imperial': IMPERIAL };

// ── the tests ──

describe('the stories', () => {
  it('are both of the first station’s, each found by its station and side', () => {
    expect(Object.keys(STORIES).sort()).toEqual(['ds1-imperial', 'ds1-rebel']);
    expect(storyFor('ds1', 'rebel')).toBe(STORIES['ds1-rebel']);
    expect(storyFor('ds1', 'imperial')).toBe(STORIES['ds1-imperial']);
    expect(storyFor('ds9', 'rebel')).toBeNull();
    expect(STORIES['ds1-rebel']).toMatchObject({ station: 'ds1', side: 'rebel', hero: 'luke', title: 'That’s no moon' });
    expect(STORIES['ds1-imperial']).toMatchObject({ station: 'ds1', side: 'imperial', hero: 'stormtrooper', title: 'Intruder alert' });
  });

  it('tell their beats in order, each one a checkpoint', () => {
    const beats = (id) => [...new Set(STORIES[id].steps.map((s) => s.checkpoint.step))];
    expect(beats('ds1-rebel')).toEqual(['scan', 'ambush', 'control', 'scomp', 'tractor', 'transfer', 'intercom', 'cell', 'cellbay', 'compactor', 'maint', 'chasm', 'bay']);
    expect(beats('ds1-imperial')).toEqual(['muster', 'scan', 'tk421', 'aa23', 'sweep', 'beacon']);
  });

  for (const story of all) {
    it(`${story.id} plays through by a script from its start to its end, every step in turn`, () => {
      const { progress, steps, effects } = playThrough(story, SCRIPTS[story.id]);
      expect(progress.done).toBe(true);
      // a swap is over as it begins, so the story never stands at one
      expect(steps).toEqual(story.steps.filter((s) => s.type !== 'swap').map((s) => s.id));
      expect(effects.filter((e) => e.end)).toEqual([{ end: true }]);
      expect(effects.at(-1)).toEqual({ end: true });
      expect(effects.filter((e) => e.checkpoint)).toHaveLength(1);
    });
  }
});

describe('what the steps name', () => {
  it('is somewhere in their station: every target spot and room, every checkpoint’s spot', () => {
    each((story, step, where) => {
      const st = STATION[story.station];
      if (step.target?.spot) expect(st.spots[step.target.spot], where).toBeDefined();
      if (step.target?.room) expect(st.rooms.some((r) => r.id === step.target.room), where).toBe(true);
      expect(st.spots[step.checkpoint.spot], `${where} checkpoint`).toBeDefined();
    });
  });

  it('is a kind of step the engine runs, with what it finishes on', () => {
    const talkNodes = (id) => Object.keys(TALKS[id]?.nodes ?? {});
    const choiceTargets = (id) => Object.values(TALKS[id].nodes).flatMap((n) => (n.choices ?? []).map((c) => c.to));
    for (const story of all) expect(new Set(story.steps.map((s) => s.id)).size, story.id).toBe(story.steps.length);
    each((story, step, where) => {
      const { type, target, need, time } = step;
      expect(TYPES, where).toContain(type);
      if (target) expect(Object.keys(target), where).toHaveLength(1);
      if (['reach', 'escort'].includes(type)) expect(target?.spot ?? target?.room, where).toBeTruthy();
      if (['use', 'fight', 'kill'].includes(type)) expect(target?.tag ?? target?.npc, where).toBeTruthy();
      if (['hide', 'timer', 'still'].includes(type)) expect(time, where).toBeGreaterThan(0);
      if (type === 'talk') {
        expect(TALKS[need?.talk], where).toBeDefined();
        if (need.node) expect(talkNodes(need.talk), where).toContain(need.node);
      }
      if (type === 'choose') expect(choiceTargets(need.talk), where).toContain(need.choice);
      if (type === 'scene') {
        expect(SCENES, where).toContain(need?.scene);
        expect(step.start, where).toContainEqual({ scene: need.scene });
      }
    });
  });

  it('acts on people the story has brought aboard and things that stand at the station’s spots', () => {
    for (const story of all) {
      const st = STATION[story.station];
      const jumps = new Set((st.jumps ?? []).map((j) => j.id));
      const spawned = new Set();
      const given = new Set();
      for (const step of story.steps) {
        const thing = step.target?.tag ?? step.target?.npc;
        const where = `${story.id}/${step.id}`;
        // the step’s own start has run by the time it is acted on
        for (const e of step.start) {
          if (e.spawn) spawned.add(e.spawn.tag);
          if (e.give) given.add(e.give);
        }
        if (thing && step.type !== 'fight') {
          const known = spawned.has(thing) || thing in st.spots || `${thing}-1` in st.spots || jumps.has(thing) || given.has(thing);
          expect(known, `${where}: ${thing}`).toBe(true);
        }
        if (step.type === 'escort') expect(step.checkpoint.companions.includes(step.need) || spawned.has(step.need), `${where}: ${step.need}`).toBe(true);
        for (const e of [...step.start, ...step.end]) if (e.despawn) expect(spawned.has(e.despawn), `${where}: ${e.despawn}`).toBe(true);
        for (const e of step.end) {
          if (e.spawn) spawned.add(e.spawn.tag);
          if (e.give) given.add(e.give);
        }
      }
    }
  });

  it('fights only people its own beat has brought aboard, as many as it needs at least', () => {
    for (const story of all) {
      story.steps.forEach((step, i) => {
        if (step.type !== 'fight') return;
        const beat = story.steps.slice(story.steps.findIndex((s) => s.id === step.checkpoint.step), i + 1);
        const ran = beat.flatMap((s, k) => (k < beat.length - 1 ? [...s.start, ...s.end] : s.start));
        const many = ran.filter((e) => e.spawn?.tag === step.target.tag).length;
        expect(many, `${story.id}/${step.id}`).toBeGreaterThanOrEqual(step.need ?? 1);
      });
    }
  });
});

describe('the effects', () => {
  it('are each one thing the game knows how to do', () => {
    eachEffect((e, story, where) => {
      const keys = Object.keys(e).filter((k) => k !== 'follow');
      expect(keys, where).toHaveLength(1);
      expect(EFFECTS, where).toContain(keys[0]);
    });
  });

  it('name no door, spot, kind or scene the station and cast don’t have', () => {
    const doors = (st) => new Set(st.doors.map((d) => d.id));
    eachEffect((e, story, where) => {
      const st = STATION[story.station];
      for (const door of [e.unlock, e.lock].filter(Boolean)) expect(doors(st).has(door), `${where}: door ${door}`).toBe(true);
      for (const spot of [e.to, e.spawn?.spot].filter(Boolean)) expect(st.spots[spot], `${where}: spot ${spot}`).toBeDefined();
      for (const kind of [e.spawn?.kind, e.companion, e.hero].filter(Boolean)) expect(CAST[kind], `${where}: kind ${kind}`).toBeDefined();
      if (e.scene) expect(SCENES, where).toContain(e.scene);
    });
    each((story, step, where) => {
      for (const kind of [step.checkpoint.hero, ...step.checkpoint.companions]) expect(CAST[kind], `${where}: kind ${kind}`).toBeDefined();
      if (step.checkpoint.gun) expect(WEAPONS[step.checkpoint.gun], where).toBeDefined();
    });
  });

  it('name no section, alarm, speaker, item, mood, routine or achievement that doesn’t exist', () => {
    const achievements = new Set(EGGS.map((egg) => egg.achievement));
    eachEffect((e, story, where) => {
      const st = STATION[story.station];
      // raise refuses a cause it doesn’t know, and has no level for a section the station hasn’t
      if (e.alarm) expect(raise(createAlarm(st), e.alarm.section, e.alarm.how, null, 0), where).not.toBeNull();
      if (e.intercom) expect(st.sections[e.intercom.section], where).toBeDefined();
      if (e.say) expect(Boolean(WHO[e.say.who] || CAST[e.say.who]), `${where}: ${e.say.who}`).toBe(true);
      for (const item of [e.give, e.take].filter(Boolean)) expect(ITEMS, where).toContain(item);
      if (e.music) expect(MOODS, where).toContain(e.music);
      if (e.spawn) expect(ROLES, where).toContain(e.spawn.role);
      if (e.achievement) expect(achievements.has(e.achievement), where).toBe(true);
      if (e.walls) expect(['close', 'open'], where).toContain(e.walls);
      if ('bridge' in e) expect(typeof e.bridge, where).toBe('boolean');
      if ('companion' in e) expect(typeof e.follow, where).toBe('boolean');
    });
  });

  it('end a story only after its last step', () => {
    for (const story of all) {
      const ends = story.steps.flatMap((s) => effectsOf(s).filter((e) => e.end).map(() => s.id));
      expect(ends, story.id).toEqual([story.steps.at(-1).id]);
    }
  });

  it('say every line in the house style: curly quotes, a real ellipsis, no shouting, no sequel names', () => {
    const lines = [];
    each((story, step, where) => {
      lines.push([where, step.text]);
      for (const e of effectsOf(step)) for (const text of [e.say?.text, e.intercom?.text].filter(Boolean)) lines.push([where, text]);
    });
    for (const [where, text] of lines) {
      expect(text, where).toMatch(/\S/);
      expect(text, where).not.toMatch(/['"]|\.\.\.|!!|FN-2187|Starkiller|First Order|Kylo|\bRey\b|Finn|\bPoe\b|Snoke|Hux|Phasma/);
    }
  });
});

describe('failing', () => {
  it('takes every step back to its checkpoint, the start of its beat, with the state as the beat found it', () => {
    for (const story of all) {
      const tried = [];
      playThrough(story, SCRIPTS[story.id], (progress) => {
        const where = `${story.id}/${progress.step}`;
        const before = checkpointOf(story, progress);
        const { progress: after, effects } = storyStep(progress, story, { type: 'died' });
        expect(effects, where).toContainEqual({ checkpoint: before });
        // where the beat begins again is where starting it afresh would stand (past a swap, if it opens with one)
        expect(after.step, where).toBe(startStory(story, before.step).progress.step);
        tried.push(progress.step);
      });
      expect(tried, story.id).toEqual(story.steps.filter((s) => s.type !== 'swap').map((s) => s.id));
    }
  });

  it('sends Luke back into hiding if the searchers see him move', () => {
    const story = STORIES['ds1-rebel'];
    const { progress } = playThrough(story, wait(20));
    const { progress: after, effects } = storyStep(progress, story, { type: 'caught' });
    expect(after).toMatchObject({ step: 'scan', t: 0 });
    expect(effects).toContainEqual({ checkpoint: { step: 'scan', spot: 'scan-hide', hero: 'luke', armour: false, helmet: false, companions: ['han', 'chewie', 'obiwan', 'threepio', 'artoo'], flags: [], gun: 'e11' } });
  });

  it('starts Ben’s walk to the tractor beam again, as Ben, if the guards see him', () => {
    const story = STORIES['ds1-rebel'];
    const script = REBEL.slice(0, REBEL.findIndex((e) => e?.tag === 'scomp') + 1);
    const { progress } = playThrough(story, script);
    expect(progress.step).toBe('tractor-guards');
    const { progress: after, effects } = storyStep(progress, story, { type: 'caught' });
    expect(after.step).toBe('tractor-guards');
    expect(effects).toContainEqual({ despawn: 'tractor-guards' });
    expect(effects).toContainEqual({ hero: 'obiwan' });
    expect(effects.at(-1)).toEqual({ spawn: expect.objectContaining({ kind: 'stormtrooper', spot: 'core6-guards', tag: 'tractor-guards' }) });
  });

  it('crushed in the compactor, opens its walls and goes back to the chute with Han, Chewbacca and Leia', () => {
    const story = STORIES['ds1-rebel'];
    const script = REBEL.slice(0, REBEL.findIndex((e) => e?.tag === 'dianoga') + 9);
    const { progress } = playThrough(story, script);
    expect(progress.step).toBe('compactor-walls');
    const crushed = wait(40).reduce((r) => (r.effects.length ? r : storyStep(r.progress, story, { type: 'tick', dt: 1 / 30 })), { progress, effects: [] });
    expect(crushed.progress.step).toBe('compactor');
    expect(crushed.effects).toContainEqual({ walls: 'open' });
    expect(crushed.effects).toContainEqual({
      checkpoint: { step: 'compactor', spot: 'chute-slide', hero: 'luke', armour: true, helmet: true, companions: ['han', 'chewie', 'leia'], flags: ['tk421', 'tractor-found', 'leia-found', 'tractor-off', 'grate'], gun: 'e11' },
    });
  });

  it('leaves the freighter without its beacon if the trooper is too slow', () => {
    const story = STORIES['ds1-imperial'];
    const script = IMPERIAL.slice(0, IMPERIAL.findIndex((e) => e?.tag === 'beacon'));
    const { progress } = playThrough(story, script);
    expect(progress.step).toBe('beacon');
    const late = playThroughFrom(story, progress, wait(60));
    expect(late.step).toBe('beacon');
    expect(late.failed).toBe(true);
  });
});

describe('Han’s intercom', () => {
  it('ends however it goes with the panel shot and AA-23 on alert', () => {
    const story = STORIES['ds1-rebel'];
    const script = REBEL.slice(0, REBEL.findIndex((e) => e?.tag === 'aa23-camera-2') + 1);
    const { progress } = playThrough(story, script);
    expect(progress.step).toBe('intercom');
    for (const node of ['boring', 'blast']) {
      const { progress: after, effects } = storyStep(progress, story, { type: 'talked', talk: 'han-intercom', node });
      expect(after.step).toBe('cell');
      const alarm = createAlarm(DS1);
      const raised = effects.filter((e) => e.alarm).map((e) => raise(alarm, e.alarm.section, e.alarm.how, null, 0));
      expect(raised).toEqual(['alert']);
      expect(effects.find((e) => e.alarm).alarm.section).toBe('aa23');
    }
  });
});

// Runs ticks on from a progress until the step fails (a checkpoint comes back) or they run out.
function playThroughFrom(story, progress, events) {
  let p = progress;
  for (const e of events) {
    const r = storyStep(p, story, e);
    p = r.progress;
    if (r.effects.some((fx) => fx.checkpoint)) return { step: p.step, failed: true };
  }
  return { step: p.step, failed: false };
}
