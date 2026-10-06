import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCloseLine } from 'react-icons/ri';
import { useScene } from '../../lib/three/useScene';
import { typing } from '../games/pad';
import Tribute from './Tribute';

// The world over the page: the 3D (./scene.js, through useScene) and what's
// over it. At the gate, the way through; in the universe, the exhibits'
// arrows, the plaque of the one you're at, the way to the list (the docx,
// hung beside the island: its lines lead to their exhibits), and the way back. The white-out
// as you go through is here too. Without 3D, nothing: the catalogue under it
// is the whole museum.

const load = () => import('./scene');
// where the tour is: an exhibit's index, `n` at the friendship wall, -1 elsewhere
const stopOf = (f, n) => (f === 'friends' ? n : typeof f === 'number' ? f : -1);
const label = (i) => (i === 0 ? 'Exhibit Zero' : `Exhibit ${String(i).padStart(2, '0')}`);

export default function DickanshWorld({ museum, photos = [] }) {
  const [mode, setMode] = useState('gate');
  const [focus, setFocus] = useState(-1);
  const [hover, setHover] = useState({ index: -1, line: null, friend: false });
  const [flash, setFlash] = useState(0);
  const exhibits = museum.exhibits;
  const onEvent = useCallback((e) => {
    if (e.type === 'mode') {
      setMode(e.mode);
      if (e.mode === 'warp') setFlash((n) => n + 1);
    } else if (e.type === 'focus') setFocus(e.index);
    else if (e.type === 'hover') setHover({ index: e.index, line: e.line ?? null, friend: Boolean(e.friend) });
  }, []);
  const props = useMemo(() => ({ exhibits, doc: museum.doc, tribute: museum.tribute, photos, onEvent }), [exhibits, museum.doc, museum.tribute, photos, onEvent]);
  const { wrap, view, meant, status } = useScene(load, { id: 'dickansh', props, near: '0px' });
  const panel = useRef(null);

  // the tour: every exhibit in turn, and the friendship wall last
  const stops = exhibits.length + (museum.tribute ? 1 : 0);
  const go = useCallback(
    (i) => {
      const v = view.current;
      if (!v) return;
      if (v.mode !== 'universe') return;
      const k = ((i % stops) + stops) % stops;
      v.focus(k === exhibits.length ? 'friends' : k);
    },
    [exhibits.length, stops, view],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const v = view.current;
      if (!v) return;
      if (v.mode === 'gate' && e.key === 'Enter') v.enter();
      else if (v.mode === 'universe') {
        const at = stopOf(v.focused, exhibits.length);
        if (e.key === 'ArrowRight') go((at < 0 ? -1 : at) + 1);
        else if (e.key === 'ArrowLeft') go((at < 0 ? 1 : at) - 1);
        else if (e.key === 'Escape') v.focused !== -1 ? v.focus(-1) : v.leave();
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exhibits.length, go, view]);

  useEffect(() => {
    if (focus !== -1) panel.current?.scrollTo?.({ top: 0 });
  }, [focus]);

  const ex = typeof focus === 'number' && focus >= 0 ? exhibits[focus] : null;
  const at = stopOf(focus, exhibits.length);
  const lineHint = hover.line ? (hover.line.link ? `${hover.line.t}: opens the video` : `“${hover.line.t}” → ${label(hover.line.x)}: ${exhibits[hover.line.x]?.title}`) : null;
  const hint = lineHint ?? (hover.friend && focus !== 'friends' ? 'Why you’re here' : null) ?? (hover.index >= 0 && !ex ? `${label(hover.index)}: ${exhibits[hover.index].title}` : focus === 'doc' ? 'The list, as written. Click a line to go to its exhibit.' : 'Drag to circle the island. Click a case or a line of the list, or use ← →. Esc to step back.');
  const loading = meant && status !== 'on';

  return (
    <section className="dk-world" aria-label="The Dickansh and Deekbeggers Universe">
      <div ref={wrap} className="dk-canvas" />
      {!meant && (
        <div className="dk-flat">
          <div className="dk-kolam" aria-hidden="true" />
          <div className="dk-flat-card">
            <p className="dk-eyebrow">Dickansh &amp; Deekbeggers Universe</p>
            <h1 className="dk-title">The museum is open</h1>
            <p className="dk-lead">This browser isn’t drawing in 3D, so the gateway and the island stay closed. The whole collection is in the catalogue below.</p>
          </div>
        </div>
      )}
      {loading && (
        <div className="dk-loading" role="status">
          <span className="dk-spinner" aria-hidden="true" />
          Lighting the lamps…
        </div>
      )}
      {meant && !loading && (
        <div className="dk-hud">
          <header className="dk-hud-top">
            <p className="dk-eyebrow">{mode === 'gate' ? 'The Gateway' : mode === 'warp' ? 'Crossing over' : 'The Dhurandhar Universe'}</p>
            <h1 className="dk-hud-title">
              Dickansh <span>&amp;</span> Deekbeggers Universe
            </h1>
          </header>

          {mode === 'gate' && (
            <div className="dk-hud-bottom">
              <p className="dk-hint">Drag to look round. Scroll to come closer. Click the portal, or press Enter.</p>
              <button type="button" className="dk-btn" onClick={() => view.current?.enter()}>
                Step through the portal
              </button>
            </div>
          )}

          {mode === 'universe' && (
            <>
              <div className="dk-hud-bottom">
                {!ex && focus !== 'friends' && <p className="dk-hint">{hint}</p>}
                <div className="dk-nav">
                  <button type="button" className="dk-icon" aria-label="Previous exhibit" onClick={() => go((at < 0 ? 1 : at) - 1)}>
                    <RiArrowLeftSLine aria-hidden="true" />
                  </button>
                  <button type="button" className="dk-btn dk-btn-ghost" onClick={() => (focus !== -1 ? view.current?.focus(-1) : go(0))}>
                    {focus !== -1 ? 'The whole island' : 'Start the tour'}
                  </button>
                  <button type="button" className="dk-icon" aria-label="Next exhibit" onClick={() => go((at < 0 ? -1 : at) + 1)}>
                    <RiArrowRightSLine aria-hidden="true" />
                  </button>
                </div>
                <div className="dk-row">
                  {museum.tribute && focus !== 'friends' && (
                    <button type="button" className="dk-back-btn" onClick={() => view.current?.friends()}>
                      Why you’re here
                    </button>
                  )}
                  {focus !== 'doc' && (
                    <button type="button" className="dk-back-btn" onClick={() => view.current?.readList()}>
                      Read the list
                    </button>
                  )}
                  <button type="button" className="dk-back-btn" onClick={() => view.current?.leave()}>
                    Back to the gateway
                  </button>
                </div>
              </div>
              {focus === 'friends' && museum.tribute && (
                <aside ref={panel} className="dk-panel dk-panel-friends" aria-live="polite">
                  <button type="button" className="dk-icon dk-panel-close" aria-label="Close" onClick={() => view.current?.focus(-1)}>
                    <RiCloseLine aria-hidden="true" />
                  </button>
                  <Tribute tribute={museum.tribute} photos={photos} id="dk-tribute-panel-title" />
                </aside>
              )}
              {ex && (
                <aside ref={panel} className="dk-panel" aria-live="polite" aria-labelledby="dk-panel-title">
                  <button type="button" className="dk-icon dk-panel-close" aria-label="Close the plaque" onClick={() => view.current?.focus(-1)}>
                    <RiCloseLine aria-hidden="true" />
                  </button>
                  <p className="dk-card-no">
                    {label(focus)} · {ex.wing}
                  </p>
                  <h2 id="dk-panel-title" className="dk-card-title">
                    {ex.title}
                  </h2>
                  <p className="dk-card-blurb">{ex.blurb}</p>
                  <ul className="dk-card-items">
                    {ex.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                  {ex.link && (
                    <a className="dk-card-link" href={ex.link.href} target="_blank" rel="noopener noreferrer">
                      {ex.link.label}
                    </a>
                  )}
                </aside>
              )}
            </>
          )}
        </div>
      )}
      {flash > 0 && <div key={flash} className="dk-flash" aria-hidden="true" />}
    </section>
  );
}
