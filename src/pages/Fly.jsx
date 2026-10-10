import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle, useMediaQuery } from '../lib/hooks';
import { PLANETS, planetSpecOf } from '../lib/land/flight/planetSpec';
import { WorldHost, useWorld } from '../runtime';
import { wayOut } from '../components/worlds/worlds';
import FlightHud from '../components/expanse/flight/FlightHud';
import flightModule from '../components/expanse/flight/module';
import NotFound from './NotFound';
import '../components/expanse/flight/flight.css';

// The planets to fly to from the Menu: a spread of the fifty (lib/land/flight's PLANETS), one of each kind of ground
const NEXT_IDS = ['hoth', 'tatooine', 'endor', 'coruscant', 'bespin', 'mustafar', 'middle-earth', 'dot-matrix', 'gazorpazorp', 'cybertron'];
const NEXT = NEXT_IDS.map((id) => PLANETS.find((p) => p.id === id));

// A planet from low over its ground (/fly/hoth): the ship over an endless,
// streamed land, Echo Base flat among Hoth's ridges; /fly alone is Hoth.
// An unknown planet is the site's 404.
export default function Fly() {
  const { planet } = useParams();
  // (/fly alone is Hoth: where the tours and the map send you)
  const spec = useMemo(() => planetSpecOf(planet ?? 'hoth'), [planet]);
  if (!spec) return <NotFound />;
  // (a new planet is a new world: the key builds it again)
  return <Flight key={spec.id} spec={spec} />;
}

function Flight({ spec }) {
  useDocumentTitle(`${spec.name} · Planet flight`);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [toast, setToast] = useState(null);
  const numbers = useRef({});
  const [props] = useState(() => ({ spec }));

  const onEvent = useCallback((e) => {
    if (e.type === 'hud') {
      const n = numbers.current;
      if (n.speed) n.speed.textContent = String(Math.round(e.speed));
      if (n.alt) n.alt.textContent = String(Math.max(0, Math.round(e.alt)));
    } else if (e.type === 'toast') setToast({ key: Date.now(), text: e.text, bad: true });
  }, []);
  const { host, status, rt } = useWorld(flightModule, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === flightModule ? rt.current.world : null), [rt]);
  const mapProps = useMemo(() => ({ spec, source: api }), [spec, api]);

  return (
    <div className="pt-[var(--nav-h)]">
      <WorldHost world={{ host }} className="fly-stage">
        {status !== 'on' && <p className="fly-loading">Coming down over {spec.name}…</p>}
        <FlightHud
          name={spec.name}
          way={wayOut(pathname)}
          planets={NEXT.filter((p) => p.id !== spec.id)}
          onPlanet={(id) => navigate(`/fly/${id}`)}
          toast={toast}
          numbers={numbers}
          touch={touch}
          onStick={(x, y) => rt?.input?.setStick(x, y)}
          onThrottle={(v) => api()?.throttle?.(v)}
          map={mapProps}
        />
      </WorldHost>
    </div>
  );
}
