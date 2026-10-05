import { describe, expect, it } from 'vitest';
import { CONTROLS, DEFAULTS, STICK, keyClimb, readControls, stickInput } from './controls';

describe('the flying settings', () => {
  it('start as they come, and come back that way from anything unreadable', () => {
    expect(readControls(null)).toEqual(DEFAULTS);
    expect(readControls('nonsense')).toEqual(DEFAULTS);
    expect(readControls({ turn: 'fast', invert: 'yes', dragUp: 'sideways' })).toEqual(DEFAULTS);
  });

  it('keep what was set, inside each slider’s range', () => {
    const c = readControls({ turn: 1.4, pitch: 99, drag: -3, assist: 0, camera: 1.2, invert: true, dragUp: 'speed' });
    expect(c.turn).toBe(1.4);
    expect(c.pitch).toBe(CONTROLS.pitch.max);
    expect(c.drag).toBe(CONTROLS.drag.min);
    expect(c.assist).toBe(0); // (aim assist can be off altogether)
    expect(c.camera).toBe(1.2);
    expect(c.invert).toBe(true);
    expect(c.dragUp).toBe('speed');
  });

  it('has every default inside its own range', () => {
    for (const [k, r] of Object.entries(CONTROLS)) {
      expect(DEFAULTS[k], k).toBeGreaterThanOrEqual(r.min);
      expect(DEFAULTS[k], k).toBeLessThanOrEqual(r.max);
    }
  });
});

describe('dragging to fly', () => {
  it('reaches a full turn at the stick’s length, sooner the higher the sensitivity', () => {
    expect(stickInput(STICK, 0, DEFAULTS, 'mouse').turn).toBe(1);
    expect(stickInput(STICK / 2, 0, DEFAULTS, 'mouse').turn).toBeCloseTo(0.5, 6);
    expect(stickInput(STICK / 2, 0, { ...DEFAULTS, drag: 2 }, 'mouse').turn).toBe(1);
    expect(stickInput(-STICK * 3, 0, DEFAULTS, 'mouse').turn).toBe(-1);
  });

  it('tips the nose with a mouse, and works the throttle on a touch screen', () => {
    const mouse = stickInput(0, -STICK, DEFAULTS, 'mouse');
    expect(mouse.climb).toBe(1);
    expect(mouse.throttle).toBe(0);
    const touch = stickInput(0, -STICK, DEFAULTS, 'touch');
    expect(touch.throttle).toBe(1);
    expect(touch.climb).toBe(0);
  });

  it('does what the setting says, whatever the pointer', () => {
    expect(stickInput(0, -STICK, { ...DEFAULTS, dragUp: 'speed' }, 'mouse').throttle).toBe(1);
    expect(stickInput(0, -STICK, { ...DEFAULTS, dragUp: 'pitch' }, 'touch').climb).toBe(1);
  });

  it('turns the nose the other way up when inverted (not the throttle)', () => {
    expect(stickInput(0, -STICK, { ...DEFAULTS, invert: true }, 'mouse').climb).toBe(-1);
    expect(stickInput(0, -STICK, { ...DEFAULTS, invert: true }, 'touch').throttle).toBe(1);
  });
});

describe('the keys for up and down', () => {
  it('climb with R or the up arrow, dive with C or the down arrow', () => {
    expect(keyClimb({ climb: true }, DEFAULTS)).toBe(1);
    expect(keyClimb({ pitchUp: true }, DEFAULTS)).toBe(1);
    expect(keyClimb({ dive: true }, DEFAULTS)).toBe(-1);
    expect(keyClimb({ pitchDown: true }, DEFAULTS)).toBe(-1);
    expect(keyClimb({ climb: true, pitchUp: true }, DEFAULTS)).toBe(1);
    expect(keyClimb({}, DEFAULTS)).toBe(0);
  });

  it('turn the arrows over when inverted, and leave R and C as they say', () => {
    const inv = { ...DEFAULTS, invert: true };
    expect(keyClimb({ pitchUp: true }, inv)).toBe(-1);
    expect(keyClimb({ pitchDown: true }, inv)).toBe(1);
    expect(keyClimb({ climb: true }, inv)).toBe(1);
  });
});
