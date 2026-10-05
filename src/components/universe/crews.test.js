import { describe, expect, it } from 'vitest';
import { CREWS, crewById, linesFor, parseShip } from './crews';
import { ORDER } from './layout';

describe('the crews', () => {
  it('are four ships, each with its own id', () => {
    expect(CREWS.map((c) => c.id)).toEqual(['cruiser', 'xwing', 'falcon', 'rv']);
  });

  it('have something to say everywhere, and only their own crew says it', () => {
    for (const crew of CREWS) {
      const all = [...['launch', 'boost', 'bump', 'edge', 'crash'].map((e) => linesFor(crew, e)), ...ORDER.map((id) => linesFor(crew, 'arrive', id)), linesFor(crew, 'kill', 'any')];
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
      const lines = Object.values(crew).filter(Array.isArray).flat().concat(...[crew.arrive, crew.traffic, crew.kill].map((o) => Object.values(o ?? {}).flat()));
      for (const line of lines) if (line[2]) expect(CLIPS[line[2]], `${crew.id}: ${line[2]}`).toBeTruthy();
    }
  });

  it('have a word for every kind of traffic that comes past them, and for shooting one down', () => {
    // what flies by each crew (traffic.js): Star Wars for the X-wing and the Falcon, Rick and Morty for the cruiser, both for the RV
    const STAR_WARS = ['tie', 'interceptor', 'xwing', 'slave1'];
    const RICK_AND_MORTY = ['patrol', 'gromflomite', 'meeseeks', 'birdperson'];
    const FLYBY = { cruiser: RICK_AND_MORTY, xwing: STAR_WARS, falcon: STAR_WARS, rv: [...STAR_WARS, ...RICK_AND_MORTY] };
    for (const crew of CREWS) {
      for (const kind of FLYBY[crew.id]) {
        for (const event of ['traffic', 'kill']) {
          const exchange = linesFor(crew, event, kind);
          expect(exchange?.length, `${crew.id} ${event} ${kind}`).toBeGreaterThan(0);
          for (const [who] of exchange) expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
        }
      }
    }
  });

  it('reads only real ships from storage or a link', () => {
    expect(parseShip('falcon')).toBe('falcon');
    for (const bad of ['FALCON', '__proto__', 'constructor', '', null, undefined, 3]) expect(parseShip(bad)).toBeNull();
    expect(crewById('nope')).toBeNull();
    expect(linesFor(null, 'boost')).toBeNull();
  });
});
