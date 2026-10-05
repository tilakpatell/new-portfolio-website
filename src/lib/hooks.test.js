import { describe, expect, it } from 'vitest';
import { watchVisible } from './hooks';

// a document as far as page visibility goes
function page(hidden = false) {
  const doc = new EventTarget();
  doc.hidden = hidden;
  doc.flip = (h) => {
    doc.hidden = h;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  return doc;
}

describe('watching whether the page is showing', () => {
  it('says so at once, and again each time the tab is hidden or shown', () => {
    const doc = page(false);
    const seen = [];
    watchVisible(doc, (v) => seen.push(v));
    doc.flip(true);
    doc.flip(false);
    expect(seen).toEqual([true, false, true]);
  });
  it('starts hidden in a tab opened in the background', () => {
    const seen = [];
    watchVisible(page(true), (v) => seen.push(v));
    expect(seen).toEqual([false]);
  });
  it('stops when it’s let go', () => {
    const doc = page(false);
    const seen = [];
    const stop = watchVisible(doc, (v) => seen.push(v));
    stop();
    doc.flip(true);
    expect(seen).toEqual([true]);
  });
});
