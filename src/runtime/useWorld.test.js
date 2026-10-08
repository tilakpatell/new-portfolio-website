import { describe, expect, it } from 'vitest';
import { adoptable, madeFor } from './useWorld';

// A page mounting a module finds a world of that module already on the
// runtime: one handed over to it (adopt it), or one made for something else
// (a world built for the hero or the mission the page has since changed
// from: make it again, not adopt it and show the old one)
describe('which world on the runtime a page may adopt', () => {
  const mod = { id: 'galaxy-surface' };
  const world = () => ({ draw() {} });
  it('one handed over (made by no page): adopted, whatever the page asks for', () => {
    expect(adoptable({ module: mod, world: world() }, mod, 'chase')).toBe(true);
    expect(adoptable({ module: mod, world: world() }, mod, null)).toBe(true);
  });
  it('one a page made for the same thing: adopted (React’s second run, the page again)', () => {
    const w = world();
    madeFor.set(w, 'explore');
    expect(adoptable({ module: mod, world: w }, mod, 'explore')).toBe(true);
  });
  it('one a page made for something else: not adopted', () => {
    const w = world();
    madeFor.set(w, 'explore');
    expect(adoptable({ module: mod, world: w }, mod, 'chase')).toBe(false);
  });
  it('another module’s, or none: not adopted', () => {
    expect(adoptable({ module: { id: 'earth' }, world: world() }, mod, null)).toBe(false);
    expect(adoptable(null, mod, null)).toBe(false);
  });
});
