// What the towns' people say aloud, for scripts/voices to make in their own
// voices (its README, "Whose lines"): each line as the town's Bubble or Convo
// (./TownHud.jsx) says it, by the voice it passes.
//
// The people you walk up to (each town's CAST), in the voice personVoice
// gives them. In a town whose lines quote what's said, a line with no
// quotes is narration (He looks away.), and isn't said.
//
// And the conversations' speakers export-lines.mjs doesn't list itself:
// Harry at Bree's West Gate and Beregond in Minas Tirith, where they speak
// (a node with no quotes, the gate creaking open, is narration).
import { CAST as AMON_HEN } from './amonhen/layout';
import { CAST as BREE } from './bree/layout';
import { CONVOS as BREE_TALK } from './bree/story';
import { CAST as LORIEN } from './lorien/layout';
import { CONVOS as MINAS_TALK } from './minastirith/story';
import { CAST as MORIA } from './moria/layout';
import { CAST as RIVENDELL } from './rivendell/layout';
import { personVoice } from './talk';
import { CAST as WEATHERTOP } from './weathertop/layout';

const quotes = (text) => text.includes('“');

function walkUps(cast) {
  const quoting = cast.some((c) => c.lines.some(quotes));
  return cast.flatMap((c) => c.lines.filter((text) => !quoting || quotes(text)).map((text) => ({ who: personVoice(c.id), text })));
}

const SPEAKERS = new Set(['harry', 'beregond']);
const spoken = (convos) =>
  Object.values(convos)
    .flatMap((c) => Object.values(c.nodes))
    .filter((n) => SPEAKERS.has(n.who) && quotes(n.say))
    .map((n) => ({ who: n.who, text: n.say }));

export const VOICELINES = [...[AMON_HEN, BREE, LORIEN, MORIA, RIVENDELL, WEATHERTOP].flatMap(walkUps), ...spoken(BREE_TALK), ...spoken(MINAS_TALK)].filter((l) => l.who);
