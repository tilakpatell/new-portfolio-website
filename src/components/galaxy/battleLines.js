// The crews' lines in the galaxy's wars' battles (warfront.js says what's
// happening: a battle's `sub`), by the side you swore to's stance (sides.js:
// the liberator's `light`, the raider's `dark`), so the X-wing's Luke says
// one thing flying for the Rebellion and another, unhappily, for the Empire.
// A war may have its own word (`battleWar`), a film's place its own
// (`battleAt`), and a battle against the Hutts its own (`hutt`, for a front,
// a win and a loss). The lines have blanks the battle fills: {us} (your
// side, "the Rebellion"), {them} (the other, "the Hutts") and {place} (the
// system's name). Data in battleCrews/, one file a crew, and the stages'
// lines (a group of targets, a zone to hold, a boarding, a bomber wave, an
// ace joining) for all four in battleCrews/stages.js; the rules here, pure
// and tested.
//
// BATTLE_KEYS: what's said in a battle; HUTT_KEYS: what the Hutts' battles
// have their own for; PLACES: the systems with their own.
// battleLines(crewId, { key, side, war, sys, against }) → exchange | null
// (the Hutts' against the Hutts, else the place's, then the war's, then the
// side's; `ask`
// for anyone, even nobody's side); fill(exchange, { side, against, sys }).

import { SIDES } from './sides';
import { systemById } from './systems';
import cruiser from './battleCrews/cruiser';
import xwing from './battleCrews/xwing';
import falcon from './battleCrews/falcon';
import rv from './battleCrews/rv';
import stages from './battleCrews/stages';

export const BATTLE_KEYS = ['ask', 'front', 'join', 'gens', 'bridge', 'reactor', 'won', 'lost', 'turncoat', 'ace', 'escort', 'deserter', 'intercept', 'runners', 'gate', 'interdictor', 'blockade', 'group', 'zone', 'board', 'wave', 'hunt'];
export const HUTT_KEYS = ['front', 'won', 'lost'];
// (each in the war its moment is from: battleAt[sys].war)
export const PLACES = { endor: 'gcw', hoth: 'gcw', scarif: 'gcw', yavin: 'gcw', bespin: 'gcw', coruscant: 'clone', naboo: 'clone', lothal: 'remnant' };

// (each crew's own, with its stages' lines among its battle's)
const withStages = (crew, id) => ({ ...crew, battle: { ...crew.battle, ...stages[id] } });
export const BATTLE_LINES = { cruiser: withStages(cruiser, 'cruiser'), xwing: withStages(xwing, 'xwing'), falcon: withStages(falcon, 'falcon'), rv: withStages(rv, 'rv') };

const theSide = (side) => (side === 'hutt' ? 'the Hutts' : SIDES[side] ? `the ${SIDES[side].short}` : 'them');

export function fill(exchange, { side, against, sys }) {
  const words = { us: theSide(side), them: theSide(against), place: systemById(sys)?.name ?? 'here' };
  return exchange.map(([who, text, ...rest]) => [who, text.replace(/\{(us|them|place)\}/g, (_, k) => words[k]), ...rest]);
}

export function battleLines(crewId, { key, side = null, war, sys, against = null }) {
  const b = BATTLE_LINES[crewId];
  if (!b || !BATTLE_KEYS.includes(key)) return null;
  if (key === 'ask') return b.battle.ask?.any ? fill(b.battle.ask.any, { side, against, sys }) : null;
  const stance = SIDES[side]?.stance;
  if (stance !== 'light' && stance !== 'dark') return null;
  // (against the Hutts, their own first: the war's and the place's name the war's other side)
  const at = b.battleAt[sys]?.war === war ? b.battleAt[sys] : null;
  const ex = (against === 'hutt' ? b.battle[key]?.hutt : null) ?? at?.[key]?.[stance] ?? b.battleWar[war]?.[key]?.[stance] ?? b.battle[key]?.[stance] ?? null;
  return ex ? fill(ex, { side, against, sys }) : null;
}
