import { describe, expect, it } from 'vitest';
import { CREWS, crewById, linesFor, parseShip } from './crews';
import { ORDER } from './layout';

describe('the crews', () => {
  it('are four ships, each with its own id', () => {
    expect(CREWS.map((c) => c.id)).toEqual(['cruiser', 'xwing', 'falcon', 'rv']);
  });

  it('have something to say everywhere, and only their own crew says it', () => {
    for (const crew of CREWS) {
      const all = [...['launch', 'boost', 'bump', 'edge', 'crash', 'pulled', 'swallowed'].map((e) => linesFor(crew, e)), ...ORDER.map((id) => linesFor(crew, 'arrive', id)), linesFor(crew, 'kill', 'any')];
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
      const lines = Object.values(crew).filter(Array.isArray).flat().concat(...[crew.arrive, crew.traffic, crew.kill, crew.hunted, crew.events, crew.wonders, crew.crashInto].map((o) => Object.values(o ?? {}).flat()));
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

  it('have a word for being hunted, the director’s events and every wonder out in deep space', async () => {
    const { FACTIONS } = await import('./hunters');
    const { EVENTS } = await import('./director');
    const { WONDERS } = await import('./deep');
    const FAMILY = { cruiser: 'rickmorty', xwing: 'starwars', falcon: 'starwars', rv: 'both' };
    const said = (exchange, crew, what) => {
      expect(exchange?.length, `${crew.id}: ${what}`).toBeGreaterThan(0);
      for (const [who, text] of exchange) {
        expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
        expect(text.length).toBeGreaterThan(2);
      }
    };
    for (const crew of CREWS) {
      const family = FAMILY[crew.id];
      // hunters after you (not the pirates in a distress call: that's the event's line)
      // (the RV, in both universes, is hunted by the Empire or the Federation)
      for (const [id, f] of Object.entries(FACTIONS)) if ((f.family === family || (family === 'both' && id !== 'council')) && id !== 'bugs') said(linesFor(crew, 'hunted', id), crew, `hunted ${id}`);
      if (family !== 'rickmorty') said(linesFor(crew, 'hunted', 'ace'), crew, 'hunted ace');
      for (const event of ['hit', 'shields', 'destroyed', 'escaped', 'cleared', 'interdicted']) said(linesFor(crew, event), crew, event);
      for (const into of ['star', 'giant', 'citadel']) said(linesFor(crew, 'crashInto', into), crew, `crashInto ${into}`);
      // the director's events (the Council's arrival is its hunted line), rescuing someone, going out into deep space
      for (const [id, e] of Object.entries(EVENTS)) if (e.families.includes(family) && id !== 'hunt' && id !== 'council') said(linesFor(crew, 'event', id), crew, `event ${id}`);
      said(linesFor(crew, 'event', 'rescued'), crew, 'rescued');
      said(linesFor(crew, 'event', 'deep'), crew, 'deep');
      for (const w of WONDERS) said(linesFor(crew, 'wonder', w.id), crew, `wonder ${w.id}`);
    }
  });

  it('reads only real ships from storage or a link', () => {
    expect(parseShip('falcon')).toBe('falcon');
    for (const bad of ['FALCON', '__proto__', 'constructor', '', null, undefined, 3]) expect(parseShip(bad)).toBeNull();
    expect(crewById('nope')).toBeNull();
    expect(linesFor(null, 'boost')).toBeNull();
  });
});

describe('the crews on foot', () => {
  it('have a word for each moment out of the ship, said by their own crew', async () => {
    const { PARTY } = await import('./footScene');
    const { TROOPS } = await import('./foot');
    for (const crew of CREWS) {
      const all = [
        ...['land', 'out', 'squad', 'hurt', 'down', 'up', 'cleared', 'far', 'nowhere', 'in'].map((id) => linesFor(crew, 'foot', id)),
        ...Object.keys(TROOPS).map((kind) => linesFor(crew, 'foot', 'kill', kind)),
        ...PARTY[crew.id].map((p) => linesFor(crew, 'foot', 'swap', p.id)),
        // another pilot's crew down too, and anyone's double from another dimension
        linesFor(crew, 'foot', 'friend'),
        ...Object.values(PARTY)
          .flat()
          .map((p) => linesFor(crew, 'foot', 'alt', p.id)),
      ];
      for (const exchange of all) {
        expect(exchange?.length, crew.id).toBeGreaterThan(0);
        for (const [who, text] of exchange) {
          expect(crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
          expect(text.length).toBeGreaterThan(2);
        }
      }
    }
  });
});
