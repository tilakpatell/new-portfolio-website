// The page visit's own small keys (localStorage through rt.saves) and store
// (IndexedDB through rt.store), one each, made the first time anything asks:
// the runtime takes them, and a page with no world (/worlds) reads the same
// ones without making a runtime.

import { createSaves } from './saves';
import { createStore } from './store';

let saves = null;
let store = null;

export const winOf = () => (typeof window !== 'undefined' ? window : null);
const storage = (win, name) => {
  try {
    return win[name];
  } catch {
    return null;
  }
};
export function localSaves() {
  const win = winOf();
  saves ??= createSaves({ local: storage(win, 'localStorage'), session: storage(win, 'sessionStorage'), win });
  return saves;
}
export function worldStore() {
  let idb = null;
  try {
    idb = winOf()?.indexedDB ?? null;
  } catch {
    idb = null;
  }
  store ??= createStore({ indexedDB: idb, fallback: localSaves() });
  return store;
}
