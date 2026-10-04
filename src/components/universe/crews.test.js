import { describe, expect, it } from 'vitest';
import { CREWS, crewById, linesFor, parseShip } from './crews';
import { ORDER } from './layout';

describe('the crews', () => {
  it('are three ships, each with its own id', () => {
    expect(CREWS.map((c) => c.id)).toEqual(['cruiser', 'xwing', 'falcon']);
  });

  it('have something to say everywhere, and only their own crew says it', () => {
    for (const crew of CREWS) {
      const all = [...['launch', 'boost', 'bump', 'edge'].map((e) => linesFor(crew, e)), ...ORDER.map((id) => linesFor(crew, 'arrive', id))];
      for (const exchange of all) {
        expect(exchange?.length, crew.id).toBeGreaterThan(0);
        for (const [who, text] of exchange) {
          expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
          expect(text.length).toBeGreaterThan(2);
        }
      }
    }
  });

  it('only play clips the site has', async () => {
    const { CLIPS } = await import('../../lib/clips');
    for (const crew of CREWS) {
      const lines = Object.values(crew).filter(Array.isArray).flat().concat(Object.values(crew.arrive).flat());
      for (const line of lines) if (line[2]) expect(CLIPS[line[2]], `${crew.id}: ${line[2]}`).toBeTruthy();
    }
  });

  it('reads only real ships from storage or a link', () => {
    expect(parseShip('falcon')).toBe('falcon');
    for (const bad of ['FALCON', '__proto__', 'constructor', '', null, undefined, 3]) expect(parseShip(bad)).toBeNull();
    expect(crewById('nope')).toBeNull();
    expect(linesFor(null, 'boost')).toBeNull();
  });
});
