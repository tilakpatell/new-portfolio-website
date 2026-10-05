import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { RiCloseLine, RiKeyboardLine, RiSmartphoneLine } from 'react-icons/ri';
import { WORLDS } from './worlds/worlds';
import { SHORTCUTS, SITE, guideFor } from './guide/pages';
import { keyTokens } from './guide/keys';
import { shortcutLabel } from '../lib/palette';

// The guide's panel: the page's controls (keyboard or touch) as a table of
// keys, then its tips; and the site as a whole. Loaded the first time the
// guide opens (components/Guide.jsx), not before, and mounted each time it
// opens, so it starts on this page's tab.

const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

// 'hold F' → hold [F]
function Keys({ keys }) {
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

function KeyTable({ rows }) {
  return (
    <table className="guide-keys">
      <tbody>
        {rows.map(([keys, does]) => (
          <tr key={keys + does}>
            <th scope="row">
              <Keys keys={keys} />
            </th>
            <td>{does}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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
            {groups.map((g, i) => (
              <Fragment key={g.label ?? i}>
                {g.label && <p className="guide-group">{g.label}</p>}
                <KeyTable rows={g.rows} />
              </Fragment>
            ))}
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
        <KeyTable rows={[[shortcutLabel().replace(' ', '+'), 'Search and go anywhere (the command palette)'], ...SHORTCUTS]} />
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

export default function GuidePanel({ pathname, close, onLeave }) {
  const page = guideFor(pathname);
  const [tab, setTab] = useState(page ? 'page' : 'site');
  const panel = useRef(null);
  const ids = useId();
  useEffect(() => {
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
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

  return createPortal(
    <div id="guide-panel" ref={panel} className="guide-panel card" role="dialog" aria-modal="false" aria-label="Guide" tabIndex={-1}>
      <div className="guide-head">
        <div className="guide-tabs" role="tablist" aria-label="Guide">
          {page && <button {...tabProps('page', 'On this page')} />}
          <button {...tabProps('site', 'The site')} />
        </div>
        <button type="button" className="guide-close" onClick={close} aria-label="Close the guide">
          <RiCloseLine className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-${tab}`} className="guide-body">
        {tab === 'page' && page ? <PageGuide page={page} /> : <SiteGuide onGo={onLeave} />}
      </div>
      <p className="guide-foot">
        <Keys keys="?" /> opens and closes this · <Keys keys="Esc" /> closes it
      </p>
    </div>,
    document.body,
  );
}
