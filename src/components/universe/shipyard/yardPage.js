// The Shipyard page's changes of state (useShipyardPage.js wires them to a
// page): what's kept between visits, a build flown, and a draft applied.
// Pure, so tested in Node; the storage and the wallet are handed in.
//
// readSaves(store) → { loadouts, hulls, garage }: the saves under LOADOUT_KEY, HULL_KEY and GARAGE_KEY, every crew's
// withBuild({ hulls, garage }, ship, b) → { hulls, garage } with `b` flown by `ship` (a build, or null for the stock hull), and a build also kept as its last, to go back to from stock
// keepBuild(store, saves, ship, b) → the same, written to the store (the hull always; the garage when `b` is a build)
// keepLoadouts(store, loadouts): written to the store
// applyYardDraft({ ship, economy, loadouts, unlocked }, { diff, toBuy, draft }) → { result, loadouts, build? }: the yard is told
//   `result` ({ ok, text, live } or { ok: false, why, text }); on a go `loadouts` are to be kept, and `build` is set only when the hull changed

import { local } from '../../../lib/hooks';
import { CREWS } from '../crews';
import { LOADOUT_KEY, readLoadout, readLoadouts } from '../outfit';
import { fitDraft } from '../yardRules';
import { GARAGE_KEY, HULL_KEY, readHulls } from './build';

const CREW_IDS = CREWS.map((c) => c.id);

export const readSaves = (store = local) => ({
  loadouts: readLoadouts(store.get(LOADOUT_KEY), CREW_IDS),
  hulls: readHulls(store.get(HULL_KEY), CREW_IDS),
  garage: readHulls(store.get(GARAGE_KEY), CREW_IDS),
});

export const withBuild = ({ hulls, garage }, ship, b) => ({ hulls: { ...hulls, [ship]: b }, garage: b ? { ...garage, [ship]: b } : garage });

// (the store is `local`'s shape, { get(key), set(key, value) }: both maps read the same keys when they open)
export function keepBuild(store, saves, ship, b) {
  const next = withBuild(saves, ship, b);
  store.set(HULL_KEY, next.hulls);
  if (b) store.set(GARAGE_KEY, next.garage);
  return next;
}
export const keepLoadouts = (store, loadouts) => store.set(LOADOUT_KEY, loadouts);

// (every fit tried first on a copy, fitDraft; then everything unowned paid for in one checkout; a refusal at any step changes nothing)
export function applyYardDraft({ ship, economy, loadouts, unlocked }, { diff, toBuy, draft }) {
  if (!ship || !economy) return { result: { ok: false, why: 'shop', text: 'The shop’s still opening.' } };
  const fitted = fitDraft(ship, draft, diff, { saved: readLoadout(loadouts[ship]), unlocked });
  if (!fitted.ok) return { result: { ok: false, why: fitted.why, text: fitted.why === 'power' ? 'Not enough power for that any more: the yard has opened again on what’s flown.' : 'Something there isn’t yours any more: the yard has opened again on what’s flown.' } };
  const paid = economy.checkout(toBuy);
  if (!paid.ok) return { result: { ok: false, why: paid.why, text: paid.why === 'credits' ? `Short ${(paid.total - economy.credits).toLocaleString('en-GB')} ¢.` : `The ${paid.item?.name ?? 'part'} can’t be bought.` } };
  const text = toBuy.length ? `Bought ${toBuy.length} part${toBuy.length === 1 ? '' : 's'} for ${paid.total.toLocaleString('en-GB')} ¢. Fitted.` : 'Fitted.';
  const out = { result: { ok: true, text, live: { build: draft.build, loadout: fitted.loadout } }, loadouts: { ...loadouts, [ship]: fitted.saved } };
  if (diff.some((c) => c.module)) out.build = draft.build;
  return out;
}
