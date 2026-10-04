import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { byId } from '../components/universe/universes';
import { parseId } from '../components/universe/layout';
import { enterPlan } from '../components/universe/flight';
import { crewById, parseShip } from '../components/universe/crews';
import { START_KEY } from './Front';
import { portalSound } from '../components/universe/sounds';
import UniverseMap from '../components/universe/UniverseMap';
import UniversePanel from '../components/universe/UniversePanel';
import Comms from '../components/universe/Comms';
import StartChoice from '../components/universe/StartChoice';

const SHIP_KEY = 'tp-universe-ship';
const PORTAL = '#97ce4c';

// The universe map: every fandom on the site is a planet, and you travel
// between them, flying a ship of your choice (remembered between visits) or
// letting the camera take you. The URL is the selection (/universe/marvel),
// swapped in place so a link shares the view and Back leaves the map in one
// press. The page accent follows the selected universe, so the panel
// recolours as you go.
export default function Universe({ ask = false }) {
  const atRoot = useLocation().pathname === '/';
  useDocumentTitle(atRoot ? null : 'The universe'); // the front door keeps the site's own title
  const navigate = useNavigate();
  const selected = parseId(useParams().id);
  const universe = byId(selected);
  const reduced = useReducedMotion();
  const map = useRef({ live: false, dive: () => 0, escape: () => false, whole: () => false }); // the 3D map, while it's drawing
  const comms = useRef(null);
  const [ship, setShip] = useState(() => parseShip(local.get(SHIP_KEY)));
  const crew = crewById(ship);
  const [leaving, setLeaving] = useState(null); // { id, mode } once Enter is pressed
  const [asking, setAsking] = useState(ask); // the front door's choice, on a first arrival
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const select = useCallback((id) => navigate(id ? `/universe/${id}` : '/universe', { replace: true }), [navigate]);

  const pickShip = (id) => {
    audioContext(); // inside the press, so the engine can start
    setShip(id);
    local.set(SHIP_KEY, id);
  };

  // into a place: the selected one (Enter, E), or a station whose sign was clicked
  const go = (u) => {
    if (!u || leaving) return;
    const plan = enterPlan(u, { reduced, three: map.current.live, ship });
    if (plan.mode === 'now') {
      navigate(u.to);
      return;
    }
    audioContext(); // inside the press, so the way out can sound
    if (plan.mode === 'jump') window.dispatchEvent(new Event('tp:hyperspace'));
    else {
      if (plan.mode === 'portal') portalSound();
      map.current.dive(u.id);
    }
    setLeaving({ id: u.id, mode: plan.mode });
    timer.current = setTimeout(() => navigate(u.to), plan.delay);
  };
  const enter = () => go(universe);

  // the front door's choice: fly, or the home page; kept if asked to
  const start = (where, remember) => {
    if (remember) local.set(START_KEY, where);
    if (where === 'home') navigate('/home');
    else setAsking(false);
  };
  const startOn = (where) => local.set(START_KEY, where);

  const whole = () => {
    if (!map.current.whole()) select(null);
  };

  // Escape: back from the map view or the autopilot first, then out of the
  // universe; unless something took it already or a dialog is open. Heard on
  // the window, since a click on the map leaves the focus where it was.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || leaving) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (map.current.escape()) {
        e.preventDefault();
        return;
      }
      if (!selected) return;
      e.preventDefault();
      select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaving, selected, select]);

  const accent = universe ? { '--accent': universe.accent, '--accent-text': universe.accent, '--btn-bg': universe.accent } : undefined;
  const fade = leaving?.mode === 'portal' ? PORTAL : leaving?.mode === 'dive' ? byId(leaving.id).palette.base : undefined;

  return (
    <div className="dark-scope universe-page" style={accent} data-leaving={leaving?.mode} data-card={universe ? '' : undefined}>
      <h1 className="sr-only">Tilak Patel: the whole site as a universe</h1>
      <p className="sr-only" aria-live="polite">
        {universe ? `${universe.label}: selected` : ''}
      </p>
      <UniverseMap
        selected={selected}
        onSelect={select}
        onOpen={(id) => go(byId(id))}
        handle={map}
        frozen={Boolean(leaving)}
        ship={ship}
        onEvent={(e) => comms.current?.handle(e)}
        onLand={enter}
      />
      {crew && <Comms control={comms} crew={crew} reduced={reduced} />}
      <UniversePanel universe={universe} onSelect={select} onEnter={enter} onWhole={whole} leaving={Boolean(leaving)} ship={ship} onShip={pickShip} onStartOn={startOn} />
      {asking && <StartChoice onPick={start} />}
      <div className="universe-fade" aria-hidden="true" style={{ background: fade }} />
    </div>
  );
}
