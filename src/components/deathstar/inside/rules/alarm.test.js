import { describe, expect, it } from 'vitest';
import { ALARM, createAlarm, levelOf, lockdowns, raise, stepAlarm } from './alarm';
import { DS1 } from './stations/ds1';

const STEP = 1 / 30;
const HERE = { x: 1, y: 0, z: 2 };

// Three sections in a row: the detention block, the corridor outside it
// (one door between them) and a level the lift alone reaches, so it
// neighbours nothing.
function station() {
  const room = (id, section, x) => ({ id, kind: 'corridor', name: id, section, x, z: 0, w: 4, d: 4, y: 0, h: 3 });
  return {
    id: 't',
    name: 'Test',
    era: 'anh',
    sections: { aa23: 'Detention Block AA-23', hall: 'Level 5', deep: 'Level 6' },
    rooms: [room('block', 'aa23', 0), room('corr', 'hall', 4), room('lift', 'deep', 20)],
    doors: [{ id: 'd', a: 'block', b: 'corr', x: 2, z: 0, axis: 'z', w: 2, h: 2.4, kind: 'blast' }],
    lifts: [],
  };
}

// Steps the alarm at 30 Hz from `from` for `seconds`, as the game does,
// and returns everything it said.
function run(alarm, from, seconds) {
  const events = [];
  const steps = Math.round(seconds / STEP);
  for (let k = 1; k <= steps; k++) events.push(...stepAlarm(alarm, STEP, from + k * STEP));
  return events;
}

const levels = (events) => events.filter((e) => e.type === 'level').map((e) => [e.section, e.level]);
const intercoms = (events) => events.filter((e) => e.type === 'intercom').map((e) => [e.section, e.key]);

