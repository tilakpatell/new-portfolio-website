// Who on a world's ground is your friend, your foe or neither: by the side
// the figure is on in the world's war (its own word first, else its kind),
// and by which side you swore to in that war (siteWar.js's groundEffects
// gives `war` and `side`). Pure: no three.js. The design:
// docs/superpowers/specs/2026-10-07-ground-sides-kashyyyk-look-ai-design.md §2.
import { SIDES, WARS } from '../sides.js';
import { FAMILIES } from './garrison.js';

// The war's light side and its raiders: the Empire's kit is the Remnant's in
// the Remnant War, the Rebellion's is the New Republic's. The Clone Wars have
// no Empire or Rebellion of their own, so those kinds keep their own side
// there and are nobody's friends or foes (they aren't on either side of it).
const IMPERIAL = { gcw: 'empire', remnant: 'remnant' };
const REBEL = { gcw: 'rebel', remnant: 'newrepublic' };

const FIXED = {};
const fix = (kinds, side) => kinds.forEach((k) => { FIXED[k] = side; });
fix([...FAMILIES.battledroid, 'droideka', 'dwarfspider', 'homingspider'], 'separatists');
fix([...FAMILIES.clone, 'clonephase1', 'atrt', 'atap', 'atte'], 'republic');
fix([...FAMILIES.mercenary, 'weequay'], 'hutt');

const IMPERIAL_KINDS = [...FAMILIES.stormtrooper, 'deathtrooper', 'shoretrooper', 'probe', 'atst', 'atat'];
const REBEL_KINDS = [...FAMILIES.rebel, 'rebelpilot'];

// the side a native fights beside in its film (null: nobody's)
export const NATIVE_LEANS = {
  wookiee: 'light', ewok: 'light', gungan: 'light', geonosian: 'dark',
  kaminoan: null, jawa: null, tusken: null, villager: null,
};

export function sideOfKind(kind, war) {
  if (kind in NATIVE_LEANS) return 'native';
  if (FIXED[kind]) return FIXED[kind];
  if (IMPERIAL_KINDS.includes(kind)) return IMPERIAL[war] ?? 'empire';
  if (REBEL_KINDS.includes(kind)) return REBEL[war] ?? 'rebel';
  return null;
}

export function standingOf(entry, effects) {
  const war = WARS[effects?.war];
  const yours = effects?.side;
  if (!entry || !war || !yours || !SIDES[yours]) return 'neutral';
  const side = entry.side ?? sideOfKind(entry.kind, war.id);
  if (side === 'native') {
    const leans = entry.leans ?? NATIVE_LEANS[entry.kind] ?? null;
    return leans && leans === SIDES[yours].stance ? 'ally' : 'neutral';
  }
  if (side === yours) return 'ally';
  // an enemy only when it's the other side of this war (the Hutts are in
  // every war but nobody's other side)
  if ((side === war.liberator || side === war.raider) && (yours === war.liberator || yours === war.raider)) return 'enemy';
  return 'neutral';
}
