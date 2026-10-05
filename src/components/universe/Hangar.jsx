import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RiLock2Line } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { PLANT, READOUT_LABEL, SLOTS, SLOT_LABEL, STOCK, isOpen, partEffects, partsFor, powerOf, readout, statsOf } from './outfit';

// The hangar, from the button in the map's corner (or H): the ship you're
// flying, fitted out the way a space sim's outfitting screen does it. A tab
// for each slot (outfit.js): its paint job, boosters, thrusters, weapons,
// shields and fins. Each part says what it does, what it draws from the
// ship's power plant and what it weighs; one you haven't earned shows its
// lock and the hint to the achievement that opens it, and one the ship
// can't power with what else is fitted says how much it's short. Point at a
// part and the read-out shows how the ship would do with it, against how it
// does now. Every change is on the ship at once (the page keeps it, for
// each ship). Not modal, like the flight settings: the map stays flyable
// behind it; Escape, the close button or a press on the map puts it away.

const SWATCH_STOCK = 'linear-gradient(135deg, #e2ded5 50%, #8a8f99 50%)';
const swatch = (p) => (p.hull ? `linear-gradient(135deg, ${p.hull} 50%, ${p.trim} 50%)` : SWATCH_STOCK);

export default function Hangar({ ship, shipName, loadout, onFit, open, onOpen }) {
  const id = useId();
  const panel = useRef(null);
  const button = useRef(null);
  const { unlocked } = useAchievements();
  const [slot, setSlot] = useState('paint');
  const [looking, setLooking] = useState(null); // the part pointed at, for the read-out
  const [said, setSaid] = useState(null); // why a part wouldn't go on

  // H opens and closes it; Escape closes it (before the page's own Escape)
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox'));
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        onOpen(false);
        button.current?.focus({ preventScroll: true });
      } else if (e.key.toLowerCase() === 'h' && !typing && !document.querySelector('[aria-modal="true"]')) {
        e.preventDefault();
        onOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onOpen]);

  // a press anywhere else puts it away
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panel.current?.contains(e.target) || button.current?.contains(e.target)) return;
      onOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open, onOpen]);

  useEffect(() => {
    setLooking(null);
    setSaid(null);
  }, [slot, ship]);

  const stats = statsOf(ship, loadout);
  const now = useMemo(() => readout(ship, loadout), [ship, loadout]);
  const then = useMemo(() => (looking && looking.slot !== 'paint' ? readout(ship, { ...loadout, [looking.slot]: looking.id }) : null), [ship, loadout, looking]);
  const parts = partsFor(slot);
  const opened = parts.filter((p) => isOpen(p, unlocked)).length;

  const fit = (p) => {
    const r = onFit(slot, p.id);
    if (r.ok) setSaid(null);
    else if (r.reason === 'locked') setSaid({ id: p.id, text: `Locked. ${p.hint}.` });
    else if (r.reason === 'power') setSaid({ id: p.id, text: `Not enough power: ${r.short} MW short. Take something else off first.` });
  };
  const note = said ?? (looking ? { id: looking.id, text: looking.blurb ?? (isOpen(looking, unlocked) ? null : `Locked. ${looking.hint}.`) } : null);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="universe-hangar-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Hangar: paint and parts"
        title="Hangar: paint and parts (H)"
        onClick={() => onOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.4-.6-.6-2.4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <section ref={panel} id={id} className="universe-hangar" role="dialog" aria-label="Hangar">
          <header className="universe-settings-head">
            <div>
              <h2>Hangar</h2>
              <p className="universe-hangar-ship">{shipName}</p>
            </div>
            <button type="button" className="universe-settings-close" aria-label="Close" onClick={() => onOpen(false)}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="universe-hangar-power" data-full={stats.power >= stats.capacity || undefined}>
            <span className="universe-hangar-label">Power</span>
            <span className="universe-hangar-cells" role="img" aria-label={`${stats.power} of ${stats.capacity} megawatts in use`}>
              {Array.from({ length: PLANT[ship] ?? 0 }, (_, i) => (
                <i key={i} data-on={i < stats.power || undefined} />
              ))}
            </span>
            <span className="universe-hangar-num">
              {stats.power}/{stats.capacity} MW · {stats.mass} t
            </span>
          </div>

          <div className="universe-hangar-slots" role="group" aria-label="Slot">
            {SLOTS.map((s) => (
              <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>
                {SLOT_LABEL[s]}
              </button>
            ))}
          </div>

          {slot === 'paint' ? (
            <div className="universe-hangar-paints" role="group" aria-label="Paint jobs">
              {parts.map((p) => {
                const ok = isOpen(p, unlocked);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="universe-hangar-paint"
                    aria-pressed={loadout.paint === p.id}
                    aria-disabled={!ok || undefined}
                    title={ok ? p.name : `${p.name}: ${p.hint}`}
                    onClick={() => fit(p)}
                    onPointerEnter={() => setLooking({ ...p, blurb: ok ? p.name : null })}
                    onFocus={() => setLooking({ ...p, blurb: ok ? p.name : null })}
                  >
                    <span className="universe-hangar-swatch" style={{ background: swatch(p) }} aria-hidden="true">
                      {!ok && <RiLock2Line className="h-3 w-3" />}
                    </span>
                    <span className="sr-only">
                      {p.name}
                      {ok ? '' : `, locked: ${p.hint}`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <ul className="universe-hangar-parts" aria-label={SLOT_LABEL[slot]}>
              {parts.map((p) => {
                const ok = isOpen(p, unlocked);
                const on = loadout[slot] === p.id;
                const short = on ? 0 : powerOf({ ...loadout, [slot]: p.id }) - stats.capacity; // (MW more than the plant makes, fitted)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="universe-hangar-part"
                      aria-pressed={on}
                      aria-disabled={!ok || undefined}
                      onClick={() => fit(p)}
                      onPointerEnter={() => setLooking(p)}
                      onPointerLeave={() => setLooking(null)}
                      onFocus={() => setLooking(p)}
                      onBlur={() => setLooking(null)}
                      data-short={short > 0 || undefined}
                    >
                      <span className="universe-hangar-part-top">
                        <span className="universe-hangar-part-name">
                          {!ok && <RiLock2Line className="h-3.5 w-3.5" aria-label="Locked" />}
                          {p.name}
                        </span>
                        {p.id !== STOCK && (
                          <span className="universe-hangar-part-cost">
                            {short > 0 ? `${short} MW short` : `${p.power} MW · ${p.mass} t`}
                          </span>
                        )}
                      </span>
                      <span className="universe-hangar-part-does">{ok ? partEffects(p).join(' · ') || p.blurb : p.hint}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="universe-hangar-note" aria-live="polite">
            {note?.text ?? (slot === 'paint' ? `${opened} of ${parts.length} paint jobs open. More come with achievements.` : `${opened} of ${parts.length} open. Point at a part to compare.`)}
          </p>

          <dl className="universe-hangar-stats">
            {now.map((r, i) => {
              const next = then?.[i];
              const diff = next ? next.change - r.change : 0;
              return (
                <div key={r.id} className="universe-hangar-stat">
                  <dt>{READOUT_LABEL[r.id]}</dt>
                  <dd>
                    <span className="universe-hangar-bar" style={{ '--now': r.bar, '--then': next ? next.bar : r.bar }} data-up={diff > 0 || undefined} data-down={diff < 0 || undefined}>
                      <i />
                      <b />
                    </span>
                    <span className="universe-hangar-change" data-up={diff > 0 || undefined} data-down={diff < 0 || undefined}>
                      {next && diff ? `${diff > 0 ? '+' : '−'}${Math.abs(diff)}%` : r.change ? `${r.change > 0 ? '+' : '−'}${Math.abs(r.change)}%` : 'Stock'}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
    </>
  );
}
