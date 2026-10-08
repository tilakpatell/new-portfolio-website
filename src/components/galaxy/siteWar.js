// The war each world's ground is staged in: its film's, whatever theatre you
// fight in. Geonosis is the Clone Wars' even while the Civil War is on, so
// its troopers are clones and droids, and your oath there is the one you
// swore in the Clone Wars (allegiance.js's oathIn), not the Rebel one.
// Pure; the surface page reads it for who stands on the ground and how the
// people there talk to you.
//
// SITE_WAR: { system: war }; siteWarOf(sys, theatre) → the table's war, else
// the theatre's; groundEffects(sys, a, now) → warEffects.js's effects for the
// ground, with the side you swore to there and your rank in it.

import { oathIn } from './allegiance';
import { RANKS, rankOf } from './ranks';
import { effectsFor } from './warEffects';
import { mine, warNow } from './warState';

export const SITE_WAR = {
  geonosis: 'clone',
  kamino: 'clone',
  kashyyyk: 'clone',
  mustafar: 'clone',
  naboo: 'clone',
  coruscant: 'clone',
  tatooine: 'gcw',
  hoth: 'gcw',
  endor: 'gcw',
  yavin: 'gcw',
  bespin: 'gcw',
  scarif: 'gcw',
  dagobah: 'gcw',
  nevarro: 'remnant',
  sorgan: 'remnant',
  mandalore: 'remnant',
  lothal: 'remnant',
};

export const siteWarOf = (sysId, theatre) => SITE_WAR[sysId] ?? theatre;

// (the rank is a step up the side's ladder, 0 for the unsworn)
export function groundEffects(sysId, a, now = Date.now()) {
  const war = siteWarOf(sysId, a.war);
  const oath = oathIn(a, war);
  const e = effectsFor(sysId, warNow(now, war), oath);
  if (!e) return e;
  const rank = oath.side ? rankOf(oath.side, mine(war, now).points) : null;
  return { ...e, war, side: oath.side ?? null, rank: rank ? (RANKS[oath.side]?.findIndex((r) => r.id === rank.id) ?? 0) : 0 };
}
