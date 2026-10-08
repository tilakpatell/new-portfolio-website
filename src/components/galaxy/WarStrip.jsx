import Emblem from './Emblem';
import { SIDES, WARS, WAR_IDS } from './sides';
import { strengthLine } from './warText';

// The war on the holotable at a glance, over the map's empty north: which of
// the galaxy's wars it shows (a switch for looking only: the war you fight
// in is your oath's, and changes from the war card, WarCard.jsx), and each of
// its powers' systems, share of the galaxy's worth and which way it's gone
// in six hours (gcw.js's strength), with a bar of the three: the liberator,
// the Hutts between, the raider.
export default function WarStrip({ table, view, onView, fighting }) {
  const w = WARS[table.war];
  const sides = [w.liberator, 'hutt', w.raider];
  const strength = table.strength ?? {};
  return (
    <div className="holomap-strip">
      <div className="holomap-strip-wars" role="group" aria-label="The war the map shows">
        {WAR_IDS.map((id) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => onView(id)}>
            {WARS[id].short}
            {id === fighting && (
              <span className="holomap-strip-yours" title="The war you fight in">
                <span className="sr-only"> (the war you fight in)</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="holomap-strip-board">
        <ul className="holomap-strip-sides" aria-label={`Who holds what in ${w.name}`}>
          {sides.map((side) => {
            const r = strength[side];
            if (!r) return null;
            const trend = r.trend6h > 0 ? 'up' : r.trend6h < 0 ? 'down' : undefined;
            return (
              <li key={side} style={{ '--side': SIDES[side].colour }}>
                <Emblem side={side} />
                <span className="holomap-strip-name" aria-hidden="true">
                  {SIDES[side].short}
                </span>
                <span className="holomap-strip-n" aria-hidden="true">
                  {r.systems}
                </span>
                <span className="holomap-strip-share" aria-hidden="true">
                  {Math.round(r.share * 100)}%
                </span>
                <span className="holomap-strip-trend" data-trend={trend} aria-hidden="true">
                  {trend === 'up' ? `▲${r.trend6h}` : trend === 'down' ? `▼${-r.trend6h}` : ''}
                </span>
                <span className="sr-only">
                  {SIDES[side].short}: {strengthLine(table, side)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="holomap-strip-bar" aria-hidden="true">
          {sides.map((side) => (
            <span key={side} style={{ flexGrow: strength[side]?.share ?? 0, '--side': SIDES[side].colour }} />
          ))}
        </div>
      </div>
    </div>
  );
}
