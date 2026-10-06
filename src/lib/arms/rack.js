// The guns each person carries (a rack), the same on the universe map and
// in the galaxy: up to MAX_GUNS kinds, the first the one in hand (B goes
// round them), and up to MAX_MODS mods on them. Kept for everyone under one
// key, ARMS_KEY: { [who]: { guns, mods } }; unset, a person carries their own
// gun, and Rick his three gadgets. Pure; store.js keeps it.
//
//   readRacks(raw)               what was kept, cleaned (unknown kinds and mods dropped, trimmed)
//   rackOf(racks, who, own)      someone's rack: kept, or the default
//   nextGun(rack)                B: the first gun to the back
//   withFirst(rack, kind)        a pick: that gun in hand, the rest after it
//   withRack(racks, who, rack)   racks with someone's put in (cleaned)

import { MAX_MODS, MODS, WEAPONS } from './weapons';

export const ARMS_KEY = 'tp-arms';
export const MAX_GUNS = 3;
const DEFAULTS = { rick: ['portal', 'freeze', 'shrink'] };

const clean = (r) => {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const guns = [...new Set(Array.isArray(r.guns) ? r.guns : [])].filter((k) => typeof k === 'string' && WEAPONS[k]).slice(0, MAX_GUNS);
  if (!guns.length) return null;
  const mods = [...new Set(Array.isArray(r.mods) ? r.mods : [])].filter((m) => typeof m === 'string' && MODS[m]).slice(0, MAX_MODS);
  return { guns, mods };
};

export function readRacks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [who, r] of Object.entries(raw)) {
    const c = clean(r);
    if (c) out[who] = c;
  }
  return out;
}

export function rackOf(racks, who, own) {
  if (racks?.[who]) return racks[who];
  const guns = DEFAULTS[who] ?? (own && WEAPONS[own] ? [own] : []);
  return { guns: [...guns], mods: [] };
}

export const nextGun = (rack) => (rack.guns.length < 2 ? rack : { ...rack, guns: [...rack.guns.slice(1), rack.guns[0]] });

export const withFirst = (rack, kind) => ({ ...rack, guns: [kind, ...rack.guns.filter((k) => k !== kind)].slice(0, MAX_GUNS) });

export function withRack(racks, who, rack) {
  const c = clean(rack);
  const out = { ...racks };
  if (c) out[who] = c;
  else delete out[who];
  return out;
}
