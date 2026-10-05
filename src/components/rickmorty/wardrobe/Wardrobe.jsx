import { useEffect, useId, useRef, useState } from 'react';
import ModelCredits from '../../ModelCredits';
import { useReducedMotion } from '../../../lib/hooks';
import { BODIES, GEAR, GEAR_SLOTS, SWATCHES, WHO, bodyOf, defaultLook, readLook } from './looks';
import '@fontsource/luckiest-guy/400.css';
import './wardrobe.css';

// The wardrobe: how your Rick and your Morty look, wherever they turn up
// (the C-137 street, the Citadel, the cruiser's seats, out of the ship on a
// planet). A turntable of the look on one side; on the other, Rick or Morty,
// and for him a body (the show's, a Citadel Rick, Evil or Cop Morty), a
// colour for each part of it that takes one, and gear for his head, his face
// and his hand. Every change is kept at once (useLooks), and Reset puts him
// back as the show has him. Modal: Escape, the close button or the backdrop
// puts it away.

const SLOT_LABEL = { head: 'On his head', face: 'On his face', hand: 'In his hand' };
const NAME = { rick: 'Rick', morty: 'Morty' };

export default function Wardrobe({ open, onClose, looks, onLook, who: start = 'morty' }) {
  const id = useId();
  const reduced = useReducedMotion();
  const [who, setWho] = useState(start);
  const canvas = useRef(null);
  const preview = useRef(null);
  const panel = useRef(null);
  const look = looks[who];
  const body = bodyOf(who, look.body);

  useEffect(() => {
    if (open) setWho(start);
  }, [open, start]);

  // the turntable, while it's open
  useEffect(() => {
    if (!open || !canvas.current) return undefined;
    let gone = false;
    import('./preview').then(({ createWardrobePreview }) => {
      if (gone || !canvas.current) return;
      preview.current = createWardrobePreview(canvas.current, { reduced });
      preview.current?.show(looks[who]);
    });
    return () => {
      gone = true;
      preview.current?.dispose();
      preview.current = null;
    };
    // (made once a time it's opened; the look is shown by the effect below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduced]);
  useEffect(() => {
    preview.current?.show(look);
  }, [look]);

  // Escape closes it; focus goes in, and back where it was after
  useEffect(() => {
    if (!open) return undefined;
    const was = document.activeElement;
    panel.current?.querySelector('.rm-wardrobe-tabs [aria-pressed="true"]')?.focus({ preventScroll: true }); // (whose wardrobe it is)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      was?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  const set = (patch) => onLook(who, readLook(who, { ...look, ...patch }));
  const setColor = (region, swatch) => set({ colors: { ...look.colors, [region]: swatch } });
  const clearColor = (region) => {
    const colors = { ...look.colors };
    delete colors[region];
    set({ colors });
  };
  const setGear = (slot, gear) => set({ gear: { ...look.gear, [slot]: gear } });

  return (
    <div className="rm-wardrobe" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={panel} className="rm-wardrobe-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <div className="rm-wardrobe-stage">
          <canvas ref={canvas} className="rm-wardrobe-canvas" aria-label={`${NAME[who]}, as ${body?.name ?? ''}: drag to turn him round`} />
          <p className="rm-wardrobe-who">{body?.name}</p>
        </div>
        <div className="rm-wardrobe-controls">
          <header className="rm-wardrobe-head">
            <h2 id={`${id}-title`}>Wardrobe</h2>
            <button type="button" className="rm-wardrobe-close" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <div className="rm-wardrobe-tabs" role="group" aria-label="Who">
            {WHO.map((w) => (
              <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)}>
                {NAME[w]}
              </button>
            ))}
          </div>

          <section className="rm-wardrobe-group" aria-labelledby={`${id}-body`}>
            <h3 id={`${id}-body`}>Who he is</h3>
            <div className="rm-wardrobe-bodies">
              {BODIES[who].map((b) => (
                <button key={b.id} type="button" aria-pressed={look.body === b.id} onClick={() => set({ body: b.id, colors: {} })}>
                  {b.name}
                </button>
              ))}
            </div>
          </section>

          {body && Object.keys(body.regions).length > 0 && (
            <section className="rm-wardrobe-group" aria-labelledby={`${id}-colours`}>
              <h3 id={`${id}-colours`}>Colours</h3>
              {Object.entries(body.regions).map(([region, label]) => (
                <div key={region} className="rm-wardrobe-region" role="group" aria-label={label}>
                  <span className="rm-wardrobe-region-name">{label}</span>
                  <div className="rm-wardrobe-swatches">
                    <button type="button" className="rm-wardrobe-swatch rm-wardrobe-swatch-own" aria-pressed={!look.colors[region]} title="As it comes" aria-label={`${label}: as it comes`} onClick={() => clearColor(region)} />
                    {SWATCHES.map((s) => (
                      <button key={s.id} type="button" className="rm-wardrobe-swatch" style={{ '--swatch': s.hex }} aria-pressed={look.colors[region] === s.id} title={s.name} aria-label={`${label}: ${s.name}`} onClick={() => setColor(region, s.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="rm-wardrobe-group" aria-labelledby={`${id}-gear`}>
            <h3 id={`${id}-gear`}>Gear</h3>
            {GEAR_SLOTS.map((slot) => {
              const hatted = slot === 'head' && body?.hat;
              return (
                <div key={slot} className="rm-wardrobe-region" role="group" aria-label={SLOT_LABEL[slot]}>
                  <span className="rm-wardrobe-region-name">{SLOT_LABEL[slot]}</span>
                  {hatted ? (
                    <p className="rm-wardrobe-note">{body.name} keeps his own hat on.</p>
                  ) : (
                    <div className="rm-wardrobe-chips">
                      {GEAR[slot].map((g) => (
                        <button key={g.id} type="button" aria-pressed={look.gear[slot] === g.id} onClick={() => setGear(slot, g.id)}>
                          {g.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <footer className="rm-wardrobe-foot">
            <button type="button" className="rm-wardrobe-reset" onClick={() => onLook(who, defaultLook(who))}>
              Reset {NAME[who]}
            </button>
            <ModelCredits where="c-137" line className="rm-wardrobe-credit" />
          </footer>
        </div>
      </section>
    </div>
  );
}
