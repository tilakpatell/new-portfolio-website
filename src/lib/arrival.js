// Where the cockpit's launch comes out, when it isn't just anywhere on the
// map: Rick's cruiser goes through his portal, so it comes out in his
// dimension (cockpit/vehicles.js's `arrive`). The cockpit notes it at the
// flash; the universe map takes it, once, whether it was already up (it
// hears 'tp:arrive') or comes up after (⌘K's replay from another page).
//
// noteArrival(sector) → kept for a little while, for this tab
// takeArrival() → the sector, or null (gone once taken, or gone stale)

const KEY = 'tp-arrive-sector';
const FRESH = 20000;

export function noteArrival(sector) {
  try {
    if (sector) window.sessionStorage.setItem(KEY, JSON.stringify({ sector, at: Date.now() }));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function takeArrival() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const v = JSON.parse(raw);
    return v && typeof v.sector === 'string' && Date.now() - v.at < FRESH ? v.sector : null;
  } catch {
    return null;
  }
}
