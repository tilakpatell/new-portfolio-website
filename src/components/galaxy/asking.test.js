import { describe, expect, it } from 'vitest';
import { asking } from './asking';

describe('the page asking the scene for a system', () => {
  it('jumps when it asks for somewhere new', () => {
    expect(asking('tatooine', 'hoth', { here: 'tatooine' })).toEqual({ asked: 'hoth', act: 'jump' });
  });

  it('waits for a jump under way to come out before going on', () => {
    expect(asking('tatooine', 'hoth', { here: 'yavin', to: 'yavin', midJump: true })).toEqual({ asked: 'hoth', act: 'queue' });
  });

  it("doesn't send you back to the system a jump of your own just left", () => {
    // jumping Tatooine → Yavin with J: the page still names Tatooine, drawing
    // again in the tunnel (where the scene's already in Yavin) and as you come out
    const tunnel = asking('tatooine', 'tatooine', { here: 'yavin', to: 'yavin', midJump: true });
    expect(tunnel.act).toBeNull();
    const out = asking(tunnel.asked, 'tatooine', { here: 'yavin' });
    expect(out.act).toBeNull();
    // then the page catches up with where you are: still nothing to do
    expect(asking(out.asked, 'yavin', { here: 'yavin' })).toEqual({ asked: 'yavin', act: null });
  });

  it('does nothing when asked for where you are, or where you are already going', () => {
    expect(asking('tatooine', 'naboo', { here: 'naboo' }).act).toBeNull();
    expect(asking('tatooine', 'naboo', { here: 'tatooine', to: 'naboo' }).act).toBeNull();
    expect(asking('naboo', null, { here: 'naboo' })).toEqual({ asked: 'naboo', act: null });
  });
});
