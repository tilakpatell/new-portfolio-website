// A look on a figure, wherever the figure's made: every wardrobe body put
// into a cast's own table (as 'wd:<body>', so a cast's own kinds and their
// sizes stay as they are), and a figure dressed and undressed again.
//
//   createMeshyCast(withWardrobe())            a cast that can make any body
//   cast.load(null, [bodyAsset(look)], …)       its model, before…
//   cast.make(bodyKind(look))                  …the figure
//   const off = dress(figure, look)            colours and gear; off() takes them away

import { MESHY, RIGGED } from '../portal/meshyCast';
import { BODIES, bodyOf } from './looks';
import { dressColors } from './dress';
import { wearGear } from './gear';

const ALL = Object.values(BODIES).flat();
export const bodyKind = (look) => `wd:${look.body}`;
export const bodyAsset = (look) => ALL.find((b) => b.id === look.body)?.asset ?? look.body;
export const whoOf = (look) => (BODIES.morty.some((b) => b.id === look.body) ? 'morty' : 'rick');

export const withWardrobe = ({ kinds = MESHY, rigged = RIGGED, ...rest } = {}) => ({
  ...rest,
  kinds: { ...kinds, ...Object.fromEntries(ALL.map((b) => [`wd:${b.id}`, { a: b.asset, h: b.h }])) },
  rigged: new Set([...rigged, ...ALL.map((b) => b.asset)]),
});

// The look's colours and gear on a figure from such a cast; returns what
// takes them off (its own copies of the materials freed, the gear gone).
export function dress(figure, look) {
  if (!figure?.meshy || !bodyOf(whoOf(look), look.body)) return () => {};
  const mats = dressColors(figure, look);
  const off = wearGear(figure, look);
  return () => {
    off();
    for (const m of mats) m.dispose();
  };
}
