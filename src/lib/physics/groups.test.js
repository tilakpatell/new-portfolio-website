import { describe, expect, it } from 'vitest';
import { GROUPS, MEMBERS, filterOf } from './groups';

const member = (g) => g >>> 16;
const filter = (g) => g & 0xffff;
const meets = (a, b) => (member(a) & filter(b)) !== 0 && (member(b) & filter(a)) !== 0;

describe('GROUPS', () => {
  it('the old three keep their values', () => {
    expect(GROUPS.floor).toBe((1 << 16) | 1);
    expect(GROUPS.object).toBe((3 << 16) | 5);
    expect(GROUPS.bumper).toBe((4 << 16) | 2);
  });

  it('a character meets the floor and another character, not a hurtbox', () => {
    expect(meets(GROUPS.character, GROUPS.floor)).toBe(true);
    expect(meets(GROUPS.character, GROUPS.object)).toBe(true);
    expect(meets(GROUPS.character, GROUPS.character)).toBe(true);
    expect(meets(GROUPS.character, GROUPS.hurtbox)).toBe(false);
    expect(meets(GROUPS.hurtbox, GROUPS.floor)).toBe(false);
  });

  it('a zone meets a character and nothing else by contact', () => {
    expect(meets(GROUPS.zone, GROUPS.character)).toBe(true);
    expect(meets(GROUPS.zone, GROUPS.floor)).toBe(false);
    expect(meets(GROUPS.zone, GROUPS.object)).toBe(false);
  });

  it('filterOf sets those memberships in the filter word, with every membership set', () => {
    const f = filterOf('floor', 'object', 'hurtbox');
    expect(filter(f)).toBe(MEMBERS.floor | MEMBERS.object | MEMBERS.hurtbox);
    expect(member(f)).toBe(0xffff);
    expect(() => filterOf('lasers')).toThrow(/no group/);
  });

  it('every name has a unique membership bit', () => {
    const bits = Object.values(MEMBERS);
    expect(new Set(bits).size).toBe(bits.length);
    for (const b of bits) expect(b & (b - 1)).toBe(0);
    expect(Object.keys(GROUPS)).toEqual(['floor', 'object', 'bumper', 'character', 'hurtbox', 'zone', 'projectile', 'sight']);
  });
});
