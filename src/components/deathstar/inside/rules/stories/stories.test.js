import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../../../Achievements';
import { createAlarm, raise } from '../alarm';
import { CAST } from '../cast';
import { WEAPONS } from '../combat';
import { eggsOn } from '../eggs';
import { DS1 } from '../stations/ds1';
import { DS2 } from '../stations/ds2';
import { MOODS, SCENES, TYPES, checkpointOf, startStory, storyStep } from '../story';
import { TALKS, WHO, choose, openTalk } from '../talk';
import { STORIES, storyFor } from './index';

// Both stations by id, built into the game or not yet, so the second
// station’s stories are checked against its rooms as soon as they come.
const STATION = { ds1: DS1, ds2: DS2 };
// the routines a spawned person may be given (rules/brains.js’s role types)
const ROLES = ['patrol', 'post', 'work', 'chat', 'march', 'droid', 'follow', 'lead', 'scripted'];
const ITEMS = ['armour', 'helmet', 'comlink', 'beacon', 'saber', ...Object.keys(WEAPONS).map((id) => `gun:${id}`)];
const EFFECTS = ['flag', 'unflag', 'unlock', 'lock', 'spawn', 'despawn', 'alarm', 'say', 'intercom', 'scene', 'hero', 'give', 'take', 'companion', 'to', 'achievement', 'music', 'walls', 'bridge', 'end'];

const all = Object.values(STORIES);
const effectsOf = (step) => [...step.start, ...step.end, ...(step.fail ?? [])];
const each = (fn) => {
  for (const story of all) for (const step of story.steps) fn(story, step, `${story.id}/${step.id}`);
};
const eachEffect = (fn) => each((story, step, where) => effectsOf(step).forEach((e) => fn(e, story, `${where}`)));

// ── the scripts ──

// `withYou`: who the game says has come with you, for an escort
const at = (room, spot = null, withYou = undefined) => ({ type: 'at', room, spot, ...(withYou && { with: withYou }) });
const used = (tag) => ({ type: 'used', tag });
const dialled = (code) => ({ type: 'dialled', code });
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
  at('lobby5', 'lift5', ['han', 'chewie']),
  at('aa23', 'aa23-desk', ['chewie', 'han']),
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
  dialled('3263827'),
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
  at('bay327', 'falcon-ramp', ['technician', 'scan-crew']),
  at('bay327', 'scan-crew', ['technician', 'scan-crew']),
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

// Luke’s way up the tower and down again, the duel won the long way: every
// line of the Emperor’s heard out before the saber is taken.
const REBEL2 = [
  done('arrive2'),
  at('holding', 'holding-lift', ['vader', 'royalguard', 'guards']),
  talk('vader-lift', 'I know, Father', 'I know there is good'),
  done('tower'),
  talk('throne', 'I came for my father', 'Your overconfidence', 'My friends', '(Look out', '(Take the saber'),
  killed('duel-vader', 'vader'),
  at('throne', 'under-stairs'),
  ...wait(10), // under the stairs while he hunts
  killed('fury-vader', 'vader'),
  talk('strike-down', '(Strike him down', '(Look at his', '(Throw'),
  ...wait(10), // the lightning, guard up
  done('throw'),
  at('dock', 'shuttle-ramp', ['vader']),
  done('mask'),
  talk('unmasking', 'But you’ll die', '(Lift', 'I’ve got to save'),
  at('dock', 'escape-board'),
  done('escape2'),
];

const IMPERIAL2 = [
  talk('st321', 'ST 321, who', '(Check', '(Lower'),
  done('arrive2'),
  talk('jerjerrod-vader'),
  at('hangar272', 'ranks272'),
  { type: 'still', seconds: 40 },
  at('command', 'firing-switch'),
  ...wait(8),
  used('firing-switch'),
  done('cruiser'),
  at('dock'),
  done('escape2'),
];

const SCRIPTS = { 'ds1-rebel': REBEL, 'ds1-imperial': IMPERIAL, 'ds2-rebel': REBEL2, 'ds2-imperial': IMPERIAL2 };

// ── the tests ──

