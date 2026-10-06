import { describe, expect, it } from 'vitest';
import { focusBack, wrapFocus } from './focus';

const el = (name, connected = true) => ({ name, isConnected: connected, focused: 0, focus() { this.focused += 1; } });

describe('wrapFocus (Tab kept inside a dialog)', () => {
  const [a, b, c] = [el('a'), el('b'), el('c')];
  const items = [a, b, c];

  it('goes round from the last to the first', () => {
    expect(wrapFocus(items, c, false)).toBe(a);
  });

  it('goes round from the first to the last, backwards', () => {
    expect(wrapFocus(items, a, true)).toBe(c);
  });

  it('leaves a step inside the dialog to the browser', () => {
    expect(wrapFocus(items, a, false)).toBe(null);
    expect(wrapFocus(items, c, true)).toBe(null);
  });

  it('brings focus that got out back in, at the end it was going to', () => {
    const outside = el('out');
    expect(wrapFocus(items, outside, false)).toBe(a);
    expect(wrapFocus(items, outside, true)).toBe(c);
  });

  it('has nothing to do with nothing to focus', () => {
    expect(wrapFocus([], a, false)).toBe(null);
  });
});

describe('focusBack (focus home after a dialog)', () => {
  it('goes back where it was', () => {
    const was = el('was');
    const other = el('other');
    expect(focusBack(was, () => other)).toBe(was);
    expect(was.focused).toBe(1);
    expect(other.focused).toBe(0);
  });

  it('goes to the fallback when where it was has gone (a panel that closed)', () => {
    const was = el('was', false);
    const other = el('other');
    expect(focusBack(was, () => other)).toBe(other);
    expect(other.focused).toBe(1);
  });

  it('does nothing with nowhere to go', () => {
    expect(focusBack(el('was', false), () => null)).toBe(null);
    expect(focusBack(null)).toBe(null);
  });
});
