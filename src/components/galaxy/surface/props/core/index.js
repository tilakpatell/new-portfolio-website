// The core worlds' props, built in code (props/index.js has what a builder
// returns), a part for each world: naboo.js, coruscant.js, kamino.js and
// geonosis.js, with what more than one of them builds with in shared.js.
// One file once, split by world when it passed the 1,500 lines the
// measure counts (docs/health/RULES.md); props/index.js still imports
// './core', and this is what it finds.
//
//   PROPS     every core world's kinds: (kit, opts) → { object, … }
//   SCATTER   every core world's scattered kinds: (kit, opts) → { parts, radius }

import { PROPS as naboo, SCATTER as nabooScatter } from './naboo';
import { PROPS as coruscant } from './coruscant';
import { PROPS as kamino, SCATTER as kaminoScatter } from './kamino';
import { PROPS as geonosis, SCATTER as geonosisScatter } from './geonosis';

export const PROPS = { ...naboo, ...coruscant, ...kamino, ...geonosis };
export const SCATTER = { ...nabooScatter, ...geonosisScatter, ...kaminoScatter };
