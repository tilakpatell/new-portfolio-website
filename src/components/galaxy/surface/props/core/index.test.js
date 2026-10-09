import { describe, expect, it } from 'vitest';
import { PROPS, SCATTER } from '.';
import * as naboo from './naboo';
import * as coruscant from './coruscant';
import * as kamino from './kamino';
import * as geonosis from './geonosis';

// what props/core.js held before it split, by world
const KINDS = {
  naboo: ['theed', 'theedpalace', 'waterfall', 'n1fighter', 'royalship', 'hangar', 'plaza', 'boomas', 'stonehead', 'ruins', 'grove', 'shield', 'mtt', 'aat', 'droideka', 'bongo', 'otohgunga', 'varykino', 'shaak'],
  coruscant: ['skyscraper', 'plinth', 'cplatform', 'deck', 'skybridge', 'jeditemple', 'senate', 'statue', 'republica', 'dexdiner', 'club', 'works', 'airspeeder', 'airlane', 'senateguard'],
  kamino: ['tipoca', 'kpad', 'kmast', 'kdischarge', 'slave1', 'jango', 'aiwha'],
  geonosis: ['arena', 'pillars', 'acklay', 'atte', 'laat', 'hive', 'foundry', 'solarsailer', 'geohangar', 'coresphere', 'commandpost', 'holotable', 'skyring'],
};
const SCATTERED = { naboo: ['nabootree', 'grass'], kamino: ['buoy'], geonosis: ['spire'] };
const PARTS = { naboo, coruscant, kamino, geonosis };

describe('the core worlds’ props, a part for each world behind one barrel', () => {
  it('builds every kind it built before, and no other', () => {
    expect(Object.keys(PROPS)).toEqual(Object.values(KINDS).flat());
    expect(Object.keys(SCATTER).sort()).toEqual(Object.values(SCATTERED).flat().sort());
  });

  it('keeps each world’s builders in its own part, the barrel’s the same functions', () => {
    for (const [world, part] of Object.entries(PARTS)) {
      expect(Object.keys(part.PROPS), world).toEqual(KINDS[world]);
      expect(Object.keys(part.SCATTER ?? {}), world).toEqual(SCATTERED[world] ?? []);
      for (const kind of KINDS[world]) expect(PROPS[kind], kind).toBe(part.PROPS[kind]);
      for (const kind of SCATTERED[world] ?? []) expect(SCATTER[kind], kind).toBe(part.SCATTER[kind]);
    }
  });
});
