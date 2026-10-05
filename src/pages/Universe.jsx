import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { byId } from '../components/universe/universes';
import { parseId } from '../components/universe/layout';
import { beyondPlan, crashPlan, enterPlan } from '../components/universe/flight';
import { beyondOf } from '../components/universe/deep';
import { DRIVE_KEY, parseDrive } from '../components/universe/nav';
import { CREWS, SHIP_KEY, crewById, parseShip } from '../components/universe/crews';
import { LOADOUT_KEY, equip, loadoutOf, readLoadouts } from '../components/universe/outfit';
import { useAchievements } from '../components/Achievements';
import { saveStart } from '../lib/view';
import { useView } from '../components/ViewSwitch';
import { portalSound } from '../components/universe/sounds';
import UniverseMap from '../components/universe/UniverseMap';
import UniversePanel from '../components/universe/UniversePanel';
import Comms from '../components/universe/Comms';
import StartChoice from '../components/universe/StartChoice';
import Rain from '../components/universe/Rain';
import NavMap from '../components/universe/NavMap';
import Online from '../components/universe/online/Online';
import { useOnline } from '../components/universe/online/useOnline';

const PORTAL = '#97ce4c';
const PANEL_KEY = 'tp-universe-panel'; // 'tucked' once the panel's been put away

