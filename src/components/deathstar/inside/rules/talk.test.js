import { describe, expect, it } from 'vitest';
import { TALKS, WHO, choose, openTalk, talkFor, validateTalk } from './talk';

const ctx = (more = {}) => ({ station: 'ds1', side: 'rebel', disguise: false, helmet: false, flags: new Set(), story: null, hero: 'luke', tk: null, ...more });

// Picks the visible choice whose line starts with `start`, so a test reads
// like the conversation and fails loudly if the line is not on offer.
function pick(talk, start, c) {
  const i = talk.choices.findIndex((say) => say.startsWith(start));
  if (i < 0) throw new Error(`no choice starting “${start}” in ${talk.id}/${talk.node}: ${talk.choices.join(' | ')}`);
  return choose(talk, i, c);
}

// Every way through a talk from where it stands: each element is the list
// of effects one path collected, ending where the talk closes.
function paths(talk, c, so = []) {
  if (talk.end) return [so];
  const ways = talk.choices.length ? talk.choices.map((_, i) => i) : [0];
  return ways.flatMap((i) => {
    const { talk: next, effects } = choose(talk, i, c);
    return paths(next, c, [...so, ...effects]);
  });
}

const tree = (nodes, more = {}) => ({ start: 'a', nodes, ...more });

describe('the conversations', () => {
  it('are the twenty-four the stations, the stories and the crew need, and every one validates', () => {
    const ds1 = ['aa23-officer', 'conference', 'ctl-officer', 'droids-trick', 'han-intercom', 'leia-2187', 'librarian', 'technician', 'threepio-comlink', 'trooper-bark'];
    const ds2 = ['jerjerrod', 'jerjerrod-vader', 'st321', 'strike-down', 'throne', 'unmasking', 'vader-lift'];
    const crew = ['dstrooper-bark', 'gonk-gonk', 'gunner-bark', 'mouse-squeal', 'officer-bark', 'pilot-bark', 'royalguard-silent'];
    expect(Object.keys(TALKS).sort()).toEqual([...ds1, ...ds2, ...crew].sort());
    for (const id of ds2) expect(TALKS[id].station, id).toBe('ds2');
    for (const [id, t] of Object.entries(TALKS)) expect([id, validateTalk(t)]).toEqual([id, []]);
  });

  it('name every speaker for the subtitles', () => {
    for (const t of Object.values(TALKS)) for (const node of Object.values(t.nodes)) expect(WHO[node.who]).toMatch(/\S/);
  });

  it('open on the first line with its speaker and choices, and refuse an unknown id', () => {
    const talk = openTalk('ctl-officer', ctx({ disguise: true, helmet: true }));
    expect(talk).toMatchObject({ id: 'ctl-officer', who: 'gantry', say: 'TK-421, why aren’t you at your post?', end: false });
    expect(talk.choices.length).toBeGreaterThan(0);
    expect(openTalk('nobody', ctx())).toBeNull();
  });
});

describe('the rest of the crew', () => {
  it('talk to one who passes for their own, and the droids to anyone; the Royal Guards say nothing', () => {
    const own = ctx({ side: 'imperial' });
    const rebel = ctx({ side: 'rebel' });
    for (const kind of ['officer', 'gunner', 'dstrooper', 'tiepilot']) {
      expect(talkFor({ kind, mode: 'routine' }, own), kind).toMatch(/-bark$/);
      expect(talkFor({ kind, mode: 'routine' }, rebel), kind).toBeNull();
    }
    expect(talkFor({ kind: 'gonk', mode: 'routine' }, rebel)).toBe('gonk-gonk');
    expect(openTalk('royalguard-silent', own).say).toBe('…');
  });
});

describe('the detention officer at AA-23', () => {
  it('asks where the thing is going, and offers the 1138 transfer only with the transfer flag', () => {
    const without = openTalk('aa23-officer', ctx({ disguise: true, helmet: true }));
    expect(without.say).toBe('Where are you taking this… thing?');
    expect(without.choices).not.toContain('Prisoner transfer from cell block 1138.');
    expect(without.choices.length).toBeGreaterThan(0);

    const c = ctx({ disguise: true, helmet: true, flags: new Set(['transfer']) });
    const withFlag = openTalk('aa23-officer', c);
    expect(withFlag.choices).toContain('Prisoner transfer from cell block 1138.');

    const { talk, effects } = pick(withFlag, 'Prisoner transfer', c);
    expect(talk.node).toBe('transfer-1138');
    expect(effects).toContainEqual({ event: { type: 'chose', talk: 'aa23-officer', node: 'transfer-1138', choice: 'transfer-1138' } });
    expect(effects).toContainEqual({ does: 'chewie-loose' });
  });

  it('ignores a choice it never offered', () => {
    const c = ctx();
    const talk = openTalk('aa23-officer', c);
    expect(choose(talk, talk.choices.length, c)).toEqual({ talk, effects: [] });
  });
});

