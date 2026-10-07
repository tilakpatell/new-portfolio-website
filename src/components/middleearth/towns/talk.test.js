import { describe, expect, it } from 'vitest';
import { newTalk, personVoice, talkNode, talkOn } from './talk';

const GATE = {
  start: 'ask',
  nodes: {
    ask: { who: 'harry', say: 'What’s your business in Bree?', choices: [{ text: 'The Prancing Pony.', to: 'right' }, { text: 'None of yours.', to: 'wrong' }] },
    right: { who: 'harry', say: 'Hobbits!', next: 'open' },
    open: { who: 'harry', say: 'Welcome to Bree.', end: 'won' },
    wrong: { who: 'harry', say: 'Then you can stay out there.', end: 'lost' },
  },
};

describe('a conversation', () => {
  it('starts at its start', () => {
    const t = newTalk(GATE);
    expect(talkNode(GATE, t).say).toBe('What’s your business in Bree?');
    expect(t.end).toBeNull();
  });
  it('goes where the choice says, then on, to its end', () => {
    let t = talkOn(GATE, newTalk(GATE), 0);
    expect(t.at).toBe('right');
    t = talkOn(GATE, t);
    expect(t.at).toBe('open');
    t = talkOn(GATE, t);
    expect(t.end).toBe('won');
  });
  it('can end badly', () => {
    let t = talkOn(GATE, newTalk(GATE), 1);
    t = talkOn(GATE, t);
    expect(t.end).toBe('lost');
  });
  it('waits for a choice where there is one, and stays put after its end', () => {
    const t = newTalk(GATE);
    expect(talkOn(GATE, t)).toEqual(t);
    expect(talkOn(GATE, t, 5)).toEqual(t);
    const done = { at: 'open', end: 'won' };
    expect(talkOn(GATE, done)).toEqual(done);
  });
});

describe('whose voice someone you walk up to speaks in', () => {
  it('is their id without the scene it is for', () => {
    expect(personVoice('gimli-wood')).toBe('gimli');
    expect(personVoice('strider-dawn')).toBe('strider');
    expect(personVoice('harry')).toBe('harry');
  });
  it('is no one for the ones who say nothing aloud', () => {
    expect(personVoice('trolls')).toBeNull();
    expect(personVoice('carrot')).toBeNull();
    expect(personVoice(null)).toBeNull();
  });
});
