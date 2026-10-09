// What a page needs to put the Shipyard (Shipyard.jsx) over its map: the
// loadouts, hulls and garage builds kept between visits (LOADOUT_KEY,
// HULL_KEY and GARAGE_KEY, which every map that flies the ship reads), the
// ship as it's fitted, the yard's door and its note, and what an Apply or a
// sale does. The universe map and the galaxy both use it, so a fit made in
// either is on the ship in the other. The changes of state are pure
// functions (tested in Node); the hook is those, with the page's React
// state, its wallet and the browser's storage.
//
// useShipyardPage({ ship, unlocked }) → { loadouts, loadout, build, hulls,
//   garage, dropped, setBuild(b), yard, setYard, applyDraft({ diff, toBuy,
//   draft }) → { ok, text, live } | { ok: false, why, text }, sellPart(item),
//   yardNote ({ text, n } | null, for EarnNote), live, yardSaves }
// (the pure changes of state are yardPage.js's)

import { useEffect, useMemo, useState } from 'react';
import { local } from '../../../lib/hooks';
import { useEconomy } from '../EconomyProvider';
import { droppedParts, loadoutOf } from '../outfit';
import { applyYardDraft, keepBuild, keepLoadouts, readSaves } from './yardPage';

const NOTE_MS = 3200;

export function useShipyardPage({ ship, unlocked = [] }) {
  const [loadouts, setLoadouts] = useState(() => readSaves().loadouts);
  // the hull each crew flies: its stock ship, or a garage build, and each crew's last build, flown or not
  const [hulls, setHulls] = useState(() => readSaves().hulls);
  const [garage, setGarage] = useState(() => readSaves().garage);
  const build = (ship && hulls[ship]) || null;
  const setBuild = (b) => {
    if (!ship) return;
    const next = keepBuild(local, { hulls, garage }, ship, b);
    setHulls(next.hulls);
    if (b) setGarage(next.garage);
  };
  const loadout = useMemo(() => loadoutOf(loadouts, ship, unlocked, build), [loadouts, ship, unlocked, build]);
  const dropped = useMemo(() => (ship ? droppedParts(loadouts[ship], loadout) : []), [loadouts, ship, loadout]); // (what the plant can't run)

  const [yard, setYard] = useState(false);
  const { economy } = useEconomy();
  const [yardNote, setYardNote] = useState(null);
  const sayYard = (text) => setYardNote({ text, n: Date.now() });
  useEffect(() => {
    if (!yardNote) return undefined;
    const t = setTimeout(() => setYardNote(null), NOTE_MS);
    return () => clearTimeout(t);
  }, [yardNote]);
  const applyDraft = (draft) => {
    const r = applyYardDraft({ ship, economy, loadouts, unlocked }, draft);
    if (!r.result.ok) return r.result;
    if (r.build !== undefined) setBuild(r.build);
    setLoadouts(r.loadouts);
    keepLoadouts(local, r.loadouts);
    sayYard(r.result.text);
    return r.result;
  };
  const sellPart = (item) => {
    const back = economy?.sell(item);
    if (back) sayYard(`Sold the ${item.name} for ${back.toLocaleString('en-GB')} ¢.`);
    return back;
  };
  const live = useMemo(() => ({ build, loadout }), [build, loadout]);
  const yardSaves = useMemo(() => ({ loadouts, hulls, garage }), [loadouts, hulls, garage]);
  return { loadouts, loadout, build, hulls, garage, dropped, setBuild, yard, setYard, applyDraft, sellPart, yardNote, live, yardSaves };
}
