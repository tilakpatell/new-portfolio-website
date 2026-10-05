import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { local, useDocumentTitle, useReducedMotion } from '../lib/hooks';
import { audioContext } from '../lib/audio';
import { CREWS, SHIP_KEY, crewById, parseShip } from '../components/universe/crews';
import { LOADOUT_KEY, loadoutOf, readLoadouts } from '../components/universe/outfit';
import { useAchievements } from '../components/Achievements';
import Comms from '../components/universe/Comms';
import Online from '../components/universe/online/Online';
import { useOnline } from '../components/universe/online/useOnline';
import { FIRST, parseSystem, systemById } from '../components/galaxy/systems';
import { galaxyCrew } from '../components/galaxy/lines';
import GalaxyView from '../components/galaxy/GalaxyView';
import GalaxyPanel from '../components/galaxy/GalaxyPanel';
import HoloMap from '../components/galaxy/HoloMap';
import GalaxyIntro from '../components/galaxy/GalaxyIntro';
import '../components/galaxy/galaxy.css';

const LAST_KEY = 'tp-galaxy-system'; // the system you were last in
const PANEL_KEY = 'tp-galaxy-panel'; // 'tucked' once the panel's been put away
const INTRO_KEY = 'tp-galaxy-intro'; // (session) the "long time ago" seen this visit

