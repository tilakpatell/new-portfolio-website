import { describe, expect, it } from 'vitest';
import { passable, unlock } from './doors';
import { STEP, drain, newGame, promptOf, step, teleport, ticksFor } from './game';
import { blank } from './save';
import { createBody } from './walker';

const STILL = { dir: { x: 0, z: 0 }, yaw: 0, pitch: 0 };
const NORTH = { ...STILL, dir: { x: 0, z: -1 } };

// steps the game for `seconds` with the same input every step
function play(g, input, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(g, input);
}

describe('the clock', () => {
  it('runs at most four steps in a frame and drops the rest of a long one', () => {
    expect(ticksFor(1)).toEqual({ ticks: 4, left: 0 });
    // a hidden tab coming back after seconds
    expect(ticksFor(5, 0.02)).toEqual({ ticks: 4, left: 0 });
  });

  it('carries what is left of a frame over to the next', () => {
    const t = ticksFor(0.04, 0);
    expect(t.ticks).toBe(1);
    expect(t.left).toBeCloseTo(0.0067, 4);
    expect(ticksFor(0.02, 0.02).ticks).toBe(1);
    expect(ticksFor(0.016, 0)).toEqual({ ticks: 0, left: 0.016 });
  });
});

describe('a new game', () => {
  it('puts a DS1 Rebel in the freighter’s smuggling hold', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', hero: 'luke', seed: 1 });
    expect(g.station).toBe('ds1');
    expect(g.you.room).toBe('hold');
    expect(g.you).toMatchObject({ hp: 100, heat: 0, hero: 'luke', armour: false });
    expect(g.seen.has('hold')).toBe(true);
  });

  it('lowers the ramp, so the hold’s hatch opens and the Rebel can leave', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 1 });
    play(g, STILL, 1);
    expect(passable(g.doors, 'hold-hatch')).toBe(true);
  });

  it('puts an Imperial on the bay’s deck as a stormtrooper with an E-11', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'story', seed: 1 });
    expect(g.you.room).toBe('bay327');
    expect(g.you).toMatchObject({ hero: 'stormtrooper', armour: true, helmet: true, gun: 'e11' });
  });

  it('remembers the rooms seen on earlier visits, and only rooms the station has', () => {
    const save = blank();
    save.ds1.seen = ['ctl327', 'cell2187-from-the-future'];
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1, save });
    expect([...g.seen].sort()).toEqual(['bay327', 'ctl327']);
  });

  it('draws the same numbers from the same seed', () => {
    const a = newGame({ seed: 7 });
    const b = newGame({ seed: 7 });
    expect([a.rand(), a.rand()]).toEqual([b.rand(), b.rand()]);
  });
});

describe('walking the station', () => {
  it('takes an Imperial walking north from the bay through the blast door into the corridor', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
    play(g, NORTH, 5);
    expect(drain(g).filter((e) => e.type === 'room')).toContainEqual({ type: 'room', from: 'bay327', to: 'corr327' });
    expect(g.you.room).toBe('corr327');
    expect(g.seen.has('corr327')).toBe(true);
  });

  it('keeps an undisguised Rebel in the bay at that door, and says it is for Imperials', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 1 });
    teleport(g, 'bay327', 10, -19.5);
    play(g, NORTH, 5);
    expect(g.you.room).toBe('bay327');
    // (in free roam, with the way through said: Docking Control's scomp link opens it)
    expect(promptOf(g)).toEqual({ text: 'Imperial personnel only: a scomp link would open it', use: false });
  });

  it('lets that Rebel through once a scomp link has opened the door', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 1 });
    teleport(g, 'bay327', 10, -19.5);
    unlock(g.doors, g.layout, 'bay327-corr', { scomp: true });
    play(g, NORTH, 5);
    expect(drain(g).filter((e) => e.type === 'room')).toContainEqual({ type: 'room', from: 'bay327', to: 'corr327' });
    expect(g.you.room).toBe('corr327');
  });

  it('turns you the way you walk, and the camera’s way while you aim', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
    play(g, { ...STILL, dir: { x: 1, z: 0 } }, 1);
    expect(g.you.yaw).toBeCloseTo(Math.PI / 2, 3);
    play(g, { ...STILL, yaw: -0.5, aim: true }, STEP);
    expect(g.you.yaw).toBeCloseTo(-0.5, 6);
  });

  it('takes the helmet off and puts it on again, in armour only', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
    step(g, { ...STILL, helmet: true });
    expect(g.you.helmet).toBe(false);
    step(g, { ...STILL, helmet: true });
    expect(g.you.helmet).toBe(true);
    const rebel = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 1 });
    step(rebel, { ...STILL, helmet: true });
    expect(rebel.you.helmet).toBe(false);
  });

  it('goes to a named spot or a room', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
    expect(teleport(g, 'lift1')).toBe(true);
    expect(g.you).toMatchObject({ room: 'lobby1', x: 10, z: -46.6 });
    expect(teleport(g, 'ctl327')).toBe(true);
    expect(g.you).toMatchObject({ room: 'ctl327', x: 22, y: 6, z: -27.5 });
    expect(teleport(g, 'nowhere')).toBe(false);
    expect(g.you.room).toBe('ctl327');
  });
});

