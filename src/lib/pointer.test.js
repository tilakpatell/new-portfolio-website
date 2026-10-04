import { describe, expect, it } from 'vitest';
import { capturePointer } from './pointer';

describe('capturePointer', () => {
  it('captures the pointer on the element the press started on', () => {
    let got = null;
    const el = { setPointerCapture: (id) => (got = id) };
    capturePointer({ pointerId: 7, currentTarget: el });
    expect(got).toBe(7);
  });

  it('keeps going when the pointer has already lifted', () => {
    const el = {
      setPointerCapture: () => {
        throw new DOMException('No active pointer with the given id is found.', 'NotFoundError');
      },
    };
    expect(() => capturePointer({ pointerId: 1, currentTarget: el })).not.toThrow();
  });

  it('does nothing where pointer capture is missing', () => {
    expect(() => capturePointer({ pointerId: 1, currentTarget: {} })).not.toThrow();
    expect(() => capturePointer({ pointerId: 1, currentTarget: null })).not.toThrow();
  });
});
