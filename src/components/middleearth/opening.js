// Whether Middle-earth opens on its map, the way the films do: once a
// session, from the top of the page, and never for someone who has asked
// for less motion.

import { prefersReducedMotion } from '../../lib/hooks';

const SEEN = 'tp-me-opening';

export function shouldOpen() {
  try {
    return !prefersReducedMotion() && window.scrollY < 60 && window.sessionStorage.getItem(SEEN) !== '1';
  } catch {
    return false;
  }
}

export function opened() {
  try {
    window.sessionStorage.setItem(SEEN, '1');
  } catch {
    /* storage unavailable: it opens again next time */
  }
}
