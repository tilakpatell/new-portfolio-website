import { useEffect, useRef, useState } from 'react';
import { offerIcon } from './icons.js';
import { offerRows } from './widgets.js';

// The deploy screen (UI/Customize/Screens/SpawnOverlayScreen): over the
// level's overview camera while the battle runs; the classes, then the
// reinforcements and the heroes at their Battle Point cost, greyed when they
// cannot be had. Enter deploys the one picked (the page's input reads it;
// this listens too, for a click on the button). A modal dialog: the focus
// starts on the first offer and stays inside.
//
//   <DeployScreen deploy={{ open, offers, timeLeft }} points={n} name={(offer) => text} onDeploy={(offer) => …} />
export default function DeployScreen({ deploy, points = 0, name = (o) => o.id, title = 'Deploy', onDeploy }) {
  const rows = offerRows(deploy?.offers ?? [], points);
  const first = rows.find((r) => r.affordable) ?? null;
  const [picked, setPicked] = useState(first?.id ?? null);
  const firstButton = useRef(null);
  const chosen = rows.find((r) => r.id === picked && r.affordable) ?? first;
  useEffect(() => {
    firstButton.current?.focus({ preventScroll: true });
  }, []);
  if (!deploy?.open) return null;
  return (
    <div className="bf-screen" role="dialog" aria-modal="true" aria-labelledby="bf-deploy-title">
      <div className="bf-panel">
        <h2 id="bf-deploy-title">{title}</h2>
        <ul className="bf-offers">
          {rows.map((o, i) => (
            <li key={`${o.kind}:${o.id}`}>
              <button
                ref={i === 0 ? firstButton : undefined}
                type="button"
                className="bf-offer"
                aria-pressed={chosen?.id === o.id}
                aria-disabled={!o.affordable}
                onClick={() => o.affordable && setPicked(o.id)}
                onDoubleClick={() => o.affordable && onDeploy?.(o)}
              >
                <img src={offerIcon(o)} alt="" width="36" height="36" />
                <span>{name(o)}</span>
                <span className="bf-num">{o.cost ? o.cost.toLocaleString('en-GB') : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="bf-deploy-foot">
          <span>
            Battle Points <span className="bf-num">{points.toLocaleString('en-GB')}</span>
          </span>
          <button type="button" className="bf-offer" style={{ width: 'auto' }} disabled={!chosen} onClick={() => chosen && onDeploy?.(chosen)}>
            <span />
            <span>
              <kbd className="hud-cap">Enter</kbd> Deploy
            </span>
            <span />
          </button>
        </div>
      </div>
    </div>
  );
}
