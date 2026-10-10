import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAchievements } from '../../Achievements';
import { useEconomy } from '../EconomyProvider';
import { focusBack, wrapFocus } from '../../../lib/focus';
import { crewById } from '../crews';
import { readout } from '../outfit';
import { castOfCrew } from '../../rickmorty/wardrobe/looks';
import { ownedModules } from '../shop';
import { buildCode } from './build';
import { draftKeys, hullName, pasteDraft, sellable, setModule, setPart } from '../yardRules';
import { createShowroom } from './showroom';
import { useYard } from './useYard';
import YardCatalogue from './YardCatalogue';
import { RAIL_LABEL } from './rail';
import YardBill from './YardBill';
import Record from '../Record';
import './shipyard.css';

// The Shipyard: where a ship is fitted, filling the page under the nav with
// the map frozen behind it. The catalogue down the left, the draft's ship
// on a turntable in the middle (showroom.js), the bill down the right.
// Every change is staged on a draft (useYard.js, yardRules.js) and nothing
// is bought or fitted until Apply, which pays for the lot in one checkout
// and fits it, or does nothing at all. H or the corner button opens it;
// Escape closes it, keeping the draft. A page may say a word of its own over
// the secondary and ordnance lines (`hint`: the galaxy's, that they fire on
// the universe map only). The design:
// docs/superpowers/specs/2026-10-08-shipyard-overhaul-design.md, Part 3.

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Shipyard({ open, onOpen, enabled = true, ship, shipName = '', live, lastBuild = null, saves, dropped = null, onApply, onSell, onCrew = null, returnTo = '.universe-hangar-btn', hint = null }) {
  const id = useId();
  const panel = useRef(null);
  const canvas = useRef(null);
  const room = useRef(null);
  const [still, setStill] = useState(false); // no WebGL: a card in the showroom's place
  const [slot, setSlot] = useState('paint');
  const [note, setNote] = useState(null);
  const [billOpen, setBillOpen] = useState(false);
  const [record, setRecord] = useState(false);
  const { unlocked } = useAchievements();
  const { economy, version } = useEconomy();
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  const yard = useYard({ live, kind: ship, unlocked, economy, version, onApply });
  const { draft, checked, changes, looking, setLooking } = yard;

  // H opens and closes it (not while typing, nor over another dialog);
  // Escape closes it (the record first, if that's up)
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox'));
      if (e.key === 'Escape' && open) {
        if (record) return;
        e.preventDefault();
        e.stopPropagation();
        onOpen(false);
      } else if (e.key.toLowerCase() === 'h' && !typing && (open || document.querySelector('.universe-hangar-btn'))) {
        // (only while the corner button's there: not on foot, nor without the 3D map)
        const other = document.querySelector('[aria-modal="true"]');
        if (other && !panel.current?.contains(other)) return;
        e.preventDefault();
        onOpen(!open);
      } else if (e.key === 'Tab' && open && panel.current) {
        const to = wrapFocus([...panel.current.querySelectorAll(FOCUSABLE)], document.activeElement, e.shiftKey);
        if (to) {
          e.preventDefault();
          to.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, open, onOpen, record]);

  // focus in on opening, and back where it was (or the corner button) after
  useEffect(() => {
    if (!open) return undefined;
    const was = document.activeElement === document.body ? null : document.activeElement;
    panel.current?.querySelector('.yard-rail [aria-selected="true"]')?.focus({ preventScroll: true });
    return () => focusBack(was, () => document.querySelector(returnTo));
  }, [open, returnTo]);
  useEffect(() => {
    if (!open) {
      setRecord(false);
      setNote(null);
    }
  }, [open]);

  // the showroom: made on opening, gone on closing
  useEffect(() => {
    if (!open || !canvas.current) return undefined;
    const r = createShowroom(canvas.current, { reduced });
    room.current = r;
    setStill(!r);
    return () => {
      r?.dispose();
      room.current = null;
    };
  }, [open, reduced]);
  useEffect(() => {
    if (open && ship) room.current?.show({ kind: ship, build: draft.build, loadout: draft.loadout });
  }, [open, ship, draft, still]);
  useEffect(() => {
    room.current?.focus(looking?.slot ?? slot);
  }, [looking, slot, open]);

  const now = useMemo(() => (ship ? readout(ship, draft.loadout, draft.build, draft.tune) : []), [ship, draft]);
  const then = useMemo(() => {
    if (!ship || !looking || looking.slot === 'paint') return null;
    // (the draft as it would be with what's pointed at staged: a build's module, a stock ship's tune, or a part)
    const next = looking.module ? setModule(draft, looking.slot, looking.id) : setPart(draft, looking.slot, looking.id);
    return readout(ship, next.loadout, next.build, next.tune);
  }, [ship, draft, looking]);
  const toBuyKeys = useMemo(() => new Set(checked.toBuy.map((i) => i.key)), [checked]);

  if (!open || !ship) return null;

  const stage = (s, partId, module) => (module ? yard.setModule(s, partId) : yard.setPart(s, partId));
  const paste = (code) => {
    const r = pasteDraft(draft, code, { unlocked, economy });
    if (r.error) {
      setNote(r.error);
      return false;
    }
    yard.paste(r.draft.build);
    setNote(`Staged ${buildCode(r.draft.build)}.`);
    return true;
  };
  const apply = () => {
    const r = yard.apply();
    if (r.ok) {
      setNote(r.result?.text ?? 'Fitted.');
      onOpen(false);
    } else setNote(r.result?.text ?? 'That didn’t go on: the yard has opened again on what’s flown.');
  };
  const sold = (item) => {
    const back = onSell(item);
    setNote(back ? `Sold the ${item.name} for ${back.toLocaleString('en-GB')} ¢.` : 'That didn’t sell.');
  };
  const wallet = economy?.record();
  // (what's owned and fitted nowhere: the wallet's version re-renders this on a sale)
  const sell = sellable({ ...saves, keep: draftKeys(draft) }, economy);
  const crew = crewById(ship);

  // (on the body: the page's route is a stacking context of its own, and the
  // yard has to sit over the site's floating cards, the tour's offer among them)
  return createPortal(
    <div className="dark-scope yard" role="presentation" data-ship={ship}>
      <section ref={panel} className="yard-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} data-record={record || undefined}>
        <header className="yard-head">
          <h2 id={`${id}-title`}>Shipyard</h2>
          <p className="yard-ship">{shipName}</p>
          <button type="button" className="universe-settings-close" aria-label="Close the shipyard" onClick={() => onOpen(false)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <YardCatalogue
          slot={slot}
          onSlot={(s) => {
            setSlot(s);
            setNote(null);
          }}
          draft={draft}
          live={live}
          unlocked={unlocked}
          economy={economy}
          onStage={stage}
          onLook={setLooking}
          onHull={(garage) => yard.setHull(garage, lastBuild)}
          onRoll={() => yard.roll((Math.random() * 0xffffffff) >>> 0, ownedModules(economy))}
          onPaste={paste}
          onSay={setNote}
        />

        <div className="yard-stage">
          {still ? (
            <div className="yard-still">
              <b>{shipName}</b>
              <span>{draft.build ? 'Garage build' : hullName(draft)}</span>
            </div>
          ) : (
            <canvas ref={canvas} className="yard-canvas" tabIndex={0} aria-label={`${shipName}, as staged: drag or use the arrow keys to turn it`} />
          )}
          {hint && ['secondary', 'ordnance'].includes(looking?.slot ?? slot) && (
            <p className="yard-hint" role="note">
              {hint}
            </p>
          )}
          <p className="yard-caption">
            {crew?.label ?? ''} · {hullName(draft)}
            {looking && <span className="yard-looking"> · {RAIL_LABEL[looking.slot]}: {looking.text}</span>}
          </p>
        </div>

        <YardBill
          checked={checked}
          changes={changes}
          now={now}
          then={then}
          wallet={wallet}
          toBuyKeys={toBuyKeys}
          sell={sell}
          note={note}
          dropped={dropped}
          open={billOpen}
          onOpen={setBillOpen}
          onApply={apply}
          onRevert={() => {
            yard.revert();
            setNote('Back to what’s flown.');
          }}
          onSell={sold}
          onRecord={() => setRecord(true)}
          crew={castOfCrew(ship) ? crew?.label : null}
          onCrew={onCrew}
          ready={Boolean(economy)}
        />
        {record && (
          <div className="yard-record">
            <Record open={record} onClose={() => setRecord(false)} />
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
