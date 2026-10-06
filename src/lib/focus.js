// Focus, for the page's dialogs: Tab kept inside one while it's open, and
// focus put back after, somewhere still on the page.

// Where Tab (or Shift+Tab, `back`) goes from `active` among a dialog's
// focusable `items`: round to the other end at an end, back in at the end
// it was going to if focus got out, and null for an ordinary step the
// browser takes itself.
export function wrapFocus(items, active, back) {
  if (!items.length) return null;
  const first = items[0];
  const last = items[items.length - 1];
  if (!items.includes(active)) return back ? last : first;
  if (back && active === first) return last;
  if (!back && active === last) return first;
  return null;
}

// Focus back to `was` (what had it before a dialog opened) if it's still on
// the page; else to `fallback()`, for what opened it from a panel that's
// closed since. → what got focus, or null.
export function focusBack(was, fallback = () => null) {
  const to = was?.isConnected ? was : fallback();
  to?.focus?.({ preventScroll: true });
  return to ?? null;
}
