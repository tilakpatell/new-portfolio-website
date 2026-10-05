import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { RiCloseLine, RiKeyboardLine, RiQuestionLine, RiSmartphoneLine } from 'react-icons/ri';
import { WORLDS } from './worlds/worlds';
import { SHORTCUTS, SITE, guideFor } from './guide/pages';
import { keyTokens } from './guide/keys';
import { local } from '../lib/hooks';
import { shortcutLabel } from '../lib/palette';

// A guide to the site, and to whatever the page you're on lets you play: its
// controls (keyboard or touch) as a table of keys, then its tips. The "?"
// button in the corner (or the ? key) opens it. The first time you're on a
// page with controls, a note by the button says they're here.

const SEEN_KEY = 'tp-guide-seen'; // the pages whose note has been shown
const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// 'hold F' → hold [F]
export function Keys({ keys }) {
  return (
    <span className="guide-keyset">
      {keyTokens(keys).map((t, i) =>
        t.word ? (
          <span key={i} className="guide-or">
            {t.word}
          </span>
        ) : (
          <kbd key={i} className={t.pointer ? 'guide-kbd is-pointer' : 'guide-kbd'}>
            {t.key}
          </kbd>
        ),
      )}
    </span>
  );
}

function Controls({ groups }) {
  return groups.map((g, gi) => (
    <Fragment key={g.label ?? gi}>
      {g.label && <p className="guide-group">{g.label}</p>}
      <table className="guide-keys">
        <tbody>
          {g.rows.map(([keys, does]) => (
            <tr key={keys + does}>
              <th scope="row">
                <Keys keys={keys} />
              </th>
              <td>{does}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Fragment>
  ));
}

function Tips({ tips }) {
  return (
    <dl className="guide-list">
      {tips.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// the page's controls and tips; keyboard or touch, whichever this device is,
// with a switch when the page has both
function PageGuide({ page }) {
  const both = Boolean(page.keys && page.touch);
  const [input, setInput] = useState(() => (page.touch && (coarse() || !page.keys) ? 'touch' : 'keys'));
  const groups = input === 'touch' ? page.touch : page.keys;
  return (
    <>
      <h2 className="guide-title">{page.title}</h2>
      {page.about && <p className="guide-about">{page.about}</p>}
      {groups && (
        <section className="mt-5" aria-label="Controls">
          <div className="flex items-center justify-between gap-3">
            <p className="label">Controls</p>
            {both && (
              <div className="guide-input" role="group" aria-label="Controls for">
                <button type="button" aria-pressed={input === 'keys'} onClick={() => setInput('keys')}>
                  <RiKeyboardLine className="h-3.5 w-3.5" aria-hidden="true" /> Keyboard
                </button>
                <button type="button" aria-pressed={input === 'touch'} onClick={() => setInput('touch')}>
                  <RiSmartphoneLine className="h-3.5 w-3.5" aria-hidden="true" /> Touch
                </button>
              </div>
            )}
          </div>
          <div className="mt-2">
            <Controls groups={groups} />
          </div>
        </section>
      )}
      {page.tips?.length > 0 && (
        <section className="mt-6" aria-label="Tips">
          {groups && <p className="label mb-3">Tips</p>}
          <Tips tips={page.tips} />
        </section>
      )}
    </>
  );
}

function SiteGuide({ onGo }) {
  return (
    <>
      <h2 className="guide-title">The site</h2>
      <section className="mt-4" aria-label="Shortcuts">
        <table className="guide-keys">
          <tbody>
            {[[shortcutLabel().replace(' ', '+'), 'Search and go anywhere (the command palette)'], ...SHORTCUTS].map(([keys, does]) => (
              <tr key={keys}>
                <th scope="row">
                  <Keys keys={keys} />
                </th>
                <td>{does}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="mt-6">
        <Tips tips={SITE} />
      </section>
      <p className="label mt-6">The worlds</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {WORLDS.map((w) => (
          <li key={w.to}>
            <Link to={w.to} className="world-link" onClick={onGo}>
              {w.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Guide() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const page = guideFor(pathname);
  const [tab, setTab] = useState('page');
  const panel = useRef(null);
  const button = useRef(null);
  const ids = useId();
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // focus goes back to whatever opened the guide (a panel's own "?" where the
  // corner button is hidden), else to the corner button if it's showing
  const returnTo = useRef(null);
  const refocus = () => {
    const shown = (el) => el?.isConnected && el.getClientRects().length > 0;
    const to = shown(returnTo.current) ? returnTo.current : shown(button.current) ? button.current : null;
    to?.focus({ preventScroll: true });
  };
  const refocusRef = useRef(refocus);
  useEffect(() => {
    refocusRef.current = refocus;
  });
  const close = () => {
    setOpen(false);
    refocus();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (typing(e.target)) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && openRef.current) {
        // the guide's Escape: not the page's too (the map would back out)
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(false);
        refocusRef.current();
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('tp:guide', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('tp:guide', onOpen);
    };
  }, []);
  useEffect(() => {
    if (open) {
      const at = document.activeElement;
      returnTo.current = at instanceof HTMLElement && at !== document.body && !panel.current?.contains(at) ? at : null;
      setTab(page ? 'page' : 'site');
      requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    }
    // the tab resets each time it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  // The first time on a page with controls: a note by the button, once the
  // page is uncovered and nothing's asking a question over it. It goes after
  // a while, on a press, or when the guide opens; it isn't shown again.
  const [nudge, setNudge] = useState(null);
  const pageKey = page?.key;
  const hasControls = Boolean((page?.keys || page?.touch) && page?.nudge !== false);
  useEffect(() => {
    setNudge(null);
    if (!pageKey || !hasControls) return undefined;
    const seen = local.get(SEEN_KEY, []);
    if (Array.isArray(seen) && seen.includes(pageKey)) return undefined;
    let hide = 0;
    const show = setInterval(() => {
      const html = document.documentElement;
      if ('covered' in html.dataset || 'intro' in html.dataset || 'menu' in html.dataset || document.querySelector('[aria-modal="true"]')) return;
      clearInterval(show);
      local.set(SEEN_KEY, [...(Array.isArray(seen) ? seen : []), pageKey].slice(-60));
      setNudge(pageKey);
      hide = setTimeout(() => setNudge(null), 9000);
    }, 1800);
    return () => {
      clearInterval(show);
      clearTimeout(hide);
    };
  }, [pageKey, hasControls]);
  useEffect(() => {
    if (open) setNudge(null);
  }, [open]);

  // On a phone the button tucks away while you scroll down the page (so it
  // never sits over a game's controls) and comes back when you scroll up.
  // (once a frame at most, and only when it changes)
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let now = false;
    let frame = 0;
    const set = (v) => {
      if (v === now) return;
      now = v;
      setTucked(v);
    };
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < 160) set(false);
      else if (y > last + 8) set(true);
      else if (y < last - 8) set(false);
      if (Math.abs(y - last) > 8) last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // tabs: arrow keys move between them, as tabs do
  const tabs = page ? ['page', 'site'] : ['site'];
  const onTabKey = (e) => {
    const at = tabs.indexOf(tab);
    const next = e.key === 'ArrowRight' ? tabs[(at + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(at - 1 + tabs.length) % tabs.length] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`${ids}-${next}`)?.focus());
  };
  const tabProps = (id, label) => ({
    id: `${ids}-${id}`,
    role: 'tab',
    type: 'button',
    'aria-selected': tab === id,
    'aria-controls': `${ids}-panel`,
    tabIndex: tab === id ? 0 : -1,
    onClick: () => setTab(id),
    onKeyDown: onTabKey,
    children: label,
  });

  return (
    <>
      <button
        ref={button}
        type="button"
        className="guide-btn"
        data-tucked={(tucked && !open) || undefined}
        data-nudge={nudge ? '' : undefined}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? 'guide-panel' : undefined}
        aria-keyshortcuts="?"
        aria-label={page ? `Guide: controls and tips for ${page.title}` : 'Guide: how this site works'}
        title="Guide (?)"
      >
        <RiQuestionLine className="h-5 w-5" aria-hidden="true" />
      </button>
      {nudge && !open && page && (
        <div className="guide-nudge" role="status">
          <button type="button" className="guide-nudge-open" onClick={() => setOpen(true)}>
            <span className="guide-nudge-kicker">New here?</span>
            <span>
              The controls for {page.title} are in the guide. Press <kbd className="guide-kbd">?</kbd> any time.
            </span>
          </button>
          <button type="button" className="guide-nudge-close" onClick={() => setNudge(null)} aria-label="Dismiss">
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {open &&
        createPortal(
          <div id="guide-panel" ref={panel} className="guide-panel card" role="dialog" aria-modal="false" aria-label="Guide" tabIndex={-1}>
            <div className="guide-head">
              <div className="guide-tabs" role="tablist" aria-label="Guide">
                {page && <button {...tabProps('page', 'On this page')} />}
                <button {...tabProps('site', 'The site')} />
              </div>
              <button type="button" className="guide-close" onClick={() => close()} aria-label="Close the guide">
                <RiCloseLine className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-${tab}`} className="guide-body">
              {tab === 'page' && page ? <PageGuide key={page.key} page={page} /> : <SiteGuide onGo={() => setOpen(false)} />}
            </div>
            <p className="guide-foot">
              <Keys keys="?" /> opens and closes this · <Keys keys="Esc" /> closes it
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
