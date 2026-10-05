import { describe, expect, it } from 'vitest';
import { keyDown, keyUp, moveOf } from './keys';

const ev = (code, key, o = {}) => ({ code, key, shiftKey: false, ...o });
const W = (o) => ev('KeyW', o?.shiftKey ? 'W' : 'w', o);
const SHIFT = (o) => ev('ShiftLeft', 'Shift', o);

describe('the walking keys', () => {
  it('W let go after Shift leaves nothing held', () => {
    const held = new Set();
    keyDown(held, W());
    keyDown(held, SHIFT({ shiftKey: true }));
    expect([...held].sort()).toEqual(['run', 'up']);
    keyUp(held, SHIFT());
    keyUp(held, W());
    expect(held.size).toBe(0);
  });

  it('Shift let go before W leaves nothing held either', () => {
    const held = new Set();
    keyDown(held, SHIFT({ shiftKey: true }));
    keyDown(held, W({ shiftKey: true }));
    keyUp(held, W({ shiftKey: true }));
    expect([...held]).toEqual(['run']);
    keyUp(held, SHIFT());
    expect(held.size).toBe(0);
  });

  it('a missed Shift key-up stops the running at the next key', () => {
    const held = new Set(['run', 'up']);
    keyDown(held, ev('KeyA', 'a'));
    expect(held.has('run')).toBe(false);
    expect(held.has('left')).toBe(true);
  });

  it('holding Shift through a re-press keeps running', () => {
    const held = new Set(['up']);
    keyDown(held, W({ shiftKey: true, repeat: true }));
    expect(held.has('run')).toBe(true);
  });

  it('goes by place on the keyboard, and falls back to the key', () => {
    expect(moveOf(ev('KeyW', 'z'))).toBe('up'); // AZERTY's Z
    expect(moveOf(ev('KeyZ', 'w'))).toBe(null);
    expect(moveOf(ev('', 'ArrowLeft'))).toBe('left');
    expect(moveOf(ev(undefined, 'D'))).toBe('right');
    expect(moveOf(ev('Space', ' '))).toBe('space');
    expect(moveOf(ev('KeyE', 'e'))).toBe(null);
  });

  it('ignores keys pressed with Ctrl, Cmd or Alt', () => {
    const held = new Set();
    expect(keyDown(held, ev('ArrowLeft', 'ArrowLeft', { ctrlKey: true }))).toBe(null);
    expect(held.size).toBe(0);
  });
});