// The universe map: every fandom on the site is a planet, and you travel
// between them, flying a ship of your choice (remembered between visits,
// each fitted out in the hangar its own way: outfit.js) or letting the
// camera take you. The URL is the selection (/universe/marvel),
// swapped in place so a link shares the view and Back leaves the map in one
// press. The page accent follows the selected universe, so the panel
// recolours as you go. Fly into a planet too fast and the crash takes you
// into its page; fall into the black hole out in deep space and you're
// through to a friend's universe, their own site (deep.js's `beyond`).
// Gone online (online/), everyone else flying it right then is there too,
// in their own ships: allies, or fair game. The nav map (M, or its button:
// NavMap.jsx) charts it all and sends you anywhere by the drive picked
// there (nav.js: hyperspeed, super speed or cruise; kept between visits),
// which is how picking a place anywhere else on the page goes too.
export default function Universe({ ask = false }) {
  const atRoot = useLocation().pathname === '/';
  useDocumentTitle(atRoot ? null : 'The universe'); // the front door keeps the site's own title
  const navigate = useNavigate();
  const selected = parseId(useParams().id);
  const universe = byId(selected);
  const reduced = useReducedMotion();
  const map = useRef({ live: false, dive: () => 0, escape: () => false, whole: () => false, travel: () => false, where: () => null }); // the 3D map, while it's drawing
  const comms = useRef(null);
  const [ship, setShip] = useState(() => parseShip(local.get(SHIP_KEY)));
  const crew = crewById(ship);
  const online = useOnline(); // (OnlineProvider, above the pages: the link stays up off the map)
  const { setKind, setLoadout } = online;
  useEffect(() => setKind(ship), [setKind, ship]);
  // what each ship's fitted with in the hangar (kept between visits): the
  // paint job and parts it flies with, while they're still earned
  const { unlocked, unlock } = useAchievements();
  const [loadouts, setLoadouts] = useState(() => readLoadouts(local.get(LOADOUT_KEY), CREWS.map((c) => c.id)));
  const loadout = useMemo(() => loadoutOf(loadouts, ship, unlocked), [loadouts, ship, unlocked]);
  useEffect(() => setLoadout(loadout), [setLoadout, loadout]);
  const [hangar, setHangar] = useState(false);
  // the nav map, and the drive picked on it (kept between visits)
  const [charting, setCharting] = useState(false);
  const [drive, setDriveState] = useState(() => parseDrive(local.get(DRIVE_KEY)));
  const setDrive = (d) => {
    const next = parseDrive(d);
    setDriveState(next);
    local.set(DRIVE_KEY, next);
  };
  const jumped = useRef(false); // the crew's had their say about a jump this visit
  const fit = (slot, id) => {
    const r = equip(ship, loadout, slot, id, unlocked);
    if (r.ok) {
      const next = { ...loadouts, [ship]: r.loadout };
      setLoadouts(next);
      local.set(LOADOUT_KEY, next);
    }
    return r;
  };
  const [leaving, setLeaving] = useState(null); // { id, mode } once Enter is pressed
  const [asking, setAsking] = useState(ask); // the front door's choice, on a first arrival
  // the panel, put away to give the map the room (remembered between visits)
  const [tucked, setTucked] = useState(() => local.get(PANEL_KEY) === 'tucked');
  const tuck = (on) => {
    setTucked(on);
    local.set(PANEL_KEY, on ? 'tucked' : 'open');
  };
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  // out of the cockpit's launch (App's intro, or ⌘K's replay): flying the
  // ship it was, with no question first. Sat down in the cockpit with no
  // ship yet (a first visit), that one's made under it as you sit there
  // (tp:board, again if you change seats), so the flash comes out on a
  // ship that's ready; a replay keeps the ship it's flying until the flash.
  const boarding = useRef(false);
  const flyingNow = useRef(ship);
  flyingNow.current = ship;
  useEffect(() => {
    const arrive = (e) => {
      boarding.current = false;
      const id = parseShip(e.detail?.ship);
      if (id) setShip(id);
      setAsking(false);
    };
    const board = (e) => {
      const id = parseShip(e.detail?.ship);
      if (!id || (flyingNow.current && !boarding.current)) return;
      boarding.current = true;
      setShip(id);
      setAsking(false);
    };
    window.addEventListener('tp:arrive', arrive);
    window.addEventListener('tp:board', board);
    return () => {
      window.removeEventListener('tp:arrive', arrive);
      window.removeEventListener('tp:board', board);
    };
  }, []);

  const select = useCallback((id) => navigate(id ? `/universe/${id}` : '/universe', { replace: true }), [navigate]);

  const pickShip = (id) => {
    audioContext(); // inside the press, so the engine can start
    setShip(id);
    local.set(SHIP_KEY, id);
  };

  // into a place: the selected one (Enter, E), or a station whose sign was clicked
  const go = (u) => {
    if (!u || leaving) return;
    setCharting(false);
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

  // flown into a planet or a station too fast: once the crash has played,
  // on into its page, the screen washing out in its colour (true tells the
  // map the ship isn't coming back; the sun, with no page, sends it back).
  // Fallen into the black hole: on through to what's on its far side, a
  // friend's universe (deep.js's `beyond`), the screen going black on the
  // way, and the site left behind (Back brings you home)
  const crashInto = (id, page = null) => {
    if (leaving) return false;
    const far = beyondOf(id);
    if (far) {
      const plan = beyondPlan({ reduced });
      setLeaving({ id, mode: plan.mode });
      timer.current = setTimeout(() => window.location.assign(far.url), plan.delay);
      return true;
    }
    const u = byId(id);
    const plan = crashPlan(u, { reduced });
    if (!plan) return false;
    setLeaving({ id: u.id, mode: plan.mode });
    // (a wonder with a page of its own, the Citadel, goes there)
    timer.current = setTimeout(() => navigate(page ?? u.crashTo ?? u.to), plan.delay);
    return true;
  };

  // the front door's choice: fly, or the home page; kept if asked to
  const start = (where, remember) => {
    if (remember) saveStart(where);
    if (where === 'home') navigate('/home');
    else setAsking(false);
  };
  const { switchTo } = useView();

  const whole = () => {
    if (!map.current.whole()) select(null);
  };

  // what the scene says: the nav map (M), a jump to lightspeed (the site's
  // own jump plays over the map: the scene has the ship out at the place
  // under its flash), through a gate, or something for the crew to say
  const onEvent = (e) => {
    if (e.type === 'map') setCharting((o) => !o);
    else if (e.type === 'jump') {
      window.dispatchEvent(new Event('tp:hyperspace'));
      if (!jumped.current) {
        jumped.current = true;
        comms.current?.handle({ type: 'event', id: 'hyperspeed' });
      }
    } else if (e.type === 'portal') go(byId(e.id));
    else if (e.type === 'siege' && e.what === 'down' && e.mine) {
      unlock('citadelfall'); // (you helped bring it down)
      comms.current?.handle(e);
    } else comms.current?.handle(e);
  };

  // off from the nav map: with a ship, it flies (or jumps) there, and a
  // station or a world is picked too, so the panel shows it; without one
  // (or with the 3D off), the camera takes you to a station or a world
  const travel = (id, d) => {
    setDrive(d);
    setCharting(false);
    audioContext(); // inside the press, so the jump and the engine can sound
    const u = byId(id);
    if (ship && map.current.live) {
      map.current.travel(id, d);
      select(u ? id : null); // (a wonder has no card: the panel goes back to the map's)
    } else if (u) select(id);
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
  const fade = leaving?.mode === 'portal' ? PORTAL : leaving?.mode === 'beyond' ? '#000' : leaving?.mode === 'dive' || leaving?.mode === 'crash' ? byId(leaving.id).palette.base : undefined;

  return (
    <div className="dark-scope universe-page" style={accent} data-leaving={leaving?.mode} data-card={universe ? '' : undefined} data-tucked={tucked ? '' : undefined}>
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
        shipName={crew?.ship ?? ''}
        loadout={loadout}
        onFit={ship ? fit : null}
        hangar={hangar}
        onHangar={setHangar}
        net={online.client}
        onEvent={onEvent}
        drive={drive}
        charting={charting}
        onMap={() => setCharting((o) => !o)}
        onLand={enter}
        onCrash={crashInto}
      />
      {crew && <Comms control={comms} crew={crew} reduced={reduced} />}
      {!asking && !leaving && <Online online={online} ship={ship} />}
      <UniversePanel
        universe={universe}
        onSelect={select}
        onEnter={enter}
        onWhole={whole}
        leaving={Boolean(leaving)}
        ship={ship}
        loadout={loadout}
        onShip={pickShip}
        onHangar={() => setHangar(true)}
        onClassic={() => switchTo('classic')}
        tucked={tucked}
        onTuck={tuck}
        onNav={() => setCharting(true)}
      />
      {charting && !leaving && (
        <NavMap
          where={map.current.live ? map.current.where : null}
          drive={drive}
          onDrive={setDrive}
          selected={selected}
          live={map.current.live}
          onTravel={travel}
          onEnter={(id) => go(byId(id))}
          onWhole={() => {
            setCharting(false);
            whole();
          }}
          onClose={() => setCharting(false)}
        />
      )}
      {asking && <StartChoice onPick={start} />}
      <div className="universe-fade" aria-hidden="true" style={{ background: fade }} />
      {leaving?.mode === 'beyond' && <Beyond far={beyondOf(leaving.id)} />}
    </div>
  );
}

// Through the black hole: over the black, the far side's falling code and
// where you're going, while the crew have their say above it. The page
// leaves for it once the plan's time is up; the link is there for anyone
// who can't wait.
function Beyond({ far }) {
  return (
    <>
      <Rain />
      <div className="universe-beyond" role="status">
        <p className="universe-beyond-kicker">Through the Maw</p>
        <p className="universe-beyond-text">
          On the far side is a friend’s universe: <a href={far.url}>{far.name}</a>’s portfolio, {far.what}.
        </p>
      </div>
    </>
  );
}
