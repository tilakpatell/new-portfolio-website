// Which cut of a figure to fetch first, and when the plain one is worth its
// bytes. A person's `.lod1` is about a tenth of the plain cut, so it comes
// first and is drawn while the plain is on its way; past the level's `near`
// the plain is never fetched at all (the far cut's whole saving), and on a
// saver connection or 2G nothing past the small cut is fetched until the
// visitor asks. Pure, over lib/budgets' bands.
//
// firstCut(distance, level, { hasLod, hasFar, lowData }) → 'far' | 'lod1' | 'plain'
// wantsUpgrade(distance, level, { lowData }) → boolean

import { budget } from '../budgets';

export function firstCut(distance, level, { hasLod = false, hasFar = false, lowData = false } = {}) {
  const b = budget(level);
  // (ultra keeps the full model at every distance: budgets' lod1 is off there)
  if (!b.lod1 && !lowData) return 'plain';
  if (hasFar && distance > b.mid) return 'far';
  if (hasLod) return 'lod1';
  return hasFar && distance > b.near ? 'far' : 'plain';
}

export const wantsUpgrade = (distance, level, { lowData = false } = {}) => !lowData && distance <= budget(level).near;
