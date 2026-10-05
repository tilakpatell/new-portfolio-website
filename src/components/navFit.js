// What the nav lets go of, first to last, when its contents won't fit the
// bar: the ⌘K hint (the search button stays), LinkedIn and GitHub (they're in
// the footer and the menu), the colour's name (its dot stays), the words on
// the view switch but the one you're in, Terminal, Music, the links themselves
// (into the menu, as on a phone), and last the view switch's last word (its
// icons stay). The Résumé button and the view switch's icons are never among
// them. `fit` is how many it has let go.
export const DROPS = ['kbd', 'social', 'colorName', 'viewLabel', 'terminal', 'music', 'links', 'viewActive'];

export const dropped = (fit, item) => {
  const at = DROPS.indexOf(item);
  return at >= 0 && at < fit;
};

export const nextFit = (fit, overflowing) => (overflowing && fit < DROPS.length ? fit + 1 : fit);
