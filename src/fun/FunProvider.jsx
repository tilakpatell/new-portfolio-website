import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAchievements } from '../components/Achievements';
import { useTheme } from '../theme/ThemeProvider';
import { local, prefersReducedMotion } from '../lib/hooks';

// The easter eggs that reach across the whole site: Aurebesh mode (Star Wars),
// "say my name" (Breaking Bad), the snap (Marvel), that's-what-she-said and
// parkour (The Office), and roll out (Transformers). Each can be triggered from
// the terminal, the command palette, the home page, or by typing its word anywhere.

const FunContext = createContext(null);

const WORDS = [
  ['aurebesh', 'aurebesh'],
  ['saymyname', 'heisenberg'],
  ['heisenberg', 'heisenberg'],
  ['snap', 'snap'],
  ['twss', 'twss'],
  ['parkour', 'parkour'],
  ['rollout', 'optimus'],
  ['autobots', 'optimus'],
  ['megatron', 'megatron'],
  ['decepticons', 'megatron'],
  ['bumblebee', 'bumblebee'],
  ['shockwave', 'shockwave'],
  ['soundwave', 'soundwave'],
  ['mellon', 'shire'],
  ['mordor', 'mordor'],
  ['sauron', 'mordor'],
  ['youshallnotpass', 'gandalf'],
  ['precious', 'gollum'],
];
const TRANSFORMERS = ['optimus', 'megatron', 'bumblebee', 'shockwave', 'soundwave'];

export function FunProvider({ children }) {
  const { unlock, notify } = useAchievements();
  const { pin } = useTheme();
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

  // Native title tooltips are drawn by the browser in its own font, so in
  // Aurebesh mode they are swapped for ones the page draws.
  useEffect(() => {
    if (!aurebesh) return undefined;
    const swap = (root) => {
      const els = root.querySelectorAll ? root.querySelectorAll('[title]') : [];
      [root, ...els].forEach((el) => {
        if (!(el instanceof Element) || !el.hasAttribute('title')) return;
        el.setAttribute('data-ab-title', el.getAttribute('title'));
        el.removeAttribute('title');
      });
    };
    swap(document.body);
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'attributes' && m.target.hasAttribute?.('title')) swap(m.target);
        m.addedNodes.forEach((n) => n.nodeType === 1 && swap(n));
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
    const tip = document.createElement('div');
    tip.className = 'ab-tooltip';
    tip.setAttribute('aria-hidden', 'true');
    tip.hidden = true;
    document.body.appendChild(tip);
    const show = (e) => {
      const el = e.target instanceof Element ? e.target.closest('[data-ab-title]') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      tip.textContent = el.getAttribute('data-ab-title');
      tip.style.left = `${Math.min(window.innerWidth - 140, Math.max(140, r.left + r.width / 2))}px`;
      tip.style.top = `${Math.max(40, r.top)}px`;
      tip.hidden = false;
    };
    const hide = (e) => {
      const el = e.target instanceof Element ? e.target.closest('[data-ab-title]') : null;
      if (el) tip.hidden = true;
    };
    document.addEventListener('pointerover', show);
    document.addEventListener('pointerout', hide);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    return () => {
      mo.disconnect();
      document.removeEventListener('pointerover', show);
      document.removeEventListener('pointerout', hide);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
      tip.remove();
      // put the native tooltips back
      document.querySelectorAll('[data-ab-title]').forEach((el) => {
        el.setAttribute('title', el.getAttribute('data-ab-title'));
        el.removeAttribute('data-ab-title');
      });
    };
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
    import('../lib/clips').then((c) => c.playClip('sayMyName'));
    unlock('heisenberg');
    notify('Say my name.', 'Ti is titanium, element 22. Pa is protactinium, element 91.');
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
  }, [navigate, notify, unlock]);

  const snap = useCallback(async () => {
    const clips = import('../lib/clips');
    const { snapPage } = await import('./effects');
    if (!snapPage()) return;
    clips.then((c) => c.playClip('snap'));
    unlock('snap');
    notify('Perfectly balanced.', 'As all things should be. Everything comes back in a few seconds.', 'note', 'snap');
  }, [notify, unlock]);

  // `withGif` false when the clip is already showing somewhere else (the card).
  const twss = useCallback(
    (withGif = true) => {
      unlock('dundie');
      import('../lib/clips').then((c) => c.playClip('twss'));
      notify('That’s what she said.', 'Michael Scott, Regional Manager', 'note', withGif === false ? null : 'twss');
    },
    [notify, unlock],
  );

  const parkour = useCallback(async () => {
    const { parkourPage } = await import('./effects');
    parkourPage();
    notify('Parkour!', 'Hardcore parkour.', 'note', 'parkour');
  }, [notify]);

  // Transformers: one word unlocks all five, and the site transforms into that one.
  const rollOut = useCallback(
    (who = 'optimus') => {
      unlock('rollout');
      pin(TRANSFORMERS.includes(who) ? who : 'optimus');
    },
    [pin, unlock],
  );

  // Middle-earth: mellon opens the doors (and both themes); Mordor goes dark.
  const speakFriend = useCallback(
    (where = 'shire') => {
      unlock('mellon');
      pin(where === 'mordor' ? 'mordor' : 'shire');
    },
    [pin, unlock],
  );
  const gandalf = useCallback(() => {
    import('../lib/sfx').then((s) => s.thunder());
    notify('You shall not pass!', 'Gandalf, on the Bridge of Khazad-dûm', 'note');
    const root = document.documentElement;
    root.classList.remove('stand-ground');
    void root.offsetWidth;
    root.classList.add('stand-ground');
    setTimeout(() => root.classList.remove('stand-ground'), 900);
  }, [notify]);
  const gollum = useCallback(() => notify('My precious.', 'Gollum', 'note'), [notify]);

  // Typed anywhere outside a text field.
  useEffect(() => {
    let buffer = '';
    const actions = {
      aurebesh: toggleAurebesh,
      heisenberg: sayMyName,
      snap,
      twss,
      parkour,
      shire: () => speakFriend('shire'),
      mordor: () => speakFriend('mordor'),
      gandalf,
      gollum,
      ...Object.fromEntries(TRANSFORMERS.map((t) => [t, () => rollOut(t)])),
    };
    const onKey = (e) => {
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!/^[a-z]$/i.test(e.key)) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-16);
      const hit = WORDS.find(([word]) => buffer.endsWith(word));
      if (hit) {
        buffer = '';
        actions[hit[1]]();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gandalf, gollum, parkour, rollOut, sayMyName, snap, speakFriend, toggleAurebesh, twss]);

  const value = useMemo(
    () => ({ aurebesh, setAurebesh, toggleAurebesh, heisenberg, setHeisenberg, sayMyName, snap, twss, parkour, rollOut, speakFriend, gandalf }),
    [aurebesh, heisenberg, parkour, rollOut, sayMyName, setAurebesh, snap, toggleAurebesh, twss, speakFriend, gandalf],
  );

  return (
    <FunContext.Provider value={value}>
      {children}
      {aurebesh && (
        <div className="aurebesh-pill" role="status">
          <span aria-hidden="true">Aurebesh</span>
          <span className="sr-only">Aurebesh mode is on.</span>
          {/* the way back out stays in plain letters */}
          <button type="button" className="ab-keep" onClick={() => setAurebesh(false)}>
            Back to Basic
          </button>
        </div>
      )}
    </FunContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFun = () => useContext(FunContext);
