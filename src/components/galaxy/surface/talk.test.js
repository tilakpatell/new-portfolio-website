import { describe, expect, it } from 'vitest';
import { talkFor, talkTree } from './talk';

const ctx = (over = {}) => ({ era: 'gcw', owner: 'empire', side: null, hero: 'luke', done: [], rank: 0, ...over });

describe('what the people say, by the state of things', () => {
  it('a list is itself', () => {
    expect(talkFor(['a', ['Han', 'b']], ctx())).toEqual(['a', ['Han', 'b']]);
    expect(talkFor(null, ctx())).toEqual([]);
  });

  it('a branch picks by every key of `when`', () => {
    const tree = { when: { owner: 'empire', side: 'rebel' }, lines: ['both'], else: { when: { owner: 'empire' }, lines: ['owner only'], else: ['neither'] } };
    expect(talkFor(tree, ctx({ owner: 'empire', side: 'rebel' }))).toEqual(['both']);
    expect(talkFor(tree, ctx({ owner: 'empire', side: 'empire' }))).toEqual(['owner only']);
    expect(talkFor(tree, ctx({ owner: 'rebel', side: 'rebel' }))).toEqual(['neither']);
  });

  it('`done` matches when every id is done', () => {
    const tree = { when: { done: ['han', 'freezing'] }, lines: ['after both'], else: ['before'] };
    expect(talkFor(tree, ctx({ done: ['han'] }))).toEqual(['before']);
    expect(talkFor(tree, ctx({ done: ['freezing', 'han', 'duel'] }))).toEqual(['after both']);
    expect(talkFor(tree, ctx({ done: new Set(['freezing', 'han']) }))).toEqual(['after both']);
  });

  it('`rank` matches at that rank or above; `hero` and `era` by name', () => {
    const tree = { when: { rank: 2 }, lines: ['sir'], else: { when: { hero: 'luke', era: 'gcw' }, lines: ['kid'], else: ['you'] } };
    expect(talkFor(tree, ctx({ rank: 3 }))).toEqual(['sir']);
    expect(talkFor(tree, ctx({ rank: 1 }))).toEqual(['kid']);
    expect(talkFor(tree, ctx({ rank: 1, hero: 'han' }))).toEqual(['you']);
    expect(talkFor(tree, ctx({ rank: 1, era: 'clone' }))).toEqual(['you']);
  });

  it('the deepest matching branch wins', () => {
    const tree = { when: { owner: 'empire' }, lines: { when: { done: ['han'] }, lines: ['empire, after'], else: ['empire, before'] }, else: ['free'] };
    expect(talkFor(tree, ctx({ done: ['han'] }))).toEqual(['empire, after']);
    expect(talkFor(tree, ctx())).toEqual(['empire, before']);
    expect(talkFor(tree, ctx({ owner: 'rebel', done: ['han'] }))).toEqual(['free']);
  });

  it('a tree without `else` at a leaf fails validation; a good one passes and lists every line', () => {
    expect(() => talkTree({ when: { owner: 'empire' }, lines: ['x'] })).toThrow(/else/);
    expect(() => talkTree({ when: { owner: 'empire' }, else: ['x'] })).toThrow(/lines/);
    expect(() => talkTree({ when: { nope: 1 }, lines: ['x'], else: ['y'] })).toThrow(/nope/);
    expect(talkTree({ when: { owner: 'empire' }, lines: ['a', 'b'], else: { when: { side: 'rebel' }, lines: [['Han', 'c']], else: ['d'] } })).toEqual(['a', 'b', ['Han', 'c'], 'd']);
    expect(talkTree(['a'])).toEqual(['a']);
  });
});
