// What's said on a moment of the galaxy's war's battle (warfront.js's
// `{ type: 'event', id: 'battle', sub, side, against, war, sys }`): the
// commander posted there on the comms first (warCast.js), by your rank for
// the side you swore to (ranks.js, from your record: warState.js's mine) and
// knowing whether you've fought here before; Jabba, when it's the Hutts
// you're fighting, at its start and its end; then the crew (battleLines.js).
// Pure, tested; pages/Galaxy.jsx hands the exchange to the comms.
//
// battleSay(event, crewId, record) → exchange (maybe empty).

import { battleLines } from './battleLines';
import { rankOf } from './ranks';
import { CAST, CAST_KEYS, HUTT_CAST_KEYS, castFor, say } from './warCast';

export function battleSay(e, crewId, record) {
  const key = e.sub;
  const rank = rankOf(e.side, record?.points ?? 0)?.name ?? '';
  const again = Boolean(record?.systems?.some((s) => s.id === e.sys && s.wins + s.losses > 0));
  const out = [];
  if (e.side && CAST_KEYS.includes(key)) out.push(...say(castFor(e.sys, e.side), key, { rank, again }));
  if (e.side && e.against === 'hutt' && HUTT_CAST_KEYS.includes(key)) out.push(...say(CAST.jabba, key, {}));
  out.push(...(battleLines(crewId, { key, side: e.side, war: e.war, sys: e.sys, against: e.against }) ?? []));
  return out;
}
