import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RiLock2Line } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { READOUT_LABEL, SLOTS, SLOT_LABEL, STOCK, isOpen, partEffects, partsFor, powerOf, readout, statsOf } from './outfit';
import { BUILD_SLOTS, BUILD_SLOT_LABEL, isModuleOpen, modulesFor } from './shipyard/parts';
import { STOCK_BUILD, buildCode, parseBuildCode, rollBuild } from './shipyard/build';

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
//
// The Build tab is the shipyard (shipyard/): fly the crew's stock ship, or a
// garage build of your own, a module for each slot (hull, cockpit, wings,
// engines, tail, extras), rolled from a seed the way No Man's Sky rolls its
// ships, or picked one at a time; its code passes it on.

const SWATCH_STOCK = 'linear-gradient(135deg, #e2ded5 50%, #8a8f99 50%)';
const swatch = (p) => (p.hull ? `linear-gradient(135deg, ${p.hull} 50%, ${p.trim} 50%)` : SWATCH_STOCK);
const TABS = ['build', ...SLOTS];
const TAB_LABEL = { build: 'Build', ...SLOT_LABEL };
const shares = (does) => Object.entries(does).filter(([k, v]) => k !== 'plant' && v);
const DOES = { boost: 'Boost', accel: 'Acceleration', cruise: 'Cruise', agility: 'Agility', level: 'Self-levelling' };
const moduleEffects = (m) => [...(m.does.plant ? [`${m.does.plant} MW plant`] : []), ...shares(m.does).map(([k, v]) => `${DOES[k]} ${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`)];

