// What the nav lets go of, first to last, when its contents won't fit the
// bar: the ⌘K hint (the search button stays), the colour's name (its dot
// stays), LinkedIn and GitHub (they're in the footer and the menu), Terminal,
// Music, and then the links themselves, into the menu as on a phone. The
// Résumé button is never one of them. `fit` is how many it has let go.
export const DROPS = ['kbd', 'colorName', 'social', 'terminal', 'music', 'links'];

export const dropped = (fit, item) => {
  const at = DROPS.indexOf(item);
  return at >= 0 && at < fit;
};

export const nextFit = (fit, overflowing) => (overflowing && fit < DROPS.length ? fit + 1 : fit);
