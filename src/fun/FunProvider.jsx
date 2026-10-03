import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAchievements } from '../components/Achievements';
import { local, prefersReducedMotion } from '../lib/hooks';

// The easter eggs that reach across the whole site: Aurebesh mode (Star Wars),
// "say my name" (Breaking Bad), the snap (Marvel), that's-what-she-said and
// parkour (The Office). Each can be triggered from the terminal, the command
// palette, the interests on the home page, or by typing its word anywhere.

const FunContext = createContext(null);

const WORDS = [
  ['aurebesh', 'aurebesh'],
  ['saymyname', 'heisenberg'],
  ['heisenberg', 'heisenberg'],
  ['snap', 'snap'],
  ['twss', 'twss'],
  ['parkour', 'parkour'],
];

export function FunProvider({ children }) {
  const { unlock, notify } = useAchievements();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [aurebesh, setAurebeshState] = useState(() => local.get('tp-aurebesh', false) === true);
  const [heisenberg, setHeisenberg] = useState(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    document.documentElement.dataset.aurebesh = aurebesh ? 'true' : 'false';
    local.set('tp-aurebesh', aurebesh);
  }, [aurebesh]);

  const setAurebesh = useCallback(
    (on) => {
      setAurebeshState(on);
      if (on) {
        unlock('aurebesh');
        notify('Aurebesh mode', 'Headings now read in Aurebesh. Turn it off from the pill at the bottom.');
      }
    },
    [notify, unlock],
  );
  const toggleAurebesh = useCallback(() => setAurebesh(!(document.documentElement.dataset.aurebesh === 'true')), [setAurebesh]);

  const heisenbergRef = useRef(false);
  heisenbergRef.current = heisenberg;
  const sayMyName = useCallback(() => {
    // Saying it again puts the plain name back.
    if (heisenbergRef.current && pathRef.current === '/') {
      setHeisenberg(false);
      return;
    }
    if (pathRef.current !== '/') navigate('/');
    setHeisenberg(true);
    unlock('heisenberg');
    notify('Say my name.', 'Ti is titanium, element 22. Pa is protactinium, element 91.');
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
  }, [navigate, notify, unlock]);

  const snap = useCallback(async () => {
    const { snapPage } = await import('./effects');
    if (!snapPage()) return;
    unlock('snap');
    notify('Perfectly balanced.', 'As all things should be. Everything comes back in a few seconds.', 'note', 'snap');
  }, [notify, unlock]);

  // `withGif` false when the clip is already showing somewhere else (the card).
  const twss = useCallback(
    (withGif = true) => {
      unlock('dundie');
      notify('That’s what she said.', 'Michael Scott, Regional Manager', 'note', withGif === false ? null : 'twss');
    },
    [notify, unlock],
  );

  const parkour = useCallback(async () => {
    const { parkourPage } = await import('./effects');
    parkourPage();
    notify('Parkour!', 'Hardcore parkour.', 'note', 'parkour');
  }, [notify]);

  // Typed anywhere outside a text field.
  useEffect(() => {
    let buffer = '';
    const actions = { aurebesh: toggleAurebesh, heisenberg: sayMyName, snap, twss, parkour };
    const onKey = (e) => {
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!/^[a-z]$/i.test(e.key)) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-12);
      const hit = WORDS.find(([word]) => buffer.endsWith(word));
      if (hit) {
        buffer = '';
        actions[hit[1]]();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parkour, sayMyName, snap, toggleAurebesh, twss]);

  const value = useMemo(
    () => ({ aurebesh, setAurebesh, toggleAurebesh, heisenberg, setHeisenberg, sayMyName, snap, twss, parkour }),
    [aurebesh, heisenberg, parkour, sayMyName, setAurebesh, snap, toggleAurebesh, twss],
  );

  return (
    <FunContext.Provider value={value}>
      {children}
      {aurebesh && (
        <div className="aurebesh-pill" role="status">
          <span className="aurebesh" aria-hidden="true">
            Aurebesh
          </span>
          <span className="sr-only">Aurebesh mode is on.</span>
          <button type="button" onClick={() => setAurebesh(false)}>
            Back to Basic
          </button>
        </div>
      )}
    </FunContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFun = () => useContext(FunContext);
