// The war a world's ground is staged in: the one its film is set in, whatever
// theatre you fly in (Geonosis is always the Clone Wars'), and what holding
// it means for you there, by your oath in that war. Pure, tested; the
// surface page and the flown landing both call groundEffects. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 1.
//
// SITE_WAR: { sysId: war id }; siteWarOf(sysId, theatre) → the table's, else
// the theatre; groundEffects(sysId, a, now) → warEffects.js's effectsFor in
// that war, plus { side, rank, war, control, front, attack } (control the
// holder's hold, 0 to 1; front and attack whether the war fights over it now),
// or null off the war map.

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

export function groundEffects(sysId, a, now = Date.now()) {
  const war = siteWarOf(sysId, a.war);
  const oath = oathIn(a, war);
  const table = warNow(now, war);
  const e = effectsFor(sysId, table, oath);
  if (!e) return null;
  const row = table.systems.find((r) => r.id === sysId);
  const rank = oath.side ? rankOf(oath.side, mine(war, now).points) : null;
  return {
    ...e,
    side: oath.side ?? null,
    rank: rank ? (RANKS[oath.side]?.findIndex((r) => r.id === rank.id) ?? 0) : 0,
    war,
    control: row.control,
    front: Boolean(row.front),
    attack: Boolean(row.attack),
  };
}
