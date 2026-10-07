import { Link } from 'react-router-dom';
import { WARS, WAR_IDS } from './sides';
import { areaLines, battleLine, oathOf, progressOf, recordLine, span, standing } from './warText';
import { templateFor } from './battles';
import { systemById } from './systems';

// The galaxy's wars on the holotable (HoloMap.jsx) and the panel
// (GalaxyPanel.jsx): which war you fight in (a tab for each era's), the oath
// to one of its two sides (the one sworn pressed, the one your crew or hero
// would pick outlined), your rank and record, the major order, the battles
// on now, and who holds each area; and, for one system, its place in the war
// with the battle on there and the ground battle to fight it on. The words
// are warText.js's; the page keeps the oath (allegiance.js).

// the war tabs and the oath, for both
export function Oath({ oath, suggested, record, onSwear, onTheatre, compact = false }) {
  const card = oathOf(oath.war, oath, suggested);
  const rec = recordLine(oath.side, record);
  return (
    <div className="galaxy-oath">
      {!compact && (
        <div className="galaxy-oath-wars" role="group" aria-label="The war you fight in">
          {WAR_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={oath.war === id} onClick={() => onTheatre?.(id)}>
              {WARS[id].short}
            </button>
          ))}
        </div>
      )}
      <div className="galaxy-oath-sides" role="group" aria-label={`Swear to a side of ${WARS[oath.war].name}`}>
        {card.sides.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.sworn} data-suggested={s.suggested && !oath.side ? '' : undefined} style={{ '--side': s.colour }} onClick={() => onSwear?.(s.id)}>
            {s.sworn ? `Sworn to the ${s.name}` : `Fly for the ${s.name}`}
          </button>
        ))}
      </div>
      <p className="galaxy-oath-n">{oath.side ? `${rec}${oath.turncoat ? ' · a turncoat' : ''}` : 'Sworn to nobody: in a battle, nobody’s sights are on you, and nothing you do counts.'}</p>
    </div>
  );
}

export default function WarCard({ table, now, oath, suggested, record, onSwear, onTheatre, onPick, onGo, current }) {
  const byId = Object.fromEntries(table.systems.map((r) => [r.id, r]));
  const major = table.major ? byId[table.major] : null;
  const battles = table.systems.filter((r) => r.battle).sort((a, b) => (b.major ? 1 : 0) - (a.major ? 1 : 0) || (a.attack ? -1 : 0) - (b.attack ? -1 : 0));
  const w = WARS[table.war];
  return (
    <section className="holomap-warcard" aria-label={w.name}>
      <Oath oath={oath} suggested={suggested} record={record} onSwear={onSwear} onTheatre={onTheatre} />
      <p className="holomap-kicker">
        {w.name} · campaign {table.campaign + 1} · {span(table.ends - now)} left
      </p>
      {table.over && <p className="holomap-meta">Won by the {w.liberator === table.over ? 'liberators' : 'raiders'}: every system is theirs till the next campaign.</p>}
      {major && (
        <button type="button" className="holomap-order" onClick={() => onPick(major.id)} style={{ '--control': progressOf(major) }}>
          <span className="holomap-order-k">★ Major order</span>
          <span className="holomap-order-t">
            {oath.side && oath.side === major.owner ? 'Hold' : 'Liberate'} {major.name}
          </span>
          <span className="holomap-order-bar" aria-hidden="true">
            <span />
          </span>
          <span className="holomap-order-n">{standing(major, now)}</span>
        </button>
      )}
      {battles.length > 0 && (
        <ul className="holomap-battles" aria-label="The battles on now">
          {battles.map((row) => (
            <li key={row.id} data-attack={row.attack ? '' : undefined}>
              <button type="button" onClick={() => onGo(row.id)}>
                <span className="holomap-battles-t">
                  {templateFor(row.id, table.war).name}
                  {row.id === current ? ' (here)' : ''}
                </span>
                <span className="holomap-battles-n">{battleLine(row, now, oath.side)}</span>
                <span className="holomap-battles-n">{standing(row, now)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="galaxy-areas" aria-label="Who holds each area">
        {areaLines(table.areas, oath.side).map((a) => (
          <li key={a.id} data-yours={a.yours || undefined}>
            <span>{a.name}</span> <span>{a.text}</span>
          </li>
        ))}
      </ul>
      <p className="holomap-meta">What you do in a battle counts for the side you swore to, here, for everyone online.</p>
    </section>
  );
}

// one system's place in the war: who holds it, the battle on there, and the
// ground battle to fight it on where it has one
export function SystemWar({ row, war, now, side }) {
  if (!row) return null;
  const sys = systemById(row.id);
  const ground = sys?.game?.also?.find((a) => a.id === 'assault' && a.to);
  return (
    <>
      <div>
        <dt>{WARS[war].short}</dt>
        <dd>{standing(row, now)}</dd>
      </div>
      {row.battle && (
        <div>
          <dt>{templateFor(row.id, war).name}</dt>
          <dd>{battleLine(row, now, side)}</dd>
        </div>
      )}
      {ground && row.battle && (
        <div>
          <dt>On the ground</dt>
          <dd>
            <Link to={ground.to}>Fight it on the ground</Link>
          </dd>
        </div>
      )}
    </>
  );
}
