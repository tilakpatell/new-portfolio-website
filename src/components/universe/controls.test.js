import { describe, expect, it } from 'vitest';
import { CONTROLS, DEFAULTS, STICK, keyAxes, readControls, stickInput, keyFlies } from './controls';

describe('the flying settings', () => {
  it('start as they come, and come back that way from anything unreadable', () => {
    expect(readControls(null)).toEqual(DEFAULTS);
    expect(readControls('nonsense')).toEqual(DEFAULTS);
    expect(readControls({ turn: 'fast', invert: 'yes', dragUp: 'sideways', ad: 'strafe' })).toEqual(DEFAULTS);
  });

  it('keep what was set, inside each slider’s range', () => {
    const c = readControls({ turn: 1.4, pitch: 99, roll: 1.5, level: 0, drag: -3, assist: 0, camera: 1.2, invert: true, dragUp: 'speed', ad: 'turn' });
    expect(c.turn).toBe(1.4);
    expect(c.pitch).toBe(CONTROLS.pitch.max);
    expect(c.drag).toBe(CONTROLS.drag.min);
    expect(c.roll).toBe(1.5);
    expect(c.level).toBe(0); // (self-levelling can be off altogether)
    expect(c.assist).toBe(0); // (and aim assist)
    expect(c.camera).toBe(1.2);
    expect(c.invert).toBe(true);
    expect(c.dragUp).toBe('speed');
    expect(c.ad).toBe('turn');
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

describe('the keys', () => {
  it('are Battlefront’s as they come: W and S the throttle, A and D the roll, the arrows the nose', () => {
    expect(keyAxes({ up: true }, DEFAULTS)).toEqual({ throttle: 1, turn: 0, climb: 0, roll: 0 });
    expect(keyAxes({ down: true }, DEFAULTS).throttle).toBe(-1);
    expect(keyAxes({ d: true }, DEFAULTS)).toEqual({ throttle: 0, turn: 0, climb: 0, roll: 1 });
    expect(keyAxes({ a: true }, DEFAULTS).roll).toBe(-1);
    expect(keyAxes({ right: true }, DEFAULTS).turn).toBe(1);
    expect(keyAxes({ left: true }, DEFAULTS).turn).toBe(-1);
    expect(keyAxes({ pitchUp: true }, DEFAULTS).climb).toBe(1);
    expect(keyAxes({ pitchDown: true }, DEFAULTS).climb).toBe(-1);
    expect(keyAxes({}, DEFAULTS)).toEqual({ throttle: 0, turn: 0, climb: 0, roll: 0 });
  });

  it('turn with A and D instead, if the settings say', () => {
    const c = { ...DEFAULTS, ad: 'turn' };
    expect(keyAxes({ d: true }, c)).toEqual({ throttle: 0, turn: 1, climb: 0, roll: 0 });
    expect(keyAxes({ a: true, left: true }, c).turn).toBe(-1);
  });

  it('turn the nose over when inverted', () => {
    const inv = { ...DEFAULTS, invert: true };
    expect(keyAxes({ pitchUp: true }, inv).climb).toBe(-1);
    expect(keyAxes({ pitchDown: true }, inv).climb).toBe(1);
  });
});

describe('keyFlies', () => {
  const el = (tagName, extra = {}) => ({ tagName, ...extra });
  it('flies from the page itself and from a button', () => {
    expect(keyFlies(null, 'arrowup')).toBe(true);
    expect(keyFlies(el('BODY'), ' ')).toBe(true);
    expect(keyFlies(el('BUTTON'), 'arrowleft')).toBe(true);
    expect(keyFlies(el('BUTTON'), 'enter')).toBe(true);
  });
  it('leaves typing alone', () => {
    expect(keyFlies(el('INPUT', { type: 'text' }), 'arrowleft')).toBe(false);
    expect(keyFlies(el('INPUT', { type: 'range' }), 'arrowleft')).toBe(false);
    expect(keyFlies(el('TEXTAREA'), 'w')).toBe(false);
    expect(keyFlies(el('SELECT'), 'arrowdown')).toBe(false);
    expect(keyFlies(el('DIV', { isContentEditable: true }), 'w')).toBe(false);
  });
  it('lets the arrows fly past a focused checkbox, but not Space', () => {
    const box = el('INPUT', { type: 'checkbox' });
    expect(keyFlies(box, 'arrowup')).toBe(true);
    expect(keyFlies(box, 'arrowleft')).toBe(true);
    expect(keyFlies(box, ' ')).toBe(false);
    expect(keyFlies(box, 'w')).toBe(false);
  });
});
