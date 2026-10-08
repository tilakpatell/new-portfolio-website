// Where the wallet (economy.js) learns what you've become, for the
// catalogue's locks and the record card: your standing with a universe's
// law, its ordinary ships and its pirates (standing.js, as the scene keeps
// it), and your oath and rank in the galaxy's wars (allegiance.js's oath,
// ranks.js's ladder by the points warState.js's `mine` counts). Pure
// readers over what's stored, tested in Node; EconomyProvider.jsx hands
// them the page's storage and the war's points.
//
// standingLevels(storage, side) → { law, civil, outlaw } level names (or
// null each), or null with no storage or side; warRank(allegiance, side,
// pointsOf, now) → rank id or null; oathAndRank(allegiance, pointsOf, now)
// → { war, side, rank } in the theatre you fight in.

import { current, readAllegiance } from '../galaxy/allegiance';
import { rankOf } from '../galaxy/ranks';
import { warOfSide } from '../galaxy/sides';
import { AXES, createStanding } from './standing';

// (through createStanding, so what's faded since it was kept has faded here too)
export function standingLevels(storage, side) {
  if (!storage || typeof side !== 'string') return null;
  const s = createStanding({ storage });
  s.side(side);
  return Object.fromEntries(AXES.map((axis) => [axis, s.level(axis)]));
}

// A rank only on the side you swore to this campaign: an oath forgotten, or
// sworn to the other side, ranks you nothing on this one.
export function warRank(allegiance, side, pointsOf, now = Date.now()) {
  const war = warOfSide(side);
  if (!war) return null;
  const oath = readAllegiance(allegiance, { now }).oaths[war];
  if (oath?.side !== side) return null;
  return rankOf(side, pointsOf(war))?.id ?? null;
}

export function oathAndRank(allegiance, pointsOf, now = Date.now()) {
  const { war, side } = current(readAllegiance(allegiance, { now }));
  return { war, side, rank: side ? warRank(allegiance, side, pointsOf, now) : null };
}
