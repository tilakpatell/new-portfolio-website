import { describe, expect, it } from 'vitest';
import { newTalk, talkNode, talkOn } from '../../middleearth/towns/talk';
import { NAZGUL } from '../../middleearth/towns/bree/story';
import { CONVOS, COPS, QUESTS, SEAL, SPEAKERS, citadelProgress } from './story';

const THREE = ['daycare', 'wafers', 'council'];

// every way through a conversation: the ends it can reach
function ends(convo) {
  const out = new Set();
  const seen = new Set();
  const queue = [newTalk(convo)];
  while (queue.length) {
    const t = queue.shift();
    if (t.end) {
      out.add(t.end);
      continue;
    }
    if (seen.has(t.at)) continue;
    seen.add(t.at);
    const node = talkNode(convo, t);
    if (node?.choices) node.choices.forEach((_, i) => queue.push(talkOn(convo, t, i)));
    else queue.push(talkOn(convo, t));
  }
  return { out, seen };
}

describe('the Citadel’s story', () => {
  it('goes Day Care, wafers and the Council in any order, then the vote, then the cruiser', () => {
    const p0 = citadelProgress([]);
    expect(p0.next).toBe('daycare');
    expect(p0.mood).toBe('day');
    expect(p0.quests.filter((q) => q.open).map((q) => q.id)).toEqual(THREE);
    expect(citadelProgress(['council']).next).toBe('daycare');
    const p3 = citadelProgress(THREE);
    expect(p3.next).toBe('votemorty');
    expect(p3.mood).toBe('election');
    const p4 = citadelProgress([...THREE, 'votemorty']);
    expect(p4.mood).toBe('red');
    expect(p4.next).toBe('citadelout');
    const p5 = citadelProgress([...THREE, 'votemorty', 'citadelout']);
    expect(p5.finished).toBe(true);
    expect(p5.mood).toBe('day');
    expect(citadelProgress(['votemorty']).done).toEqual([]);
  });
  it('words an objective for every step, and the end', () => {
    for (const q of QUESTS) expect(q.go.length).toBeGreaterThan(20);
    expect(citadelProgress([]).objective).toBe(QUESTS[0].go);
    expect(citadelProgress([...THREE, 'votemorty', 'citadelout']).objective).toMatch(/Portal home/);
  });
  it('gives each quest its seal', () => {
    expect(Object.keys(SEAL)).toEqual(QUESTS.map((q) => q.id));
    expect(Object.values(SEAL)).toEqual(['daycare', 'wafers', 'council', 'votemorty', 'citadelout']);
  });
  it('has conversations that hang together and can be won', () => {
    for (const [name, convo] of Object.entries(CONVOS)) {
      for (const [id, node] of Object.entries(convo.nodes)) {
        if (node.next) expect(convo.nodes[node.next], `${name}.${id} → ${node.next}`).toBeDefined();
        for (const c of node.choices ?? []) expect(convo.nodes[c.to], `${name}.${id} → ${c.to}`).toBeDefined();
        expect(SPEAKERS[node.who], `${name}.${id} speaker ${node.who}`).toBeDefined();
      }
      const { out, seen } = ends(convo);
      expect(out.has('won'), name).toBe(true);
      expect(out.has('lost'), name).toBe(false);
      expect(seen.size, `${name}: every node reached`).toBe(Object.keys(convo.nodes).length);
    }
  });
  it('holds C-137 in contempt for a wrong answer, and asks again', () => {
    const c = CONVOS.council;
    const first = c.nodes[c.start].choices ? c.start : null;
    const ask = first ?? Object.keys(c.nodes).find((id) => c.nodes[id].choices);
    const back = c.nodes[ask].choices.some((ch) => {
      let t = { at: ch.to, end: null };
      for (let i = 0; i < 4 && !t.end; i++) {
        if (t.at === ask) return true;
        if (c.nodes[t.at].choices) return false;
        t = talkOn(c, t);
      }
      return t.at === ask;
    });
    expect(back).toBe(true);
  });
  it('lets every ballot be cast, and Candidate Morty wins whatever', () => {
    const c = CONVOS.ballot;
    const ask = Object.keys(c.nodes).find((id) => c.nodes[id].choices);
    for (let i = 0; i < c.nodes[ask].choices.length; i++) {
      let t = talkOn(c, { at: ask, end: null }, i);
      for (let k = 0; k < 6 && !t.end; k++) t = talkOn(c, t);
      expect(t.end).toBe('won');
    }
  });
  it('sends the Cop Ricks out like Bree’s Nazgûl, without a Ring to see', () => {
    expect(Object.keys(COPS).sort()).toEqual(Object.keys(NAZGUL).sort());
    expect(COPS.ringSight).toBe(0);
  });
});
