import { describe, expect, it } from 'vitest';
import { furnish } from '../furnish';
import { STEP, alertOf, drain, newGame, objectiveOf, promptOf, step, teleport } from '../game';

const STILL = { dir: { x: 0, z: 0 }, yaw: 0, pitch: 0 };
function play(g, input, seconds, each) {
  const out = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    step(g, typeof input === 'function' ? input(g) : input);
    const ev = drain(g);
    out.push(...ev);
    each?.(g, ev);
  }
  return out;
}
const of = (events, type) => events.filter((e) => e.type === type);
const yawTo = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));
const pitchTo = (from, to) => Math.atan2((to.y ?? 0) + 1.2 - (from.y + 1.45), Math.hypot(to.x - from.x, to.z - from.z));

describe('the station with its people aboard', () => {
  it('has its garrison aboard in free roam, and troopers on Bay 327’s deck', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    expect(g.crew.people.length).toBeGreaterThanOrEqual(25);
    expect(g.crew.people.filter((p) => p.room === 'bay327' && p.kind === 'stormtrooper').length).toBeGreaterThanOrEqual(3);
  });

  it('lets an Imperial walk the bay among them without a shot fired', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    const events = play(g, { ...STILL, dir: { x: 0, z: -1 } }, 6);
    expect(of(events, 'shot')).toEqual([]);
    expect(alertOf(g).level).toBe('calm');
  });

  it('fights an undisguised Rebel the garrison sees: the alarm goes up and the troopers shoot', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    teleport(g, 'bay327', 10, -10);
    const events = play(g, STILL, 8);
    expect(of(events, 'saw').some((e) => e.target === 'you')).toBe(true);
    expect(of(events, 'shot').some((e) => e.by !== 'you')).toBe(true);
    expect(['alert', 'lockdown', 'hunt']).toContain(alertOf(g).level);
  });

  it('puts a trooper down with enough shots, and tells the story who fell', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    const target = g.crew.people.find((p) => p.room === 'bay327' && p.kind === 'stormtrooper');
    teleport(g, 'bay327', target.x + Math.sin(target.yaw) * 5, target.z - Math.cos(target.yaw) * 5);
    g.you.hp = 1e6;
    const events = play(g, (gg) => ({ ...STILL, yaw: yawTo(gg.you, target), pitch: pitchTo(gg.you, target), fire: true, aim: true }), 6);
    expect(of(events, 'shot').filter((e) => e.by === 'you').length).toBeGreaterThan(3);
    expect(of(events, 'died').map((e) => e.id)).toContain(target.id);
  });

  it('lets far-off people sleep where they stand', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    const far = g.crew.people.find((p) => p.room === 'firecontrol');
    const at = { x: far.x, z: far.z };
    play(g, STILL, 10);
    expect({ x: far.x, z: far.z }).toEqual(at);
  });
});

describe('talking and using', () => {
  it('opens a talk with someone in front of you on E, and picking a line moves it on', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
    const tech = g.crew.people.find((p) => p.kind === 'librarian');
    teleport(g, tech.room, tech.x + Math.sin(tech.yaw) * 1.3, tech.z - Math.cos(tech.yaw) * 1.3, tech.yaw + Math.PI);
    expect(promptOf(g)?.use).toBe(true);
    play(g, { ...STILL, yaw: g.you.yaw, use: true }, STEP);
    expect(g.talk?.id).toBe('librarian');
    for (let k = 0; k < 8 && g.talk; k++) play(g, { ...STILL, yaw: g.you.yaw, choice: 0 }, STEP);
    expect(g.talk).toBeNull();
  });

  it('opens the compactor’s hatch to its number on the keypad, and finds the egg', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    const hatch = furnish(g.layout.rooms.get('compactor'), g.layout.station).props.find((p) => p.tag === 'compactor-hatch');
    teleport(g, 'compactor', hatch.x + Math.sin(hatch.yaw) * 1.2, hatch.z - Math.cos(hatch.yaw) * 1.2, hatch.yaw + Math.PI);
    play(g, { ...STILL, yaw: g.you.yaw, use: true }, STEP);
    expect(g.talk?.id).toBe('keypad');
    const events = play(g, { ...STILL, yaw: g.you.yaw, choice: 0 }, STEP);
    expect(of(events, 'dialled')).toEqual([{ type: 'dialled', code: '3263827' }]);
    expect(of(events, 'achievement')).toContainEqual({ type: 'achievement', id: 'ds-3263827' });
    const door = [...g.layout.doors.values()].find((d) => d.lock === 'code:3263827');
    expect(g.doors[door.id].locked).toBe(false);
  });
});

describe('the story over the station', () => {
  it('starts the first Death Star’s Rebel story lying low in the hold, and moves on once the search is over', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', seed: 3 });
    expect(g.you.room).toBe('hold');
    expect(objectiveOf(g)).toMatch(/smuggling hold/);
    play(g, { ...STILL, crouch: true }, 27);
    expect(g.plot.progress.step).toBe('ambush');
  });

  it('sends you back to the start of the beat if you move while the hold is searched', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', seed: 3 });
    play(g, { ...STILL, crouch: true }, 4);
    const events = play(g, { ...STILL, dir: { x: 0, z: 1 }, run: true }, 6);
    expect(g.plot.progress.step).toBe('scan');
    expect(events.some((e) => e.type === 'say' && /hands where I can see them/.test(e.text))).toBe(true);
  });
});
