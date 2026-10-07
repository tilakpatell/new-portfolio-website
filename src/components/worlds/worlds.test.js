import { describe, expect, it } from 'vitest';
import { WORLD_MB, WORLDS, mapTo, worldAt } from './worlds';

describe('the worlds', () => {
  it('each say how much they download, so a phone can be asked first', () => {
    for (const w of WORLDS) expect(WORLD_MB[w.to], w.to).toBeGreaterThan(0);
  });

  it('are found from any address inside them', () => {
    expect(worldAt('/avengers')?.to).toBe('/avengers');
    expect(worldAt('/middle-earth/moria')?.to).toBe('/middle-earth');
    expect(worldAt('/galaxy/hoth')?.to).toBe('/galaxy');
    expect(worldAt('/galaxy/hoth/mission')?.to).toBe('/galaxy');
    expect(worldAt('/deathstar')?.to).toBe('/deathstar');
    expect(worldAt('/middle-earthling')).toBeNull();
    expect(worldAt('/home')).toBeNull();
    expect(worldAt('/')).toBeNull();
  });

  it('lead out to their own place on the universe map', () => {
    expect(mapTo('/invincible')).toBe('/universe/invincible');
    expect(mapTo('/nowhere')).toBe('/universe');
  });
});
