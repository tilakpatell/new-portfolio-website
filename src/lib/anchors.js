import { prefersReducedMotion } from './hooks';

// The site uses hash routing (#/travel), so a plain in-page link like
// href="#peace-note" would be read as a route and land on the 404 page.
// Links to a spot on the same page call this instead: it scrolls there and,
// when asked, moves keyboard focus too.
export function jumpTo(event, id, { focus = false, block = 'start' } = {}) {
  event?.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block });
  if (focus) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
}