describe('the stories', () => {
  it('are one for each station and side, each found by its station and side', () => {
    expect(Object.keys(STORIES).sort()).toEqual(['ds1-imperial', 'ds1-rebel', 'ds2-imperial', 'ds2-rebel']);
    for (const story of all) expect(storyFor(story.station, story.side)).toBe(story);
    expect(storyFor('ds9', 'rebel')).toBeNull();
    expect(STORIES['ds1-rebel']).toMatchObject({ station: 'ds1', side: 'rebel', hero: 'luke', title: 'That’s no moon' });
    expect(STORIES['ds1-imperial']).toMatchObject({ station: 'ds1', side: 'imperial', hero: 'stormtrooper', title: 'Intruder alert' });
    expect(STORIES['ds2-rebel']).toMatchObject({ station: 'ds2', side: 'rebel', hero: 'luke', title: 'The Emperor’s Tower' });
    expect(STORIES['ds2-imperial']).toMatchObject({ station: 'ds2', side: 'imperial', hero: 'dstrooper', title: 'Fully armed and operational' });
  });

  it('tell their beats in order, each one a checkpoint', () => {
    const beats = (id) => [...new Set(STORIES[id].steps.map((s) => s.checkpoint.step))];
    expect(beats('ds1-rebel')).toEqual(['scan', 'ambush', 'control', 'scomp', 'tractor', 'transfer', 'intercom', 'cell', 'cellbay', 'compactor', 'maint', 'chasm', 'bay']);
    expect(beats('ds1-imperial')).toEqual(['muster', 'scan', 'tk421', 'aa23', 'sweep', 'beacon']);
    expect(beats('ds2-rebel')).toEqual(['escort', 'lift', 'throne', 'duel', 'lightning', 'carry', 'mask', 'escape']);
    expect(beats('ds2-imperial')).toEqual(['clearance', 'ranks', 'fire', 'breach']);
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
      // a code dialled is the one the station locks the door to, so the door opens to it by itself
      if (type === 'use' && need?.code != null) expect(STATION[story.station].doors.find((d) => d.id === target.tag)?.lock, where).toBe(`code:${need.code}`);
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
      const followers = new Set();
      const given = new Set();
      for (const step of story.steps) {
        const thing = step.target?.tag ?? step.target?.npc;
        const where = `${story.id}/${step.id}`;
        // the step’s own start has run by the time it is acted on
        for (const e of step.start) {
          if (e.spawn) spawned.add(e.spawn.tag);
          if (e.spawn?.role === 'follow' || e.spawn?.role === 'lead') followers.add(e.spawn.tag);
          if (e.give) given.add(e.give);
        }
        if (thing && step.type !== 'fight') {
          const known = spawned.has(thing) || thing in st.spots || `${thing}-1` in st.spots || jumps.has(thing) || given.has(thing);
          expect(known, `${where}: ${thing}`).toBe(true);
        }
        // someone walked must keep up with you, or lead you there, to be with you as you arrive (one carried is a companion the step takes up)
        const takenUp = step.start.some((e) => e.companion === step.need && e.follow);
        if (step.type === 'escort') expect(step.checkpoint.companions.includes(step.need) || followers.has(step.need) || takenUp, `${where}: ${step.need}`).toBe(true);
        for (const e of [...step.start, ...step.end]) if (e.despawn) expect(spawned.has(e.despawn), `${where}: ${e.despawn}`).toBe(true);
        for (const e of step.end) {
          if (e.spawn) spawned.add(e.spawn.tag);
          if (e.give) given.add(e.give);
        }
      }
    }
  });

  it('fights only people its own beat has brought aboard, as many as it needs at least, and no other beat brings', () => {
    for (const story of all) {
      story.steps.forEach((step, i) => {
        if (step.type !== 'fight') return;
        const beat = story.steps.slice(story.steps.findIndex((s) => s.id === step.checkpoint.step), i + 1);
        const ran = beat.flatMap((s, k) => (k < beat.length - 1 ? [...s.start, ...s.end] : s.start));
        const many = ran.filter((e) => e.spawn?.tag === step.target.tag).length;
        expect(many, `${story.id}/${step.id}`).toBeGreaterThanOrEqual(step.need ?? 1);
        // the count of them down runs over the whole story, so another beat’s people under the tag would count
        const others = story.steps.filter((s) => s.checkpoint.step !== step.checkpoint.step).flatMap((s) => [...s.start, ...s.end]);
        expect(others.filter((e) => e.spawn?.tag === step.target.tag), `${story.id}/${step.id}`).toEqual([]);
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
      const walks = (e.spawn?.script ?? []).map((s) => s.to);
      for (const spot of [e.to, e.spawn?.spot, ...walks].filter(Boolean)) expect(st.spots[spot], `${where}: spot ${spot}`).toBeDefined();
      for (const kind of [e.spawn?.kind, e.companion, e.hero].filter(Boolean)) expect(CAST[kind], `${where}: kind ${kind}`).toBeDefined();
      if (e.scene) expect(SCENES, where).toContain(e.scene);
    });
    each((story, step, where) => {
      for (const kind of [step.checkpoint.hero, ...step.checkpoint.companions]) expect(CAST[kind], `${where}: kind ${kind}`).toBeDefined();
      if (step.checkpoint.gun) expect(WEAPONS[step.checkpoint.gun], where).toBeDefined();
    });
  });

  it('name no section, alarm, speaker, item, mood, routine or achievement that doesn’t exist', () => {
    eachEffect((e, story, where) => {
      const st = STATION[story.station];
      // raise refuses a cause it doesn’t know, and has no level for a section the station hasn’t
      if (e.alarm) expect(raise(createAlarm(st), e.alarm.section, e.alarm.how, null, 0), where).not.toBeNull();
      if (e.intercom) expect(st.sections[e.intercom.section], where).toBeDefined();
      if (e.say) expect(Boolean(WHO[e.say.who] || CAST[e.say.who]), `${where}: ${e.say.who}`).toBe(true);
      for (const item of [e.give, e.take].filter(Boolean)) expect(ITEMS, where).toContain(item);
      if (e.music) expect(MOODS, where).toContain(e.music);
      if (e.spawn) expect(ROLES, where).toContain(e.spawn.role);
      // only a scripted person walks a script (routines.js); anyone else would never take a step of it
      if (e.spawn?.script) expect(e.spawn.role, where).toBe('scripted');
      // the site’s table: unlock drops an id it doesn’t have without a word
      if (e.achievement) expect(ACHIEVEMENTS[e.achievement], where).toBeDefined();
      if (e.walls) expect(['close', 'open'], where).toContain(e.walls);
      if ('bridge' in e) expect(typeof e.bridge, where).toBe('boolean');
      if ('companion' in e) expect(typeof e.follow, where).toBe('boolean');
    });
  });

  it('give each story’s achievement as it ends, and only then', () => {
    const given = (story) => story.steps.flatMap((s) => effectsOf(s).filter((e) => e.achievement).map((e) => [s.id, e.achievement]));
    expect(given(STORIES['ds1-rebel'])).toEqual([['bay-escape', 'ds-ds1-rebel']]);
    expect(given(STORIES['ds1-imperial'])).toEqual([['beacon-escape', 'ds-ds1-imperial']]);
    expect(given(STORIES['ds2-rebel'])).toEqual([['escape-flight', 'ds-ds2-rebel']]);
    expect(given(STORIES['ds2-imperial'])).toEqual([['breach-escape', 'ds-ds2-imperial']]);
    for (const story of all) expect(story.steps.at(-1).end.at(-1), story.id).toEqual({ end: true });
  });

  it('mark a line for the eggs only when an egg listens for it', () => {
    eachEffect((e, story, where) => {
      const line = e.intercom?.line ?? e.say?.line;
      if (line != null) expect(eggsOn(new Set(), { type: 'heard', line }), where).toHaveLength(1);
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
    expect(effects).toContainEqual({ checkpoint: { step: 'scan', spot: 'scan-hide', hero: 'luke', armour: false, helmet: false, companions: ['han', 'chewie', 'obiwan', 'threepio', 'artoo'], flags: [], gun: 'e11', items: [] } });
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
      checkpoint: { step: 'compactor', spot: 'chute-slide', hero: 'luke', armour: true, helmet: true, companions: ['han', 'chewie', 'leia'], flags: ['tk421', 'tractor-found', 'leia-found', 'tractor-off', 'grate'], gun: 'e11', items: ['comlink'] },
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

describe('the ramp guards', () => {
  const story = STORIES['ds1-rebel'];
  const scanned = () => playThrough(story, wait(25));

  it('are nowhere until the panel is used, so nobody can shoot them first', () => {
    const { progress, effects } = scanned();
    expect(progress.step).toBe('ambush');
    expect(effects.filter((e) => e.spawn?.tag === 'ambush')).toEqual([]);
  });

  it('come when it is, from the foot of the ramp, walked up it into the hold to the panel', () => {
    const { progress, effects } = storyStep(scanned().progress, story, used('ambush-panel'));
    expect(progress.step).toBe('ambush-down');
    const guards = effects.filter((e) => e.spawn?.tag === 'ambush').map((e) => e.spawn);
    expect(guards).toHaveLength(2);
    for (const g of guards) {
      expect(DS1.spots[g.spot].room).toBe('bay327');
      expect(g).toMatchObject({ kind: 'stormtrooper', role: 'scripted' });
      expect(g.script.map((s) => s.to)).toEqual(['falcon-ramp', 'ambush-panel']);
      expect(DS1.spots[g.script.at(-1).to].room).toBe('hold');
    }
  });

  it('go if Luke dies fighting them, and come again only when the panel is used again', () => {
    const { progress } = storyStep(scanned().progress, story, used('ambush-panel'));
    const { progress: after, effects } = storyStep(progress, story, { type: 'died' });
    expect(after.step).toBe('ambush');
    expect(effects).toContainEqual({ despawn: 'ambush' });
    expect(effects.filter((e) => e.spawn)).toEqual([]);
  });
});

describe('the control room’s officer and aide', () => {
  const story = STORIES['ds1-rebel'];
  const door = REBEL.findIndex((e) => e?.spot === 'ctl-door');
  const call = talk('ctl-officer', '(Tap');

  it('may be shot one before the gantry’s call, and the fight is won by downing the other', () => {
    const half = playThrough(story, [...REBEL.slice(0, door + 1), killed('ctl-crew', 'officer'), call]);
    expect(half.progress).toMatchObject({ step: 'control-fight', down: { 'ctl-crew': 1 } });
    expect(storyStep(half.progress, story, killed('ctl-crew', 'officer')).progress.step).toBe('scomp');
  });

  it('may both be down before the call, and then the fight is over as it begins', () => {
    const { progress, steps, effects } = playThrough(story, [...REBEL.slice(0, door), killed('ctl-crew', 'officer'), killed('ctl-crew', 'officer'), REBEL[door], call]);
    expect(progress.step).toBe('scomp');
    expect(steps).not.toContain('control-fight');
    // its end still runs, so the music comes down from the alert its start raised
    expect(effects.slice(-2)).toEqual([{ music: 'alert' }, { music: 'calm' }]);
  });
});

describe('walking Chewbacca in', () => {
  const story = STORIES['ds1-rebel'];
  const lift = REBEL.findIndex((e) => e?.spot === 'lift5');
  const from = (progress, events) => events.reduce((p, e) => storyStep(p, story, e).progress, progress);

  it('counts an arrival at the lift or the desk only with him alongside', () => {
    const { progress } = playThrough(story, REBEL.slice(0, lift));
    expect(progress.step).toBe('transfer');
    expect(from(progress, [at('lobby5', 'lift5', ['han']), at('lobby5', 'lift5')]).step).toBe('transfer');
    const down = from(progress, [at('lobby5', 'lift5', ['han', 'chewie'])]);
    expect(down.step).toBe('transfer-desk');
    expect(from(down, [at('aa23', 'aa23-desk', ['han'])]).step).toBe('transfer-desk');
    expect(from(down, [at('aa23', 'aa23-desk', ['chewie'])]).step).toBe('transfer-1138');
  });
});

describe('the compactor’s walls', () => {
  const story = STORIES['ds1-rebel'];
  const me = { station: 'ds1', side: 'rebel', story: 'ds1-rebel', hero: 'luke', armour: true, helmet: true, flags: new Set() };

  for (const picks of [['Shut down'], ['Where', 'Shut down']]) {
    it(`stop the clock when Threepio is asked for the mashers off (${picks.join(', then ')}), and the lines after it run out no deadline`, () => {
      const { progress } = playThrough(story, REBEL.slice(0, REBEL.findIndex((e) => e?.tag === 'dianoga') + 9));
      expect(progress.step).toBe('compactor-walls');
      const events = talk('threepio-comlink', ...picks)(me);
      const asked = events.findIndex((e) => e.type === 'chose' && e.choice === 'mashers');
      // the line picked with half a second to spare, then Threepio’s last lines clicked through slowly
      const script = [...wait(39.5), ...events.slice(0, asked + 1), ...wait(5), ...events.slice(asked + 1)];
      let p = progress;
      const effects = [];
      for (const e of script) {
        const r = storyStep(p, story, e);
        p = r.progress;
        effects.push(...r.effects);
      }
      expect(p.step).toBe('compactor-hatch');
      expect(effects.filter((e) => e.checkpoint)).toEqual([]);
      expect(effects).toContainEqual({ walls: 'open' });
    });
  }
});

describe('the compactor’s hatch', () => {
  const story = STORIES['ds1-rebel'];
  const step = story.steps.find((s) => s.id === 'compactor-hatch');

  it('opens to its own code: the story neither unlocks it nor finishes on a press of use', () => {
    expect(effectsOf(step).filter((e) => 'unlock' in e || 'lock' in e)).toEqual([]);
    expect(DS1.doors.find((d) => d.id === 'compactor-hatch').lock).toBe('code:3263827');
    const { progress } = playThrough(story, REBEL.slice(0, REBEL.findIndex((e) => e?.type === 'dialled')));
    expect(progress.step).toBe('compactor-hatch');
    let p = progress;
    for (const e of [used('compactor-hatch'), dialled('3263828')]) p = storyStep(p, story, e).progress;
    expect(p.step).toBe('compactor-hatch');
  });

  it('is done on dialling 3263827, the very event that finds the egg', () => {
    const { progress } = playThrough(story, REBEL.slice(0, REBEL.findIndex((e) => e?.type === 'dialled')));
    const dial = dialled('3263827');
    expect(storyStep(progress, story, dial).progress.step).toBe('maint');
    expect(eggsOn(new Set(), dial)).toEqual(['3263827']);
  });
});

// ── the second station ──

const LUKE = { station: 'ds2', side: 'rebel', story: 'ds2-rebel', hero: 'luke', armour: false, helmet: false, flags: new Set() };
// where a script stands just before its first event that `match` picks
const before = (script, match) => script.slice(0, script.findIndex(match));
// the events from a run of them, with the effects they brought
function run(story, progress, events) {
  let p = progress;
  const effects = [];
  for (const e of events) {
    const r = storyStep(p, story, e);
    p = r.progress;
    effects.push(...r.effects);
  }
  return { progress: p, effects };
}

describe('the throne room', () => {
  const story = STORIES['ds2-rebel'];
  const atThrone = () => playThrough(story, REBEL2.slice(0, REBEL2.findIndex((e) => e?.id === 'tower') + 1)).progress;
  const ctx = { ...LUKE, disguise: false, tk: null };

  it('lets you reach for the saber on the armrest at every line until the Emperor offers it himself', () => {
    const { nodes } = TALKS.throne;
    const early = Object.keys(nodes).filter((k) => nodes[k].choices?.some((c) => c.to === 'armrest'));
    expect(early).toEqual(['welcome', 'father', 'faith', 'trap']);
    expect(nodes.weapon.choices.map((c) => c.to)).not.toContain('armrest');
  });

  it('starts the duel at once on pulling it early, and the pull is what finds the armrest egg', () => {
    const progress = atThrone();
    expect(progress.step).toBe('throne');
    const open = openTalk('throne', ctx);
    const pulled = choose(open, open.choices.findIndex((c) => c.startsWith('(Pull')), ctx);
    expect(pulled.effects).toContainEqual({ does: 'pull-saber' });
    const closed = choose(pulled.talk, 0, ctx).effects.map((fx) => fx.event);
    const { progress: after, effects } = run(story, progress, [...pulled.effects.map((fx) => fx.event).filter(Boolean), ...closed]);
    expect(after.step).toBe('duel');
    expect(effects).toContainEqual({ give: 'saber' });
    expect(eggsOn(new Set(), { type: 'pulled', tag: 'armrest-saber' })).toEqual(['armrest']);
  });
});

describe('the duel', () => {
  const story = STORIES['ds2-rebel'];
  const hiding = REBEL2.findIndex((e) => e?.type === 'tick');

  it('sends you back to its first blow if Vader finds you under the stairs, with him spawned afresh', () => {
    const { progress } = playThrough(story, REBEL2.slice(0, hiding + 150));
    expect(progress).toMatchObject({ step: 'duel-wait', down: { 'duel-vader': 1 } });
    const { progress: after, effects } = storyStep(progress, story, { type: 'caught' });
    expect(after.step).toBe('duel');
    // the count of him put down goes with him, so the fight is won only by downing the Vader it brings
    expect(after.down).toEqual({});
    expect(effects[0]).toMatchObject({ say: { who: 'vader' } });
    expect(effects).toContainEqual({ despawn: 'duel-vader' });
    expect(effects).toContainEqual({ checkpoint: expect.objectContaining({ step: 'duel', spot: 'under-stairs', gun: null }) });
    expect(effects.filter((e) => e.spawn?.tag === 'duel-vader')).toHaveLength(1);
    expect(effects).toContainEqual({ give: 'saber' });
  });

  it('turns on “Sister…” once 10 s hidden are over, and no sooner, and goes on against him out on the catwalk', () => {
    expect(playThrough(story, REBEL2.slice(0, hiding + 299)).progress.step).toBe('duel-wait');
    const { progress, effects } = playThrough(story, REBEL2.slice(0, hiding + 300));
    expect(progress.step).toBe('duel-fury');
    expect(effects.filter((e) => e.say?.who === 'vader').map((e) => e.say.text)).toContain('Sister…');
    expect(effects.at(-1)).toEqual({ spawn: expect.objectContaining({ kind: 'vader', spot: 'shaft-edge', tag: 'fury-vader', hostile: true }) });
  });

  for (const picks of [['(Strike him down', '(Look at his', '(Throw'], ['(Throw']]) {
    it(`ends with the saber thrown away however you choose (${picks[0].slice(1)}…)`, () => {
      const { progress } = playThrough(story, REBEL2.slice(0, REBEL2.findIndex((e) => e?.tag === 'fury-vader') + 1));
      expect(progress.step).toBe('duel-choice');
      const { progress: after, effects } = run(story, progress, talk('strike-down', ...picks)(LUKE));
      expect(after.step).toBe('lightning');
      expect(effects).toContainEqual({ take: 'saber' });
    });
  }
});

describe('the lightning', () => {
  const story = STORIES['ds2-rebel'];
  const thrown = REBEL2.findIndex((e) => e?.id === 'throw');

  it('lasts until Vader throws the Emperor down the shaft, and dying under it starts it again', () => {
    const { progress } = playThrough(story, REBEL2.slice(0, thrown - 30 * 10));
    expect(progress.step).toBe('lightning');
    expect(run(story, progress, wait(9.9)).progress.step).toBe('lightning');
    const { progress: after, effects } = storyStep(progress, story, { type: 'died' });
    expect(after.step).toBe('lightning');
    expect(effects).toContainEqual({ despawn: 'emperor' });
    expect(effects).toContainEqual({ spawn: expect.objectContaining({ kind: 'emperor', tag: 'emperor', hostile: true }) });
    expect(playThrough(story, REBEL2.slice(0, thrown)).progress.step).toBe('lightning-throw');
  });
});

describe('carrying Vader', () => {
  const story = STORIES['ds2-rebel'];
  const carrying = () => playThrough(story, before(REBEL2, (e) => e?.spot === 'shuttle-ramp')).progress;

  it('counts the shuttle’s ramp only with him on your shoulders', () => {
    const progress = carrying();
    expect(progress.step).toBe('carry');
    expect(storyStep(progress, story, at('dock', 'shuttle-ramp', [])).progress.step).toBe('carry');
    expect(storyStep(progress, story, at('dock', 'shuttle-ramp', ['vader'])).progress.step).toBe('mask');
  });

  it('allows 119 s and takes you back to the throne room with him at 120 s', () => {
    const progress = carrying();
    expect(playThroughFrom(story, progress, wait(119))).toEqual({ step: 'carry', failed: false });
    expect(playThroughFrom(story, progress, wait(120))).toEqual({ step: 'carry', failed: true });
    const { progress: after, effects } = run(story, progress, wait(120));
    expect(after).toMatchObject({ step: 'carry', t: 0 });
    expect(effects).toContainEqual({ checkpoint: { step: 'carry', spot: 'under-stairs', hero: 'luke', armour: false, helmet: false, companions: [], flags: ['prisoner'], gun: null, items: [] } });
    expect(effects).toContainEqual({ companion: 'vader', follow: true });
    expect(effects).toContainEqual({ flag: 'carrying' });
  });

  it('sets him down at the ramp before the mask comes off, a save there finding him still carried', () => {
    const mask = story.steps.find((s) => s.id === 'mask');
    expect(mask.checkpoint).toMatchObject({ spot: 'shuttle-ramp', companions: ['vader'], flags: ['prisoner', 'carrying', 'breach'] });
    expect(mask.start).toEqual(expect.arrayContaining([{ unflag: 'carrying' }, { companion: 'vader', follow: false }]));
  });
});

describe('the Emperor’s arrival', () => {
  const story = STORIES['ds2-imperial'];
  const inRanks = () => playThrough(story, IMPERIAL2.slice(0, IMPERIAL2.findIndex((e) => e?.spot === 'ranks272') + 1)).progress;

  it('is stood through in the ranks for 40 s, and no less', () => {
    const progress = inRanks();
    expect(progress.step).toBe('ranks');
    expect(storyStep(progress, story, { type: 'still', seconds: 39 }).progress.step).toBe('ranks');
    expect(storyStep(progress, story, { type: 'still', seconds: 40 }).progress.step).toBe('fire');
  });

  it('starts the stand again, in your place, with a reprimand, if you move', () => {
    const { progress, effects } = storyStep(inRanks(), story, { type: 'caught' });
    expect(progress.step).toBe('ranks');
    expect(effects[0]).toMatchObject({ say: { who: 'officer' } });
    expect(effects).toContainEqual({ checkpoint: expect.objectContaining({ step: 'ranks', spot: 'ranks272', hero: 'dstrooper' }) });
    expect(effects).toContainEqual({ scene: 'emperor' });
  });
});

describe('firing at will', () => {
  const story = STORIES['ds2-imperial'];

  it('waits for the order, with “It’s a trap!” in the chatter for the egg', () => {
    const chatter = effectsOf(story.steps.find((s) => s.id === 'fire-wait')).find((e) => e.intercom?.line);
    expect(chatter.intercom).toMatchObject({ section: 'command', line: 'trap' });
    expect(chatter.intercom.text).toContain('It’s a trap!');
    expect(eggsOn(new Set(), { type: 'heard', line: 'trap' })).toEqual(['trap']);
    const { progress } = playThrough(story, IMPERIAL2.slice(0, IMPERIAL2.findIndex((e) => e?.spot === 'firing-switch') + 1));
    expect(progress.step).toBe('fire-wait');
    expect(storyStep(progress, story, used('firing-switch')).progress.step).toBe('fire-wait');
  });

  it('gives 150 s from the firing station to the dock once the reactor is breached', () => {
    const { progress } = playThrough(story, before(IMPERIAL2, (e) => e?.room === 'dock'));
    expect(progress.step).toBe('breach');
    expect(playThroughFrom(story, progress, wait(149))).toEqual({ step: 'breach', failed: false });
    expect(playThroughFrom(story, progress, wait(150))).toEqual({ step: 'breach', failed: true });
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
