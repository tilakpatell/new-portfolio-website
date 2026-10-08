import { SIDES } from './sides';
import { systemById } from './systems';
import { afterLine, battleLine, nextLine, objectiveBars, stageLine } from './warText';
import { useWar } from './useWar';

// One line over the galaxy's view while the war's battle is on in the system
// you're in (gcw.js's battleAt, in the war you fight in): what kind of battle
// it is and what your side's to do in it, and the clock, in your side's
// colour; and in the lull between one battle and the next, that it's
// regrouping and when the next is on. The Citadel siege's style: no
// tickets.
//
// Under it, while you're in the battle here (`front()`: warfront.js's info,
// the battle every pilot here shares), the stage it's at and what's next on
// its clock, and a thin bar for each of the stage's objectives (three at
// most), their hp the director's. A battle decided early keeps its window
// (gcw.js's twelve minutes): the line says who won here, and when the next
// battle's on, till it is.
export default function WarHud({ sys, oath, front = null }) {
  const { now, table } = useWar(oath?.war);
  const row = table.systems.find((r) => r.id === sys);
  // (the battle here as the front has it, if it has one: the war table's, or
  // one a dev hook forced; whether it's still fighting from the clock, not
  // what the battle kept from its start)
  const got = front?.() ?? null;
  const info = got?.on && got.sys === sys ? got : null;
  const was = info?.on ?? row?.battle;
  if (!was) return null;
  const b = { ...was, fighting: now < was.fightEnd };
  const ended = Boolean(b.fighting && info?.result);
  const line = ended ? afterLine(info, systemById(sys)?.name ?? sys, now) : battleLine({ ...row, kind: info?.laid?.kind ?? row?.kind, battle: b }, now, oath?.side);
  const stage = b.fighting && !ended && info ? stageLine(info) : null;
  const next = stage ? nextLine(info.next) : null;
  const bars = stage ? objectiveBars(info) : [];
  return (
    <div className="galaxy-warhud" role="status" style={{ '--side': SIDES[oath?.side]?.colour ?? '#9fb0d0' }} data-ended={ended || undefined}>
      <p className="galaxy-warhud-line">{line}</p>
      {stage && (
        <p className="galaxy-warhud-stage">
          {stage}
          {next && <span className="galaxy-warhud-next"> · {next}</span>}
        </p>
      )}
      {bars.length > 0 && (
        <ul className="galaxy-warhud-bars" aria-label="Objectives">
          {bars.map((o) => (
            <li key={o.id} data-down={o.down || undefined}>
              <span className="galaxy-warhud-name">{o.name}</span>
              <span className="galaxy-warhud-bar" style={{ '--k': o.k }} aria-label={`${Math.round(o.k * 100)}% left`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
