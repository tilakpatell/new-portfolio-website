import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WarHud from './WarHud';

// (the war's table as useWar has it, set by each test)
const war = vi.hoisted(() => ({ now: 1_000_000, table: { systems: [] } }));
vi.mock('./useWar', () => ({ useWar: () => war }));

const NOW = 1_000_000;
const hoth = (battle) => ({ id: 'hoth', kind: 'evacuation', battle });
const oath = { war: 'gcw', side: 'rebel' };
const hud = (row) => {
  war.table = { systems: row ? [row] : [] };
  return renderToStaticMarkup(<WarHud sys="hoth" oath={oath} />);
};

describe('the war’s line over the galaxy', () => {
  it('says the battle on here and your part in it, and its clock', () => {
    expect(hud(hoth({ fighting: true, fightEnd: NOW + 125e3, end: NOW + 245e3, attacker: 'empire', defender: 'rebel' }))).toContain('Hold the evacuation · 2:05 left');
  });
  it('says so in the lull between battles: regrouping, and when the next one’s on', () => {
    expect(hud(hoth({ fighting: false, fightEnd: NOW - 5e3, end: NOW + 245e3, attacker: 'empire', defender: 'rebel' }))).toContain('Evacuation: regrouping, the next in 4:05');
  });
  it('is nothing where there’s no battle', () => {
    expect(hud(hoth(null))).toBe('');
    expect(hud(null)).toBe('');
  });
});
