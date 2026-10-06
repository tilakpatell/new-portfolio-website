import { describe, expect, it } from 'vitest';
import { newTalk, talkNode, talkOn } from '../talk';
import { CONVOS, QUESTS, SPEAKERS, minasProgress } from './story';

describe('the story', () => {
  it('starts with the ride, on the road', () => {
    const p = minasProgress([]);
    expect(p.next).toBe('ride');
    expect(p.zone).toBe('ride');
    expect(p.day).toBe(false);
    expect(p.livery).toBe(false);
  });
  it('goes where each step is', () => {
    const zones = QUESTS.map((q, i) => minasProgress(QUESTS.slice(0, i).map((x) => x.id)).zone);
    expect(zones).toEqual(['ride', 'court', 'court', 'beacon', 'walls', 'court']);
  });
  it('puts Pippin in the livery once he is sworn, and makes it day at the end', () => {
    expect(minasProgress(['ride', 'court', 'steward']).livery).toBe(true);
    expect(minasProgress(['ride', 'court', 'steward', 'beacon', 'walls']).day).toBe(true);
    const end = minasProgress(QUESTS.map((q) => q.id));
    expect(end.finished).toBe(true);
    expect(end.zone).toBe('court');
  });
  it('cannot skip ahead', () => {
    expect(minasProgress(['beacon', 'walls']).done).toEqual([]);
  });
});

describe('the talk', () => {
  it('every conversation can be walked to its end, by every choice', () => {
    for (const [id, convo] of Object.entries(CONVOS)) {
      const walk = (talk, depth = 0) => {
        expect(depth, id).toBeLessThan(30);
        const node = talkNode(convo, talk);
        expect(node, `${id}:${talk.at}`).toBeTruthy();
        expect(Object.keys(SPEAKERS), `${id}:${talk.at}`).toContain(node.who);
        if (node.end) return expect(talkOn(convo, talk).end).toBe('won');
        if (node.choices) return node.choices.forEach((_, i) => walk(talkOn(convo, talk, i), depth + 1));
        return walk(talkOn(convo, talk), depth + 1);
      };
      walk(newTalk(convo));
    }
  });
});
