import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAchievements } from '../components/Achievements';
import { useTheme } from '../theme/ThemeProvider';
import { local, prefersReducedMotion } from '../lib/hooks';
import { BACK, SCRIPTS, scriptFor } from './scripts';

// The easter eggs that reach across the whole site: language mode (Aurebesh,
// Cybertronian or runes, by theme),
// "say my name" (Breaking Bad), the snap (Marvel), that's-what-she-said and
// parkour (The Office), and roll out (Transformers). Each can be triggered from
// the terminal, the command palette, the home page, or by typing its word anywhere.

const FunContext = createContext(null);

const WORDS = [
  ['aurebesh', 'aurebesh'],
  ['cybertronian', 'cybertronian'],
  ['runes', 'runes'],
  ['english', 'english'],
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
  ['wubbalubbadubdub', 'portal'],
  ['schwifty', 'portal'],
  ['picklerick', 'pickle'],
];
const TRANSFORMERS = ['optimus', 'megatron', 'bumblebee', 'shockwave', 'soundwave'];
const SMITHS = ['portal', 'morty', 'summer', 'beth'];

export function FunProvider({ children }) {
  const { unlock, notify } = useAchievements();
  const { pin, active } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // null (plain English), 'theme' (whatever the active theme speaks) or one script
  const [lang, setLang] = useState(() => {
    const saved = local.get('tp-script', null);
    if (saved === 'theme' || SCRIPTS[saved]) return saved;
    return local.get('tp-aurebesh', false) === true ? 'aurebesh' : null;
  });
  const script = lang === 'theme' ? scriptFor(active) : lang;
  const [heisenberg, setHeisenberg] = useState(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const root = document.documentElement;
    if (script) root.dataset.script = script;
    else delete root.dataset.script;
    local.set('tp-script', lang);
  }, [lang, script]);

  // Each script read counts toward Polyglot; Aurebesh opens the Star Wars themes.
  useEffect(() => {
    if (!script) return;
    if (script === 'aurebesh') unlock('aurebesh');
    const read = new Set(local.get('tp-scripts-read', []));
    read.add(script);
    local.set('tp-scripts-read', [...read]);
    if (Object.keys(SCRIPTS).every((id) => read.has(id))) unlock('polyglot');
  }, [script, unlock]);

  // Native title tooltips are drawn by the browser in its own font, so in
  // language mode they are swapped for ones the page draws.
  const scripted = Boolean(script);
  useEffect(() => {
    if (!scripted) return undefined;
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
  }, [scripted]);

  // `next`: 'theme', a script id, or null for plain English.
  const activeRef = useRef(active);
  activeRef.current = active;
  const setScript = useCallback(
    (next) => {
      setLang(next);
      if (!next) return;
      const id = next === 'theme' ? scriptFor(activeRef.current) : next;
      notify(`${SCRIPTS[id].name} mode`, `The whole site now reads in ${SCRIPTS[id].name}. ${BACK} is at the bottom of the screen, or type english.`);
    },
    [notify],
  );
  const langRef = useRef(lang);
  langRef.current = lang;
  // The theme's own language, or back to English.
  const toggleScript = useCallback(() => setScript(langRef.current ? null : 'theme'), [setScript]);
  // Typed or asked for by name: that script, whatever the theme.
  const toggleAurebesh = useCallback(() => setScript(langRef.current === 'aurebesh' ? null : 'aurebesh'), [setScript]);

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
    import('../lib/clips').then((c) => c.playClip('sayMyName', { keep: true }));
    unlock('heisenberg');
    notify('Say my name.', 'Ti is titanium, element 22. Pa is protactinium, element 91.');
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
  }, [navigate, notify, unlock]);

  const snap = useCallback(async () => {
    const clips = import('../lib/clips');
    const { snapPage } = await import('./effects');
    if (!snapPage()) return;
    clips.then((c) => c.playClip('snap', { keep: true }));
    unlock('snap');
    notify('Perfectly balanced.', 'As all things should be. Everything comes back in a few seconds.', 'note', 'snap');
  }, [notify, unlock]);

  // `withGif` false when the clip is already showing somewhere else (the card).
  const twss = useCallback(
    (withGif = true) => {
      unlock('dundie');
      import('../lib/clips').then((c) => c.playClip('twss', { keep: true }));
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

  // Rick and Morty: get schwifty, and the site goes portal green (or one of
  // the Smiths' colours)
  const getSchwifty = useCallback(
    (who = 'portal') => {
      unlock('wubba');
      pin(SMITHS.includes(who) ? who : 'portal');
      import('../components/games/gameAudio').then((m) => m.portalOpen?.());
    },
    [pin, unlock],
  );
  const pickleRick = useCallback(() => notify('I’m Pickle Riiick!', 'Funniest thing I’ve ever seen.', 'note'), [notify]);

  // Typed anywhere outside a text field.
  useEffect(() => {
    let buffer = '';
    const actions = {
      aurebesh: toggleAurebesh,
      cybertronian: () => setScript(langRef.current === 'cybertronian' ? null : 'cybertronian'),
      runes: () => setScript(langRef.current === 'runes' ? null : 'runes'),
      english: () => langRef.current && setScript(null),
      heisenberg: sayMyName,
      snap,
      twss,
      parkour,
      shire: () => speakFriend('shire'),
      mordor: () => speakFriend('mordor'),
      gandalf,
      gollum,
      portal: () => getSchwifty('portal'),
      pickle: pickleRick,
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
  }, [gandalf, getSchwifty, gollum, parkour, pickleRick, rollOut, sayMyName, setScript, snap, speakFriend, toggleAurebesh, twss]);

  const scriptName = SCRIPTS[script ?? scriptFor(active)].name;
  const value = useMemo(
    () => ({
      script,
      scriptName,
      setScript,
      toggleScript,
      aurebesh: script === 'aurebesh',
      toggleAurebesh,
      heisenberg,
      setHeisenberg,
      sayMyName,
      snap,
      twss,
      parkour,
      rollOut,
      speakFriend,
      gandalf,
      getSchwifty,
    }),
    [script, scriptName, setScript, toggleScript, toggleAurebesh, heisenberg, parkour, rollOut, sayMyName, snap, twss, speakFriend, gandalf, getSchwifty],
  );

  return (
    <FunContext.Provider value={value}>
      {children}
      {script && (
        // the way back out stays in plain letters, whatever the script
        <div className="aurebesh-pill ab-keep" role="status">
          <span>
            {SCRIPTS[script].name}
            <span className="sr-only"> mode is on.</span>
          </span>
          <button type="button" onClick={() => setScript(null)}>
            {BACK}
          </button>
        </div>
      )}
    </FunContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFun = () => useContext(FunContext);