describe('the lift', () => {
  // you in the middle of the Level 2 car, its door open after a moment
  function inTheCar() {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
    teleport(g, 'lift1-l2', 10, -49.5);
    play(g, STILL, 0.6);
    expect(passable(g.doors, 'lobby1-lift')).toBe(true);
    drain(g);
    return g;
  }

  it('offers the ride as what E does in the car, and nothing out of it', () => {
    const g = inTheCar();
    expect(promptOf(g)).toEqual({ text: 'take the lift down to Level 5', use: true });
    teleport(g, 'lift1');
    step(g, { ...STILL, use: true });
    expect(g.lift).toBeNull();
  });

  it('carries you from Level 2 to Level 5 and leaves someone standing half out where they were', () => {
    const g = inTheCar();
    // across the doorway: their centre 0.1 m inside the car, the rest of them on the landing
    const other = createBody({ x: 10, y: 0, z: -48.1, room: 'lift1-l2' });
    g.bodies.push(other);
    step(g, { ...STILL, use: true });
    expect(g.lift).toMatchObject({ id: 'lift1', from: 'lift1-l2', to: 'lift1-l5' });
    let least = 1;
    for (let i = 0; i < 3.2 / STEP; i++) {
      step(g, STILL);
      least = Math.min(least, g.doors['lobby1-lift'].open);
    }
    expect(g.lift).toBeNull();
    expect(g.you.room).toBe('lift1-l5');
    expect(g.you.x).toBeCloseTo(40, 6);
    expect(g.you.y).toBeCloseTo(-36, 6);
    expect(g.you.z).toBeCloseTo(-90, 6);
    expect(other).toMatchObject({ x: 10, y: 0, z: -48.1, room: 'lift1-l2' });
    // the doors never shut on them
    expect(least).toBe(1);
    expect(drain(g)).toContainEqual({ type: 'room', from: 'lift1-l2', to: 'lift1-l5' });
  });

  it('shuts the car’s doors for the ride when nobody stands in them', () => {
    const g = inTheCar();
    step(g, { ...STILL, use: true });
    play(g, STILL, 1.5);
    expect(g.you.room).toBe('lift1-l2');
    expect(g.doors['lobby1-lift'].open).toBe(0);
    play(g, STILL, 1.6);
    expect(g.you.room).toBe('lift1-l5');
  });

  it('opens the doors where it arrives', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
    // from the last stop the next is the first again
    teleport(g, 'lift1-l6');
    step(g, { ...STILL, use: true });
    expect(g.lift).toMatchObject({ from: 'lift1-l6', to: 'lift1-l2' });
    play(g, STILL, 3.1);
    expect(g.you.room).toBe('lift1-l2');
    play(g, STILL, 0.5);
    expect(passable(g.doors, 'lobby1-lift')).toBe(true);
  });
});

describe('the events', () => {
  it('hands over what happened once', () => {
    const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 1 });
    play(g, NORTH, 3);
    expect(drain(g).length).toBeGreaterThan(0);
    expect(drain(g)).toEqual([]);
  });
});
