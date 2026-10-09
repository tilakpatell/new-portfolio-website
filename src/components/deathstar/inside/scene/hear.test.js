import { describe, expect, it } from 'vitest';
import { newGame } from '../rules/game';
import { HURT, heardOf } from './hear';

const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
const door = [...g.layout.doors.values()].find((d) => d.kind === 'blast');

describe('what the game’s events sound like', () => {
  it('plays a door by its kind where it is, and the lift as it leaves and stops', () => {
    expect(heardOf({ type: 'door', what: 'open', door: door.id }, g)).toEqual([['door', 'blast', { x: door.x, y: door.y + 1.2, z: door.z }]]);
    expect(heardOf({ type: 'door', what: 'denied', door: door.id }, g)).toEqual([]);
    expect(heardOf({ type: 'lift', what: 'leave' }, g)).toEqual([['lift', true]]);
    expect(heardOf({ type: 'lift', what: 'arrive' }, g)).toEqual([['lift', false]]);
  });

  it('fires a shot from where it left, strikes where it hit, and rings a blade on blade', () => {
    const at = { x: 1, y: 1.4, z: 2 };
    expect(heardOf({ type: 'shot', weapon: 'e11', at }, g)).toEqual([['blaster', 'e11', at]]);
    expect(heardOf({ type: 'impact', x: 1, y: 2, z: 3 }, g)).toEqual([['hit', { x: 1, y: 2, z: 3 }]]);
    expect(heardOf({ type: 'deflect', x: 1, y: 2, z: 3 }, g)).toEqual([['clash', { x: 1, y: 2, z: 3 }]]);
    expect(heardOf({ type: 'hit', x: 1, y: 2, z: 3, by: 'blade' }, g)).toEqual([['clash', { x: 1, y: 2, z: 3 }]]);
    // (a tremor rumbles under you, and booms where a panel bursts)
    expect(heardOf({ type: 'quake', size: 0.6, at }, g)).toEqual([['quake', at, 0.6]]);
    expect(heardOf({ type: 'quake', size: 0.6, at: null }, g)).toEqual([['quake', undefined, 0.6]]);
  });

  it('hurts at your own ear, louder the harder the hit, and always heard', () => {
    const [[name, gain, pitch]] = heardOf({ type: 'hurt', amount: 30, what: 'hurt' }, g);
    expect(name).toBe('hurt');
    expect(pitch).toBeGreaterThan(0.8);
    const of = (amount) => heardOf({ type: 'hurt', amount }, g)[0][1];
    expect(of(40)).toBe(1);
    expect(of(80)).toBe(1);
    expect(of(25)).toBeGreaterThan(of(10));
    expect(of(1)).toBeCloseTo(HURT.least, 9);
    expect(gain).toBeGreaterThan(of(10));
  });

  it('sounds the klaxon only for your own section, with the music to match', () => {
    const here = g.layout.rooms.get(g.you.room).section;
    expect(heardOf({ type: 'alert', section: here, level: 'alert' }, g)).toEqual([
      ['alarm', 'alert'],
      ['music', 'alert'],
    ]);
    expect(heardOf({ type: 'alert', section: here, level: 'calm' }, g)).toEqual([
      ['alarm', 'calm'],
      ['music', 'calm'],
    ]);
    expect(heardOf({ type: 'alert', section: 'elsewhere', level: 'alert' }, g)).toEqual([]);
  });

  it('hums the room you walk into, speaks the lines and plays the story’s music', () => {
    expect(heardOf({ type: 'room', to: 'ctl327' }, g)).toEqual([['hum', 'control']]);
    expect(heardOf({ type: 'say', who: 'tarkin', text: 'Evacuate?' }, g)).toEqual([['say', 'tarkin', 'Evacuate?']]);
    expect(heardOf({ type: 'music', mood: 'quiet' }, g)).toEqual([['music', 'quiet']]);
    expect(heardOf({ type: 'tick' }, g)).toEqual([]);
  });

  it('hears a happening with no place given at your own ear, never at nowhere', () => {
    expect(heardOf({ type: 'hit', by: 'you', target: 'x' }, g)).toEqual([['hit', undefined]]);
    expect(heardOf({ type: 'impact', x: NaN, y: 1, z: 2 }, g)).toEqual([['hit', undefined]]);
    expect(heardOf({ type: 'shot', weapon: 'e11' }, g)).toEqual([['blaster', 'e11', undefined]]);
  });
});
