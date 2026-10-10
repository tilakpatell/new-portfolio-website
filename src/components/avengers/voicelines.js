// What the Avengers HQ's people say aloud in its games, and Peter over his
// backpacks round the compound, for scripts/voices to make in their own
// voices (its README: "Whose lines"). Each line as the game shows it; the
// ones put together as they happen (a count, the armour left) aren't here.
// The compound's cast (world/rules.js CAST) is read by export-lines itself.
import { SPOKEN as RANGE } from './repulsor/lines';
import { SPOKEN as TESSERACT } from './tesseract/lines';
import { SPOKEN as LAWN } from './lawn/lines';
import { SPOKEN as TRICKSHOT } from './trickshot/lines';
import { SPOKEN as SMASH } from './smash/lines';
import { SPOKEN as THWIP } from './thwip/lines';
import { REACTOR } from './world/reactor';
import { PACKS } from './world/rules';

const by = (who, lines) => lines.map((text) => ({ who, text }));

export const VOICELINES = [
  // F.R.I.D.A.Y.: the Repulsor Range, the Tesseract run, and the arc reactor in Tony's workshop without 3D
  ...by('friday', [...RANGE, ...TESSERACT, ...REACTOR]),
  // Thor on the lawn, Clint on the range, Bruce Banner down the avenue
  ...by('thor', LAWN),
  ...by('clint', TRICKSHOT),
  ...by('banner', SMASH),
  // Peter: swinging to school, and each backpack he finds webbed up round the compound
  ...by('peter', [...THWIP, ...PACKS.map((p) => p.line)]),
];