describe('alarm', () => {
  it('names five levels, lowest first', () => {
    expect(ALARM).toEqual(['calm', 'wary', 'alert', 'lockdown', 'hunt']);
  });

  it('starts every section of the station calm, with nothing locked down', () => {
    const alarm = createAlarm(DS1);
    for (const id of Object.keys(DS1.sections)) expect(levelOf(alarm, id)).toBe('calm');
    expect(lockdowns(alarm)).toEqual(new Set());
    expect(stepAlarm(alarm, STEP, STEP)).toEqual([]);
  });

  it('goes wary at something odd, says so on the next step, and falls back to calm after 20 s', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'hall', 'odd', HERE, 0);
    expect(levelOf(alarm, 'hall')).toBe('wary');
    expect(stepAlarm(alarm, STEP, STEP)).toEqual([{ type: 'level', section: 'hall', level: 'wary' }]);
    expect(levels(run(alarm, STEP, 19.8))).toEqual([]);
    expect(levels(run(alarm, 19.8 + STEP, 0.3))).toEqual([['hall', 'calm']]);
  });

  it('keeps a section wary for 20 s after the last odd thing, not the first', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'hall', 'odd', HERE, 0);
    run(alarm, 0, 15);
    raise(alarm, 'hall', 'odd', HERE, 15);
    expect(levels(run(alarm, 15, 19.8))).toEqual([]);
    expect(levelOf(alarm, 'hall')).toBe('wary');
    expect(levels(run(alarm, 34.8, 0.3))).toEqual([['hall', 'calm']]);
  });

  it('goes to alert when someone is seen, and the intercom names the place', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'seen', HERE, 0);
    expect(levelOf(alarm, 'aa23')).toBe('alert');
    expect(stepAlarm(alarm, STEP, STEP)).toEqual([
      { type: 'level', section: 'aa23', level: 'alert' },
      { type: 'intercom', key: 'alert', section: 'aa23', name: 'Detention Block AA-23', text: 'We have an emergency alert in Detention Block AA-23.' },
    ]);
  });

  it('goes to alert for a camera, a call on the intercom or a body, as for a sighting', () => {
    for (const how of ['camera', 'intercom', 'body']) {
      const alarm = createAlarm(station());
      raise(alarm, 'hall', how, HERE, 0);
      expect(levelOf(alarm, 'hall')).toBe('alert');
    }
  });

  it('turns an alert into a lockdown after 6 s, sealing the section', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'seen', HERE, 0);
    expect(levels(run(alarm, 0, 5.9))).toEqual([['aa23', 'alert']]);
    expect(lockdowns(alarm)).toEqual(new Set());
    const events = run(alarm, 5.9, 0.2);
    expect(levels(events)).toEqual([['aa23', 'lockdown'], ['hall', 'wary']]);
    expect(intercoms(events)).toEqual([['aa23', 'lockdown']]);
    expect(lockdowns(alarm)).toEqual(new Set(['aa23']));
  });

  it('locks down at once on shots, from calm or from alert', () => {
    const calm = createAlarm(station());
    raise(calm, 'aa23', 'shots', HERE, 0);
    expect(levelOf(calm, 'aa23')).toBe('lockdown');
    expect(lockdowns(calm)).toEqual(new Set(['aa23']));
    const alert = createAlarm(station());
    raise(alert, 'aa23', 'seen', HERE, 0);
    run(alert, 0, 1);
    raise(alert, 'aa23', 'shots', HERE, 1);
    expect(levelOf(alert, 'aa23')).toBe('lockdown');
  });

  it('makes the neighbouring sections wary when one locks down, and leaves the rest calm', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'shots', HERE, 0);
    expect(levelOf(alarm, 'hall')).toBe('wary');
    expect(levelOf(alarm, 'deep')).toBe('calm');
    expect(lockdowns(alarm)).toEqual(new Set(['aa23']));
  });

  it('finds the neighbours through the doors of the real station', () => {
    const alarm = createAlarm(DS1);
    raise(alarm, 'bay327', 'shots', HERE, 0);
    expect(levelOf(alarm, 'level2')).toBe('wary');
    expect(levelOf(alarm, 'level5')).toBe('calm');
    expect(levelOf(alarm, 'level6')).toBe('calm');
  });

  it('turns a lockdown into a hunt 10 s after the last sighting, unsealing the section', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'shots', HERE, 0);
    run(alarm, 0, 4);
    raise(alarm, 'aa23', 'seen', { x: 3, y: 0, z: 1 }, 4);
    expect(levels(run(alarm, 4, 9.9))).toEqual([]);
    const events = run(alarm, 13.9, 0.2);
    expect(levels(events)).toEqual([['aa23', 'hunt']]);
    expect(intercoms(events)).toEqual([['aa23', 'search']]);
    expect(lockdowns(alarm)).toEqual(new Set());
    expect(alarm.sections.aa23.at).toEqual({ x: 3, y: 0, z: 1 });
  });

  it('holds a lockdown a full 10 s even when the sighting that began it was earlier', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'seen', HERE, 0);
    run(alarm, 0, 6.1);
    expect(levelOf(alarm, 'aa23')).toBe('lockdown');
    run(alarm, 6.1, 9.8);
    expect(levelOf(alarm, 'aa23')).toBe('lockdown');
    run(alarm, 15.9, 0.2);
    expect(levelOf(alarm, 'aa23')).toBe('hunt');
  });

  it('returns a hunt to lockdown on a fresh sighting', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'shots', HERE, 0);
    run(alarm, 0, 10.1);
    expect(levelOf(alarm, 'aa23')).toBe('hunt');
    raise(alarm, 'aa23', 'camera', HERE, 15);
    expect(levelOf(alarm, 'aa23')).toBe('lockdown');
    const events = stepAlarm(alarm, STEP, 15 + STEP);
    expect(levels(events)).toEqual([['aa23', 'lockdown']]);
    expect(intercoms(events)).toEqual([['aa23', 'lockdown']]);
    expect(lockdowns(alarm)).toEqual(new Set(['aa23']));
  });

  it('keeps hunting through something odd or a body, which are not sightings', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'shots', HERE, 0);
    run(alarm, 0, 10.1);
    raise(alarm, 'aa23', 'odd', HERE, 11);
    raise(alarm, 'aa23', 'body', HERE, 11);
    expect(levelOf(alarm, 'aa23')).toBe('hunt');
  });

  it('stands a hunt down to wary after 60 s unseen, then to calm 20 s later', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'shots', HERE, 0);
    run(alarm, 0, 10.1);
    expect(levelOf(alarm, 'aa23')).toBe('hunt');
    expect(levels(run(alarm, 10.1, 59.8))).toEqual([['hall', 'calm']]);
    const events = run(alarm, 69.9, 0.2);
    expect(levels(events)).toEqual([['aa23', 'wary']]);
    expect(intercoms(events)).toEqual([['aa23', 'standdown']]);
    run(alarm, 70.1, 19.8);
    expect(levelOf(alarm, 'aa23')).toBe('wary');
    expect(levels(run(alarm, 89.9, 0.2))).toEqual([['aa23', 'calm']]);
  });

  it('runs every transition a long step passed over, in the order they fell due', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'seen', HERE, 0);
    const events = stepAlarm(alarm, 200, 200);
    expect(levels(events)).toEqual([
      ['aa23', 'alert'],
      ['aa23', 'lockdown'],
      ['hall', 'wary'],
      ['aa23', 'hunt'],
      ['hall', 'calm'],
      ['aa23', 'wary'],
      ['aa23', 'calm'],
    ]);
  });

  it('never lowers a section for a lesser cause', () => {
    const alarm = createAlarm(station());
    raise(alarm, 'aa23', 'shots', HERE, 0);
    raise(alarm, 'aa23', 'odd', HERE, 1);
    raise(alarm, 'aa23', 'seen', HERE, 1);
    expect(levelOf(alarm, 'aa23')).toBe('lockdown');
  });

  it('keeps the place of the last sighting, not a live reference to whoever was seen', () => {
    const alarm = createAlarm(station());
    const you = { x: 3, z: 1 };
    raise(alarm, 'aa23', 'seen', you, 0);
    you.x = 50;
    you.z = 60;
    expect(alarm.sections.aa23.at).toEqual({ x: 3, y: 0, z: 1 });
  });

  it('ignores a section the station doesn’t have, and refuses a cause it doesn’t know', () => {
    const alarm = createAlarm(station());
    expect(raise(alarm, 'nowhere', 'seen', HERE, 0)).toBe(null);
    expect(stepAlarm(alarm, STEP, STEP)).toEqual([]);
    expect(() => raise(alarm, 'hall', 'rumour', HERE, 0)).toThrow(/rumour/);
  });
});
