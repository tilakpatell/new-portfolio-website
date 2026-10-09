import { describe, expect, it } from 'vitest';
import * as ai from './index';
import { createGreeter, onTalk, talkTarget } from './talk';

const you = { x: 0, z: 0 };
const lines = ['Hello there.'];

describe('talkTarget: whom E talks to', () => {
  it('the nearest within reach, without a facing', () => {
    const people = [
      { id: 'a', x: 2.5, z: 0, lines },
      { id: 'b', x: 0, z: 1.2, lines },
      { id: 'c', x: 4, z: 0, lines },
    ];
    expect(talkTarget(people, you)?.id).toBe('b');
    expect(talkTarget([{ id: 'c', x: 4, z: 0, lines }], you)).toBe(null);
  });

  it('the one you face within the cone, else the nearest', () => {
    // yaw 0 faces +x; + turns left, toward −z
    const people = [
      { id: 'ahead', x: 2.5, z: 0, lines },
      { id: 'side', x: 0, z: 1, lines },
    ];
    expect(talkTarget(people, you, { facing: 0 })?.id).toBe('ahead');
    expect(talkTarget(people, { ...you, yaw: 0 })?.id).toBe('ahead');
    expect(talkTarget(people, you, { facing: -Math.PI / 2 })?.id).toBe('side');
    // facing away from both: the nearest
    expect(talkTarget(people, you, { facing: Math.PI })?.id).toBe('side');
  });

  it('a person’s own reach beats the default', () => {
    expect(talkTarget([{ id: 'jabba', x: 6, z: 0, reach: 8, lines }], you)?.id).toBe('jabba');
  });

  it('no lines, no target', () => {
    for (const l of [undefined, [], 0]) expect(talkTarget([{ id: 'mute', x: 1, z: 0, lines: l }], you)).toBe(null);
    expect(talkTarget([{ id: 'many', x: 1, z: 0, lines: 3 }], you)?.id).toBe('many');
  });

  it('someone on another floor is skipped', () => {
    expect(talkTarget([{ id: 'up', x: 1, z: 0, y: 5, lines }], { ...you, y: 0 })).toBe(null);
    expect(talkTarget([{ id: 'step', x: 1, z: 0, y: 1, lines }], { ...you, y: 0 })?.id).toBe('step');
  });

  it('nothing to pick from is null, and nothing throws', () => {
    expect(talkTarget([], you)).toBe(null);
    expect(talkTarget(null, you)).toBe(null);
    expect(talkTarget([{ id: 'a', x: 1, z: 0, lines }], null)).toBe(null);
  });
});

describe('onTalk: the line, and what the body does', () => {
  const person = { id: 'g', x: 1, z: 0, face: Math.PI, lines: ['One.', 'Two.', '(nods)'] };

  it('goes round the lines, n the next to store', () => {
    const a = onTalk(person, you);
    expect(a.line).toBe('One.');
    expect(a.n).toBe(1);
    const b = onTalk({ ...person, said: a.n }, you);
    expect(b.line).toBe('Two.');
    expect(onTalk({ ...person, said: 3 }, you).line).toBe('One.');
    expect(onTalk(person, you, { said: 4 }).line).toBe('Two.');
  });

  it('holds 1.5 s for a short line, 6 for a long one, the length over 14 between', () => {
    expect(onTalk({ ...person, lines: ['Hi.'] }, you).react.hold).toBe(1.5);
    expect(onTalk({ ...person, lines: ['x'.repeat(200)] }, you).react.hold).toBe(6);
    expect(onTalk({ ...person, lines: ['x'.repeat(42)] }, you).react.hold).toBeCloseTo(3, 6);
  });

  it('reacts with a say at your eyes', () => {
    const r = onTalk(person, { x: 0, z: 0, y: 0.5 }).react;
    expect(r).toEqual({ event: 'say', hold: 1.5, target: { x: 0, y: 2.05, z: 0 } });
    expect(onTalk(person, { x: 0, z: 0, eyes: 1.2 }).react.target.y).toBeCloseTo(1.2, 6);
  });

  it('a bracketed line says nothing on the body but still looks', () => {
    const r = onTalk({ ...person, face: 0 }, you, { said: 2 });
    expect(r.line).toBe('(nods)');
    expect(r.react).toBe(null);
    expect(r.face).toBe(true);
    expect(r.look).toEqual({ x: 0, y: 1.55, z: 0 });
  });

  it('looks at your eyes on every line, beside the reaction', () => {
    const r = onTalk(person, { x: 0.5, z: -1, y: 0.5 });
    expect(r.look).toEqual({ x: 0.5, y: 2.05, z: -1 });
    expect(r.react.target).toEqual(r.look);
    expect(onTalk({ id: 'mute', x: 1, z: 0 }, you).look).toEqual({ x: 0, y: 1.55, z: 0 });
  });

  it('a count of lines: the index for the line, the caller’s hold, else 2 s', () => {
    const counted = { id: 'n', x: 1, z: 0, lines: 3 };
    const a = onTalk(counted, you, { said: 4 });
    expect(a.line).toBe(1);
    expect(a.react).toEqual({ event: 'say', hold: 2, target: { x: 0, y: 1.55, z: 0 } });
    expect(onTalk(counted, you, { hold: 4.5 }).react.hold).toBe(4.5);
    // a list's hold is its line's, whatever the caller says
    expect(onTalk({ ...counted, lines: ['Hi.'] }, you, { hold: 4.5 }).react.hold).toBe(1.5);
  });

  it('faces you past what the neck can turn', () => {
    // you at the person's −x: the way to you is yaw π
    expect(onTalk({ ...person, face: Math.PI - 1.2 }, you).face).toBe(true);
    expect(onTalk({ ...person, face: Math.PI - 0.9 }, you).face).toBe(false);
    expect(onTalk({ ...person, face: -Math.PI + 0.9 }, you).face).toBe(false); // (round the wrap)
  });

  it('a person with no lines gives no line and no reaction', () => {
    const r = onTalk({ id: 'mute', x: 1, z: 0 }, you);
    expect(r.line).toBe(null);
    expect(r.react).toBe(null);
  });
});

describe('createGreeter', () => {
  it('greets once per approach, armed again past far', () => {
    const g = createGreeter({ near: 2.8, far: 4.5 });
    expect(g(6)).toBe(false);
    expect(g(2.5)).toBe(true);
    expect(g(2)).toBe(false);
    expect(g(3.5)).toBe(false);
    expect(g(2)).toBe(false);
    expect(g(5)).toBe(false);
    expect(g(2.7)).toBe(true);
    expect(g(NaN)).toBe(false);
  });

  it('is named by the toolkit, with the rest', () => {
    expect(ai.talk.talkTarget).toBe(talkTarget);
    expect(ai.talkTarget).toBe(talkTarget);
    expect(ai.onTalk).toBe(onTalk);
    expect(ai.createGreeter).toBe(createGreeter);
  });
});