export default function Hangar({ ship, shipName, loadout, build = null, lastBuild = null, dropped = null, onBuild = null, onFit, open, onOpen, onCrew = null }) {
  const id = useId();
  const panel = useRef(null);
  const button = useRef(null);
  const { unlocked } = useAchievements();
  const [slot, setSlot] = useState('paint');
  const [looking, setLooking] = useState(null); // the part pointed at, for the read-out
  const [said, setSaid] = useState(null); // why a part wouldn't go on
  const [code, setCode] = useState(''); // a build code being pasted in

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

  const stats = statsOf(ship, loadout, build);
  const draw = stats.power - powerOf(loadout); // (what the build's own modules draw)
  const now = useMemo(() => readout(ship, loadout, build), [ship, loadout, build]);
  const then = useMemo(() => {
    if (!looking || looking.slot === 'paint') return null;
    if (looking.module) return readout(ship, loadout, { ...(build ?? STOCK_BUILD), [looking.slot]: looking.id });
    return readout(ship, { ...loadout, [looking.slot]: looking.id }, build);
  }, [ship, loadout, build, looking]);
  const parts = slot === 'build' ? [] : partsFor(slot);
  const opened = parts.filter((p) => isOpen(p, unlocked)).length;

  // the shipyard's moves: the hull switched, a module fitted, a roll, a code
  const setHull = (garage) => onBuild?.(garage ? (lastBuild ?? STOCK_BUILD) : null);
  const fitModule = (m) => {
    if (!isModuleOpen(m, unlocked)) return setSaid({ id: m.id, text: `Locked. ${m.hint}.` });
    setSaid(null);
    onBuild?.({ ...(build ?? STOCK_BUILD), [m.slot]: m.id });
  };
  const roll = () => {
    setSaid(null);
    onBuild?.(rollBuild((Math.random() * 0xffffffff) >>> 0, unlocked));
  };
  const paste = (e) => {
    e.preventDefault();
    const b = parseBuildCode(code);
    if (!b) return setSaid({ id: 'code', text: 'Not a build code. They look like GB-021301.k3.' });
    const shut = BUILD_SLOTS.map((k) => modulesFor(k).find((m) => m.id === b[k])).find((m) => !isModuleOpen(m, unlocked));
    if (shut) return setSaid({ id: 'code', text: `That build has the ${shut.name}, which isn’t yours yet. ${shut.hint}.` });
    setSaid(null);
    setCode('');
    onBuild?.(b);
  };
  const copy = () => {
    const c = buildCode(build ?? STOCK_BUILD);
    navigator.clipboard?.writeText(c).then(
      () => setSaid({ id: 'code', text: `Copied ${c}.` }),
      () => setSaid({ id: 'code', text: c }),
    );
  };

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

          {onCrew && ship === 'cruiser' && (
            <button type="button" className="universe-hangar-crew" onClick={onCrew} aria-haspopup="dialog">
              Dress Rick and Morty
            </button>
          )}

          <div className="universe-hangar-power" data-full={stats.power >= stats.capacity || undefined}>
            <span className="universe-hangar-label">Power</span>
            <span className="universe-hangar-cells" role="img" aria-label={`${stats.power} of ${stats.capacity} megawatts in use`}>
              {Array.from({ length: stats.capacity }, (_, i) => (
                <i key={i} data-on={i < stats.power || undefined} />
              ))}
            </span>
            <span className="universe-hangar-num">
              {stats.power}/{stats.capacity} MW · {stats.mass} t
            </span>
          </div>

          {dropped?.length > 0 && (
            <p className="universe-hangar-dropped" role="status">
              Off for want of power: {dropped.map((p) => p.name).join(', ')}. The plant makes {stats.capacity} MW; they go back on with one that runs them.
            </p>
          )}

          <div className="universe-hangar-slots" role="group" aria-label="Slot">
            {TABS.map((s) => (
              <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)} disabled={s === 'build' && !onBuild}>
                {TAB_LABEL[s]}
              </button>
            ))}
          </div>

          {slot === 'build' ? (
            <div className="universe-yard">
              <div className="universe-yard-hull" role="group" aria-label="Hull">
                <button type="button" aria-pressed={!build} onClick={() => setHull(false)}>
                  Stock
                </button>
                <button type="button" aria-pressed={Boolean(build)} onClick={() => setHull(true)}>
                  Garage build
                </button>
              </div>
              {build ? (
                <>
                  <div className="universe-yard-tools">
                    <button type="button" className="universe-yard-roll" onClick={roll} title="A whole new ship, from a new seed">
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                        <circle cx="9" cy="9" r="1.4" fill="currentColor" />
                        <circle cx="15" cy="15" r="1.4" fill="currentColor" />
                        <circle cx="15" cy="9" r="1.4" fill="currentColor" />
                        <circle cx="9" cy="15" r="1.4" fill="currentColor" />
                      </svg>
                      Roll
                    </button>
                    <button type="button" className="universe-yard-code" onClick={copy} title="Copy this build's code">
                      {buildCode(build)}
                    </button>
                  </div>
                  <form className="universe-yard-paste" onSubmit={paste}>
                    <label className="sr-only" htmlFor={`${id}-code`}>
                      A build code
                    </label>
                    <input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a build code" spellCheck={false} autoComplete="off" maxLength={20} />
                    <button type="submit" disabled={!code.trim()}>
                      Fit
                    </button>
                  </form>
                  {BUILD_SLOTS.map((k) => (
                    <section key={k} className="universe-yard-slot" aria-label={BUILD_SLOT_LABEL[k]}>
                      <h3>{BUILD_SLOT_LABEL[k]}</h3>
                      <div className="universe-yard-mods">
                        {modulesFor(k).map((m) => {
                          const ok = isModuleOpen(m, unlocked);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              className="universe-yard-mod"
                              aria-pressed={build[k] === m.id}
                              aria-disabled={!ok || undefined}
                              title={ok ? m.blurb : m.hint}
                              onClick={() => fitModule(m)}
                              onPointerEnter={() => setLooking({ ...m, module: true, blurb: ok ? [m.blurb, ...moduleEffects(m)].join(' ') : `Locked. ${m.hint}.` })}
                              onPointerLeave={() => setLooking(null)}
                              onFocus={() => setLooking({ ...m, module: true, blurb: ok ? [m.blurb, ...moduleEffects(m)].join(' ') : `Locked. ${m.hint}.` })}
                              onBlur={() => setLooking(null)}
                            >
                              {!ok && <RiLock2Line className="h-3 w-3" aria-label="Locked" />}
                              {m.name}
                              {(m.does.plant || m.power > 0 || m.mass > 0) && <small className="universe-yard-cost">{m.does.plant ? `${m.does.plant} MW` : [m.power > 0 && `${m.power} MW`, m.mass > 0 && `${m.mass} t`].filter(Boolean).join(' · ')}</small>}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </>
              ) : (
                <p className="universe-yard-blurb">The {shipName.replace(/^The /, '').toLowerCase() || 'ship'} as it came. Or build your own: a hull, a cockpit, wings, engines, a tail and extras, snapped together, the way No Man’s Sky does it. Every module changes how it flies.</p>
              )}
            </div>
          ) : slot === 'paint' ? (
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
                const short = on ? 0 : powerOf({ ...loadout, [slot]: p.id }) + draw - stats.capacity; // (MW more than the plant makes, fitted)
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
            {note?.text ??
              (slot === 'build'
                ? build
                  ? 'Point at a module to compare. Roll for a whole new ship.'
                  : 'Pick Garage build to make a ship of your own.'
                : slot === 'paint'
                  ? `${opened} of ${parts.length} paint jobs open. More come with achievements.`
                  : `${opened} of ${parts.length} open. Point at a part to compare.`)}
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