describe('Han on the intercom', () => {
  it('runs the canon lines to “Boring conversation anyway.”, and the last one shoots the panel', () => {
    const c = ctx({ hero: 'han', disguise: true, helmet: true });
    let talk = openTalk('han-intercom', c);
    talk = pick(talk, 'Uh, everything’s under control. Situation normal.', c).talk;
    talk = pick(talk, 'We had a slight weapons malfunction', c).talk;
    expect(talk.choices.some((say) => say.endsWith('How are you?'))).toBe(true);
    talk = choose(talk, talk.choices.findIndex((say) => say.endsWith('How are you?')), c).talk;
    talk = pick(talk, 'Negative, negative. We had a reactor leak here now…', c).talk;
    const last = pick(talk, 'Uh…', c);
    expect(last.talk).toMatchObject({ node: 'boring', who: 'han', say: 'Boring conversation anyway.', end: true });
    expect(last.effects).toContainEqual({ does: 'shoot-panel' });
    expect(last.effects).toContainEqual({ event: { type: 'chose', talk: 'han-intercom', node: 'boring', choice: 'boring' } });
  });

  it('shoots the panel however it goes, and only the canon lines reach “boring”', () => {
    const c = ctx({ hero: 'han', disguise: true, helmet: true });
    const all = paths(openTalk('han-intercom', c), c);
    expect(all.length).toBeGreaterThan(2);
    for (const effects of all) expect(effects.filter((e) => e.does)).toEqual([{ does: 'shoot-panel' }]);
    const boring = all.filter((effects) => effects.some((e) => e.event?.node === 'boring'));
    expect(boring).toHaveLength(1);
  });

  it('closes after the last line, saying where it ended', () => {
    const c = ctx({ hero: 'han' });
    let talk = openTalk('han-intercom', c);
    while (!talk.end) talk = choose(talk, talk.choices.length - 1, c).talk;
    expect(choose(talk, 0, c)).toEqual({ talk: null, effects: [{ event: { type: 'talked', talk: 'han-intercom', node: talk.node } }] });
  });
});

describe('the other conversations', () => {
  it('has Leia ask if you are a little short only with your helmet on', () => {
    expect(openTalk('leia-2187', ctx({ disguise: true, helmet: true })).say).toBe('Aren’t you a little short for a stormtrooper?');
    const bare = openTalk('leia-2187', ctx({ disguise: true, helmet: false }));
    expect(bare.say).not.toMatch(/short/);
    expect(bare.who).toBe('leia');
  });

  it('chokes whoever talks back to Vader in the conference room', () => {
    const c = ctx({ side: 'imperial', hero: 'officer' });
    let talk = openTalk('conference', c);
    while (!talk.choices.length) talk = choose(talk, 0, c).talk;
    const ways = talk.choices.map((_, i) => choose(talk, i, c));
    const faith = ways.find((w) => w.talk.node === 'faith');
    expect(faith.talk).toMatchObject({ who: 'vader', say: 'I find your lack of faith disturbing.', end: true });
    expect(faith.effects).toContainEqual({ does: 'choke' });
    expect(ways.filter((w) => w.effects.some((e) => e.does === 'choke'))).toHaveLength(1);
  });

  it('has Threepio told to shut down the mashers, which stops the walls', () => {
    const c = ctx();
    const talk = openTalk('threepio-comlink', c);
    const { effects } = pick(talk, 'Shut down all the garbage mashers on the detention level!', c);
    expect(effects).toContainEqual({ flag: 'mashers-off' });
    expect(effects).toContainEqual({ does: 'walls-stop' });
  });

  it('has the guards echo the mind trick', () => {
    const c = ctx({ hero: 'obiwan' });
    const { talk } = pick(openTalk('droids-trick', c), 'These aren’t the droids you’re looking for.', c);
    expect(talk).toMatchObject({ who: 'trooper', say: 'These aren’t the droids we’re looking for.' });
  });
});

