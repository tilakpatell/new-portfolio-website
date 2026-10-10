// Every prop a world can build in code, by kind: generic.js's (rocks, pads,
// crates, lamps, a fire) and each group of worlds' own. A builder is
// (kit, opts) → { object, solids?, floors?, update?(t, dt) }:
//   object   a three.js object, in metres, standing on y = 0, facing +z
//   solids   [{ circle: [x, z, r] } | { box: [x, z, hw, hd, yaw?] }, top?,
//            base?, tag?] in its own frame (top: how high it stands, for
//            low things you can step onto; left out, as high as you like;
//            base: where it starts, over a room below; tag: a name a
//            quest's step can take it away by)
//   floors   [{ x, z, r, y } | { x, z, hw, hd, yaw, y }, tag?]: what you
//            can stand on over the land (or inside somewhere)
//   update   its own movement (a flame, a sweeping dish, tentacles)
//   signal   (name, on): something happening to it (a trapdoor opening, a
//            gate coming down, a band starting up)
// A scatter builder is (kit, opts) → { parts: [{ geometry, material,
// local? }], radius } (drawn instanced; radius: its footprint at scale 1,
// null to walk through it).

import { PROPS as generic, SCATTER as genericScatter } from './generic';
import { PROPS as desert, SCATTER as desertScatter } from './desert';
import { PROPS as ice, SCATTER as iceScatter } from './ice';
import { PROPS as forest, SCATTER as forestScatter } from './forest';
import { PROPS as core, SCATTER as coreScatter } from './core';
import { PROPS as edge, SCATTER as edgeScatter } from './edge';
import { PROPS as bespin, SCATTER as bespinScatter } from './bespin';
import { PROPS as inside } from './inside';
import { PROPS as insideCore } from './insideCore';
import { PROPS as insideForest } from './insideForest';
import { PROPS as insideBespin } from './insideBespin';
import { PROPS as echo } from './echo';
import { PROPS as outer, SCATTER as outerScatter } from './outer';

export const PROPS = { ...generic, ...desert, ...ice, ...forest, ...core, ...edge, ...bespin, ...outer, ...inside, ...insideCore, ...insideForest, ...insideBespin, ...echo, bunkerash: edge.bunker };
// (bunkerash: the moss-free bunker model; built, Scarif's grey bunker, as bunker is)
export const SCATTER = { ...genericScatter, ...desertScatter, ...iceScatter, ...forestScatter, ...coreScatter, ...edgeScatter, ...bespinScatter, ...outerScatter };
