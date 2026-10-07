// What the island's villagers say, for the voices (scripts/voices): each of
// ./rules.js's VILLAGERS' lines, and their last word once every cartridge is
// found, as ./DotMatrixWorld.jsx's dialog shows it. They're the island's own
// people, so their voices are made up for them (scripts/voices/sources/misc.json).
import { VILLAGERS } from './rules';

export const VOICE = { nana: 'dmnana', fisher: 'dmfisher', gardener: 'dmgardener', kid: 'dmkid' };

export const VOICELINES = VILLAGERS.flatMap((v) => [...v.lines, v.done].map((text) => ({ who: VOICE[v.id], text })));
