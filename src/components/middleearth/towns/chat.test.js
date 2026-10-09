import { describe, expect, it } from 'vitest';
import { chatFrame, chatTo, KEEP } from './chat';
import { makeToyFigure } from '../mapFigures';

const CAST = [
  { id: 'sam', name: 'Samwise Gamgee', x: 2, z: 0, face: Math.PI, lines: ['One.', 'Two.'] },
  { id: 'rosie', name: 'Rosie Cotton', x: 0, z: -2.4, face: 0, lines: ['Evening.'] },
];
const sim = (x = 0, z = 0, face = 0) => ({ h: { x, z, face } });

describe('a town’s talk, frame by frame', () => {
  it('names whom E would talk to, and says when that changes', () => {
    const s = sim();
    const seen = [];
    chatFrame(s, CAST, { onWho: (w) => seen.push(w) });
    expect(s.towho.id).toBe('sam');
    chatFrame(s, CAST, { onWho: (w) => seen.push(w) });
    expect(seen).toEqual([{ id: 'sam', name: 'Samwise Gamgee' }]);
    // a spot nearer: nobody, and the prompt's told
    s.near = 'bagend';
    chatFrame(s, CAST, { spot: 1, onWho: (w) => seen.push(w) });
    expect(s.towho).toBeNull();
    expect(s.near).toBe('bagend');
    expect(seen.at(-1)).toBeNull();
    // a spot further off than Sam: Sam, and the spot's prompt goes
    chatFrame(s, CAST, { spot: 2.5 });
    expect(s.towho.id).toBe('sam');
    expect(s.near).toBeNull();
  });

  it('E to a toy (the cast not here): the line and the bubble all the same, the body’s part a no-op', () => {
    const s = sim();
    chatFrame(s, CAST);
    const counts = {};
    const toy = makeToyFigure();
    const said = chatTo(s, counts, toy);
    expect(said.bubble).toEqual({ id: 'sam', name: 'Samwise Gamgee', line: 'One.' });
    expect(chatTo(s, counts, toy).line).toBe('Two.');
    expect(s.chat).toBe('sam');
    expect(chatTo(s, counts, null).line).toBe('One.');
  });

  it('nobody to talk to, E says nothing', () => {
    const s = sim(20, 20);
    chatFrame(s, CAST);
    expect(chatTo(s, {}, null)).toBeNull();
    expect(s.chat).toBeUndefined();
  });

  it('the conversation’s over once you walk off, or stop walking', () => {
    const s = sim();
    chatFrame(s, CAST);
    chatTo(s, {}, null);
    let ended = 0;
    s.h.x = 2 - KEEP + 0.1;
    chatFrame(s, CAST, { onEnd: () => ended++ });
    expect(s.chat).toBe('sam');
    s.h.x = 2 - KEEP - 0.1;
    chatFrame(s, CAST, { onEnd: () => ended++ });
    expect(s.chat).toBeNull();
    expect(ended).toBe(1);
    s.h.x = 0;
    chatFrame(s, CAST);
    chatTo(s, {}, null);
    chatFrame(s, CAST, { walking: false, onEnd: () => ended++ });
    expect(s.chat).toBeNull();
    expect(ended).toBe(2);
  });
});
