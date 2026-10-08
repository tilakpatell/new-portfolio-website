import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattleEndCard } from './BattleEnd';
import { cardTime, endCard } from './warText';

// the battle you were in, over, as warfront.js's info has it
const over = (o = {}) => ({
  team: 1,
  laid: { attacker: 1 },
  on: { id: 'c0.gcw.hoth.3', sides: ['rebel', 'empire'], end: 0 },
  result: { winner: 1, why: 'flagship', at: 400, ago: 1, yours: { kills: 3, objectives: 1, intercepts: 0, points: 13.3 } },
  ...o,
});

describe('the end card', () => {
  it('says Victory or Defeat, why in words, what you did and the points it got you', () => {
    const out = renderToStaticMarkup(<BattleEndCard card={endCard(over())} />);
    expect(out).toContain('Victory');
    expect(out).toContain('The reactor went');
    expect(out).toContain('3 kills · 1 objective');
    expect(out).toContain('+13 points');
    expect(out).toContain('data-tone="won"');
    expect(out).toContain('role="status"');
    expect(renderToStaticMarkup(<BattleEndCard card={endCard(over({ team: 0 }))} />)).toContain('Defeat');
  });
  it('shows for eight seconds from the end, and not at all to a pilot who came after', () => {
    expect(cardTime(over())).toBeCloseTo(7, 6);
    expect(cardTime(over({ result: { ...over().result, ago: 12 } }))).toBe(0);
    expect(cardTime(over({ result: null }))).toBe(0);
    expect(cardTime(null)).toBe(0);
  });
});
