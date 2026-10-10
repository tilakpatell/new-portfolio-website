// The 2017 heroes' stroke tables (scripts/bf2017-strokes.mjs measures them
// from the game's clips), by the clip pack's name a figure carries
// (crewList.js's `pack`). Plain data.
//
//   strokeTable(pack) → the table, or null for a pack with none

import anakin from "./anakin.json";
import dooku from "./dooku.json";
import luke from "./luke.json";
import maul from "./maul.json";
import obiwan from "./obiwan.json";
import palpatine from "./palpatine.json";
import vader from "./vader.json";

export const STROKE_TABLES = {
  anakin,
  dooku,
  luke,
  maul,
  obiwan,
  palpatine,
  vader,
};
export const strokeTable = (pack) => STROKE_TABLES[pack] ?? null;
