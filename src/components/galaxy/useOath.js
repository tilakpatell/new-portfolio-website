// Your oath in the galaxy's wars (allegiance.js), as a page keeps it: read
// from the browser, sworn and kept there, and read again when the campaign
// it's from is over (an oath is for a campaign: a page left open over the
// turn forgets it, as a reload would). `swearWith` is allegiance.js's swear
// (the holotable's), or skirmish.js's swearHere (a battle's, the war you fly
// in kept as it was).
//
// useOath(swearWith?) → [oath, swearTo(side)]

import { useCallback, useEffect, useState } from 'react';
import { local } from '../../lib/hooks';
import { campaignAt } from './gcw';
import { SIDE_KEY, readAllegiance, swear } from './allegiance';

const kept = () => readAllegiance(local.get(SIDE_KEY));

export function useOath(swearWith = swear) {
  const [oath, setOath] = useState(kept);
  useEffect(() => {
    const t = setTimeout(() => setOath(kept()), Math.max(1000, campaignAt(Date.now()).end - Date.now() + 1000));
    return () => clearTimeout(t);
  }, [oath]);
  const swearTo = useCallback(
    (side) => {
      const was = kept(); // (as it's kept now: another tab may have sworn since)
      const next = swearWith(was, side);
      if (next !== was) local.set(SIDE_KEY, next);
      setOath(next);
    },
    [swearWith],
  );
  return [oath, swearTo];
}
