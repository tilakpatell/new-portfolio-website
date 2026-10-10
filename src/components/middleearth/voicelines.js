// What the people on the map say when Frodo comes by or you tap them, for
// scripts/voices to make in their own voices (its README, "Whose lines"):
// each line as MapHub says it, by who says it (Strider is Aragorn's voice).
// Not the ones the films' own recordings play (SPOKEN).
import { CAST, HOBBIT_LINES, SPOKEN } from './mapCast';

const own = (who, lines) => lines.filter((text) => !SPOKEN[text]).map((text) => ({ who, text }));

export const VOICELINES = [...CAST.flatMap((c) => own(c.id, c.lines)), ...Object.entries(HOBBIT_LINES).flatMap(([who, lines]) => own(who, lines))];
