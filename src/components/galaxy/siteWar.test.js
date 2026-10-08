import { describe, expect, it } from 'vitest';
import { SITE_WAR, groundEffects, siteWarOf } from './siteWar';
import { readAllegiance, swear } from './allegiance';
import { LANDABLE } from './surface/sites';

describe('the war each world is staged in', () => {
  it('stages every world you can land on in a war', () => {
    for (const id of LANDABLE) expect(['clone', 'gcw', 'remnant'], id).toContain(SITE_WAR[id]);
    expect(SITE_WAR.geonosis).toBe('clone');
    expect(SITE_WAR.kashyyyk).toBe('clone');
    expect(SITE_WAR.endor).toBe('gcw');
    expect(SITE_WAR.sorgan).toBe('remnant');
  });
  it('reads the ground in its own war, with your oath in that war', () => {
    const rebel = swear(readAllegiance(null), 'rebel');
    const e = groundEffects('geonosis', rebel, 0);
    expect(e.war).toBe('clone');
    expect(e.side).toBe(null); // (sworn in the Civil War, not the Clone Wars)
    expect(e.troops).not.toBe('stormtrooper');
    const endor = groundEffects('endor', rebel, 0);
    expect(endor.side).toBe('rebel');
    expect(typeof endor.rank).toBe('number');
  });
  it('falls back to the theatre for a world not in the table', () => {
    expect(siteWarOf('nowhere', 'gcw')).toBe('gcw');
    expect(siteWarOf('nowhere', 'clone')).toBe('clone');
    expect(siteWarOf('endor', 'clone')).toBe('gcw');
  });
});
