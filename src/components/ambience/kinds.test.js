import { describe, expect, it } from 'vitest';
import { COMPANIES, FAMILY, companyFor, familyFor, showsOn } from './kinds';
import { FAN_THEMES, THEMES, THEME_ORDER } from '../../theme/themes';

describe('ambience kinds', () => {
  it('gives every fan theme a family', () => {
    for (const { id } of FAN_THEMES) expect(familyFor(id), id).toBeTruthy();
  });

  it('only names themes that exist', () => {
    for (const id of Object.keys(FAMILY)) expect(THEMES[id], id).toBeTruthy();
  });

  it('leaves the company and project themes alone', () => {
    for (const id of ['aws', 'rtx', 'bose', 'pendar', 'empowerreg', 'src', 'gameboy', 'travel', 'custom']) expect(familyFor(id)).toBeNull();
  });

  it('gives every company theme its quiet motif, and nothing else one', () => {
    expect([...COMPANIES].sort()).toEqual([...THEME_ORDER].sort());
    for (const id of THEME_ORDER) expect(companyFor(id)).toBe(id);
    for (const id of ['jedi', 'gameboy', 'travel', 'custom']) expect(companyFor(id)).toBeNull();
  });

  it('shows on the portfolio pages and nowhere else', () => {
    for (const p of ['/home', '/experience', '/experience/aws', '/projects', '/projects/gameboy-emulator', '/resume', '/contact', '/travel']) expect(showsOn(p), p).toBe(true);
    for (const p of ['/', '/universe', '/universe/home', '/galaxy', '/deathstar', '/middle-earth', '/avengers', '/terminal', '/homeward', '', null]) expect(showsOn(p), String(p)).toBe(false);
  });
});
