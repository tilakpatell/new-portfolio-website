// The hangar's shop, as rules: what the price pill on a part, module or
// paint says (pillOf), whether it's yours to fit (ownsItem), and the
// modules a roll may pick (ownedModules). The wallet is economy.js's, the
// items catalog.js's; with no wallet yet (it loads after the page), only
// stock is yours and nothing is for sale. Pure, tested in Node.
//
// pillOf(economy, item) → null (stock: nothing to say) | { kind: 'owned' |
//   'buy' | 'short' | 'locked', text, price? }

import { itemFor, needText } from './catalog';
import { MODULES } from './shipyard/parts';

export const ownsItem = (economy, item) => Boolean(item) && (item.stock || Boolean(economy?.owns(item.key)));

export function pillOf(economy, item) {
  if (!economy || !item || item.stock) return null;
  if (economy.owns(item.key)) return { kind: 'owned', text: 'Owned' };
  const { ok, why } = economy.canBuy(item);
  if (ok) return { kind: 'buy', text: `Buy · ${item.price} ¢` };
  if (why === 'credits') return { kind: 'short', text: `short ${item.price - economy.credits} ¢`, price: `${item.price} ¢` };
  if (why?.startsWith('locked:')) return { kind: 'locked', text: needText(item.needs) };
  return { kind: 'owned', text: 'Owned' };
}

// (ids, as shipyard/build.js's rollBuild takes them: only 'none' is two
// modules, and it's free in both its slots)
export const ownedModules = (economy) => MODULES.filter((m) => ownsItem(economy, itemFor('module', m.slot, m.id))).map((m) => m.id);
