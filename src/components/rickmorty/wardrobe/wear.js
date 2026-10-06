// A look on a figure, wherever the figure's made: every wardrobe body put
// into a cast's own table (as 'wd:<body>', so a cast's own kinds and their
// sizes stay as they are), and a figure dressed and undressed again.
//
//   createMeshyCast(withWardrobe())            a cast that can make any body
//   cast.load(null, [bodyAsset(look)], …)       its model, before…
//   cast.make(bodyKind(look))                  …the figure
//   const off = dress(figure, look)            colours and gear; off() takes them away
//
// Walt’s and Jesse’s bodies are the site’s own figures, by their whole
// path (meshyCast.js loads them so, on Rick’s clips); one loaded some other
// way (the crews out of the ship, the RV’s seats, Albuquerque’s people) is
// dressed the same, as { group } round its model.

import { MESHY, RIGGED } from '../portal/meshyCast';
import { BODIES, bodyById, whoseBody } from './looks';
import { dressColors } from './dress';
import { wearGear } from './gear';

const ALL = Object.values(BODIES).flat();
export const bodyKind = (look) => `wd:${look.body}`;
export const bodyAsset = (look) => bodyById(look.body)?.asset ?? look.body;
// whose a look is, by its body (Rick’s when it’s nobody’s, as it always was)
export const whoOf = (look) => whoseBody(look.body) ?? 'rick';

export const withWardrobe = ({ kinds = MESHY, rigged = RIGGED, ...rest } = {}) => ({
  ...rest,
  kinds: { ...kinds, ...Object.fromEntries(ALL.map((b) => [`wd:${b.id}`, { a: b.asset, h: b.h }])) },
  rigged: new Set([...rigged, ...ALL.map((b) => b.asset)]),
});

// The look’s colours and gear on a figure (one from such a cast, or any
// model on the same skeleton, as { group }); returns what takes them off
// (its own copies of the materials freed, the gear gone). A figure built
// from shapes has no skeleton to dress, and is left as it is.
export function dress(figure, look) {
  if (!figure?.group || !look || !bodyById(look.body)) return () => {};
  const mats = dressColors(figure, look);
  const off = wearGear(figure, look);
  return () => {
    off();
    for (const m of mats) m.dispose();
  };
}
