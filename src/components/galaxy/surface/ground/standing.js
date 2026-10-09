// Friend or foe on the ground: which side of a world's war each kind of
// soldier is (a stormtrooper the Empire's in the Civil War and the Remnant's
// in the Remnant War), what any two sides are to each other there, and what
// each is to you by your oath. Pure, tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 2.
//
// SIDE_OF_KIND: { kind: side | { war: side } }; NATIVES: { kind: { leans } };
// sideOfKind(kind, war) → side id | 'native' | null (a civilian, an animal);
// relation(a, b, war) → 'ally' | 'enemy' | 'neutral' (a, b side ids,
// 'hutt', { native: kind } or null); standingOf(npcSide, you: { side, war }).

import { WARS } from '../../sides';

const IMPERIAL = { clone: 'empire', gcw: 'empire', remnant: 'remnant' };
const REBEL = { clone: 'rebel', gcw: 'rebel', remnant: 'newrepublic' };

export const SIDE_OF_KIND = {
  stormtrooper: IMPERIAL,
  sandtrooper: IMPERIAL,
  snowtrooper: IMPERIAL,
  scouttrooper: IMPERIAL,
  deathtrooper: IMPERIAL,
  shoretrooper: IMPERIAL,
  probe: IMPERIAL,
  atst: IMPERIAL,
  rebel: REBEL,
  hothtrooper: REBEL,
  clone: 'republic',
  clonephase1: 'republic',
  atrt: 'republic',
  atap: 'republic',
  atte: 'republic',
  battledroid: 'separatists',
  superdroid: 'separatists',
  droideka: 'separatists',
  dwarfspider: 'separatists',
  mercenary: 'hutt',
  weequay: 'hutt',
};

// the peoples of the worlds: on the side they fight beside in the films, or nobody's
export const NATIVES = {
  wookiee: { leans: 'light' },
  ewok: { leans: 'light' },
  gungan: { leans: 'light' },
  geonosian: { leans: 'dark' },
  jawa: { leans: null },
  kaminoan: { leans: null },
};

export function sideOfKind(kind, war) {
  const s = SIDE_OF_KIND[kind];
  if (s) return typeof s === 'string' ? s : (s[war] ?? null);
  return NATIVES[kind] ? 'native' : null;
}

const inWar = (side, w) => side === w.liberator || side === w.raider;
// a native's lean as the side it stands with in this war (null: nobody's)
const leanSide = (n, w) => {
  const leans = NATIVES[n.native]?.leans;
  return leans === 'light' ? w.liberator : leans === 'dark' ? w.raider : null;
};

export function relation(a, b, war) {
  const w = WARS[war];
  if (!a || !b || !w) return 'neutral';
  const an = typeof a === 'object';
  const bn = typeof b === 'object';
  if (an && bn) return a.native === b.native ? 'ally' : 'neutral';
  if (an || bn) {
    const lean = leanSide(an ? a : b, w);
    return lean && lean === (an ? b : a) ? 'ally' : 'neutral';
  }
  if (a === b) return 'ally';
  if (a === 'hutt' || b === 'hutt') return inWar(a === 'hutt' ? b : a, w) ? 'enemy' : 'neutral';
  return inWar(a, w) && inWar(b, w) ? 'enemy' : 'neutral';
}

// what a soldier of a side is to you: unsworn you're nobody's; the Hutts'
// guards watch you and hunt nobody (warEffects.js gives them no hunt)
export function standingOf(npcSide, you) {
  if (!you?.side || npcSide === 'hutt') return 'neutral';
  return relation(npcSide, you.side, you.war);
}