// A galaxy far, far away: the Star Wars galaxy as a universe of its own,
// inside the universe map (the Star Wars planet there jumps you here). You
// fly the same ship, the same way, one star system at a time (Tatooine,
// Hoth, Endor, Yavin, Coruscant, Naboo… nineteen of them), and jump to
// lightspeed between them from the galaxy map (HoloMap.jsx, M). The URL is
// the system you're in (/galaxy/hoth), swapped in place as you arrive, so a
// link drops you out of hyperspace there, and a link to another system
// while you're here sends you jumping to it. Each system's card (the
// panel) has its era and films, the moment it's shown at, and its mission:
// a briefing for the game it'll be (/galaxy/hoth/mission), or the way into
// one that's here already (the Death Star's trench run). Online, the pilots
// in the same system are there with you.
export default function Galaxy() {
  const navigate = useNavigate();
  const param = parseSystem(useParams().system);
  const [current, setCurrent] = useState(() => param ?? parseSystem(local.get(LAST_KEY)) ?? FIRST);
  const sys = systemById(current);
  useDocumentTitle(`${sys.name} · A galaxy far, far away`);
  const reduced = useReducedMotion();
  const view = useRef({ live: false, jump: () => false, goTo: () => false, escape: () => false });
  const comms = useRef(null);
  const [ship, setShip] = useState(() => parseShip(local.get(SHIP_KEY)));
  const crew = crewById(ship);
  const online = useOnline();
  const { setKind, setLoadout } = online;
  useEffect(() => setKind(ship), [setKind, ship]);
  // the ship as it's fitted in the universe map's hangar: its paint and parts
  const { unlocked } = useAchievements();
  const loadout = useMemo(() => loadoutOf(readLoadouts(local.get(LOADOUT_KEY), CREWS.map((c) => c.id)), ship, unlocked), [ship, unlocked]);
  useEffect(() => setLoadout(loadout), [setLoadout, loadout]);
  const [at, setAt] = useState(null); // what in the system you're at (its planet, the Death Star…)
  const [mapOpen, setMapOpen] = useState(false);
  const [jumping, setJumping] = useState(null); // { to, phase } while a jump's on
  const [leaving, setLeaving] = useState(null); // { to } once you're on your way out of the page
  const [tucked, setTucked] = useState(() => local.get(PANEL_KEY) === 'tucked');
  const [intro, setIntro] = useState(() => {
    try {
      return !reduced && window.sessionStorage.getItem(INTRO_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  // the URL is the system you're in: put it right as you come in
  useEffect(() => {
    if (!param) navigate(`/galaxy/${current}`, { replace: true });
  }, [param, current, navigate]);
  useEffect(() => {
    local.set(LAST_KEY, current);
  }, [current]);

  const tuck = (on) => {
    setTucked(on);
    local.set(PANEL_KEY, on ? 'tucked' : 'open');
  };
  const pickShip = (id) => {
    audioContext();
    setShip(id);
    local.set(SHIP_KEY, id);
  };

  // out of the page: the screen fades, and on
  const leave = useCallback(
    (to, { jump = false } = {}) => {
      if (leaving) return;
      setLeaving({ to });
      if (jump) window.dispatchEvent(new Event('tp:hyperspace'));
      timer.current = setTimeout(() => navigate(to), jump ? 1250 : 650);
    },
    [leaving, navigate],
  );

  // what the scene says: to the comms, and to the page
  const onEvent = useCallback(
    (e) => {
      if (e.type === 'map') {
        setMapOpen((o) => !o);
        return;
      }
      if (e.type === 'jumpKey') {
        setMapOpen(true);
        return;
      }
      if (e.type === 'jump') {
        setJumping(e.phase === 'cancel' ? null : { to: e.to, phase: e.phase });
        if (e.phase === 'spool') comms.current?.handle({ type: 'event', id: 'jump' });
        return;
      }
      if (e.type === 'tractor') {
        comms.current?.handle({ type: 'event', id: 'tractor' });
        return;
      }
      if (e.type === 'boarded') {
        comms.current?.handle({ type: 'event', id: 'boarded' });
        return;
      }
      if (e.type === 'action') {
        const s = systemById(current);
        if (e.id === 'deathstar') leave('/deathstar');
        else if (e.id === 'planet' || e.id === 'cloudcity') navigate(s.game.status === 'live' && s.game.to ? s.game.to : `/galaxy/${s.id}/mission`);
        return;
      }
      comms.current?.handle(e);
    },
    [current, leave, navigate],
  );
  const onArrive = useCallback(
    (id) => {
      setJumping(null);
      setAt(null);
      setCurrent(id);
      navigate(`/galaxy/${id}`, { replace: true });
    },
    [navigate],
  );
  const onBoard = useCallback((path) => leave(path), [leave]);

  // a course plotted on the map: away you go
  const jumpTo = (id) => {
    setMapOpen(false);
    audioContext();
    if (!view.current.jump(id)) navigate(`/galaxy/${id}`, { replace: true });
  };

  // Escape: shut the map, stop coming round for a jump or flying itself
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || leaving) return;
      if (mapOpen) {
        e.preventDefault();
        setMapOpen(false);
        return;
      }
      if (document.querySelector('[aria-modal="true"]')) return;
      if (view.current.escape()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapOpen, leaving]);

  // (every system's colour is light, readable on the dark page: so dark on a button)
  const accent = { '--accent': sys.accent, '--accent-text': sys.accent, '--btn-bg': sys.accent, '--btn-ink': '#03040a' };
  return (
    <div className="dark-scope universe-page galaxy-page" style={accent} data-tucked={tucked ? '' : undefined} data-card="" data-leaving={leaving ? 'fade' : undefined} data-jumping={jumping?.phase}>
      <h1 className="sr-only">A galaxy far, far away: {sys.name}</h1>
      <p className="sr-only" aria-live="polite">
        {jumping ? `Jumping to ${systemById(jumping.to)?.name ?? 'lightspeed'}` : `In the ${sys.system ?? sys.name} system`}
      </p>
      <GalaxyView
        system={param ?? current}
        here={current}
        handle={view}
        ship={ship}
        loadout={loadout}
        net={online.client}
        frozen={Boolean(leaving) || intro}
        onEvent={onEvent}
        onArrive={onArrive}
        onAt={setAt}
        onBoard={onBoard}
        onMap={() => setMapOpen(true)}
      />
      {crew && <Comms control={comms} crew={galaxyCrew(crew)} reduced={reduced} />}
      {!leaving && <Online online={online} ship={ship} />}
      <GalaxyPanel
        system={sys}
        at={at}
        ship={ship}
        onShip={pickShip}
        onMap={() => setMapOpen(true)}
        onGo={(id) => view.current.goTo(id)}
        onLeave={() => leave('/universe/starwars', { jump: true })}
        onBoard={(path) => leave(path)}
        tucked={tucked}
        onTuck={tuck}
        jumping={jumping}
      />
      {mapOpen && <HoloMap current={current} online={online} onJump={jumpTo} onClose={() => setMapOpen(false)} onLeave={() => leave('/universe/starwars', { jump: true })} />}
      {intro && (
        <GalaxyIntro
          onDone={() => {
            try {
              window.sessionStorage.setItem(INTRO_KEY, '1');
            } catch {
              /* storage unavailable */
            }
            setIntro(false);
          }}
        />
      )}
      <div className="universe-fade" aria-hidden="true" style={{ background: '#000' }} />
    </div>
  );
}