describe('who talks to you', () => {
  const trooper = { id: 't1', kind: 'stormtrooper', mode: 'routine' };

  it('gives a person their own talk by name or tag, if it fits the station', () => {
    expect(talkFor({ id: 'l', kind: 'leia', mode: 'scripted', talk: 'leia-2187' }, ctx())).toBe('leia-2187');
    expect(talkFor({ id: 'a', kind: 'officer', mode: 'routine', tag: 'aa23-officer' }, ctx({ disguise: true, helmet: true }))).toBe('aa23-officer');
    expect(talkFor({ id: 'j', kind: 'officer', mode: 'routine', tag: 'jerjerrod' }, ctx({ station: 'ds2', side: 'imperial' }))).toBe('jerjerrod');
    expect(talkFor({ id: 'j', kind: 'officer', mode: 'routine', tag: 'jerjerrod' }, ctx({ station: 'ds1', side: 'imperial' }))).toBeNull();
  });

  it('lets a trooper make small talk only with someone who passes for one of theirs', () => {
    expect(talkFor(trooper, ctx({ side: 'imperial', hero: 'trooper' }))).toBe('trooper-bark');
    expect(talkFor(trooper, ctx({ disguise: true, helmet: true }))).toBe('trooper-bark');
    expect(talkFor(trooper, ctx({ disguise: true, helmet: false }))).toBeNull();
    expect(talkFor(trooper, ctx())).toBeNull();
  });

  it('puts the mind trick in Ben’s mouth, and nobody talks mid-fight or dead', () => {
    expect(talkFor(trooper, ctx({ hero: 'obiwan' }))).toBe('droids-trick');
    expect(talkFor({ ...trooper, mode: 'fight' }, ctx({ side: 'imperial' }))).toBeNull();
    expect(talkFor({ ...trooper, mode: 'dead' }, ctx({ side: 'imperial' }))).toBeNull();
    expect(talkFor(null, ctx())).toBeNull();
  });
});

describe('validateTalk', () => {
  const line = (more) => ({ who: 'trooper', say: 'Move along.', ...more });

  it('passes a small sound tree', () => {
    expect(validateTalk(tree({ a: line({ choices: [{ say: 'Yes.', to: 'b' }, { say: 'Hm.', to: 'b', when: { flag: 'x' } }] }), b: line({ end: true }) }))).toEqual([]);
  });

  it('finds a missing target, an unreachable node and a loop with no way out', () => {
    const errors = validateTalk(tree({ a: line({ next: 'b' }), b: line({ choices: [{ say: 'Again.', to: 'a' }, { say: 'Where?', to: 'z' }] }), c: line({ end: true }) }));
    expect(errors.some((e) => e.includes('z'))).toBe(true);
    expect(errors.some((e) => e.includes('c') && e.includes('reach'))).toBe(true);
    expect(errors.some((e) => e.includes('never ends'))).toBe(true);
  });

  it('refuses straight quotes, three dots, a node that is two kinds at once and an unknown speaker', () => {
    expect(validateTalk(tree({ a: line({ say: "It's late.", end: true }) }))).not.toEqual([]);
    expect(validateTalk(tree({ a: line({ say: 'Well...', end: true }) }))).not.toEqual([]);
    expect(validateTalk(tree({ a: line({ next: 'a', end: true }) }))).not.toEqual([]);
    expect(validateTalk(tree({ a: line({ who: 'nobody', end: true }) }))).not.toEqual([]);
  });

  it('refuses a choice that can never be met, and choices that could all be hidden', () => {
    expect(validateTalk(tree({ a: line({ choices: [{ say: 'Yes.', to: 'b', when: { mood: 'happy' } }, { say: 'No.', to: 'b' }] }), b: line({ end: true }) }))).not.toEqual([]);
    expect(validateTalk(tree({ a: line({ choices: [{ say: 'Yes.', to: 'b', when: { flag: 'x' } }] }), b: line({ end: true }) }))).not.toEqual([]);
  });

  it('refuses a start that does something, since opening a talk has no effects', () => {
    expect(validateTalk(tree({ a: line({ does: 'choke', next: 'b' }), b: line({ end: true }) }))).not.toEqual([]);
  });
});
