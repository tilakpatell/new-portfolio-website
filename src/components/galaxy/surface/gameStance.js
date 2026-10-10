// A hero's stance when the hero is on the 2017 game's rig: the game's
// strokes from its stroke table (src/data/bf2017/strokes/, stanceFromTable.js),
// the site's stance standing behind them; anyone else's is combatRules.js's.
// Apart from combatRules.js so the pages that only need its names (the
// universe's online protocol reads STANCE_IDS) don't load the tables: with
// them behind it every flight page carried them, and fly-check's turret
// reached the other pilot half a second later, past its 3 s.
//
//   stanceFor(id, hero?) → the stance; hero: { rig, pack } (a crew row): 'walrus' with a table gives the game's,
//                          built once a pack and stance

import { strokeTable } from '../../../data/bf2017/strokes';
import { DIRS, HEAVY, stanceOf } from './combatRules';
import { stanceFromTable } from './stanceFromTable';

const GAME = new Map();

export function stanceFor(id, hero = null) {
  const base = stanceOf(id);
  const table = hero?.rig === 'walrus' ? strokeTable(hero.pack) : null;
  if (!table) return base;
  const key = `${hero.pack}:${id}`;
  if (!GAME.has(key)) GAME.set(key, stanceFromTable(table, { base, dirs: DIRS, heavy: HEAVY }) ?? base);
  return GAME.get(key);
}
