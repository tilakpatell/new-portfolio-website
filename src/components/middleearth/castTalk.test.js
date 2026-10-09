import { describe, expect, it } from 'vitest';
import { nextLine, promptFor, townTalk } from './castTalk';

const CAST = [
  { id: 'sam', name: 'Samwise Gamgee', x: 2, z: 0, lines: ['One.', 'Two.', 'Three.'] },
  { id: 'rosie', name: 'Rosie Cotton', x: 0, z: -2.4, lines: ['Evening.'] },
  { id: 'gaffer', name: 'The Gaffer', x: 1, z: 1, lines: [] },
];

describe('whom E talks to in a town', () => {
  it('a spot nearer than them wins: nobody’s addressed by a key that opens a door', () => {
    // Sam’s 2 off: a door 1.2 off is E’s, one 2.5 off isn’t
    expect(townTalk(CAST, { x: 0, z: 0 }, { spot: 1.2 })).toBeNull();
    expect(townTalk(CAST, { x: 0, z: 0 }, { spot: { d: 1.2 } })).toBeNull();
    expect(townTalk(CAST, { x: 0, z: 0 }, { spot: 2.5 })?.id).toBe('sam');
    // a spot with no distance always wins
    expect(townTalk(CAST, { x: 0, z: 0 }, { spot: 'bagend' })).toBeNull();
    expect(townTalk(CAST, { x: 0, z: 0 }, { spot: null })?.id).toBe('sam');
  });

  it('the one you face over the nearer, and the nearest when you face no one', () => {
    // facing −z (yaw π/2 in the toys’ convention): Rosie, though Sam’s nearer
    expect(townTalk(CAST, { x: 0, z: 0 }, { facing: Math.PI / 2 })?.id).toBe('rosie');
    // facing −x: nobody in the cone, so the nearest
    expect(townTalk(CAST, { x: 0, z: 0 }, { facing: Math.PI })?.id).toBe('sam');
    // you.yaw when facing isn't given
    expect(townTalk(CAST, { x: 0, z: 0, yaw: Math.PI / 2 })?.id).toBe('rosie');
  });

  it('someone with nothing to say is never addressed; beyond reach, no one', () => {
    expect(townTalk([CAST[2]], { x: 1, z: 1.5 })).toBeNull();
    expect(townTalk(CAST, { x: 10, z: 10 })).toBeNull();
    expect(townTalk(CAST, { x: 0, z: 0 }, { reach: 1.5 })).toBeNull();
  });

  it('gives the person’s id, name and lines', () => {
    expect(townTalk(CAST, { x: 0, z: 0 })).toEqual({ id: 'sam', name: 'Samwise Gamgee', lines: CAST[0].lines });
  });
});

describe('the next line', () => {
  it('goes round the pool, and the count advances', () => {
    const counts = {};
    const said = [0, 1, 2, 3].map(() => nextLine(CAST[0].lines, counts, 'sam', { x: 0, z: 0 }, { ...CAST[0], face: Math.PI }).line);
    expect(said).toEqual(['One.', 'Two.', 'Three.', 'One.']);
    expect(counts.sam).toBe(4);
  });

  it('the bubble says who and what; the body reacts with a talk for the line’s length', () => {
    const counts = { sam: 1 };
    const out = nextLine(CAST[0].lines, counts, 'sam', { x: 0, z: 0 }, CAST[0]);
    expect(out.bubble).toEqual({ id: 'sam', name: 'Samwise Gamgee', line: 'Two.' });
    expect(out.react.event).toBe('say');
    expect(out.react.hold).toBe(1.5);
  });

  it('a bracketed line (what they do) reacts with nothing to say', () => {
    const out = nextLine(['(nods)'], {}, 'x', { x: 0, z: 0 }, { id: 'x', name: 'X', x: 1, z: 0 });
    expect(out.react).toBeNull();
    expect(out.line).toBe('(nods)');
  });

  it('turns the body when you’re past what the neck can turn', () => {
    // Sam faces +x (0); you're at −x of him: behind him
    expect(nextLine(CAST[0].lines, {}, 'sam', { x: 0, z: 0 }, { ...CAST[0], face: 0 }).face).toBe(true);
    // facing you (π: −x)
    expect(nextLine(CAST[0].lines, {}, 'sam', { x: 0, z: 0 }, { ...CAST[0], face: Math.PI }).face).toBe(false);
  });
});

describe('the prompt', () => {
  it('Talk, to the person by name', () => {
    expect(promptFor({ id: 'sam', name: 'Samwise Gamgee' })).toEqual({ verb: 'Talk', thing: 'Samwise Gamgee' });
    expect(promptFor(null)).toBeNull();
  });
});
