import { describe, expect, it } from 'vitest';
import { battleLines } from './battleLines';
import { CAST, castFor, say } from './warCast';
import { battleSay } from './warVoice';

const none = { points: 0, wins: 0, battles: 0, systems: [], major: false };
const e = (o) => ({ type: 'event', id: 'battle', sub: 'front', side: 'rebel', against: 'empire', war: 'gcw', sys: 'hoth', ...o });

describe('battleSay', () => {
  it('the commander on the comms first, then the crew', () => {
    const ex = battleSay(e({ sub: 'join' }), 'xwing', none);
    const cmd = say(castFor('hoth', 'rebel'), 'join', { rank: 'Flight Cadet' });
    expect(ex.slice(0, cmd.length)).toEqual(cmd);
    expect(ex.slice(cmd.length)).toEqual(battleLines('xwing', { key: 'join', side: 'rebel', war: 'gcw', sys: 'hoth', against: 'empire' }));
  });
  it('the rank by your points for your side', () => {
    const ex = battleSay(e({ sub: 'join' }), 'xwing', { ...none, points: 40 });
    if (castFor('hoth', 'rebel').lines.join.includes('{rank}')) expect(ex[0][1]).toContain('Squadron Leader');
  });
  it('the front’s again line where you’ve fought before this campaign', () => {
    const c = castFor('hoth', 'rebel');
    const ex = battleSay(e({}), 'xwing', { ...none, systems: [{ id: 'hoth', wins: 1, losses: 0 }] });
    if (c.lines.again) expect(ex[0][1]).toBe(c.lines.again.replace('{rank}', 'Flight Cadet'));
  });
  it('Jabba has his say when it’s the Hutts you’re fighting, at the start and the end', () => {
    const ex = battleSay(e({ against: 'hutt', sys: 'tatooine' }), 'falcon', none);
    expect(ex.some(([, , , n]) => n?.name === CAST.jabba.name)).toBe(true);
    expect(battleSay(e({ sub: 'gens', against: 'hutt', sys: 'tatooine' }), 'falcon', none).some(([, , , n]) => n?.name === CAST.jabba.name)).toBe(false);
  });
  it('unsworn: only the crew’s ask; a key nobody has, nothing', () => {
    const ex = battleSay(e({ sub: 'ask', side: null, against: 'empire' }), 'rv', none);
    expect(ex).toEqual(battleLines('rv', { key: 'ask', side: null, war: 'gcw', sys: 'hoth', against: 'empire' }));
    expect(battleSay(e({ sub: 'nothing' }), 'rv', none)).toEqual([]);
  });
});
