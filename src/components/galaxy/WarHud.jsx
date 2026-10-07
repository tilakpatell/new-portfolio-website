import { SIDES } from './sides';
import { battleLine } from './warText';
import { useWar } from './useWar';

// One line over the galaxy's view while the war's battle is on in the system
// you're in (gcw.js's battleAt, in the war you fight in): what kind of battle
// it is and what your side's to do in it, and the clock, in your side's
// colour; and in the lull between one battle and the next, that it's
// regrouping and when the next is on. The Citadel siege's style: no bars,
// no tickets.
export default function WarHud({ sys, oath }) {
  const { now, table } = useWar(oath?.war);
  const row = table.systems.find((r) => r.id === sys);
  if (!row?.battle) return null;
  return (
    <p className="galaxy-warhud" role="status" style={{ '--side': SIDES[oath?.side]?.colour ?? '#9fb0d0' }}>
      {battleLine(row, now, oath?.side)}
    </p>
  );
}
