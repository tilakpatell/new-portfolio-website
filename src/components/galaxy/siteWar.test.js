import { describe, expect, test } from 'vitest';
import { GCW } from './gcw';
import { readAllegiance, setTheatre, swear } from './allegiance';
import { SITE_WAR, groundEffects, siteWarOf } from './siteWar';
import { WARS } from './sides';

const T = GCW.start + 3600e3;

describe('the ground keeps its film’s war', () => {
  test('each film world is staged in its film war', () => {
    expect(SITE_WAR.geonosis).toBe('clone');
    expect(SITE_WAR.hoth).toBe('gcw');
    expect(SITE_WAR.nevarro).toBe('remnant');
    expect(siteWarOf('alderaan', 'gcw')).toBe('gcw');
    for (const w of Object.values(SITE_WAR)) expect(WARS[w]).toBeTruthy();
  });
  test('groundEffects reads the site war, not the theatre', () => {
    const a = setTheatre(swear(readAllegiance(null, { now: T }), 'republic', T), 'gcw');
    const e = groundEffects('geonosis', a, T);
    expect(e.war).toBe('clone');
    expect(e.side).toBe('republic');
    expect(typeof e.control).toBe('number');
    expect(e.front === true || e.front === false).toBe(true);
    expect(e.attack === true || e.attack === false).toBe(true);
    expect(e.rank).toBe(0);
  });
  test('groundEffects on a world in the theatre’s war is unsworn when you swore in another', () => {
    const a = swear(readAllegiance(null, { now: T }), 'republic', T);
    const e = groundEffects('hoth', a, T);
    expect(e.war).toBe('gcw');
    expect(e.side).toBeNull();
    expect(e.hostile).toBe(false);
  });
  test('groundEffects is null off the war map', () => {
    expect(groundEffects('dagobah-nowhere', readAllegiance(null, { now: T }), T)).toBeNull();
  });
});
